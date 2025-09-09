const Driver = require('../models/Driver');
const Delivery = require('../models/Delivery');
const AdminNotificationService = require('./adminNotificationService');

class DriverRatingService {
    /**
     * Calculate driver rating specifically for Greep SDS business model
     * Where admins dispatch deliveries and drivers pick them up
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
                        acceptanceRate: 100,
                        completionRate: 100,
                        responseTime: 100,
                        reliability: 100,
                        customerSatisfaction: 100
                    },
                    factors: ['New driver - default rating'],
                    greepSdsMetrics: {
                        totalAssigned: 0,
                        totalAccepted: 0,
                        totalCompleted: 0,
                        averageResponseTime: 0,
                        customerRating: 0
                    }
                };
            }

            // Calculate Greep SDS specific metrics
            const metrics = this.calculateGreepSdsMetrics(deliveries, driver);
            const rating = this.calculateGreepSdsRating(metrics, deliveries);

            // Store old rating for comparison
            const oldRating = driver.rating || 5.0;

            // Update driver's rating
            await Driver.findByIdAndUpdate(driverId, { rating: rating.finalRating });

            // Create notification if rating changed significantly (more than 0.5 difference)
            // Note: Individual rating update notifications removed to reduce noise.
            // Consider implementing weekly rating summary notifications instead.

            return rating;
        } catch (error) {
            console.error('Error calculating driver rating:', error);
            throw error;
        }
    }

    /**
     * Calculate Greep SDS specific performance metrics
     * Focused on admin-assigned delivery system
     */
    static calculateGreepSdsMetrics(deliveries, driver) {
        const totalAssigned = deliveries.length;
        const acceptedDeliveries = deliveries.filter(d => d.status !== 'pending' && d.status !== 'broadcasting');
        const completedDeliveries = deliveries.filter(d => d.status === 'delivered').length;
        const cancelledDeliveries = deliveries.filter(d => d.status === 'cancelled').length;
        const failedDeliveries = deliveries.filter(d => d.status === 'failed').length;

        // 1. ACCEPTANCE RATE (35% weight) - How often driver accepts admin-assigned deliveries
        const acceptanceRate = totalAssigned > 0 ? (acceptedDeliveries.length / totalAssigned) * 100 : 100;

        // 2. COMPLETION RATE (30% weight) - How often driver completes accepted deliveries
        const completionRate = acceptedDeliveries.length > 0 ? (completedDeliveries / acceptedDeliveries.length) * 100 : 100;

        // 3. RESPONSE TIME (20% weight) - How quickly driver responds to admin assignments
        const responseTimeScore = this.calculateResponseTimeScore(deliveries);

        // 4. RELIABILITY (10% weight) - Based on cancellations, failures, and suspensions
        const reliabilityScore = this.calculateGreepSdsReliabilityScore(driver, cancelledDeliveries, failedDeliveries, totalAssigned);

        // 5. CUSTOMER SATISFACTION (5% weight) - Based on customer ratings and feedback
        const customerSatisfactionScore = this.calculateCustomerSatisfactionScore(deliveries);

        return {
            acceptanceRate,
            completionRate,
            responseTimeScore,
            reliabilityScore,
            customerSatisfactionScore,
            totalAssigned,
            totalAccepted: acceptedDeliveries.length,
            totalCompleted: completedDeliveries,
            cancelledDeliveries,
            failedDeliveries
        };
    }

    /**
     * Calculate response time score - how quickly driver responds to admin assignments
     */
    static calculateResponseTimeScore(deliveries) {
        const acceptedDeliveries = deliveries.filter(d =>
            d.status !== 'pending' &&
            d.status !== 'broadcasting' &&
            d.assignedAt &&
            d.acceptedAt
        );

        if (acceptedDeliveries.length === 0) return 100;

        const responseTimes = acceptedDeliveries.map(delivery => {
            const assignedTime = new Date(delivery.assignedAt).getTime();
            const acceptedTime = new Date(delivery.acceptedAt).getTime();
            return (acceptedTime - assignedTime) / (1000 * 60); // Convert to minutes
        });

        const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;

        // Score based on average response time
        // Target: 2 minutes, Excellent: 1 minute, Poor: 10 minutes
        const targetTime = 2; // minutes
        const excellentTime = 1; // minutes
        const poorTime = 10; // minutes

        if (avgResponseTime <= excellentTime) return 100;
        if (avgResponseTime <= targetTime) return 90;
        if (avgResponseTime >= poorTime) return 0;

        // Linear interpolation between target and poor
        return Math.max(0, 90 - ((avgResponseTime - targetTime) / (poorTime - targetTime)) * 90);
    }

