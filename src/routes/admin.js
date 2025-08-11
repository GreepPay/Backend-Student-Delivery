const express = require('express');
const Joi = require('joi');
const AdminController = require('../controllers/adminController');
const DriverController = require('../controllers/driverController');
const DeliveryController = require('../controllers/deliveryController');
const NotificationController = require('../controllers/notificationController');
const AdminNotificationController = require('../controllers/adminNotificationController');
const {
    authenticateToken,
    adminOnly,
    adminOrSuperAdmin,
    superAdminOnly,
    requirePermission
} = require('../middleware/auth');
const {
    validate,
    validateQuery,
    validateParams,
    sanitizeInput,
    validateBatchOperation,
    schemas,
    paramSchemas
} = require('../middleware/validation');

const router = express.Router();

// Apply middleware to all admin routes
router.use(authenticateToken);
router.use(adminOrSuperAdmin);
router.use(sanitizeInput);

// Dashboard and overview
router.get('/dashboard',
    validateQuery(schemas.analyticsQuery),
    AdminController.getDashboard
);

// Dashboard sub-endpoints for frontend compatibility
router.get('/dashboard/recent-deliveries',
    AdminController.getRecentDeliveries
);

router.get('/dashboard/top-drivers',
    AdminController.getTopDrivers
);

router.get('/dashboard/driver-status',
    AdminController.getDriverStatus
);

router.get('/stats',
    requirePermission('view_analytics'),
    validateQuery(schemas.analyticsQuery),
    AdminController.getSystemStats
);

// Analytics endpoint for detailed analytics page
router.get('/analytics',
    requirePermission('view_analytics'),
    validateQuery(schemas.analyticsQuery),
    AdminController.getAnalytics
);

// Admin management (super admin only)
router.get('/admins',
    superAdminOnly,
    validateQuery(schemas.pagination),
    AdminController.getAdmins
);

router.post('/admins',
    superAdminOnly,
    validate(schemas.createAdmin),
    AdminController.createAdmin
);

router.put('/admins/:id',
    superAdminOnly,
    validateParams(paramSchemas.mongoId),
    validate(schemas.updateAdmin),
    AdminController.updateAdmin
);

router.delete('/admins/:id',
    superAdminOnly,
    validateParams(paramSchemas.mongoId),
    AdminController.deleteAdmin
);

// Test email templates (for debugging)
router.post('/test-email',
    superAdminOnly,
    (req, res) => {
        const { email, name, type } = req.body;

        if (!email || !name || !type) {
            return res.status(400).json({
                success: false,
                error: 'Email, name, and type are required'
            });
        }

        const EmailService = require('../services/emailService');

        if (type === 'admin') {
            EmailService.sendAdminInvitation(email, name, 'Test Super Admin')
                .then(() => {
                    res.json({ success: true, message: 'Admin test email sent' });
                })
                .catch(error => {
                    res.status(500).json({ success: false, error: error.message });
                });
        } else if (type === 'driver') {
            EmailService.sendDriverInvitation(email, name, 'Test Super Admin')
                .then(() => {
                    res.json({ success: true, message: 'Driver test email sent' });
                })
                .catch(error => {
                    res.status(500).json({ success: false, error: error.message });
                });
        } else {
            res.status(400).json({ success: false, error: 'Invalid type. Use "admin" or "driver"' });
        }
    }
);

// Driver management
router.get('/drivers',
    requirePermission('manage_drivers'),
    validateQuery(schemas.pagination.concat(schemas.driverFilters)),
    DriverController.getDrivers
);

// Driver invitation system
router.post('/drivers/invite',
    requirePermission('manage_drivers'),
    validate(Joi.object({
        name: Joi.string().required().min(2).max(50),
        email: Joi.string().email().required()
    })),
    AdminController.inviteDriver
);

router.get('/drivers/invitations',
    requirePermission('manage_drivers'),
    validateQuery(schemas.pagination),
    AdminController.getPendingInvitations
);

router.post('/drivers/invitations/:invitationId/cancel',
    requirePermission('manage_drivers'),
    validateParams(Joi.object({
        invitationId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required()
    })),
    AdminController.cancelInvitation
);

