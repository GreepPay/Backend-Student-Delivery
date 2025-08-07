const express = require('express');
const Joi = require('joi');
const DriverController = require('../controllers/driverController');
const DeliveryController = require('../controllers/deliveryController');
const NotificationController = require('../controllers/notificationController');
const {
    authenticateToken,
    driverOnly,
    canAccessDriverData
} = require('../middleware/auth');
const {
    validate,
    validateQuery,
    validateParams,
    sanitizeInput,
    schemas,
    paramSchemas
} = require('../middleware/validation');
const { uploadSingleImage, handleUploadError } = require('../middleware/upload');

const router = express.Router();

// Apply middleware to all driver routes
router.use(authenticateToken);
router.use(driverOnly);
router.use(sanitizeInput);

// Driver profile and status
router.get('/profile', (req, res, next) => {
    req.params.driverId = req.user.id;
    next();
}, DriverController.getDriver);

router.put('/profile',
    validate(schemas.updateDriverProfile),
    (req, res, next) => {
        req.params.id = req.user.id;
        next();
    },
    DriverController.updateDriver
);

router.post('/toggle-online', (req, res, next) => {
    req.params.driverId = req.user.id;
    next();
}, DriverController.toggleOnlineStatus);

router.post('/toggle-active', (req, res, next) => {
    console.log('toggle-active route hit');
    req.params.driverId = req.user.id;
    console.log('Set driverId to:', req.params.driverId);
    next();
}, DriverController.toggleActiveStatus);

// Driver analytics and earnings
router.get('/analytics',
    validateQuery(schemas.analyticsQuery),
    (req, res, next) => {
        req.params.driverId = req.user.id;
        next();
    },
    DriverController.getDriverAnalytics
);

router.get('/earnings',
    validateQuery(schemas.analyticsQuery),
    (req, res, next) => {
        req.params.driverId = req.user.id;
        next();
    },
    DriverController.getDriverEarnings
);

router.get('/performance', (req, res, next) => {
    req.params.driverId = req.user.id;
    next();
}, DriverController.getPerformanceSummary);

// Driver deliveries
router.get('/deliveries',
    validateQuery(schemas.pagination.concat(schemas.deliveryFilters)),
    (req, res, next) => {
        req.params.driverId = req.user.id;
        next();
    },
    DriverController.getDriverDeliveries
);

router.get('/deliveries/nearby',
    validateQuery(schemas.deliveryFilters),
    DeliveryController.getNearbyDeliveries
);

router.get('/deliveries/:deliveryId',
    validateParams(paramSchemas.mongoId.keys({ deliveryId: paramSchemas.mongoId.extract('id') })),
    DeliveryController.getDelivery
);

// Update delivery status (driver can only update their own deliveries)
router.put('/deliveries/:deliveryId/status',
    (req, res, next) => {
        console.log('PUT /deliveries/:deliveryId/status route hit');
        console.log('Params:', req.params);
        console.log('Body:', req.body);
        next();
    },
    validateParams(Joi.object({
        deliveryId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required().messages({
            'string.pattern.base': 'Invalid delivery ID format'
        })
    })),
    validate(schemas.updateDeliveryStatus),
    (req, res, next) => {
        req.params.id = req.params.deliveryId;
        next();
    },
    DriverController.updateDeliveryStatus
);

// Driver notifications
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

// Leaderboard (drivers can view their ranking)
router.get('/leaderboard',
    validateQuery(schemas.analyticsQuery),
    DriverController.getLeaderboard
);

// Profile management
router.put('/profile/update',
    validate(Joi.object({
        name: Joi.string().min(2).max(50).optional(),
        phone: Joi.string().pattern(/^[\+]?[1-9][\d]{0,15}$/).optional(),
        area: Joi.string().valid('Gonyeli', 'Kucuk', 'Lefkosa', 'Famagusta', 'Kyrenia', 'Other').optional()
    })),
    DriverController.updateProfile
);

router.post('/profile/picture',
    uploadSingleImage,
    handleUploadError,
    DriverController.uploadProfilePicture
);

// Account deactivation
router.put('/deactivate',
    DriverController.deactivateAccount
);

module.exports = router;