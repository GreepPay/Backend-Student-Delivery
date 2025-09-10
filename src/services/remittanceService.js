const Remittance = require('../models/Remittance');
const Delivery = require('../models/Delivery');
const Driver = require('../models/Driver');
const EarningsService = require('./earningsService');
const EmailService = require('./emailService');
const moment = require('moment');

class RemittanceService {
    /**
     * Calculate remittance amount for a driver based on cash deliveries
     * @param {string} driverId - Driver ID
     * @param {Date} startDate - Start date for period
     * @param {Date} endDate - End date for period
     * @returns {Object} Remittance calculation details
     */
    static async calculateRemittanceAmount(driverId, startDate, endDate) {
        try {
            // Get cash deliveries for the driver in the specified period
            const cashDeliveries = await Delivery.find({
                assignedTo: driverId,
                status: 'delivered',
                paymentMethod: 'cash',
                deliveredAt: { $gte: startDate, $lte: endDate },
                remittanceStatus: 'pending' // Only include unsettled deliveries
            }).sort({ deliveredAt: 1 });

            if (cashDeliveries.length === 0) {
                return {
                    driverId,
                    startDate,
                    endDate,
                    deliveryCount: 0,
                    totalDeliveryFees: 0,
                    totalDriverEarnings: 0,
                    totalCompanyEarnings: 0,
                    remittanceAmount: 0,
                    deliveries: [],
                    message: 'No cash deliveries found for this period'
                };
            }

            let totalDeliveryFees = 0;
            let totalDriverEarnings = 0;
            let totalCompanyEarnings = 0;
            const deliveryDetails = [];

            // Calculate earnings for each delivery
            for (const delivery of cashDeliveries) {
                const earnings = await EarningsService.calculateEarnings(delivery.fee);

                totalDeliveryFees += delivery.fee;
                totalDriverEarnings += earnings.driverEarning;
                totalCompanyEarnings += earnings.companyEarning;

                deliveryDetails.push({
                    deliveryId: delivery._id,
                    deliveryCode: delivery.deliveryCode,
                    fee: delivery.fee,
                    driverEarning: earnings.driverEarning,
                    companyEarning: earnings.companyEarning,
                    deliveredAt: delivery.deliveredAt,
                    ruleApplied: earnings.ruleApplied
                });
            }

            return {
                driverId,
                startDate,
                endDate,
                deliveryCount: cashDeliveries.length,
                totalDeliveryFees,
                totalDriverEarnings,
                totalCompanyEarnings,
                remittanceAmount: totalCompanyEarnings, // Drivers need to remit company's share
                deliveries: deliveryDetails,
                message: `Found ${cashDeliveries.length} cash deliveries totaling ₺${totalCompanyEarnings} to remit`
            };
        } catch (error) {
            console.error('Error calculating remittance amount:', error);
            throw error;
        }
    }

