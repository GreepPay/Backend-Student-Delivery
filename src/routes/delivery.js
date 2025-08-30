const express = require('express');
const router = express.Router();
const DeliveryController = require('../controllers/deliveryController');
const { authenticateToken, adminOnly, driverOnly, requirePermission } = require('../middleware/auth');
const { validate, validateQuery, validateParams, schemas } = require('../middleware/validation');
const { createBroadcastLimiter } = require('../config/rateLimit');

// Create broadcast rate limiter
const broadcastLimiter = createBroadcastLimiter();

// ========================================
// TEST ENDPOINTS (for both admin and driver)
// ========================================

// Test location service endpoint
router.get('/test-location',
    authenticateToken,
    async (req, res) => {
        try {
            const { lat, lng, radius = 10 } = req.query;

            if (!lat || !lng) {
                return res.status(400).json({
                    success: false,
                    error: 'Latitude and longitude are required'
                });
            }

            const LocationService = require('../services/locationService');
            const nearbyDrivers = await LocationService.findNearbyDrivers(
                parseFloat(lat),
                parseFloat(lng),
                parseFloat(radius),
                10
            );

            res.json({
                success: true,
                data: {
                    searchLocation: { lat: parseFloat(lat), lng: parseFloat(lng) },
                    radius: parseFloat(radius),
                    nearbyDrivers: nearbyDrivers.map(item => ({
                        driverId: item.driver._id,
                        name: item.driver.name,
                        area: item.driver.area,
                        distance: item.distanceFormatted,
                        isOnline: item.driver.isOnline
                    })),
                    totalFound: nearbyDrivers.length
                },
                message: `Found ${nearbyDrivers.length} drivers within ${radius}km radius`
            });
        } catch (error) {
            console.error('Error testing location service:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to test location service'
            });
        }
    }
);

// Test Google Maps link extraction
router.post('/test-maps-link',
    authenticateToken,
    async (req, res) => {
        try {
            const { googleMapsLink } = req.body;

            if (!googleMapsLink) {
                return res.status(400).json({
                    success: false,
                    error: 'Google Maps link is required'
                });
            }

            const LocationService = require('../services/locationService');
            const validation = LocationService.validateGoogleMapsLink(googleMapsLink);

            res.json({
                success: validation.isValid,
                data: validation,
                message: validation.isValid ? 'Coordinates extracted successfully' : 'Failed to extract coordinates'
            });
        } catch (error) {
            console.error('Error testing Google Maps link:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to test Google Maps link'
            });
        }
    }
);

// ========================================
// ADMIN DELIVERY ROUTES
// ========================================

// Create new delivery with automatic broadcast
router.post('/',
    authenticateToken,
    adminOnly,
    requirePermission('create_delivery'),
    validate(schemas.createDelivery),
    DeliveryController.createDelivery
);

// Get all deliveries with broadcast status
router.get('/',
    authenticateToken,
    adminOnly,
    requirePermission('view_analytics'),
    validateQuery(schemas.deliveryQuery),
    DeliveryController.getDeliveries
);

// Get delivery by ID
router.get('/:id',
    authenticateToken,
    adminOnly,
    requirePermission('view_analytics'),
    validateParams(schemas.deliveryId),
    DeliveryController.getDeliveryById
);

// Update delivery
router.put('/:id',
    authenticateToken,
    adminOnly,
    requirePermission('edit_delivery'),
    validateParams(schemas.deliveryId),
    validate(schemas.updateDelivery),
    DeliveryController.updateDelivery
);

// Delete delivery
router.delete('/:id',
    authenticateToken,
    adminOnly,
    requirePermission('delete_delivery'),
    validateParams(schemas.deliveryId),
    DeliveryController.deleteDelivery
);

// Start broadcast for existing delivery
router.post('/:id/broadcast',
    authenticateToken,
    adminOnly,
    requirePermission('create_delivery'),
    validateParams(schemas.deliveryId),
    DeliveryController.startBroadcast
);

// Manual assignment (admin fallback)
router.post('/:id/assign',
    authenticateToken,
    adminOnly,
    requirePermission('edit_delivery'),
    validateParams(schemas.deliveryId),
    validate(schemas.manualAssignment),
    DeliveryController.manualAssign
);

// Get broadcast statistics
router.get('/broadcast/stats',
    authenticateToken,
    adminOnly,
    requirePermission('view_analytics'),
    DeliveryController.getBroadcastStats
);

