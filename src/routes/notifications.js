const express = require('express');
const router = express.Router();
const NotificationController = require('../controllers/notificationController');
const NotificationService = require('../services/notificationService');
const { authenticateToken, adminOnly, driverOnly } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');

// Get user's notifications
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const userId = req.user.id;

        const result = await NotificationService.getUserNotifications(userId, parseInt(page), parseInt(limit));

        res.json({
            success: true,
            data: result,
            message: 'Notifications retrieved successfully'
        });
    } catch (error) {
        console.error('Error getting notifications:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get notifications'
        });
    }
});

// Get unread notifications count
router.get('/unread-count', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const count = await NotificationService.getUnreadCount(userId);

        res.json({
            success: true,
            data: { unreadCount: count },
            message: 'Unread count retrieved successfully'
        });
    } catch (error) {
        console.error('Error getting unread count:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get unread count'
        });
    }
});

// Mark notification as read
router.put('/:notificationId/read', authenticateToken, async (req, res) => {
    try {
        const { notificationId } = req.params;
        const userId = req.user.id;

        const notification = await NotificationService.markAsRead(notificationId, userId);

        if (!notification) {
            return res.status(404).json({
                success: false,
                error: 'Notification not found'
            });
        }

        res.json({
            success: true,
            data: notification,
            message: 'Notification marked as read'
        });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to mark notification as read'
        });
    }
});

// Mark all notifications as read
router.put('/mark-all-read', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        await NotificationController.markAllAsRead(req, res);
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to mark all notifications as read'
        });
    }
});

// Send message from admin to driver
router.post('/admin/send-message', authenticateToken, adminOnly, validate(schemas.sendMessage), async (req, res) => {
    try {
        const { driverId, message } = req.body;
        const adminId = req.user.id;

        await NotificationService.sendAdminMessage(driverId, message, adminId);

        res.json({
            success: true,
            message: 'Message sent successfully',
            data: {
                driverId,
                message,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error sending admin message:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send message'
        });
    }
});

// Send message from driver to admin
router.post('/driver/send-message', authenticateToken, driverOnly, validate(schemas.sendMessage), async (req, res) => {
    try {
        const { adminId, message } = req.body;
        const driverId = req.user.id;

        await NotificationService.sendDriverMessage(adminId, message, driverId);

        res.json({
            success: true,
            message: 'Message sent successfully',
            data: {
                adminId,
                message,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error sending driver message:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send message'
        });
    }
});

// Send emergency alert from driver
router.post('/emergency-alert', authenticateToken, driverOnly, validate(schemas.emergencyAlert), async (req, res) => {
    try {
        const { message, location } = req.body;
        const driverId = req.user.id;

        await NotificationService.sendEmergencyAlert(driverId, message, location);

        res.json({
            success: true,
            message: 'Emergency alert sent successfully',
            data: {
                message,
                location,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error sending emergency alert:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send emergency alert'
        });
    }
});

// Send system notification (admin only)
router.post('/system', authenticateToken, adminOnly, validate(schemas.systemNotification), async (req, res) => {
    try {
        const { recipients, type, title, message, data } = req.body;

        const notifications = await NotificationService.sendSystemNotification(recipients, type, title, message, data);

        res.json({
            success: true,
            message: 'System notification sent successfully',
            data: {
                notificationsCount: notifications.length,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error sending system notification:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send system notification'
        });
    }
});

// Delete notification
router.delete('/:notificationId', authenticateToken, async (req, res) => {
    try {
        await NotificationController.deleteNotification(req, res);
    } catch (error) {
        console.error('Error deleting notification:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete notification'
        });
    }
});

// Get notification statistics
router.get('/stats', authenticateToken, async (req, res) => {
    try {
        await NotificationController.getNotificationStats(req, res);
    } catch (error) {
        console.error('Error getting notification stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get notification statistics'
        });
    }
});

module.exports = router; 