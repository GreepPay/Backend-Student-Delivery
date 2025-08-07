const Admin = require('../models/Admin');
const Driver = require('../models/Driver');
const Delivery = require('../models/Delivery');
const AnalyticsService = require('../services/analyticsService');
const EmailService = require('../services/emailService');
const { catchAsync, successResponse, errorResponse, paginatedResponse } = require('../middleware/errorHandler');

class AdminController {
    // Get admin dashboard overview
    static getDashboard = catchAsync(async (req, res) => {
        const { period = 'month' } = req.query;

        try {
            // Get system analytics
            const analytics = await AnalyticsService.getSystemAnalytics(period);

            // Get recent deliveries
            const recentDeliveries = await Delivery.find()
                .populate('assignedTo', 'name email area')
                .populate('assignedBy', 'name email')
                .sort({ createdAt: -1 })
                .limit(10);

            // Get active drivers count
            const activeDriversToday = await Driver.countDocuments({
                isActive: true,
                isOnline: true
            });

            // Get top drivers for the period
            const { startDate, endDate } = AnalyticsService.getDateRange(period);
            const topDrivers = await AnalyticsService.getTopDrivers(startDate, endDate, 5);

            successResponse(res, {
                analytics,
                recentDeliveries,
                activeDriversToday,
                topDrivers,
                lastUpdated: new Date().toISOString()
            }, 'Dashboard data retrieved successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Get all admins (super admin only)
    static getAdmins = catchAsync(async (req, res) => {
        const { page = 1, limit = 20, role, isActive } = req.query;
        const { user } = req;

        // Only super admin can view all admins
        if (user.role !== 'super_admin') {
            return res.status(403).json({
                success: false,
                error: 'Super admin access required'
            });
        }

        try {
            const query = {};
            if (role) query.role = role;
            if (isActive !== undefined) query.isActive = isActive === 'true';

            const admins = await Admin.find(query)
                .select('-__v')
                .populate('createdBy', 'name email')
                .sort({ createdAt: -1 })
                .limit(limit * 1)
                .skip((page - 1) * limit);

            const total = await Admin.countDocuments(query);

            paginatedResponse(res, admins, { page: parseInt(page), limit: parseInt(limit), total });
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Create new admin (super admin only)
    static createAdmin = catchAsync(async (req, res) => {
        const { email, name, role = 'admin' } = req.body;
        const { user } = req;

        // Only super admin can create admins
        if (user.role !== 'super_admin') {
            return res.status(403).json({
                success: false,
                error: 'Super admin access required'
            });
        }

        try {
            // Check if admin already exists
            const existingAdmin = await Admin.findOne({ email });
            if (existingAdmin) {
                return res.status(400).json({
                    success: false,
                    error: 'Admin with this email already exists'
                });
            }

            // Create new admin
            const newAdmin = await Admin.create({
                email,
                name,
                role,
                createdBy: user.id
            });

            // Send welcome email
            try {
                console.log('🔍 Debug: Sending admin invitation to:', email, name, user.name);
                await EmailService.sendAdminInvitation(email, name, user.name);
                console.log('✅ Debug: Admin invitation sent successfully');
            } catch (emailError) {
                console.error('❌ Failed to send admin invitation email:', emailError.message);
            }

            const adminData = await Admin.findById(newAdmin._id)
                .select('-__v')
                .populate('createdBy', 'name email');

            successResponse(res, adminData, 'Admin created successfully', 201);
        } catch (error) {
            errorResponse(res, error, 400);
        }
    });

    // Update admin (super admin only)
    static updateAdmin = catchAsync(async (req, res) => {
        const { id } = req.params;
        const { name, isActive, permissions } = req.body;
        const { user } = req;

        // Only super admin can update admins
        if (user.role !== 'super_admin') {
            return res.status(403).json({
                success: false,
                error: 'Super admin access required'
            });
        }

        try {
            const admin = await Admin.findById(id);
            if (!admin) {
                return res.status(404).json({
                    success: false,
                    error: 'Admin not found'
                });
            }

            // Prevent super admin from deactivating themselves
            if (admin._id.toString() === user.id && isActive === false) {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot deactivate your own account'
                });
            }

            const updatedAdmin = await Admin.findByIdAndUpdate(
                id,
                {
                    ...(name && { name }),
                    ...(isActive !== undefined && { isActive }),
                    ...(permissions && { permissions }),
                    updatedAt: new Date()
                },
                { new: true, runValidators: true }
            ).populate('createdBy', 'name email');

            successResponse(res, updatedAdmin, 'Admin updated successfully');
        } catch (error) {
            errorResponse(res, error, 400);
        }
    });

    // Delete admin (super admin only)
    static deleteAdmin = catchAsync(async (req, res) => {
        const { id } = req.params;
        const { user } = req;

        // Only super admin can delete admins
        if (user.role !== 'super_admin') {
            return res.status(403).json({
                success: false,
                error: 'Super admin access required'
            });
        }

        try {
            const admin = await Admin.findById(id);
            if (!admin) {
                return res.status(404).json({
                    success: false,
                    error: 'Admin not found'
                });
            }

            // Prevent super admin from deleting themselves
            if (admin._id.toString() === user.id) {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot delete your own account'
                });
            }

            await Admin.findByIdAndDelete(id);

            successResponse(res, null, 'Admin deleted successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Get system stats
    static getSystemStats = catchAsync(async (req, res) => {
        const { period = 'month' } = req.query;

        try {
            const stats = await AnalyticsService.getSystemStats(period);
            successResponse(res, stats, 'System stats retrieved successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Get detailed analytics for analytics page
    static getAnalytics = catchAsync(async (req, res) => {
        const { period = 'month' } = req.query;

        try {
            // Get comprehensive analytics data
            const analytics = await AnalyticsService.getDetailedAnalytics(period);

            // Get additional data for charts
            const revenueData = await AnalyticsService.getRevenueData(period);
            const deliveryStatus = await AnalyticsService.getDeliveryStatus(period);
            const topAreas = await AnalyticsService.getTopAreas(period);
            const driverPerformance = await AnalyticsService.getDriverPerformance(period);

            successResponse(res, {
                overview: analytics,
                revenueData,
                deliveryStatus,
                topAreas,
                driverPerformance,
                lastUpdated: new Date().toISOString()
            }, 'Analytics data retrieved successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Export data (CSV/Excel)
    static exportData = catchAsync(async (req, res) => {
        const { type, format = 'csv', period = 'month' } = req.query;
        const { user } = req;

        // Check permissions
        if (!user.permissions.includes('view_analytics') && user.role !== 'super_admin') {
            return res.status(403).json({
                success: false,
                error: 'Analytics permission required'
            });
        }

        try {
            let data = [];
            let filename = '';

            switch (type) {
                case 'deliveries':
                    const { startDate, endDate } = AnalyticsService.getDateRange(period);
                    data = await Delivery.find({
                        createdAt: { $gte: startDate, $lte: endDate }
                    })
                        .populate('assignedTo', 'name email area')
                        .populate('assignedBy', 'name email')
                        .select('-__v')
                        .lean();
                    filename = `deliveries_${period}_${new Date().toISOString().split('T')[0]}`;
                    break;

                case 'drivers':
                    data = await Driver.find({ isActive: true })
                        .select('-__v')
                        .lean();
                    filename = `drivers_${new Date().toISOString().split('T')[0]}`;
                    break;

                case 'analytics':
                    data = await AnalyticsService.getSystemAnalytics(period);
                    filename = `analytics_${period}_${new Date().toISOString().split('T')[0]}`;
                    break;

                default:
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid export type. Use: deliveries, drivers, or analytics'
                    });
            }

            // For now, return JSON data. In production, you'd generate actual CSV/Excel files
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);

            successResponse(res, {
                exportType: type,
                format,
                recordCount: Array.isArray(data) ? data.length : 1,
                data,
                generatedAt: new Date().toISOString(),
                generatedBy: user.name
            }, `${type} data exported successfully`);
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Send bulk notifications
    static sendBulkNotifications = catchAsync(async (req, res) => {
        const { recipients, subject, message, type = 'general' } = req.body;
        const { user } = req;

        // Check permissions
        if (!user.permissions.includes('manage_drivers') && user.role !== 'super_admin') {
            return res.status(403).json({
                success: false,
                error: 'Driver management permission required'
            });
        }

        try {
            let targetDrivers = [];

            if (recipients === 'all') {
                targetDrivers = await Driver.find({ isActive: true }).select('email name');
            } else if (Array.isArray(recipients)) {
                targetDrivers = await Driver.find({
                    _id: { $in: recipients },
                    isActive: true
                }).select('email name');
            } else {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid recipients format'
                });
            }

            const emailPromises = targetDrivers.map(driver =>
                EmailService.sendDriverInvitation(driver.email, driver.name, user.name)
                    .catch(error => ({ error: error.message, driver: driver.email }))
            );

            const results = await Promise.allSettled(emailPromises);

            const successful = results.filter(result => result.status === 'fulfilled').length;
            const failed = results.filter(result => result.status === 'rejected').length;

            successResponse(res, {
                totalTargeted: targetDrivers.length,
                successful,
                failed,
                sentBy: user.name,
                sentAt: new Date().toISOString()
            }, 'Bulk notifications processed');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Get admin activity logs
    static getActivityLogs = catchAsync(async (req, res) => {
        const { page = 1, limit = 50, adminId, action, startDate, endDate } = req.query;
        const { user } = req;

        // Only super admin can view activity logs
        if (user.role !== 'super_admin') {
            return res.status(403).json({
                success: false,
                error: 'Super admin access required'
            });
        }

        try {
            // This would require implementing an activity logging system
            // For now, return recent deliveries created by admins as activity
            const query = {};
            if (adminId) query.assignedBy = adminId;
            if (startDate || endDate) {
                query.createdAt = {};
                if (startDate) query.createdAt.$gte = new Date(startDate);
                if (endDate) query.createdAt.$lte = new Date(endDate);
            }

            const activities = await Delivery.find(query)
                .populate('assignedBy', 'name email')
                .populate('assignedTo', 'name email')
                .select('deliveryCode pickupLocation deliveryLocation status createdAt assignedBy assignedTo')
                .sort({ createdAt: -1 })
                .limit(limit * 1)
                .skip((page - 1) * limit);

            const total = await Delivery.countDocuments(query);

            // Transform to activity log format
            const logs = activities.map(delivery => ({
                id: delivery._id,
                action: 'create_delivery',
                resource: `Delivery ${delivery.deliveryCode}`,
                details: `Created delivery from ${delivery.pickupLocation} to ${delivery.deliveryLocation}`,
                performedBy: delivery.assignedBy,
                timestamp: delivery.createdAt,
                status: delivery.status
            }));

            paginatedResponse(res, logs, { page: parseInt(page), limit: parseInt(limit), total });
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // System maintenance operations
    static performMaintenance = catchAsync(async (req, res) => {
        const { operation } = req.body;
        const { user } = req;

        // Only super admin can perform maintenance
        if (user.role !== 'super_admin') {
            return res.status(403).json({
                success: false,
                error: 'Super admin access required'
            });
        }

        try {
            let result = {};

            switch (operation) {
                case 'cleanup_expired_otps':
                    const OTPService = require('../services/otpService');
                    const deletedOTPs = await OTPService.cleanupExpiredOTPs();
                    result = { operation, deletedOTPs };
                    break;

                case 'update_driver_stats':
                    // Recalculate driver statistics
                    const drivers = await Driver.find({ isActive: true });
                    for (const driver of drivers) {
                        const deliveries = await Delivery.countDocuments({
                            assignedTo: driver._id,
                            status: 'delivered'
                        });
                        const earnings = await Delivery.aggregate([
                            { $match: { assignedTo: driver._id, status: 'delivered' } },
                            { $group: { _id: null, total: { $sum: '$driverEarning' } } }
                        ]);

                        await Driver.findByIdAndUpdate(driver._id, {
                            totalDeliveries: deliveries,
                            completedDeliveries: deliveries,
                            totalEarnings: earnings[0]?.total || 0
                        });
                    }
                    result = { operation, updatedDrivers: drivers.length };
                    break;

                default:
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid maintenance operation'
                    });
            }

            successResponse(res, result, 'Maintenance operation completed');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Recalculate all driver stats
    static recalculateDriverStats = catchAsync(async (req, res) => {
        try {
            const drivers = await Driver.find({});
            let updatedCount = 0;

            for (const driver of drivers) {
                await Driver.recalculateStats(driver._id);
                updatedCount++;
            }

            successResponse(res, {
                updatedCount,
                message: `Recalculated stats for ${updatedCount} drivers`
            }, 'Driver stats recalculated successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });


}

module.exports = AdminController;