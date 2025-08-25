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
            const driver = await Driver.findById(driverId);
            if (!driver) {
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

            // Calculate earnings using the delivery controller method
            const DeliveryController = require('../controllers/deliveryController');
            const earningsResult = await DeliveryController.calculateDriverEarnings(deliveryId);

            return {
                success: true,
                message: 'Earnings calculated successfully',
                earnings: earningsResult.totalEarnings,
                details: earningsResult
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
