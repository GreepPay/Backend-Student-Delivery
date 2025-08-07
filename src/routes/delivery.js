const express = require('express');
const DeliveryController = require('../controllers/deliveryController');
const {
    authenticateToken,
    optionalAuth
} = require('../middleware/auth');
const {
    validateQuery,
    validateParams,
    sanitizeInput,
    schemas,
    paramSchemas
} = require('../middleware/validation');

const router = express.Router();

// Apply input sanitization to all routes
router.use(sanitizeInput);

// Public routes (no authentication required)
// These might be useful for customer tracking or public API access

// Track delivery by code (public endpoint for customers)
router.get('/track/:deliveryCode',
    validateParams(paramSchemas.deliveryCode),
    async (req, res) => {
        try {
            const { deliveryCode } = req.params;

            const Delivery = require('../models/Delivery');
            const delivery = await Delivery.findOne({ deliveryCode })
                .select('deliveryCode status pickupLocation deliveryLocation estimatedTime createdAt deliveredAt')
                .populate('assignedTo', 'name area');

            if (!delivery) {
                return res.status(404).json({
                    success: false,
                    error: 'Delivery not found'
                });
            }

            // Return limited public information
            res.json({
                success: true,
                data: {
                    deliveryCode: delivery.deliveryCode,
                    status: delivery.status,
                    pickupLocation: delivery.pickupLocation,
                    deliveryLocation: delivery.deliveryLocation,
                    estimatedTime: delivery.estimatedTime,
                    createdAt: delivery.createdAt,
                    deliveredAt: delivery.deliveredAt,
                    driver: delivery.assignedTo ? {
                        name: delivery.assignedTo.name,
                        area: delivery.assignedTo.area
                    } : null
                },
                message: 'Delivery status retrieved successfully'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: 'Failed to track delivery'
            });
        }
    }
);

// Get delivery statistics (public summary)
router.get('/public/stats', async (req, res) => {
    try {
        const Delivery = require('../models/Delivery');
        const Driver = require('../models/Driver');

        const [totalDeliveries, completedDeliveries, activeDrivers] = await Promise.all([
            Delivery.countDocuments(),
            Delivery.countDocuments({ status: 'delivered' }),
            Driver.countDocuments({ isActive: true })
        ]);

        res.json({
            success: true,
            data: {
                totalDeliveries,
                completedDeliveries,
                activeDrivers,
                completionRate: totalDeliveries > 0 ? Math.round((completedDeliveries / totalDeliveries) * 100) : 0
            },
            message: 'Public statistics retrieved successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve statistics'
        });
    }
});

// Protected routes (authentication required)
router.use(authenticateToken);

// Get delivery details (authenticated users only)
router.get('/:id',
    validateParams(paramSchemas.mongoId),
    DeliveryController.getDelivery
);

// Search deliveries (with optional authentication for more details)
router.get('/',
    validateQuery(schemas.pagination.concat(schemas.deliveryFilters)),
    DeliveryController.getDeliveries
);

// Test endpoint for delivery notifications
router.post('/test-notification',
    DeliveryController.testDeliveryNotification
);

module.exports = router;