    /**
     * Calculate reliability score for Greep SDS
     */
    static calculateGreepSdsReliabilityScore(driver, cancelledDeliveries, failedDeliveries, totalAssigned) {
        let score = 100;

        // Deduct points for cancellations (major penalty in admin-assigned system)
        if (totalAssigned > 0) {
            const cancellationRate = (cancelledDeliveries / totalAssigned) * 100;
            score -= cancellationRate * 3; // 3 points per 1% cancellation rate (higher penalty)
        }

        // Deduct points for failed deliveries
        if (totalAssigned > 0) {
            const failureRate = (failedDeliveries / totalAssigned) * 100;
            score -= failureRate * 4; // 4 points per 1% failure rate (highest penalty)
        }

        // Deduct points for suspensions
        if (driver.isSuspended) {
            score -= 50; // 50 point penalty for suspension (higher penalty)
        }

        // Bonus for being active and online
        if (driver.isActive && !driver.isSuspended) {
            score += 15;
        }

        // Bonus for being online (shows availability for admin assignments)
        if (driver.isOnline) {
            score += 10;
        }

        return Math.max(0, Math.min(100, score));
    }

    /**
     * Calculate customer satisfaction score
     */
    static calculateCustomerSatisfactionScore(deliveries) {
        const ratedDeliveries = deliveries.filter(d => d.rating && d.rating > 0);

        if (ratedDeliveries.length === 0) return 100; // No ratings yet

        const avgRating = ratedDeliveries.reduce((sum, d) => sum + d.rating, 0) / ratedDeliveries.length;

        // Convert 5-star rating to percentage
        return (avgRating / 5) * 100;
    }

    /**
     * Calculate overall Greep SDS rating
     */
    static calculateGreepSdsRating(metrics, deliveries) {
        // Greep SDS specific weights
        const weights = {
            acceptanceRate: 0.35,           // 35% - Most important in admin-assigned system
            completionRate: 0.30,           // 30% - Second most important
            responseTimeScore: 0.20,        // 20% - Quick response to admin assignments
            reliabilityScore: 0.10,         // 10% - Reliability in completing assignments
            customerSatisfactionScore: 0.05 // 5% - Customer feedback
        };

        const weightedScore = (
            metrics.acceptanceRate * weights.acceptanceRate +
            metrics.completionRate * weights.completionRate +
            metrics.responseTimeScore * weights.responseTimeScore +
            metrics.reliabilityScore * weights.reliabilityScore +
            metrics.customerSatisfactionScore * weights.customerSatisfactionScore
        );

        // Convert to 5-star rating
        const finalRating = Math.max(1, Math.min(5, (weightedScore / 20) + 1));

        // Generate Greep SDS specific factors
        const factors = [];

        // Acceptance rate factors
        if (metrics.acceptanceRate >= 95) factors.push('Excellent assignment acceptance rate');
        if (metrics.acceptanceRate >= 85 && metrics.acceptanceRate < 95) factors.push('Good assignment acceptance rate');
        if (metrics.acceptanceRate < 70) factors.push('Low assignment acceptance rate - concern for admin workflow');

        // Completion rate factors
        if (metrics.completionRate >= 95) factors.push('Outstanding delivery completion rate');
        if (metrics.completionRate >= 85 && metrics.completionRate < 95) factors.push('Good delivery completion rate');
        if (metrics.completionRate < 80) factors.push('Low completion rate - impacts customer satisfaction');

        // Response time factors
        if (metrics.responseTimeScore >= 90) factors.push('Excellent response time to admin assignments');
        if (metrics.responseTimeScore >= 75 && metrics.responseTimeScore < 90) factors.push('Good response time to assignments');
        if (metrics.responseTimeScore < 60) factors.push('Slow response to admin assignments');

        // Reliability factors
        if (metrics.reliabilityScore >= 90) factors.push('Highly reliable driver');
        if (metrics.reliabilityScore < 70) factors.push('Reliability concerns - frequent cancellations/failures');

        // Customer satisfaction factors
        if (metrics.customerSatisfactionScore >= 90) factors.push('Excellent customer satisfaction');
        if (metrics.customerSatisfactionScore < 70) factors.push('Customer satisfaction needs improvement');

        // Special Greep SDS factors
        if (metrics.totalAssigned >= 50) factors.push('Experienced Greep SDS driver');
        if (metrics.cancelledDeliveries === 0 && metrics.totalAssigned > 10) factors.push('Perfect reliability record');
        if (metrics.failedDeliveries > 0) factors.push('Has delivery failures - needs attention');

        return {
            finalRating: Math.round(finalRating * 10) / 10, // Round to 1 decimal
            score: Math.round(weightedScore),
            breakdown: {
                acceptanceRate: Math.round(metrics.acceptanceRate),
                completionRate: Math.round(metrics.completionRate),
                responseTime: Math.round(metrics.responseTimeScore),
                reliability: Math.round(metrics.reliabilityScore),
                customerSatisfaction: Math.round(metrics.customerSatisfactionScore)
            },
            factors,
            greepSdsMetrics: {
                totalAssigned: metrics.totalAssigned,
                totalAccepted: metrics.totalAccepted,
                totalCompleted: metrics.totalCompleted,
                averageResponseTime: this.calculateAverageResponseTime(deliveries),
                customerRating: this.calculateAverageCustomerRating(deliveries),
                cancellationRate: metrics.totalAssigned > 0 ? Math.round((metrics.cancelledDeliveries / metrics.totalAssigned) * 100) : 0,
                failureRate: metrics.totalAssigned > 0 ? Math.round((metrics.failedDeliveries / metrics.totalAssigned) * 100) : 0
            }
        };
    }

