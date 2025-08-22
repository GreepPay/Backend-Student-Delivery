const OTPService = require('../services/otpService');
const { generateToken } = require('../middleware/auth');
const { catchAsync, successResponse, errorResponse, handleOTPError } = require('../middleware/errorHandler');

class AuthController {
    // Send OTP to user's email
    static sendOTP = catchAsync(async (req, res) => {
        const { email, userType } = req.body;
        const ipAddress = req.ip;
        const userAgent = req.get('User-Agent');

        try {
            const result = await OTPService.sendOTP(email, userType, ipAddress, userAgent);

            successResponse(res, {
                email,
                userType,
                expiresIn: result.expiresIn
            }, 'OTP sent successfully');
        } catch (error) {
            const otpError = handleOTPError(error);
            return res.status(400).json(otpError);
        }
    });

    // Verify OTP and login user
    static verifyOTP = catchAsync(async (req, res) => {
        const { email, otp, userType } = req.body;

        try {
            // Validate OTP format
            OTPService.validateOTPFormat(otp);

            // Verify OTP
            const result = await OTPService.verifyOTP(email, otp, userType);

            // Generate JWT token
            const token = generateToken(result.user, userType);

            successResponse(res, {
                user: {
                    id: result.user._id,
                    email: result.user.email,
                    fullName: result.user.fullName,
                    userType,
                    ...(userType === 'admin' && {
                        role: result.user.role,
                        permissions: result.user.permissions
                    }),
                    ...(userType === 'driver' && {
                        area: result.user.area,
                        totalDeliveries: result.user.totalDeliveries,
                        totalEarnings: result.user.totalEarnings
                    })
                },
                token,
                expiresIn: process.env.JWT_EXPIRES_IN || '24h'
            }, 'Login successful');
        } catch (error) {
            const otpError = handleOTPError(error);
            return res.status(400).json(otpError);
        }
    });

    // Resend OTP
    static resendOTP = catchAsync(async (req, res) => {
        const { email, userType } = req.body;
        const ipAddress = req.ip;
        const userAgent = req.get('User-Agent');

        try {
            const result = await OTPService.resendOTP(email, userType, ipAddress, userAgent);

            successResponse(res, {
                email,
                userType,
                expiresIn: result.expiresIn
            }, 'OTP resent successfully');
        } catch (error) {
            const otpError = handleOTPError(error);
            return res.status(400).json(otpError);
        }
    });

    // Check if user can request OTP (rate limiting check)
    static canRequestOTP = catchAsync(async (req, res) => {
        const { email, userType } = req.query;

        if (!email || !userType) {
            return res.status(400).json({
                success: false,
                error: 'Email and userType are required'
            });
        }

        try {
            const result = await OTPService.canRequestOTP(email, userType);

            successResponse(res, result, 'OTP request status retrieved');
        } catch (error) {
            errorResponse(res, error, 400);
        }
    });

    // Logout user (client-side token removal + server-side cleanup)
    static logout = catchAsync(async (req, res) => {
        const { user } = req;

        try {
            // Update user's online status if driver
            if (user.userType === 'driver') {
                const Driver = require('../models/Driver');
                await Driver.findByIdAndUpdate(user.id, { isOnline: false });
            }

            successResponse(res, null, 'Logged out successfully');
        } catch (error) {
            // Even if there's an error updating status, logout should succeed
            successResponse(res, null, 'Logged out successfully');
        }
    });

