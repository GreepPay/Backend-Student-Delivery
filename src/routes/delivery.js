const express = require('express');
const DeliveryController = require('../controllers/deliveryController');
const { authenticateToken, adminOnly, driverOnly, requirePermission } = require('../middleware/auth');
const { validate, validateQuery, validateParams, schemas } = require('../middleware/validation');

const router = express.Router();

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

// Get active broadcasts for driver
router.get('/broadcast/active',
    authenticateToken,
    driverOnly,
    validateQuery(schemas.broadcastQuery),
    DeliveryController.getActiveBroadcasts
);

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



module.exports = router;