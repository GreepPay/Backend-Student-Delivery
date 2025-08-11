const express = require('express');
const NotificationController = require('../controllers/notificationController');
const {
    authenticateToken,
    adminOnly,
    driverOnly,
    requirePermission,
    validateUserContext
} = require('../middleware/auth');
const {
    validate,
    validateQuery,
    validateParams,
    sanitizeInput,
    schemas,
    paramSchemas
} = require('../middleware/validation');

const router = express.Router();

// Apply middleware to all notification routes
router.use(authenticateToken);
router.use(validateUserContext);
router.use(sanitizeInput);

// Common notification routes (for both admin and driver)
router.get('/',
    validateQuery(schemas.pagination),
    NotificationController.getNotifications
);

router.get('/unread-count',
    NotificationController.getUnreadCount
);

router.put('/:notificationId/read',
    validateParams(paramSchemas.mongoId.keys({ notificationId: paramSchemas.mongoId.extract('id') })),
    NotificationController.markAsRead
);

router.put('/mark-all-read',
    NotificationController.markAllAsRead
);

// Admin-only notification routes
router.delete('/:notificationId',
    requirePermission('manage_notifications'),
    validateParams(paramSchemas.mongoId.keys({ notificationId: paramSchemas.mongoId.extract('id') })),
    NotificationController.deleteNotification
);

router.post('/system',
    requirePermission('manage_notifications'),
    validate(schemas.createSystemNotification),
    NotificationController.createSystemNotification
);

router.get('/stats',
    requirePermission('view_notifications'),
    NotificationController.getNotificationStats
);

module.exports = router; 