router.post('/drivers/invitations/:invitationId/resend',
    requirePermission('manage_drivers'),
    validateParams(Joi.object({
        invitationId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required()
    })),
    AdminController.resendInvitation
);

router.get('/drivers/:id',
    requirePermission('manage_drivers'),
    validateParams(paramSchemas.mongoId),
    DriverController.getDriver
);

router.post('/drivers',
    requirePermission('manage_drivers'),
    validate(schemas.createDriver),
    DriverController.addDriver
);

router.put('/drivers/:id',
    requirePermission('manage_drivers'),
    validateParams(paramSchemas.mongoId),
    validate(schemas.updateDriver),
    DriverController.updateDriver
);

router.post('/drivers/:id/suspend',
    requirePermission('manage_drivers'),
    validateParams(paramSchemas.mongoId),
    DriverController.suspendDriver
);

router.post('/drivers/:id/unsuspend',
    requirePermission('manage_drivers'),
    validateParams(paramSchemas.mongoId),
    DriverController.unsuspendDriver
);

router.put('/drivers/:id/verification',
    requirePermission('manage_drivers'),
    validateParams(paramSchemas.mongoId),
    validate(schemas.updateDriverVerification),
    DriverController.updateVerificationStatus
);

// Drivers status overview
router.get('/drivers/status',
    requirePermission('manage_drivers'),
    DriverController.getDriversStatus
);

// Document verification management
router.get('/drivers/:driverId/status',
    requirePermission('manage_drivers'),
    validateParams(paramSchemas.driverId),
    DriverController.getAccountStatus
);

router.put('/drivers/:driverId/documents/:documentType',
    requirePermission('manage_drivers'),
    validateParams(Joi.object({
        driverId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
        documentType: Joi.string().valid('studentId', 'profilePhoto', 'universityEnrollment', 'identityCard', 'transportationLicense').required()
    })),
    validate(Joi.object({
        status: Joi.string().valid('pending', 'verified', 'rejected').required(),
        rejectionReason: Joi.string().when('status', {
            is: 'rejected',
            then: Joi.required(),
            otherwise: Joi.optional()
        })
    })),
    DriverController.updateDocumentStatus
);

router.delete('/drivers/:id',
    requirePermission('manage_drivers'),
    validateParams(paramSchemas.mongoId),
    DriverController.deleteDriver
);

// Driver analytics and performance
router.get('/drivers/:driverId/analytics',
    requirePermission('view_analytics'),
    validateParams(paramSchemas.driverId),
    validateQuery(schemas.analyticsQuery),
    DriverController.getDriverAnalytics
);

router.get('/drivers/:driverId/earnings',
    requirePermission('view_analytics'),
    validateParams(paramSchemas.driverId),
    validateQuery(schemas.analyticsQuery),
    DriverController.getDriverEarnings
);

router.get('/drivers/:driverId/deliveries',
    requirePermission('view_analytics'),
    validateParams(paramSchemas.driverId),
    validateQuery(schemas.pagination.concat(schemas.deliveryFilters)),
    DriverController.getDriverDeliveries
);

router.get('/drivers/:driverId/performance',
    requirePermission('view_analytics'),
    validateParams(paramSchemas.driverId),
    DriverController.getPerformanceSummary
);

// Driver operations
router.post('/drivers/:driverId/send-report',
    requirePermission('manage_drivers'),
    validateParams(paramSchemas.driverId),
    DriverController.sendMonthlyReport
);

router.post('/drivers/bulk',
    requirePermission('manage_drivers'),
    validateBatchOperation,
    DriverController.bulkOperations
);

router.get('/drivers/area/:area',
    requirePermission('manage_drivers'),
    DriverController.getDriversByArea
);

router.get('/leaderboard',
    requirePermission('view_analytics'),
    validateQuery(schemas.analyticsQuery),
    DriverController.getLeaderboard
);

// Delivery management
router.get('/deliveries',
    validateQuery(schemas.pagination.concat(schemas.deliveryFilters)),
    DeliveryController.getDeliveries
);

