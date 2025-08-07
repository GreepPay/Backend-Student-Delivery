const Notification = require('../models/Notification');
const Admin = require('../models/Admin');
const Delivery = require('../models/Delivery');
const Driver = require('../models/Driver');
const socketService = require('./socketService');

class AdminNotificationService {
    /**
     * Create admin-specific notification with sound
     */
    static async createAdminNotification(data) {
        try {
            // Get admin IDs
            const adminIds = await this.getAdminIds();

            // Create notifications for each admin
            const notifications = await Promise.all(
                adminIds.map(adminId =>
                    Notification.createNotification({
                        ...data,
                        recipient: adminId,
                        recipientModel: 'Admin',
                        priority: data.priority || 'medium'
                    })
                )
            );

            // Emit socket event with sound configuration for the first notification
            if (notifications.length > 0) {
                socketService.emitAdminNotification(notifications[0], data.sound);
            }

            return notifications;
        } catch (error) {
            console.error('Error creating admin notification:', error);
            throw error;
        }
    }

    /**
     * New driver registration notification
     */
    static async createNewDriverNotification(driverId) {
        try {
            const driver = await Driver.findById(driverId);
            if (!driver) throw new Error('Driver not found');

            return await this.createAdminNotification({
                type: 'new_driver_registered',
                title: 'New Driver Registered',
                message: `${driver.name} has joined the platform`,
                data: {
                    driverId: driver._id,
                    driverName: driver.name,
                    driverEmail: driver.email,
                    driverArea: driver.area
                },
                priority: 'medium',
                sound: 'notification',
                createdBy: driver._id,
                createdByModel: 'Driver'
            });
        } catch (error) {
            console.error('Error creating new driver notification:', error);
            throw error;
        }
    }

    /**
     * Delivery status change notification
     */
    static async createDeliveryStatusNotification(deliveryId, status, driverId) {
        try {
            const delivery = await Delivery.findById(deliveryId)
                .populate('assignedTo', 'name')
                .populate('assignedBy', 'name');

            if (!delivery) throw new Error('Delivery not found');

            let notificationData = {
                data: {
                    deliveryId: delivery._id,
                    deliveryCode: delivery.deliveryCode,
                    driverId: driverId,
                    driverName: delivery.assignedTo?.name
                },
                createdBy: driverId,
                createdByModel: 'Driver'
            };

            switch (status) {
                case 'assigned':
                    notificationData = {
                        ...notificationData,
                        type: 'delivery_assigned',
                        title: 'Delivery Assigned',
                        message: `Delivery ${delivery.deliveryCode} assigned to ${delivery.assignedTo?.name}`,
                        priority: 'medium',
                        sound: 'assignment'
                    };
                    break;
                case 'picked_up':
                    notificationData = {
                        ...notificationData,
                        type: 'delivery_picked_up',
                        title: 'Delivery Picked Up',
                        message: `${delivery.assignedTo?.name} picked up delivery ${delivery.deliveryCode}`,
                        priority: 'medium',
                        sound: 'pickup'
                    };
                    break;
                case 'delivered':
                    notificationData = {
                        ...notificationData,
                        type: 'delivery_delivered',
                        title: 'Delivery Completed',
                        message: `${delivery.assignedTo?.name} completed delivery ${delivery.deliveryCode}`,
                        priority: 'high',
                        sound: 'success'
                    };
                    break;
                case 'cancelled':
                    notificationData = {
                        ...notificationData,
                        type: 'delivery_cancelled',
                        title: 'Delivery Cancelled',
                        message: `Delivery ${delivery.deliveryCode} was cancelled`,
                        priority: 'high',
                        sound: 'alert'
                    };
                    break;
            }

            return await this.createAdminNotification(notificationData);
        } catch (error) {
            console.error('Error creating delivery status notification:', error);
            throw error;
        }
    }

    /**
     * Driver status change notification
     */
    static async createDriverStatusNotification(driverId, status, reason = null) {
        try {
            const driver = await Driver.findById(driverId);
            if (!driver) throw new Error('Driver not found');

            let notificationData = {
                data: {
                    driverId: driver._id,
                    driverName: driver.name,
                    driverEmail: driver.email,
                    reason: reason
                },
                createdBy: null,
                createdByModel: 'System'
            };

            switch (status) {
                case 'suspended':
                    notificationData = {
                        ...notificationData,
                        type: 'driver_suspended',
                        title: 'Driver Suspended',
                        message: `${driver.name} has been suspended${reason ? `: ${reason}` : ''}`,
                        priority: 'urgent',
                        sound: 'alert'
                    };
                    break;
                case 'activated':
                    notificationData = {
                        ...notificationData,
                        type: 'driver_activated',
                        title: 'Driver Activated',
                        message: `${driver.name} has been activated`,
                        priority: 'medium',
                        sound: 'notification'
                    };
                    break;
                case 'online':
                    notificationData = {
                        ...notificationData,
                        type: 'driver_active',
                        title: 'Driver Active',
                        message: `${driver.name} is now active and online`,
                        priority: 'medium',
                        sound: 'notification'
                    };
                    break;
                case 'offline':
                    notificationData = {
                        ...notificationData,
                        type: 'driver_inactive',
                        title: 'Driver Inactive',
                        message: `${driver.name} is now inactive and offline`,
                        priority: 'medium',
                        sound: 'alert'
                    };
                    break;
                case 'active':
                    notificationData = {
                        ...notificationData,
                        type: 'driver_active',
                        title: 'Driver Activated',
                        message: `${driver.name} is now active`,
                        priority: 'medium',
                        sound: 'notification'
                    };
                    break;
                case 'inactive':
                    notificationData = {
                        ...notificationData,
                        type: 'driver_inactive',
                        title: 'Driver Deactivated',
                        message: `${driver.name} is now inactive`,
                        priority: 'medium',
                        sound: 'alert'
                    };
                    break;
            }

            return await this.createAdminNotification(notificationData);
        } catch (error) {
            console.error('Error creating driver status notification:', error);
            throw error;
        }
    }