    /**
     * Calculate average response time in minutes
     */
    static calculateAverageResponseTime(deliveries) {
        if (!deliveries || deliveries.length === 0) return 0;

        const acceptedDeliveries = deliveries.filter(d =>
            d.status !== 'pending' &&
            d.status !== 'broadcasting' &&
            d.assignedAt &&
            d.acceptedAt
        );

        if (acceptedDeliveries.length === 0) return 0;

        const responseTimes = acceptedDeliveries.map(delivery => {
            const assignedTime = new Date(delivery.assignedAt).getTime();
            const acceptedTime = new Date(delivery.acceptedAt).getTime();
            return (acceptedTime - assignedTime) / (1000 * 60); // Convert to minutes
        });

        return Math.round(responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length);
    }

    /**
     * Calculate average customer rating
     */
    static calculateAverageCustomerRating(deliveries) {
        if (!deliveries || deliveries.length === 0) return 0;

        const ratedDeliveries = deliveries.filter(d => d.rating && d.rating > 0);

        if (ratedDeliveries.length === 0) return 0;

        const avgRating = ratedDeliveries.reduce((sum, d) => sum + d.rating, 0) / ratedDeliveries.length;
        return Math.round(avgRating * 10) / 10; // Round to 1 decimal
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
                        score: rating.score,
                        greepSdsMetrics: rating.greepSdsMetrics
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

    /**
     * Get Greep SDS specific driver insights
     */
    static async getGreepSdsDriverInsights(driverId) {
        try {
            const rating = await this.calculateDriverRating(driverId);
            const driver = await Driver.findById(driverId);

            return {
                driverId,
                driverName: driver.name,
                rating: rating.finalRating,
                score: rating.score,
                greepSdsMetrics: rating.greepSdsMetrics,
                breakdown: rating.breakdown,
                factors: rating.factors,
                recommendations: this.generateGreepSdsRecommendations(rating)
            };
        } catch (error) {
            console.error('Error getting Greep SDS driver insights:', error);
            throw error;
        }
    }

    /**
     * Generate Greep SDS specific recommendations
     */
    static generateGreepSdsRecommendations(rating) {
        const recommendations = [];

        if (rating.breakdown.acceptanceRate < 80) {
            recommendations.push('Improve assignment acceptance rate to maintain good standing with admin team');
        }

        if (rating.breakdown.completionRate < 85) {
            recommendations.push('Focus on completing accepted deliveries to improve reliability score');
        }

        if (rating.breakdown.responseTime < 70) {
            recommendations.push('Respond faster to admin assignments to improve efficiency');
        }

        if (rating.greepSdsMetrics.cancellationRate > 10) {
            recommendations.push('Reduce cancellations to maintain admin trust and priority assignments');
        }

        if (rating.greepSdsMetrics.failureRate > 5) {
            recommendations.push('Address delivery failures to prevent suspension risk');
        }

        if (rating.breakdown.customerSatisfaction < 80) {
            recommendations.push('Improve customer service to maintain high satisfaction ratings');
        }

        if (recommendations.length === 0) {
            recommendations.push('Excellent performance! Continue maintaining high standards');
        }

        return recommendations;
    }
}

module.exports = DriverRatingService; 