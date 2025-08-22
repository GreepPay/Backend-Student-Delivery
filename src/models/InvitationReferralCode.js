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

    // Status of the referral code
    status: {
        type: String,
        enum: ['active', 'used', 'expired'],
        default: 'active'
    },

    // When the code was used (if applicable)
    usedAt: {
        type: Date
    },

    // Who used the code (if applicable)
    usedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Driver'
    },

    // Expiration date
    expiresAt: {
        type: Date
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
invitationReferralCodeSchema.index({ status: 1, expiresAt: 1 });

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

// Method to check if code is expired
invitationReferralCodeSchema.methods.isExpired = function () {
    return new Date() > this.expiresAt;
};

// Method to mark code as used
invitationReferralCodeSchema.methods.markAsUsed = function (usedByDriverId) {
    this.status = 'used';
    this.usedAt = new Date();
    this.usedBy = usedByDriverId;
    return this.save();
};

// Method to mark code as expired
invitationReferralCodeSchema.methods.markAsExpired = function () {
    this.status = 'expired';
    return this.save();
};

module.exports = mongoose.model('InvitationReferralCode', invitationReferralCodeSchema);
