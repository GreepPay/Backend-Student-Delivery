const Notification = require('../models/Notification');
const Driver = require('../models/Driver');
const Admin = require('../models/Admin');
const Delivery = require('../models/Delivery');
const socketService = require('./socketService');

class NotificationService {
    // Create a new notification
    static async createNotification(data) {
        try {
            const notification = await Notification.createNotification(data);

            // Emit socket event for real-time notification
            socketService.emitNewNotification(notification);

            return notification;
        } catch (error) {
            console.error('Error creating notification:', error);
            throw error;
        }
    }

    // Create delivery assigned notification
    static async createDeliveryAssignedNotification(deliveryId, driverId) {
        try {
            console.log(`🔔 Creating delivery assigned notification for delivery ${deliveryId} to driver ${driverId}`);

            const delivery = await Delivery.findById(deliveryId)
                .populate('assignedBy', 'name')
                .populate('assignedTo', 'name');

            if (!delivery) {
                throw new Error('Delivery not found');
            }

            console.log(`📦 Found delivery: ${delivery.deliveryCode}`);

            const notification = await this.createNotification({
                recipient: driverId,
                recipientModel: 'Driver',
                type: 'delivery_assigned',
                title: 'New Delivery Assigned',
                message: `You have been assigned a new delivery: ${delivery.deliveryCode}`,
                data: {
                    deliveryId: delivery._id,
                    deliveryCode: delivery.deliveryCode,
                    pickupLocation: delivery.pickupLocation,
                    deliveryLocation: delivery.deliveryLocation,
                    fee: delivery.fee,
                    assignedBy: delivery.assignedBy?.name || 'Admin'
                },
                priority: 'high',
                createdBy: delivery.assignedBy?._id,
                createdByModel: 'Admin'
            });

            console.log(`✅ Delivery assigned notification created: ${notification._id}`);
            return notification;
        } catch (error) {
            console.error('Error creating delivery assigned notification:', error);
            throw error;
        }
    }

    // Create delivery status update notification
    static async createDeliveryStatusNotification(deliveryId, status, driverId) {
        try {
            const delivery = await Delivery.findById(deliveryId)
                .populate('assignedTo', 'name');

            if (!delivery) {
                throw new Error('Delivery not found');
            }

            let notificationData = {
                recipient: driverId,
                recipientModel: 'Driver',
                data: {
                    deliveryId: delivery._id,
                    deliveryCode: delivery.deliveryCode
                },
                createdBy: delivery.assignedTo?._id,
                createdByModel: 'Driver'
            };

            switch (status) {
                case 'picked_up':
                    notificationData = {
                        ...notificationData,
                        type: 'delivery_picked_up',
                        title: 'Delivery Picked Up',
                        message: `Delivery ${delivery.deliveryCode} has been picked up`,
                        priority: 'medium'
                    };
                    break;
                case 'delivered':
                    notificationData = {
                        ...notificationData,
                        type: 'delivery_delivered',
                        title: 'Delivery Completed',
                        message: `Delivery ${delivery.deliveryCode} has been completed successfully`,
                        priority: 'high'
                    };
                    break;
                case 'cancelled':
                    notificationData = {
                        ...notificationData,
                        type: 'delivery_cancelled',
                        title: 'Delivery Cancelled',
                        message: `Delivery ${delivery.deliveryCode} has been cancelled`,
                        priority: 'medium'
                    };
                    break;
            }

            const notification = await this.createNotification(notificationData);
            return notification;
        } catch (error) {
            console.error('Error creating delivery status notification:', error);
            throw error;
        }
    }

    // Create payment received notification
    static async createPaymentNotification(deliveryId, driverId, amount) {
        try {
            const delivery = await Delivery.findById(deliveryId);

            if (!delivery) {
                throw new Error('Delivery not found');
            }

            const notification = await this.createNotification({
                recipient: driverId,
                recipientModel: 'Driver',
                type: 'payment_received',
                title: 'Payment Received',
                message: `You received ₺${amount} for delivery ${delivery.deliveryCode}`,
                data: {
                    deliveryId: delivery._id,
                    deliveryCode: delivery.deliveryCode,
                    amount: amount
                },
                priority: 'high',
                createdBy: delivery.assignedBy,
                createdByModel: 'Admin'
            });

            return notification;
        } catch (error) {
            console.error('Error creating payment notification:', error);
            throw error;
        }
    }

    // Create account status notification
    static async createAccountStatusNotification(userId, userType, status, reason = null) {
        try {
            const notificationData = {
                recipient: userId,
                recipientModel: userType === 'driver' ? 'Driver' : 'Admin',
                data: {
                    reason: reason
                },
                createdBy: null,
                createdByModel: 'System'
            };

            if (status === 'suspended') {
                notificationData.type = 'account_suspended';
                notificationData.title = 'Account Suspended';
                notificationData.message = `Your account has been suspended${reason ? `: ${reason}` : ''}`;
                notificationData.priority = 'urgent';
            } else if (status === 'activated') {
                notificationData.type = 'account_activated';
                notificationData.title = 'Account Activated';
                notificationData.message = 'Your account has been activated';
                notificationData.priority = 'high';
            }

            const notification = await this.createNotification(notificationData);
            return notification;
        } catch (error) {
            console.error('Error creating account status notification:', error);
            throw error;
        }
    }

