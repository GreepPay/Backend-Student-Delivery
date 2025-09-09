const Admin = require('../models/Admin');
const SystemSettings = require('../models/SystemSettings');
const EarningsConfig = require('../models/EarningsConfig');
const EmailService = require('../services/emailService');
const { catchAsync, successResponse, errorResponse } = require('../middleware/errorHandler');
const bcrypt = require('bcryptjs');

class AdminManagementController {
    // ========================================
    // ADMIN MANAGEMENT (Super Admin Only)
    // ========================================

    // Get all admins with pagination and filters
    static getAllAdmins = catchAsync(async (req, res) => {
        const { page = 1, limit = 10, role, isActive, search } = req.query;
        const { user } = req;

        try {
            // Build filter object
            const filter = {};

            if (role) {
                filter.role = role;
            }

            if (isActive !== undefined) {
                filter.isActive = isActive === 'true';
            }

            if (search) {
                filter.$or = [
                    { name: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } }
                ];
            }

            // Get admins with pagination
            const admins = await Admin.find(filter)
                .populate('createdBy', 'name email')
                .sort({ createdAt: -1 })
                .limit(limit * 1)
                .skip((page - 1) * limit);

            // Get total count
            const total = await Admin.countDocuments(filter);

            // Get statistics
            const stats = await Admin.aggregate([
                { $group: { _id: '$role', count: { $sum: 1 } } }
            ]);

            const statistics = {
                totalAdmins: total,
                superAdmins: stats.find(s => s._id === 'super_admin')?.count || 0,
                regularAdmins: stats.find(s => s._id === 'admin')?.count || 0,
                activeAdmins: await Admin.countDocuments({ isActive: true }),
                inactiveAdmins: await Admin.countDocuments({ isActive: false })
            };

            successResponse(res, {
                admins,
                pagination: {
                    currentPage: page * 1,
                    totalPages: Math.ceil(total / limit),
                    totalItems: total,
                    itemsPerPage: limit * 1
                },
                statistics
            }, 'Admins retrieved successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Create new admin
    static createAdmin = catchAsync(async (req, res) => {
        const { email, name, role = 'admin', permissions, sendInvitation = true } = req.body;
        const { user } = req;

        try {
            // Check if admin already exists
            const existingAdmin = await Admin.findOne({ email });
            if (existingAdmin) {
                return res.status(400).json({
                    success: false,
                    error: 'Admin with this email already exists'
                });
            }

            // Create admin (OTP-based authentication, no password needed)
            const admin = new Admin({
                email,
                name,
                role,
                permissions: permissions || ['create_delivery', 'edit_delivery', 'delete_delivery', 'manage_drivers', 'view_analytics'],
                createdBy: user.id
            });

            await admin.save();

            // Send invitation email if requested
            if (sendInvitation) {
                try {
                    await EmailService.sendAdminInvitation(email, name, user.name);
                } catch (emailError) {
                    console.error('Failed to send admin invitation email:', emailError);
                }
            }

            successResponse(res, {
                admin: {
                    id: admin._id,
                    email: admin.email,
                    name: admin.name,
                    role: admin.role,
                    permissions: admin.permissions,
                    isActive: admin.isActive,
                    createdAt: admin.createdAt
                },
                tempPassword: sendInvitation ? tempPassword : undefined
            }, 'Admin created successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Update admin
    static updateAdmin = catchAsync(async (req, res) => {
        const { id } = req.params;
        const { name, role, permissions, isActive } = req.body;
        const { user } = req;

        try {
            const admin = await Admin.findById(id);
            if (!admin) {
                return res.status(404).json({
                    success: false,
                    error: 'Admin not found'
                });
            }

            // Prevent super admin from being deactivated by regular admin
            if (admin.role === 'super_admin' && user.role !== 'super_admin') {
                return res.status(403).json({
                    success: false,
                    error: 'Only super admins can modify super admin accounts'
                });
            }

            // Update fields
            if (name) admin.name = name;
            if (role) admin.role = role;
            if (permissions) admin.permissions = permissions;
            if (isActive !== undefined) admin.isActive = isActive;

            admin.updatedBy = user.id;
            await admin.save();

            successResponse(res, {
                admin: {
                    id: admin._id,
                    email: admin.email,
                    name: admin.name,
                    role: admin.role,
                    permissions: admin.permissions,
                    isActive: admin.isActive,
                    updatedAt: admin.updatedAt
                }
            }, 'Admin updated successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Delete admin
    static deleteAdmin = catchAsync(async (req, res) => {
        const { id } = req.params;
        const { user } = req;

        try {
            const admin = await Admin.findById(id);
            if (!admin) {
                return res.status(404).json({
                    success: false,
                    error: 'Admin not found'
                });
            }

            // Prevent deletion of super admin by regular admin
            if (admin.role === 'super_admin' && user.role !== 'super_admin') {
                return res.status(403).json({
                    success: false,
                    error: 'Only super admins can delete super admin accounts'
                });
            }

            // Prevent self-deletion
            if (admin._id.toString() === user.id) {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot delete your own account'
                });
            }

            await Admin.findByIdAndDelete(id);

            successResponse(res, {}, 'Admin deleted successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Reset admin password
    static resetAdminPassword = catchAsync(async (req, res) => {
        const { id } = req.params;
        const { sendEmail = true } = req.body;
        const { user } = req;

        try {
            const admin = await Admin.findById(id);
            if (!admin) {
                return res.status(404).json({
                    success: false,
                    error: 'Admin not found'
                });
            }

            // Generate new temporary password
            const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
            const hashedPassword = await bcrypt.hash(tempPassword, 12);

            admin.password = hashedPassword;
            admin.updatedBy = user.id;
            await admin.save();

            // Send password reset email if requested
            if (sendEmail) {
                try {
                    await EmailService.sendAdminPasswordReset(admin.email, admin.name, tempPassword);
                } catch (emailError) {
                    console.error('Failed to send password reset email:', emailError);
                }
            }

            successResponse(res, {
                tempPassword: sendEmail ? tempPassword : undefined
            }, 'Admin password reset successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // ========================================
    // SYSTEM SETTINGS MANAGEMENT (Super Admin Only)
    // ========================================

    // Get all system settings
    static getSystemSettings = catchAsync(async (req, res) => {
        try {
            const settings = await SystemSettings.getSettings();

            successResponse(res, settings, 'System settings retrieved successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Update system settings
    static updateSystemSettings = catchAsync(async (req, res) => {
        const { settings } = req.body;
        const { user } = req;

        try {
            const updatedSettings = await SystemSettings.updateSettings(settings, user.id);

            successResponse(res, updatedSettings, 'System settings updated successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Update currency
    static updateCurrency = catchAsync(async (req, res) => {
        const { currency } = req.body;
        const { user } = req;

        try {
            const settings = await SystemSettings.getSettings();
            settings.display.currency = currency;
            settings.updatedBy = user.id;
            await settings.save();

            successResponse(res, {
                currency: settings.display.currency
            }, 'Currency updated successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // ========================================
    // EARNINGS CONFIGURATION MANAGEMENT (Super Admin Only)
    // ========================================

    // Get all earnings configurations
    static getEarningsConfigurations = catchAsync(async (req, res) => {
        try {
            const configurations = await EarningsConfig.find()
                .populate('createdBy', 'name email')
                .populate('updatedBy', 'name email')
                .sort({ effectiveDate: -1 });

            const activeConfig = await EarningsConfig.getActiveConfig();

            successResponse(res, {
                configurations,
                activeConfiguration: activeConfig
            }, 'Earnings configurations retrieved successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Create new earnings configuration
    static createEarningsConfiguration = catchAsync(async (req, res) => {
        const { name, rules, notes } = req.body;
        const { user } = req;

        try {
            // Deactivate current active configuration
            await EarningsConfig.updateMany(
                { isActive: true },
                { isActive: false }
            );

            // Create new configuration
            const config = new EarningsConfig({
                name,
                rules,
                notes,
                isActive: true,
                effectiveDate: new Date(),
                createdBy: user.id
            });

            // Validate rules
            config.validateRules();

            await config.save();

            successResponse(res, {
                configuration: config
            }, 'Earnings configuration created successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Update earnings configuration
    static updateEarningsConfiguration = catchAsync(async (req, res) => {
        const { id } = req.params;
        const { name, rules, notes, isActive } = req.body;
        const { user } = req;

        try {
            const config = await EarningsConfig.findById(id);
            if (!config) {
                return res.status(404).json({
                    success: false,
                    error: 'Earnings configuration not found'
                });
            }

            // If activating this configuration, deactivate others
            if (isActive && !config.isActive) {
                await EarningsConfig.updateMany(
                    { isActive: true },
                    { isActive: false }
                );
            }

            // Update fields
            if (name) config.name = name;
            if (rules) {
                config.rules = rules;
                config.validateRules();
            }
            if (notes !== undefined) config.notes = notes;
            if (isActive !== undefined) config.isActive = isActive;

            config.updatedBy = user.id;
            await config.save();

            successResponse(res, {
                configuration: config
            }, 'Earnings configuration updated successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Delete earnings configuration
    static deleteEarningsConfiguration = catchAsync(async (req, res) => {
        const { id } = req.params;

        try {
            const config = await EarningsConfig.findById(id);
            if (!config) {
                return res.status(404).json({
                    success: false,
                    error: 'Earnings configuration not found'
                });
            }

            // Prevent deletion of active configuration
            if (config.isActive) {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot delete active earnings configuration'
                });
            }

            await EarningsConfig.findByIdAndDelete(id);

            successResponse(res, {}, 'Earnings configuration deleted successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // ========================================
    // ADMIN STATISTICS (Super Admin Only)
    // ========================================

    // Get admin management statistics
    static getAdminStatistics = catchAsync(async (req, res) => {
        try {
            const [
                totalAdmins,
                activeAdmins,
                superAdmins,
                regularAdmins,
                recentLogins,
                adminActivity
            ] = await Promise.all([
                Admin.countDocuments(),
                Admin.countDocuments({ isActive: true }),
                Admin.countDocuments({ role: 'super_admin' }),
                Admin.countDocuments({ role: 'admin' }),
                Admin.find({ lastLogin: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }).countDocuments(),
                Admin.aggregate([
                    {
                        $group: {
                            _id: {
                                $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
                            },
                            count: { $sum: 1 }
                        }
                    },
                    { $sort: { _id: -1 } },
                    { $limit: 30 }
                ])
            ]);

            const statistics = {
                totalAdmins,
                activeAdmins,
                inactiveAdmins: totalAdmins - activeAdmins,
                superAdmins,
                regularAdmins,
                recentLogins,
                adminActivity
            };

            successResponse(res, statistics, 'Admin statistics retrieved successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });
}

module.exports = AdminManagementController;
