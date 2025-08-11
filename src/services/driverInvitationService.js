const DriverInvitation = require('../models/DriverInvitation');
const Driver = require('../models/Driver');
const emailService = require('./emailService');
const { catchAsync } = require('../middleware/errorHandler');

class DriverInvitationService {
    /**
     * Create a new driver invitation
     */
    static async createInvitation(invitationData) {
        const { email, name, invitedBy } = invitationData;

        try {
            // Check if driver already exists
            const existingDriver = await Driver.findOne({ email: email.toLowerCase() });
            if (existingDriver) {
                throw new Error('Driver with this email already exists');
            }

            // Check if there's already a pending invitation for this email
            const existingInvitation = await DriverInvitation.findOne({
                email: email.toLowerCase(),
                status: 'pending'
            });

            if (existingInvitation) {
                // If invitation is not expired, return existing one
                if (!existingInvitation.isExpired()) {
                    return existingInvitation;
                }
                // If expired, mark as expired
                await existingInvitation.markAsExpired();
            }

            // Generate invitation token
            const invitationToken = DriverInvitation.generateInvitationToken();

            // Set expiration (7 days from now)
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 7);

            // Create invitation
            const invitation = new DriverInvitation({
                email: email.toLowerCase(),
                name,
                invitationToken,
                invitedBy,
                expiresAt
            });

            await invitation.save();

            // Send invitation email (commented out for testing)
            try {
                await this.sendInvitationEmail(invitation);
            } catch (emailError) {
                console.log('Email sending failed, but invitation created:', emailError.message);
                // Don't fail the invitation creation if email fails
            }

            return invitation;
        } catch (error) {
            console.error('Error creating driver invitation:', error);
            throw error;
        }
    }

    /**
     * Send invitation email to driver
     */
    static async sendInvitationEmail(invitation) {
        try {
            const activationLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/driver/activate/${invitation.invitationToken}`;

            const emailData = {
                to: invitation.email,
                subject: 'Welcome to Greep SDS - Complete Your Driver Account Setup',
                data: {
                    name: invitation.name,
                    activationLink,
                    supportWhatsApp: '+90 533 832 97 85',
                    supportInstagram: '@greepit',
                    expiresAt: invitation.expiresAt.toLocaleDateString()
                }
            };

            await emailService.sendDriverInvitationEmail(emailData);
            console.log(`Driver invitation email sent to ${invitation.email}`);
        } catch (error) {
            console.error('Error sending invitation email:', error);
            throw new Error('Failed to send invitation email');
        }
    }

    /**
     * Validate invitation token
     */
    static async validateInvitationToken(token) {
        try {
            const invitation = await DriverInvitation.findOne({ invitationToken: token });

            if (!invitation) {
                throw new Error('Invalid invitation token');
            }

            if (invitation.status !== 'pending') {
                throw new Error('Invitation has already been used or expired');
            }

            if (invitation.isExpired()) {
                await invitation.markAsExpired();
                throw new Error('Invitation has expired');
            }

            return invitation;
        } catch (error) {
            console.error('Error validating invitation token:', error);
            throw error;
        }
    }

    /**
     * Activate driver account from invitation
     */
    static async activateDriverAccount(token, driverData) {
        try {
            const invitation = await this.validateInvitationToken(token);

            // Check if driver already exists
            const existingDriver = await Driver.findOne({ email: invitation.email });
            if (existingDriver) {
                throw new Error('Driver account already exists');
            }

            // Create new driver account
            const driver = new Driver({
                email: invitation.email,
                name: invitation.name,
                ...driverData,
                addedBy: invitation.invitedBy,
                joinedAt: new Date()
            });

            await driver.save();

            // Mark invitation as activated
            await invitation.markAsActivated();

            // Send welcome email
            await this.sendWelcomeEmail(driver);

            return driver;
        } catch (error) {
            console.error('Error activating driver account:', error);
            throw error;
        }
    }

    /**
     * Send welcome email to newly activated driver
     */
    static async sendWelcomeEmail(driver) {
        try {
            const emailData = {
                to: driver.email,
                subject: 'Welcome to Greep SDS - Your Account is Ready!',
                data: {
                    name: driver.name,
                    loginUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/driver/login`,
                    supportWhatsApp: '+90 533 832 97 85',
                    supportInstagram: '@greepit'
                }
            };

            await emailService.sendDriverWelcomeEmail(emailData);
            console.log(`Welcome email sent to ${driver.email}`);
        } catch (error) {
            console.error('Error sending welcome email:', error);
            // Don't throw error for welcome email failure
        }
    }

    /**
     * Get pending invitations
     */
    static async getPendingInvitations(page = 1, limit = 20) {
        try {
            const skip = (page - 1) * limit;

            const invitations = await DriverInvitation.find({ status: 'pending' })
                .populate('invitedBy', 'name email')
                .sort({ invitedAt: -1 })
                .skip(skip)
                .limit(limit);

            const total = await DriverInvitation.countDocuments({ status: 'pending' });

            return {
                invitations,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            console.error('Error getting pending invitations:', error);
            throw error;
        }
    }

    /**
     * Cancel invitation
     */
    static async cancelInvitation(invitationId, adminId) {
        try {
            const invitation = await DriverInvitation.findById(invitationId);

            if (!invitation) {
                throw new Error('Invitation not found');
            }

            if (invitation.status !== 'pending') {
                throw new Error('Can only cancel pending invitations');
            }

            // Only the admin who sent the invitation or super admin can cancel
            if (invitation.invitedBy.toString() !== adminId.toString()) {
                // Check if user is super admin
                const Admin = require('../models/Admin');
                const admin = await Admin.findById(adminId);
                if (!admin || admin.role !== 'super_admin') {
                    throw new Error('Unauthorized to cancel this invitation');
                }
            }

            invitation.status = 'expired';
            await invitation.save();

            return invitation;
        } catch (error) {
            console.error('Error canceling invitation:', error);
            throw error;
        }
    }

    /**
     * Resend invitation email
     */
    static async resendInvitation(invitationId, adminId) {
        try {
            const invitation = await DriverInvitation.findById(invitationId);

            if (!invitation) {
                throw new Error('Invitation not found');
            }

            if (invitation.status !== 'pending') {
                throw new Error('Can only resend pending invitations');
            }

            // Only the admin who sent the invitation or super admin can resend
            if (invitation.invitedBy.toString() !== adminId.toString()) {
                // Check if user is super admin
                const Admin = require('../models/Admin');
                const admin = await Admin.findById(adminId);
                if (!admin || admin.role !== 'super_admin') {
                    throw new Error('Unauthorized to resend this invitation');
                }
            }

            // Extend expiration date
            invitation.expiresAt = new Date();
            invitation.expiresAt.setDate(invitation.expiresAt.getDate() + 7);
            await invitation.save();

            // Resend email
            await this.sendInvitationEmail(invitation);

            return invitation;
        } catch (error) {
            console.error('Error resending invitation:', error);
            throw error;
        }
    }

    /**
     * Clean up expired invitations (cron job)
     */
    static async cleanupExpiredInvitations() {
        try {
            const result = await DriverInvitation.cleanupExpired();
            console.log(`Cleaned up ${result.modifiedCount} expired invitations`);
            return result;
        } catch (error) {
            console.error('Error cleaning up expired invitations:', error);
            throw error;
        }
    }
}

module.exports = DriverInvitationService;
