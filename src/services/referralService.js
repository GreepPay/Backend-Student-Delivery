const Referral = require('../models/Referral');
const Driver = require('../models/Driver');
const Delivery = require('../models/Delivery');
const Notification = require('../models/Notification');
const SocketService = require('./socketService');

class ReferralService {
    /**
     * Generate an invitation referral code for a driver
     */
    static async generateInvitationReferralCode(driverId) {
        try {
            const driver = await Driver.findById(driverId);
            if (!driver) {
                throw new Error('Driver not found');
            }

            const InvitationReferralCode = require('../models/InvitationReferralCode');

            // Check if driver already has an active invitation referral code
            const existingCode = await InvitationReferralCode.findOne({
                referrer: driverId,
                status: 'active'
            });

            if (existingCode) {
                return {
                    success: true,
                    referralCode: existingCode.referralCode,
                    driverName: driver.name,
                    message: 'Existing active referral code found'
                };
            }

            // Generate new referral code
            const referralCode = await InvitationReferralCode.generateReferralCode(driverId, driver.name);

            // Create the invitation referral code record
            const invitationReferralCode = new InvitationReferralCode({
                referrer: driverId,
                referralCode: referralCode,
                expiresAt: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)) // 30 days from now
            });

            await invitationReferralCode.save();

