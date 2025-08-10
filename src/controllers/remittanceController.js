const { catchAsync, successResponse, errorResponse } = require('../middleware/errorHandler');
const mongoose = require('mongoose');
const Remittance = require('../models/Remittance');
const Driver = require('../models/Driver');
const Delivery = require('../models/Delivery');
const Notification = require('../models/Notification');
const emailService = require('../services/emailService');
const notificationService = require('../services/notificationService');
const socketService = require('../services/socketService');
const AnalyticsService = require('../services/analyticsService');

class RemittanceController {
    // Get all remittances with filters
    static getAllRemittances = catchAsync(async (req, res) => {
        const { page = 1, limit = 20, status, driverId, startDate, endDate, handledBy } = req.query;
        const skip = (page - 1) * limit;

        // Build filter object
        const filter = {};
        if (status) filter.status = status;
        if (driverId) filter.driverId = driverId;
        if (handledBy) filter.handledBy = handledBy;
        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) filter.createdAt.$gte = new Date(startDate);
            if (endDate) filter.createdAt.$lte = new Date(endDate);
        }

        const remittances = await Remittance.find(filter)
            .populate('driverId', 'name email phone area')
            .populate('handledBy', 'name email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Remittance.countDocuments(filter);

        successResponse(res, {
            remittances,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        }, 'Remittances retrieved successfully');
    });

    // Get remittances for a specific driver
    static getDriverRemittances = catchAsync(async (req, res) => {
        const { driverId } = req.params;
        const { page = 1, limit = 20, status } = req.query;
        const skip = (page - 1) * limit;

        const filter = { driverId };
        if (status) filter.status = status;

        const remittances = await Remittance.find(filter)
            .populate('handledBy', 'name email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Remittance.countDocuments(filter);

        successResponse(res, {
            remittances,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        }, 'Driver remittances retrieved successfully');
    });

    // Get pending remittances for admin dashboard
    static getPendingRemittances = catchAsync(async (req, res) => {
        const remittances = await Remittance.find({ status: 'pending' })
            .populate('driverId', 'name email phone area')
            .populate('handledBy', 'name email')
            .sort({ createdAt: -1 })
            .limit(10);

        const totalPending = await Remittance.countDocuments({ status: 'pending' });
        const totalCompleted = await Remittance.countDocuments({ status: 'completed' });
        const totalAmount = await Remittance.aggregate([
            { $match: { status: 'completed' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        successResponse(res, {
            remittances,
            stats: {
                pending: totalPending,
                completed: totalCompleted,
                totalAmount: totalAmount[0]?.total || 0
            }
        }, 'Pending remittances retrieved successfully');
    });

    // Calculate and create remittance automatically from completed deliveries
    static calculateRemittance = catchAsync(async (req, res) => {
        const { driverId } = req.params;

        console.log('🔍 Starting remittance calculation for driver:', driverId);

        // Validate driver exists
        const driver = await Driver.findById(driverId);
        if (!driver) {
            const AppError = require('../middleware/errorHandler').AppError;
            throw new AppError('Driver not found', 404);
        }

        // Check if there's already a pending remittance for this driver
        const existingPending = await Remittance.findOne({
            driverId,
            status: 'pending'
        });

        if (existingPending) {
            const AppError = require('../middleware/errorHandler').AppError;
            throw new AppError('Driver already has a pending remittance', 400);
        }

        // Get completed deliveries that haven't been settled yet
        const unsettledDeliveries = await Delivery.find({
            assignedTo: driverId,
            status: 'delivered',
            remittanceStatus: { $ne: 'settled' }
        }).sort({ deliveredAt: 1 });

        console.log('🔍 Found unsettled deliveries:', unsettledDeliveries.length);

        if (unsettledDeliveries.length === 0) {
            const AppError = require('../middleware/errorHandler').AppError;
            throw new AppError('No unsettled deliveries found for this driver', 400);
        }

        // Calculate total amount based on company earnings from deliveries
        const totalAmount = unsettledDeliveries.reduce((sum, delivery) => {
            return sum + (delivery.companyEarning || 0);
        }, 0);

        console.log('🔍 Calculated total amount:', totalAmount);

        // Get earnings configuration for reference
        const EarningsConfig = require('../models/EarningsConfig');
        const activeConfig = await EarningsConfig.getActiveConfig();
        const paymentStructure = activeConfig ? activeConfig.getRulesArray() : null;

        // Create detailed description with payment structure
        const paymentStructureDesc = paymentStructure ?
            `Based on active earnings configuration with ${paymentStructure.length} tiers` :
            'Using default earnings structure';

        // Generate reference number
        const count = await Remittance.countDocuments();
        const referenceNumber = `REM-${Date.now()}-${count + 1}`;

        console.log('🔍 Generated reference number:', referenceNumber);

        const remittance = new Remittance({
            driverId,
            driverName: driver.name,
            driverEmail: driver.email,
            amount: totalAmount,
            paymentMethod: 'cash', // Default, can be updated
            referenceNumber: referenceNumber,
            description: `Remittance for ${unsettledDeliveries.length} completed deliveries`,
            period: {
                startDate: unsettledDeliveries[0].deliveredAt,
                endDate: unsettledDeliveries[unsettledDeliveries.length - 1].deliveredAt
            },
            deliveryIds: unsettledDeliveries.map(d => d._id),
            notes: `Automatically calculated from ${unsettledDeliveries.length} deliveries. ${paymentStructureDesc}. Total company earnings: ₺${totalAmount}`,
            handledBy: req.user._id || req.user.id, // This should be the admin handling the remittance
            handledByName: req.user.name, // This should be the admin's name
            handledByEmail: req.user.email // This should be the admin's email
        });

        console.log('🔍 About to save remittance...');
        await remittance.save();
        console.log('🔍 Remittance saved successfully');

        // Create notification for driver about remittance calculation
        try {
            await notificationService.createNotification({
                recipient: driverId,
                recipientModel: 'Driver',
                type: 'remittance_calculated',
                title: 'Remittance Calculated',
                message: `Your remittance has been calculated for ${unsettledDeliveries.length} deliveries. Amount: ₺${totalAmount}`,
                data: {
                    remittanceId: remittance._id,
                    referenceNumber: remittance.referenceNumber,
                    amount: totalAmount,
                    deliveryCount: unsettledDeliveries.length,
                    period: {
                        startDate: unsettledDeliveries[0].deliveredAt,
                        endDate: unsettledDeliveries[unsettledDeliveries.length - 1].deliveredAt
                    }
                },
                createdBy: req.user._id || req.user.id,
                createdByModel: 'Admin'
            });
            console.log('🔔 Remittance calculation notification sent to driver');
        } catch (notificationError) {
            console.error('Failed to create remittance calculation notification:', notificationError.message);
        }

        // Simple response for debugging
        res.status(200).json({
            success: true,
            message: 'Remittance calculated and created successfully',
            data: {
                remittanceId: remittance._id,
                referenceNumber: remittance.referenceNumber,
                amount: remittance.amount,
                deliveryCount: unsettledDeliveries.length,
                totalAmount
            }
        });
    });

    // Complete remittance and mark deliveries as settled
    static completeRemittance = catchAsync(async (req, res) => {
        const { remittanceId } = req.params;
        const { notes } = req.body;

        const remittance = await Remittance.findById(remittanceId);
        if (!remittance) {
            return errorResponse(res, 'Remittance not found', 404);
        }

        if (remittance.status !== 'pending') {
            return errorResponse(res, 'Remittance is not pending', 400);
        }

        // Update remittance status
        remittance.status = 'completed';
        remittance.handledBy = req.user._id || req.user.id;
        remittance.handledByName = req.user.name;
        remittance.handledByEmail = req.user.email;
        remittance.handledAt = new Date();
        remittance.notes = notes || remittance.notes;

        await remittance.save();

        // Mark all associated deliveries as settled
        if (remittance.deliveryIds && remittance.deliveryIds.length > 0) {
            await Delivery.updateMany(
                { _id: { $in: remittance.deliveryIds } },
                {
                    $set: {
                        remittanceStatus: 'settled',
                        remittanceId: remittance._id,
                        settledAt: new Date()
                    }
                }
            );
        }

        // Send email notification to driver
        try {
            await emailService.sendRemittanceCompletedEmail(
                remittance.driverEmail,
                remittance.driverName,
                {
                    referenceNumber: remittance.referenceNumber,
                    amount: remittance.amount,
                    paymentMethod: remittance.paymentMethod,
                    handledByName: req.user.name,
                    handledAt: remittance.handledAt,
                    notes: remittance.notes
                }
            );
            remittance.emailSent = true;
            await remittance.save();
        } catch (error) {
            console.error('Email sending failed:', error);
        }

        // Send in-app notification to driver
        await notificationService.createNotification({
            recipient: remittance.driverId,
            recipientModel: 'Driver',
            type: 'remittance_completed',
            title: 'Remittance Completed',
            message: `Your remittance of ₺${remittance.amount} has been completed and processed.`,
            data: {
                remittanceId: remittance._id,
                amount: remittance.amount,
                referenceNumber: remittance.referenceNumber,
                handledByName: req.user.name
            },
            createdBy: req.user._id,
            createdByModel: 'Admin'
        });

        // Emit socket notification
        socketService.emitNewNotification({
            recipient: remittance.driverId,
            type: 'remittance_completed',
            message: `Remittance of ₺${remittance.amount} completed`
        });

        // Emit remission update to driver
        try {
            // Recalculate remission owed after remittance completion
            const updatedDeliveries = await Delivery.find({
                assignedTo: remittance.driverId,
                status: 'delivered'
            });

            const remissionData = AnalyticsService.calculateRemissionOwed(updatedDeliveries);

            socketService.io.to(`driver-${remittance.driverId}`).emit('remission-updated', {
                remissionOwed: remissionData.totalOwed,
                unsettledCashDeliveries: remissionData.unsettledCashDeliveries,
                totalCashDeliveries: remissionData.cashDeliveries,
                message: `Remittance completed. New remission owed: ₺${remissionData.totalOwed}`
            });

            console.log('🔔 Emitted remission update to driver:', remissionData);
        } catch (error) {
            console.error('Failed to emit remission update:', error);
        }

        successResponse(res, { remittance }, 'Remittance completed successfully');
    });

    // Cancel remittance
    static cancelRemittance = catchAsync(async (req, res) => {
        const { remittanceId } = req.params;
        const { reason } = req.body;

        const remittance = await Remittance.findById(remittanceId);
        if (!remittance) {
            return errorResponse(res, 'Remittance not found', 404);
        }

        if (remittance.status !== 'pending') {
            return errorResponse(res, 'Only pending remittances can be cancelled', 400);
        }

        remittance.status = 'cancelled';
        remittance.handledBy = req.user._id || req.user.id;
        remittance.handledByName = req.user.name;
        remittance.handledByEmail = req.user.email;
        remittance.handledAt = new Date();
        remittance.notes = reason || remittance.notes;

        await remittance.save();

        // Send notification to driver
        await notificationService.createNotification({
            recipient: remittance.driverId,
            recipientModel: 'Driver',
            type: 'remittance_cancelled',
            title: 'Remittance Cancelled',
            message: `Your remittance of ₺${remittance.amount} has been cancelled.`,
            data: {
                remittanceId: remittance._id,
                amount: remittance.amount,
                referenceNumber: remittance.referenceNumber,
                reason
            },
            createdBy: req.user._id || req.user.id,
            createdByModel: 'Admin'
        });

        successResponse(res, { remittance }, 'Remittance cancelled successfully');
    });

    // Get unsettled deliveries for a driver
    static getUnsettledDeliveries = catchAsync(async (req, res) => {
        const { driverId } = req.params;

        const unsettledDeliveries = await Delivery.find({
            assignedTo: driverId,
            status: 'delivered',
            remittanceStatus: { $ne: 'settled' }
        }).sort({ deliveredAt: 1 });

        const totalAmount = unsettledDeliveries.reduce((sum, delivery) => {
            return sum + (delivery.companyEarning || 50);
        }, 0);

        successResponse(res, {
            deliveries: unsettledDeliveries,
            totalAmount,
            deliveryCount: unsettledDeliveries.length
        }, 'Unsettled deliveries retrieved successfully');
    });

    // Get remittance statistics
    static getRemittanceStats = catchAsync(async (req, res) => {
        const { period = 'month' } = req.query;

        let startDate, endDate;
        const now = new Date();

        switch (period) {
            case 'week':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case 'month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            case 'year':
                startDate = new Date(now.getFullYear(), 0, 1);
                break;
            default:
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        }

        endDate = now;

        // Get remittance statistics with company earnings calculation
        const stats = await Remittance.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $lookup: {
                    from: 'deliveries',
                    localField: 'deliveryIds',
                    foreignField: '_id',
                    as: 'deliveries'
                }
            },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    totalDriverAmount: { $sum: '$amount' },
                    totalCompanyAmount: { $sum: { $sum: '$deliveries.companyEarning' } }
                }
            }
        ]);

        const totalRemittances = await Remittance.countDocuments({
            createdAt: { $gte: startDate, $lte: endDate }
        });

        // Calculate total company earnings for completed remittances
        const totalCompanyAmount = await Remittance.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate, $lte: endDate },
                    status: 'completed'
                }
            },
            {
                $lookup: {
                    from: 'deliveries',
                    localField: 'deliveryIds',
                    foreignField: '_id',
                    as: 'deliveries'
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: { $sum: '$deliveries.companyEarning' } }
                }
            }
        ]);

        // Calculate pending company earnings
        const pendingCompanyAmount = await Remittance.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate, $lte: endDate },
                    status: 'pending'
                }
            },
            {
                $lookup: {
                    from: 'deliveries',
                    localField: 'deliveryIds',
                    foreignField: '_id',
                    as: 'deliveries'
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: { $sum: '$deliveries.companyEarning' } }
                }
            }
        ]);

        successResponse(res, {
            stats: {
                total: totalRemittances,
                completed: stats.find(s => s._id === 'completed')?.count || 0,
                pending: stats.find(s => s._id === 'pending')?.count || 0,
                cancelled: stats.find(s => s._id === 'cancelled')?.count || 0,
                totalAmount: totalCompanyAmount[0]?.total || 0,
                pendingAmount: pendingCompanyAmount[0]?.total || 0
            },
            period: {
                startDate,
                endDate
            }
        }, 'Remittance statistics retrieved successfully');
    });

    // Get driver's remittance summary
    static getDriverRemittanceSummary = catchAsync(async (req, res) => {
        const { driverId } = req.params;

        const summary = await Remittance.aggregate([
            {
                $match: { driverId: new mongoose.Types.ObjectId(driverId) }
            },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    totalAmount: { $sum: '$amount' }
                }
            }
        ]);

        const totalCompleted = summary.find(s => s._id === 'completed')?.totalAmount || 0;
        const totalPending = summary.find(s => s._id === 'pending')?.totalAmount || 0;

        successResponse(res, {
            summary: {
                completed: summary.find(s => s._id === 'completed')?.count || 0,
                pending: summary.find(s => s._id === 'pending')?.count || 0,
                cancelled: summary.find(s => s._id === 'cancelled')?.count || 0,
                totalCompleted,
                totalPending
            }
        }, 'Driver remittance summary retrieved successfully');
    });

    // Get current payment structure for remittance calculations
    static getPaymentStructure = catchAsync(async (req, res) => {
        try {
            const EarningsConfig = require('../models/EarningsConfig');
            const activeConfig = await EarningsConfig.getActiveConfig();

            let paymentStructure;
            if (activeConfig) {
                paymentStructure = {
                    name: activeConfig.name,
                    rules: activeConfig.getRulesArray(),
                    effectiveDate: activeConfig.effectiveDate,
                    notes: activeConfig.notes
                };
            } else {
                // Return default structure
                const EarningsService = require('../services/earningsService');
                paymentStructure = {
                    name: 'Default Earnings Rules',
                    rules: EarningsService.defaultEarningsRules.rules,
                    effectiveDate: new Date(),
                    notes: 'Default system configuration'
                };
            }

            successResponse(res, {
                paymentStructure,
                description: 'Current payment structure used for remittance calculations'
            }, 'Payment structure retrieved successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Get driver remittances with earnings summary for authenticated driver
    static getDriverRemittancesWithSummary = catchAsync(async (req, res) => {
        const { user } = req;
        const { page = 1, limit = 20, status } = req.query;
        const skip = (page - 1) * limit;

        try {
            // Build filter for current driver
            const filter = { driverId: user.id };
            if (status) filter.status = status;

            // Get remittances
            const remittances = await Remittance.find(filter)
                .populate('handledBy', 'fullName email')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit));

            const total = await Remittance.countDocuments(filter);

            // Get driver details for earnings calculation
            const Driver = require('../models/Driver');
            const driver = await Driver.findById(user.id);

            if (!driver) {
                return res.status(404).json({
                    success: false,
                    error: 'Driver not found'
                });
            }

            // Calculate summary statistics
            const completedRemittances = await Remittance.find({
                driverId: user.id,
                status: 'completed'
            });

            const pendingRemittances = await Remittance.find({
                driverId: user.id,
                status: 'pending'
            });

            const totalPaidOut = completedRemittances.reduce((sum, r) => sum + r.amount, 0);
            const pendingAmount = pendingRemittances.reduce((sum, r) => sum + r.amount, 0);

            // Get last payout
            const lastPayout = completedRemittances.length > 0
                ? {
                    amount: completedRemittances[0].amount,
                    date: completedRemittances[0].updatedAt
                }
                : null;

            // Available balance = total earnings - total paid out - pending
            const availableBalance = Math.max(0, driver.totalEarnings - totalPaidOut - pendingAmount);

            // Format remittances for response
            const formattedRemittances = remittances.map(remittance => ({
                id: remittance._id,
                amount: remittance.amount,
                status: remittance.status === 'completed' ? 'completed' :
                    remittance.status === 'pending' ? 'pending' : 'processing',
                requestDate: remittance.createdAt,
                completedDate: remittance.status === 'completed' ? remittance.updatedAt : null,
                method: remittance.paymentMethod === 'bank_transfer' ? 'bank_transfer' :
                    remittance.paymentMethod === 'mobile_money' ? 'mobile_money' :
                        remittance.paymentMethod,
                reference: remittance.referenceNumber,
                description: remittance.description || 'Remittance payment'
            }));

            const summary = {
                totalEarnings: driver.totalEarnings || 0,
                availableBalance: availableBalance,
                pendingAmount: pendingAmount,
                totalPaidOut: totalPaidOut,
                lastPayout: lastPayout
            };

            successResponse(res, {
                remittances: formattedRemittances,
                summary: summary,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }, 'Driver remittances retrieved successfully');

        } catch (error) {
            console.error('Driver remittances error:', error);
            errorResponse(res, error, 500);
        }
    });
}

module.exports = RemittanceController; 