router.get('/deliveries/stats',
    requirePermission('view_analytics'),
    validateQuery(schemas.analyticsQuery),
    DeliveryController.getDeliveryStats
);

router.get('/deliveries/:id',
    validateParams(paramSchemas.mongoId),
    DeliveryController.getDelivery
);

router.post('/deliveries',
    requirePermission('create_delivery'),
    validate(schemas.createDelivery),
    DeliveryController.createDelivery
);

router.put('/deliveries/:id',
    requirePermission('edit_delivery'),
    validateParams(paramSchemas.mongoId),
    validate(schemas.updateDelivery),
    DeliveryController.updateDelivery
);

router.delete('/deliveries/:id',
    requirePermission('delete_delivery'),
    validateParams(paramSchemas.mongoId),
    DeliveryController.deleteDelivery
);

// Delivery assignment
router.post('/deliveries/:id/assign',
    requirePermission('edit_delivery'),
    validateParams(paramSchemas.mongoId),
    validate(schemas.assignDelivery),
    DeliveryController.assignDelivery
);

router.post('/deliveries/:id/unassign',
    requirePermission('edit_delivery'),
    validateParams(paramSchemas.mongoId),
    DeliveryController.unassignDelivery
);

router.post('/deliveries/bulk',
    requirePermission('edit_delivery'),
    validateBatchOperation,
    DeliveryController.bulkOperations
);

// Data export and reporting
router.get('/export',
    requirePermission('view_analytics'),
    AdminController.exportData
);

// Notifications and communication
router.get('/notifications',
    validateQuery(schemas.pagination),
    NotificationController.getNotifications
);

router.get('/notifications/unread-count',
    NotificationController.getUnreadCount
);

router.put('/notifications/:notificationId/read',
    validateParams(paramSchemas.mongoId.keys({ notificationId: paramSchemas.mongoId.extract('id') })),
    NotificationController.markAsRead
);

router.put('/notifications/mark-all-read',
    NotificationController.markAllAsRead
);

router.delete('/notifications/:notificationId',
    requirePermission('manage_notifications'),
    validateParams(paramSchemas.mongoId.keys({ notificationId: paramSchemas.mongoId.extract('id') })),
    NotificationController.deleteNotification
);

router.post('/notifications/system',
    requirePermission('manage_notifications'),
    validate(schemas.createSystemNotification),
    NotificationController.createSystemNotification
);

router.get('/notifications/stats',
    requirePermission('view_notifications'),
    NotificationController.getNotificationStats
);

router.post('/notifications/bulk',
    requirePermission('manage_drivers'),
    AdminController.sendBulkNotifications
);

// System maintenance and logs
router.get('/activity-logs',
    superAdminOnly,
    validateQuery(schemas.pagination),
    AdminController.getActivityLogs
);

router.post('/maintenance',
    superAdminOnly,
    AdminController.performMaintenance
);

router.post('/recalculate-driver-stats',
    superAdminOnly,
    AdminController.recalculateDriverStats
);

// Admin Notification Routes
router.get('/admin-notifications',
    validateQuery(schemas.pagination),
    AdminNotificationController.getAdminNotifications
);

router.get('/admin-notifications/stats',
    AdminNotificationController.getAdminNotificationStats
);

router.put('/admin-notifications/:notificationId/read',
    validateParams(paramSchemas.mongoId.keys({ notificationId: paramSchemas.mongoId.extract('id') })),
    AdminNotificationController.markAsRead
);

router.put('/admin-notifications/mark-all-read',
    AdminNotificationController.markAllAsRead
);

router.delete('/admin-notifications/:notificationId',
    validateParams(paramSchemas.mongoId.keys({ notificationId: paramSchemas.mongoId.extract('id') })),
    AdminNotificationController.deleteNotification
);

