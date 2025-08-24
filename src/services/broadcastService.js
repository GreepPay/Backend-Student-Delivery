const Delivery = require('../models/Delivery');
const Driver = require('../models/Driver');
const SocketService = require('./socketService');
const LocationService = require('./locationService');
const { catchAsync } = require('../middleware/errorHandler');

class BroadcastService {
    // Start broadcast for a delivery
    static async startBroadcast(deliveryId) {
        try {
            const delivery = await Delivery.findById(deliveryId);
            if (!delivery) {
                throw new Error('Delivery not found');
            }

            if (delivery.broadcastStatus !== 'not_started') {
                throw new Error('Broadcast already started or completed');
            }

            // Start the broadcast
            await delivery.startBroadcast();

            // Find eligible drivers within radius
            const eligibleDrivers = await this.findEligibleDrivers(delivery);

            // Send broadcast notification to eligible drivers
            await this.sendBroadcastNotification(delivery, eligibleDrivers);

            console.log(`Broadcast started for delivery ${deliveryId}. Eligible drivers: ${eligibleDrivers.length}`);

            return {
                delivery,
                eligibleDrivers: eligibleDrivers.length,
                broadcastEndTime: delivery.broadcastEndTime
            };
        } catch (error) {
            console.error('Error starting broadcast:', error);
            throw error;
        }
    }

    // Find eligible drivers for a delivery
    static async findEligibleDrivers(delivery) {
        try {
            console.log(`🔍 Finding eligible drivers for delivery ${delivery._id}`);

            // Check if we have pickup coordinates
            if (!delivery.pickupCoordinates || !delivery.pickupCoordinates.lat || !delivery.pickupCoordinates.lng) {
                console.log('⚠️ No pickup coordinates available, using area-based search');
                // Fallback to area-based search
                const eligibleDrivers = await Driver.find({
                    isActive: true,
                    isOnline: true,
                    isSuspended: false
                }).limit(20);

                return eligibleDrivers.map(driver => ({
                    driver: driver,
                    distance: 'Unknown',
                    distanceFormatted: 'Unknown'
                }));
            }

            // Use the new location service to find nearby drivers
            const nearbyDrivers = await LocationService.findNearbyDrivers(
                delivery.pickupCoordinates.lat,
                delivery.pickupCoordinates.lng,
                delivery.broadcastRadius || 10, // Default 10km radius
                20 // Limit to 20 drivers
            );

            console.log(`✅ Found ${nearbyDrivers.length} eligible drivers within ${delivery.broadcastRadius || 10}km radius`);

            return nearbyDrivers;
        } catch (error) {
            console.error('❌ Error finding eligible drivers:', error);
            // Fallback to basic search
            const eligibleDrivers = await Driver.find({
                isActive: true,
                isOnline: true,
                isSuspended: false
            }).limit(10);

            return eligibleDrivers.map(driver => ({
                driver: driver,
                distance: 'Unknown',
                distanceFormatted: 'Unknown'
            }));
        }
    }

    // Send broadcast notification to drivers
    static async sendBroadcastNotification(delivery, drivers) {
        try {
            const broadcastData = {
                deliveryId: delivery._id,
                pickupLocation: delivery.pickupLocation,
                deliveryLocation: delivery.deliveryLocation,
                fee: delivery.fee,
                estimatedTime: delivery.estimatedTime,
                priority: delivery.priority,
                broadcastEndTime: delivery.broadcastEndTime,
                broadcastDuration: delivery.broadcastDuration,
                distance: delivery.distance,
                notes: delivery.notes
            };

            // Send notifications to eligible drivers
            const NotificationService = require('./notificationService');

            // Extract driver objects from the new format
            const driverObjects = drivers.map(item => item.driver || item);
            await NotificationService.sendDeliveryNotification(delivery, driverObjects);

            // Emit real-time delivery broadcast for toast notification
            SocketService.emitDeliveryBroadcast(delivery, drivers);

            // Also emit to admin dashboard for monitoring
            SocketService.emitAdminNotification({
                type: 'broadcast-started',
                deliveryId: delivery._id,
                eligibleDrivers: drivers.length,
                broadcastEndTime: delivery.broadcastEndTime
            });

        } catch (error) {
            console.error('Error sending broadcast notifications:', error);
            throw error;
        }
    }

