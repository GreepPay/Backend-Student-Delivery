const Driver = require('../models/Driver');
const Delivery = require('../models/Delivery');
const AdminNotificationService = require('./adminNotificationService');

class DriverRatingService {
    /**
     * Calculate driver rating based on multiple performance metrics
     * @param {string} driverId - Driver ID
     * @returns {Object} Rating details
     */
    static async calculateDriverRating(driverId) {
        try {
            const driver = await Driver.findById(driverId);
            if (!driver) {
                throw new Error('Driver not found');
            }

            // Get driver's delivery history
            const deliveries = await Delivery.find({ assignedTo: driverId });

            if (deliveries.length === 0) {
                // New driver with no deliveries
                return {
                    rating: 5.0,
                    score: 100,
                    breakdown: {
                        completionRate: 100,
                        efficiency: 100,
                        reliability: 100,
                        activity: 100,
                        earnings: 100
                    },
                    factors: ['New driver - default rating']
                };
            }

            // Calculate various metrics
            const metrics = this.calculateMetrics(deliveries, driver);
            const rating = this.calculateOverallRating(metrics);

            // Store old rating for comparison
            const oldRating = driver.rating || 5.0;

            // Update driver's rating
            await Driver.findByIdAndUpdate(driverId, { rating: rating.finalRating });

            // Create notification if rating changed significantly (more than 0.5 difference)
            if (Math.abs(rating.finalRating - oldRating) >= 0.5) {
                try {
                    await AdminNotificationService.createRatingUpdateNotification(
                        driverId,
                        oldRating,
                        rating.finalRating
                    );
                } catch (notificationError) {
                    console.error('Failed to create rating update notification:', notificationError.message);
                }
            }

            return rating;
        } catch (error) {
            console.error('Error calculating driver rating:', error);
            throw error;
        }
    }

    /**
     * Calculate individual performance metrics
     */
    static calculateMetrics(deliveries, driver) {
        const totalDeliveries = deliveries.length;
        const completedDeliveries = deliveries.filter(d => d.status === 'delivered').length;
        const cancelledDeliveries = deliveries.filter(d => d.status === 'cancelled').length;
        const pendingDeliveries = deliveries.filter(d => d.status === 'pending').length;

        // Completion Rate (30% weight)
        const completionRate = totalDeliveries > 0 ? (completedDeliveries / totalDeliveries) * 100 : 100;

        // Efficiency Score (25% weight) - based on delivery time vs estimated time
        const efficiencyScore = this.calculateEfficiencyScore(deliveries);

        // Reliability Score (20% weight) - based on cancellations and suspensions
        const reliabilityScore = this.calculateReliabilityScore(driver, cancelledDeliveries, totalDeliveries);

        // Activity Score (15% weight) - based on recent activity and online status
        const activityScore = this.calculateActivityScore(driver, deliveries);

        // Earnings Performance (10% weight) - based on earnings consistency
        const earningsScore = this.calculateEarningsScore(driver, deliveries);

        return {
            completionRate,
            efficiencyScore,
            reliabilityScore,
            activityScore,
            earningsScore,
            totalDeliveries,
            completedDeliveries,
            cancelledDeliveries
        };
    }

    /**
     * Calculate efficiency score based on delivery times
     */
    static calculateEfficiencyScore(deliveries) {
        const completedDeliveries = deliveries.filter(d => d.status === 'delivered' && d.deliveryDuration);

        if (completedDeliveries.length === 0) return 100;

        const avgDeliveryTime = completedDeliveries.reduce((sum, d) => sum + d.deliveryDuration, 0) / completedDeliveries.length;

        // Score based on average delivery time (lower is better)
        // Target: 30 minutes, Max: 120 minutes
        const targetTime = 30; // minutes
        const maxTime = 120; // minutes

        if (avgDeliveryTime <= targetTime) return 100;
        if (avgDeliveryTime >= maxTime) return 0;

        return Math.max(0, 100 - ((avgDeliveryTime - targetTime) / (maxTime - targetTime)) * 100);
    }

    /**
     * Calculate reliability score based on cancellations and suspensions
     */
    static calculateReliabilityScore(driver, cancelledDeliveries, totalDeliveries) {
        let score = 100;

        // Deduct points for cancellations
        if (totalDeliveries > 0) {
            const cancellationRate = (cancelledDeliveries / totalDeliveries) * 100;
            score -= cancellationRate * 2; // 2 points per 1% cancellation rate
        }

        // Deduct points for suspensions
        if (driver.isSuspended) {
            score -= 30; // 30 point penalty for suspension
        }

        // Bonus for being active
        if (driver.isActive && !driver.isSuspended) {
            score += 10;
        }

        return Math.max(0, Math.min(100, score));
    }

