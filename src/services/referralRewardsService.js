const ReferralRewardsConfig = require('../models/ReferralRewardsConfig');
const Referral = require('../models/Referral');
const Driver = require('../models/Driver');
const Delivery = require('../models/Delivery');

class ReferralRewardsService {
    /**
     * Get active referral rewards configuration
     */
    static async getActiveConfig() {
        let config = await ReferralRewardsConfig.getActiveConfig();

        if (!config) {
            // Create default configuration if none exists
            config = new ReferralRewardsConfig({
                name: 'Default Referral Rewards',
                description: 'Greep SDS Referral Rewards Program',
                createdBy: '688973b69cd2d8234f26bd39', // Default admin ID
                status: 'active'
            });
            await config.save();
        }

        return config;
    }

    /**
     * Calculate rewards for a completed delivery
     */
    static async calculateDeliveryRewards(deliveryId, driverId) {
        try {
            const config = await this.getActiveConfig();
            const delivery = await Delivery.findById(deliveryId);

            if (!delivery || !config.perDeliveryReward.enabled) {
                return { rewards: [] };
            }

            // Find referral relationship
            const referral = await Referral.findOne({
                referred: driverId,
                status: 'pending'
            }).populate('referrer', 'referralPoints');

            if (!referral) {
                return { rewards: [] };
            }

            const rewards = [];

            // Check if this is within the max deliveries limit
            const refereeDeliveries = await Delivery.countDocuments({
                driver: driverId,
                status: 'delivered',
                createdAt: { $gte: referral.registeredAt }
            });

            if (refereeDeliveries <= config.perDeliveryReward.maxDeliveriesPerReferee) {
                // Per-delivery reward
                rewards.push({
                    type: 'per_delivery',
                    referrerId: referral.referrer._id,
                    refereeId: driverId,
                    points: config.perDeliveryReward.referrerPoints,
                    description: `₺${config.perDeliveryReward.referrerPoints} points for delivery #${refereeDeliveries}`,
                    deliveryId: deliveryId
                });
            }

            // Check for milestone rewards
            if (config.milestones.enabled) {
                const milestone = config.milestones.rewards.find(m => m.deliveryCount === refereeDeliveries);
                if (milestone) {
                    rewards.push({
                        type: 'milestone',
                        referrerId: referral.referrer._id,
                        refereeId: driverId,
                        points: milestone.points,
                        description: milestone.description,
                        deliveryId: deliveryId,
                        milestone: milestone.deliveryCount
                    });
                }
            }

            // Check for activation bonus
            if (config.activationBonus.enabled && refereeDeliveries === config.activationBonus.requiredDeliveries) {
                rewards.push({
                    type: 'activation_bonus',
                    referrerId: referral.referrer._id,
                    refereeId: driverId,
                    points: config.activationBonus.referrerPoints,
                    description: `Activation bonus: ₺${config.activationBonus.referrerPoints} points`,
                    deliveryId: deliveryId
                });

                // Also give bonus to referee
                rewards.push({
                    type: 'activation_bonus_referee',
                    referrerId: referral.referrer._id,
                    refereeId: driverId,
                    points: config.activationBonus.refereePoints,
                    description: `Welcome bonus: ₺${config.activationBonus.refereePoints} points`,
                    deliveryId: deliveryId
                });
            }

            return { rewards, referral };
        } catch (error) {
            console.error('Error calculating delivery rewards:', error);
            throw error;
        }
    }

    /**
     * Process and award rewards
     */
    static async processRewards(rewards) {
        try {
            const config = await this.getActiveConfig();
            const processedRewards = [];

            for (const reward of rewards) {
                // Check profitability controls
                const canAward = await this.checkProfitabilityControls(reward, config);

                if (!canAward) {
                    console.log(`Skipping reward due to profitability controls: ${reward.description}`);
                    continue;
                }

                // Award points to the recipient
                const recipientId = reward.type === 'activation_bonus_referee' ? reward.refereeId : reward.referrerId;

                await Driver.findByIdAndUpdate(recipientId, {
                    $inc: { referralPoints: reward.points }
                });

                // Create reward record
                const rewardRecord = {
                    type: reward.type,
                    referrerId: reward.referrerId,
                    refereeId: reward.refereeId,
                    recipientId: recipientId,
                    points: reward.points,
                    description: reward.description,
                    deliveryId: reward.deliveryId,
                    milestone: reward.milestone,
                    awardedAt: new Date(),
                    configId: config._id
                };

                processedRewards.push(rewardRecord);

                console.log(`Awarded ${reward.points} points to ${recipientId} for ${reward.description}`);
            }

            return processedRewards;
        } catch (error) {
            console.error('Error processing rewards:', error);
            throw error;
        }
    }

