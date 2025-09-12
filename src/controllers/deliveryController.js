const Delivery = require('../models/Delivery');
const Driver = require('../models/Driver');
const BroadcastService = require('../services/broadcastService');
const EarningsService = require('../services/earningsService');
const LocationService = require('../services/locationService');
const { catchAsync, successResponse, errorResponse } = require('../middleware/errorHandler');

class DeliveryController {
    // Create new delivery with automatic broadcast or manual assignment
    static createDelivery = catchAsync(async (req, res) => {
        const {
            pickupLocation,
            deliveryLocation,
            pickupLocationDescription,
            deliveryLocationDescription,
            customerName,
            customerPhone,
            fee,
            paymentMethod,
            estimatedTime,
            notes,
            priority,
            distance,
            pickupLocationLink,
            deliveryLocationLink,
            pickupCoordinates,
            deliveryCoordinates,
            useAutoBroadcast = true,
            broadcastRadius,
            broadcastDuration,
            assignedTo
        } = req.body;

        const { user } = req;

        try {
            // Extract coordinates from Google Maps links if provided
            let finalPickupCoordinates = pickupCoordinates;
            let finalDeliveryCoordinates = deliveryCoordinates;

            if (pickupLocationLink) {
                try {
                    const validation = LocationService.validateGoogleMapsLink(pickupLocationLink);
                    if (validation.isValid) {
                        finalPickupCoordinates = validation.coordinates;
                        console.log(`✅ Extracted pickup coordinates: ${validation.coordinates.lat}, ${validation.coordinates.lng}`);
                    } else {
                        throw new Error(`Invalid pickup location link: ${validation.error}`);
                    }
                } catch (error) {
                    throw new Error(`Failed to process pickup location link: ${error.message}`);
                }
            }

            if (deliveryLocationLink) {
                try {
                    const validation = LocationService.validateGoogleMapsLink(deliveryLocationLink);
                    if (validation.isValid) {
                        finalDeliveryCoordinates = validation.coordinates;
                        console.log(`✅ Extracted delivery coordinates: ${validation.coordinates.lat}, ${validation.coordinates.lng}`);
                    } else {
                        throw new Error(`Invalid delivery location link: ${validation.error}`);
                    }
                } catch (error) {
                    throw new Error(`Failed to process delivery location link: ${error.message}`);
                }
            }

            // Calculate earnings
            const earnings = await EarningsService.calculateEarnings(fee);

            // Generate delivery code
            const timestamp = Date.now().toString().slice(-6);
            const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
            const deliveryCode = `GRP-${timestamp}${random}`;

            // Create delivery
            const deliveryData = {
                pickupLocation,
                deliveryLocation,
                pickupLocationDescription,
                deliveryLocationDescription,
                customerName,
                customerPhone,
                fee,
                paymentMethod,
                estimatedTime,
                notes,
                priority,
                distance,
                pickupCoordinates: finalPickupCoordinates,
                deliveryCoordinates: finalDeliveryCoordinates,
                deliveryCode,
                createdBy: user.id
            };

            // Handle broadcast fields based on useAutoBroadcast
            if (useAutoBroadcast) {
                deliveryData.broadcastRadius = broadcastRadius || 5;
                deliveryData.broadcastDuration = broadcastDuration || 60;
                deliveryData.broadcastStatus = 'not_started';
            } else {
                // Manual assignment
                deliveryData.assignedTo = assignedTo;
                deliveryData.status = 'accepted'; // Changed from 'assigned' to 'accepted'
                deliveryData.broadcastStatus = 'manual_assignment';
            }

            const delivery = new Delivery(deliveryData);
            await delivery.save();

            let result;
            let updatedDelivery = delivery;

            if (useAutoBroadcast) {
                // Start automatic broadcast
                result = await BroadcastService.startBroadcast(delivery._id);
                // Get the updated delivery after broadcast starts
                updatedDelivery = await Delivery.findById(delivery._id);
            } else {
                // Manual assignment - notify the assigned driver
                if (assignedTo) {
                    const driver = await Driver.findById(assignedTo);
                    if (driver) {
                        // Send notification to assigned driver
                        const NotificationService = require('../services/notificationService');
                        await NotificationService.createAndEmitNotification({
                            recipient: assignedTo,
                            recipientModel: 'Driver',
                            type: 'delivery_assigned',
                            title: 'New Delivery Assigned',
                            message: `You have been assigned a new delivery: ${delivery.pickupLocation} to ${delivery.deliveryLocation}`,
                            data: {
                                deliveryId: delivery._id,
                                deliveryCode: delivery.deliveryCode,
                                pickupLocation: delivery.pickupLocation,
                                deliveryLocation: delivery.deliveryLocation,
                                fee: delivery.fee
                            },
                            priority: 'high'
                        });
                    }
                }
                result = { eligibleDrivers: 0 };
            }

            successResponse(res, {
                id: updatedDelivery._id,
                deliveryCode: updatedDelivery.deliveryCode,
                pickupLocation: updatedDelivery.pickupLocation,
                deliveryLocation: updatedDelivery.deliveryLocation,
                fee: updatedDelivery.fee,
                status: updatedDelivery.status,
                broadcastStatus: updatedDelivery.broadcastStatus,
                broadcastEndTime: updatedDelivery.broadcastEndTime,
                assignedTo: updatedDelivery.assignedTo,
                eligibleDrivers: result.eligibleDrivers,
                earnings: {
                    driverEarning: earnings.driverEarning,
                    companyEarning: earnings.companyEarning
                }
            }, useAutoBroadcast ? 'Delivery created and broadcast started successfully' : 'Delivery created and assigned successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });



    // Get all deliveries with broadcast status
    static getDeliveries = catchAsync(async (req, res) => {
        const { page = 1, limit = 10, status, broadcastStatus, priority } = req.query;

        try {
            const filter = {};
            if (status) filter.status = status;
            if (broadcastStatus) filter.broadcastStatus = broadcastStatus;
            if (priority) filter.priority = priority;

            const deliveries = await Delivery.find(filter)
                .populate('assignedTo', 'name email area')
                .populate('createdBy', 'name email')
                .sort({ createdAt: -1 })
                .limit(limit * 1)
                .skip((page - 1) * limit);

            const total = await Delivery.countDocuments(filter);

            successResponse(res, {
                deliveries,
                pagination: {
                    currentPage: page * 1,
                    totalPages: Math.ceil(total / limit),
                    totalItems: total,
                    itemsPerPage: limit * 1
                }
            }, 'Deliveries retrieved successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Get delivery by ID
    static getDeliveryById = catchAsync(async (req, res) => {
        const { id } = req.params;

        try {
            const delivery = await Delivery.findById(id)
                .populate('assignedTo', 'name email area phone')
                .populate('createdBy', 'name email');

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

            // Don't allow updates if delivery is already assigned
            if (delivery.assignedTo && delivery.status !== 'pending') {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot update delivery that is already assigned'
                });
            }

            Object.assign(delivery, updateData);
            await delivery.save();

            successResponse(res, delivery, 'Delivery updated successfully');
        } catch (error) {
            errorResponse(res, error, 500);
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

            // Don't allow deletion if delivery is assigned
            if (delivery.assignedTo) {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot delete delivery that is assigned to a driver'
                });
            }

            await Delivery.findByIdAndDelete(id);

            successResponse(res, {}, 'Delivery deleted successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Start broadcast for existing delivery
    static startBroadcast = catchAsync(async (req, res) => {
        const { id } = req.params;

        try {
            const result = await BroadcastService.startBroadcast(id);

            successResponse(res, {
                delivery: result.delivery,
                eligibleDrivers: result.eligibleDrivers,
                broadcastEndTime: result.broadcastEndTime
            }, 'Broadcast started successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Accept delivery (for drivers)
    static acceptDelivery = catchAsync(async (req, res) => {
        const { id } = req.params;
        const { user } = req;

        try {
            const delivery = await BroadcastService.acceptDelivery(id, user.id);

            successResponse(res, {
                delivery: {
                    id: delivery._id,
                    pickupLocation: delivery.pickupLocation,
                    deliveryLocation: delivery.deliveryLocation,
                    fee: delivery.fee,
                    status: delivery.status,
                    assignedAt: delivery.assignedAt
                }
            }, 'Delivery accepted successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Manual assignment (admin fallback)
    static manualAssign = catchAsync(async (req, res) => {
        const { id } = req.params;
        const { driverId } = req.body;

        try {
            const delivery = await BroadcastService.manualAssign(id, driverId);

            successResponse(res, {
                delivery: {
                    id: delivery._id,
                    assignedTo: delivery.assignedTo,
                    assignedAt: delivery.assignedAt,
                    status: delivery.status
                }
            }, 'Delivery manually assigned successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Get broadcast statistics
    static getBroadcastStats = catchAsync(async (req, res) => {
        try {
            const stats = await BroadcastService.getBroadcastStats();

            successResponse(res, stats, 'Broadcast statistics retrieved successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Get active broadcasts for driver
    static getActiveBroadcasts = catchAsync(async (req, res) => {
        const { user } = req;
        const { lat, lng } = req.query;

        try {
            const location = lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : null;
            const broadcasts = await BroadcastService.getActiveBroadcastsForDriver(user.id, location);

            successResponse(res, {
                broadcasts,
                count: broadcasts.length
            }, 'Active broadcasts retrieved successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Handle expired broadcasts (admin endpoint)
    static handleExpiredBroadcasts = catchAsync(async (req, res) => {
        try {
            const processedCount = await BroadcastService.handleExpiredBroadcasts();

            successResponse(res, {
                processedCount,
                message: `Processed ${processedCount} expired broadcasts`
            }, 'Expired broadcasts handled successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Update delivery status with automatic earnings calculation
    static updateDeliveryStatus = catchAsync(async (req, res) => {
        const { id } = req.params;
        const { status, notes } = req.body;
        const { user } = req;

        try {
            const delivery = await Delivery.findById(id);
            if (!delivery) {
                return res.status(404).json({
                    success: false,
                    error: 'Delivery not found'
                });
            }

            // Verify driver can only update their own deliveries
            if (user.userType === 'driver' && delivery.assignedTo.toString() !== user.id) {
                return res.status(403).json({
                    success: false,
                    error: 'You can only update your own deliveries'
                });
            }

            delivery.status = status;
            if (notes) delivery.notes = notes;

            // Set appropriate timestamps
            const now = new Date();
            switch (status) {
                case 'picked_up':
                    delivery.pickedUpAt = now;
                    break;
                case 'delivered':
                    delivery.deliveredAt = now;
                    break;
                case 'cancelled':
                    delivery.cancelledAt = now;
                    break;
            }

            await delivery.save();

            // SAFEGUARD 1: Always calculate earnings when a delivery is marked as "delivered"
            let earningsResult = null;
            if (status === 'delivered') {
                try {
                    const EarningsValidationService = require('../services/earningsValidationService');
                    const earningsCheck = await EarningsValidationService.ensureDeliveryEarningsCalculated(id);

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
                    await EarningsService.updateDriverTotalEarnings(delivery.assignedTo);
                    console.log(`🔄 Updated total earnings for driver ${delivery.assignedTo}`);
                } catch (totalEarningsError) {
                    console.error('Failed to update driver total earnings:', totalEarningsError);
                }
            }

            // SAFEGUARD 3: Validate that driver totals match the sum of their delivered deliveries
            if (status === 'delivered' && delivery.assignedTo) {
                try {
                    const EarningsValidationService = require('../services/earningsValidationService');
                    const validation = await EarningsValidationService.validateDriverEarnings(delivery.assignedTo);

                    if (!validation.isValid) {
                        console.warn(`⚠️ Driver earnings validation failed for driver ${delivery.assignedTo}:`, validation);

                        // Auto-fix the earnings if validation fails
                        const fixResult = await EarningsValidationService.fixDriverEarnings(delivery.assignedTo);
                        if (fixResult.success) {
                            console.log(`✅ Auto-fix applied for driver ${delivery.assignedTo}`);
                        } else {
                            console.error(`❌ Failed to auto-fix driver earnings for driver ${delivery.assignedTo}:`, fixResult.error);
                        }
                    } else {
                        console.log(`✅ Driver earnings validation passed for driver ${delivery.assignedTo}`);
                    }
                } catch (validationError) {
                    console.error('Failed to validate driver earnings:', validationError);
                }
            }

            successResponse(res, {
                delivery: {
                    id: delivery._id,
                    status: delivery.status,
                    updatedAt: delivery.updatedAt
                },
                earnings: earningsResult
            }, 'Delivery status updated successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Get driver's deliveries
    static getDriverDeliveries = catchAsync(async (req, res) => {
        const { user } = req;
        const { status, page = 1, limit = 10 } = req.query;

        try {
            const filter = { assignedTo: user.id };
            if (status) filter.status = status;

            const deliveries = await Delivery.find(filter)
                .populate('createdBy', 'name email')
                .sort({ createdAt: -1 })
                .limit(limit * 1)
                .skip((page - 1) * limit);

            const total = await Delivery.countDocuments(filter);

            successResponse(res, {
                deliveries,
                pagination: {
                    currentPage: page * 1,
                    totalPages: Math.ceil(total / limit),
                    totalItems: total,
                    itemsPerPage: limit * 1
                }
            }, 'Driver deliveries retrieved successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Calculate and update driver earnings for completed delivery
    static async calculateDriverEarnings(deliveryId) {
        try {
            const delivery = await Delivery.findById(deliveryId)
                .populate('assignedTo', 'totalEarnings totalDeliveries rating');

            if (!delivery) {
                throw new Error('Delivery not found');
            }

            if (delivery.status !== 'delivered') {
                throw new Error('Delivery must be completed to calculate earnings');
            }

            // Calculate comprehensive earnings using centralized method
            const comprehensiveEarnings = await EarningsService.calculateComprehensiveEarnings(delivery, delivery.assignedTo);
            const { baseEarnings, totalBonus, totalEarnings, bonusDetails } = comprehensiveEarnings;

            // Update delivery with calculated earnings (skip validation for existing records)
            delivery.driverEarning = totalEarnings;
            delivery.earningsCalculated = true;
            delivery.earningsCalculationDate = new Date();
            await delivery.save({ validateBeforeSave: false });

            // Update driver's total earnings and delivery count
            const driver = delivery.assignedTo;
            driver.totalEarnings = (driver.totalEarnings || 0) + totalEarnings;
            driver.totalDeliveries = (driver.totalDeliveries || 0) + 1;
            await driver.save();

            // Update driver rating after earnings calculation
            try {
                console.log(`⭐ Updating driver rating after earnings calculation for: ${driver.name}`);
                const DriverRatingService = require('../services/driverRatingService');
                const oldRating = driver.rating || 5.0;
                const ratingResult = await DriverRatingService.calculateDriverRating(driver._id);
                const newRating = ratingResult.finalRating;

                console.log(`⭐ Rating updated for ${driver.name}: ${oldRating} → ${newRating}`);
            } catch (ratingError) {
                console.error('Failed to update driver rating after earnings calculation:', ratingError);
                // Don't fail the earnings calculation if rating update fails
            }

            console.log(`💰 Earnings calculated for delivery ${delivery.deliveryCode}: ${totalEarnings}₺ (Base: ${baseEarnings}₺, Bonus: ${totalBonus}₺)`);

            return {
                success: true,
                deliveryId: delivery._id,
                deliveryCode: delivery.deliveryCode,
                baseEarnings,
                totalBonus,
                totalEarnings,
                bonusDetails,
                driverId: driver._id,
                driverTotalEarnings: driver.totalEarnings,
                driverTotalDeliveries: driver.totalDeliveries,
                driverRating: driver.rating
            };

        } catch (error) {
            console.error('Error calculating driver earnings:', error);
            throw error;
        }
    }

    // Debug endpoint to check delivery broadcast status
    static getDeliveryBroadcastStatus = catchAsync(async (req, res) => {
        const { id } = req.params;

        try {
            const status = await BroadcastService.getDeliveryBroadcastStatus(id);

            successResponse(res, status, 'Delivery broadcast status retrieved successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Unassign delivery from driver
    static unassignDelivery = catchAsync(async (req, res) => {
        const { id } = req.params;

        try {
            const delivery = await Delivery.findById(id);
            if (!delivery) {
                return errorResponse(res, { message: 'Delivery not found' }, 404);
            }

            // Clear assignment
            delivery.assignedTo = null;
            delivery.assignedAt = null;
            delivery.status = 'pending';
            delivery.broadcastStatus = 'pending';

            await delivery.save();

            successResponse(res, {
                delivery: {
                    id: delivery._id,
                    status: delivery.status,
                    assignedTo: delivery.assignedTo
                }
            }, 'Delivery unassigned successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Bulk operations for deliveries
    static bulkOperations = catchAsync(async (req, res) => {
        const { operation, ids, data } = req.body;

        try {
            let results = [];

            switch (operation) {
                case 'assign':
                    for (const deliveryId of ids) {
                        try {
                            const delivery = await Delivery.findById(deliveryId);
                            if (delivery) {
                                delivery.assignedTo = data.driverId;
                                delivery.assignedAt = new Date();
                                delivery.status = 'assigned';
                                delivery.broadcastStatus = 'completed';
                                await delivery.save();
                                results.push({ id: deliveryId, success: true });
                            } else {
                                results.push({ id: deliveryId, success: false, error: 'Delivery not found' });
                            }
                        } catch (error) {
                            results.push({ id: deliveryId, success: false, error: error.message });
                        }
                    }
                    break;

                case 'cancel':
                    for (const deliveryId of ids) {
                        try {
                            const delivery = await Delivery.findById(deliveryId);
                            if (delivery) {
                                delivery.status = 'cancelled';
                                delivery.cancelledAt = new Date();
                                await delivery.save();
                                results.push({ id: deliveryId, success: true });
                            } else {
                                results.push({ id: deliveryId, success: false, error: 'Delivery not found' });
                            }
                        } catch (error) {
                            results.push({ id: deliveryId, success: false, error: error.message });
                        }
                    }
                    break;

                case 'updatePriority':
                    for (const deliveryId of ids) {
                        try {
                            const delivery = await Delivery.findById(deliveryId);
                            if (delivery) {
                                delivery.priority = data.priority;
                                await delivery.save();
                                results.push({ id: deliveryId, success: true });
                            } else {
                                results.push({ id: deliveryId, success: false, error: 'Delivery not found' });
                            }
                        } catch (error) {
                            results.push({ id: deliveryId, success: false, error: error.message });
                        }
                    }
                    break;

                default:
                    return errorResponse(res, { message: 'Invalid operation' }, 400);
            }

            successResponse(res, { results }, 'Bulk operation completed');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Send delivery notification to drivers
    static sendDeliveryNotification = catchAsync(async (req, res) => {
        const { deliveryId, message, sound, priority } = req.body;
        const { user } = req;

        try {
            // Find the delivery
            const delivery = await Delivery.findById(deliveryId);
            if (!delivery) {
                return errorResponse(res, { message: 'Delivery not found' }, 404);
            }

            // Check if delivery is in a state that allows notifications
            if (delivery.status === 'completed' || delivery.status === 'cancelled') {
                return errorResponse(res, { message: 'Cannot send notifications for completed or cancelled deliveries' }, 400);
            }

            // Get the socket service
            const socketService = require('../services/socketService');

            // Prepare notification data
            const notificationData = {
                type: 'delivery-notification',
                deliveryId: delivery._id,
                deliveryCode: delivery.deliveryCode,
                pickupLocation: delivery.pickupLocation,
                deliveryLocation: delivery.deliveryLocation,
                customerName: delivery.customerName,
                customerPhone: delivery.customerPhone,
                fee: delivery.fee,
                estimatedTime: delivery.estimatedTime,
                priority: priority || 'normal',
                message: message || `New delivery available: ${delivery.deliveryCode}`,
                sound: sound || 'delivery-notification.mp3',
                timestamp: new Date(),
                createdBy: user.id
            };

            // Emit notification to all online drivers
            socketService.emit('delivery-notification', notificationData);

            console.log('📢 Delivery notification sent:', {
                deliveryId: delivery._id,
                deliveryCode: delivery.deliveryCode,
                priority,
                message: notificationData.message
            });

            successResponse(res, {
                deliveryId: delivery._id,
                deliveryCode: delivery.deliveryCode,
                notificationSent: true,
                timestamp: new Date()
            }, 'Delivery notification sent successfully');

        } catch (error) {
            console.error('Error sending delivery notification:', error);
            errorResponse(res, error, 500);
        }
    });

}

module.exports = DeliveryController;