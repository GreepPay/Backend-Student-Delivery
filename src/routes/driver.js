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
const { uploadSingleImage, uploadDocument, handleUploadError } = require('../middleware/upload');

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
            'Kaymakli',
            'Hamitköy',
            'Yenişehir',
            'Kumsal',
            'Gönyeli',
            'Dereboyu',
            'Ortaköy',
            'Yenikent',
            'Taskinkoy',
            'Metehan',
            'Gocmenkoy',
            'Haspolat',
            'Alaykoy',
            'Marmara',
            'Terminal/City Center'
        ).required().messages({
            'any.only': 'Please select a valid service area',
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

// Driver status update endpoint
router.put('/status',
    validate(schemas.updateDriverStatus),
    (req, res, next) => {
        req.params.driverId = req.user.id;
        next();
    },
    DriverController.updateDriverStatus
);

// Force refresh verification status
router.post('/refresh-verification',
    DriverController.refreshVerificationStatus
);

// Alternative endpoints that frontend might be calling
router.post('/status/verify',
    DriverController.refreshVerificationStatus
);

router.post('/verify-status',
    DriverController.refreshVerificationStatus
);

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
    DeliveryController.updateDeliveryStatus
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
    validateParams(Joi.object({
        notificationId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required().messages({
            'string.pattern.base': 'Invalid notification ID format'
        })
    })),
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
    RemittanceController.getDriverRemittances
);

// Driver leaderboard endpoints (temporarily without driverOnly middleware for testing)
router.get('/leaderboard', authenticateToken, DriverController.getDriverLeaderboard);
router.get('/leaderboard/categories', authenticateToken, DriverController.getDriverLeaderboardCategories);

// Account Status endpoints
router.get('/status', (req, res, next) => {
    req.params.driverId = req.user.id;
    next();
}, DriverController.getAccountStatus);

// Profile Options endpoint
router.get('/profile-options', DriverController.getProfileOptions);

// General document upload route (for frontend compatibility)
router.post('/documents/upload',
    uploadDocument,
    handleUploadError,
    (req, res, next) => {
        // Extract document type from request body or headers
        const documentType = req.body.documentType || req.headers['x-document-type'];
        if (!documentType) {
            return res.status(400).json({
                success: false,
                message: 'Document type is required. Please specify documentType in request body or x-document-type header.'
            });
        }

        // Validate document type
        const validTypes = ['studentId', 'profilePhoto', 'passportPhoto'];
        if (!validTypes.includes(documentType)) {
            return res.status(400).json({
                success: false,
                message: `Invalid document type. Must be one of: ${validTypes.join(', ')}`
            });
        }

        req.params.documentType = documentType;
        next();
    },
    DriverController.uploadDocument
);

// Specific document type upload route (original route)
router.post('/documents/:documentType/upload',
    uploadDocument,
    handleUploadError,
    validateParams(Joi.object({
        documentType: Joi.string().valid('studentId', 'profilePhoto', 'passportPhoto').required()
    })),
    DriverController.uploadDocument
);

// Get driver documents
router.get('/documents',
    async (req, res) => {
        try {
            const driverId = req.user.id;
            console.log('📄 Fetching documents for driver:', driverId);

            // Get driver from database
            const Driver = require('../models/Driver');
            const driver = await Driver.findById(driverId);

            if (!driver) {
                return res.status(404).json({
                    success: false,
                    error: 'Driver not found'
                });
            }

            // Return documents structure
            const documents = driver.documents || {};
            console.log('📄 Documents found:', Object.keys(documents));

            res.json({
                success: true,
                data: {
                    documents: documents
                },
                message: 'Driver documents retrieved successfully'
            });

        } catch (error) {
            console.error('❌ Error fetching driver documents:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch documents'
            });
        }
    }
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

// Manual earnings calculation endpoint
router.post('/earnings/calculate',
    async (req, res) => {
        try {
            const driverId = req.user.id;

            // Check if req.body exists and has deliveryId
            if (!req.body) {
                return res.status(400).json({
                    success: false,
                    error: 'Request body is missing'
                });
            }

            const { deliveryId } = req.body;

            if (!deliveryId) {
                return res.status(400).json({
                    success: false,
                    error: 'Delivery ID is required'
                });
            }

            // Verify driver owns this delivery
            const delivery = await require('../models/Delivery').findById(deliveryId);
            if (!delivery) {
                return res.status(404).json({
                    success: false,
                    error: 'Delivery not found'
                });
            }

            if (delivery.assignedTo.toString() !== driverId) {
                return res.status(403).json({
                    success: false,
                    error: 'You can only calculate earnings for your own deliveries'
                });
            }

            // Check if delivery is completed
            if (delivery.status !== 'delivered') {
                return res.status(400).json({
                    success: false,
                    error: 'Earnings can only be calculated for completed deliveries'
                });
            }

            // Calculate earnings using the controller method
            const earningsResult = await DeliveryController.calculateDriverEarnings(deliveryId);

            res.json({
                success: true,
                message: 'Earnings calculated successfully',
                data: earningsResult
            });

        } catch (error) {
            console.error('Error calculating earnings:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to calculate earnings'
            });
        }
    }
);

module.exports = router;