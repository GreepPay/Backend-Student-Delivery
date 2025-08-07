const express = require('express');
const router = express.Router();
const DriverRatingController = require('../controllers/driverRatingController');
const { authenticateToken, adminOnly } = require('../middleware/auth');

// All routes require admin authentication
router.use(authenticateToken, adminOnly);

// Calculate rating for a specific driver
router.get('/driver/:driverId', DriverRatingController.calculateDriverRating);

// Get rating breakdown for a driver
router.get('/driver/:driverId/breakdown', DriverRatingController.getDriverRatingBreakdown);

// Recalculate ratings for all drivers
router.post('/recalculate-all', DriverRatingController.recalculateAllRatings);

// Get drivers sorted by rating
router.get('/drivers', DriverRatingController.getDriversByRating);

// Get rating statistics
router.get('/stats', DriverRatingController.getRatingStats);

module.exports = router; 