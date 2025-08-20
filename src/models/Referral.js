const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema({
    // Referrer (the person who gives the referral code)
    referrer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Driver',
        required: true
    },

    // Referred person (the person who uses the referral code)
    referred: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Driver',
        required: true
    },

    // Referral code used
    referralCode: {
        type: String,
        required: true,
        uppercase: true,
        trim: true
    },

    // Status of the referral
    status: {
        type: String,
        enum: ['pending', 'completed', 'expired', 'cancelled'],
        default: 'pending'
    },

    // Conditions for completion
    completionCriteria: {
        referredDeliveries: {
            type: Number,
            default: 5 // Number of deliveries the referred person needs to complete
        },
        referredEarnings: {
            type: Number,
            default: 500 // Minimum earnings the referred person needs to make
        },
        timeLimit: {
            type: Number,
            default: 30 // Days from registration to complete criteria
        }
    },

    // Progress tracking
    progress: {
        completedDeliveries: {
            type: Number,
            default: 0
        },
        totalEarnings: {
            type: Number,
            default: 0
        },
        daysRemaining: {
            type: Number,
            default: 30
        }
    },

    // Rewards (in points)
    rewards: {
        referrer: {
            type: Number,
            default: 1000 // Points for referrer when referral is completed
        },
        referred: {
            type: Number,
            default: 500 // Points for referred person when they complete criteria
        }
    },

    // Timestamps
    registeredAt: {
        type: Date,
        default: Date.now
    },
    completedAt: {
        type: Date
    },
    expiresAt: {
        type: Date
    },

    // Additional metadata
    notes: {
        type: String,
        trim: true
    }
}, {
    timestamps: true
});

// Indexes for efficient queries
referralSchema.index({ referrer: 1, status: 1 });
referralSchema.index({ referred: 1, status: 1 });
referralSchema.index({ referralCode: 1 });
referralSchema.index({ status: 1, expiresAt: 1 });

// Pre-save middleware to set expiration date
referralSchema.pre('save', function (next) {
    if (this.isNew && !this.expiresAt) {
        this.expiresAt = new Date(Date.now() + (this.completionCriteria.timeLimit * 24 * 60 * 60 * 1000));
    }
    next();
});

// Static method to generate referral code
referralSchema.statics.generateReferralCode = async function (driverId, driverName) {
    // Get the next sequence number
    const lastReferral = await this.findOne({}, {}, { sort: { 'referralCode': -1 } });

    let nextNumber = 1;
    if (lastReferral && lastReferral.referralCode) {
        const match = lastReferral.referralCode.match(/GRP-SDS(\d+)-/);
        if (match) {
            nextNumber = parseInt(match[1]) + 1;
        }
    }

    // Generate name abbreviation (first 2 letters of first name)
    const nameAbbreviation = driverName
        .split(' ')[0] // Get first name
        .substring(0, 2) // Get first 2 letters
        .toUpperCase();

    // Format: GRP-SDS001-AY
    const referralCode = `GRP-SDS${nextNumber.toString().padStart(3, '0')}-${nameAbbreviation}`;

    return referralCode;
};

// Method to check if referral is completed
referralSchema.methods.isCompleted = function () {
    return this.progress.completedDeliveries >= this.completionCriteria.referredDeliveries &&
        this.progress.totalEarnings >= this.completionCriteria.referredEarnings;
};

// Method to update progress
referralSchema.methods.updateProgress = function (completedDeliveries, totalEarnings) {
    this.progress.completedDeliveries = completedDeliveries;
    this.progress.totalEarnings = totalEarnings;

    // Calculate days remaining
    if (this.expiresAt) {
        const now = new Date();
        const timeDiff = this.expiresAt.getTime() - now.getTime();
        this.progress.daysRemaining = Math.max(0, Math.ceil(timeDiff / (1000 * 3600 * 24)));
    }

    // Check if completed
    if (this.isCompleted() && this.status === 'pending') {
        this.status = 'completed';
        this.completedAt = new Date();
    }

    // Check if expired
    if (this.progress.daysRemaining <= 0 && this.status === 'pending') {
        this.status = 'expired';
    }
};

// Virtual for completion percentage
referralSchema.virtual('completionPercentage').get(function () {
    const deliveryPercentage = (this.progress.completedDeliveries / this.completionCriteria.referredDeliveries) * 100;
    const earningsPercentage = (this.progress.totalEarnings / this.completionCriteria.referredEarnings) * 100;
    return Math.min(100, Math.max(deliveryPercentage, earningsPercentage));
});

// Ensure virtuals are included in JSON
referralSchema.set('toJSON', { virtuals: true });
referralSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Referral', referralSchema);
