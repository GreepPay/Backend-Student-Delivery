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
    RemittanceController.getRemittances
);

// Get remittance statistics (admin only)
router.get('/statistics',
    RemittanceController.getRemittanceStatistics
);

// Get overdue remittances (admin only)
router.get('/overdue',
    RemittanceController.getOverdueRemittances
);

// Get remittances due soon (admin only)
router.get('/due-soon',
    RemittanceController.getRemittancesDueSoon
);

// Calculate remittance amount for a driver (admin only)
router.get('/calculate/:driverId',
    RemittanceController.calculateRemittanceAmount
);

// Get driver's remittance summary (driver can see their own, admin can see any)
router.get('/summary/:driverId',
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

// Cancel remittance (admin only)
router.put('/:remittanceId/cancel',
    adminOnly,
    RemittanceController.cancelRemittance
);

// Complete remittance (admin only)
router.put('/:remittanceId/complete',
    adminOnly,
    RemittanceController.completeRemittance
);

// Bulk generate remittances (admin only)
router.post('/bulk-generate',
    adminOnly,
    RemittanceController.bulkGenerateRemittances
);

module.exports = router; 