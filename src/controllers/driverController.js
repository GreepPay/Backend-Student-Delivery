const Driver = require('../models/Driver');
const Delivery = require('../models/Delivery');
const AnalyticsService = require('../services/analyticsService');
const EmailService = require('../services/emailService');
const NotificationService = require('../services/notificationService');
const AdminNotificationService = require('../services/adminNotificationService');
const CloudinaryService = require('../services/cloudinaryService');
const socketService = require('../services/socketService');
const { catchAsync, successResponse, errorResponse, paginatedResponse } = require('../middleware/errorHandler');

class DriverController {
    // Get all drivers (admin only)
    static getDrivers = catchAsync(async (req, res) => {
        const { page = 1, limit = 20, area, isActive, sortBy = 'name', sortOrder = 'asc' } = req.query;

        try {
            const query = {};
            if (area) query.area = area;
            if (isActive !== undefined) query.isActive = isActive === 'true';

            const sortOptions = {};
            sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

            const drivers = await Driver.find(query)
                .select('-__v')
                .populate('addedBy', 'name email')
                .sort(sortOptions)
                .limit(limit * 1)
                .skip((page - 1) * limit);

            const total = await Driver.countDocuments(query);

            paginatedResponse(res, drivers, { page: parseInt(page), limit: parseInt(limit), total });
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Get single driver details
    static getDriver = catchAsync(async (req, res) => {
        const { driverId } = req.params;
        const { user } = req;

        console.log('getDriver called with:', { driverId, user: user.id });

        // Check if user can access this driver's data
        if (user.userType === 'driver' && user.id !== driverId) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }

        try {
            const driver = await Driver.findById(driverId)
                .select('-__v')
                .populate('addedBy', 'name email');

            if (!driver) {
                return res.status(404).json({
                    success: false,
                    error: 'Driver not found'
                });
            }

            console.log('Driver profile result:', driver);

            successResponse(res, driver, 'Driver profile retrieved successfully');
        } catch (error) {
            console.error('Error in getDriver:', error);
            errorResponse(res, error, 500);
        }
    });

    // Add new driver (admin only)
    static addDriver = catchAsync(async (req, res) => {
        const { email, name, phone, studentId, area = 'Other' } = req.body;
        const { user } = req;

        try {
            // Check if driver already exists
            const existingDriver = await Driver.findOne({ email });
            if (existingDriver) {
                return res.status(400).json({
                    success: false,
                    error: 'Driver with this email already exists'
                });
            }

            // Check if studentId is already taken (if provided)
            if (studentId) {
                const existingStudentId = await Driver.findOne({ studentId });
                if (existingStudentId) {
                    return res.status(400).json({
                        success: false,
                        error: 'Student ID already exists'
                    });
                }
            }

            // Create new driver
            const newDriver = await Driver.create({
                email,
                name,
                phone,
                studentId,
                area,
                addedBy: user.id
            });

            // Send invitation email
            try {
                await EmailService.sendDriverInvitation(email, name, user.name);
            } catch (emailError) {
                console.error('Failed to send driver invitation:', emailError.message);
            }

            const driverData = await Driver.findById(newDriver._id)
                .select('-__v')
                .populate('addedBy', 'name email');

            successResponse(res, driverData, 'Driver added successfully', 201);
        } catch (error) {
            errorResponse(res, error, 400);
        }
    });

    // Update driver (admin only)
    static updateDriver = catchAsync(async (req, res) => {
        const { id } = req.params;
        const { name, phone, studentId, area, isActive } = req.body;

        try {
            const driver = await Driver.findById(id);
            if (!driver) {
                return res.status(404).json({
                    success: false,
                    error: 'Driver not found'
                });
            }

            // Check if studentId is already taken by another driver
            if (studentId && studentId !== driver.studentId) {
                const existingStudentId = await Driver.findOne({
                    studentId,
                    _id: { $ne: id }
                });
                if (existingStudentId) {
                    return res.status(400).json({
                        success: false,
                        error: 'Student ID already exists'
                    });
                }
            }

            const updatedDriver = await Driver.findByIdAndUpdate(
                id,
                {
                    ...(name && { name }),
                    ...(phone !== undefined && { phone }),
                    ...(studentId !== undefined && { studentId }),
                    ...(area && { area }),
                    ...(isActive !== undefined && { isActive }),
                    updatedAt: new Date()
                },
                { new: true, runValidators: true }
            ).populate('addedBy', 'name email');

            successResponse(res, updatedDriver, 'Driver updated successfully');
        } catch (error) {
            errorResponse(res, error, 400);
        }
    });

    // Suspend driver (admin only)
    static suspendDriver = catchAsync(async (req, res) => {
        const { id } = req.params;
        const { reason } = req.body;
        const { user } = req;

        try {
            const driver = await Driver.findById(id);
            if (!driver) {
                return res.status(404).json({
                    success: false,
                    error: 'Driver not found'
                });
            }

            const updatedDriver = await Driver.findByIdAndUpdate(
                id,
                {
                    isSuspended: true,
                    suspensionReason: reason || 'Account suspended by admin',
                    suspendedAt: new Date(),
                    suspendedBy: user.id
                },
                { new: true }
            ).select('-__v');

            // Create admin notification for driver suspension
            try {
                await AdminNotificationService.createDriverStatusNotification(id, 'suspended', reason);
            } catch (notificationError) {
                console.error('Failed to create driver suspension notification:', notificationError.message);
            }

            successResponse(res, updatedDriver, 'Driver suspended successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Unsuspend driver (admin only)
    static unsuspendDriver = catchAsync(async (req, res) => {
        const { id } = req.params;
        const { user } = req;

        try {
            const driver = await Driver.findById(id);
            if (!driver) {
                return res.status(404).json({
                    success: false,
                    error: 'Driver not found'
                });
            }

            const updatedDriver = await Driver.findByIdAndUpdate(
                id,
                {
                    isSuspended: false,
                    suspensionReason: null,
                    suspendedAt: null,
                    suspendedBy: null
                },
                { new: true }
            ).select('-__v');

            // Create admin notification for driver activation
            try {
                await AdminNotificationService.createDriverStatusNotification(id, 'activated');
            } catch (notificationError) {
                console.error('Failed to create driver activation notification:', notificationError.message);
            }

            successResponse(res, updatedDriver, 'Driver unsuspended successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Delete driver (admin only)
    static deleteDriver = catchAsync(async (req, res) => {
        const { id } = req.params;

        try {
            const driver = await Driver.findById(id);
            if (!driver) {
                return res.status(404).json({
                    success: false,
                    error: 'Driver not found'
                });
            }

            // Check if driver has pending deliveries
            const pendingDeliveries = await Delivery.countDocuments({
                assignedTo: id,
                status: { $in: ['pending', 'assigned', 'picked_up'] }
            });

            if (pendingDeliveries > 0) {
                return res.status(400).json({
                    success: false,
                    error: `Cannot delete driver with ${pendingDeliveries} pending deliveries`
                });
            }

            await Driver.findByIdAndDelete(id);

            successResponse(res, null, 'Driver deleted successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Get driver's personal analytics
    static getDriverAnalytics = catchAsync(async (req, res) => {
        const { driverId } = req.params;
        const { period = 'month', month, year, startDate, endDate } = req.query;
        const { user } = req;

        console.log('🔍 getDriverAnalytics called with:', { driverId, period, month, year, startDate, endDate, user: user.id });
        console.log('🔍 Full query object:', req.query);

        // Check if user can access this driver's data
        if (user.userType === 'driver' && user.id !== driverId) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }

        try {
            const analytics = await AnalyticsService.getDriverAnalytics(driverId, period, month, year, startDate, endDate);
            console.log('Analytics result:', analytics);

            successResponse(res, analytics, 'Driver analytics retrieved successfully');
        } catch (error) {
            console.error('Error in getDriverAnalytics:', error);
            errorResponse(res, error, 500);
        }
    });

    // Get driver's earnings breakdown
    static getDriverEarnings = catchAsync(async (req, res) => {
        const { driverId } = req.params;
        const { period = 'month', startDate, endDate } = req.query;
        const { user } = req;

        console.log('💰 getDriverEarnings called with:', { driverId, period, startDate, endDate, user: user.id });
        console.log('💰 Full query object:', req.query);

        // Check if user can access this driver's data
        if (user.userType === 'driver' && user.id !== driverId) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }

        try {
            const earnings = await AnalyticsService.getDriverEarningsBreakdown(driverId, period, startDate, endDate);

            // Calculate remission summary
            const totalRemissionOwed = earnings.reduce((sum, week) => sum + week.remissionOwed, 0);

            successResponse(res, {
                earnings,
                summary: {
                    totalEarnings: earnings.reduce((sum, week) => sum + week.earnings, 0),
                    totalDeliveries: earnings.reduce((sum, week) => sum + week.deliveries, 0),
                    totalRemissionOwed,
                    period
                }
            }, 'Driver earnings retrieved successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Get driver's deliveries
    static getDriverDeliveries = catchAsync(async (req, res) => {
        const { driverId } = req.params;
        const { page = 1, limit = 20, status, startDate, endDate } = req.query;
        const { user } = req;

        console.log('Driver deliveries request:', { driverId, user: user.id, status, page, limit, startDate, endDate });

        // Check if user can access this driver's data
        if (user.userType === 'driver' && user.id !== driverId) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }

        try {
            const query = { assignedTo: driverId };
            if (status) query.status = status;
            if (startDate || endDate) {
                // For "Today's Deliveries", we want deliveries that were either:
                // 1. Assigned today (assignedAt)
                // 2. Delivered today (deliveredAt)
                // 3. Created today (createdAt) - as fallback
                const dateFilter = {
                    $or: [
                        { assignedAt: { $gte: new Date(startDate), $lte: new Date(endDate) } },
                        { deliveredAt: { $gte: new Date(startDate), $lte: new Date(endDate) } },
                        { createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) } }
                    ]
                };
                Object.assign(query, dateFilter);
            }

            console.log('Delivery query:', JSON.stringify(query, null, 2));

            const deliveries = await Delivery.find(query)
                .populate('assignedBy', 'name email')
                .select('-__v')
                .sort({ createdAt: -1 })
                .limit(limit * 1)
                .skip((page - 1) * limit);

            const total = await Delivery.countDocuments(query);

            console.log('Found deliveries:', deliveries.length, 'Total:', total);

            // Return in the format expected by frontend
            res.status(200).json({
                success: true,
                message: 'Driver deliveries retrieved successfully',
                data: {
                    deliveries: deliveries
                },
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: total,
                    pages: Math.ceil(total / parseInt(limit)),
                    hasNext: parseInt(page) < Math.ceil(total / parseInt(limit)),
                    hasPrev: parseInt(page) > 1
                },
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error in getDriverDeliveries:', error);
            errorResponse(res, error, 500);
        }
    });

    // Update driver's delivery status
    static updateDeliveryStatus = catchAsync(async (req, res) => {
        const { deliveryId } = req.params;
        const { status, notes, deliveryProof, rating, feedback } = req.body;
        const { user } = req;

        console.log('updateDeliveryStatus called with:', { deliveryId, status, user: user.id });

        try {
            const delivery = await Delivery.findById(deliveryId);
            if (!delivery) {
                return res.status(404).json({
                    success: false,
                    error: 'Delivery not found'
                });
            }

            console.log('Current delivery status:', delivery.status);
            console.log('Requested status change to:', status);

            // Check if user can update this delivery
            if (user.userType === 'driver' && delivery.assignedTo.toString() !== user.id) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied'
                });
            }

            // Validate status transition
            const validTransitions = {
                pending: ['picked_up', 'cancelled'],
                assigned: ['picked_up', 'cancelled'],
                picked_up: ['delivered', 'cancelled'],
                in_progress: ['delivered', 'cancelled'],
                delivered: [], // Final status
                cancelled: [] // Final status
            };

            console.log('Valid transitions for current status:', validTransitions[delivery.status]);
            console.log('Requested status allowed:', validTransitions[delivery.status]?.includes(status));

            if (!validTransitions[delivery.status]?.includes(status)) {
                return res.status(400).json({
                    success: false,
                    error: `Cannot change status from ${delivery.status} to ${status}. Valid transitions: ${validTransitions[delivery.status]?.join(', ') || 'none'}`
                });
            }

            // Update delivery
            const updatedDelivery = await Delivery.findByIdAndUpdate(
                deliveryId,
                {
                    status,
                    ...(notes && { notes }),
                    ...(deliveryProof && { deliveryProof }),
                    ...(rating && { rating }),
                    ...(feedback && { feedback }),
                    ...(status === 'delivered' && { deliveredAt: new Date() }),
                    updatedAt: new Date()
                },
                { new: true, runValidators: true }
            ).populate('assignedBy', 'name email');

            // Update driver stats if delivered
            if (status === 'delivered') {
                await Driver.findByIdAndUpdate(delivery.assignedTo, {
                    $inc: {
                        completedDeliveries: 1,
                        totalDeliveries: 1,
                        totalEarnings: delivery.driverEarning
                    }
                });
            }

            // Create notification for status update
            try {
                await NotificationService.createDeliveryStatusNotification(deliveryId, status, delivery.assignedTo);
            } catch (notificationError) {
                console.error('Failed to create status notification:', notificationError.message);
            }

            // Create payment notification when delivery is completed
            if (status === 'delivered') {
                try {
                    await AdminNotificationService.createPaymentNotification(deliveryId, delivery.fee);
                } catch (paymentNotificationError) {
                    console.error('Failed to create payment notification:', paymentNotificationError.message);
                }
            }

            successResponse(res, updatedDelivery, 'Delivery status updated successfully');
        } catch (error) {
            errorResponse(res, error, 400);
        }
    });

    // Get drivers by area (for assignment)
    static getDriversByArea = catchAsync(async (req, res) => {
        const { area } = req.params;

        try {
            const drivers = await Driver.find({
                area,
                isActive: true
            })
                .select('name email totalDeliveries totalEarnings isOnline')
                .sort({ totalDeliveries: 1 }); // Prioritize drivers with fewer deliveries

            successResponse(res, drivers, `Drivers in ${area} retrieved successfully`);
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Toggle driver online status
    static toggleOnlineStatus = catchAsync(async (req, res) => {
        const { driverId } = req.params;
        const { user } = req;

        // Only the driver themselves can toggle their status
        if (user.userType === 'driver' && user.id !== driverId) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }

        try {
            const driver = await Driver.findById(driverId);
            if (!driver) {
                return res.status(404).json({
                    success: false,
                    error: 'Driver not found'
                });
            }

            const updatedDriver = await Driver.findByIdAndUpdate(
                driverId,
                {
                    isOnline: !driver.isOnline,
                    lastLogin: new Date()
                },
                { new: true }
            ).select('name email isOnline lastLogin area totalDeliveries completedDeliveries totalEarnings rating');

            console.log('Driver status updated in database:', updatedDriver);

            // Emit real-time update to admin panel
            console.log('Emitting socket event for driver status update...');
            socketService.emitDriverStatusUpdate(updatedDriver);

            successResponse(res, updatedDriver, `Driver status updated to ${updatedDriver.isOnline ? 'online' : 'offline'}`);
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Toggle driver active status
    static toggleActiveStatus = catchAsync(async (req, res) => {
        console.log('toggleActiveStatus called with params:', req.params);
        console.log('toggleActiveStatus called with user:', req.user);

        const { driverId } = req.params;
        const { user } = req;

        // Only the driver themselves can toggle their status
        if (user.userType === 'driver' && user.id !== driverId) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }

        try {
            const driver = await Driver.findById(driverId);
            if (!driver) {
                return res.status(404).json({
                    success: false,
                    error: 'Driver not found'
                });
            }

            console.log('Current driver status:', { isActive: driver.isActive, isOnline: driver.isOnline });

            const updatedDriver = await Driver.findByIdAndUpdate(
                driverId,
                {
                    isActive: !driver.isActive,
                    lastLogin: new Date()
                },
                { new: true }
            ).select('name email isActive lastLogin area totalDeliveries completedDeliveries totalEarnings rating');

            console.log('Driver active status updated in database:', updatedDriver);

            // Create admin notification for driver active status change
            try {
                const status = updatedDriver.isActive ? 'active' : 'inactive';
                await AdminNotificationService.createDriverStatusNotification(driverId, status);
            } catch (notificationError) {
                console.error('Failed to create driver active status notification:', notificationError.message);
            }

            // Emit real-time update to admin panel
            console.log('Emitting socket event for driver active status update...');
            socketService.emitDriverStatusUpdate(updatedDriver);

            successResponse(res, updatedDriver, `Driver active status updated to ${updatedDriver.isActive ? 'active' : 'inactive'}`);
        } catch (error) {
            console.error('Error in toggleActiveStatus:', error);
            errorResponse(res, error, 500);
        }
    });

    // Deactivate driver account (self-deactivation)
    static deactivateAccount = catchAsync(async (req, res) => {
        const { user } = req;

        try {
            const driver = await Driver.findById(user.id);
            if (!driver) {
                return res.status(404).json({
                    success: false,
                    error: 'Driver not found'
                });
            }

            // Deactivate the driver
            driver.isActive = false;
            driver.isOnline = false;
            driver.updatedAt = new Date();

            await driver.save();

            // Notify admins about driver deactivation
            await AdminNotificationService.createNotification({
                type: 'driver_deactivated',
                title: 'Driver Deactivated',
                message: `Driver ${driver.name} has deactivated their account`,
                adminId: null, // Send to all admins
                data: {
                    driverId: driver._id,
                    driverName: driver.name,
                    driverEmail: driver.email
                }
            });

            successResponse(res, {
                message: 'Account deactivated successfully'
            }, 'Account deactivated successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Get driver leaderboard
    static getLeaderboard = catchAsync(async (req, res) => {
        const { period = 'month', limit = 10 } = req.query;

        try {
            const leaderboard = await AnalyticsService.getDriverLeaderboard(period, limit);

            successResponse(res, {
                leaderboard,
                period,
                generatedAt: new Date().toISOString()
            }, 'Driver leaderboard retrieved successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Send monthly report to driver
    static sendMonthlyReport = catchAsync(async (req, res) => {
        const { driverId } = req.params;
        const { month, year } = req.body;

        try {
            const driver = await Driver.findById(driverId);
            if (!driver) {
                return res.status(404).json({
                    success: false,
                    error: 'Driver not found'
                });
            }

            // Get analytics for the specified month
            const analytics = await AnalyticsService.getDriverAnalytics(driverId, 'month', month, year);

            // Send email report
            const emailResult = await EmailService.sendMonthlyReport(
                driver.email,
                driver.name,
                analytics.stats
            );

            if (emailResult.success) {
                successResponse(res, {
                    recipient: driver.email,
                    month,
                    year,
                    sentAt: new Date().toISOString()
                }, 'Monthly report sent successfully');
            } else {
                return res.status(500).json({
                    success: false,
                    error: 'Failed to send monthly report'
                });
            }
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Bulk operations on drivers (admin only)
    static bulkOperations = catchAsync(async (req, res) => {
        const { operation, driverIds, data } = req.body;

        try {
            let result = {};

            switch (operation) {
                case 'activate':
                    await Driver.updateMany(
                        { _id: { $in: driverIds } },
                        { isActive: true, updatedAt: new Date() }
                    );
                    result = { operation, affectedDrivers: driverIds.length };
                    break;

                case 'deactivate':
                    await Driver.updateMany(
                        { _id: { $in: driverIds } },
                        { isActive: false, isOnline: false, updatedAt: new Date() }
                    );
                    result = { operation, affectedDrivers: driverIds.length };
                    break;

                case 'updateArea':
                    if (!data.area) {
                        return res.status(400).json({
                            success: false,
                            error: 'Area is required for updateArea operation'
                        });
                    }
                    await Driver.updateMany(
                        { _id: { $in: driverIds } },
                        { area: data.area, updatedAt: new Date() }
                    );
                    result = { operation, affectedDrivers: driverIds.length, newArea: data.area };
                    break;

                case 'sendNotification':
                    if (!data.message) {
                        return res.status(400).json({
                            success: false,
                            error: 'Message is required for sendNotification operation'
                        });
                    }

                    const drivers = await Driver.find({
                        _id: { $in: driverIds },
                        isActive: true
                    }).select('email name');

                    const emailPromises = drivers.map(driver =>
                        EmailService.sendDriverInvitation(driver.email, driver.name, req.user.name)
                            .catch(error => ({ error: error.message, driver: driver.email }))
                    );

                    const emailResults = await Promise.allSettled(emailPromises);
                    const successful = emailResults.filter(result => result.status === 'fulfilled').length;

                    result = {
                        operation,
                        targetedDrivers: drivers.length,
                        successfulNotifications: successful
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

    // Get driver performance summary
    static getPerformanceSummary = catchAsync(async (req, res) => {
        const { driverId } = req.params;
        const { user } = req;

        // Check access permissions
        if (user.userType === 'driver' && user.id !== driverId) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }

        try {
            const driver = await Driver.findById(driverId);
            if (!driver) {
                return res.status(404).json({
                    success: false,
                    error: 'Driver not found'
                });
            }

            // Get comprehensive performance data
            const [
                currentMonthAnalytics,
                lastMonthAnalytics,
                totalStats,
                recentDeliveries
            ] = await Promise.all([
                AnalyticsService.getDriverAnalytics(driverId, 'month'),
                AnalyticsService.getDriverAnalytics(driverId, 'month', new Date().getMonth(), new Date().getFullYear()),
                Delivery.aggregate([
                    { $match: { assignedTo: driver._id, status: 'delivered' } },
                    {
                        $group: {
                            _id: null,
                            totalDeliveries: { $sum: 1 },
                            totalEarnings: { $sum: '$driverEarning' },
                            avgDeliveryTime: {
                                $avg: {
                                    $divide: [
                                        { $subtract: ['$deliveredAt', '$assignedAt'] },
                                        1000 * 60 // Convert to minutes
                                    ]
                                }
                            }
                        }
                    }
                ]),
                Delivery.find({ assignedTo: driverId })
                    .select('deliveryCode status createdAt deliveredAt driverEarning')
                    .sort({ createdAt: -1 })
                    .limit(5)
            ]);

            const performanceSummary = {
                driver: {
                    id: driver._id,
                    name: driver.name,
                    email: driver.email,
                    area: driver.area,
                    joinedAt: driver.joinedAt,
                    isOnline: driver.isOnline
                },
                currentMonth: currentMonthAnalytics.stats,
                lastMonth: lastMonthAnalytics.stats,
                allTime: totalStats[0] || {
                    totalDeliveries: 0,
                    totalEarnings: 0,
                    avgDeliveryTime: 0
                },
                recentDeliveries,
                trends: currentMonthAnalytics.trends,
                remissionOwed: currentMonthAnalytics.remissionOwed
            };

            successResponse(res, performanceSummary, 'Performance summary retrieved successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Upload profile picture
    static uploadProfilePicture = catchAsync(async (req, res) => {
        const { user } = req;
        const { file } = req;

        if (!file) {
            return res.status(400).json({
                success: false,
                error: 'No image file provided'
            });
        }

        try {
            // Validate the image file
            const validation = CloudinaryService.validateImage(file);
            if (!validation.valid) {
                return res.status(400).json({
                    success: false,
                    error: validation.error
                });
            }

            // Upload to Cloudinary
            const uploadResult = await CloudinaryService.uploadImage(file, 'driver-profiles');

            if (!uploadResult.success) {
                return res.status(500).json({
                    success: false,
                    error: 'Failed to upload image: ' + uploadResult.error
                });
            }

            // Get current driver profile
            const driver = await Driver.findById(user.id);
            if (!driver) {
                return res.status(404).json({
                    success: false,
                    error: 'Driver not found'
                });
            }

            // Delete old profile picture if it exists
            if (driver.profilePicture && driver.profilePicture.includes('cloudinary.com')) {
                const publicId = driver.profilePicture.split('/').pop().split('.')[0];
                await CloudinaryService.deleteImage(publicId);
            }

            // Update driver profile with new picture URL
            driver.profilePicture = uploadResult.url;
            await driver.save();

            successResponse(res, {
                profilePicture: uploadResult.url,
                optimizedUrl: CloudinaryService.getOptimizedUrl(uploadResult.url, {
                    width: 200,
                    height: 200,
                    crop: 'fill',
                    gravity: 'face'
                })
            }, 'Profile picture uploaded successfully');

        } catch (error) {
            console.error('Profile picture upload error:', error);
            errorResponse(res, error, 500);
        }
    });

    // Update driver profile
    static updateProfile = catchAsync(async (req, res) => {
        const { user } = req;
        const { name, phone, area } = req.body;

        try {
            const driver = await Driver.findById(user.id);
            if (!driver) {
                return res.status(404).json({
                    success: false,
                    error: 'Driver not found'
                });
            }

            // Update fields
            if (name) driver.name = name;
            if (phone) driver.phone = phone;
            if (area) driver.area = area;

            await driver.save();

            successResponse(res, {
                id: driver._id,
                name: driver.name,
                email: driver.email,
                phone: driver.phone,
                area: driver.area,
                profilePicture: driver.profilePicture,
                joinedAt: driver.joinedAt,
                isActive: driver.isActive
            }, 'Profile updated successfully');

        } catch (error) {
            console.error('Profile update error:', error);
            errorResponse(res, error, 500);
        }
    });
}

module.exports = DriverController;