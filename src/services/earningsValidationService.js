const Delivery = require('../models/Delivery');
const Driver = require('../models/Driver');
const EarningsService = require('./earningsService');

class EarningsValidationService {
    /**
     * Validate that driver totals match the sum of their delivered deliveries
     * @param {string} driverId - Driver ID to validate
     * @returns {Object} Validation result with details
     */
    static async validateDriverEarnings(driverId) {
        try {
            console.log(`🔍 Validating earnings for driver: ${driverId}`);

            if (!driverId) {
                console.error('❌ Driver ID is undefined or null');
                return {
                    isValid: false,
                    error: 'Driver ID is undefined or null',
                    details: null
                };
            }

            const driver = await Driver.findById(driverId);
            if (!driver) {
                console.error(`❌ Driver not found with ID: ${driverId}`);
                return {
                    isValid: false,
                    error: 'Driver not found',
                    details: null
                };
            }

            // Get all delivered deliveries for this driver
            const deliveredDeliveries = await Delivery.find({
                assignedTo: driverId,
                status: 'delivered'
            });

            // Calculate actual totals from deliveries
            const actualTotalEarnings = deliveredDeliveries.reduce((sum, delivery) => sum + (delivery.driverEarning || 0), 0);
            const actualTotalDeliveries = deliveredDeliveries.length;

            // Check for mismatches
            const earningsMatch = driver.totalEarnings === actualTotalEarnings;
            const deliveriesMatch = driver.totalDeliveries === actualTotalDeliveries;
            const completedDeliveriesMatch = driver.completedDeliveries === actualTotalDeliveries;

            const isValid = earningsMatch && deliveriesMatch && completedDeliveriesMatch;

            return {
                isValid,
                driverId,
                driverName: driver.name,
                driverTotals: {
                    totalEarnings: driver.totalEarnings,
                    totalDeliveries: driver.totalDeliveries,
                    completedDeliveries: driver.completedDeliveries
                },
                actualTotals: {
                    totalEarnings: actualTotalEarnings,
                    totalDeliveries: actualTotalDeliveries,
                    completedDeliveries: actualTotalDeliveries
                },
                mismatches: {
                    earnings: !earningsMatch,
                    deliveries: !deliveriesMatch,
                    completedDeliveries: !completedDeliveriesMatch
                },
                deliveredDeliveriesCount: actualTotalDeliveries
            };
        } catch (error) {
            console.error('Error validating driver earnings:', error);
            return {
                isValid: false,
                error: error.message,
                details: null
            };
        }
    }

    /**
     * Fix driver earnings if validation fails
     * @param {string} driverId - Driver ID to fix
     * @returns {Object} Fix result
     */
    static async fixDriverEarnings(driverId) {
        try {
            const validation = await this.validateDriverEarnings(driverId);

            if (validation.isValid) {
                return {
                    success: true,
                    message: 'Driver earnings are already valid',
                    validation
                };
            }

            if (validation.error) {
                return {
                    success: false,
                    error: validation.error
                };
            }

            // Fix the driver's totals
            await Driver.findByIdAndUpdate(driverId, {
                totalEarnings: validation.actualTotals.totalEarnings,
                totalDeliveries: validation.actualTotals.totalDeliveries,
                completedDeliveries: validation.actualTotals.completedDeliveries
            });

            // Re-validate after fix
            const postFixValidation = await this.validateDriverEarnings(driverId);

            return {
                success: true,
                message: 'Driver earnings fixed successfully',
                beforeFix: validation,
                afterFix: postFixValidation
            };
        } catch (error) {
            console.error('Error fixing driver earnings:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Validate all drivers' earnings
     * @returns {Object} Validation results for all drivers
     */
    static async validateAllDriversEarnings() {
        try {
            const drivers = await Driver.find({});
            const results = [];

            for (const driver of drivers) {
                const validation = await this.validateDriverEarnings(driver._id);
                results.push(validation);
            }

            const validCount = results.filter(r => r.isValid).length;
            const invalidCount = results.filter(r => !r.isValid).length;

            return {
                totalDrivers: drivers.length,
                validDrivers: validCount,
                invalidDrivers: invalidCount,
                results
            };
        } catch (error) {
            console.error('Error validating all drivers earnings:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Ensure delivery has earnings calculated when marked as delivered
     * @param {string} deliveryId - Delivery ID to check
     * @returns {Object} Result of earnings calculation
     */
    static async ensureDeliveryEarningsCalculated(deliveryId) {
        try {
            const delivery = await Delivery.findById(deliveryId);
            if (!delivery) {
                return {
                    success: false,
                    error: 'Delivery not found'
                };
            }

            if (delivery.status !== 'delivered') {
                return {
                    success: false,
                    error: 'Delivery is not in delivered status'
                };
            }

            if (delivery.earningsCalculated && delivery.driverEarning > 0) {
                return {
                    success: true,
                    message: 'Earnings already calculated',
                    earnings: delivery.driverEarning
                };
            }

            // Calculate earnings using the earnings service directly to avoid circular dependency
            const EarningsService = require('./earningsService');
            const earningsCalculation = await EarningsService.calculateEarnings(delivery.fee);
            const baseEarnings = earningsCalculation.driverEarning;

            // Calculate bonuses
            let totalBonus = 0;

            // Priority bonus (10% for high priority)
            if (delivery.priority === 'high') {
                totalBonus += Math.round(baseEarnings * 0.1);
            }

            // Speed bonus (5% if completed within estimated time)
            if (delivery.estimatedTime && delivery.deliveredAt && delivery.assignedAt) {
                const estimatedMinutes = delivery.estimatedTime;
                const actualMinutes = (delivery.deliveredAt - delivery.assignedAt) / (1000 * 60);

                if (actualMinutes <= estimatedMinutes) {
                    totalBonus += Math.round(baseEarnings * 0.05);
                }
            }

            // Rating bonus (2% for 5-star rating)
            // Note: Rating bonus calculation moved to centralized earnings calculation
            // This ensures consistency and avoids duplicate logic
            if (delivery.assignedTo) {
                const driver = await Driver.findById(delivery.assignedTo);
                if (driver && driver.rating >= 4.5) {
                    totalBonus += Math.round(baseEarnings * 0.02);
                }
            }

            const totalEarnings = baseEarnings + totalBonus;

            // Update delivery with calculated earnings
            delivery.driverEarning = totalEarnings;
            delivery.earningsCalculated = true;
            delivery.earningsCalculationDate = new Date();
            await delivery.save({ validateBeforeSave: false });

            return {
                success: true,
                message: 'Earnings calculated successfully',
                earnings: totalEarnings,
                details: {
                    baseEarnings,
                    totalBonus,
                    totalEarnings
                }
            };
        } catch (error) {
            console.error('Error ensuring delivery earnings calculated:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = EarningsValidationService;
