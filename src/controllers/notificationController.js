const NotificationService = require('../services/notificationService');
const Notification = require('../models/Notification');
const { catchAsync, successResponse, errorResponse } = require('../middleware/errorHandler');

class NotificationController {
    // Get notifications for current user
    static getNotifications = catchAsync(async (req, res) => {
        const { user } = req;
        const { page = 1, limit = 20 } = req.query;

        try {
            const result = await NotificationService.getUserNotifications(user.id, parseInt(page), parseInt(limit));

            successResponse(res, result, 'Notifications retrieved successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Get unread count for current user
    static getUnreadCount = catchAsync(async (req, res) => {
        const { user } = req;

        try {
            const count = await NotificationService.getUnreadCount(user.id);

            successResponse(res, { unreadCount: count }, 'Unread count retrieved successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Mark notification as read
    static markAsRead = catchAsync(async (req, res) => {
        const { user } = req;
        const { notificationId } = req.params;

        try {
            const notification = await NotificationService.markAsRead(notificationId, user.id);

            if (!notification) {
                return res.status(404).json({
                    success: false,
                    error: 'Notification not found'
                });
            }

            successResponse(res, notification, 'Notification marked as read');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Mark all notifications as read
    static markAllAsRead = catchAsync(async (req, res) => {
        const { user } = req;

        try {
            const result = await NotificationService.markAllAsRead(user.id);

            successResponse(res, {
                updatedCount: result.modifiedCount
            }, 'All notifications marked as read');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Delete notification (admin only)
    static deleteNotification = catchAsync(async (req, res) => {
        const { notificationId } = req.params;
        const { user } = req;

        try {
            // Only admins can delete notifications
            if (user.userType !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: 'Admin access required'
                });
            }

            const notification = await Notification.findByIdAndDelete(notificationId);

            if (!notification) {
                return res.status(404).json({
                    success: false,
                    error: 'Notification not found'
                });
            }

            successResponse(res, null, 'Notification deleted successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Create system notification (admin only)
    static createSystemNotification = catchAsync(async (req, res) => {
        const { user } = req;
        const { recipients, title, message, priority = 'medium' } = req.body;

        try {
            // Only admins can create system notifications
            if (user.userType !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: 'Admin access required'
                });
            }

            const notifications = await NotificationService.createSystemAlert(recipients, title, message, priority);

            successResponse(res, {
                createdCount: notifications.length
            }, 'System notifications created successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Get notification statistics (admin only)
    static getNotificationStats = catchAsync(async (req, res) => {
        const { user } = req;

        try {
            // Only admins can view notification statistics
            if (user.userType !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: 'Admin access required'
                });
            }

            const [
                totalNotifications,
                unreadNotifications,
                todayNotifications,
                driverNotifications,
                adminNotifications
            ] = await Promise.all([
                Notification.countDocuments(),
                Notification.countDocuments({ isRead: false }),
                Notification.countDocuments({
                    createdAt: {
                        $gte: new Date(new Date().setHours(0, 0, 0, 0))
                    }
                }),
                Notification.countDocuments({ recipientModel: 'Driver' }),
                Notification.countDocuments({ recipientModel: 'Admin' })
            ]);

            successResponse(res, {
                total: totalNotifications,
                unread: unreadNotifications,
                today: todayNotifications,
                byType: {
                    driver: driverNotifications,
                    admin: adminNotifications
                }
            }, 'Notification statistics retrieved successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });
}

module.exports = NotificationController; 