    // Create earnings update notification
    static async createEarningsNotification(driverId, amount, period) {
        try {
            const notification = await this.createNotification({
                recipient: driverId,
                recipientModel: 'Driver',
                type: 'earnings_update',
                title: 'Earnings Update',
                message: `You earned ₺${amount} this ${period}`,
                data: {
                    amount: amount,
                    period: period
                },
                priority: 'medium',
                createdBy: null,
                createdByModel: 'System'
            });

            return notification;
        } catch (error) {
            console.error('Error creating earnings notification:', error);
            throw error;
        }
    }

    // Create system alert notification
    static async createSystemAlert(recipients, title, message, priority = 'medium') {
        try {
            const notifications = [];

            for (const recipient of recipients) {
                const notification = await this.createNotification({
                    recipient: recipient.id,
                    recipientModel: recipient.type === 'driver' ? 'Driver' : 'Admin',
                    type: 'system_alert',
                    title: title,
                    message: message,
                    priority: priority,
                    createdBy: null,
                    createdByModel: 'System'
                });
                notifications.push(notification);
            }

            return notifications;
        } catch (error) {
            console.error('Error creating system alert:', error);
            throw error;
        }
    }

    // Get notifications for a user
    static async getNotifications(userId, page = 1, limit = 20) {
        try {
            const notifications = await Notification.getNotifications(userId, page, limit);
            const total = await Notification.countDocuments({ recipient: userId });

            return {
                notifications,
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            };
        } catch (error) {
            console.error('Error getting notifications:', error);
            throw error;
        }
    }

    // Get unread count for a user
    static async getUnreadCount(userId) {
        try {
            return await Notification.getUnreadCount(userId);
        } catch (error) {
            console.error('Error getting unread count:', error);
            throw error;
        }
    }

    // Mark notification as read
    static async markAsRead(notificationId, userId) {
        try {
            const notification = await Notification.markAsRead(notificationId, userId);

            // Emit socket event for real-time update
            if (notification) {
                socketService.emitNotificationUpdate(notification);
            }

            return notification;
        } catch (error) {
            console.error('Error marking notification as read:', error);
            throw error;
        }
    }

    // Mark all notifications as read
    static async markAllAsRead(userId) {
        try {
            return await Notification.markAllAsRead(userId);
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
            throw error;
        }
    }

    // Delete expired notifications
    static async cleanupExpiredNotifications() {
        try {
            const result = await Notification.deleteMany({
                expiresAt: { $lt: new Date() }
            });
            return result;
        } catch (error) {
            console.error('Error cleaning up expired notifications:', error);
            throw error;
        }
    }

    // Send document status notification to driver
    static async sendDocumentStatusNotification(driverId, documentType, status, rejectionReason = null) {
        try {
            const documentTypeLabels = {
                studentId: 'Student ID',
                profilePhoto: 'Profile Photo',
                universityEnrollment: 'University Enrollment',
                identityCard: 'Identity Card',
                transportationLicense: 'Transportation License'
            };

            const documentLabel = documentTypeLabels[documentType] || documentType;

            let title, message;

            if (status === 'verified') {
                title = 'Document Verified Successfully';
                message = `Your ${documentLabel} has been verified and approved. You can now continue with your delivery activities.`;
            } else if (status === 'rejected') {
                title = 'Document Verification Failed';
                message = `Your ${documentLabel} was not approved. Reason: ${rejectionReason || 'Document does not meet requirements'}. Please upload a new document.`;
            } else if (status === 'ai_processing') {
                title = 'Document Under AI Review';
                message = `Your ${documentLabel} is currently being reviewed by our AI verification system. This process usually takes a few minutes.`;
            } else {
                title = 'Document Status Updated';
                message = `Your ${documentLabel} status has been updated to: ${status}`;
            }

            const notification = await this.createNotification({
                recipient: driverId,
                recipientModel: 'Driver',
                type: 'document_status',
                title: title,
                message: message,
                priority: status === 'rejected' ? 'high' : 'medium',
                createdBy: null,
                createdByModel: 'System',
                metadata: {
                    documentType,
                    status,
                    rejectionReason
                }
            });

            // Emit socket event for real-time notification
            const socketService = require('./socketService');
            socketService.emitNotificationUpdate(notification);

            console.log(`📧 Document status notification sent to driver ${driverId}: ${status}`);

            return notification;
        } catch (error) {
            console.error('Error sending document status notification:', error);
            // Don't throw error to avoid breaking the main flow
            return null;
        }
    }
}

module.exports = NotificationService; 