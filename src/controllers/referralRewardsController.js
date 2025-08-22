const ReferralRewardsService = require('../services/referralRewardsService');
const { successResponse, errorResponse, catchAsync } = require('../middleware/errorHandler');

class ReferralRewardsController {
    /**
     * Get current referral rewards configuration
     */
    static getConfiguration = catchAsync(async (req, res) => {
        const config = await ReferralRewardsService.getActiveConfig();

        return successResponse(res, config, 'Referral rewards configuration retrieved successfully');
    });

    /**
     * Create or update referral rewards configuration
     */
    static saveConfiguration = catchAsync(async (req, res) => {
        const { user } = req;
        const configData = req.body;

        const config = await ReferralRewardsService.saveConfiguration(configData, user.id);

        return successResponse(res, config, 'Referral rewards configuration saved successfully');
    });

    /**
     * Get referral program statistics
     */
    static getReferralStats = catchAsync(async (req, res) => {
        const stats = await ReferralRewardsService.getReferralStats();

        return successResponse(res, stats, 'Referral statistics retrieved successfully');
    });

    /**
     * Calculate rewards for a specific delivery
     */
    static calculateDeliveryRewards = catchAsync(async (req, res) => {
        const { deliveryId, driverId } = req.params;

        const result = await ReferralRewardsService.calculateDeliveryRewards(deliveryId, driverId);

        return successResponse(res, result, 'Delivery rewards calculated successfully');
    });

    /**
     * Process rewards for a completed delivery
     */
    static processDeliveryRewards = catchAsync(async (req, res) => {
        const { deliveryId, driverId } = req.params;

        // Calculate rewards
        const { rewards } = await ReferralRewardsService.calculateDeliveryRewards(deliveryId, driverId);

        if (rewards.length === 0) {
            return successResponse(res, { rewards: [] }, 'No rewards to process');
        }

        // Process and award rewards
        const processedRewards = await ReferralRewardsService.processRewards(rewards);

        return successResponse(res, {
            rewards: processedRewards,
            totalPointsAwarded: processedRewards.reduce((sum, r) => sum + r.points, 0)
        }, 'Rewards processed successfully');
    });

    /**
     * Calculate monthly leaderboard rewards
     */
    static calculateMonthlyLeaderboard = catchAsync(async (req, res) => {
        const { month, year } = req.query;
        const currentDate = new Date();

        const targetMonth = month ? parseInt(month) : currentDate.getMonth() + 1;
        const targetYear = year ? parseInt(year) : currentDate.getFullYear();

        const rewards = await ReferralRewardsService.calculateMonthlyLeaderboardRewards(targetMonth, targetYear);

        return successResponse(res, {
            month: targetMonth,
            year: targetYear,
            rewards: rewards,
            totalPointsAwarded: rewards.reduce((sum, r) => sum + r.points, 0)
        }, 'Monthly leaderboard rewards calculated successfully');
    });

    /**
     * Get all referral configurations (for admin management)
     */
    static getAllConfigurations = catchAsync(async (req, res) => {
        const ReferralRewardsConfig = require('../models/ReferralRewardsConfig');
        const { page = 1, limit = 10, status } = req.query;

        const query = {};
        if (status) {
            query.status = status;
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [configs, total] = await Promise.all([
            ReferralRewardsConfig.find(query)
                .populate('createdBy', 'name email')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit)),
            ReferralRewardsConfig.countDocuments(query)
        ]);

        return successResponse(res, {
            configs,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        }, 'Referral configurations retrieved successfully');
    });

    /**
     * Get configuration by ID
     */
    static getConfigurationById = catchAsync(async (req, res) => {
        const { configId } = req.params;
        const ReferralRewardsConfig = require('../models/ReferralRewardsConfig');

        const config = await ReferralRewardsConfig.findById(configId)
            .populate('createdBy', 'name email');

        if (!config) {
            return errorResponse(res, 'Configuration not found', 404);
        }

        return successResponse(res, config, 'Configuration retrieved successfully');
    });

    /**
     * Update configuration status
     */
    static updateConfigurationStatus = catchAsync(async (req, res) => {
        const { configId } = req.params;
        const { status } = req.body;
        const ReferralRewardsConfig = require('../models/ReferralRewardsConfig');

        const config = await ReferralRewardsConfig.findById(configId);
        if (!config) {
            return errorResponse(res, 'Configuration not found', 404);
        }

        // If activating this config, deactivate others
        if (status === 'active') {
            await ReferralRewardsConfig.updateMany(
                { _id: { $ne: configId } },
                { status: 'inactive' }
            );
        }

        config.status = status;
        await config.save();

        return successResponse(res, config, 'Configuration status updated successfully');
    });

    /**
     * Delete configuration
     */
    static deleteConfiguration = catchAsync(async (req, res) => {
        const { configId } = req.params;
        const ReferralRewardsConfig = require('../models/ReferralRewardsConfig');

        const config = await ReferralRewardsConfig.findById(configId);
        if (!config) {
            return errorResponse(res, 'Configuration not found', 404);
        }

        // Don't allow deletion of active configuration
        if (config.status === 'active') {
            return errorResponse(res, 'Cannot delete active configuration. Please deactivate it first.', 400);
        }

        await ReferralRewardsConfig.findByIdAndDelete(configId);

        return successResponse(res, null, 'Configuration deleted successfully');
    });

    /**
     * Get profitability analysis
     */
    static getProfitabilityAnalysis = catchAsync(async (req, res) => {
        const config = await ReferralRewardsService.getActiveConfig();

        // Calculate potential costs
        const maxPointsPerReferee = config.calculateMaxPointsPerReferee();
        const monthlyBudget = config.profitabilityControls.monthlyReferralBudget;
        const maxBudgetPercentage = config.profitabilityControls.maxReferralBudgetPercentage;

        // Example calculation for 100 deliveries
        const exampleDeliveries = 100;
        const exampleRevenue = exampleDeliveries * 150; // ₺150 per delivery
        const exampleCompanyShare = exampleDeliveries * 50; // ₺50 company share
        const maxReferralCost = exampleCompanyShare * (maxBudgetPercentage / 100);

        const analysis = {
            config: {
                name: config.name,
                status: config.status,
                isActive: config.isActive
            },
            profitabilityControls: {
                maxPointsPerReferee,
                monthlyBudget,
                maxBudgetPercentage,
                maxReferralCost
            },
            exampleScenario: {
                deliveries: exampleDeliveries,
                totalRevenue: exampleRevenue,
                companyShare: exampleCompanyShare,
                maxReferralCost: maxReferralCost,
                netProfit: exampleCompanyShare - maxReferralCost,
                profitMargin: ((exampleCompanyShare - maxReferralCost) / exampleCompanyShare * 100).toFixed(1)
            },
            rewards: {
                activationBonus: config.activationBonus,
                perDeliveryReward: config.perDeliveryReward,
                milestones: config.milestones.rewards,
                leaderboardRewards: config.leaderboardRewards.rewards
            }
        };

        return successResponse(res, analysis, 'Profitability analysis retrieved successfully');
    });
}

module.exports = ReferralRewardsController;