// Handle expired broadcasts
router.post('/broadcast/handle-expired',
    authenticateToken,
    adminOnly,
    requirePermission('edit_delivery'),
    DeliveryController.handleExpiredBroadcasts
);

// Update delivery status
router.put('/:id/status',
    authenticateToken,
    requirePermission('edit_delivery'),
    validateParams(schemas.deliveryId),
    validate(schemas.updateDeliveryStatus),
    DeliveryController.updateDeliveryStatus
);

// ========================================
// DRIVER DELIVERY ROUTES
// ========================================

// Accept delivery broadcast (driver only)
router.post('/broadcast/:deliveryId/accept', authenticateToken, driverOnly, async (req, res) => {
    try {
        const { deliveryId } = req.params;
        const driverId = req.user.id;

        const BroadcastService = require('../services/broadcastService');
        const delivery = await BroadcastService.acceptDelivery(deliveryId, driverId);

        res.json({
            success: true,
            message: 'Delivery accepted successfully',
            data: {
                deliveryId: delivery._id,
                deliveryCode: delivery.deliveryCode,
                acceptedAt: delivery.acceptedAt,
                status: delivery.status
            }
        });
    } catch (error) {
        console.error('Error accepting delivery:', error);
        res.status(400).json({
            success: false,
            error: error.message || 'Failed to accept delivery'
        });
    }
});

// Test endpoint for debugging
router.get('/broadcast/test', async (req, res) => {
    try {
        console.log('🧪 Test endpoint called');

        const Delivery = require('../models/Delivery');
        const activeDeliveries = await Delivery.find({
            broadcastStatus: 'broadcasting',
            broadcastEndTime: { $gt: new Date() },
            assignedTo: null,
            status: 'pending'
        }).sort({ priority: -1, createdAt: 1 });

        console.log(`📦 Test found ${activeDeliveries.length} active broadcasts`);

        res.json({
            success: true,
            data: {
                broadcasts: activeDeliveries,
                count: activeDeliveries.length,
                timestamp: new Date().toISOString()
            },
            message: 'Test endpoint working'
        });
    } catch (error) {
        console.error('Test endpoint error:', error);
        res.status(500).json({
            success: false,
            error: 'Test endpoint failed'
        });
    }
});

// Get active broadcasts for driver (simplified for testing)
router.get('/broadcast/active', authenticateToken, driverOnly, broadcastLimiter, async (req, res) => {
    try {
        const driverId = req.user.id;
        const { lat, lng } = req.query;
        const location = lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : null;

        console.log(`🔍 Route: Getting active broadcasts for driver: ${driverId}`);

        // Direct database query - bypass the service for now
        const Delivery = require('../models/Delivery');
        const activeDeliveries = await Delivery.find({
            broadcastStatus: 'broadcasting',
            broadcastEndTime: { $gt: new Date() },
            assignedTo: null,
            status: 'pending'
        }).sort({ priority: -1, createdAt: 1 });

        console.log(`📦 Direct query found ${activeDeliveries.length} active broadcasts`);

        res.json({
            success: true,
            data: {
                broadcasts: activeDeliveries,
                count: activeDeliveries.length,
                cached: false,
                timestamp: new Date().toISOString()
            },
            message: 'Active broadcasts retrieved successfully'
        });
    } catch (error) {
        console.error('Error getting active broadcasts:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get active broadcasts'
        });
    }
});

// Accept delivery (for drivers)
router.post('/:id/accept',
    authenticateToken,
    driverOnly,
    validateParams(schemas.deliveryId),
    DeliveryController.acceptDelivery
);

// Get driver's deliveries
router.get('/driver/my-deliveries',
    authenticateToken,
    driverOnly,
    validateQuery(schemas.driverDeliveryQuery),
    DeliveryController.getDriverDeliveries
);

// Manual earnings calculation endpoint
router.post('/:id/calculate-earnings',
    authenticateToken,
    driverOnly,
    validateParams(schemas.deliveryId),
    async (req, res) => {
        try {
            const { id } = req.params;
            const driverId = req.user.id;

            const delivery = await Delivery.findById(id);
            if (!delivery) {
                return res.status(404).json({
                    success: false,
                    error: 'Delivery not found'
                });
            }

            // Verify driver owns this delivery
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

            // Calculate earnings
            const earningsResult = await DeliveryController.calculateDriverEarnings(id);

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