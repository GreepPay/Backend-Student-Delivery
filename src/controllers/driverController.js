const Driver = require('../models/Driver');
const Delivery = require('../models/Delivery');
const AnalyticsService = require('../services/analyticsService');
const EmailService = require('../services/emailService');
const NotificationService = require('../services/notificationService');
const AdminNotificationService = require('../services/adminNotificationService');
const CloudinaryService = require('../services/cloudinaryService');
const socketService = require('../services/socketService');
const { catchAsync, successResponse, errorResponse, paginatedResponse } = require('../middleware/errorHandler');
const DriverInvitationService = require('../services/driverInvitationService');
const bcrypt = require('bcryptjs');

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
                .populate('addedBy', 'fullName email')
                .sort(sortOptions)
                .limit(limit * 1)
                .skip((page - 1) * limit);

            const total = await Driver.countDocuments(query);

            // Add computed status field to each driver
            const driversWithStatus = drivers.map(driver => {
                const driverObj = driver.toObject();

                // Compute status based on driver's state
                let status = 'offline';
                if (driverObj.isSuspended) {
                    status = 'suspended';
                } else if (driverObj.isOnline && driverObj.isActive) {
                    status = 'online';
                } else if (driverObj.isActive) {
                    status = 'offline';
                } else {
                    status = 'inactive';
                }

                // Add lastActive field using lastLogin or updatedAt
                const lastActive = driverObj.lastLogin || driverObj.updatedAt || driverObj.createdAt;

                return {
                    ...driverObj,
                    status: status,
                    lastActive: lastActive
                };
            });

            paginatedResponse(res, driversWithStatus, { page: parseInt(page), limit: parseInt(limit), total });
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
                .populate('addedBy', 'fullName email');

            if (!driver) {
                return res.status(404).json({
                    success: false,
                    error: 'Driver not found'
                });
            }

            console.log('Driver profile result:', driver);

            // Get computed data (fallback to stored data if available)
            const profileCompletion = driver.storedProfileCompletion && driver.storedProfileCompletion.overall > 0
                ? driver.storedProfileCompletion
                : driver.profileCompletion;
            const verificationData = driver.storedVerification && driver.storedVerification.lastUpdated
                ? driver.storedVerification
                : driver.accountStatus?.verification || {};

            // Structure response exactly as frontend expects
            const responseData = {
                // Basic driver data
                id: driver._id,
                fullName: driver.fullName || driver.name,
                email: driver.email,
                phone: driver.phone,
                studentId: driver.studentId,
                area: driver.area,
                transportationType: driver.transportationType,
                university: driver.university,
                address: driver.address,
                profilePicture: driver.profilePicture,
                isActive: driver.isActive,
                joinedAt: driver.joinedAt,

                // Frontend expected structure
                profile: {
                    personalDetails: {
                        fullName: driver.fullName || driver.name,
                        email: driver.email,
                        phone: driver.phone,
                        address: driver.address || ""
                    },
                    studentInfo: {
                        studentId: driver.studentId,
                        university: driver.university
                    },
                    transportation: {
                        method: driver.transportationType,  // Frontend expects 'method'
                        area: driver.area                   // Frontend expects area here too
                    }
                },

                completion: {
                    overall: profileCompletion?.overall || 0,
                    sections: profileCompletion?.sections || {},
                    isComplete: profileCompletion?.isComplete || false,
                    readyForDeliveries: profileCompletion?.readyForDeliveries || false
                },

                verification: {
                    studentVerified: verificationData?.studentVerified || false,
                    profileComplete: verificationData?.profileComplete || false,
                    activeDeliveryPartner: verificationData?.activeDeliveryPartner || false
                },

                // Keep original fields for backward compatibility
                memberSince: driver.memberSince,
                verificationStatus: driver.verificationStatus,
                completionRate: driver.completionRate,
                averageEarningsPerDelivery: driver.averageEarningsPerDelivery,
                profileCompletion: driver.profileCompletion,
                accountStatus: driver.accountStatus,
                verificationProgress: driver.verificationProgress,

                // Include stored data for debugging
                storedProfileCompletion: driver.storedProfileCompletion,
                storedVerification: driver.storedVerification
            };

            successResponse(res, responseData, 'Driver profile retrieved successfully');
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

            // Create referral record if driver was added by another driver (not admin)
            try {
                const Referral = require('../models/Referral');
                const ReferralService = require('../services/referralService');

                // Check if the person adding the driver is a driver (not admin)
                const Admin = require('../models/Admin');
                const isAdmin = await Admin.findById(user.id);

                if (!isAdmin) {
                    // The person adding is a driver, create a referral record
                    const referralCode = await Referral.generateReferralCode(user.id, user.name);

                    const referral = new Referral({
                        referrer: user.id,
                        referred: newDriver._id,
                        referralCode: referralCode,
                        status: 'completed', // Mark as completed since driver is already added
                        completionCriteria: {
                            referredDeliveries: 0, // No delivery requirement for admin-added drivers
                            referredEarnings: 0,
                            timeLimit: 0
                        },
                        progress: {
                            completedDeliveries: 0,
                            totalEarnings: 0,
                            daysRemaining: 0
                        },
                        rewards: {
                            referrer: 15, // Points for referrer
                            referred: 5   // Points for referred person
                        },
                        completedAt: new Date()
                    });

                    await referral.save();

                    // Award points to both drivers
                    await Promise.all([
                        Driver.findByIdAndUpdate(user.id, {
                            $inc: { referralPoints: 15 }
                        }),
                        Driver.findByIdAndUpdate(newDriver._id, {
                            $inc: { referralPoints: 5 }
                        })
                    ]);

                    console.log(`Referral created for admin-added driver: ${newDriver.name} by ${user.name}`);
                }
            } catch (referralError) {
                console.error('Failed to create referral record for admin-added driver:', referralError);
                // Don't fail driver creation if referral creation fails
            }

            // Send invitation email
            try {
                await EmailService.sendDriverInvitation(email, fullName, user.fullName);
            } catch (emailError) {
                console.error('Failed to send driver invitation:', emailError.message);
            }

            const driverData = await Driver.findById(newDriver._id)
                .select('-__v')
                .populate('addedBy', 'fullName email');

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
            const delivery = await Delivery.findById(deliveryId).populate('assignedTo', 'name _id');
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
                broadcasting: ['picked_up', 'cancelled'],
                accepted: ['picked_up', 'cancelled'],
                picked_up: ['in_transit', 'delivered', 'cancelled'],
                in_transit: ['delivered', 'cancelled'],
                delivered: [], // Final status
                cancelled: [], // Final status
                failed: [] // Final status
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
            );

            // SAFEGUARD 1: Always calculate earnings when a delivery is marked as "delivered"
            let earningsResult = null;
            if (status === 'delivered') {
                try {
                    const EarningsValidationService = require('../services/earningsValidationService');
                    const earningsCheck = await EarningsValidationService.ensureDeliveryEarningsCalculated(deliveryId);

                    if (earningsCheck.success) {
                        earningsResult = earningsCheck;
                        console.log(`💰 Earnings calculated for delivery ${delivery.deliveryCode}: ${earningsCheck.earnings}₺`);
                    } else {
                        console.error(`❌ Failed to calculate earnings for delivery ${delivery.deliveryCode}:`, earningsCheck.error);
                    }
                } catch (earningsError) {
                    console.error('Failed to calculate earnings:', earningsError);
                    // Don't fail the status update if earnings calculation fails
                }
            }

            // SAFEGUARD 2: Use EarningsService.updateDriverTotalEarnings() to recalculate totals
            if (status === 'delivered' && delivery.assignedTo) {
                try {
                    const EarningsService = require('../services/earningsService');
                    await EarningsService.updateDriverTotalEarnings(delivery.assignedTo._id);
                    console.log(`🔄 Updated total earnings for driver ${delivery.assignedTo.name}`);
                } catch (totalEarningsError) {
                    console.error('Failed to update driver total earnings:', totalEarningsError);
                }
            }

            // SAFEGUARD 3: Validate that driver totals match the sum of their delivered deliveries
            if (status === 'delivered' && delivery.assignedTo) {
                try {
                    console.log(`🔍 Starting earnings validation for driver: ${delivery.assignedTo.name} (${delivery.assignedTo._id})`);
                    const EarningsValidationService = require('../services/earningsValidationService');
                    const validation = await EarningsValidationService.validateDriverEarnings(delivery.assignedTo._id);

                    if (!validation.isValid) {
                        console.warn(`⚠️ Driver earnings validation failed for ${delivery.assignedTo.name}:`, validation);

                        // Auto-fix the earnings if validation fails
                        console.log(`🔧 Attempting to auto-fix driver earnings for ${delivery.assignedTo.name}`);
                        const fixResult = await EarningsValidationService.fixDriverEarnings(delivery.assignedTo._id);
                        if (fixResult.success) {
                            console.log(`✅ Auto-fix applied for driver ${delivery.assignedTo.name}`);
                        } else {
                            console.error(`❌ Failed to auto-fix driver earnings for ${delivery.assignedTo.name}:`, fixResult.error);
                        }
                    } else {
                        console.log(`✅ Driver earnings validation passed for ${delivery.assignedTo.name}`);
                    }
                } catch (validationError) {
                    console.error('Failed to validate driver earnings:', validationError);
                }
            } else if (status === 'delivered' && !delivery.assignedTo) {
                console.log(`⚠️ Delivery ${delivery.deliveryCode} marked as delivered but has no assigned driver`);
            }

            // Create notification for status update
            try {
                if (delivery.assignedTo) {
                    console.log(`📢 Creating status notification for driver: ${delivery.assignedTo.name} (${delivery.assignedTo._id})`);
                    await NotificationService.sendDeliveryStatusNotification(delivery, status, delivery.assignedTo);
                    console.log(`✅ Status notification created successfully`);
                } else {
                    console.log(`⚠️ No driver assigned to delivery ${delivery.deliveryCode}, skipping notification`);
                }
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

                // Update referral progress when delivery is completed
                if (delivery.assignedTo) {
                    try {
                        const ReferralService = require('../services/referralService');
                        await ReferralService.updateReferralProgress(delivery.assignedTo.toString());
                    } catch (referralError) {
                        console.error('Failed to update referral progress:', referralError.message);
                    }

                    // Process referral rewards for completed delivery
                    try {
                        const ReferralRewardsService = require('../services/referralRewardsService');
                        const { rewards } = await ReferralRewardsService.calculateDeliveryRewards(deliveryId, delivery.assignedTo.toString());

                        if (rewards.length > 0) {
                            await ReferralRewardsService.processRewards(rewards);
                            console.log(`Processed ${rewards.length} referral rewards for delivery ${deliveryId}`);
                        }
                    } catch (rewardError) {
                        console.error('Failed to process referral rewards:', rewardError.message);
                        // Don't fail the delivery update if referral rewards fail
                    }
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
                .select('fullName email totalDeliveries totalEarnings isOnline')
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
            ).select('fullName email isOnline lastLogin area totalDeliveries completedDeliveries totalEarnings rating');

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

    // Update driver status (PUT method for direct status updates)
    static updateDriverStatus = catchAsync(async (req, res) => {
        console.log('updateDriverStatus called with params:', req.params);
        console.log('updateDriverStatus called with body:', req.body);

        const { driverId } = req.params;
        const { user } = req;
        const { isActive, isOnline, status } = req.body;

        // Only the driver themselves can update their status
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
            console.log('Requested status update:', { isActive, isOnline, status });

            // Prepare update object with only provided fields
            const updateData = {};

            // Handle status field (convert to isActive/isOnline)
            if (status !== undefined) {
                if (status === 'active') {
                    updateData.isActive = true;
                    updateData.isOnline = true;
                } else if (status === 'offline') {
                    updateData.isActive = true;
                    updateData.isOnline = false;
                } else if (status === 'inactive') {
                    updateData.isActive = false;
                    updateData.isOnline = false;
                }
            }

            // Handle individual boolean fields
            if (isActive !== undefined) updateData.isActive = isActive;
            if (isOnline !== undefined) updateData.isOnline = isOnline;

            updateData.lastLogin = new Date();

            const updatedDriver = await Driver.findByIdAndUpdate(
                driverId,
                updateData,
                { new: true }
            ).select('name email isActive isOnline lastLogin area totalDeliveries completedDeliveries totalEarnings rating');

            console.log('Driver status updated in database:', updatedDriver);

            // Create admin notification for driver status change
            try {
                const status = updatedDriver.isActive ? 'active' : 'inactive';
                await AdminNotificationService.createDriverStatusNotification(driverId, status);
            } catch (notificationError) {
                console.error('Failed to create driver status notification:', notificationError.message);
            }

            // Emit real-time update to admin panel
            console.log('Emitting socket event for driver status update...');
            socketService.emitDriverStatusUpdate(updatedDriver);

            successResponse(res, updatedDriver, `Driver status updated successfully`);
        } catch (error) {
            console.error('Error in updateDriverStatus:', error);
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
                message: `Driver ${driver.fullName} has deactivated their account`,
                adminId: null, // Send to all admins
                data: {
                    driverId: driver._id,
                    driverName: driver.fullName,
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
        const { period = 'allTime', limit = 10 } = req.query;

        try {
            // For consistency with admin leaderboard, always use all-time data
            const leaderboard = await AnalyticsService.getDriverLeaderboard('allTime', limit);

            successResponse(res, {
                leaderboard,
                period: 'allTime', // Always return all-time period for consistency
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
                driver.fullName,
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
                    }).select('email fullName');

                    const emailPromises = drivers.map(driver =>
                        EmailService.sendDriverInvitation(driver.email, driver.fullName, req.user.fullName)
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
                    fullName: driver.fullName,
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

            // Also update the profilePhoto document status to verified
            if (!driver.documents) {
                driver.documents = {};
            }
            if (!driver.documents.profilePhoto) {
                driver.documents.profilePhoto = {};
            }

            driver.documents.profilePhoto = {
                status: 'verified',
                uploadDate: new Date(),
                verificationDate: new Date(),
                documentUrl: uploadResult.url,
                rejectionReason: undefined
            };

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

    // Get comprehensive account status
    static getAccountStatus = catchAsync(async (req, res) => {
        const { driverId } = req.params;
        const { user } = req;

        console.log('🔍 getAccountStatus called for driver:', driverId);

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
                .populate('addedBy', 'fullName email');

            if (!driver) {
                return res.status(404).json({
                    success: false,
                    error: 'Driver not found'
                });
            }

            // Get comprehensive account status using virtual field
            const accountStatus = driver.accountStatus;

            console.log('📊 Account status generated:', {
                verificationProgress: driver.verificationProgress,
                profileCompletion: accountStatus.completion.overall,
                readyForDeliveries: accountStatus.verification.activeDeliveryPartner
            });

            successResponse(res, accountStatus, 'Account status retrieved successfully');
        } catch (error) {
            console.error('Error in getAccountStatus:', error);
            errorResponse(res, error, 500);
        }
    });

    // Get comprehensive driver dashboard data
    static getDriverDashboard = catchAsync(async (req, res) => {
        const driverId = req.user.id;
        const { period = 'month' } = req.query;

        console.log('📊 getDriverDashboard called for driver:', driverId, 'period:', period);

        try {
            const driver = await Driver.findById(driverId)
                .select('-__v')
                .populate('addedBy', 'fullName email');

            if (!driver) {
                return res.status(404).json({
                    success: false,
                    error: 'Driver not found'
                });
            }

            console.log('📊 Driver ID type:', typeof driverId, 'Value:', driverId);
            console.log('📊 Driver ObjectId:', driver._id.toString());

            // Debug: Check raw deliveries for this driver
            const debugDeliveries = await Delivery.find({ assignedTo: driverId });
            console.log('📊 Total deliveries found for driver:', debugDeliveries.length);
            const debugDelivered = await Delivery.find({ assignedTo: driverId, status: 'delivered' });
            console.log('📊 Delivered deliveries found:', debugDelivered.length);

            if (debugDelivered.length > 0) {
                console.log('📊 Sample delivered delivery dates:');
                debugDelivered.slice(0, 3).forEach(d => {
                    console.log(`   - ${d.deliveryCode}: deliveredAt=${d.deliveredAt?.toISOString() || 'null'}, createdAt=${d.createdAt?.toISOString()}`);
                });
            }

            // Get all dashboard data in parallel
            console.log('📊 Starting analytics calls for periods:', { period, today: 'today', week: 'week' });

            const [
                currentPeriodAnalytics,
                thisMonthAnalytics,
                todayAnalytics,
                weekAnalytics,
                recentDeliveries,
                availableDeliveries,
                totalStats,
                todayDeliveries,
                earnings
            ] = await Promise.all([
                // Current period analytics (month by default)
                AnalyticsService.getDriverAnalytics(driverId, period).then(result => {
                    console.log('📊 Current period analytics result:', {
                        period,
                        totalDeliveries: result.stats.totalDeliveries,
                        totalEarnings: result.stats.totalEarnings,
                        startDate: result.startDate?.toISOString(),
                        endDate: result.endDate?.toISOString()
                    });
                    return result;
                }),

                // This month's analytics (always get month data)
                AnalyticsService.getDriverAnalytics(driverId, 'month').then(result => {
                    console.log('📊 This month analytics result:', {
                        totalDeliveries: result.stats.totalDeliveries,
                        totalEarnings: result.stats.totalEarnings,
                        startDate: result.startDate?.toISOString(),
                        endDate: result.endDate?.toISOString()
                    });
                    return result;
                }),

                // Today's analytics
                AnalyticsService.getDriverAnalytics(driverId, 'today').then(result => {
                    console.log('📊 Today analytics result:', {
                        totalDeliveries: result.stats.totalDeliveries,
                        totalEarnings: result.stats.totalEarnings,
                        startDate: result.startDate?.toISOString(),
                        endDate: result.endDate?.toISOString()
                    });
                    return result;
                }),

                // This week's analytics
                AnalyticsService.getDriverAnalytics(driverId, 'week').then(result => {
                    console.log('📊 Week analytics result:', {
                        totalDeliveries: result.stats.totalDeliveries,
                        totalEarnings: result.stats.totalEarnings,
                        startDate: result.startDate?.toISOString(),
                        endDate: result.endDate?.toISOString()
                    });
                    return result;
                }),

                // Recent deliveries (last 10)
                Delivery.find({ assignedTo: driverId })
                    .select('deliveryCode pickupLocation deliveryLocation status fee driverEarning createdAt deliveredAt estimatedTime priority paymentMethod')
                    .sort({ createdAt: -1 })
                    .limit(10),

                // Available nearby deliveries
                Delivery.find({
                    status: 'pending',
                    $or: [
                        { area: driver.area },
                        { area: { $exists: false } }
                    ]
                })
                    .select('deliveryCode pickupLocation deliveryLocation fee estimatedTime priority createdAt distance')
                    .sort({ createdAt: -1, priority: 1 })
                    .limit(5),

                // All-time statistics
                Delivery.aggregate([
                    { $match: { assignedTo: driver._id } },
                    {
                        $group: {
                            _id: null,
                            totalDeliveries: { $sum: 1 },
                            completedDeliveries: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
                            totalEarnings: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, '$driverEarning', 0] } },
                            avgDeliveryTime: {
                                $avg: {
                                    $cond: [
                                        { $eq: ['$status', 'delivered'] },
                                        {
                                            $divide: [
                                                { $subtract: ['$deliveredAt', '$assignedAt'] },
                                                1000 * 60 // Convert to minutes
                                            ]
                                        },
                                        null
                                    ]
                                }
                            }
                        }
                    }
                ]),

                // Today's deliveries detail - use assignedAt instead of createdAt
                Delivery.find({
                    assignedTo: driverId,
                    assignedAt: {
                        $gte: new Date().setHours(0, 0, 0, 0),
                        $lte: new Date().setHours(23, 59, 59, 999)
                    }
                })
                    .select('deliveryCode status pickupLocation deliveryLocation fee driverEarning priority assignedAt')
                    .sort({ assignedAt: -1 }),

                // Earnings breakdown
                AnalyticsService.getDriverEarningsBreakdown(driverId, period)
            ]);

            // Get account status
            const accountStatus = driver.accountStatus;

            // Calculate quick stats
            console.log('📊 Today deliveries found:', todayDeliveries.length);
            console.log('📊 Today deliveries details:', todayDeliveries.map(d => ({
                deliveryCode: d.deliveryCode,
                status: d.status,
                assignedAt: d.assignedAt,
                createdAt: d.createdAt
            })));

            const quickStats = {
                today: {
                    deliveries: todayDeliveries.length,
                    completed: todayDeliveries.filter(d => d.status === 'delivered').length,
                    earnings: todayDeliveries
                        .filter(d => d.status === 'delivered')
                        .reduce((sum, d) => sum + (d.driverEarning || 0), 0),
                    pending: todayDeliveries.filter(d => d.status === 'pending').length,
                    inProgress: todayDeliveries.filter(d => ['assigned', 'picked_up'].includes(d.status)).length
                },
                thisWeek: {
                    deliveries: weekAnalytics.stats.totalDeliveries,
                    earnings: weekAnalytics.stats.totalEarnings,
                    averagePerDay: weekAnalytics.stats.averagePerDay,
                    completionRate: weekAnalytics.stats.completionRate
                },
                thisMonth: {
                    deliveries: thisMonthAnalytics.stats.totalDeliveries,
                    earnings: thisMonthAnalytics.stats.totalEarnings,
                    averagePerDay: thisMonthAnalytics.stats.averagePerDay,
                    completionRate: thisMonthAnalytics.stats.completionRate
                },
                allTime: (() => {
                    const stats = totalStats[0] || {
                        totalDeliveries: 0,
                        completedDeliveries: 0,
                        totalEarnings: 0,
                        avgDeliveryTime: 0
                    };
                    return {
                        ...stats,
                        completionRate: stats.totalDeliveries > 0 ?
                            Math.round((stats.completedDeliveries / stats.totalDeliveries) * 100) : 0,
                        avgEarningsPerDelivery: stats.completedDeliveries > 0 ?
                            Math.round(stats.totalEarnings / stats.completedDeliveries) : 0
                    };
                })()
            };

            // Debug: Log quickStats for troubleshooting
            console.log('📊 QuickStats calculated:', {
                today: quickStats.today,
                thisWeek: quickStats.thisWeek,
                thisMonth: quickStats.thisMonth,
                allTime: quickStats.allTime
            });

            // Performance metrics
            const performance = {
                rating: driver.rating,
                completionRate: driver.completionRate,
                totalDeliveries: driver.totalDeliveries,
                totalEarnings: driver.totalEarnings,
                averageEarningsPerDelivery: driver.averageEarningsPerDelivery,
                memberSince: driver.joinedAt,
                accountAge: driver.accountAge,
                isOnline: driver.isOnline,
                isActive: driver.isActive,
                lastLogin: driver.lastLogin
            };

            // Calculate delivery completion rate
            const deliveryCompletionRate = quickStats.allTime.totalDeliveries > 0 ?
                Math.round((quickStats.allTime.completedDeliveries / quickStats.allTime.totalDeliveries) * 100) : 0;

            // Comprehensive dashboard payload
            const dashboardData = {
                driver: {
                    id: driver._id,
                    fullName: driver.fullName,
                    email: driver.email,
                    phone: driver.phone,
                    area: driver.area,
                    university: driver.university,
                    studentId: driver.studentId,
                    transportationType: driver.transportationType,
                    profilePicture: driver.profilePicture,
                    isOnline: driver.isOnline,
                    isActive: driver.isActive,
                    lastLogin: driver.lastLogin
                },
                deliveryCompletionRate: deliveryCompletionRate,
                accountStatus: {
                    verification: accountStatus.verification,
                    completion: accountStatus.completion,
                    documents: accountStatus.documents
                },
                quickStats,
                performance,
                analytics: {
                    period: period,
                    current: currentPeriodAnalytics,
                    today: todayAnalytics,
                    week: weekAnalytics
                },
                deliveries: {
                    recent: recentDeliveries,
                    available: availableDeliveries,
                    today: todayDeliveries
                },
                earnings: {
                    breakdown: earnings,
                    summary: {
                        currentPeriod: currentPeriodAnalytics.stats.totalEarnings,
                        today: quickStats.today.earnings,
                        week: weekAnalytics.stats.totalEarnings,
                        allTime: quickStats.allTime.totalEarnings,
                        pending: currentPeriodAnalytics.remissionOwed
                    }
                },
                trends: currentPeriodAnalytics.trends,
                lastUpdated: new Date().toISOString()
            };

            console.log('📊 Dashboard data compiled successfully:', {
                deliveriesCount: recentDeliveries.length,
                availableCount: availableDeliveries.length,
                deliveryCompletionRate: deliveryCompletionRate,
                profileCompletionPercentage: accountStatus.completion.overall,
                isActive: driver.isActive
            });

            successResponse(res, dashboardData, 'Driver dashboard data retrieved successfully');
        } catch (error) {
            console.error('Error in getDriverDashboard:', error);
            errorResponse(res, error, 500);
        }
    });

    // Get profile options (universities, transportation methods, areas)
    static getProfileOptions = catchAsync(async (req, res) => {
        const options = {
            universities: [
                'Eastern Mediterranean University (EMU)',
                'Near East University (NEU)',
                'Cyprus International University (CIU)',
                'Girne American University (GAU)',
                'University of Kyrenia (UoK)',
                'European University of Lefke (EUL)',
                'Middle East Technical University (METU) – Northern Cyprus Campus',
                'Final International University (FIU)',
                'Bahçeşehir Cyprus University (BAU)',
                'University of Mediterranean Karpasia (UMK)',
                'Cyprus Health and Social Science University',
                'Arkin University of Creative Arts & Design',
                'Cyprus West University'
            ],
            transportationMethods: [
                { value: 'bicycle', label: 'Bicycle', requiresLicense: false },
                { value: 'motorcycle', label: 'Motorcycle', requiresLicense: true },
                { value: 'scooter', label: 'Scooter', requiresLicense: false },
                { value: 'car', label: 'Car', requiresLicense: true },
                { value: 'walking', label: 'Walking', requiresLicense: false },
                { value: 'other', label: 'Other', requiresLicense: false }
            ],
            areas: [
                'Gonyeli',
                'Kucuk',
                'Lefkosa',
                'Famagusta',
                'Kyrenia',
                'Other'
            ],
            addresses: [
                'Gonyeli',
                'Kucuk',
                'Lefkosa',
                'Famagusta',
                'Kyrenia',
                'Girne',
                'Iskele',
                'Guzelyurt',
                'Lapta',
                'Ozankoy',
                'Bogaz',
                'Dipkarpaz',
                'Yeniiskele',
                'Gazimagusa',
                'Other'
            ],
            documentTypes: [
                { type: 'studentId', label: 'Student ID', required: true },
                { type: 'profilePhoto', label: 'Profile Photo', required: true },
                { type: 'universityEnrollment', label: 'University Enrollment Certificate', required: true },
                { type: 'identityCard', label: 'Identity Card', required: true },

            ]
        };

        successResponse(res, options, 'Profile options retrieved successfully');
    });

    // Update document verification status (admin only)
    static updateDocumentStatus = catchAsync(async (req, res) => {
        const { driverId, documentType } = req.params;
        const { status, rejectionReason } = req.body;

        console.log('📄 updateDocumentStatus called:', { driverId, documentType, status });

        try {
            const driver = await Driver.findById(driverId);
            if (!driver) {
                return res.status(404).json({
                    success: false,
                    error: 'Driver not found'
                });
            }

            // Validate document type
            const validDocuments = ['studentId', 'profilePhoto', 'passportPhoto'];
            if (!validDocuments.includes(documentType)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid document type'
                });
            }

            // Initialize documents object if it doesn't exist
            if (!driver.documents) {
                driver.documents = {};
            }
            if (!driver.documents[documentType]) {
                driver.documents[documentType] = {};
            }

            // Update document status
            driver.documents[documentType].status = status;
            if (status === 'rejected' && rejectionReason) {
                driver.documents[documentType].rejectionReason = rejectionReason;
            } else {
                driver.documents[documentType].rejectionReason = undefined;
            }

            // Mark as modified for nested objects
            driver.markModified('documents');
            await driver.save();

            console.log('✅ Document status updated successfully');

            // Return updated account status
            const updatedStatus = driver.accountStatus;
            successResponse(res, updatedStatus, 'Document status updated successfully');

        } catch (error) {
            console.error('Error in updateDocumentStatus:', error);
            errorResponse(res, error, 500);
        }
    });

    // Upload document (driver only)
    static uploadDocument = catchAsync(async (req, res) => {
        const { documentType } = req.params;
        const { user } = req;
        const { file } = req;

        console.log('📤 uploadDocument called:', { documentType, userId: user.id });

        try {
            const driver = await Driver.findById(user.id);
            if (!driver) {
                return res.status(404).json({
                    success: false,
                    error: 'Driver not found'
                });
            }

            // Validate document type
            const validDocuments = ['studentId', 'profilePhoto', 'passportPhoto'];
            if (!validDocuments.includes(documentType)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid document type'
                });
            }

            // Check if file was uploaded
            if (!file) {
                return res.status(400).json({
                    success: false,
                    error: 'No document file provided'
                });
            }

            console.log('📁 File received:', {
                originalname: file.originalname,
                size: file.size,
                mimetype: file.mimetype
            });

            // Upload document to Cloudinary
            const uploadResult = await CloudinaryService.uploadImage(file, `driver-documents/${documentType}`);

            console.log('☁️ Cloudinary upload result:', uploadResult);

            if (!uploadResult.success) {
                return res.status(500).json({
                    success: false,
                    error: 'Failed to upload document: ' + uploadResult.error
                });
            }

            if (!uploadResult.url) {
                console.error('❌ Cloudinary upload succeeded but no URL returned:', uploadResult);
                return res.status(500).json({
                    success: false,
                    error: 'Upload succeeded but no URL returned'
                });
            }

            // Initialize documents object if it doesn't exist
            if (!driver.documents) {
                driver.documents = {};
            }
            if (!driver.documents[documentType]) {
                driver.documents[documentType] = {};
            }

            // Update document upload info
            const documentData = {
                status: 'pending',
                uploadDate: new Date(),
                documentUrl: uploadResult.url,
                rejectionReason: undefined
            };

            console.log('💾 Saving document data:', documentData);

            driver.documents[documentType] = documentData;

            // Mark as modified for nested objects
            driver.markModified('documents');

            // Save with explicit error handling
            const savedDriver = await driver.save();

            console.log('✅ Driver saved successfully:', savedDriver._id);
            console.log('✅ Document URL saved:', savedDriver?.documents?.[documentType]?.documentUrl);

            // Verify the save worked
            const verificationDriver = await Driver.findById(user.id);
            console.log('🔍 Verification - Document URL:', verificationDriver?.documents?.[documentType]?.documentUrl);

            successResponse(res, {
                documentType,
                status: 'pending',
                uploadDate: savedDriver?.documents?.[documentType]?.uploadDate,
                documentUrl: uploadResult.url,
                message: 'Document uploaded successfully and pending verification'
            }, 'Document uploaded successfully and pending verification');

        } catch (error) {
            console.error('Error in uploadDocument:', error);
            errorResponse(res, error, 500);
        }
    });

    // Update driver verification status (admin only)
    static updateVerificationStatus = catchAsync(async (req, res) => {
        const { id } = req.params;
        const { isEmailVerified, isPhoneVerified, isDocumentVerified } = req.body;

        try {
            const driver = await Driver.findById(id);
            if (!driver) {
                return res.status(404).json({
                    success: false,
                    error: 'Driver not found'
                });
            }

            // Update verification fields
            if (isEmailVerified !== undefined) driver.isEmailVerified = isEmailVerified;
            if (isPhoneVerified !== undefined) driver.isPhoneVerified = isPhoneVerified;
            if (isDocumentVerified !== undefined) driver.isDocumentVerified = isDocumentVerified;

            await driver.save();

            // Return updated driver with verification status
            const enhancedProfile = {
                ...driver.toObject(),
                verificationStatus: driver.verificationStatus
            };

            successResponse(res, enhancedProfile, 'Driver verification status updated successfully');

        } catch (error) {
            console.error('Verification status update error:', error);
            errorResponse(res, error, 500);
        }
    });

    // Force refresh verification status (for drivers to sync their status)
    static refreshVerificationStatus = catchAsync(async (req, res) => {
        const { user } = req;

        try {
            const driver = await Driver.findById(user.id);
            if (!driver) {
                return res.status(404).json({
                    success: false,
                    error: 'Driver not found'
                });
            }

            // Check if all required documents are verified
            const allDocumentsVerified = driver.documents?.studentId?.status === 'verified' &&
                driver.documents?.profilePhoto?.status === 'verified' &&
                driver.documents?.passportPhoto?.status === 'verified';

            // Update isDocumentVerified field if it's different
            let wasUpdated = false;
            if (driver.isDocumentVerified !== allDocumentsVerified) {
                driver.isDocumentVerified = allDocumentsVerified;
                await driver.save();
                wasUpdated = true;
                console.log(`✅ Updated verification status for driver ${driver.email}: ${allDocumentsVerified}`);
            }

            // Get fresh verification status
            const verificationStatus = driver.verificationStatus;
            const accountStatus = driver.accountStatus;
            const profileCompletion = driver.profileCompletion;

            successResponse(res, {
                verificationStatus,
                accountStatus,
                profileCompletion,
                isDocumentVerified: driver.isDocumentVerified,
                wasUpdated,
                message: wasUpdated ? 'Verification status updated successfully' : 'Verification status is already up to date'
            }, 'Verification status refreshed successfully');

        } catch (error) {
            console.error('Error refreshing verification status:', error);
            errorResponse(res, error, 500);
        }
    });

    // Update driver profile
    static updateProfile = catchAsync(async (req, res) => {
        const { user } = req;
        const { fullName, phone, area, transportationType, transportationMethod, university, studentId, address } = req.body;

        // Handle both field names for backward compatibility
        const finalTransportationType = transportationType || transportationMethod;

        console.log('📝 updateProfile called with data:', {
            userId: user.id,
            updateData: { fullName, phone, area, transportationType: finalTransportationType, university, studentId, address },
            originalFields: { transportationType, transportationMethod }
        });

        try {
            const driver = await Driver.findById(user.id);
            if (!driver) {
                return res.status(404).json({
                    success: false,
                    error: 'Driver not found'
                });
            }

            // Update fields if provided
            if (fullName !== undefined) driver.fullName = fullName;
            if (phone !== undefined) driver.phone = phone;
            if (area !== undefined) driver.area = area;
            if (finalTransportationType !== undefined) driver.transportationType = finalTransportationType;
            if (university !== undefined) driver.university = university;
            if (studentId !== undefined) driver.studentId = studentId;
            if (address !== undefined) driver.address = address;

            await driver.save();

            console.log('✅ Profile updated successfully for driver:', user.id);

            successResponse(res, {
                id: driver._id,
                fullName: driver.fullName,
                email: driver.email,
                phone: driver.phone,
                area: driver.area,
                transportationType: driver.transportationType,
                university: driver.university,
                studentId: driver.studentId,
                address: driver.address,
                profilePicture: driver.profilePicture,
                memberSince: driver.memberSince,
                verificationStatus: driver.verificationStatus,
                isActive: driver.isActive,
                joinedAt: driver.joinedAt,
                profileCompletion: driver.profileCompletion,
                // Include stored completion data for persistence
                completion: driver.storedProfileCompletion,
                verification: driver.storedVerification
            }, 'Profile updated successfully');

        } catch (error) {
            console.error('Profile update error:', error);
            errorResponse(res, error, 500);
        }
    });

    // Get drivers status overview for admin dashboard
    static getDriversStatus = catchAsync(async (req, res) => {
        try {
            // Get all drivers with their basic info
            const drivers = await Driver.find({}, {
                _id: 1,
                fullName: 1,
                name: 1,
                email: 1,
                phone: 1,
                area: 1,
                isActive: 1,
                lastLogin: 1,
                isOnline: 1,
                createdAt: 1,
                updatedAt: 1
            }).sort({ fullName: 1, name: 1 });

            // Calculate status counts and format driver data
            let online = 0;
            let busy = 0;
            let offline = 0;

            const now = new Date();
            const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);

            const formattedDrivers = drivers.map(driver => {
                // Determine driver status based on activity and availability
                let status = 'offline';

                if (driver.isActive && driver.lastLogin && driver.lastLogin > fifteenMinutesAgo) {
                    // If online and available
                    if (driver.isOnline !== false) {
                        status = 'online';
                        online++;
                    } else {
                        // Could be busy (assigned to deliveries)
                        status = 'busy';
                        busy++;
                    }
                } else {
                    status = 'offline';
                    offline++;
                }

                return {
                    id: driver._id,
                    name: driver.fullName || driver.name || 'Unknown Driver',
                    status: status,
                    lastActive: driver.lastLogin || driver.updatedAt || driver.createdAt,
                    currentLocation: driver.area || 'Unknown'
                };
            });

            const total = drivers.length;

            successResponse(res, {
                online: online,
                busy: busy,
                offline: offline,
                total: total,
                drivers: formattedDrivers
            }, 'Drivers status retrieved successfully');

        } catch (error) {
            console.error('Get drivers status error:', error);
            errorResponse(res, error, 500);
        }
    });

    // Activate driver account from invitation (OTP-only, no password)
    static activateDriverAccount = catchAsync(async (req, res) => {
        const { token } = req.params;
        const { phone, studentId, university, address } = req.body; // Removed area field

        try {
            // Validate required fields (no password required)
            if (!phone || !studentId || !university || !address) {
                return res.status(400).json({
                    success: false,
                    error: 'All fields are required for account activation (except password - OTP-only system)',
                    details: {
                        note: 'Service area must be one of: Gonyeli, Kucuk, Lefkosa, Famagusta, Kyrenia, Other'
                    }
                });
            }

            // Activate driver account (no password)
            // Map address field to both area and address for database consistency
            const driver = await DriverInvitationService.activateDriverAccount(token, {
                phone,
                studentId,
                university,
                area: address, // Use address as area
                address: address // Use address as address
                // No password field - OTP-only authentication
            });

            successResponse(res, {
                driver: {
                    id: driver._id,
                    name: driver.name,
                    email: driver.email,
                    area: driver.area
                },
                message: 'Account activated successfully. Use OTP to login - no password required.'
            }, 'Driver account activated successfully');
        } catch (error) {
            errorResponse(res, error, 400);
        }
    });

    // Validate invitation token (for frontend validation)
    static validateInvitation = catchAsync(async (req, res) => {
        const { token } = req.params;

        try {
            const invitation = await DriverInvitationService.validateInvitationToken(token);

            successResponse(res, {
                invitation: {
                    email: invitation.email,
                    name: invitation.name,
                    expiresAt: invitation.expiresAt
                }
            }, 'Invitation is valid');
        } catch (error) {
            errorResponse(res, error, 400);
        }
    });

    // Add this method to the DriverController class
    static async getDriverLeaderboard(req, res) {
        try {
            const { category = 'overall', period = 'allTime', limit = 10 } = req.query;

            // Validate category
            const validCategories = ['overall', 'delivery', 'earnings', 'referrals', 'rating'];
            if (!validCategories.includes(category)) {
                return errorResponse(res, 'Invalid category', 400);
            }

            // Validate period
            const validPeriods = ['today', 'week', 'thisWeek', 'month', 'monthly', 'currentPeriod', 'year', 'all-time', 'allTime'];
            if (!validPeriods.includes(period)) {
                return errorResponse(res, 'Invalid period', 400);
            }

            // Calculate date range based on period
            const now = new Date();
            let startDate = new Date();

            switch (period) {
                case 'today':
                    // Use local timezone for today's calculations
                    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
                    break;
                case 'week':
                case 'thisWeek':
                    // Start of current week (Sunday)
                    const dayOfWeek = now.getDay();
                    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek, 0, 0, 0, 0);
                    break;
                case 'month':
                case 'monthly':
                case 'currentPeriod':
                    // Start of current month
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
                    break;
                case 'year':
                    // Start of current year
                    startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
                    break;
                case 'all-time':
                case 'allTime':
                    startDate = new Date(0); // Beginning of time
                    break;
                default:
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
            }

            // Get all active drivers
            const drivers = await Driver.find({
                isActive: true,
                isSuspended: false
            });

            if (!drivers || drivers.length === 0) {
                return successResponse(res, {
                    leaderboard: [],
                    period,
                    total: 0,
                    limit: parseInt(limit)
                }, 'No drivers found for leaderboard');
            }

            // Calculate stats for each driver based on the selected period
            const driversWithPoints = await Promise.all(drivers.map(async (driver) => {
                let totalDeliveries, totalEarnings, completedDeliveries, completionRate, avgDeliveryTime;
                const rating = driver.rating || 4.5;
                const totalReferrals = driver.referralPoints || 0;

                if (period === 'allTime' || period === 'all-time') {
                    // Use stored statistics for all-time data
                    totalDeliveries = driver.totalDeliveries || 0;
                    totalEarnings = driver.totalEarnings || 0;
                    completedDeliveries = driver.completedDeliveries || 0;
                    completionRate = driver.completionRate || 0;
                    avgDeliveryTime = 25; // Placeholder
                } else {
                    // Calculate period-specific data from delivery records
                    // First, let's try a simpler query to debug
                    const deliveryQuery = {
                        assignedTo: driver._id,
                        status: 'delivered',
                        deliveredAt: { $gte: startDate, $lte: now }
                    };

                    const deliveries = await Delivery.find(deliveryQuery);

                    // If no deliveries found with deliveredAt, try createdAt
                    if (deliveries.length === 0) {
                        const createdAtQuery = {
                            assignedTo: driver._id,
                            status: 'delivered',
                            createdAt: { $gte: startDate, $lte: now }
                        };

                        const createdAtDeliveries = await Delivery.find(createdAtQuery);

                        // Use whichever query found more deliveries
                        if (createdAtDeliveries.length > deliveries.length) {
                            deliveries.push(...createdAtDeliveries);
                        }
                    }

                    // Calculate period-specific stats
                    totalDeliveries = deliveries.length;
                    totalEarnings = deliveries.reduce((sum, delivery) => sum + (delivery.driverEarning || 0), 0);
                    completedDeliveries = deliveries.length; // All delivered deliveries in period
                    completionRate = totalDeliveries > 0 ? 100 : 0; // All are completed since we filtered by 'delivered'
                    avgDeliveryTime = totalDeliveries > 0 ? 25 : 0; // Placeholder calculation


                }

                let points = 0;

                // Use the same point calculation formula as admin leaderboard
                switch (category) {
                    case 'overall':
                        points = (totalDeliveries * 10) +
                            (totalEarnings * 0.1) +
                            (rating * 10) +
                            (totalReferrals * 20) +
                            (completionRate * 0.5);
                        break;
                    case 'delivery':
                        points = totalDeliveries * 10;
                        break;
                    case 'earnings':
                        points = totalEarnings * 0.1;
                        break;
                    case 'referrals':
                        points = totalReferrals * 20;
                        break;
                    case 'rating':
                        points = rating * 10;
                        break;
                    case 'speed':
                        points = avgDeliveryTime ? (100 - avgDeliveryTime) : 50;
                        break;
                    default:
                        points = (totalDeliveries * 10) + (totalEarnings * 0.1);
                }

                return {
                    _id: driver._id,
                    name: driver.name || driver.fullName || 'Unknown Driver',
                    email: driver.email,
                    phone: driver.phone,
                    totalDeliveries,
                    totalEarnings,
                    rating: parseFloat(rating.toFixed(1)),
                    completionRate: parseFloat(completionRate.toFixed(1)),
                    avgDeliveryTime,
                    totalReferrals,
                    referralPoints: totalReferrals,
                    isOnline: driver.isOnline || false,
                    lastActive: driver.lastLogin || driver.updatedAt,
                    points: Math.round(points),
                    profilePicture: driver.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(driver.name || 'Driver')}&background=random`
                };
            }));

            // Sort by points in descending order
            driversWithPoints.sort((a, b) => b.points - a.points);



            return successResponse(res, {
                leaderboard: driversWithPoints,
                period: period, // Return the actual requested period
                generatedAt: new Date().toISOString()
            }, 'Driver leaderboard retrieved successfully');

        } catch (error) {
            console.error('Error getting driver leaderboard:', error);
            return errorResponse(res, 'Failed to retrieve leaderboard', 500);
        }
    }

    static async getDriverLeaderboardCategories(req, res) {
        try {
            const categories = [
                {
                    id: 'overall',
                    name: 'Overall Champions',
                    icon: '🏆',
                    description: 'Best overall performance across all metrics'
                },
                {
                    id: 'delivery',
                    name: 'Delivery Masters',
                    icon: '📦',
                    description: 'Most deliveries completed'
                },
                {
                    id: 'earnings',
                    name: 'Top Earners',
                    icon: '💰',
                    description: 'Highest earnings generated'
                },
                {
                    id: 'referrals',
                    name: 'Referral Kings',
                    icon: '👥',
                    description: 'Most successful referrals'
                },
                {
                    id: 'rating',
                    name: 'Rating Stars',
                    icon: '⭐',
                    description: 'Highest customer ratings'
                }
            ];

            return successResponse(res, {
                data: categories
            }, 'Leaderboard categories retrieved successfully');

        } catch (error) {
            console.error('Error getting leaderboard categories:', error);
            return errorResponse(res, 'Failed to retrieve categories', 500);
        }
    }
}

module.exports = DriverController;