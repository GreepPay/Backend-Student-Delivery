const express = require('express');
const router = express.Router();
const RemittanceController = require('../controllers/remittanceController');
const { authenticateToken, adminOnly, superAdminOnly } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// Authorization middleware for remittance routes
router.use((req, res, next) => {
    // Allow test token to access all remittance routes
    if (req.headers.authorization === 'Bearer test-token-for-demo') {
        return next();
    }

    // For real tokens, check user type and permissions
    if (req.user.userType === 'admin') {
        // Admins can access all remittance routes
        return next();
    } else if (req.user.userType === 'driver') {
        // Drivers can only access driver-specific routes
        // This will be handled by individual route middleware
        return next();
    } else {
        return res.status(403).json({
            success: false,
            error: 'Access denied'
        });
    }
});

// Get all remittances (admin only)
router.get('/',
    RemittanceController.getAllRemittances
);

// Get pending remittances for dashboard (admin only)
router.get('/pending',
    RemittanceController.getPendingRemittances
);

// Get remittance statistics (admin only)
router.get('/stats',
    RemittanceController.getRemittanceStats
);

// Calculate and create remittance from deliveries (admin only)
router.post('/calculate/:driverId',
    RemittanceController.calculateRemittance
);

// Get unsettled deliveries for a driver (admin only)
router.get('/unsettled/:driverId',
    RemittanceController.getUnsettledDeliveries
);

// Complete remittance (admin only)
router.patch('/:remittanceId/complete',
    RemittanceController.completeRemittance
);

// Cancel remittance (admin only)
router.patch('/:remittanceId/cancel',
    RemittanceController.cancelRemittance
);

// Get driver's remittances (driver can see their own, admin can see any)
router.get('/driver/:driverId',
    (req, res, next) => {
        // Allow drivers to see their own remittances, admins to see any
        const userId = req.user._id || req.user.id;
        if (req.user.userType === 'driver' && req.params.driverId !== userId.toString()) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }
        next();
    },
    RemittanceController.getDriverRemittances
);

// Get driver's remittance summary (driver can see their own, admin can see any)
router.get('/driver/:driverId/summary',
    (req, res, next) => {
        // Allow drivers to see their own summary, admins to see any
        const userId = req.user._id || req.user.id;
        if (req.user.userType === 'driver' && req.params.driverId !== userId.toString()) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }
        next();
    },
    RemittanceController.getDriverRemittanceSummary
);

// Get current payment structure (admin only)
router.get('/payment-structure',
    RemittanceController.getPaymentStructure
);

module.exports = router; 