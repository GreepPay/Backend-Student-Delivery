const express = require('express');
const EarningsConfigController = require('../controllers/earningsConfigController');
const {
    authenticateToken,
    requirePermission
} = require('../middleware/auth');
const {
    validate,
    validateQuery,
    sanitizeInput,
    schemas
} = require('../middleware/validation');

const router = express.Router();

// Apply middleware to all routes
router.use(authenticateToken);
router.use(requirePermission('manage_earnings'));
router.use(sanitizeInput);

// Get active earnings configuration
router.get('/active', EarningsConfigController.getActiveConfig);

// Get all earnings configurations
router.get('/', validateQuery(schemas.pagination), EarningsConfigController.getAllConfigs);

// Create new earnings configuration
router.post('/',
    validate(schemas.createEarningsConfig),
    EarningsConfigController.createConfig
);

// Update earnings configuration
router.put('/:configId',
    validate(schemas.updateEarningsConfig),
    EarningsConfigController.updateConfig
);

// Delete earnings configuration
router.delete('/:configId', EarningsConfigController.deleteConfig);

// Test earnings calculation
router.post('/test-calculation',
    validate(schemas.testEarningsCalculation),
    EarningsConfigController.testEarningsCalculation
);

// Bulk update deliveries with new earnings rules
router.post('/bulk-update',
    validate(schemas.bulkUpdateEarnings),
    EarningsConfigController.bulkUpdateDeliveries
);

// Get earnings statistics
router.get('/stats',
    validateQuery(schemas.earningsStatsQuery),
    EarningsConfigController.getEarningsStats
);

module.exports = router; 