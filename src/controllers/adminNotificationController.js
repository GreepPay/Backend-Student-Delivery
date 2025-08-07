const AdminNotificationService = require('../services/adminNotificationService');
const Notification = require('../models/Notification');

class AdminNotificationController {
    /**
     * Get admin notifications
     */
    static async getAdminNotifications(req, res) {
        try {
            const { page = 1, limit = 20 } = req.query;
            const adminId = req.user.id;

            const result = await AdminNotificationService.getAdminNotifications(adminId, parseInt(page), parseInt(limit));

            res.json({
                success: true,
                data: result
            });
        } catch (error) {
            console.error('Error getting admin notifications:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Get admin notification statistics
     */
    static async getAdminNotificationStats(req, res) {
        try {
            const adminId = req.user.id;
            const stats = await AdminNotificationService.getAdminNotificationStats(adminId);

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            console.error('Error getting admin notification stats:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Mark notification as read
     */
    static async markAsRead(req, res) {
        try {
            const { notificationId } = req.params;
            const adminId = req.user.id;

            const notification = await Notification.markAsRead(notificationId, adminId);

            if (!notification) {
                return res.status(404).json({
                    success: false,
                    error: 'Notification not found'
                });
            }

            res.json({
                success: true,
                data: notification
            });
        } catch (error) {
            console.error('Error marking notification as read:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Mark all notifications as read
     */
    static async markAllAsRead(req, res) {
        try {
            const adminId = req.user.id;
            await Notification.markAllAsRead(adminId);

            res.json({
                success: true,
                message: 'All notifications marked as read'
            });
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Delete notification
     */
    static async deleteNotification(req, res) {
        try {
            const { notificationId } = req.params;
            const adminId = req.user.id;

            const notification = await Notification.findOneAndDelete({
                _id: notificationId,
                recipient: adminId
            });

            if (!notification) {
                return res.status(404).json({
                    success: false,
                    error: 'Notification not found'
                });
            }

            res.json({
                success: true,
                message: 'Notification deleted successfully'
            });
        } catch (error) {
            console.error('Error deleting notification:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }


}

module.exports = AdminNotificationController; 