    // Handle driver acceptance of delivery
    static async acceptDelivery(deliveryId, driverId) {
        try {
            const delivery = await Delivery.findById(deliveryId);
            if (!delivery) {
                throw new Error('Delivery not found');
            }

            // Check broadcast status and provide specific error messages
            switch (delivery.broadcastStatus) {
                case 'not_started':
                    throw new Error('Delivery broadcast has not started yet');
                case 'accepted':
                    throw new Error('Delivery has already been accepted by another driver');
                case 'expired':
                    throw new Error('Delivery broadcast has expired');
                case 'manual_assignment':
                    throw new Error('This delivery was manually assigned and cannot be accepted through broadcast');
                case 'broadcasting':
                    // This is the correct status, continue with acceptance
                    break;
                default:
                    throw new Error(`Delivery is in an invalid broadcast status: ${delivery.broadcastStatus}`);
            }

            if (delivery.assignedTo) {
                throw new Error('Delivery already assigned');
            }

            // Check if broadcast has expired
            if (delivery.broadcastEndTime && new Date() > delivery.broadcastEndTime) {
                // Update status to expired
                delivery.broadcastStatus = 'expired';
                await delivery.save();
                throw new Error('Delivery broadcast has expired');
            }

            // Accept the delivery
            await delivery.acceptDelivery(driverId);

            // Get driver name for notification
            const driver = await Driver.findById(driverId);
            const driverName = driver ? driver.name : 'Unknown Driver';

            // Emit delivery accepted notification
            SocketService.emitDeliveryAccepted(delivery, driverId, driverName);

            // Notify all other drivers that the delivery is no longer available
            await this.notifyDeliveryAccepted(delivery, driverId);

            // Notify admin
            SocketService.emitAdminNotification({
                type: 'delivery-accepted',
                deliveryId: delivery._id,
                driverId: driverId,
                acceptedAt: delivery.acceptedAt
            });

            console.log(`Delivery ${deliveryId} accepted by driver ${driverId}`);

            return delivery;
        } catch (error) {
            console.error('Error accepting delivery:', error);
            throw error;
        }
    }

    // Notify other drivers that delivery was accepted
    static async notifyDeliveryAccepted(delivery, acceptedDriverId) {
        try {
            const allDrivers = await Driver.find({ isActive: true });

            for (const driver of allDrivers) {
                if (driver._id.toString() !== acceptedDriverId.toString()) {
                    try {
                        SocketService.emitToDriver(driver._id, 'delivery-accepted-by-other', {
                            deliveryId: delivery._id
                        });
                    } catch (error) {
                        console.error(`Failed to notify driver ${driver._id}:`, error);
                    }
                }
            }
        } catch (error) {
            console.error('Error notifying drivers of acceptance:', error);
        }
    }

    // Handle expired broadcasts
    static async handleExpiredBroadcasts() {
        try {
            const expiredDeliveries = await Delivery.findExpiredBroadcasts();

            for (const delivery of expiredDeliveries) {
                await this.handleExpiredBroadcast(delivery);
            }

            return expiredDeliveries.length;
        } catch (error) {
            console.error('Error handling expired broadcasts:', error);
            throw error;
        }
    }

    // Handle a single expired broadcast
    static async handleExpiredBroadcast(delivery) {
        try {
            // Mark as expired
            await delivery.expireBroadcast();

            // Emit delivery expired notification
            SocketService.emitDeliveryExpired(delivery);

            // Try to retry with larger radius
            if (delivery.broadcastAttempts < delivery.maxBroadcastAttempts) {
                await delivery.retryBroadcast();

                // Start new broadcast
                await this.startBroadcast(delivery._id);

                console.log(`Retrying broadcast for delivery ${delivery._id} with larger radius`);
            } else {
                // Max attempts reached, mark for manual assignment
                delivery.broadcastStatus = 'manual_assignment';
                await delivery.save();

                // Notify admin
                SocketService.emitAdminNotification({
                    type: 'broadcast-failed',
                    title: 'Broadcast Failed',
                    message: `Broadcast failed for delivery after ${delivery.broadcastAttempts} attempts`,
                    data: {
                        deliveryId: delivery._id,
                        reason: 'max_attempts_reached',
                        attempts: delivery.broadcastAttempts
                    }
                });

                console.log(`Broadcast failed for delivery ${delivery._id} after ${delivery.broadcastAttempts} attempts`);
            }
        } catch (error) {
            console.error(`Error handling expired broadcast for delivery ${delivery._id}:`, error);
        }
    }

