const Delivery = require('../models/Delivery');
const Driver = require('../models/Driver');
const EmailService = require('../services/emailService');
const NotificationService = require('../services/notificationService');
const EarningsService = require('../services/earningsService');
const AdminNotificationService = require('../services/adminNotificationService');
const { catchAsync, successResponse, errorResponse, paginatedResponse } = require('../middleware/errorHandler');

class DeliveryController {
    // Get all deliveries with filters
    static getDeliveries = catchAsync(async (req, res) => {
        const {
            page = 1,
            limit = 20,
            status,
            assignedTo,
            startDate,
            endDate,
            area,
            priority,
            paymentMethod
        } = req.query;

        try {
            const query = {};

            // Apply filters
            if (status) query.status = status;
            if (assignedTo) query.assignedTo = assignedTo;
            if (priority) query.priority = priority;
            if (paymentMethod) query.paymentMethod = paymentMethod;

            if (startDate || endDate) {
                query.createdAt = {};
                if (startDate) query.createdAt.$gte = new Date(startDate);
                if (endDate) query.createdAt.$lte = new Date(endDate);
            }

            // Build aggregation pipeline for area filter
            let deliveries;
            let total;

            if (area) {
                // Need to filter by driver's area
                const pipeline = [
                    {
                        $lookup: {
                            from: 'drivers',
                            localField: 'assignedTo',
                            foreignField: '_id',
                            as: 'driver'
                        }
                    },
                    {
                        $match: {
                            ...query,
                            'driver.area': area
                        }
                    },
                    {
                        $lookup: {
                            from: 'admins',
                            localField: 'assignedBy',
                            foreignField: '_id',
                            as: 'assignedByData'
                        }
                    },
                    {
                        $project: {
                            deliveryCode: 1,
                            pickupLocation: 1,
                            deliveryLocation: 1,
                            customerName: 1,
                            customerPhone: 1,
                            fee: 1,
                            driverEarning: 1,
                            companyEarning: 1,
                            status: 1,
                            paymentMethod: 1,
                            priority: 1,
                            notes: 1,
                            createdAt: 1,
                            updatedAt: 1,
                            deliveredAt: 1,
                            estimatedTime: 1,
                            assignedTo: { $arrayElemAt: ['$driver', 0] },
                            assignedBy: { $arrayElemAt: ['$assignedByData', 0] }
                        }
                    },
                    { $sort: { createdAt: -1 } },
                    { $skip: (page - 1) * limit },
                    { $limit: parseInt(limit) }
                ];

                deliveries = await Delivery.aggregate(pipeline);

                // Get total count for pagination
                const countPipeline = pipeline.slice(0, -3); // Remove sort, skip, limit
                countPipeline.push({ $count: 'total' });
                const countResult = await Delivery.aggregate(countPipeline);
                total = countResult[0]?.total || 0;
            } else {
                // Standard query without area filter
                deliveries = await Delivery.find(query)
                    .populate('assignedTo', 'name email area')
                    .populate('assignedBy', 'name email')
                    .sort({ createdAt: -1 })
                    .limit(limit * 1)
                    .skip((page - 1) * limit);

                total = await Delivery.countDocuments(query);
            }

            paginatedResponse(res, deliveries, {
                page: parseInt(page),
                limit: parseInt(limit),
                total
            });
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Get single delivery
    static getDelivery = catchAsync(async (req, res) => {
        const { id } = req.params;

        try {
            const delivery = await Delivery.findById(id)
                .populate('assignedTo', 'name email phone area')
                .populate('assignedBy', 'name email');

            if (!delivery) {
                return res.status(404).json({
                    success: false,
                    error: 'Delivery not found'
                });
            }

            successResponse(res, delivery, 'Delivery retrieved successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Create new delivery
    static createDelivery = catchAsync(async (req, res) => {
        const {
            pickupLocation,
            pickupLocationLink,
            deliveryLocation,
            deliveryLocationLink,
            customerName,
            customerPhone,
            fee = 150,
            paymentMethod = 'cash',
            estimatedTime,
            notes,
            priority = 'normal',
            distance,
            assignedTo
        } = req.body;
        const { user } = req;

        try {
            // Calculate driver and company earnings using the new earnings service
            const earnings = await EarningsService.calculateEarnings(fee);

            // Create delivery
            const delivery = await Delivery.create({
                pickupLocation,
                pickupLocationLink,
                deliveryLocation,
                deliveryLocationLink,
                customerName,
                customerPhone,
                fee,
                driverEarning: earnings.driverEarning,
                companyEarning: earnings.companyEarning,
                paymentMethod,
                estimatedTime,
                notes,
                priority,
                distance,
                assignedBy: user.id,
                ...(assignedTo && { assignedTo })
            });

            // Populate the created delivery
            const populatedDelivery = await Delivery.findById(delivery._id)
                .populate('assignedTo', 'name email area')
                .populate('assignedBy', 'name email');

            // Send notification if assigned to a driver
            if (assignedTo) {
                try {
                    const driver = await Driver.findById(assignedTo);
                    if (driver) {
                        // Send email notification
                        await EmailService.sendDeliveryAssignment(driver.email, driver.name, populatedDelivery);

                        // Create in-app notification
                        await NotificationService.createNotification({
                            recipient: assignedTo,
                            recipientModel: 'Driver',
                            type: 'delivery_assigned',
                            title: 'New Delivery Assigned',
                            message: `You have been assigned a new delivery: ${delivery.deliveryCode}`,
                            data: {
                                deliveryId: delivery._id,
                                deliveryCode: delivery.deliveryCode,
                                pickupLocation,
                                deliveryLocation,
                                fee,
                                driverEarning: earnings.driverEarning
                            },
                            createdBy: user.id,
                            createdByModel: 'Admin'
                        });
                    }
                } catch (emailError) {
                    console.error('Failed to send delivery assignment email:', emailError.message);
                }
            }

            successResponse(res, populatedDelivery, 'Delivery created successfully', 201);
        } catch (error) {
            errorResponse(res, error, 400);
        }
    });

    // Update delivery
    static updateDelivery = catchAsync(async (req, res) => {
        const { id } = req.params;
        const updateData = req.body;

        try {
            const delivery = await Delivery.findById(id);
            if (!delivery) {
                return res.status(404).json({
                    success: false,
                    error: 'Delivery not found'
                });
            }

            // If fee is being updated, recalculate earnings using the new earnings service
            if (updateData.fee) {
                const earnings = await EarningsService.calculateEarnings(updateData.fee);
                updateData.driverEarning = earnings.driverEarning;
                updateData.companyEarning = earnings.companyEarning;
            }

            const updatedDelivery = await Delivery.findByIdAndUpdate(
                id,
                {
                    ...updateData,
                    updatedAt: new Date()
                },
                { new: true, runValidators: true }
            )
                .populate('assignedTo', 'name email area')
                .populate('assignedBy', 'name email');

            // Send notification to driver if delivery is assigned
            if (updatedDelivery.assignedTo) {
                try {
                    // Create in-app notification for delivery update
                    await NotificationService.createNotification({
                        recipient: updatedDelivery.assignedTo._id,
                        recipientModel: 'Driver',
                        type: 'delivery_updated',
                        title: 'Delivery Updated',
                        message: `Delivery ${updatedDelivery.deliveryCode} has been updated by admin`,
                        data: {
                            deliveryId: updatedDelivery._id,
                            deliveryCode: updatedDelivery.deliveryCode,
                            updatedFields: Object.keys(updateData)
                        },
                        createdBy: req.user._id || req.user.id,
                        createdByModel: 'Admin'
                    });
                } catch (notificationError) {
                    console.error('Failed to create delivery update notification:', notificationError.message);
                }
            }

            successResponse(res, updatedDelivery, 'Delivery updated successfully');
        } catch (error) {
            errorResponse(res, error, 400);
        }
    });

    // Delete delivery
    static deleteDelivery = catchAsync(async (req, res) => {
        const { id } = req.params;

        try {
            const delivery = await Delivery.findById(id);
            if (!delivery) {
                return res.status(404).json({
                    success: false,
                    error: 'Delivery not found'
                });
            }

            // Check if delivery can be deleted (only pending or cancelled)
            if (!['pending', 'cancelled'].includes(delivery.status)) {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot delete delivery that is in progress or completed'
                });
            }

            // Send notification to driver if delivery was assigned
            if (delivery.assignedTo) {
                try {
                    // Create in-app notification for delivery deletion
                    await NotificationService.createNotification({
                        recipient: delivery.assignedTo,
                        recipientModel: 'Driver',
                        type: 'delivery_deleted',
                        title: 'Delivery Deleted',
                        message: `Delivery ${delivery.deliveryCode} has been deleted by admin`,
                        data: {
                            deliveryCode: delivery.deliveryCode,
                            reason: 'Admin deleted delivery'
                        },
                        createdBy: req.user._id || req.user.id,
                        createdByModel: 'Admin'
                    });
                } catch (notificationError) {
                    console.error('Failed to create delivery deletion notification:', notificationError.message);
                }
            }

            await Delivery.findByIdAndDelete(id);

            successResponse(res, null, 'Delivery deleted successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Assign delivery to driver
    static assignDelivery = catchAsync(async (req, res) => {
        const { id } = req.params;
        const { driverId, notes } = req.body;
        const { user } = req;

        try {
            const delivery = await Delivery.findById(id);
            if (!delivery) {
                return res.status(404).json({
                    success: false,
                    error: 'Delivery not found'
                });
            }

            // Check if delivery can be assigned
            if (delivery.status !== 'pending') {
                return res.status(400).json({
                    success: false,
                    error: 'Can only assign pending deliveries'
                });
            }

            // Check if driver exists and is active
            const driver = await Driver.findById(driverId);
            if (!driver || !driver.isActive) {
                return res.status(400).json({
                    success: false,
                    error: 'Driver not found or inactive'
                });
            }

            // Assign delivery
            const updatedDelivery = await delivery.assignToDriver(driverId, user.id);

            // Populate the updated delivery
            const populatedDelivery = await Delivery.findById(updatedDelivery._id)
                .populate('assignedTo', 'name email area')
                .populate('assignedBy', 'name email');

            // Send assignment notification
            try {
                await EmailService.sendDeliveryAssignment(driver.email, driver.name, populatedDelivery);
            } catch (emailError) {
                console.error('Failed to send assignment email:', emailError.message);
            }

            // Create in-app notification for driver
            try {
                await NotificationService.createDeliveryAssignedNotification(updatedDelivery._id, driverId);
            } catch (notificationError) {
                console.error('Failed to create delivery notification:', notificationError.message);
            }

            successResponse(res, populatedDelivery, 'Delivery assigned successfully');
        } catch (error) {
            errorResponse(res, error, 400);
        }
    });

    // Unassign delivery from driver
    static unassignDelivery = catchAsync(async (req, res) => {
        const { id } = req.params;

        try {
            const delivery = await Delivery.findById(id);
            if (!delivery) {
                return res.status(404).json({
                    success: false,
                    error: 'Delivery not found'
                });
            }

            // Check if delivery can be unassigned
            if (!['assigned', 'picked_up'].includes(delivery.status)) {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot unassign completed or cancelled deliveries'
                });
            }

            const updatedDelivery = await Delivery.findByIdAndUpdate(
                id,
                {
                    assignedTo: null,
                    status: 'pending',
                    assignedAt: null,
                    pickedUpAt: null,
                    updatedAt: new Date()
                },
                { new: true }
            )
                .populate('assignedBy', 'name email')
                .populate('assignedTo', 'name email');

            // Send unassignment notification to driver if delivery was assigned
            if (delivery.assignedTo) {
                try {
                    const driver = await Driver.findById(delivery.assignedTo);
                    if (driver) {
                        // Send email notification
                        await EmailService.sendDeliveryUnassignment(driver.email, driver.name, updatedDelivery);

                        // Create in-app notification
                        await NotificationService.createNotification({
                            recipient: delivery.assignedTo,
                            recipientModel: 'Driver',
                            type: 'delivery_unassigned',
                            title: 'Delivery Unassigned',
                            message: `Delivery ${updatedDelivery.deliveryCode} has been unassigned from you`,
                            data: {
                                deliveryId: updatedDelivery._id,
                                deliveryCode: updatedDelivery.deliveryCode,
                                reason: 'Admin unassigned delivery'
                            },
                            createdBy: req.user._id || req.user.id,
                            createdByModel: 'Admin'
                        });
                    }
                } catch (notificationError) {
                    console.error('Failed to send unassignment notification:', notificationError.message);
                }
            }

            successResponse(res, updatedDelivery, 'Delivery unassigned successfully');
        } catch (error) {
            errorResponse(res, error, 400);
        }
    });

    // Get delivery statistics
    static getDeliveryStats = catchAsync(async (req, res) => {
        const { period = 'month', startDate, endDate } = req.query;

        try {
            let dateQuery = {};

            if (startDate || endDate) {
                dateQuery.createdAt = {};
                if (startDate) dateQuery.createdAt.$gte = new Date(startDate);
                if (endDate) dateQuery.createdAt.$lte = new Date(endDate);
            } else {
                // Default to current month
                const now = new Date();
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
                dateQuery.createdAt = { $gte: startOfMonth, $lte: endOfMonth };
            }

            const stats = await Delivery.aggregate([
                { $match: dateQuery },
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 },
                        totalRevenue: { $sum: '$fee' },
                        totalDriverEarnings: { $sum: '$driverEarning' },
                        totalCompanyEarnings: { $sum: '$companyEarning' }
                    }
                }
            ]);

            // Get daily trends
            const dailyTrends = await Delivery.aggregate([
                { $match: dateQuery },
                {
                    $group: {
                        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                        totalDeliveries: { $sum: 1 },
                        completedDeliveries: {
                            $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] }
                        },
                        revenue: {
                            $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, '$fee', 0] }
                        }
                    }
                },
                { $sort: { _id: 1 } }
            ]);

            // Transform stats to easier format
            const statusStats = {
                pending: { count: 0, totalRevenue: 0, totalDriverEarnings: 0, totalCompanyEarnings: 0 },
                assigned: { count: 0, totalRevenue: 0, totalDriverEarnings: 0, totalCompanyEarnings: 0 },
                picked_up: { count: 0, totalRevenue: 0, totalDriverEarnings: 0, totalCompanyEarnings: 0 },
                delivered: { count: 0, totalRevenue: 0, totalDriverEarnings: 0, totalCompanyEarnings: 0 },
                cancelled: { count: 0, totalRevenue: 0, totalDriverEarnings: 0, totalCompanyEarnings: 0 }
            };

            stats.forEach(stat => {
                statusStats[stat._id] = {
                    count: stat.count,
                    totalRevenue: stat.totalRevenue,
                    totalDriverEarnings: stat.totalDriverEarnings,
                    totalCompanyEarnings: stat.totalCompanyEarnings
                };
            });

            const totalDeliveries = stats.reduce((sum, stat) => sum + stat.count, 0);
            const completedDeliveries = statusStats.delivered.count;
            const completionRate = totalDeliveries > 0 ? (completedDeliveries / totalDeliveries) * 100 : 0;

            successResponse(res, {
                period,
                totalDeliveries,
                completedDeliveries,
                completionRate: Math.round(completionRate * 10) / 10,
                statusBreakdown: statusStats,
                dailyTrends,
                revenue: {
                    total: stats.reduce((sum, stat) => sum + stat.totalRevenue, 0),
                    driverEarnings: stats.reduce((sum, stat) => sum + stat.totalDriverEarnings, 0),
                    companyEarnings: stats.reduce((sum, stat) => sum + stat.totalCompanyEarnings, 0)
                }
            }, 'Delivery statistics retrieved successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Bulk operations on deliveries
    static bulkOperations = catchAsync(async (req, res) => {
        const { operation, deliveryIds, data } = req.body;
        const { user } = req;

        try {
            let result = {};

            switch (operation) {
                case 'assign':
                    if (!data.driverId) {
                        return res.status(400).json({
                            success: false,
                            error: 'Driver ID is required for assign operation'
                        });
                    }

                    // Check if driver exists
                    const driver = await Driver.findById(data.driverId);
                    if (!driver || !driver.isActive) {
                        return res.status(400).json({
                            success: false,
                            error: 'Driver not found or inactive'
                        });
                    }

                    // Only assign pending deliveries
                    const updateResult = await Delivery.updateMany(
                        {
                            _id: { $in: deliveryIds },
                            status: 'pending'
                        },
                        {
                            assignedTo: data.driverId,
                            assignedBy: user.id,
                            status: 'assigned',
                            assignedAt: new Date(),
                            updatedAt: new Date()
                        }
                    );

                    result = {
                        operation,
                        assignedDeliveries: updateResult.modifiedCount,
                        driverId: data.driverId,
                        driverName: driver.name
                    };
                    break;

                case 'cancel':
                    await Delivery.updateMany(
                        {
                            _id: { $in: deliveryIds },
                            status: { $in: ['pending', 'assigned'] }
                        },
                        {
                            status: 'cancelled',
                            updatedAt: new Date()
                        }
                    );
                    result = { operation, cancelledDeliveries: deliveryIds.length };
                    break;

                case 'delete':
                    await Delivery.deleteMany({
                        _id: { $in: deliveryIds },
                        status: { $in: ['pending', 'cancelled'] }
                    });
                    result = { operation, deletedDeliveries: deliveryIds.length };
                    break;

                case 'updatePriority':
                    if (!data.priority) {
                        return res.status(400).json({
                            success: false,
                            error: 'Priority is required for updatePriority operation'
                        });
                    }
                    await Delivery.updateMany(
                        { _id: { $in: deliveryIds } },
                        {
                            priority: data.priority,
                            updatedAt: new Date()
                        }
                    );
                    result = {
                        operation,
                        updatedDeliveries: deliveryIds.length,
                        newPriority: data.priority
                    };
                    break;

                default:
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid bulk operation'
                    });
            }

            successResponse(res, result, 'Bulk operation completed successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Get nearby deliveries (for driver app)
    static getNearbyDeliveries = catchAsync(async (req, res) => {
        const { area, status = 'pending', limit = 10 } = req.query;
        const { user } = req;

        try {
            let query = { status };

            // If user is a driver, show deliveries in their area
            if (user.userType === 'driver') {
                const driver = await Driver.findById(user.id);
                if (driver && driver.area !== 'Other') {
                    // For now, we'll just filter by driver's area
                    // In a real app, you'd use geolocation
                    const driversInArea = await Driver.find({
                        area: driver.area,
                        isActive: true
                    }).select('_id');

                    const driverIds = driversInArea.map(d => d._id);
                    query.$or = [
                        { assignedTo: null }, // Unassigned deliveries
                        { assignedTo: { $in: driverIds } } // Deliveries in same area
                    ];
                }
            }

            const deliveries = await Delivery.find(query)
                .populate('assignedTo', 'name area')
                .select('deliveryCode pickupLocation deliveryLocation fee priority createdAt estimatedTime')
                .sort({ priority: -1, createdAt: -1 })
                .limit(parseInt(limit));

            successResponse(res, deliveries, 'Nearby deliveries retrieved successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Test endpoint to trigger delivery assignment notification
    static testDeliveryNotification = catchAsync(async (req, res) => {
        const { driverId, deliveryId } = req.body;
        const { user } = req;

        try {
            // Allow testing with demo token or admin users
            if (user.userType !== 'admin' && req.headers.authorization !== 'Bearer test-token-for-demo') {
                return res.status(403).json({
                    success: false,
                    error: 'Only admins can test notifications'
                });
            }

            console.log(`🧪 Testing delivery notification for driver ${driverId} and delivery ${deliveryId}`);

            // Create a test notification
            const notification = await NotificationService.createDeliveryAssignedNotification(deliveryId, driverId);

            successResponse(res, { notification }, 'Test notification sent successfully');
        } catch (error) {
            console.error('Test notification failed:', error);
            errorResponse(res, error, 500);
        }
    });
}

module.exports = DeliveryController;