const ReferralService = require('../services/referralService');
const { successResponse, errorResponse, catchAsync } = require('../middleware/errorHandler');

class ReferralController {
    /**
     * Generate referral code for a driver
     */
    static generateReferralCode = catchAsync(async (req, res) => {
        const { driverId } = req.params;

        try {
            const result = await ReferralService.generateInvitationReferralCode(driverId);

            if (result.success) {
                return successResponse(res, {
                    referralCode: result.referralCode,
                    driverName: result.driverName,
                    message: result.message
                }, 'Referral code generated successfully');
            } else {
                return errorResponse(res, result.error, 400);
            }
        } catch (error) {
            return errorResponse(res, error, 500);
        }
    });

    /**
     * Use referral code during registration
     */
    static useReferralCode = catchAsync(async (req, res) => {
        const { referralCode } = req.body;
        const { driverId } = req.params;

        if (!referralCode) {
            return errorResponse(res, 'Referral code is required', 400);
        }

        const result = await ReferralService.useReferralCode(referralCode, driverId);

        if (!result.success) {
            return errorResponse(res, result.error, 400);
        }

        return successResponse(res, {
            referrerName: result.referrerName,
            completionCriteria: result.completionCriteria,
            rewards: result.rewards,
            message: 'Referral code applied successfully'
        });
    });

    /**
     * Get referral statistics for a driver
     */
    static getReferralStats = catchAsync(async (req, res) => {
        const { driverId } = req.params;

        const result = await ReferralService.getReferralStats(driverId);

        return successResponse(res, result.stats);
    });

    /**
     * Get referral leaderboard
     */
    static getReferralLeaderboard = catchAsync(async (req, res) => {
        const { limit = 10 } = req.query;

        const result = await ReferralService.getReferralLeaderboard(parseInt(limit));

        return successResponse(res, result.leaderboard);
    });

    /**
     * Get all referrals (admin only)
     */
    static getAllReferrals = catchAsync(async (req, res) => {
        const { page = 1, limit = 20, status } = req.query;

        const result = await ReferralService.getAllReferrals(
            parseInt(page),
            parseInt(limit),
            status
        );

        return successResponse(res, {
            referrals: result.referrals,
            pagination: result.pagination
        });
    });

    /**
     * Get referral details (admin only)
     */
    static getReferralDetails = catchAsync(async (req, res) => {
        const { referralId } = req.params;

        const result = await ReferralService.getReferralDetails(referralId);

        if (!result.success) {
            return errorResponse(res, result.error, 404);
        }

        return successResponse(res, result.referral);
    });

    /**
     * Get referral statistics for admin dashboard
     */
    static getReferralStatistics = catchAsync(async (req, res) => {
        const Referral = require('../models/Referral');

        const [
            totalReferrals,
            pendingReferrals,
            completedReferrals,
            expiredReferrals,
            totalRewardsDistributed
        ] = await Promise.all([
            Referral.countDocuments(),
            Referral.countDocuments({ status: 'pending' }),
            Referral.countDocuments({ status: 'completed' }),
            Referral.countDocuments({ status: 'expired' }),
            Referral.aggregate([
                { $match: { status: 'completed' } },
                { $group: { _id: null, total: { $sum: { $add: ['$rewards.referrer', '$rewards.referred'] } } } }
            ])
        ]);

        const stats = {
            totalReferrals,
            pendingReferrals,
            completedReferrals,
            expiredReferrals,
            totalRewardsDistributed: totalRewardsDistributed[0]?.total || 0,
            completionRate: totalReferrals > 0 ? ((completedReferrals / totalReferrals) * 100).toFixed(1) : 0
        };

        return successResponse(res, stats);
    });

    /**
     * Update referral progress (called when delivery is completed)
     */
    static updateReferralProgress = catchAsync(async (req, res) => {
        const { driverId } = req.params;

        const result = await ReferralService.updateReferralProgress(driverId);

        if (result) {
            return successResponse(res, {
                progress: result.progress,
                status: result.status,
                message: 'Referral progress updated'
            });
        }

        return successResponse(res, {
            message: 'No active referral found'
        });
    });

    /**
     * Get driver's referral code (if exists)
     */
    static getDriverReferralCode = catchAsync(async (req, res) => {
        const { driverId } = req.params;
        const Referral = require('../models/Referral');

        // First, try to find any referral where this driver is the referrer
        let referrals = await Referral.find({ referrer: driverId })
            .populate('referred', 'name email');

        let referralCode = null;

        if (referrals.length > 0) {
            // Get the referral code from the first referral (they all have the same code)
            referralCode = referrals[0].referralCode;
        } else {
            // If no referrals exist, generate a new code
            const Driver = require('../models/Driver');
            const driver = await Driver.findById(driverId);

            if (!driver) {
                return errorResponse(res, 'Driver not found', 404);
            }

            // Generate a referral code
            referralCode = await Referral.generateReferralCode(driverId, driver.name);
        }

        return successResponse(res, {
            referralCode,
            referrals: referrals.map(r => r.referred).filter(Boolean),
            totalReferrals: referrals.length,
            pendingReferrals: referrals.filter(r => r.status === 'pending').length,
            completedReferrals: referrals.filter(r => r.status === 'completed').length,
            expiredReferrals: referrals.filter(r => r.status === 'expired').length,
            rewards: {
                referrer: 1000,
                referred: 500
            },
            completionCriteria: {
                referredDeliveries: 5,
                referredEarnings: 500,
                timeLimit: 30
            }
        });
    });

    /**
     * Get referral analytics for admin
     */
    static getReferralAnalytics = catchAsync(async (req, res) => {
        const { period = 'month' } = req.query;
        const Referral = require('../models/Referral');

        let startDate;
        const now = new Date();

        switch (period) {
            case 'week':
                startDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
                break;
            case 'month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            case 'year':
                startDate = new Date(now.getFullYear(), 0, 1);
                break;
            default:
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        }

        const analytics = await Referral.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
                    },
                    newReferrals: { $sum: 1 },
                    completedReferrals: {
                        $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] }
                    },
                    totalRewards: {
                        $sum: {
                            $cond: [
                                { $eq: ["$status", "completed"] },
                                { $add: ["$rewards.referrer", "$rewards.referred"] },
                                0
                            ]
                        }
                    }
                }
            },
            {
                $sort: { _id: 1 }
            }
        ]);

        return successResponse(res, {
            period,
            analytics,
            startDate,
            endDate: now
        });
    });

    // Get driver referral points
    static getDriverPoints = catchAsync(async (req, res) => {
        const { driverId } = req.params;
        const Driver = require('../models/Driver');

        const driver = await Driver.findById(driverId).select('referralPoints name');
        if (!driver) {
            return errorResponse(res, 'Driver not found', 404);
        }

        return successResponse(res, {
            driverId: driver._id,
            driverName: driver.name,
            referralPoints: driver.referralPoints || 0
        });
    });
}

module.exports = ReferralController;
