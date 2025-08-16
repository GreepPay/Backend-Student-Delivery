const express = require('express');
const router = express.Router();
const SocketService = require('../services/socketService');
const { authenticateToken } = require('../middleware/auth');

// Test socket connection status
router.get('/status', authenticateToken, (req, res) => {
    try {
        const status = SocketService.getStatus();
        res.json({
            success: true,
            data: status,
            message: 'Socket service status retrieved successfully'
        });
    } catch (error) {
        console.error('Error getting socket status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get socket status'
        });
    }
});

// Test sending notification to specific user
router.post('/test-notification', authenticateToken, (req, res) => {
    try {
        const { recipientId, recipientType, message } = req.body;

        if (!recipientId || !recipientType || !message) {
            return res.status(400).json({
                success: false,
                error: 'recipientId, recipientType, and message are required'
            });
        }

        // Send test notification
        SocketService.emitNewNotification({
            recipient: recipientId,
            recipientModel: recipientType === 'driver' ? 'Driver' : 'Admin',
            type: 'test-notification',
            title: 'Test Notification',
            message: message,
            data: {
                test: true,
                timestamp: new Date().toISOString()
            }
        });

        res.json({
            success: true,
            message: 'Test notification sent successfully',
            data: {
                recipientId,
                recipientType,
                message,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error sending test notification:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send test notification'
        });
    }
});

// Test broadcast to all drivers
router.post('/test-broadcast', authenticateToken, (req, res) => {
    try {
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({
                success: false,
                error: 'message is required'
            });
        }

        // Send test broadcast to all drivers
        SocketService.emitNewNotification({
            recipient: null,
            recipientModel: 'Driver',
            type: 'test-broadcast',
            title: 'Test Broadcast',
            message: message,
            data: {
                test: true,
                broadcast: true,
                timestamp: new Date().toISOString()
            }
        });

        res.json({
            success: true,
            message: 'Test broadcast sent successfully',
            data: {
                message,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error sending test broadcast:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send test broadcast'
        });
    }
});

// Test emergency alert
router.post('/test-emergency-alert', authenticateToken, (req, res) => {
    try {
        const { driverId, message, location } = req.body;

        if (!driverId || !message) {
            return res.status(400).json({
                success: false,
                error: 'driverId and message are required'
            });
        }

        // Simulate emergency alert via socket
        if (SocketService.isAvailable()) {
            SocketService.io.to('admin-room').emit('emergency-alert', {
                driverId,
                message,
                location: location || null,
                timestamp: new Date().toISOString()
            });

            console.log(`🚨 Test emergency alert sent for driver ${driverId}`);
        }

        res.json({
            success: true,
            message: 'Test emergency alert sent successfully',
            data: {
                driverId,
                message,
                location,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error sending test emergency alert:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send test emergency alert'
        });
    }
});

// Get connected users
router.get('/connected-users', authenticateToken, (req, res) => {
    try {
        const status = SocketService.getStatus();
        res.json({
            success: true,
            data: {
                totalUsers: status.connectedUsers,
                admins: status.connectedAdmins,
                drivers: status.connectedDrivers,
                isAvailable: status.isAvailable
            },
            message: 'Connected users retrieved successfully'
        });
    } catch (error) {
        console.error('Error getting connected users:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get connected users'
        });
    }
});

module.exports = router;