// Document Management Routes
router.get('/documents',
    requirePermission('manage_drivers'),
    validateQuery(Joi.object({
        status: Joi.string().valid('pending', 'verified', 'rejected', 'ai_processing', 'all').default('pending'),
        documentType: Joi.string().valid('studentId', 'profilePhoto', 'universityEnrollment', 'identityCard', 'transportationLicense'),
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(100).default(20)
    })),
    AdminController.getPendingDocuments
);

router.put('/documents/:documentId/status',
    requirePermission('manage_drivers'),
    validateParams(Joi.object({
        documentId: Joi.string().required()
    })),
    validate(Joi.object({
        status: Joi.string().valid('verified', 'rejected').required(),
        rejectionReason: Joi.string().when('status', {
            is: 'rejected',
            then: Joi.string().min(1).required(),
            otherwise: Joi.string().optional()
        }),
        aiVerificationResult: Joi.object().optional()
    })),
    AdminController.updateDocumentStatus
);

router.post('/documents/:documentId/verify-ai',
    requirePermission('manage_drivers'),
    validateParams(Joi.object({
        documentId: Joi.string().required()
    })),
    AdminController.startAIVerification
);

router.get('/documents/:documentId/verification-status',
    requirePermission('manage_drivers'),
    validateParams(Joi.object({
        documentId: Joi.string().required()
    })),
    AdminController.getDocumentVerificationStatus
);

router.post('/documents/batch-verify',
    requirePermission('manage_drivers'),
    validate(Joi.object({
        documentIds: Joi.array().items(Joi.string()).min(1).required(),
        action: Joi.string().valid('approve', 'reject').required(),
        rejectionReason: Joi.string().when('action', {
            is: 'reject',
            then: Joi.string().min(1).required(),
            otherwise: Joi.string().optional()
        })
    })),
    AdminController.batchVerifyDocuments
);

// Admin Earnings Management Routes
router.get('/earnings',
    requirePermission('view_analytics'),
    validateQuery(Joi.object({
        period: Joi.string().valid('today', 'week', 'month', 'quarter', 'year', 'allTime').default('allTime'),
        startDate: Joi.date().iso(),
        endDate: Joi.date().iso()
    })),
    AdminController.getEarningsOverview
);

router.put('/earnings/rules',
    requirePermission('manage_earnings'),
    validate(Joi.object({
        rules: Joi.array().items(Joi.object({
            minFee: Joi.number().min(0).required(),
            maxFee: Joi.number().min(0).required(),
            driverPercentage: Joi.number().min(0).max(100).optional(),
            driverFixed: Joi.number().min(0).optional(),
            companyPercentage: Joi.number().min(0).max(100).optional(),
            companyFixed: Joi.number().min(0).optional(),
            description: Joi.string().optional()
        }).custom((value, helpers) => {
            // Custom validation to ensure either percentage or fixed is set for driver
            if (value.driverPercentage === undefined && value.driverFixed === undefined) {
                return helpers.error('any.invalid', { message: 'Either driverPercentage or driverFixed must be specified' });
            }
            if (value.driverPercentage !== undefined && value.driverFixed !== undefined) {
                return helpers.error('any.invalid', { message: 'Cannot specify both driverPercentage and driverFixed' });
            }

            // Custom validation to ensure either percentage or fixed is set for company
            if (value.companyPercentage === undefined && value.companyFixed === undefined) {
                return helpers.error('any.invalid', { message: 'Either companyPercentage or companyFixed must be specified' });
            }
            if (value.companyPercentage !== undefined && value.companyFixed !== undefined) {
                return helpers.error('any.invalid', { message: 'Cannot specify both companyPercentage and companyFixed' });
            }

            return value;
        })).min(1).required()
    })),
    AdminController.updateEarningsRules
);

router.get('/earnings/history',
    requirePermission('view_analytics'),
    validateQuery(Joi.object({
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(100).default(20)
    })),
    AdminController.getEarningsHistory
);

// Socket Status Route (for debugging)
router.get('/socket-status',
    requirePermission('view_analytics'),
    (req, res) => {
        const socketService = require('../services/socketService');
        const status = socketService.getStatus();

        res.json({
            success: true,
            data: status,
            message: 'Socket service status retrieved successfully'
        });
    }
);

module.exports = router;