const mongoose = require('mongoose');
const crypto = require('crypto');

const driverInvitationSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    invitationToken: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'activated', 'expired'],
        default: 'pending'
    },
    invitedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
        required: true
    },
    invitedAt: {
        type: Date,
        default: Date.now
    },
    expiresAt: {
        type: Date,
        required: true
    },
    activatedAt: {
        type: Date
    },
    activationAttempts: {
        type: Number,
        default: 0
    },
    lastActivationAttempt: {
        type: Date
    }
}, {
    timestamps: true
});

// Index for efficient queries
driverInvitationSchema.index({ email: 1, status: 1 });
driverInvitationSchema.index({ invitationToken: 1 });
driverInvitationSchema.index({ expiresAt: 1 });

// Generate invitation token
driverInvitationSchema.statics.generateInvitationToken = function () {
    return crypto.randomBytes(32).toString('hex');
};

// Check if invitation is expired
driverInvitationSchema.methods.isExpired = function () {
    return new Date() > this.expiresAt;
};

// Mark invitation as activated
driverInvitationSchema.methods.markAsActivated = function () {
    this.status = 'activated';
    this.activatedAt = new Date();
    return this.save();
};

// Mark invitation as expired
driverInvitationSchema.methods.markAsExpired = function () {
    this.status = 'expired';
    return this.save();
};

// Increment activation attempts
driverInvitationSchema.methods.incrementActivationAttempts = function () {
    this.activationAttempts += 1;
    this.lastActivationAttempt = new Date();
    return this.save();
};

// Clean up expired invitations (static method)
driverInvitationSchema.statics.cleanupExpired = async function () {
    const result = await this.updateMany(
        {
            status: 'pending',
            expiresAt: { $lt: new Date() }
        },
        {
            status: 'expired'
        }
    );
    return result;
};

module.exports = mongoose.model('DriverInvitation', driverInvitationSchema);