    /**
     * Calculate balanced remittance amount for a driver considering both cash and non-cash deliveries
     * This addresses the issue where drivers need to remit cash but also deserve earnings from non-cash deliveries
     * @param {string} driverId - Driver ID
     * @param {Date} startDate - Start date for period
     * @param {Date} endDate - End date for period
     * @returns {Object} Balanced remittance calculation details
     */
    static async calculateBalancedRemittanceAmount(driverId, startDate, endDate) {
        try {
            // Get all delivered deliveries for the driver in the specified period
            const allDeliveries = await Delivery.find({
                assignedTo: driverId,
                status: 'delivered',
                deliveredAt: { $gte: startDate, $lte: endDate },
                remittanceStatus: 'pending' // Only include unsettled deliveries
            }).sort({ deliveredAt: 1 });

            if (allDeliveries.length === 0) {
                // Get more detailed information about what deliveries exist
                const totalDriverDeliveries = await Delivery.countDocuments({ assignedTo: driverId });
                const deliveredDeliveries = await Delivery.countDocuments({
                    assignedTo: driverId,
                    status: 'delivered'
                });
                const dateRangeDeliveries = await Delivery.countDocuments({
                    assignedTo: driverId,
                    deliveredAt: { $gte: startDate, $lte: endDate }
                });
                const settledDeliveries = await Delivery.countDocuments({
                    assignedTo: driverId,
                    status: 'delivered',
                    deliveredAt: { $gte: startDate, $lte: endDate },
                    remittanceStatus: 'settled'
                });

                return {
                    driverId,
                    startDate,
                    endDate,
                    totalDeliveries: 0,
                    cashDeliveries: 0,
                    nonCashDeliveries: 0,
                    cashRemittanceOwed: 0,
                    nonCashEarningsOwed: 0,
                    netRemittanceAmount: 0,
                    breakdown: {
                        cash: { count: 0, totalFees: 0, driverEarnings: 0, companyEarnings: 0 },
                        nonCash: { count: 0, totalFees: 0, driverEarnings: 0, companyEarnings: 0 }
                    },
                    deliveries: [],
                    message: `No pending deliveries found for this period. Total driver deliveries: ${totalDriverDeliveries}, Delivered: ${deliveredDeliveries}, In date range: ${dateRangeDeliveries}, Already settled: ${settledDeliveries}`,
                    debug: {
                        totalDriverDeliveries,
                        deliveredDeliveries,
                        dateRangeDeliveries,
                        settledDeliveries
                    }
                };
            }

            let cashRemittanceOwed = 0; // What driver owes company from cash deliveries
            let nonCashEarningsOwed = 0; // What company owes driver from non-cash deliveries
            const deliveryDetails = [];
            const breakdown = {
                cash: { count: 0, totalFees: 0, driverEarnings: 0, companyEarnings: 0 },
                nonCash: { count: 0, totalFees: 0, driverEarnings: 0, companyEarnings: 0 }
            };

            // Process each delivery
            for (const delivery of allDeliveries) {
                const earnings = await EarningsService.calculateEarnings(delivery.fee);

                const deliveryDetail = {
                    deliveryId: delivery._id,
                    deliveryCode: delivery.deliveryCode,
                    fee: delivery.fee,
                    paymentMethod: delivery.paymentMethod,
                    driverEarning: earnings.driverEarning,
                    companyEarning: earnings.companyEarning,
                    deliveredAt: delivery.deliveredAt,
                    ruleApplied: earnings.ruleApplied
                };

                if (delivery.paymentMethod === 'cash') {
                    // Cash delivery: Driver collected cash, owes company their share
                    cashRemittanceOwed += earnings.companyEarning;
                    breakdown.cash.count += 1;
                    breakdown.cash.totalFees += delivery.fee;
                    breakdown.cash.driverEarnings += earnings.driverEarning;
                    breakdown.cash.companyEarnings += earnings.companyEarning;

                    deliveryDetail.remittanceType = 'driver_owes_company';
                    deliveryDetail.amount = earnings.companyEarning;
                } else {
                    // Non-cash delivery: Company collected payment, owes driver their earnings
                    nonCashEarningsOwed += earnings.driverEarning;
                    breakdown.nonCash.count += 1;
                    breakdown.nonCash.totalFees += delivery.fee;
                    breakdown.nonCash.driverEarnings += earnings.driverEarning;
                    breakdown.nonCash.companyEarnings += earnings.companyEarning;

                    deliveryDetail.remittanceType = 'company_owes_driver';
                    deliveryDetail.amount = earnings.driverEarning;
                }

                deliveryDetails.push(deliveryDetail);
            }

            // Calculate net remittance amount
            // If positive: driver owes company money
            // If negative: company owes driver money
            const netRemittanceAmount = cashRemittanceOwed - nonCashEarningsOwed;

            // Determine the final remittance amount and type
            let finalRemittanceAmount, remittanceType, message;

            if (netRemittanceAmount > 0) {
                // Driver owes company money
                finalRemittanceAmount = netRemittanceAmount;
                remittanceType = 'driver_owes_company';
                message = `Driver owes ₺${finalRemittanceAmount} (₺${cashRemittanceOwed} from cash deliveries - ₺${nonCashEarningsOwed} earnings from non-cash deliveries)`;
            } else if (netRemittanceAmount < 0) {
                // Company owes driver money
                finalRemittanceAmount = Math.abs(netRemittanceAmount);
                remittanceType = 'company_owes_driver';
                message = `Company owes driver ₺${finalRemittanceAmount} (₺${nonCashEarningsOwed} earnings from non-cash deliveries - ₺${cashRemittanceOwed} from cash deliveries)`;
            } else {
                // Balanced - no remittance needed
                finalRemittanceAmount = 0;
                remittanceType = 'balanced';
                message = 'Balanced - no remittance needed (cash remittance equals non-cash earnings)';
            }

            return {
                driverId,
                startDate,
                endDate,
                totalDeliveries: allDeliveries.length,
                cashDeliveries: breakdown.cash.count,
                nonCashDeliveries: breakdown.nonCash.count,
                cashRemittanceOwed,
                nonCashEarningsOwed,
                netRemittanceAmount,
                finalRemittanceAmount,
                remittanceType,
                breakdown,
                deliveries: deliveryDetails,
                message
            };
        } catch (error) {
            console.error('Error calculating balanced remittance amount:', error);
            throw error;
        }
    }

