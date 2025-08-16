const Delivery = require('../models/Delivery');
const Driver = require('../models/Driver');
const BroadcastService = require('../services/broadcastService');
const EarningsService = require('../services/earningsService');
const { catchAsync, successResponse, errorResponse } = require('../middleware/errorHandler');

class DeliveryController {
    // Create new delivery with automatic broadcast
    static createDelivery = catchAsync(async (req, res) => {
        const {
            pickupLocation,
            deliveryLocation,
            customerName,
            customerPhone,
            fee,
            paymentMethod,
            estimatedTime,
            notes,
            priority,
            distance,
            pickupCoordinates,
            deliveryCoordinates,
            broadcastRadius,
            broadcastDuration
        } = req.body;

        const { user } = req;

        try {
            // Calculate earnings
            const earnings = await EarningsService.calculateEarnings(fee);

            // Generate delivery code
            const timestamp = Date.now().toString().slice(-6);
            const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
            const deliveryCode = `GRP-${timestamp}${random}`;

            // Create delivery
            const delivery = new Delivery({
                pickupLocation,
                deliveryLocation,
                customerName,
                customerPhone,
                fee,
                paymentMethod,
                estimatedTime,
                notes,
                priority,
                distance,
                pickupCoordinates,
                deliveryCoordinates,
                broadcastRadius: broadcastRadius || 5, // Default 5km radius
                broadcastDuration: broadcastDuration || 60, // Default 60 seconds
                deliveryCode,
                createdBy: user.id
            });

            await delivery.save();

            // Start automatic broadcast
            const broadcastResult = await BroadcastService.startBroadcast(delivery._id);

            successResponse(res, {
                delivery: {
                    id: delivery._id,
                    pickupLocation: delivery.pickupLocation,
                    deliveryLocation: delivery.deliveryLocation,
                    fee: delivery.fee,
                    status: delivery.status,
                    broadcastStatus: delivery.broadcastStatus,
                    broadcastEndTime: delivery.broadcastEndTime,
                    eligibleDrivers: broadcastResult.eligibleDrivers
                },
                earnings: {
                    driverEarning: earnings.driverEarning,
                    companyEarning: earnings.companyEarning
                }
            }, 'Delivery created and broadcast started successfully');
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

    // Update delivery status
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

            successResponse(res, {
                delivery: {
                    id: delivery._id,
                    status: delivery.status,
                    updatedAt: delivery.updatedAt
                }
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
}

module.exports = DeliveryController;