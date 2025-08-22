const express = require('express');
const router = express.Router();
const ReferralController = require('../controllers/referralController');
const { authenticateToken, driverOnly, adminOnly } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');

// Driver routes
router.get('/driver/:driverId/stats', authenticateToken, driverOnly, ReferralController.getReferralStats);
router.get('/driver/:driverId/code', authenticateToken, driverOnly, ReferralController.getDriverReferralCode);
router.get('/driver/:driverId/points', authenticateToken, driverOnly, ReferralController.getDriverPoints);
router.post('/driver/:driverId/generate', authenticateToken, driverOnly, ReferralController.generateReferralCode);
router.post('/driver/:driverId/use', authenticateToken, driverOnly, validate(schemas.validateReferralCode), ReferralController.useReferralCode);
router.put('/driver/:driverId/progress', authenticateToken, driverOnly, ReferralController.updateReferralProgress);

// Public routes (for leaderboard)
router.get('/leaderboard', ReferralController.getReferralLeaderboard);

// Admin routes
router.get('/admin/all', authenticateToken, adminOnly, ReferralController.getAllReferrals);
router.get('/admin/statistics', authenticateToken, adminOnly, ReferralController.getReferralStatistics);
router.get('/admin/analytics', authenticateToken, adminOnly, ReferralController.getReferralAnalytics);
router.get('/admin/referrals', authenticateToken, adminOnly, ReferralController.getAllReferrals); // Add this specific route
router.get('/admin/:referralId', authenticateToken, adminOnly, ReferralController.getReferralDetails);

module.exports = router;
