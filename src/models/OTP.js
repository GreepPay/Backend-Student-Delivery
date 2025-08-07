const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
    email: {
        type: String,
        required: [true, 'Email is required'],
        lowercase: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    otp: {
        type: String,
        required: [true, 'OTP is required'],
        length: 6
    },
    userType: {
        type: String,
        enum: ['admin', 'driver'],
        required: [true, 'User type is required']
    },
    expiresAt: {
        type: Date,
        required: true,
        index: { expireAfterSeconds: 0 } // MongoDB TTL index
    },
    isUsed: {
        type: Boolean,
        default: false
    },
    attempts: {
        type: Number,
        default: 0,
        max: 3
    },
    ipAddress: {
        type: String
    },
    userAgent: {
        type: String
    }
}, {
    timestamps: true
});

// Compound index for efficient lookups
otpSchema.index({ email: 1, userType: 1, isUsed: 1 });
otpSchema.index({ otp: 1, expiresAt: 1 });

// Static method to generate OTP
otpSchema.statics.generateOTP = function () {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// Static method to create new OTP
otpSchema.statics.createOTP = async function (email, userType, ipAddress = null, userAgent = null) {
    // Delete any existing unused OTPs for this email and userType
    await this.deleteMany({ email, userType, isUsed: false });

    const otp = this.generateOTP();
    const expiresAt = new Date(Date.now() + (process.env.OTP_EXPIRY_MINUTES || 10) * 60 * 1000);

    return await this.create({
        email,
        otp,
        userType,
        expiresAt,
        ipAddress,
        userAgent
    });
};

// Static method to verify OTP
otpSchema.statics.verifyOTP = async function (email, otp, userType) {
    const otpRecord = await this.findOne({
        email,
        otp,
        userType,
        isUsed: false,
        expiresAt: { $gt: new Date() }
    });

    if (!otpRecord) {
        // Check if OTP exists but is expired or used
        const expiredOTP = await this.findOne({ email, otp, userType });
        if (expiredOTP) {
            if (expiredOTP.isUsed) {
                throw new Error('OTP has already been used');
            }
            if (expiredOTP.expiresAt <= new Date()) {
                throw new Error('OTP has expired');
            }
        }
        throw new Error('Invalid OTP');
    }

    // Increment attempts
    otpRecord.attempts += 1;

    if (otpRecord.attempts > 3) {
        otpRecord.isUsed = true;
        await otpRecord.save();
        throw new Error('Maximum OTP attempts exceeded');
    }

    // Mark as used
    otpRecord.isUsed = true;
    await otpRecord.save();

    return otpRecord;
};

// Static method to check rate limiting
otpSchema.statics.checkRateLimit = async function (email, userType, timeWindow = 5, maxAttempts = 3) {
    const windowStart = new Date(Date.now() - timeWindow * 60 * 1000);

    const recentAttempts = await this.countDocuments({
        email,
        userType,
        createdAt: { $gte: windowStart }
    });

    if (recentAttempts >= maxAttempts) {
        throw new Error(`Too many OTP requests. Please wait ${timeWindow} minutes before trying again.`);
    }

    return true;
};

// Instance method to check if OTP is valid
otpSchema.methods.isValid = function () {
    return !this.isUsed && this.expiresAt > new Date();
};

// Instance method to get remaining time
otpSchema.methods.getRemainingTime = function () {
    if (this.expiresAt <= new Date()) return 0;
    return Math.ceil((this.expiresAt - new Date()) / 1000); // in seconds
};

module.exports = mongoose.model('OTP', otpSchema);