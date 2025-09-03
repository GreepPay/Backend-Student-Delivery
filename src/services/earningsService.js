const Delivery = require('../models/Delivery');
const Driver = require('../models/Driver');
const EarningsConfig = require('../models/EarningsConfig');
const AdminNotificationService = require('./adminNotificationService');

class EarningsService {
    // Default earnings rules - Updated to match new structure
    static defaultEarningsRules = {
        rules: [
            {
                minFee: 0,
                maxFee: 100,
                driverPercentage: 60,
                driverFixed: null,
                companyPercentage: 40,
                companyFixed: null,
                description: 'Under 100: 60% driver, 40% company'
            },
            {
                minFee: 101,
                maxFee: 150,
                driverPercentage: null,
                driverFixed: 100,
                companyPercentage: null,
                companyFixed: 50,
                description: '100-150: 100 flat fee for driver, 50 for company'
            },
            {
                minFee: 151,
                maxFee: 999999,
                driverPercentage: 60,
                driverFixed: null,
                companyPercentage: 40,
                companyFixed: null,
                description: 'Above 150: 60% driver, 40% company'
            }
        ]
    };

    // Calculate earnings for a delivery based on fee
    static async calculateEarnings(fee, customRules = null) {
        let rules;

        if (customRules) {
            rules = customRules;
        } else {
            // Get active configuration from database
            const config = await EarningsConfig.getActiveConfig();
            rules = config ? config.getRulesArray() : this.defaultEarningsRules.rules;
        }

        // Find the applicable rule
        const applicableRule = rules.find(rule =>
            fee >= rule.minFee && fee <= rule.maxFee
        );

        if (!applicableRule) {
            throw new Error(`No earnings rule found for fee: ${fee}`);
        }

        let driverEarning, companyEarning;

        if (applicableRule.driverFixed !== null) {
            // Use fixed amount for driver
            driverEarning = applicableRule.driverFixed;
            companyEarning = fee - driverEarning;
        } else if (applicableRule.driverPercentage !== null) {
            // Use percentage for driver
            driverEarning = Math.round(fee * (applicableRule.driverPercentage / 100));
            companyEarning = fee - driverEarning;
        } else {
            throw new Error('Invalid earnings rule configuration');
        }

        return {
            driverEarning,
            companyEarning,
            ruleApplied: {
                minFee: applicableRule.minFee,
                maxFee: applicableRule.maxFee,
                driverPercentage: applicableRule.driverPercentage,
                driverFixed: applicableRule.driverFixed
            }
        };
    }