            return {
                success: true,
                referralCode,
                driverName: driver.name,
                message: 'Invitation referral code generated successfully'
            };
        } catch (error) {
            console.error('Error generating invitation referral code:', error);
            throw error;
        }
    }

    /**
     * Generate a unique referral code for a driver
     */
    static async generateReferralCode(driverId) {
        try {
            const driver = await Driver.findById(driverId);
            if (!driver) {
                throw new Error('Driver not found');
            }

            // Check if driver already has a referral code
            const existingReferral = await Referral.findOne({ referrer: driverId });
            if (existingReferral) {
                return {
                    success: false,
                    error: 'Driver already has a referral code'
                };
            }

            const referralCode = await Referral.generateReferralCode(driverId, driver.name);

            return {
                success: true,
                referralCode,
                driverName: driver.name
            };
        } catch (error) {
            console.error('Error generating referral code:', error);
            throw error;
        }
    }

    /**
     * Use a referral code during registration
     */
    static async useReferralCode(referralCode, newDriverId) {
        try {
            // Find the referral code
            const referral = await Referral.findOne({
                referralCode: referralCode.toUpperCase(),
                status: 'pending'
            }).populate('referrer', 'name email');

            if (!referral) {
                return {
                    success: false,
                    error: 'Invalid or expired referral code'
                };
            }

            // Check if the new driver is trying to use their own code
            if (referral.referrer._id.toString() === newDriverId) {
                return {
                    success: false,
                    error: 'Cannot use your own referral code'
                };
            }

            // Check if the new driver has already used a referral code
            const existingReferral = await Referral.findOne({ referred: newDriverId });
            if (existingReferral) {
                return {
                    success: false,
                    error: 'You have already used a referral code'
                };
            }

            // Update the referral with the new driver
            referral.referred = newDriverId;
            await referral.save();

            // Send notifications
            await this.sendReferralNotifications(referral);

            return {
                success: true,
                referrerName: referral.referrer.name,
                completionCriteria: referral.completionCriteria,
                rewards: referral.rewards
            };
        } catch (error) {
            console.error('Error using referral code:', error);
            throw error;
        }
    }

    /**
     * Get referral statistics for a driver
     */
    static async getReferralStats(driverId) {
        try {
            const [referralsGiven, referralsReceived] = await Promise.all([
                // Referrals given by this driver
                Referral.find({ referrer: driverId }).populate('referred', 'name email'),
                // Referrals received by this driver
                Referral.findOne({ referred: driverId }).populate('referrer', 'name email')
            ]);

            const stats = {
                referralsGiven: {
                    total: referralsGiven.length,
                    pending: referralsGiven.filter(r => r.status === 'pending').length,
                    completed: referralsGiven.filter(r => r.status === 'completed').length,
                    expired: referralsGiven.filter(r => r.status === 'expired').length,
                    totalPoints: referralsGiven
                        .filter(r => r.status === 'completed')
                        .reduce((sum, r) => sum + r.rewards.referrer, 0)
                },
                referralReceived: referralsReceived ? {
                    status: referralsReceived.status,
                    referrerName: referralsReceived.referrer.name,
                    progress: referralsReceived.progress,
                    completionCriteria: referralsReceived.completionCriteria,
                    rewards: referralsReceived.rewards,
                    daysRemaining: referralsReceived.progress.daysRemaining,
                    completionPercentage: referralsReceived.completionPercentage
                } : null
            };

            return {
                success: true,
                stats
            };
        } catch (error) {
            console.error('Error getting referral stats:', error);
            throw error;
        }
    }

    /**
     * Update referral progress when a delivery is completed
     */
    static async updateReferralProgress(driverId) {
        try {
            // Find active referral for this driver
            const referral = await Referral.findOne({
                referred: driverId,
                status: 'pending'
            });

            if (!referral) {
                return; // No active referral
            }

            // Calculate driver's progress
            const deliveries = await Delivery.find({
                driver: driverId,
                status: 'delivered',
                createdAt: { $gte: referral.registeredAt }
            });

            const completedDeliveries = deliveries.length;
            const totalEarnings = deliveries.reduce((sum, delivery) => {
                // Use the earnings calculation logic from earnings service
                const deliveryFee = delivery.fee || 0;
                const driverEarning = delivery.driverEarning || Math.round(deliveryFee / 2);
                return sum + driverEarning;
            }, 0);

            // Update referral progress
            referral.updateProgress(completedDeliveries, totalEarnings);
            await referral.save();

            // Check if referral is completed
            if (referral.status === 'completed') {
                await this.processReferralCompletion(referral);
            }

            return {
                success: true,
                progress: referral.progress,
                status: referral.status
            };
        } catch (error) {
            console.error('Error updating referral progress:', error);
            throw error;
        }
    }

    /**
     * Process referral completion and distribute points
     */
    static async processReferralCompletion(referral) {
        try {
            // Populate driver information
            await referral.populate(['referrer', 'referred']);

            // Add points to drivers' accounts
            await Promise.all([
                Driver.findByIdAndUpdate(referral.referrer._id, {
                    $inc: { referralPoints: referral.rewards.referrer }
                }),
                Driver.findByIdAndUpdate(referral.referred._id, {
                    $inc: { referralPoints: referral.rewards.referred }
                })
            ]);

            // Send completion notifications
            await this.sendCompletionNotifications(referral);

            return {
                success: true,
                referrerPoints: referral.rewards.referrer,
                referredPoints: referral.rewards.referred
            };
        } catch (error) {
            console.error('Error processing referral completion:', error);
            throw error;
        }
    }

    /**
     * Send referral notifications
     */
    static async sendReferralNotifications(referral) {
        try {
            // Notification for referrer
            const referrerNotification = new Notification({
                recipient: referral.referrer,
                recipientType: 'driver',
                type: 'referral_used',
                title: 'Referral Code Used! 🎉',
                message: `Your referral code ${referral.referralCode} has been used! Track progress and earn rewards.`,
                data: {
                    referralId: referral._id,
                    referralCode: referral.referralCode,
                    referredDriverId: referral.referred
                }
            });
            await referrerNotification.save();

            // Notification for referred driver
            const referredNotification = new Notification({
                recipient: referral.referred,
                recipientType: 'driver',
                type: 'referral_received',
                title: 'Welcome! You used a referral code 🚀',
                message: `Complete ${referral.completionCriteria.referredDeliveries} deliveries and earn ₦${referral.rewards.referred} bonus!`,
                data: {
                    referralId: referral._id,
                    referralCode: referral.referralCode,
                    referrerDriverId: referral.referrer
                }
            });
            await referredNotification.save();

            // Send real-time notifications
            SocketService.emitToUser(referral.referrer, 'newNotification', referrerNotification);
            SocketService.emitToUser(referral.referred, 'newNotification', referredNotification);

        } catch (error) {
            console.error('Error sending referral notifications:', error);
        }
    }

    /**
     * Send completion notifications
     */
    static async sendCompletionNotifications(referral) {
        try {
            // Notification for referrer
            const referrerNotification = new Notification({
                recipient: referral.referrer,
                recipientType: 'driver',
                type: 'referral_completed',
                title: 'Referral Completed! 🎉',
                message: `Congratulations! Your referral has been completed. You earned ${referral.rewards.referrer} points!`,
                data: {
                    referralId: referral._id,
                    points: referral.rewards.referrer
                }
            });
            await referrerNotification.save();

            // Notification for referred driver
            const referredNotification = new Notification({
                recipient: referral.referred,
                recipientType: 'driver',
                type: 'referral_completed',
                title: 'Referral Goal Achieved! 🎯',
                message: `You've completed your referral goal! You earned ${referral.rewards.referred} points!`,
                data: {
                    referralId: referral._id,
                    points: referral.rewards.referred
                }
            });
            await referredNotification.save();

            // Send real-time notifications
            SocketService.emitToUser(referral.referrer, 'newNotification', referrerNotification);
            SocketService.emitToUser(referral.referred, 'newNotification', referredNotification);

        } catch (error) {
            console.error('Error sending completion notifications:', error);
        }
    }

    /**
     * Get leaderboard for referrals
     */
    static async getReferralLeaderboard(limit = 10) {
        try {
            const leaderboard = await Referral.aggregate([
                {
                    $match: { status: 'completed' }
                },
                {
                    $group: {
                        _id: '$referrer',
                        completedReferrals: { $sum: 1 },
                        totalPoints: { $sum: '$rewards.referrer' }
                    }
                },
                {
                    $sort: { completedReferrals: -1, totalPoints: -1 }
                },
                {
                    $limit: limit
                },
                {
                    $lookup: {
                        from: 'drivers',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'driver'
                    }
                },
                {
                    $unwind: '$driver'
                },
                {
                    $project: {
                        driverId: '$_id',
                        driverName: '$driver.name',
                        completedReferrals: 1,
                        totalPoints: 1
                    }
                }
            ]);

            return {
                success: true,
                leaderboard
            };
        } catch (error) {
            console.error('Error getting referral leaderboard:', error);
            throw error;
        }
    }

    /**
     * Get detailed referral information for admin
     */
    static async getReferralDetails(referralId) {
        try {
            const referral = await Referral.findById(referralId)
                .populate('referrer', 'name email phone')
                .populate('referred', 'name email phone');

            if (!referral) {
                return {
                    success: false,
                    error: 'Referral not found'
                };
            }

            return {
                success: true,
                referral
            };
        } catch (error) {
            console.error('Error getting referral details:', error);
            throw error;
        }
    }

    /**
     * Get all referrals for admin dashboard
     */
    static async getAllReferrals(page = 1, limit = 20, status = null) {
        try {
            const query = {};
            if (status) {
                query.status = status;
            }

            const skip = (page - 1) * limit;

            const [referrals, total] = await Promise.all([
                Referral.find(query)
                    .populate('referrer', 'name email')
                    .populate('referred', 'name email')
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit),
                Referral.countDocuments(query)
            ]);

            return {
                success: true,
                referrals,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            console.error('Error getting all referrals:', error);
            throw error;
        }
    }
}

module.exports = ReferralService;
