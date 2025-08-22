const mongoose = require('mongoose');

const referralRewardsConfigSchema = new mongoose.Schema({
    // Basic configuration
    isActive: {
        type: Boolean,
        default: true
    },
    name: {
        type: String,
        required: true,
        default: 'Default Referral Rewards'
    },
    description: {
        type: String,
        default: 'Greep SDS Referral Rewards Program'
    },

    // Activation bonus (when referee completes first 3 deliveries)
    activationBonus: {
        enabled: {
            type: Boolean,
            default: true
        },
        requiredDeliveries: {
            type: Number,
            default: 3,
            min: 1,
            max: 10
        },
        referrerPoints: {
            type: Number,
            default: 15,
            min: 0,
            max: 100
        },
        refereePoints: {
            type: Number,
            default: 5,
            min: 0,
            max: 50
        }
    },

    // Per-delivery commission (ongoing rewards)
    perDeliveryReward: {
        enabled: {
            type: Boolean,
            default: true
        },
        referrerPoints: {
            type: Number,
            default: 5,
            min: 0,
            max: 20
        },
        maxDeliveriesPerReferee: {
            type: Number,
            default: 100,
            min: 1,
            max: 1000
        }
    },

    // Milestone bonuses
    milestones: {
        enabled: {
            type: Boolean,
            default: true
        },
        rewards: [{
            deliveryCount: {
                type: Number,
                required: true,
                min: 5
            },
            points: {
                type: Number,
                required: true,
                min: 0,
                max: 200
            },
            description: {
                type: String,
                default: ''
            }
        }]
    },

    // Monthly leaderboard bonuses
    leaderboardRewards: {
        enabled: {
            type: Boolean,
            default: true
        },
        rewards: [{
            rank: {
                type: Number,
                required: true,
                min: 1,
                max: 10
            },
            points: {
                type: Number,
                required: true,
                min: 0,
                max: 500
            },
            description: {
                type: String,
                default: ''
            }
        }]
    },

    // Profitability controls
    profitabilityControls: {
        maxPointsPerReferee: {
            type: Number,
            default: 200,
            min: 0,
            max: 1000
        },
        monthlyReferralBudget: {
            type: Number,
            default: 1000,
            min: 0,
            max: 10000
        },
        maxReferralBudgetPercentage: {
            type: Number,
            default: 20,
            min: 0,
            max: 50
        }
    },

    // Redemption settings
    redemptionSettings: {
        minimumPointsForCashout: {
            type: Number,
            default: 50,
            min: 0
        },
        cashoutFee: {
            type: Number,
            default: 0,
            min: 0,
            max: 10
        },
        maxCashoutsPerMonth: {
            type: Number,
            default: 2,
            min: 1,
            max: 10
        },
        allowFreeDeliveries: {
            type: Boolean,
            default: true
        },
        pointsPerFreeDelivery: {
            type: Number,
            default: 20,
            min: 0
        }
    },

    // Time limits and expiration
    timeLimits: {
        referralCodeExpiryDays: {
            type: Number,
            default: 30,
            min: 1,
            max: 365
        },
        pointsExpiryDays: {
            type: Number,
            default: 365,
            min: 30,
            max: 1095
        },
        activationBonusExpiryDays: {
            type: Number,
            default: 90,
            min: 1,
            max: 365
        }
    },

    // Created by admin
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
        required: true
    },

    // Status
    status: {
        type: String,
        enum: ['draft', 'active', 'inactive', 'archived'],
        default: 'draft'
    }
}, {
    timestamps: true
});

// Indexes
referralRewardsConfigSchema.index({ isActive: 1, status: 1 });
referralRewardsConfigSchema.index({ createdAt: -1 });

// Pre-save middleware to set default milestones and leaderboard rewards
referralRewardsConfigSchema.pre('save', function (next) {
    // Set default milestones if not provided
    if (this.milestones.enabled && (!this.milestones.rewards || this.milestones.rewards.length === 0)) {
        this.milestones.rewards = [
            { deliveryCount: 10, points: 20, description: '10 Deliveries Milestone' },
            { deliveryCount: 25, points: 35, description: '25 Deliveries Milestone' },
            { deliveryCount: 50, points: 50, description: '50 Deliveries Milestone' },
            { deliveryCount: 100, points: 100, description: '100 Deliveries Milestone' }
        ];
    }

    // Set default leaderboard rewards if not provided
    if (this.leaderboardRewards.enabled && (!this.leaderboardRewards.rewards || this.leaderboardRewards.rewards.length === 0)) {
        this.leaderboardRewards.rewards = [
            { rank: 1, points: 200, description: '1st Place - Monthly Top Referrer' },
            { rank: 2, points: 100, description: '2nd Place - Monthly Runner Up' },
            { rank: 3, points: 50, description: '3rd Place - Monthly Third Place' }
        ];
    }

    next();
});

// Static method to get active configuration
referralRewardsConfigSchema.statics.getActiveConfig = function () {
    return this.findOne({
        isActive: true,
        status: 'active'
    }).sort({ createdAt: -1 });
};

// Method to calculate total possible points for a referee
referralRewardsConfigSchema.methods.calculateMaxPointsPerReferee = function () {
    let totalPoints = 0;

    // Activation bonus
    if (this.activationBonus.enabled) {
        totalPoints += this.activationBonus.referrerPoints;
    }

    // Per-delivery rewards
    if (this.perDeliveryReward.enabled) {
        totalPoints += this.perDeliveryReward.referrerPoints * this.perDeliveryReward.maxDeliveriesPerReferee;
    }

    // Milestone rewards
    if (this.milestones.enabled) {
        this.milestones.rewards.forEach(milestone => {
            totalPoints += milestone.points;
        });
    }

    return Math.min(totalPoints, this.profitabilityControls.maxPointsPerReferee);
};

// Method to validate configuration
referralRewardsConfigSchema.methods.validateConfiguration = function () {
    const errors = [];

    // Check if total rewards don't exceed budget
    const maxPointsPerReferee = this.calculateMaxPointsPerReferee();
    if (maxPointsPerReferee > this.profitabilityControls.maxPointsPerReferee) {
        errors.push(`Total points per referee (${maxPointsPerReferee}) exceeds maximum allowed (${this.profitabilityControls.maxPointsPerReferee})`);
    }

    // Check milestone delivery counts are in ascending order
    if (this.milestones.enabled && this.milestones.rewards.length > 1) {
        for (let i = 1; i < this.milestones.rewards.length; i++) {
            if (this.milestones.rewards[i].deliveryCount <= this.milestones.rewards[i - 1].deliveryCount) {
                errors.push('Milestone delivery counts must be in ascending order');
                break;
            }
        }
    }

    // Check leaderboard ranks are sequential
    if (this.leaderboardRewards.enabled && this.leaderboardRewards.rewards.length > 1) {
        for (let i = 1; i < this.leaderboardRewards.rewards.length; i++) {
            if (this.leaderboardRewards.rewards[i].rank !== this.leaderboardRewards.rewards[i - 1].rank + 1) {
                errors.push('Leaderboard ranks must be sequential');
                break;
            }
        }
    }

    return errors;
};

module.exports = mongoose.model('ReferralRewardsConfig', referralRewardsConfigSchema);
