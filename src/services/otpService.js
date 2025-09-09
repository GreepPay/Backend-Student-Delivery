const OTP = require('../models/OTP');
const Admin = require('../models/Admin');
const Driver = require('../models/Driver');
const EmailService = require('./emailService');
const AdminNotificationService = require('./adminNotificationService');

class OTPService {
    // Generate 6-digit OTP
    static generateOTP() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    // Send OTP to user
    static async sendOTP(email, userType, ipAddress = null, userAgent = null) {
        try {
            // Check rate limiting (max 3 requests per 5 minutes)
            await OTP.checkRateLimit(email, userType, 5, 3);

            // Verify user exists and is active
            await this.verifyUserExists(email, userType);

            // Create and save OTP
            const otpRecord = await OTP.createOTP(email, userType, ipAddress, userAgent);

            // Send email
            await EmailService.sendOTP(email, otpRecord.otp, userType);

            return {
                success: true,
                message: 'OTP sent successfully',
                expiresIn: otpRecord.getRemainingTime()
            };
        } catch (error) {
            console.error('OTP Service Error:', error.message);
            throw error;
        }
    }

    // Verify OTP and return user data
    static async verifyOTP(email, otp, userType) {
        try {
            // Verify the OTP
            const otpRecord = await OTP.verifyOTP(email, otp, userType);

            // Get user data
            const userData = await this.getUserData(email, userType);

            // Update last login
            await this.updateLastLogin(userData._id, userType);

            // Note: New driver notifications are sent when drivers are actually created,
            // not on every login. This prevents spam notifications.

            return {
                success: true,
                message: 'OTP verified successfully',
                user: userData,
                userType
            };
        } catch (error) {
            console.error('OTP Verification Error:', error.message);
            throw error;
        }
    }

    // Verify user exists in the system
    static async verifyUserExists(email, userType) {
        let user;

        console.log(`🔍 Verifying user exists: ${email} (${userType})`);

        if (userType === 'admin') {
            user = await Admin.findActiveByEmail(email);
            console.log(`🔍 Admin lookup result:`, user ? 'Found' : 'Not found');
            if (!user) {
                throw new Error('Admin account not found or inactive');
            }
        } else if (userType === 'driver') {
            user = await Driver.findActiveByEmail(email);
            console.log(`🔍 Driver lookup result:`, user ? 'Found' : 'Not found');
            if (!user) {
                throw new Error('Driver account not found');
            }
            if (user.isSuspended) {
                throw new Error(`Account suspended: ${user.suspensionReason || 'No reason provided'}`);
            }
        } else {
            throw new Error('Invalid user type');
        }

        console.log(`✅ User verification successful for: ${email}`);
        return user;
    }

    // Get user data for JWT token
    static async getUserData(email, userType) {
        let user;

        if (userType === 'admin') {
            user = await Admin.findActiveByEmail(email).select('-__v');
        } else if (userType === 'driver') {
            user = await Driver.findActiveByEmail(email).select('-__v');
        }

        if (!user) {
            throw new Error('User not found');
        }

        return user;
    }

    // Update user's last login timestamp
    static async updateLastLogin(userId, userType) {
        try {
            const updateData = {
                lastLogin: new Date(),
                ...(userType === 'driver' && { isOnline: true })
            };

            if (userType === 'admin') {
                await Admin.findByIdAndUpdate(userId, updateData);
            } else if (userType === 'driver') {
                await Driver.findByIdAndUpdate(userId, updateData);
            }
        } catch (error) {
            console.error('Failed to update last login:', error.message);
            // Don't throw error as login was successful
        }
    }

    // Clean up expired OTPs (can be run as a cron job)
    static async cleanupExpiredOTPs() {
        try {
            const result = await OTP.deleteMany({
                $or: [
                    { expiresAt: { $lt: new Date() } },
                    { isUsed: true, createdAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } // Delete used OTPs older than 24 hours
                ]
            });

            console.log(`🧹 Cleaned up ${result.deletedCount} expired/used OTPs`);
            return result.deletedCount;
        } catch (error) {
            console.error('Failed to cleanup expired OTPs:', error.message);
            return 0;
        }
    }

    // Get OTP statistics for monitoring
    static async getOTPStats() {
        try {
            const stats = await OTP.aggregate([
                {
                    $group: {
                        _id: {
                            userType: '$userType',
                            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
                        },
                        count: { $sum: 1 },
                        successfulVerifications: {
                            $sum: { $cond: [{ $eq: ['$isUsed', true] }, 1, 0] }
                        }
                    }
                },
                {
                    $group: {
                        _id: '$_id.userType',
                        totalOTPs: { $sum: '$count' },
                        totalSuccessful: { $sum: '$successfulVerifications' },
                        dailyStats: {
                            $push: {
                                date: '$_id.date',
                                sent: '$count',
                                verified: '$successfulVerifications'
                            }
                        }
                    }
                }
            ]);

            return stats;
        } catch (error) {
            console.error('Failed to get OTP stats:', error.message);
            return [];
        }
    }

    // Resend OTP (with rate limiting)
    static async resendOTP(email, userType, ipAddress = null, userAgent = null) {
        try {
            // More restrictive rate limiting for resends (max 2 per 10 minutes)
            await OTP.checkRateLimit(email, userType, 10, 2);

            // Invalidate any existing unused OTPs
            await OTP.updateMany(
                { email, userType, isUsed: false },
                { isUsed: true }
            );

            // Send new OTP
            return await this.sendOTP(email, userType, ipAddress, userAgent);
        } catch (error) {
            console.error('OTP Resend Error:', error.message);
            throw error;
        }
    }

    // Validate OTP format
    static validateOTPFormat(otp) {
        if (!otp || typeof otp !== 'string') {
            throw new Error('OTP is required');
        }

        if (otp.length !== 6) {
            throw new Error('OTP must be 6 digits');
        }

        if (!/^\d{6}$/.test(otp)) {
            throw new Error('OTP must contain only numbers');
        }

        return true;
    }

    // Check if user can request OTP
    static async canRequestOTP(email, userType) {
        try {
            // Check if user exists
            await this.verifyUserExists(email, userType);

            // Check rate limits
            const windowStart = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes
            const recentAttempts = await OTP.countDocuments({
                email,
                userType,
                createdAt: { $gte: windowStart }
            });

            return {
                canRequest: recentAttempts < 3,
                attemptsRemaining: Math.max(0, 3 - recentAttempts),
                nextRequestTime: recentAttempts >= 3 ? new Date(Date.now() + 5 * 60 * 1000) : null
            };
        } catch (error) {
            return {
                canRequest: false,
                error: error.message
            };
        }
    }
}

module.exports = OTPService;