    // Check for earnings milestones
    static async checkEarningsMilestones(driverId) {
        try {
            const driver = await Driver.findById(driverId);
            if (!driver) return;

            const milestones = [100, 500, 1000, 2500, 5000, 10000];
            const currentEarnings = driver.totalEarnings || 0;

            for (const milestone of milestones) {
                if (currentEarnings >= milestone && !driver.achievedMilestones?.includes(milestone)) {
                    // Create milestone notification
                    try {
                        await AdminNotificationService.createEarningsMilestoneNotification(
                            driverId,
                            currentEarnings,
                            `₺${milestone}`
                        );
                    } catch (notificationError) {
                        console.error('Failed to create earnings milestone notification:', notificationError.message);
                    }

                    // Update driver's achieved milestones
                    const achievedMilestones = driver.achievedMilestones || [];
                    if (!achievedMilestones.includes(milestone)) {
                        await Driver.findByIdAndUpdate(driverId, {
                            $push: { achievedMilestones: milestone }
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Error checking earnings milestones:', error);
        }
    }

    // Update delivery earnings when fee changes
    static async updateDeliveryEarnings(deliveryId, customRules = null) {
        try {
            const delivery = await Delivery.findById(deliveryId);
            if (!delivery) {
                throw new Error('Delivery not found');
            }

            const earnings = await this.calculateEarnings(delivery.fee, customRules);

            const updatedDelivery = await Delivery.findByIdAndUpdate(
                deliveryId,
                {
                    driverEarning: earnings.driverEarning,
                    companyEarning: earnings.companyEarning
                },
                { new: true }
            );

            // Check for earnings milestones after updating earnings
            if (delivery.assignedTo) {
                await this.checkEarningsMilestones(delivery.assignedTo);
            }

            return updatedDelivery;
        } catch (error) {
            console.error('Error updating delivery earnings:', error);
            throw error;
        }
    }

    // Bulk update earnings for multiple deliveries
    static async bulkUpdateEarnings(deliveryIds, customRules = null) {
        try {
            const results = [];

            for (const deliveryId of deliveryIds) {
                try {
                    const updatedDelivery = await this.updateDeliveryEarnings(deliveryId, customRules);
                    results.push({
                        deliveryId,
                        success: true,
                        data: updatedDelivery
                    });
                } catch (error) {
                    results.push({
                        deliveryId,
                        success: false,
                        error: error.message
                    });
                }
            }

            return results;
        } catch (error) {
            console.error('Error in bulk earnings update:', error);
            throw error;
        }
    }

    // Get earnings summary for a driver
    static async getDriverEarningsSummary(driverId, startDate = null, endDate = null) {
        try {
            const query = {
                assignedTo: driverId,
                status: 'delivered'
            };

            if (startDate && endDate) {
                query.deliveredAt = {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                };
            }

            const deliveries = await Delivery.find(query);

            // Get active earnings configuration
            const activeConfig = await EarningsConfig.getActiveConfig();
            const earningsRules = activeConfig ? activeConfig.getRulesArray() : this.defaultEarningsRules.rules;

            const summary = deliveries.reduce((acc, delivery) => {
                acc.totalDeliveries += 1;
                acc.totalRevenue += delivery.fee || 0;

                // Calculate earnings based on active configuration
                const deliveryFee = delivery.fee || 0;
                const applicableRule = earningsRules.find(rule =>
                    deliveryFee >= rule.minFee && deliveryFee <= rule.maxFee
                );

                let driverEarning, companyEarning;

                if (applicableRule) {
                    if (applicableRule.driverFixed !== null) {
                        // Use fixed amount for driver
                        driverEarning = applicableRule.driverFixed;
                        companyEarning = deliveryFee - driverEarning;
                    } else if (applicableRule.driverPercentage !== null) {
                        // Use percentage for driver
                        driverEarning = Math.round(deliveryFee * (applicableRule.driverPercentage / 100));
                        companyEarning = deliveryFee - driverEarning;
                    } else {
                        // Fallback to 50/50 split
                        driverEarning = Math.round(deliveryFee / 2);
                        companyEarning = deliveryFee - driverEarning;
                    }
                } else {
                    // Fallback to 50/50 split if no rule found
                    driverEarning = Math.round(deliveryFee / 2);
                    companyEarning = deliveryFee - driverEarning;
                }

                // For cash payments: driver owes company their cut
                // For other payments: company owes driver their earnings
                if (delivery.paymentMethod === 'cash') {
                    // Driver collected cash, owes company their cut
                    acc.totalRemissionOwed += companyEarning;
                    acc.totalEarnings += driverEarning;
                } else {
                    // Company collected payment, owes driver their earnings
                    acc.totalEarnings += driverEarning;
                    // No remission owed for non-cash payments
                }

                acc.totalCompanyEarnings += companyEarning;

                // Group by fee ranges
                if (deliveryFee <= 100) {
                    acc.range100 += 1;
                    acc.range100Earnings += driverEarning;
                } else if (deliveryFee <= 150) {
                    acc.range150 += 1;
                    acc.range150Earnings += driverEarning;
                } else {
                    acc.rangeOver150 += 1;
                    acc.rangeOver150Earnings += driverEarning;
                }

                return acc;
            }, {
                totalDeliveries: 0,
                totalEarnings: 0,
                totalRevenue: 0,
                totalCompanyEarnings: 0,
                totalRemissionOwed: 0,
                range100: 0,
                range100Earnings: 0,
                range150: 0,
                range150Earnings: 0,
                rangeOver150: 0,
                rangeOver150Earnings: 0
            });

            return summary;
        } catch (error) {
            console.error('Error getting driver earnings summary:', error);
            throw error;
        }
    }

    // Validate earnings rules
    static validateEarningsRules(rules) {
        if (!Array.isArray(rules) || rules.length === 0) {
            throw new Error('Earnings rules must be an array');
        }

        for (const rule of rules) {
            if (typeof rule.minFee !== 'number' || typeof rule.maxFee !== 'number') {
                throw new Error('minFee and maxFee must be numbers');
            }

            if (rule.minFee > rule.maxFee) {
                throw new Error('minFee cannot be greater than maxFee');
            }

            if (rule.driverFixed !== null && rule.driverPercentage !== null) {
                throw new Error('Cannot have both fixed and percentage for driver earnings');
            }

            if (rule.driverFixed === null && rule.driverPercentage === null) {
                throw new Error('Must specify either fixed amount or percentage for driver earnings');
            }

            if (rule.driverFixed !== null && rule.driverFixed < 0) {
                throw new Error('Driver fixed amount cannot be negative');
            }

            if (rule.driverPercentage !== null && (rule.driverPercentage < 0 || rule.driverPercentage > 100)) {
                throw new Error('Driver percentage must be between 0 and 100');
            }
        }

        return true;
    }

    // Get system earnings statistics
    static async getSystemEarningsStats(query = {}) {
        try {
            const deliveries = await Delivery.find({
                ...query,
                status: 'delivered'
            });

            const stats = deliveries.reduce((acc, delivery) => {
                acc.totalDeliveries += 1;
                acc.totalRevenue += delivery.fee;
                acc.totalDriverEarnings += delivery.driverEarning;
                acc.totalCompanyEarnings += delivery.companyEarning;

                // Group by fee ranges
                if (delivery.fee <= 100) {
                    acc.range100.count += 1;
                    acc.range100.revenue += delivery.fee;
                    acc.range100.driverEarnings += delivery.driverEarning;
                    acc.range100.companyEarnings += delivery.companyEarning;
                } else if (delivery.fee <= 150) {
                    acc.range150.count += 1;
                    acc.range150.revenue += delivery.fee;
                    acc.range150.driverEarnings += delivery.driverEarning;
                    acc.range150.companyEarnings += delivery.companyEarning;
                } else {
                    acc.rangeOver150.count += 1;
                    acc.rangeOver150.revenue += delivery.fee;
                    acc.rangeOver150.driverEarnings += delivery.driverEarning;
                    acc.rangeOver150.companyEarnings += delivery.companyEarning;
                }

                return acc;
            }, {
                totalDeliveries: 0,
                totalRevenue: 0,
                totalDriverEarnings: 0,
                totalCompanyEarnings: 0,
                range100: { count: 0, revenue: 0, driverEarnings: 0, companyEarnings: 0 },
                range150: { count: 0, revenue: 0, driverEarnings: 0, companyEarnings: 0 },
                rangeOver150: { count: 0, revenue: 0, driverEarnings: 0, companyEarnings: 0 }
            });

            return stats;
        } catch (error) {
            console.error('Error getting system earnings stats:', error);
            throw error;
        }
    }

    // Recalculate all deliveries with new earnings configuration
    static async recalculateAllDeliveries(config) {
        try {
            console.log('🔄 Starting bulk earnings recalculation...');

            const deliveries = await Delivery.find({});
            let updatedCount = 0;

            for (const delivery of deliveries) {
                try {
                    const earnings = await this.calculateEarnings(delivery.deliveryFee, config.rules);

                    // Update delivery with new earnings
                    delivery.driverEarning = earnings.driverEarning;
                    delivery.companyEarning = earnings.companyEarning;
                    delivery.earningsRuleApplied = earnings.ruleApplied;

                    await delivery.save();
                    updatedCount++;

                    // Update driver total earnings
                    if (delivery.assignedTo) {
                        await this.updateDriverTotalEarnings(delivery.assignedTo);
                    }
                } catch (error) {
                    console.error(`Error updating delivery ${delivery._id}:`, error);
                }
            }

            console.log(`✅ Bulk earnings recalculation completed. Updated ${updatedCount} deliveries.`);
            return updatedCount;
        } catch (error) {
            console.error('Error in bulk earnings recalculation:', error);
            throw error;
        }
    }

    // Update driver total earnings
    static async updateDriverTotalEarnings(driverId) {
        try {
            const driver = await Driver.findById(driverId);
            if (!driver) return;

            const earnings = await Delivery.aggregate([
                { $match: { assignedTo: driverId, status: 'delivered' } },
                {
                    $group: {
                        _id: null,
                        totalEarnings: { $sum: '$driverEarning' },
                        totalDeliveries: { $sum: 1 }
                    }
                }
            ]);

            if (earnings.length > 0) {
                driver.totalEarnings = earnings[0].totalEarnings;
                driver.totalDeliveries = earnings[0].totalDeliveries;
                driver.completedDeliveries = earnings[0].totalDeliveries; // Also update completedDeliveries
                await driver.save();
            }
        } catch (error) {
            console.error(`Error updating driver ${driverId} total earnings:`, error);
        }
    }
}

module.exports = EarningsService; 