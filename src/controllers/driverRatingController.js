const DriverRatingService = require('../services/driverRatingService');
const Driver = require('../models/Driver');

class DriverRatingController {
    /**
     * Calculate rating for a specific driver
     */
    static async calculateDriverRating(req, res) {
        try {
            const { driverId } = req.params;

            const rating = await DriverRatingService.calculateDriverRating(driverId);

            res.json({
                success: true,
                data: rating
            });
        } catch (error) {
            console.error('Error calculating driver rating:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Get rating breakdown for a driver
     */
    static async getDriverRatingBreakdown(req, res) {
        try {
            const { driverId } = req.params;

            const breakdown = await DriverRatingService.getDriverRatingBreakdown(driverId);

            res.json({
                success: true,
                data: breakdown
            });
        } catch (error) {
            console.error('Error getting driver rating breakdown:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Recalculate ratings for all drivers
     */
    static async recalculateAllRatings(req, res) {
        try {
            const results = await DriverRatingService.recalculateAllRatings();

            res.json({
                success: true,
                data: {
                    message: `Recalculated ratings for ${results.length} drivers`,
                    results
                }
            });
        } catch (error) {
            console.error('Error recalculating all ratings:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Get drivers sorted by rating
     */
    static async getDriversByRating(req, res) {
        try {
            const { limit = 10, sort = 'desc' } = req.query;

            const sortOrder = sort === 'asc' ? 1 : -1;

            const drivers = await Driver.find({})
                .sort({ rating: sortOrder })
                .limit(parseInt(limit))
                .select('name email area rating totalDeliveries totalEarnings isActive isOnline lastLogin');

            res.json({
                success: true,
                data: drivers
            });
        } catch (error) {
            console.error('Error getting drivers by rating:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Get rating statistics
     */
    static async getRatingStats(req, res) {
        try {
            const drivers = await Driver.find({});

            const stats = {
                totalDrivers: drivers.length,
                averageRating: 0,
                ratingDistribution: {
                    '5.0': 0,
                    '4.0-4.9': 0,
                    '3.0-3.9': 0,
                    '2.0-2.9': 0,
                    '1.0-1.9': 0
                },
                topPerformers: [],
                needsImprovement: []
            };

            if (drivers.length > 0) {
                const totalRating = drivers.reduce((sum, driver) => sum + driver.rating, 0);
                stats.averageRating = Math.round((totalRating / drivers.length) * 10) / 10;

                // Calculate rating distribution
                drivers.forEach(driver => {
                    if (driver.rating >= 5.0) stats.ratingDistribution['5.0']++;
                    else if (driver.rating >= 4.0) stats.ratingDistribution['4.0-4.9']++;
                    else if (driver.rating >= 3.0) stats.ratingDistribution['3.0-3.9']++;
                    else if (driver.rating >= 2.0) stats.ratingDistribution['2.0-2.9']++;
                    else stats.ratingDistribution['1.0-1.9']++;
                });

                // Get top performers (rating >= 4.5)
                stats.topPerformers = drivers
                    .filter(driver => driver.rating >= 4.5)
                    .sort((a, b) => b.rating - a.rating)
                    .slice(0, 5)
                    .map(driver => ({
                        name: driver.name,
                        rating: driver.rating,
                        totalDeliveries: driver.totalDeliveries,
                        area: driver.area
                    }));

                // Get drivers needing improvement (rating < 3.0)
                stats.needsImprovement = drivers
                    .filter(driver => driver.rating < 3.0)
                    .sort((a, b) => a.rating - b.rating)
                    .slice(0, 5)
                    .map(driver => ({
                        name: driver.name,
                        rating: driver.rating,
                        totalDeliveries: driver.totalDeliveries,
                        area: driver.area
                    }));
            }

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            console.error('Error getting rating stats:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
}

module.exports = DriverRatingController; 