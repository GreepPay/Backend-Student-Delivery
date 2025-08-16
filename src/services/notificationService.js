const Notification = require('../models/Notification');
const Driver = require('../models/Driver');
const Admin = require('../models/Admin');
const SocketService = require('./socketService');

class NotificationService {
    // Create notification and emit via socket
    static async createAndEmitNotification(notificationData) {
        try {
            // Create notification in database
            const notification = new Notification(notificationData);
            await notification.save();

            // Emit via socket for real-time delivery
            SocketService.emitNewNotification({
                recipient: notificationData.recipient,
                recipientModel: notificationData.recipientModel,
                type: notificationData.type,
                title: notificationData.title,
                message: notificationData.message,
                data: {
                    ...notificationData.data,
                    notificationId: notification._id,
                    createdAt: notification.createdAt
                }
            });

            console.log(`📨 Notification created and emitted: ${notificationData.type} for ${notificationData.recipientModel}`);

            return notification;
        } catch (error) {
            console.error('❌ Error creating and emitting notification:', error);
            throw error;
        }
    }

    // Send delivery notification to eligible drivers
    static async sendDeliveryNotification(delivery, eligibleDrivers) {
        try {
            const notifications = [];

            for (const driver of eligibleDrivers) {
                const notificationData = {
                    recipient: driver._id,
                    recipientModel: 'Driver',
                    type: 'delivery_assigned',
                    title: 'New Delivery Available',
                    message: `New delivery from ${delivery.pickupLocation} to ${delivery.deliveryLocation}`,
                    data: {
                        deliveryId: delivery._id,
                        deliveryCode: delivery.deliveryCode,
                        pickupLocation: delivery.pickupLocation,
                        deliveryLocation: delivery.deliveryLocation,
                        fee: delivery.fee,
                        estimatedTime: delivery.estimatedTime,
                        priority: delivery.priority,
                        broadcastEndTime: delivery.broadcastEndTime,
                        driverEarning: delivery.driverEarning,
                        companyEarning: delivery.companyEarning
                    },
                    priority: 'high'
                };

                const notification = await this.createAndEmitNotification(notificationData);
                notifications.push(notification);
            }

            // Also notify admin about the broadcast
            await this.createAndEmitNotification({
                recipient: delivery.createdBy,
                recipientModel: 'Admin',
                type: 'system_alert',
                title: 'Delivery Broadcast Started',
                message: `Broadcast started for delivery ${delivery.deliveryCode} to ${eligibleDrivers.length} drivers`,
                data: {
                    deliveryId: delivery._id,
                    deliveryCode: delivery.deliveryCode,
                    eligibleDriversCount: eligibleDrivers.length,
                    broadcastEndTime: delivery.broadcastEndTime
                }
            });

            console.log(`📢 Delivery notifications sent to ${notifications.length} drivers`);
            return notifications;
        } catch (error) {
            console.error('❌ Error sending delivery notifications:', error);
            throw error;
        }
    }

    // Send delivery status update notifications
    static async sendDeliveryStatusNotification(delivery, status, driver = null) {
        try {
            const statusMessages = {
                'accepted': 'Delivery accepted by driver',
                'picked_up': 'Delivery picked up by driver',
                'in_transit': 'Delivery in transit',
                'delivered': 'Delivery completed successfully',
                'cancelled': 'Delivery cancelled',
                'failed': 'Delivery failed'
            };

            const message = statusMessages[status] || `Delivery status updated to ${status}`;

            // Notify admin
            await this.createAndEmitNotification({
                recipient: delivery.createdBy,
                recipientModel: 'Admin',
                type: 'delivery-status-update',
                title: 'Delivery Status Update',
                message: `${message} - ${delivery.deliveryCode}`,
                data: {
                    deliveryId: delivery._id,
                    deliveryCode: delivery.deliveryCode,
                    status: status,
                    driverId: driver?._id,
                    driverName: driver?.name,
                    updatedAt: new Date()
                }
            });

            // Notify driver if assigned
            if (driver && delivery.assignedTo) {
                await this.createAndEmitNotification({
                    recipient: delivery.assignedTo,
                    recipientModel: 'Driver',
                    type: 'delivery-status-update',
                    title: 'Delivery Status Updated',
                    message: `Your delivery ${delivery.deliveryCode} status: ${status}`,
                    data: {
                        deliveryId: delivery._id,
                        deliveryCode: delivery.deliveryCode,
                        status: status,
                        updatedAt: new Date()
                    }
                });
            }

            console.log(`📊 Delivery status notification sent for ${delivery.deliveryCode}`);
        } catch (error) {
            console.error('❌ Error sending delivery status notification:', error);
            throw error;
        }
    }

    // Send admin message to driver
    static async sendAdminMessage(driverId, message, adminId) {
        try {
            const driver = await Driver.findById(driverId);
            const admin = await Admin.findById(adminId);

            if (!driver || !admin) {
                throw new Error('Driver or Admin not found');
            }

            await this.createAndEmitNotification({
                recipient: driverId,
                recipientModel: 'Driver',
                type: 'admin-message',
                title: 'Message from Admin',
                message: message,
                data: {
                    adminId: adminId,
                    adminName: admin.name,
                    timestamp: new Date()
                },
                priority: 'high'
            });

            console.log(`💬 Admin message sent to driver ${driver.name}`);
        } catch (error) {
            console.error('❌ Error sending admin message:', error);
            throw error;
        }
    }