    // Get active broadcasts for a driver
    static async getActiveBroadcastsForDriver(driverId, location) {
        try {
            console.log(`🔍 Getting active broadcasts for driver: ${driverId}`);

            // For now, return all active broadcasts regardless of driver status
            // This will help us test the system
            const activeDeliveries = await Delivery.find({
                broadcastStatus: 'broadcasting',
                broadcastEndTime: { $gt: new Date() },
                assignedTo: null,
                status: 'pending'
            }).sort({ priority: -1, createdAt: 1 });

            console.log(`📦 Found ${activeDeliveries.length} active broadcasts`);

            // Filter by distance if location is provided and coordinates exist
            if (location && location.lat && location.lng) {
                try {
                    const deliveriesInRange = await Delivery.findAvailableForDriver(
                        driverId,
                        location,
                        10 // 10km radius for driver view
                    );
                    console.log(`📍 Location-based filtering returned ${deliveriesInRange.length} deliveries`);
                    return deliveriesInRange;
                } catch (error) {
                    console.log('Location-based filtering failed, returning all active broadcasts:', error.message);
                    // If location filtering fails (e.g., no coordinates), return all active broadcasts
                    return activeDeliveries;
                }
            }

            console.log(`📦 Returning ${activeDeliveries.length} active broadcasts for driver`);
            return activeDeliveries;
        } catch (error) {
            console.error('Error getting active broadcasts for driver:', error);
            return [];
        }
    }

    // Get broadcast statistics
    static async getBroadcastStats() {
        try {
            const stats = await Delivery.aggregate([
                {
                    $group: {
                        _id: '$broadcastStatus',
                        count: { $sum: 1 }
                    }
                }
            ]);

            const activeBroadcasts = await Delivery.findActiveBroadcasts();
            const expiredBroadcasts = await Delivery.findExpiredBroadcasts();

            return {
                byStatus: stats,
                activeCount: activeBroadcasts.length,
                expiredCount: expiredBroadcasts.length,
                totalBroadcasts: stats.reduce((sum, stat) => sum + stat.count, 0)
            };
        } catch (error) {
            console.error('Error getting broadcast stats:', error);
            return {
                byStatus: [],
                activeCount: 0,
                expiredCount: 0,
                totalBroadcasts: 0
            };
        }
    }

    // Manual assignment fallback
    static async manualAssign(deliveryId, driverId) {
        try {
            const delivery = await Delivery.findById(deliveryId);
            if (!delivery) {
                throw new Error('Delivery not found');
            }

            await delivery.manualAssign(driverId);

            // Notify admin
            SocketService.emitAdminNotification({
                type: 'delivery-manually-assigned',
                title: 'Delivery Manually Assigned',
                message: `Delivery has been manually assigned to driver`,
                data: {
                    deliveryId: delivery._id,
                    driverId: driverId,
                    assignedAt: delivery.assignedAt
                }
            });

            console.log(`Delivery ${deliveryId} manually assigned to driver ${driverId}`);

            return delivery;
        } catch (error) {
            console.error('Error manually assigning delivery:', error);
            throw error;
        }
    }

    // Get delivery broadcast status (for debugging)
    static async getDeliveryBroadcastStatus(deliveryId) {
        try {
            const delivery = await Delivery.findById(deliveryId);
            if (!delivery) {
                throw new Error('Delivery not found');
            }

            const now = new Date();
            const isExpired = delivery.broadcastEndTime && now > delivery.broadcastEndTime;

            return {
                deliveryId: delivery._id,
                broadcastStatus: delivery.broadcastStatus,
                broadcastStartTime: delivery.broadcastStartTime,
                broadcastEndTime: delivery.broadcastEndTime,
                isExpired,
                assignedTo: delivery.assignedTo,
                status: delivery.status,
                canBeAccepted: delivery.broadcastStatus === 'broadcasting' && !isExpired && !delivery.assignedTo
            };
        } catch (error) {
            console.error('Error getting delivery broadcast status:', error);
            throw error;
        }
    }
}

module.exports = BroadcastService;