    /**
     * Calculate activity score based on recent activity and online status
     */
    static calculateActivityScore(driver, deliveries) {
        let score = 100;

        // Check last login (within 7 days = good, within 30 days = okay, beyond = poor)
        if (driver.lastLogin) {
            const daysSinceLastLogin = (Date.now() - driver.lastLogin.getTime()) / (1000 * 60 * 60 * 24);

            if (daysSinceLastLogin <= 7) {
                score += 20; // Bonus for recent activity
            } else if (daysSinceLastLogin <= 30) {
                score += 0; // Neutral
            } else {
                score -= 30; // Penalty for inactivity
            }
        } else {
            score -= 50; // No login history
        }

        // Online status bonus
        if (driver.isOnline) {
            score += 15;
        }

        // Recent deliveries bonus (last 7 days)
        const recentDeliveries = deliveries.filter(d => {
            const deliveryDate = d.deliveredAt || d.createdAt;
            return deliveryDate && (Date.now() - deliveryDate.getTime()) <= 7 * 24 * 60 * 60 * 1000;
        });

        if (recentDeliveries.length > 0) {
            score += Math.min(20, recentDeliveries.length * 5); // Up to 20 points for recent activity
        }

        return Math.max(0, Math.min(100, score));
    }

    /**
     * Calculate earnings performance score
     */
    static calculateEarningsScore(driver, deliveries) {
        if (driver.totalEarnings === 0 || driver.completedDeliveries === 0) {
            return 100; // New driver
        }

        const avgEarningsPerDelivery = driver.totalEarnings / driver.completedDeliveries;

        // Score based on earnings per delivery
        // Target: ₺100 per delivery, Min: ₺50, Max: ₺200
        const targetEarnings = 100;
        const minEarnings = 50;
        const maxEarnings = 200;

        if (avgEarningsPerDelivery >= targetEarnings) {
            return 100;
        } else if (avgEarningsPerDelivery <= minEarnings) {
            return 0;
        } else {
            return ((avgEarningsPerDelivery - minEarnings) / (targetEarnings - minEarnings)) * 100;
        }
    }

    /**
     * Calculate overall rating from individual metrics
     */
    static calculateOverallRating(metrics) {
        const weights = {
            completionRate: 0.30,    // 30%
            efficiencyScore: 0.25,    // 25%
            reliabilityScore: 0.20,   // 20%
            activityScore: 0.15,      // 15%
            earningsScore: 0.10       // 10%
        };

        const weightedScore = (
            metrics.completionRate * weights.completionRate +
            metrics.efficiencyScore * weights.efficiencyScore +
            metrics.reliabilityScore * weights.reliabilityScore +
            metrics.activityScore * weights.activityScore +
            metrics.earningsScore * weights.earningsScore
        );

        // Convert to 5-star rating
        const finalRating = Math.max(1, Math.min(5, (weightedScore / 20) + 1));

        // Generate factors for transparency
        const factors = [];
        if (metrics.completionRate >= 90) factors.push('Excellent completion rate');
        if (metrics.completionRate < 70) factors.push('Low completion rate');
        if (metrics.efficiencyScore >= 80) factors.push('High efficiency');
        if (metrics.efficiencyScore < 60) factors.push('Slow delivery times');
        if (metrics.reliabilityScore >= 90) factors.push('Very reliable');
        if (metrics.reliabilityScore < 70) factors.push('Reliability concerns');
        if (metrics.activityScore >= 80) factors.push('Highly active');
        if (metrics.activityScore < 60) factors.push('Low activity');
        if (metrics.earningsScore >= 80) factors.push('Good earnings performance');
        if (metrics.earningsScore < 60) factors.push('Low earnings performance');

        return {
            finalRating: Math.round(finalRating * 10) / 10, // Round to 1 decimal
            score: Math.round(weightedScore),
            breakdown: {
                completionRate: Math.round(metrics.completionRate),
                efficiency: Math.round(metrics.efficiencyScore),
                reliability: Math.round(metrics.reliabilityScore),
                activity: Math.round(metrics.activityScore),
                earnings: Math.round(metrics.earningsScore)
            },
            factors,
            metrics: {
                totalDeliveries: metrics.totalDeliveries,
                completedDeliveries: metrics.completedDeliveries,
                cancelledDeliveries: metrics.cancelledDeliveries
            }
        };
    }

    /**
     * Recalculate ratings for all drivers
     */
    static async recalculateAllRatings() {
        try {
            const drivers = await Driver.find({});
            const results = [];

            for (const driver of drivers) {
                try {
                    const rating = await this.calculateDriverRating(driver._id);
                    results.push({
                        driverId: driver._id,
                        driverName: driver.name,
                        rating: rating.finalRating,
                        score: rating.score
                    });
                } catch (error) {
                    console.error(`Error calculating rating for driver ${driver._id}:`, error);
                    results.push({
                        driverId: driver._id,
                        driverName: driver.name,
                        error: error.message
                    });
                }
            }

            return results;
        } catch (error) {
            console.error('Error recalculating all ratings:', error);
            throw error;
        }
    }

    /**
     * Get rating breakdown for a driver
     */
    static async getDriverRatingBreakdown(driverId) {
        try {
            const rating = await this.calculateDriverRating(driverId);
            return rating;
        } catch (error) {
            console.error('Error getting driver rating breakdown:', error);
            throw error;
        }
    }
}

module.exports = DriverRatingService; 