    // Send driver message to admin
    static async sendDriverMessage(adminId, message, driverId) {
        try {
            const driver = await Driver.findById(driverId);
            const admin = await Admin.findById(adminId);

            if (!driver || !admin) {
                throw new Error('Driver or Admin not found');
            }

            await this.createAndEmitNotification({
                recipient: adminId,
                recipientModel: 'Admin',
                type: 'driver-message',
                title: `Message from ${driver.name}`,
                message: message,
                data: {
                    driverId: driverId,
                    driverName: driver.name,
                    driverArea: driver.area,
                    timestamp: new Date()
                },
                priority: 'high'
            });

            console.log(`💬 Driver message sent to admin ${admin.name}`);
        } catch (error) {
            console.error('❌ Error sending driver message:', error);
            throw error;
        }
    }

    // Send emergency alert
    static async sendEmergencyAlert(driverId, message, location = null) {
        try {
            const driver = await Driver.findById(driverId);
            if (!driver) {
                throw new Error('Driver not found');
            }

            // Get all admins
            const admins = await Admin.find({ isActive: true });

            for (const admin of admins) {
                await this.createAndEmitNotification({
                    recipient: admin._id,
                    recipientModel: 'Admin',
                    type: 'emergency-alert',
                    title: '🚨 Emergency Alert',
                    message: `Emergency alert from ${driver.name}: ${message}`,
                    data: {
                        driverId: driverId,
                        driverName: driver.name,
                        driverPhone: driver.phone,
                        driverArea: driver.area,
                        message: message,
                        location: location,
                        timestamp: new Date()
                    },
                    priority: 'urgent'
                });
            }

            console.log(`🚨 Emergency alert sent to ${admins.length} admins`);
        } catch (error) {
            console.error('❌ Error sending emergency alert:', error);
            throw error;
        }
    }

    // Send system notifications
    static async sendSystemNotification(recipients, type, title, message, data = {}) {
        try {
            const notifications = [];

            for (const recipient of recipients) {
                const notification = await this.createAndEmitNotification({
                    recipient: recipient._id,
                    recipientModel: recipient.userType === 'admin' ? 'Admin' : 'Driver',
                    type: type,
                    title: title,
                    message: message,
                    data: {
                        ...data,
                        timestamp: new Date()
                    }
                });

                notifications.push(notification);
            }

            console.log(`🔔 System notification sent to ${notifications.length} recipients`);
            return notifications;
        } catch (error) {
            console.error('❌ Error sending system notification:', error);
            throw error;
        }
    }

    // Mark notification as read
    static async markAsRead(notificationId, userId) {
        try {
            const notification = await Notification.findOneAndUpdate(
                { _id: notificationId, recipient: userId },
                { isRead: true, readAt: new Date() },
                { new: true }
            );

            if (notification) {
                // Emit read status update
                SocketService.emitNotificationUpdate({
                    recipient: userId,
                    recipientModel: notification.recipientModel,
                    type: 'notification-read',
                    data: {
                        notificationId: notification._id,
                        isRead: true,
                        readAt: notification.readAt
                    }
                });
            }

            return notification;
        } catch (error) {
            console.error('❌ Error marking notification as read:', error);
            throw error;
        }
    }

    // Get unread notifications count
    static async getUnreadCount(userId) {
        try {
            const count = await Notification.countDocuments({
                recipient: userId,
                isRead: false
            });

            return count;
        } catch (error) {
            console.error('❌ Error getting unread count:', error);
            throw error;
        }
    }

    // Get notifications for user
    static async getUserNotifications(userId, page = 1, limit = 20) {
        try {
            const skip = (page - 1) * limit;

            const notifications = await Notification.find({ recipient: userId })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit);

            const total = await Notification.countDocuments({ recipient: userId });

            return {
                notifications,
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            };
        } catch (error) {
            console.error('❌ Error getting user notifications:', error);
            throw error;
        }
    }

    // Mark all notifications as read
    static async markAllAsRead(userId) {
        try {
            const result = await Notification.updateMany(
                { recipient: userId, isRead: false },
                { isRead: true, readAt: new Date() }
            );

            console.log(`✅ Marked ${result.modifiedCount} notifications as read for user ${userId}`);
            return result;
        } catch (error) {
            console.error('❌ Error marking all notifications as read:', error);
            throw error;
        }
    }

    // Create system alert (legacy method for backward compatibility)
    static async createSystemAlert(recipients, title, message, priority = 'medium') {
        try {
            return await this.sendSystemNotification(recipients, 'system_alert', title, message, { priority });
        } catch (error) {
            console.error('❌ Error creating system alert:', error);
            throw error;
        }
    }
}

module.exports = NotificationService; 