const mongoose = require('mongoose');

const invitationReferralCodeSchema = new mongoose.Schema({
    // The driver who generated this referral code
    referrer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Driver',
        required: true
    },

    // The referral code
    referralCode: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },

    // Status of the referral code - now permanent
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    },

    // Track usage history instead of single usage
    usageHistory: [{
        usedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Driver'
        },
        usedAt: {
            type: Date,
            default: Date.now
        },
        driverName: String,
        driverEmail: String
    }],

    // Total times used
    totalUses: {
        type: Number,
        default: 0
    },

    // Notes
    notes: {
        type: String,
        trim: true
    }
}, {
    timestamps: true
});

// Indexes
invitationReferralCodeSchema.index({ referralCode: 1 });
invitationReferralCodeSchema.index({ referrer: 1, status: 1 });

// Static method to generate referral code
invitationReferralCodeSchema.statics.generateReferralCode = async function (driverId, driverName) {
    // Get the next sequence number
    const lastCode = await this.findOne({}, {}, { sort: { 'referralCode': -1 } });

    let nextNumber = 1;
    if (lastCode && lastCode.referralCode) {
        const match = lastCode.referralCode.match(/GRP-SDS(\d+)-/);
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

// Method to check if code is active
invitationReferralCodeSchema.methods.isActive = function () {
    return this.status === 'active';
};

// Method to record usage of the code
invitationReferralCodeSchema.methods.recordUsage = function (usedByDriverId, driverName, driverEmail) {
    this.usageHistory.push({
        usedBy: usedByDriverId,
        usedAt: new Date(),
        driverName: driverName,
        driverEmail: driverEmail
    });
    this.totalUses += 1;
    return this.save();
};

// Method to deactivate code
invitationReferralCodeSchema.methods.deactivate = function () {
    this.status = 'inactive';
    return this.save();
};

// Method to reactivate code
invitationReferralCodeSchema.methods.reactivate = function () {
    this.status = 'active';
    return this.save();
};

// Virtual for recent usage (last 30 days)
invitationReferralCodeSchema.virtual('recentUsage').get(function () {
    const thirtyDaysAgo = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));
    return this.usageHistory.filter(usage => usage.usedAt >= thirtyDaysAgo);
});

module.exports = mongoose.model('InvitationReferralCode', invitationReferralCodeSchema);