    /**
     * System alert notification
     */
    static async createSystemAlert(title, message, priority = 'medium', sound = 'alert') {
        try {
            return await this.createAdminNotification({
                type: 'system_alert',
                title: title,
                message: message,
                priority: priority,
                sound: sound,
                data: {
                    alertType: 'system',
                    timestamp: new Date()
                },
                createdBy: null,
                createdByModel: 'System'
            });
        } catch (error) {
            console.error('Error creating system alert:', error);
            throw error;
        }
    }

    /**
     * Earnings milestone notification
     */
    static async createEarningsMilestoneNotification(driverId, amount, milestone) {
        try {
            const driver = await Driver.findById(driverId);
            if (!driver) throw new Error('Driver not found');

            return await this.createAdminNotification({
                type: 'earnings_milestone',
                title: 'Earnings Milestone',
                message: `${driver.name} reached ${milestone} milestone: ₺${amount}`,
                priority: 'medium',
                sound: 'milestone',
                data: {
                    driverId: driver._id,
                    driverName: driver.name,
                    amount: amount,
                    milestone: milestone
                },
                createdBy: null,
                createdByModel: 'System'
            });
        } catch (error) {
            console.error('Error creating earnings milestone notification:', error);
            throw error;
        }
    }

    /**
     * Rating update notification
     */
    static async createRatingUpdateNotification(driverId, oldRating, newRating) {
        try {
            const driver = await Driver.findById(driverId);
            if (!driver) throw new Error('Driver not found');

            const ratingChange = newRating - oldRating;
            const changeType = ratingChange > 0 ? 'improved' : ratingChange < 0 ? 'declined' : 'unchanged';

            return await this.createAdminNotification({
                type: 'rating_update',
                title: 'Driver Rating Updated',
                message: `${driver.name}'s rating ${changeType}: ${oldRating.toFixed(1)} → ${newRating.toFixed(1)}`,
                priority: 'medium',
                sound: ratingChange > 0 ? 'improvement' : 'decline',
                data: {
                    driverId: driver._id,
                    driverName: driver.name,
                    oldRating: oldRating,
                    newRating: newRating,
                    change: ratingChange
                },
                createdBy: null,
                createdByModel: 'System'
            });
        } catch (error) {
            console.error('Error creating rating update notification:', error);
            throw error;
        }
    }

    /**
     * Payment received notification
     */
    static async createPaymentNotification(deliveryId, amount) {
        try {
            const delivery = await Delivery.findById(deliveryId)
                .populate('assignedTo', 'name');

            if (!delivery) throw new Error('Delivery not found');

            return await this.createAdminNotification({
                type: 'payment_received',
                title: 'Payment Received',
                message: `Payment of ₺${amount} received for delivery ${delivery.deliveryCode}`,
                priority: 'high',
                sound: 'payment',
                data: {
                    deliveryId: delivery._id,
                    deliveryCode: delivery.deliveryCode,
                    amount: amount,
                    driverName: delivery.assignedTo?.name
                },
                createdBy: delivery.assignedTo?._id,
                createdByModel: 'Driver'
            });
        } catch (error) {
            console.error('Error creating payment notification:', error);
            throw error;
        }
    }

    /**
     * Low driver availability alert
     */
    static async createLowAvailabilityAlert(area, availableDrivers) {
        try {
            return await this.createAdminNotification({
                type: 'low_availability',
                title: 'Low Driver Availability',
                message: `Only ${availableDrivers} drivers available in ${area}`,
                priority: 'high',
                sound: 'warning',
                data: {
                    area: area,
                    availableDrivers: availableDrivers,
                    alertType: 'availability'
                },
                createdBy: null,
                createdByModel: 'System'
            });
        } catch (error) {
            console.error('Error creating low availability alert:', error);
            throw error;
        }
    }

    /**
     * Get all admin IDs for notifications
     */
    static async getAdminIds() {
        try {
            const admins = await Admin.find({ isActive: true }).select('_id');
            return admins.map(admin => admin._id);
        } catch (error) {
            console.error('Error getting admin IDs:', error);
            return [];
        }
    }

    /**
     * Get admin notifications with enhanced features
     */
    static async getAdminNotifications(adminId, page = 1, limit = 20) {
        try {
            const notifications = await Notification.getNotifications(adminId, page, limit);
            const total = await Notification.countDocuments({ recipient: adminId });

            return {
                notifications,
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            };
        } catch (error) {
            console.error('Error getting admin notifications:', error);
            throw error;
        }
    }

    /**
     * Get admin notification statistics
     */
    static async getAdminNotificationStats(adminId) {
        try {
            const [
                totalNotifications,
                unreadCount,
                urgentCount,
                todayCount
            ] = await Promise.all([
                Notification.countDocuments({ recipient: adminId }),
                Notification.countDocuments({ recipient: adminId, isRead: false }),
                Notification.countDocuments({ recipient: adminId, priority: 'urgent', isRead: false }),
                Notification.countDocuments({
                    recipient: adminId,
                    createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
                })
            ]);

            return {
                total: totalNotifications,
                unread: unreadCount,
                urgent: urgentCount,
                today: todayCount
            };
        } catch (error) {
            console.error('Error getting admin notification stats:', error);
            throw error;
        }
    }
}

module.exports = AdminNotificationService; 