    /**
     * Check profitability controls before awarding rewards
     */
    static async checkProfitabilityControls(reward, config) {
        try {
            // Check monthly budget
            const currentMonth = new Date();
            currentMonth.setDate(1);
            currentMonth.setHours(0, 0, 0, 0);

            const monthlyRewards = await this.getMonthlyRewardsTotal(currentMonth);
            if (monthlyRewards + reward.points > config.profitabilityControls.monthlyReferralBudget) {
                return false;
            }

            // Check per-referee limit
            const refereeTotalRewards = await this.getRefereeTotalRewards(reward.refereeId);
            if (refereeTotalRewards + reward.points > config.profitabilityControls.maxPointsPerReferee) {
                return false;
            }

            return true;
        } catch (error) {
            console.error('Error checking profitability controls:', error);
            return false;
        }
    }

    /**
     * Get total rewards awarded in a month
     */
    static async getMonthlyRewardsTotal(startOfMonth) {
        // This would query a rewards history collection
        // For now, return 0 as placeholder
        return 0;
    }

    /**
     * Get total rewards for a specific referee
     */
    static async getRefereeTotalRewards(refereeId) {
        // This would query a rewards history collection
        // For now, return 0 as placeholder
        return 0;
    }

    /**
     * Calculate monthly leaderboard rewards
     */
    static async calculateMonthlyLeaderboardRewards(month, year) {
        try {
            const config = await this.getActiveConfig();

            if (!config.leaderboardRewards.enabled) {
                return [];
            }

            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0, 23, 59, 59, 999);

            // Get top referrers for the month
            const leaderboard = await Referral.aggregate([
                {
                    $match: {
                        status: 'completed',
                        completedAt: { $gte: startDate, $lte: endDate }
                    }
                },
                {
                    $group: {
                        _id: '$referrer',
                        completedReferrals: { $sum: 1 },
                        totalPoints: { $sum: '$rewards.referrer' }
                    }
                },
                {
                    $sort: { completedReferrals: -1, totalPoints: -1 }
                },
                {
                    $limit: Math.max(...config.leaderboardRewards.rewards.map(r => r.rank))
                }
            ]);

            const rewards = [];

            config.leaderboardRewards.rewards.forEach(leaderboardReward => {
                const referrer = leaderboard[leaderboardReward.rank - 1];
                if (referrer) {
                    rewards.push({
                        type: 'leaderboard',
                        referrerId: referrer._id,
                        points: leaderboardReward.points,
                        description: leaderboardReward.description,
                        rank: leaderboardReward.rank,
                        month: month,
                        year: year
                    });
                }
            });

            return rewards;
        } catch (error) {
            console.error('Error calculating monthly leaderboard rewards:', error);
            throw error;
        }
    }

    /**
     * Get referral program statistics
     */
    static async getReferralStats() {
        try {
            const config = await this.getActiveConfig();

            const [
                totalReferrals,
                completedReferrals,
                totalPointsAwarded,
                activeReferrers
            ] = await Promise.all([
                Referral.countDocuments(),
                Referral.countDocuments({ status: 'completed' }),
                Driver.aggregate([
                    { $group: { _id: null, totalPoints: { $sum: '$referralPoints' } } }
                ]),
                Referral.distinct('referrer')
            ]);

            return {
                config: {
                    name: config.name,
                    isActive: config.isActive,
                    status: config.status
                },
                stats: {
                    totalReferrals,
                    completedReferrals,
                    completionRate: totalReferrals > 0 ? (completedReferrals / totalReferrals * 100).toFixed(1) : 0,
                    totalPointsAwarded: totalPointsAwarded[0]?.totalPoints || 0,
                    activeReferrers: activeReferrers.length
                },
                rewards: {
                    activationBonus: config.activationBonus,
                    perDeliveryReward: config.perDeliveryReward,
                    milestones: config.milestones.rewards,
                    leaderboardRewards: config.leaderboardRewards.rewards
                },
                controls: config.profitabilityControls
            };
        } catch (error) {
            console.error('Error getting referral stats:', error);
            throw error;
        }
    }

    /**
     * Validate and save configuration
     */
    static async saveConfiguration(configData, adminId) {
        try {
            const config = new ReferralRewardsConfig({
                ...configData,
                createdBy: adminId
            });

            // Validate configuration
            const errors = config.validateConfiguration();
            if (errors.length > 0) {
                throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
            }

            // Deactivate other configurations if this one is active
            if (config.status === 'active') {
                await ReferralRewardsConfig.updateMany(
                    { status: 'active' },
                    { status: 'inactive' }
                );
            }

            await config.save();
            return config;
        } catch (error) {
            console.error('Error saving referral configuration:', error);
            throw error;
        }
    }
}

module.exports = ReferralRewardsService;