    // Refresh JWT token
    static refreshToken = catchAsync(async (req, res) => {
        const { user } = req;

        try {
            // Generate new token
            const newToken = generateToken(user.userData, user.userType);

            successResponse(res, {
                token: newToken,
                expiresIn: process.env.JWT_EXPIRES_IN || '24h'
            }, 'Token refreshed successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Get profile by user ID (for admin access)
    static getProfileById = catchAsync(async (req, res) => {
        const { userId } = req.params;
        const { user } = req;

        try {
            // Only allow admins to access other users' profiles
            if (user.userType !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied. Only admins can view other users\' profiles.'
                });
            }

            let userData;

            // Try to find as driver first
            const Driver = require('../models/Driver');
            let driver = await Driver.findById(userId).select('-__v');
            
            if (driver) {
                // Get computed data
                const profileCompletion = driver.profileCompletion;
                const accountStatus = driver.accountStatus;

                // Structure response exactly as frontend expects
                userData = {
                    // Basic driver data
                    id: driver._id,
                    fullName: driver.fullName || driver.name,
                    email: driver.email,
                    phone: driver.phone,
                    studentId: driver.studentId,
                    area: driver.area,
                    transportationType: driver.transportationType,
                    university: driver.university,
                    address: driver.address,
                    profilePicture: driver.profilePicture,
                    isActive: driver.isActive,
                    joinedAt: driver.joinedAt,

                    // Frontend expected structure
                    profile: {
                        personalDetails: {
                            fullName: driver.fullName || driver.name,
                            email: driver.email,
                            phone: driver.phone,
                            address: driver.address || ""
                        },
                        studentInfo: {
                            studentId: driver.studentId,
                            university: driver.university
                        },
                        transportation: {
                            method: driver.transportationType,
                            area: driver.area
                        }
                    },

                    completion: {
                        overall: profileCompletion?.overall || 0,
                        sections: profileCompletion?.sections || {},
                        isComplete: profileCompletion?.isComplete || false,
                        readyForDeliveries: profileCompletion?.readyForDeliveries || false
                    },

                    verification: {
                        studentVerified: accountStatus?.verification?.studentVerified || false,
                        profileComplete: accountStatus?.verification?.profileComplete || false,
                        activeDeliveryPartner: accountStatus?.verification?.activeDeliveryPartner || false
                    },

                    // Keep original fields for backward compatibility
                    memberSince: driver.memberSince,
                    verificationStatus: driver.verificationStatus,
                    completionRate: driver.completionRate,
                    averageEarningsPerDelivery: driver.averageEarningsPerDelivery,
                    profileCompletion: driver.profileCompletion,
                    accountStatus: driver.accountStatus,
                    verificationProgress: driver.verificationProgress
                };
            } else {
                // Try to find as admin
                const Admin = require('../models/Admin');
                const admin = await Admin.findById(userId).select('-__v');
                
                if (admin) {
                    userData = {
                        id: admin._id,
                        name: admin.name,
                        email: admin.email,
                        role: admin.role,
                        permissions: admin.permissions,
                        isActive: admin.isActive,
                        createdAt: admin.createdAt
                    };
                }
            }

            if (!userData) {
                return res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
            }

            successResponse(res, {
                user: userData,
                userType: driver ? 'driver' : 'admin'
            }, 'Profile retrieved successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Get current user profile
    static getProfile = catchAsync(async (req, res) => {
        const { user } = req;

        try {
            let userData;

            if (user.userType === 'admin') {
                const Admin = require('../models/Admin');
                userData = await Admin.findById(user.id).select('-__v');
            } else if (user.userType === 'driver') {
                const Driver = require('../models/Driver');
                const driver = await Driver.findById(user.id).select('-__v');
                if (driver) {
                    // Get computed data
                    const profileCompletion = driver.profileCompletion;
                    const accountStatus = driver.accountStatus;

                    // Structure response exactly as frontend expects
                    userData = {
                        // Basic driver data
                        id: driver._id,
                        fullName: driver.fullName || driver.name,
                        email: driver.email,
                        phone: driver.phone,
                        studentId: driver.studentId,
                        area: driver.area,
                        transportationType: driver.transportationType,
                        university: driver.university,
                        address: driver.address,
                        profilePicture: driver.profilePicture,
                        isActive: driver.isActive,
                        joinedAt: driver.joinedAt,

                        // Frontend expected structure
                        profile: {
                            personalDetails: {
                                fullName: driver.fullName || driver.name,
                                email: driver.email,
                                phone: driver.phone,
                                address: driver.address || ""
                            },
                            studentInfo: {
                                studentId: driver.studentId,
                                university: driver.university
                            },
                            transportation: {
                                method: driver.transportationType,  // Frontend expects 'method'
                                area: driver.area                   // Frontend expects area here too
                            }
                        },

                        completion: {
                            overall: profileCompletion?.overall || 0,
                            sections: profileCompletion?.sections || {},
                            isComplete: profileCompletion?.isComplete || false,
                            readyForDeliveries: profileCompletion?.readyForDeliveries || false
                        },

                        verification: {
                            studentVerified: accountStatus?.verification?.studentVerified || false,
                            profileComplete: accountStatus?.verification?.profileComplete || false,
                            activeDeliveryPartner: accountStatus?.verification?.activeDeliveryPartner || false
                        },

                        // Keep original fields for backward compatibility
                        memberSince: driver.memberSince,
                        verificationStatus: driver.verificationStatus,
                        completionRate: driver.completionRate,
                        averageEarningsPerDelivery: driver.averageEarningsPerDelivery,
                        profileCompletion: driver.profileCompletion,
                        accountStatus: driver.accountStatus,
                        verificationProgress: driver.verificationProgress
                    };
                }
            }

            if (!userData) {
                return res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
            }

            successResponse(res, {
                user: userData,
                userType: user.userType
            }, 'Profile retrieved successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Update user profile (basic fields only)
    static updateProfile = catchAsync(async (req, res) => {
        const { user } = req;
        const { name, phone } = req.body;

        try {
            let updatedUser;

            if (user.userType === 'admin') {
                const Admin = require('../models/Admin');
                updatedUser = await Admin.findByIdAndUpdate(
                    user.id,
                    {
                        ...(name && { name }),
                        updatedAt: new Date()
                    },
                    { new: true, runValidators: true }
                ).select('-__v');
            } else if (user.userType === 'driver') {
                const Driver = require('../models/Driver');
                updatedUser = await Driver.findByIdAndUpdate(
                    user.id,
                    {
                        ...(name && { name }),
                        ...(phone !== undefined && { phone }),
                        updatedAt: new Date()
                    },
                    { new: true, runValidators: true }
                ).select('-__v');
            }

            if (!updatedUser) {
                return res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
            }

            successResponse(res, {
                user: updatedUser,
                userType: user.userType
            }, 'Profile updated successfully');
        } catch (error) {
            errorResponse(res, error, 400);
        }
    });

    // Change user password (if implementing password-based auth later)
    static changePassword = catchAsync(async (req, res) => {
        // For now, this system uses OTP-only authentication
        // This endpoint can be implemented later if password auth is added

        res.status(501).json({
            success: false,
            error: 'Password authentication not implemented. This system uses OTP-only authentication.'
        });
    });

    // Validate session (check if token is still valid)
    static validateSession = catchAsync(async (req, res) => {
        const { user } = req;

        try {
            // Check if user still exists and is active
            let userData;

            if (user.userType === 'admin') {
                const Admin = require('../models/Admin');
                userData = await Admin.findById(user.id).select('isActive');
            } else if (user.userType === 'driver') {
                const Driver = require('../models/Driver');
                userData = await Driver.findById(user.id).select('isActive');
            }

            if (!userData || !userData.isActive) {
                return res.status(401).json({
                    success: false,
                    error: 'Session invalid. Please login again.'
                });
            }

            successResponse(res, {
                valid: true,
                user: {
                    id: user.id,
                    email: user.email,
                    fullName: user.fullName,
                    userType: user.userType
                }
            }, 'Session is valid');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Get authentication statistics (admin only)
    static getAuthStats = catchAsync(async (req, res) => {
        const { user } = req;

        // Only super admins can view auth stats
        if (user.userType !== 'admin' || user.role !== 'super_admin') {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }

        try {
            const stats = await OTPService.getOTPStats();

            successResponse(res, {
                otpStats: stats,
                generatedAt: new Date().toISOString()
            }, 'Authentication statistics retrieved');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Cleanup expired OTPs (maintenance endpoint)
    static cleanupOTPs = catchAsync(async (req, res) => {
        const { user } = req;

        // Only super admins can run cleanup
        if (user.userType !== 'admin' || user.role !== 'super_admin') {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }

        try {
            const deletedCount = await OTPService.cleanupExpiredOTPs();

            successResponse(res, {
                deletedCount,
                cleanupTime: new Date().toISOString()
            }, 'OTP cleanup completed');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });
}

module.exports = AuthController;