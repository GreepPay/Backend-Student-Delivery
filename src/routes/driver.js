const express = require('express');
const Joi = require('joi');
const DriverController = require('../controllers/driverController');
const DeliveryController = require('../controllers/deliveryController');
const NotificationController = require('../controllers/notificationController');
const RemittanceController = require('../controllers/remittanceController');
const {
    authenticateToken,
    driverOnly,
    canAccessDriverData,
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
const { uploadSingleImage, handleUploadError } = require('../middleware/upload');

const router = express.Router();

// Driver activation routes (no authentication required)
router.get('/activate/:token',
    DriverController.validateInvitation
);

router.post('/activate/:token',
    validate(Joi.object({
        phone: Joi.string().required(),
        studentId: Joi.string().required(),
        university: Joi.string().required(),
        address: Joi.string().valid(
            'Gonyeli',
            'Kucuk',
            'Lefkosa',
            'Famagusta',
            'Kyrenia',
            'Other'
        ).required().messages({
            'any.only': 'Service area must be one of: Gonyeli, Kucuk, Lefkosa, Famagusta, Kyrenia, Other',
            'any.required': 'Service area is required'
        })
        // No password field - OTP-only authentication
    })),
    DriverController.activateDriverAccount
);

// Apply middleware to all authenticated driver routes
router.use(authenticateToken);
router.use(driverOnly);
router.use(sanitizeInput);

// Driver dashboard
router.get('/dashboard',
    validateQuery(schemas.analyticsQuery),
    DriverController.getDriverDashboard
);

// Driver profile and status
router.get('/profile', (req, res, next) => {
    req.params.driverId = req.user.id;
    next();
}, DriverController.getDriver);

router.put('/profile',
    validate(schemas.updateDriverProfile),
    DriverController.updateProfile
);

// Debug endpoint to test validation
router.post('/profile/debug',
    (req, res) => {
        console.log('🐛 Debug profile request received:');
        console.log('Headers:', req.headers);
        console.log('Body:', req.body);
        console.log('User:', req.user);

        res.json({
            success: true,
            message: 'Debug endpoint - check server logs',
            receivedData: req.body,
            headers: req.headers,
            user: req.user ? { id: req.user.id, userType: req.user.userType } : null
        });
    }
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

// router.get('/deliveries/nearby',
//     validateQuery(schemas.deliveryFilters),
//     DeliveryController.getNearbyDeliveries
// );

router.get('/deliveries/:deliveryId',
    validateParams(paramSchemas.mongoId.keys({ deliveryId: paramSchemas.mongoId.extract('id') })),
    DeliveryController.getDeliveryById
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

// Driver remittances
router.get('/remittances',
    authenticateToken,
    validateUserContext,
    validateQuery(schemas.remittanceQuery),
    RemittanceController.getDriverRemittances
);

router.get('/remittances/summary',
    authenticateToken,
    validateUserContext,
    RemittanceController.getDriverRemittanceSummary
);

// Leaderboard (drivers can view their ranking)
router.get('/leaderboard',
    validateQuery(schemas.analyticsQuery),
    DriverController.getLeaderboard
);

// Account Status endpoints
router.get('/status', (req, res, next) => {
    req.params.driverId = req.user.id;
    next();
}, DriverController.getAccountStatus);

// Profile Options endpoint
router.get('/profile-options', DriverController.getProfileOptions);

router.post('/documents/:documentType/upload',
    uploadSingleImage,
    handleUploadError,
    validateParams(Joi.object({
        documentType: Joi.string().valid('studentId', 'profilePhoto', 'universityEnrollment', 'identityCard', 'transportationLicense').required()
    })),
    DriverController.uploadDocument
);

// Profile management (duplicate route removed - using the main /profile PUT route above)

router.post('/profile/picture',
    uploadSingleImage,
    handleUploadError,
    DriverController.uploadProfilePicture
);

// Alternative route for frontend compatibility
router.post('/profile/image',
    uploadSingleImage,
    handleUploadError,
    DriverController.uploadProfilePicture
);

// Account deactivation
router.put('/deactivate',
    DriverController.deactivateAccount
);

module.exports = router;