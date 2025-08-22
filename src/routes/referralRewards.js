const express = require('express');
const router = express.Router();
const { authenticateToken, adminOnly } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const Joi = require('joi');
const ReferralRewardsController = require('../controllers/referralRewardsController');

// Validation schemas
const referralRewardsSchemas = {
    saveConfiguration: Joi.object({
        name: Joi.string().required().max(100),
        description: Joi.string().max(500),
        isActive: Joi.boolean(),
        status: Joi.string().valid('draft', 'active', 'inactive', 'archived'),

        activationBonus: Joi.object({
            enabled: Joi.boolean(),
            requiredDeliveries: Joi.number().min(1).max(10),
            referrerPoints: Joi.number().min(0).max(100),
            refereePoints: Joi.number().min(0).max(50)
        }),

        perDeliveryReward: Joi.object({
            enabled: Joi.boolean(),
            referrerPoints: Joi.number().min(0).max(20),
            maxDeliveriesPerReferee: Joi.number().min(1).max(1000)
        }),

        milestones: Joi.object({
            enabled: Joi.boolean(),
            rewards: Joi.array().items(Joi.object({
                deliveryCount: Joi.number().min(5).required(),
                points: Joi.number().min(0).max(200).required(),
                description: Joi.string().max(200)
            }))
        }),

        leaderboardRewards: Joi.object({
            enabled: Joi.boolean(),
            rewards: Joi.array().items(Joi.object({
                rank: Joi.number().min(1).max(10).required(),
                points: Joi.number().min(0).max(500).required(),
                description: Joi.string().max(200)
            }))
        }),

        profitabilityControls: Joi.object({
            maxPointsPerReferee: Joi.number().min(0).max(1000),
            monthlyReferralBudget: Joi.number().min(0).max(10000),
            maxReferralBudgetPercentage: Joi.number().min(0).max(50)
        }),

        redemptionSettings: Joi.object({
            minimumPointsForCashout: Joi.number().min(0),
            cashoutFee: Joi.number().min(0).max(10),
            maxCashoutsPerMonth: Joi.number().min(1).max(10),
            allowFreeDeliveries: Joi.boolean(),
            pointsPerFreeDelivery: Joi.number().min(0)
        }),

        timeLimits: Joi.object({
            referralCodeExpiryDays: Joi.number().min(1).max(365),
            pointsExpiryDays: Joi.number().min(30).max(1095),
            activationBonusExpiryDays: Joi.number().min(1).max(365)
        })
    }),

    updateStatus: Joi.object({
        status: Joi.string().valid('draft', 'active', 'inactive', 'archived').required()
    })
};

// Public routes (for drivers to see current configuration)
router.get('/configuration', ReferralRewardsController.getConfiguration);
router.get('/stats', ReferralRewardsController.getReferralStats);

// Admin routes
router.get('/admin/configurations',
    authenticateToken,
    adminOnly,
    ReferralRewardsController.getAllConfigurations
);

router.get('/admin/configurations/:configId',
    authenticateToken,
    adminOnly,
    ReferralRewardsController.getConfigurationById
);

router.post('/admin/configurations',
    authenticateToken,
    adminOnly,
    validate(referralRewardsSchemas.saveConfiguration),
    ReferralRewardsController.saveConfiguration
);

router.put('/admin/configurations/:configId/status',
    authenticateToken,
    adminOnly,
    validate(referralRewardsSchemas.updateStatus),
    ReferralRewardsController.updateConfigurationStatus
);

router.delete('/admin/configurations/:configId',
    authenticateToken,
    adminOnly,
    ReferralRewardsController.deleteConfiguration
);

router.get('/admin/profitability-analysis',
    authenticateToken,
    adminOnly,
    ReferralRewardsController.getProfitabilityAnalysis
);

// Delivery reward processing routes
router.get('/delivery/:deliveryId/driver/:driverId/calculate',
    authenticateToken,
    adminOnly,
    ReferralRewardsController.calculateDeliveryRewards
);

router.post('/delivery/:deliveryId/driver/:driverId/process',
    authenticateToken,
    adminOnly,
    ReferralRewardsController.processDeliveryRewards
);

// Monthly leaderboard routes
router.get('/admin/leaderboard/monthly',
    authenticateToken,
    adminOnly,
    ReferralRewardsController.calculateMonthlyLeaderboard
);

module.exports = router;