    /**
     * Generate balanced remittance for a driver considering both cash and non-cash deliveries
     * @param {string} driverId - Driver ID
     * @param {Date} startDate - Start date for period
     * @param {Date} endDate - End date for period
     * @param {string} adminId - Admin creating the remittance
     * @param {number} dueDateDays - Days until due date (default: 7)
     * @returns {Object} Created balanced remittance
     */
    static async generateBalancedRemittance(driverId, startDate, endDate, adminId, dueDateDays = 7) {
        try {
            // Get driver information
            const driver = await Driver.findById(driverId);
            if (!driver) {
                throw new Error('Driver not found');
            }

            // Get admin information
            const Admin = require('../models/Admin');
            let admin = await Admin.findById(adminId);

            // If admin not found in database, create a fallback admin object
            if (!admin) {
                console.warn(`Admin with ID ${adminId} not found in database, using fallback admin info`);
                admin = {
                    _id: adminId,
                    name: 'System Admin',
                    fullName: 'System Admin', // Keep both for compatibility
                    email: 'admin@system.local'
                };
            }

            // Calculate balanced remittance amount
            const calculation = await this.calculateBalancedRemittanceAmount(driverId, startDate, endDate);

            if (calculation.totalDeliveries === 0) {
                return {
                    success: false,
                    message: calculation.message,
                    debug: calculation.debug,
                    calculation
                };
            }

            // Generate unique reference number
            const referenceNumber = `BAL-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

            // Create the remittance record
            const remittanceData = {
                driverId: driver._id,
                driverName: driver.getFullName(),
                driverEmail: driver.email,
                driverPhone: driver.phone,
                amount: calculation.finalRemittanceAmount,
                remittanceType: calculation.remittanceType,
                cashRemittanceOwed: calculation.cashRemittanceOwed,
                nonCashEarningsOwed: calculation.nonCashEarningsOwed,
                netRemittanceAmount: calculation.netRemittanceAmount,
                paymentMethod: 'cash', // Default, can be updated later
                referenceNumber,
                description: `Balanced remittance: ${calculation.message}`,
                handledBy: admin._id,
                handledByName: admin.fullName || admin.name || 'System Admin',
                handledByEmail: admin.email,
                createdBy: admin._id, // Add missing required field
                deliveryIds: calculation.deliveries.map(d => d.deliveryId),
                deliveryCount: calculation.totalDeliveries,
                cashDeliveryCount: calculation.cashDeliveries,
                nonCashDeliveryCount: calculation.nonCashDeliveries,
                totalDeliveryFees: calculation.breakdown.cash.totalFees + calculation.breakdown.nonCash.totalFees,
                totalDriverEarnings: calculation.breakdown.cash.driverEarnings + calculation.breakdown.nonCash.driverEarnings,
                totalCompanyEarnings: calculation.breakdown.cash.companyEarnings + calculation.breakdown.nonCash.companyEarnings,
                breakdown: calculation.breakdown,
                period: {
                    startDate,
                    endDate
                },
                dueDate: moment().add(dueDateDays, 'days').toDate()
            };

            const remittance = new Remittance(remittanceData);
            await remittance.save();

            // Update delivery remittance status
            await Delivery.updateMany(
                { _id: { $in: calculation.deliveries.map(d => d.deliveryId) } },
                {
                    remittanceStatus: 'settled',
                    remittanceId: remittance._id
                }
            );

            // Send notification email to driver
            try {
                await EmailService.sendRemittanceNotificationEmail(driver.email, driver.getFullName(), {
                    driverName: driver.getFullName(),
                    referenceNumber: remittance.referenceNumber,
                    amount: remittance.amount,
                    remittanceType: remittance.remittanceType,
                    dueDate: remittance.dueDate,
                    deliveryCount: remittance.deliveryCount, // Add missing field
                    period: {
                        startDate: startDate,
                        endDate: endDate
                    }, // Fix period format
                    breakdown: calculation.breakdown,
                    message: calculation.message
                });
            } catch (emailError) {
                console.warn('Failed to send remittance notification email:', emailError.message);
            }

            return {
                success: true,
                remittance,
                calculation,
                message: `Balanced remittance created successfully. ${calculation.message}`
            };

        } catch (error) {
            console.error('Error generating balanced remittance:', error);
            throw error;
        }
    }

    /**
     * Generate remittance for a driver (legacy method for cash-only)
     * @param {string} driverId - Driver ID
     * @param {Date} startDate - Start date for period
     * @param {Date} endDate - End date for period
     * @param {string} adminId - Admin creating the remittance
     * @param {number} dueDateDays - Days until due date (default: 7)
     * @returns {Object} Created remittance
     */
    static async generateRemittance(driverId, startDate, endDate, adminId, dueDateDays = 7) {
        try {
            // Get driver information
            const driver = await Driver.findById(driverId);
            if (!driver) {
                throw new Error('Driver not found');
            }

            // Calculate remittance amount
            const calculation = await this.calculateRemittanceAmount(driverId, startDate, endDate);

            if (calculation.remittanceAmount === 0) {
                throw new Error('No remittance amount to generate');
            }

            // Get admin information
            const Admin = require('../models/Admin');
            const admin = await Admin.findById(adminId);
            if (!admin) {
                throw new Error('Admin not found');
            }

            // Calculate due date
            const dueDate = moment().add(dueDateDays, 'days').toDate();

            // Generate reference number
            const count = await Remittance.countDocuments();
            const referenceNumber = `REM-${Date.now()}-${count + 1}`;

            // Create remittance record
            const remittance = new Remittance({
                driverId: driver._id,
                driverName: driver.fullName,
                driverEmail: driver.email,
                driverPhone: driver.phone,
                amount: calculation.remittanceAmount,
                status: 'pending',
                paymentMethod: 'cash',
                referenceNumber: referenceNumber,
                description: `Cash remittance for ${calculation.deliveryCount} deliveries`,
                handledBy: admin._id,
                handledByName: admin.fullName || admin.name || 'System Admin',
                handledByEmail: admin.email,
                deliveryIds: calculation.deliveries.map(d => d.deliveryId),
                deliveryCount: calculation.deliveryCount,
                totalDeliveryFees: calculation.totalDeliveryFees,
                totalDriverEarnings: calculation.totalDriverEarnings,
                totalCompanyEarnings: calculation.totalCompanyEarnings,
                period: {
                    startDate,
                    endDate
                },
                dueDate,
                createdBy: admin._id
            });

            await remittance.save();

            // Update delivery remittance status
            await Delivery.updateMany(
                { _id: { $in: calculation.deliveries.map(d => d.deliveryId) } },
                {
                    remittanceStatus: 'settled',
                    remittanceId: remittance._id,
                    settledAt: new Date()
                }
            );

            // Send notification to driver
            await this.sendRemittanceNotification(remittance);

            // Send WebSocket notification to driver
            await this.sendWebSocketNotification(remittance);

            return {
                success: true,
                remittance,
                calculation,
                message: `Remittance generated successfully for ${driver.fullName}`
            };
        } catch (error) {
            console.error('Error generating remittance:', error);
            throw error;
        }
    }

    /**
     * Send WebSocket notification to driver
     * @param {Object} remittance - Remittance object
     */
    static async sendWebSocketNotification(remittance) {
        try {
            const socketService = require('./socketService');

            const remittanceData = {
                remittanceId: remittance._id,
                amount: remittance.amount,
                status: remittance.status,
                referenceNumber: remittance.referenceNumber,
                dueDate: remittance.dueDate,
                message: `New remittance created: ₺${remittance.amount}`,
                timestamp: new Date().toISOString()
            };

            // Send to specific driver room
            const driverRoom = `driver-${remittance.driverId}`;
            socketService.io.to(driverRoom).emit('remittance-created', remittanceData);

            // Send to admin room for real-time updates
            socketService.io.to('admin-room').emit('remittance-created', {
                ...remittanceData,
                driverId: remittance.driverId,
                driverName: remittance.driverName,
                message: `New remittance created for ${remittance.driverName}: ₺${remittance.amount}`
            });

            console.log(`💰 WebSocket notification sent for remittance: ${remittance.referenceNumber}`);
        } catch (error) {
            console.error('Error sending WebSocket notification:', error);
            // Don't throw error to avoid breaking the main process
        }
    }

    /**
     * Send remittance notification to driver
     * @param {Object} remittance - Remittance object
     */
    static async sendRemittanceNotification(remittance) {
        try {
            // Send email notification
            await EmailService.sendRemittanceNotificationEmail(
                remittance.driverEmail,
                remittance.driverName,
                {
                    referenceNumber: remittance.referenceNumber,
                    amount: remittance.amount,
                    dueDate: remittance.dueDate,
                    deliveryCount: remittance.deliveryCount,
                    period: remittance.period
                }
            );

            // Update notification status
            remittance.emailSent = true;
            remittance.emailSentAt = new Date();
            remittance.notificationSent = true;
            remittance.notificationSentAt = new Date();
            await remittance.save();

            console.log(`Remittance notification sent to ${remittance.driverName}`);
        } catch (error) {
            console.error('Error sending remittance notification:', error);
            // Don't throw error to avoid breaking the main process
        }
    }

    /**
     * Send reminder for overdue remittances
     * @param {string} remittanceId - Remittance ID
     */
    static async sendReminder(remittanceId) {
        try {
            const remittance = await Remittance.findById(remittanceId);
            if (!remittance) {
                throw new Error('Remittance not found');
            }

            if (remittance.status === 'completed') {
                throw new Error('Cannot send reminder for completed remittance');
            }

            // Send reminder email
            await EmailService.sendRemittanceReminderEmail(
                remittance.driverEmail,
                remittance.driverName,
                {
                    referenceNumber: remittance.referenceNumber,
                    amount: remittance.amount,
                    dueDate: remittance.dueDate,
                    overdueDays: remittance.overdueDays,
                    deliveryCount: remittance.deliveryCount
                }
            );

            // Update reminder status
            remittance.reminderSent = true;
            remittance.reminderSentAt = new Date();
            remittance.reminderCount += 1;
            remittance.lastReminderDate = new Date();
            await remittance.save();

            return {
                success: true,
                message: `Reminder sent to ${remittance.driverName}`
            };
        } catch (error) {
            console.error('Error sending reminder:', error);
            throw error;
        }
    }

    /**
     * Complete remittance payment
     * @param {string} remittanceId - Remittance ID
     * @param {Object} paymentDetails - Payment details
     * @param {string} adminId - Admin completing the payment
     */
    static async completeRemittance(remittanceId, paymentDetails, adminId) {
        try {
            const remittance = await Remittance.findById(remittanceId);
            if (!remittance) {
                throw new Error('Remittance not found');
            }

            if (remittance.status === 'completed') {
                throw new Error('Remittance is already completed');
            }

            // Get admin information
            const Admin = require('../models/Admin');
            const admin = await Admin.findById(adminId);
            if (!admin) {
                throw new Error('Admin not found');
            }

            // Mark as completed
            remittance.markAsCompleted(paymentDetails);
            remittance.handledBy = admin._id;
            remittance.handledByName = admin.name;
            remittance.handledByEmail = admin.email;
            remittance.updatedBy = admin._id;
            await remittance.save();

            // Send completion notification
            await EmailService.sendRemittanceCompletionEmail(
                remittance.driverEmail,
                remittance.driverName,
                {
                    referenceNumber: remittance.referenceNumber,
                    amount: remittance.actualPaymentAmount,
                    paymentDate: remittance.paymentDate,
                    paymentReference: remittance.paymentReference
                }
            );

            return {
                success: true,
                remittance,
                message: `Remittance completed successfully`
            };
        } catch (error) {
            console.error('Error completing remittance:', error);
            throw error;
        }
    }

    /**
     * Get driver's remittance summary
     * @param {string} driverId - Driver ID
     * @returns {Object} Remittance summary
     */
    static async getDriverRemittanceSummary(driverId) {
        try {
            const remittances = await Remittance.find({ driverId }).sort({ createdAt: -1 });

            const summary = {
                totalRemittances: remittances.length,
                pendingRemittances: remittances.filter(r => r.status === 'pending').length,
                overdueRemittances: remittances.filter(r => r.status === 'overdue').length,
                completedRemittances: remittances.filter(r => r.status === 'completed').length,
                totalAmount: remittances.reduce((sum, r) => sum + r.amount, 0),
                totalPaid: remittances.filter(r => r.status === 'completed')
                    .reduce((sum, r) => sum + (r.actualPaymentAmount || r.amount || 0), 0),
                totalPending: remittances.filter(r => r.status === 'pending')
                    .reduce((sum, r) => sum + r.amount, 0),
                totalOverdue: remittances.filter(r => r.status === 'overdue')
                    .reduce((sum, r) => sum + r.amount, 0),
                recentRemittances: remittances.slice(0, 5)
            };

            return summary;
        } catch (error) {
            console.error('Error getting driver remittance summary:', error);
            throw error;
        }
    }

    /**
     * Get overdue remittances that need reminders
     * @returns {Array} Overdue remittances
     */
    static async getOverdueRemittances() {
        try {
            const overdueRemittances = await Remittance.find({
                status: { $in: ['pending', 'overdue'] },
                dueDate: { $lt: new Date() },
                reminderSent: false
            }).populate('driverId', 'fullName email phone');

            return overdueRemittances;
        } catch (error) {
            console.error('Error getting overdue remittances:', error);
            throw error;
        }
    }

    /**
     * Get pending remittances due soon
     * @param {number} daysAhead - Days ahead to check (default: 3)
     * @returns {Array} Pending remittances due soon
     */
    static async getRemittancesDueSoon(daysAhead = 3) {
        try {
            const startDate = new Date();
            const endDate = moment().add(daysAhead, 'days').toDate();

            const dueSoonRemittances = await Remittance.find({
                status: 'pending',
                dueDate: { $gte: startDate, $lte: endDate }
            }).populate('driverId', 'fullName email phone');

            return dueSoonRemittances;
        } catch (error) {
            console.error('Error getting remittances due soon:', error);
            throw error;
        }
    }

    /**
     * Get remittance statistics for admin dashboard
     * @returns {Object} Remittance statistics
     */
    static async getRemittanceStatistics() {
        try {
            const [
                totalRemittances,
                pendingRemittances,
                overdueRemittances,
                completedRemittances,
                totalAmount,
                totalPending,
                totalOverdue
            ] = await Promise.all([
                Remittance.countDocuments(),
                Remittance.countDocuments({ status: 'pending' }),
                Remittance.countDocuments({ status: 'overdue' }),
                Remittance.countDocuments({ status: 'completed' }),
                Remittance.aggregate([
                    { $group: { _id: null, total: { $sum: '$amount' } } }
                ]),
                Remittance.aggregate([
                    { $match: { status: 'pending' } },
                    { $group: { _id: null, total: { $sum: '$amount' } } }
                ]),
                Remittance.aggregate([
                    { $match: { status: 'overdue' } },
                    { $group: { _id: null, total: { $sum: '$amount' } } }
                ])
            ]);

            // Calculate totalPaid manually
            const completedRemittancesList = await Remittance.find({ status: 'completed' });
            const totalPaid = completedRemittancesList.reduce((sum, r) => {
                return sum + (r.actualPaymentAmount || r.amount || 0);
            }, 0);

            return {
                totalRemittances,
                pendingRemittances,
                overdueRemittances,
                completedRemittances,
                totalAmount: totalAmount[0]?.total || 0,
                totalPaid: totalPaid,
                totalPending: totalPending[0]?.total || 0,
                totalOverdue: totalOverdue[0]?.total || 0,
                completionRate: totalRemittances > 0 ?
                    Math.round((completedRemittances / totalRemittances) * 100) : 0
            };
        } catch (error) {
            console.error('Error getting remittance statistics:', error);
            throw error;
        }
    }
}

module.exports = RemittanceService;
