const Admin = require('../models/Admin');
const Driver = require('../models/Driver');
const Delivery = require('../models/Delivery');
const AnalyticsService = require('../services/analyticsService');
const EnhancedAnalyticsService = require('../services/enhancedAnalyticsService');
const EmailService = require('../services/emailService');
const DriverInvitationService = require('../services/driverInvitationService');
const PDFDocument = require('pdfkit');
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
                .populate('assignedTo', 'name email area profilePicture profileImage avatar image')
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

    // Get recent deliveries for dashboard
    static getRecentDeliveries = catchAsync(async (req, res) => {
        try {
            const recentDeliveries = await Delivery.find()
                .populate('assignedTo', 'name email area profilePicture profileImage avatar image')
                .sort({ createdAt: -1 })
                .limit(10);

            successResponse(res, {
                recentDeliveries,
                lastUpdated: new Date().toISOString()
            }, 'Recent deliveries retrieved successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Get top drivers for dashboard
    static getTopDrivers = catchAsync(async (req, res) => {
        const { period = 'month' } = req.query;

        try {
            const { startDate, endDate } = AnalyticsService.getDateRange(period);
            const topDrivers = await AnalyticsService.getTopDrivers(startDate, endDate, 5);

            successResponse(res, {
                topDrivers,
                period,
                lastUpdated: new Date().toISOString()
            }, 'Top drivers retrieved successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Get real-time driver status
    static getDriverStatus = catchAsync(async (req, res) => {
        try {
            const drivers = await Driver.find({ isActive: true })
                .select('_id name email area isOnline isActive lastLogin totalDeliveries totalEarnings rating profilePicture profileImage avatar image')
                .sort({ lastLogin: -1 });

            const driverStatus = drivers.map(driver => {
                // Determine online status: driver is online if isOnline is true OR if they're active and have logged in recently
                const isOnline = driver.isOnline === true ||
                    (driver.isActive && driver.lastLogin &&
                        (new Date() - new Date(driver.lastLogin)) < 15 * 60 * 1000); // 15 minutes

                return {
                    id: driver._id,
                    name: driver.name,
                    email: driver.email,
                    area: driver.area,
                    isOnline: isOnline,
                    isActive: driver.isActive,
                    lastLogin: driver.lastLogin,
                    totalDeliveries: driver.totalDeliveries || 0,
                    totalEarnings: driver.totalEarnings || 0,
                    rating: driver.rating || 0,
                    profilePicture: driver.profilePicture,
                    profileImage: driver.profileImage,
                    avatar: driver.avatar,
                    image: driver.image
                };
            });

            successResponse(res, {
                drivers: driverStatus,
                totalDrivers: driverStatus.length,
                onlineDrivers: driverStatus.filter(d => d.isOnline).length,
                lastUpdated: new Date().toISOString()
            }, 'Driver status retrieved successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Invite new driver
    static inviteDriver = catchAsync(async (req, res) => {
        const { name, email, referralCode } = req.body;
        const { user } = req;

        try {
            const invitation = await DriverInvitationService.createInvitation({
                name,
                email,
                invitedBy: user.id,
                referralCode
            });

            successResponse(res, {
                invitationId: invitation._id,
                email: invitation.email,
                status: invitation.status,
                expiresAt: invitation.expiresAt,
                referralCode: invitation.referralCode
            }, 'Driver invitation sent successfully');
        } catch (error) {
            errorResponse(res, error, 400);
        }
    });

    // Get pending invitations
    static getPendingInvitations = catchAsync(async (req, res) => {
        const { page = 1, limit = 20 } = req.query;

        try {
            const result = await DriverInvitationService.getPendingInvitations(parseInt(page), parseInt(limit));

            successResponse(res, {
                invitations: result.invitations,
                pagination: result.pagination
            }, 'Pending invitations retrieved successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Cancel invitation
    static cancelInvitation = catchAsync(async (req, res) => {
        const { invitationId } = req.params;
        const { user } = req;

        try {
            const invitation = await DriverInvitationService.cancelInvitation(invitationId, user.id);

            successResponse(res, {
                invitationId: invitation._id,
                status: invitation.status
            }, 'Invitation cancelled successfully');
        } catch (error) {
            errorResponse(res, error, 400);
        }
    });

    // Resend invitation
    static resendInvitation = catchAsync(async (req, res) => {
        const { invitationId } = req.params;
        const { user } = req;

        try {
            const invitation = await DriverInvitationService.resendInvitation(invitationId, user.id);

            successResponse(res, {
                invitationId: invitation._id,
                status: invitation.status,
                expiresAt: invitation.expiresAt
            }, 'Invitation resent successfully');
        } catch (error) {
            errorResponse(res, error, 400);
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
                await EmailService.sendAdminInvitation(email, name, user.name);
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

    // Get enhanced comprehensive analytics
    static getEnhancedAnalytics = catchAsync(async (req, res) => {
        const { period = 'month' } = req.query;

        try {
            const analytics = await EnhancedAnalyticsService.getPlatformAnalytics(period);

            successResponse(res, analytics, 'Enhanced analytics data retrieved successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Get specific analytics sections
    static getCoreMetrics = catchAsync(async (req, res) => {
        const { period = 'month' } = req.query;

        try {
            const { startDate, endDate } = EnhancedAnalyticsService.getDateRange(period);
            const metrics = await EnhancedAnalyticsService.getCoreMetrics(startDate, endDate);

            successResponse(res, {
                period,
                startDate,
                endDate,
                metrics,
                lastUpdated: new Date().toISOString()
            }, 'Core metrics retrieved successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    static getFinancialMetrics = catchAsync(async (req, res) => {
        const { period = 'month' } = req.query;

        try {
            const { startDate, endDate } = EnhancedAnalyticsService.getDateRange(period);
            const metrics = await EnhancedAnalyticsService.getFinancialMetrics(startDate, endDate);

            successResponse(res, {
                period,
                startDate,
                endDate,
                metrics,
                lastUpdated: new Date().toISOString()
            }, 'Financial metrics retrieved successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    static getDriverMetrics = catchAsync(async (req, res) => {
        const { period = 'month' } = req.query;

        try {
            const { startDate, endDate } = EnhancedAnalyticsService.getDateRange(period);
            const metrics = await EnhancedAnalyticsService.getDriverMetrics(startDate, endDate);

            successResponse(res, {
                period,
                startDate,
                endDate,
                metrics,
                lastUpdated: new Date().toISOString()
            }, 'Driver metrics retrieved successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    static getDeliveryMetrics = catchAsync(async (req, res) => {
        const { period = 'month' } = req.query;

        try {
            const { startDate, endDate } = EnhancedAnalyticsService.getDateRange(period);
            const metrics = await EnhancedAnalyticsService.getDeliveryMetrics(startDate, endDate);

            successResponse(res, {
                period,
                startDate,
                endDate,
                metrics,
                lastUpdated: new Date().toISOString()
            }, 'Delivery metrics retrieved successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    static getPerformanceMetrics = catchAsync(async (req, res) => {
        const { period = 'month' } = req.query;

        try {
            const { startDate, endDate } = EnhancedAnalyticsService.getDateRange(period);
            const metrics = await EnhancedAnalyticsService.getPerformanceMetrics(startDate, endDate);

            successResponse(res, {
                period,
                startDate,
                endDate,
                metrics,
                lastUpdated: new Date().toISOString()
            }, 'Performance metrics retrieved successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    static getDocumentMetrics = catchAsync(async (req, res) => {
        const { period = 'month' } = req.query;

        try {
            const { startDate, endDate } = EnhancedAnalyticsService.getDateRange(period);
            const metrics = await EnhancedAnalyticsService.getDocumentVerificationMetrics(startDate, endDate);

            successResponse(res, {
                period,
                startDate,
                endDate,
                metrics,
                lastUpdated: new Date().toISOString()
            }, 'Document verification metrics retrieved successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    static getRemittanceMetrics = catchAsync(async (req, res) => {
        const { period = 'month' } = req.query;

        try {
            const { startDate, endDate } = EnhancedAnalyticsService.getDateRange(period);
            const metrics = await EnhancedAnalyticsService.getRemittanceMetrics(startDate, endDate);

            successResponse(res, {
                period,
                startDate,
                endDate,
                metrics,
                lastUpdated: new Date().toISOString()
            }, 'Remittance metrics retrieved successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    static getGrowthMetrics = catchAsync(async (req, res) => {
        const { period = 'month' } = req.query;

        try {
            const { startDate, endDate } = EnhancedAnalyticsService.getDateRange(period);
            const metrics = await EnhancedAnalyticsService.getGrowthMetrics(startDate, endDate);

            successResponse(res, {
                period,
                startDate,
                endDate,
                metrics,
                lastUpdated: new Date().toISOString()
            }, 'Growth metrics retrieved successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Export analytics as comprehensive PDF
    static exportAnalyticsPDF = catchAsync(async (req, res) => {
        const { period = 'month', format = 'pdf' } = req.query;
        const { user } = req;

        try {
            // Get comprehensive analytics data
            const analytics = await EnhancedAnalyticsService.getPlatformAnalytics(period);

            // Create PDF document
            const doc = new PDFDocument({
                size: 'A4',
                margin: 50
            });

            // Set response headers for PDF download
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="analytics-report-${period}-${new Date().toISOString().split('T')[0]}.pdf"`);

            // Pipe PDF to response
            doc.pipe(res);

            // Add company header
            doc.fontSize(24)
                .font('Helvetica-Bold')
                .text('Greep SDS Analytics Report', { align: 'center' })
                .moveDown(0.5);

            doc.fontSize(12)
                .font('Helvetica')
                .text(`Period: ${period.charAt(0).toUpperCase() + period.slice(1)}`, { align: 'center' })
                .text(`Generated: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, { align: 'center' })
                .text(`Generated by: ${user.name}`, { align: 'center' })
                .moveDown(2);

            // Executive Summary
            doc.fontSize(16)
                .font('Helvetica-Bold')
                .text('Executive Summary')
                .moveDown(0.5);

            doc.fontSize(10)
                .font('Helvetica')
                .text(`• Total Revenue: ₺${analytics.core.totalRevenue.toLocaleString()}`)
                .text(`• Total Deliveries: ${analytics.core.totalDeliveries}`)
                .text(`• Completion Rate: ${analytics.core.completionRate}%`)
                .text(`• Active Drivers: ${analytics.core.activeDrivers}/${analytics.core.totalDrivers} (${analytics.core.activeDriverRate}%)`)
                .text(`• Online Drivers: ${analytics.core.onlineDrivers}/${analytics.core.totalDrivers} (${analytics.core.onlineDriverRate}%)`)
                .moveDown(1);

            // Financial Overview
            doc.fontSize(16)
                .font('Helvetica-Bold')
                .text('Financial Overview')
                .moveDown(0.5);

            doc.fontSize(10)
                .font('Helvetica')
                .text(`• Total Revenue: ₺${analytics.core.totalRevenue.toLocaleString()}`)
                .text(`• Driver Earnings: ₺${analytics.core.totalDriverEarnings.toLocaleString()}`)
                .text(`• Platform Fees: ₺${analytics.core.platformFees.toLocaleString()}`)
                .text(`• Average Order Value: ₺${analytics.financial.averageOrderValue.toFixed(2)}`)
                .text(`• Average Driver Earnings: ₺${analytics.financial.averageDriverEarning.toFixed(2)}`)
                .moveDown(1);

            // Driver Performance
            doc.fontSize(16)
                .font('Helvetica-Bold')
                .text('Driver Performance')
                .moveDown(0.5);

            doc.fontSize(10)
                .font('Helvetica')
                .text(`• Total Drivers: ${analytics.drivers.stats.totalDrivers}`)
                .text(`• Active Drivers: ${analytics.drivers.stats.activeDrivers}`)
                .text(`• Online Drivers: ${analytics.drivers.stats.onlineDrivers}`)
                .text(`• Verified Drivers: ${analytics.drivers.stats.verifiedDrivers}`)
                .text(`• Suspended Drivers: ${analytics.drivers.stats.suspendedDrivers}`)
                .text(`• Average Deliveries per Driver: ${analytics.drivers.stats.avgDeliveriesPerDriver.toFixed(1)}`)
                .text(`• Average Earnings per Driver: ₺${analytics.drivers.stats.avgEarningsPerDriver.toFixed(2)}`)
                .moveDown(1);

            // Delivery Performance
            doc.fontSize(16)
                .font('Helvetica-Bold')
                .text('Delivery Performance')
                .moveDown(0.5);

            doc.fontSize(10)
                .font('Helvetica')
                .text(`• Total Deliveries: ${analytics.deliveries.totalDeliveries}`)
                .text(`• Completed Deliveries: ${analytics.deliveries.completedDeliveries}`)
                .text(`• Pending Deliveries: ${analytics.core.pendingDeliveries}`)
                .text(`• Completion Rate: ${analytics.core.completionRate}%`)
                .text(`• Average Delivery Time: ${analytics.performance.avgDeliveryTime} minutes`)
                .text(`• Average Rating: ${analytics.performance.avgRating} stars`)
                .moveDown(1);

            // Document Verification Status
            doc.fontSize(16)
                .font('Helvetica-Bold')
                .text('Document Verification Status')
                .moveDown(0.5);

            doc.fontSize(10)
                .font('Helvetica')
                .text(`• Total Drivers: ${analytics.documents.stats.totalDrivers}`)
                .text(`• Verified Drivers: ${analytics.documents.stats.verifiedDrivers}`)
                .text(`• Pending Drivers: ${analytics.documents.stats.pendingDrivers}`)
                .text(`• Total Pending Documents: ${analytics.documents.stats.totalPendingDocuments}`)
                .text(`• Total Verified Documents: ${analytics.documents.stats.totalVerifiedDocuments}`)
                .text(`• Total Rejected Documents: ${analytics.documents.stats.totalRejectedDocuments}`)
                .text(`• Verification Rate: ${analytics.documents.verificationRate}%`)
                .moveDown(1);

            // Remittance Status
            doc.fontSize(16)
                .font('Helvetica-Bold')
                .text('Remittance Status')
                .moveDown(0.5);

            doc.fontSize(10)
                .font('Helvetica')
                .text(`• Total Remittances: ${analytics.remittances.totalRemittances}`)
                .text(`• Pending Remittances: ${analytics.remittances.pendingRemittances}`)
                .text(`• Completed Remittances: ${analytics.remittances.completedRemittances}`)
                .text(`• Total Amount: ₺${analytics.remittances.totalAmount.toLocaleString()}`)
                .moveDown(1);

            // Growth Metrics
            doc.fontSize(16)
                .font('Helvetica-Bold')
                .text('Growth Metrics')
                .moveDown(0.5);

            doc.fontSize(10)
                .font('Helvetica')
                .text(`• Driver Growth: ${analytics.growth.driverGrowth}%`)
                .text(`• Delivery Growth: ${analytics.growth.deliveryGrowth}%`)
                .text(`• Revenue Growth: ${analytics.growth.revenueGrowth}%`)
                .moveDown(1);

            // Top Performers Table
            if (analytics.drivers.topPerformers && analytics.drivers.topPerformers.length > 0) {
                doc.fontSize(16)
                    .font('Helvetica-Bold')
                    .text('Top Performing Drivers')
                    .moveDown(0.5);

                // Table headers
                const tableTop = doc.y;
                const tableLeft = 50;
                const colWidth = 120;
                const rowHeight = 20;

                // Headers
                doc.fontSize(10)
                    .font('Helvetica-Bold')
                    .text('Driver', tableLeft, tableTop)
                    .text('Deliveries', tableLeft + colWidth, tableTop)
                    .text('Earnings', tableLeft + colWidth * 2, tableTop)
                    .text('Rating', tableLeft + colWidth * 3, tableTop);

                // Data rows
                doc.fontSize(9)
                    .font('Helvetica');

                analytics.drivers.topPerformers.slice(0, 10).forEach((driver, index) => {
                    const y = tableTop + rowHeight * (index + 1);
                    doc.text(driver.name || 'Unknown', tableLeft, y)
                        .text(driver.deliveries.toString(), tableLeft + colWidth, y)
                        .text(`₺${driver.earnings}`, tableLeft + colWidth * 2, y)
                        .text(driver.avgRating ? `${driver.avgRating}⭐` : 'N/A', tableLeft + colWidth * 3, y);
                });

                doc.moveDown(2);
            }

            // Area Performance
            if (analytics.deliveries.areaPerformance && analytics.deliveries.areaPerformance.length > 0) {
                doc.fontSize(16)
                    .font('Helvetica-Bold')
                    .text('Top Performing Areas')
                    .moveDown(0.5);

                analytics.deliveries.areaPerformance.slice(0, 5).forEach((area, index) => {
                    doc.fontSize(10)
                        .font('Helvetica')
                        .text(`${index + 1}. ${area.area}: ${area.deliveries} deliveries, ₺${area.revenue} revenue`);
                });

                doc.moveDown(1);
            }

            // Payment Method Breakdown
            if (analytics.financial.paymentMethodBreakdown && analytics.financial.paymentMethodBreakdown.length > 0) {
                doc.fontSize(16)
                    .font('Helvetica-Bold')
                    .text('Payment Method Breakdown')
                    .moveDown(0.5);

                analytics.financial.paymentMethodBreakdown.forEach((method) => {
                    doc.fontSize(10)
                        .font('Helvetica')
                        .text(`• ${method._id}: ${method.count} deliveries (₺${method.revenue})`);
                });

                doc.moveDown(1);
            }

            // Footer
            doc.fontSize(8)
                .font('Helvetica')
                .text('This report was generated automatically by the Greep SDS Analytics System.', { align: 'center' })
                .text('For questions or support, please contact the system administrator.', { align: 'center' });

            // Finalize PDF
            doc.end();

        } catch (error) {
            console.error('PDF Export Error:', error);
            errorResponse(res, error, 500);
        }
    });

    // Export data (CSV/Excel)
    static exportData = catchAsync(async (req, res) => {
        const { type, format = 'csv', period = 'month' } = req.query;
        const { user } = req;

        // Check permissions
        if (!user.permissions.includes('view_analytics') &&
            !user.permissions.includes('all') &&
            user.role !== 'super_admin') {
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
        if (!user.permissions.includes('manage_drivers') &&
            !user.permissions.includes('all') &&
            user.role !== 'super_admin') {
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
                .populate('assignedTo', 'name email')
                .select('deliveryCode pickupLocation deliveryLocation status createdAt assignedTo')
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
                performedBy: delivery.assignedTo,
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

    // Document Management Methods
    static getPendingDocuments = catchAsync(async (req, res) => {
        const { status = 'pending', documentType, page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;

        try {
            // Build query based on filters
            let query = {};

            // Filter by document status - only apply if documentType is specified
            if (status !== 'all' && documentType) {
                query[`documents.${documentType}.status`] = status;
            }

            // Filter by specific document type if provided
            if (documentType) {
                query[`documents.${documentType}`] = { $exists: true };
            } else {
                // If no documentType specified, get all drivers that have any documents
                query.documents = { $exists: true, $ne: null };
            }

            // Get drivers with documents
            const drivers = await Driver.find(query)
                .select('fullName email phone studentId documents profilePicture joinedAt')
                .skip(skip)
                .limit(parseInt(limit))
                .sort({ 'joinedAt': -1 });

            // Transform data for frontend
            const documents = [];
            drivers.forEach(driver => {
                if (driver.documents) {
                    Object.keys(driver.documents).forEach(docType => {
                        const doc = driver.documents[docType];
                        // Include documents even if they don't have documentUrl (for pending status)
                        if (doc && (doc.status || doc.documentUrl)) {
                            // Determine if document has actual file uploaded
                            // Check for documentUrl first, then fall back to status check
                            const hasFile = doc.documentUrl && doc.documentUrl.includes('cloudinary.com');
                            const hasUploadedStatus = doc.status && doc.status !== 'pending' && doc.uploadDate;
                            const uploadDate = doc.uploadDate || (hasFile ? new Date() : null);

                            documents.push({
                                id: `${driver._id}_${docType}`,
                                driverId: driver._id,
                                driverName: driver.fullName || driver.name,
                                driverEmail: driver.email,
                                driverPhone: driver.phone,
                                studentId: driver.studentId,
                                documentType: docType,
                                status: doc.status || 'pending',
                                documentUrl: hasFile ? doc.documentUrl : null,
                                uploadDate: uploadDate,
                                verifiedAt: doc.verifiedAt || null,
                                verifiedBy: doc.verifiedBy || null,
                                rejectionReason: doc.rejectionReason || null,
                                aiVerificationResult: doc.aiVerificationResult || null,
                                profilePicture: driver.profilePicture,
                                joinedAt: driver.joinedAt,
                                // Add helpful flags for frontend
                                hasFile: hasFile || hasUploadedStatus,
                                needsUpload: !hasFile && !hasUploadedStatus && doc.status === 'pending',
                                canVerify: (hasFile || hasUploadedStatus) && doc.status === 'pending',
                                needsReupload: !hasFile && hasUploadedStatus,
                                // Add status message for frontend
                                statusMessage: !hasFile && hasUploadedStatus ?
                                    'Document uploaded but URL missing - needs re-upload' :
                                    doc.status === 'pending' ? 'Pending verification' :
                                        doc.status === 'verified' ? 'Verified' :
                                            doc.status === 'rejected' ? 'Rejected' : 'Unknown status'
                            });
                        }
                    });
                }
            });

            // Filter by status if specified
            const filteredDocuments = status === 'all' ?
                documents :
                documents.filter(doc => doc.status === status);

            // Get total count for pagination
            const totalDrivers = await Driver.countDocuments(query);
            const totalDocuments = filteredDocuments.length;

            successResponse(res, {
                documents: filteredDocuments,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: totalDocuments,
                    pages: Math.ceil(totalDocuments / limit)
                },
                filters: {
                    status,
                    documentType,
                    totalDrivers
                },
                // Add summary information
                summary: {
                    totalDocuments: totalDocuments,
                    documentsWithFiles: filteredDocuments.filter(d => d.hasFile).length,
                    documentsNeedingUpload: filteredDocuments.filter(d => d.needsUpload).length,
                    documentsReadyForVerification: filteredDocuments.filter(d => d.canVerify).length
                }
            }, 'Documents retrieved successfully');

        } catch (error) {
            console.error('Error in getPendingDocuments:', error);
            errorResponse(res, error, 500);
        }
    });

    static updateDocumentStatus = catchAsync(async (req, res) => {
        const { documentId } = req.params;
        const { status, rejectionReason, aiVerificationResult } = req.body;
        const { user } = req;

        try {
            // Parse documentId (format: driverId_documentType)
            const [driverId, documentType] = documentId.split('_');

            if (!driverId || !documentType) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid document ID format'
                });
            }

            // Find the driver
            const driver = await Driver.findById(driverId);
            if (!driver) {
                return res.status(404).json({
                    success: false,
                    error: 'Driver not found'
                });
            }

            // Check if document exists
            if (!driver.documents || !driver.documents[documentType]) {
                return res.status(404).json({
                    success: false,
                    error: 'Document not found'
                });
            }

            // Update document status
            const updateData = {
                status,
                verifiedAt: status === 'verified' ? new Date() : undefined,
                verifiedBy: status === 'verified' ? user.id : undefined,
                rejectionReason: status === 'rejected' ? rejectionReason : undefined
            };

            // Add AI verification result if provided
            if (aiVerificationResult) {
                updateData.aiVerificationResult = aiVerificationResult;
            }

            // Update the document
            driver.documents[documentType] = {
                ...driver.documents[documentType],
                ...updateData
            };

            // Mark as modified for nested objects
            driver.markModified('documents');
            await driver.save();

            // Send notification to driver (if notification system exists)
            try {
                const notificationService = require('../services/notificationService');
                await notificationService.sendDocumentStatusNotification(driver._id, documentType, status, rejectionReason);
            } catch (notifError) {
                console.log('Notification service not available:', notifError.message);
            }

            successResponse(res, {
                documentId,
                status,
                updatedAt: new Date(),
                verifiedBy: user.id
            }, `Document ${status} successfully`);

        } catch (error) {
            console.error('Error in updateDocumentStatus:', error);
            errorResponse(res, error, 500);
        }
    });

    static startAIVerification = catchAsync(async (req, res) => {
        const { documentId } = req.params;
        const { user } = req;

        try {
            // Parse documentId
            const [driverId, documentType] = documentId.split('_');

            if (!driverId || !documentType) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid document ID format'
                });
            }

            // Find the driver and document
            const driver = await Driver.findById(driverId);
            if (!driver || !driver.documents || !driver.documents[documentType]) {
                return res.status(404).json({
                    success: false,
                    error: 'Document not found'
                });
            }

            const document = driver.documents[documentType];

            // Update status to processing
            driver.documents[documentType].status = 'ai_processing';
            driver.documents[documentType].aiProcessingStartedAt = new Date();
            driver.markModified('documents');
            await driver.save();

            // Start AI verification in background
            const aiVerificationService = require('../services/aiVerificationService');

            // Process AI verification asynchronously
            aiVerificationService.verifyDocument(document.documentUrl, documentType)
                .then(async (result) => {
                    try {
                        // Update document with AI result
                        const updatedDriver = await Driver.findById(driverId);
                        if (updatedDriver && updatedDriver.documents && updatedDriver.documents[documentType]) {
                            updatedDriver.documents[documentType].aiVerificationResult = result;
                            updatedDriver.documents[documentType].status = result.isValid ? 'verified' : 'rejected';
                            updatedDriver.documents[documentType].verifiedAt = new Date();
                            updatedDriver.documents[documentType].verifiedBy = user.id;
                            updatedDriver.documents[documentType].rejectionReason = result.isValid ? undefined : result.reason;

                            updatedDriver.markModified('documents');
                            await updatedDriver.save();

                            console.log(`✅ AI verification completed for ${documentId}:`, result);
                        }
                    } catch (updateError) {
                        console.error('Error updating document after AI verification:', updateError);
                    }
                })
                .catch(async (error) => {
                    try {
                        // Update status to failed
                        const updatedDriver = await Driver.findById(driverId);
                        if (updatedDriver && updatedDriver.documents && updatedDriver.documents[documentType]) {
                            updatedDriver.documents[documentType].status = 'pending';
                            updatedDriver.documents[documentType].aiVerificationResult = {
                                error: error.message,
                                isValid: false
                            };

                            updatedDriver.markModified('documents');
                            await updatedDriver.save();

                            console.error(`❌ AI verification failed for ${documentId}:`, error);
                        }
                    } catch (updateError) {
                        console.error('Error updating document after AI verification failure:', updateError);
                    }
                });

            successResponse(res, {
                documentId,
                status: 'ai_processing',
                message: 'AI verification started successfully'
            }, 'AI verification started successfully');

        } catch (error) {
            console.error('Error in startAIVerification:', error);
            errorResponse(res, error, 500);
        }
    });

    static getDocumentVerificationStatus = catchAsync(async (req, res) => {
        const { documentId } = req.params;

        try {
            const [driverId, documentType] = documentId.split('_');

            if (!driverId || !documentType) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid document ID format'
                });
            }

            const driver = await Driver.findById(driverId)
                .select(`documents.${documentType} fullName email`);

            if (!driver || !driver.documents || !driver.documents[documentType]) {
                return res.status(404).json({
                    success: false,
                    error: 'Document not found'
                });
            }

            const document = driver.documents[documentType];

            successResponse(res, {
                documentId,
                status: document.status,
                aiVerificationResult: document.aiVerificationResult,
                uploadDate: document.uploadDate,
                verifiedAt: document.verifiedAt,
                verifiedBy: document.verifiedBy,
                rejectionReason: document.rejectionReason,
                driverName: driver.fullName || driver.name,
                driverEmail: driver.email
            }, 'Document verification status retrieved successfully');

        } catch (error) {
            console.error('Error in getDocumentVerificationStatus:', error);
            errorResponse(res, error, 500);
        }
    });

    static batchVerifyDocuments = catchAsync(async (req, res) => {
        const { documentIds, action, rejectionReason } = req.body;
        const { user } = req;

        if (!Array.isArray(documentIds) || documentIds.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Document IDs array is required'
            });
        }

        if (!['approve', 'reject'].includes(action)) {
            return res.status(400).json({
                success: false,
                error: 'Action must be either "approve" or "reject"'
            });
        }

        try {
            const results = [];
            const errors = [];

            for (const documentId of documentIds) {
                try {
                    const [driverId, documentType] = documentId.split('_');

                    if (!driverId || !documentType) {
                        errors.push({ documentId, error: 'Invalid document ID format' });
                        continue;
                    }

                    const driver = await Driver.findById(driverId);
                    if (!driver || !driver.documents || !driver.documents[documentType]) {
                        errors.push({ documentId, error: 'Document not found' });
                        continue;
                    }

                    // Update document status
                    const updateData = {
                        status: action === 'approve' ? 'verified' : 'rejected',
                        verifiedAt: new Date(),
                        verifiedBy: user.id,
                        rejectionReason: action === 'reject' ? rejectionReason : undefined
                    };

                    driver.documents[documentType] = {
                        ...driver.documents[documentType],
                        ...updateData
                    };

                    driver.markModified('documents');
                    await driver.save();

                    results.push({
                        documentId,
                        status: updateData.status,
                        success: true
                    });

                } catch (error) {
                    errors.push({ documentId, error: error.message });
                }
            }

            successResponse(res, {
                action,
                totalProcessed: documentIds.length,
                successful: results.length,
                failed: errors.length,
                results,
                errors
            }, `Batch ${action} completed successfully`);

        } catch (error) {
            console.error('Error in batchVerifyDocuments:', error);
            errorResponse(res, error, 500);
        }
    });

    // Admin Earnings Management
    static getEarningsOverview = catchAsync(async (req, res) => {
        const { period = 'allTime', startDate, endDate } = req.query;

        try {
            // Get date range
            let dateFilter = {};
            if (period !== 'allTime') {
                const { startDate: periodStart, endDate: periodEnd } = AnalyticsService.getDateRange(period);
                dateFilter = {
                    createdAt: {
                        $gte: startDate ? new Date(startDate) : periodStart,
                        $lte: endDate ? new Date(endDate) : periodEnd
                    }
                };
            }

            // Get earnings statistics
            const earningsStats = await Delivery.aggregate([
                { $match: dateFilter },
                {
                    $group: {
                        _id: null,
                        totalDeliveries: { $sum: 1 },
                        totalRevenue: { $sum: '$deliveryFee' },
                        totalDriverEarnings: { $sum: '$driverEarning' },
                        totalCompanyEarnings: { $sum: { $subtract: ['$deliveryFee', '$driverEarning'] } },
                        avgDeliveryFee: { $avg: '$deliveryFee' },
                        avgDriverEarning: { $avg: '$driverEarning' },
                        avgCompanyEarning: { $avg: { $subtract: ['$deliveryFee', '$driverEarning'] } }
                    }
                }
            ]);

            // Get earnings by driver
            const driverEarnings = await Delivery.aggregate([
                { $match: dateFilter },
                {
                    $group: {
                        _id: '$assignedTo',
                        driverName: { $first: '$driverName' },
                        totalDeliveries: { $sum: 1 },
                        totalEarnings: { $sum: '$driverEarning' },
                        avgEarning: { $avg: '$driverEarning' },
                        completedDeliveries: {
                            $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] }
                        }
                    }
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
                    $addFields: {
                        driverName: {
                            $ifNull: [
                                { $arrayElemAt: ['$driver.fullName', 0] },
                                { $arrayElemAt: ['$driver.name', 0] },
                                'Unknown Driver'
                            ]
                        }
                    }
                },
                {
                    $project: {
                        driver: 0
                    }
                },
                { $sort: { totalEarnings: -1 } },
                { $limit: 10 }
            ]);

            // Get earnings breakdown by fee structure
            const feeBreakdown = await Delivery.aggregate([
                { $match: dateFilter },
                {
                    $addFields: {
                        feeCategory: {
                            $cond: [
                                { $lte: ['$deliveryFee', 100] },
                                'Under 100',
                                {
                                    $cond: [
                                        { $lte: ['$deliveryFee', 150] },
                                        '100-150',
                                        'Above 150'
                                    ]
                                }
                            ]
                        }
                    }
                },
                {
                    $group: {
                        _id: '$feeCategory',
                        count: { $sum: 1 },
                        totalRevenue: { $sum: '$deliveryFee' },
                        totalDriverEarnings: { $sum: '$driverEarning' },
                        totalCompanyEarnings: { $sum: { $subtract: ['$deliveryFee', '$driverEarning'] } },
                        avgDeliveryFee: { $avg: '$deliveryFee' },
                        avgDriverEarning: { $avg: '$driverEarning' },
                        avgCompanyEarning: { $avg: { $subtract: ['$deliveryFee', '$driverEarning'] } }
                    }
                },
                { $sort: { _id: 1 } }
            ]);

            // Get monthly earnings trend
            const monthlyTrend = await Delivery.aggregate([
                { $match: dateFilter },
                {
                    $group: {
                        _id: {
                            year: { $year: '$createdAt' },
                            month: { $month: '$createdAt' }
                        },
                        totalRevenue: { $sum: '$deliveryFee' },
                        totalDriverEarnings: { $sum: '$driverEarning' },
                        totalCompanyEarnings: { $sum: { $subtract: ['$deliveryFee', '$driverEarning'] } },
                        deliveryCount: { $sum: 1 }
                    }
                },
                {
                    $addFields: {
                        month: {
                            $concat: [
                                { $toString: '$_id.year' },
                                '-',
                                { $toString: { $padLeft: [{ $toString: '$_id.month' }, 2, '0'] } }
                            ]
                        }
                    }
                },
                { $sort: { '_id.year': 1, '_id.month': 1 } },
                { $limit: 12 }
            ]);

            // Get current earnings configuration
            const EarningsConfig = require('../models/EarningsConfig');
            const currentConfig = await EarningsConfig.getActiveConfig();

            const stats = earningsStats[0] || {
                totalDeliveries: 0,
                totalRevenue: 0,
                totalDriverEarnings: 0,
                totalCompanyEarnings: 0,
                avgDeliveryFee: 0,
                avgDriverEarning: 0,
                avgCompanyEarning: 0
            };

            successResponse(res, {
                period,
                dateRange: {
                    startDate: dateFilter.createdAt?.$gte || null,
                    endDate: dateFilter.createdAt?.$lte || null
                },
                summary: {
                    totalDeliveries: stats.totalDeliveries,
                    totalRevenue: stats.totalRevenue,
                    totalDriverEarnings: stats.totalDriverEarnings,
                    totalCompanyEarnings: stats.totalCompanyEarnings,
                    avgDeliveryFee: Math.round(stats.avgDeliveryFee * 100) / 100,
                    avgDriverEarning: Math.round(stats.avgDriverEarning * 100) / 100,
                    avgCompanyEarning: Math.round(stats.avgCompanyEarning * 100) / 100,
                    driverPercentage: stats.totalRevenue > 0 ? Math.round((stats.totalDriverEarnings / stats.totalRevenue) * 100) : 0,
                    companyPercentage: stats.totalRevenue > 0 ? Math.round((stats.totalCompanyEarnings / stats.totalRevenue) * 100) : 0
                },
                topDrivers: driverEarnings,
                feeBreakdown,
                monthlyTrend,
                currentConfig: currentConfig ? {
                    id: currentConfig._id,
                    name: currentConfig.name,
                    rules: currentConfig.rules,
                    effectiveDate: currentConfig.effectiveDate,
                    version: currentConfig.version
                } : null
            }, 'Earnings overview retrieved successfully');

        } catch (error) {
            console.error('Error in getEarningsOverview:', error);
            errorResponse(res, error, 500);
        }
    });

    // Update earnings configuration with new rules
    static updateEarningsRules = catchAsync(async (req, res) => {
        const { rules } = req.body;
        const { user } = req;

        try {
            // Validate the new rules structure
            if (!Array.isArray(rules) || rules.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'At least one earnings rule is required'
                });
            }

            // Create new earnings configuration
            const EarningsConfig = require('../models/EarningsConfig');

            // Deactivate current active config
            await EarningsConfig.updateMany(
                { isActive: true },
                { isActive: false }
            );

            // Create new configuration
            const newConfig = new EarningsConfig({
                name: `Earnings Rules - ${new Date().toLocaleDateString()}`,
                rules: rules,
                createdBy: user.id,
                effectiveDate: new Date(),
                isActive: true,
                version: 1,
                notes: 'Updated earnings rules'
            });

            await newConfig.save();

            // Update existing deliveries with new earnings calculation
            const EarningsService = require('../services/earningsService');
            const updatedCount = await EarningsService.recalculateAllDeliveries(newConfig);

            successResponse(res, {
                config: newConfig,
                updatedDeliveries: updatedCount,
                message: 'Earnings rules updated successfully'
            }, 'Earnings rules updated successfully');

        } catch (error) {
            console.error('Error in updateEarningsRules:', error);
            errorResponse(res, error, 500);
        }
    });

    // Get earnings configuration history
    static getEarningsHistory = catchAsync(async (req, res) => {
        const { page = 1, limit = 20 } = req.query;

        try {
            const EarningsConfig = require('../models/EarningsConfig');

            const configs = await EarningsConfig.find()
                .populate('createdBy', 'name email')
                .populate('updatedBy', 'name email')
                .sort({ effectiveDate: -1 })
                .limit(parseInt(limit))
                .skip((parseInt(page) - 1) * parseInt(limit));

            const total = await EarningsConfig.countDocuments();

            successResponse(res, {
                configs,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / parseInt(limit))
                }
            }, 'Earnings configuration history retrieved successfully');

        } catch (error) {
            console.error('Error in getEarningsHistory:', error);
            errorResponse(res, error, 500);
        }
    });

    // ===== QUICK ACTIONS CONTROLLER METHODS =====

    // 1. Generate Earnings Report
    static generateEarningsReport = catchAsync(async (req, res) => {
        const { period, driverId, format, dateRange } = req.body;
        const { user } = req;

        try {
            // Generate unique report ID
            const reportId = `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Calculate date range based on period
            let startDate, endDate;
            if (period === 'custom' && dateRange) {
                startDate = new Date(dateRange.start);
                endDate = new Date(dateRange.end);
            } else {
                const dateRangeObj = AnalyticsService.getDateRange(period);
                startDate = dateRangeObj.startDate;
                endDate = dateRangeObj.endDate;
            }

            // Build query for deliveries
            const query = {
                createdAt: { $gte: startDate, $lte: endDate },
                status: { $in: ['completed', 'delivered'] }
            };

            if (driverId && driverId !== 'all') {
                query.assignedTo = driverId;
            }

            // Get delivery data
            const deliveries = await Delivery.find(query)
                .populate('assignedTo', 'name email area');

            // Calculate earnings
            const totalEarnings = deliveries.reduce((sum, delivery) => sum + (delivery.driverEarnings || 0), 0);
            const totalFees = deliveries.reduce((sum, delivery) => sum + (delivery.fee || 0), 0);
            const platformFees = totalFees - totalEarnings;

            // Create report data
            const reportData = {
                reportId,
                period,
                driverId: driverId === 'all' ? 'All Drivers' : driverId,
                format,
                generatedBy: user.id,
                generatedAt: new Date(),
                dateRange: { startDate, endDate },
                summary: {
                    totalDeliveries: deliveries.length,
                    totalEarnings,
                    totalFees,
                    platformFees,
                    averagePerDelivery: deliveries.length > 0 ? totalEarnings / deliveries.length : 0
                },
                deliveries: deliveries.map(d => ({
                    id: d._id,
                    driverName: d.assignedTo?.name || 'Unknown',
                    driverEmail: d.assignedTo?.email || 'Unknown',
                    fee: d.fee || 0,
                    driverEarnings: d.driverEarnings || 0,
                    platformFee: (d.fee || 0) - (d.driverEarnings || 0),
                    status: d.status,
                    createdAt: d.createdAt
                }))
            };

            // Store report metadata (in production, you'd save this to database)
            // For now, we'll generate the report URL
            const reportUrl = `${process.env.BASE_URL || 'http://localhost:3001'}/api/admin/earnings/reports/download/${reportId}`;
            const downloadUrl = `/api/admin/earnings/reports/download/${reportId}`;

            successResponse(res, {
                reportId,
                reportUrl,
                downloadUrl,
                status: 'completed',
                message: 'Report generated successfully'
            }, 'Report generated successfully');

        } catch (error) {
            console.error('Error in generateEarningsReport:', error);
            errorResponse(res, error, 500);
        }
    });

    // 2. Get Driver Summary
    static getDriverSummary = catchAsync(async (req, res) => {
        const { period = 'thisMonth', driverId, dateRange } = req.query;

        try {
            // Calculate date range
            let startDate, endDate;
            if (period === 'custom' && dateRange) {
                startDate = new Date(dateRange.start);
                endDate = new Date(dateRange.end);
            } else {
                const dateRangeObj = AnalyticsService.getDateRange(period);
                startDate = dateRangeObj.startDate;
                endDate = dateRangeObj.endDate;
            }

            // Build query
            const query = {
                createdAt: { $gte: startDate, $lte: endDate },
                status: { $in: ['completed', 'delivered'] }
            };

            if (driverId) {
                query.assignedTo = driverId;
            }

            // Get delivery data
            const deliveries = await Delivery.find(query)
                .populate('assignedTo', 'name email area isActive');

            // Calculate driver breakdown
            const driverMap = new Map();

            deliveries.forEach(delivery => {
                const driverId = delivery.assignedTo?._id.toString();
                if (!driverId) return;

                if (!driverMap.has(driverId)) {
                    driverMap.set(driverId, {
                        driverId,
                        name: delivery.assignedTo?.name || 'Unknown',
                        email: delivery.assignedTo?.email || 'Unknown',
                        area: delivery.assignedTo?.area || 'Unknown',
                        earnings: 0,
                        deliveries: 0,
                        averagePerDelivery: 0,
                        status: delivery.assignedTo?.isActive ? 'active' : 'inactive'
                    });
                }

                const driver = driverMap.get(driverId);
                driver.earnings += delivery.driverEarnings || 0;
                driver.deliveries += 1;
            });

            // Calculate averages and totals
            const driverBreakdown = Array.from(driverMap.values()).map(driver => ({
                ...driver,
                averagePerDelivery: driver.deliveries > 0 ? driver.earnings / driver.deliveries : 0
            }));

            const totalDrivers = driverBreakdown.length;
            const activeDrivers = driverBreakdown.filter(d => d.status === 'active').length;
            const totalEarnings = driverBreakdown.reduce((sum, d) => sum + d.earnings, 0);
            const averageEarnings = totalDrivers > 0 ? totalEarnings / totalDrivers : 0;

            successResponse(res, {
                totalDrivers,
                activeDrivers,
                totalEarnings,
                averageEarnings,
                driverBreakdown,
                period,
                dateRange: { startDate, endDate }
            }, 'Driver summary retrieved successfully');

        } catch (error) {
            console.error('Error in getDriverSummary:', error);
            errorResponse(res, error, 500);
        }
    });

    // 3. Get Platform Analytics
    static getPlatformAnalytics = catchAsync(async (req, res) => {
        const { period = 'thisMonth', groupBy = 'daily', dateRange } = req.query;

        try {
            // Calculate date range
            let startDate, endDate;
            if (period === 'custom' && dateRange) {
                startDate = new Date(dateRange.start);
                endDate = new Date(dateRange.end);
            } else {
                const dateRangeObj = AnalyticsService.getDateRange(period);
                startDate = dateRangeObj.startDate;
                endDate = dateRangeObj.endDate;
            }

            // Get delivery data
            const deliveries = await Delivery.find({
                createdAt: { $gte: startDate, $lte: endDate },
                status: { $in: ['completed', 'delivered'] }
            });

            // Calculate totals
            const totalRevenue = deliveries.reduce((sum, d) => sum + (d.fee || 0), 0);
            const driverPayouts = deliveries.reduce((sum, d) => sum + (d.driverEarnings || 0), 0);
            const platformFees = totalRevenue - driverPayouts;
            const profitMargin = totalRevenue > 0 ? (platformFees / totalRevenue) * 100 : 0;

            // Generate chart data based on groupBy
            const chartData = [];
            const currentDate = new Date(startDate);

            while (currentDate <= endDate) {
                const dayStart = new Date(currentDate);
                const dayEnd = new Date(currentDate);

                if (groupBy === 'daily') {
                    dayEnd.setDate(dayEnd.getDate() + 1);
                } else if (groupBy === 'weekly') {
                    dayEnd.setDate(dayEnd.getDate() + 7);
                } else if (groupBy === 'monthly') {
                    dayEnd.setMonth(dayEnd.getMonth() + 1);
                }

                const dayDeliveries = deliveries.filter(d =>
                    d.createdAt >= dayStart && d.createdAt < dayEnd
                );

                const dayRevenue = dayDeliveries.reduce((sum, d) => sum + (d.fee || 0), 0);
                const dayPayouts = dayDeliveries.reduce((sum, d) => sum + (d.driverEarnings || 0), 0);
                const dayFees = dayRevenue - dayPayouts;

                chartData.push({
                    date: dayStart.toISOString().split('T')[0],
                    revenue: dayRevenue,
                    fees: dayFees,
                    payouts: dayPayouts,
                    deliveries: dayDeliveries.length
                });

                if (groupBy === 'daily') {
                    currentDate.setDate(currentDate.getDate() + 1);
                } else if (groupBy === 'weekly') {
                    currentDate.setDate(currentDate.getDate() + 7);
                } else if (groupBy === 'monthly') {
                    currentDate.setMonth(currentDate.getMonth() + 1);
                }
            }

            // Calculate trends (simple comparison with previous period)
            const previousStartDate = new Date(startDate);
            const previousEndDate = new Date(endDate);
            const periodLength = endDate.getTime() - startDate.getTime();

            previousStartDate.setTime(previousStartDate.getTime() - periodLength);
            previousEndDate.setTime(previousEndDate.getTime() - periodLength);

            const previousDeliveries = await Delivery.find({
                createdAt: { $gte: previousStartDate, $lte: previousEndDate },
                status: { $in: ['completed', 'delivered'] }
            });

            const previousRevenue = previousDeliveries.reduce((sum, d) => sum + (d.fee || 0), 0);
            const previousFees = previousDeliveries.reduce((sum, d) => sum + ((d.fee || 0) - (d.driverEarnings || 0)), 0);
            const previousDeliveriesCount = previousDeliveries.length;

            const revenueGrowth = previousRevenue > 0 ? ((totalRevenue - previousRevenue) / previousRevenue) * 100 : 0;
            const feeGrowth = previousFees > 0 ? ((platformFees - previousFees) / previousFees) * 100 : 0;
            const deliveryGrowth = previousDeliveriesCount > 0 ? ((deliveries.length - previousDeliveriesCount) / previousDeliveriesCount) * 100 : 0;

            successResponse(res, {
                totalRevenue,
                platformFees,
                driverPayouts,
                profitMargin,
                trends: {
                    revenueGrowth,
                    feeGrowth,
                    deliveryGrowth
                },
                chartData,
                period,
                groupBy,
                dateRange: { startDate, endDate }
            }, 'Platform analytics retrieved successfully');

        } catch (error) {
            console.error('Error in getPlatformAnalytics:', error);
            errorResponse(res, error, 500);
        }
    });

    // 4. Get Period Comparison
    static getPeriodComparison = catchAsync(async (req, res) => {
        const { currentPeriod, previousPeriod, currentDateRange, previousDateRange } = req.query;

        try {
            // Calculate current period date range
            let currentStart, currentEnd;
            if (currentPeriod === 'custom' && currentDateRange) {
                currentStart = new Date(currentDateRange.start);
                currentEnd = new Date(currentDateRange.end);
            } else {
                const currentRange = AnalyticsService.getDateRange(currentPeriod);
                currentStart = currentRange.startDate;
                currentEnd = currentRange.endDate;
            }

            // Calculate previous period date range
            let previousStart, previousEnd;
            if (previousPeriod === 'custom' && previousDateRange) {
                previousStart = new Date(previousDateRange.start);
                previousEnd = new Date(previousDateRange.end);
            } else {
                const previousRange = AnalyticsService.getDateRange(previousPeriod);
                previousStart = previousRange.startDate;
                previousEnd = previousRange.endDate;
            }

            // Get current period data
            const currentDeliveries = await Delivery.find({
                createdAt: { $gte: currentStart, $lte: currentEnd },
                status: { $in: ['completed', 'delivered'] }
            });

            const currentEarnings = currentDeliveries.reduce((sum, d) => sum + (d.driverEarnings || 0), 0);
            const currentDeliveriesCount = currentDeliveries.length;
            const currentAverage = currentDeliveriesCount > 0 ? currentEarnings / currentDeliveriesCount : 0;

            // Get previous period data
            const previousDeliveries = await Delivery.find({
                createdAt: { $gte: previousStart, $lte: previousEnd },
                status: { $in: ['completed', 'delivered'] }
            });

            const previousEarnings = previousDeliveries.reduce((sum, d) => sum + (d.driverEarnings || 0), 0);
            const previousDeliveriesCount = previousDeliveries.length;
            const previousAverage = previousDeliveriesCount > 0 ? previousEarnings / previousDeliveriesCount : 0;

            // Calculate changes
            const earningsChange = previousEarnings > 0 ? ((currentEarnings - previousEarnings) / previousEarnings) * 100 : 0;
            const deliveriesChange = previousDeliveriesCount > 0 ? ((currentDeliveriesCount - previousDeliveriesCount) / previousDeliveriesCount) * 100 : 0;
            const averageChange = previousAverage > 0 ? ((currentAverage - previousAverage) / previousAverage) * 100 : 0;

            successResponse(res, {
                currentPeriod: {
                    period: currentPeriod,
                    totalEarnings: currentEarnings,
                    deliveries: currentDeliveriesCount,
                    averagePerDelivery: currentAverage,
                    dateRange: { start: currentStart, end: currentEnd }
                },
                previousPeriod: {
                    period: previousPeriod,
                    totalEarnings: previousEarnings,
                    deliveries: previousDeliveriesCount,
                    averagePerDelivery: previousAverage,
                    dateRange: { start: previousStart, end: previousEnd }
                },
                changes: {
                    earningsChange,
                    deliveriesChange,
                    averageChange
                }
            }, 'Period comparison retrieved successfully');

        } catch (error) {
            console.error('Error in getPeriodComparison:', error);
            errorResponse(res, error, 500);
        }
    });

    // 5. Get Top Performers
    static getTopPerformers = catchAsync(async (req, res) => {
        const { period = 'thisMonth', limit = 10, sortBy = 'earnings', dateRange } = req.query;

        try {
            // Calculate date range
            let startDate, endDate;
            if (period === 'custom' && dateRange) {
                startDate = new Date(dateRange.start);
                endDate = new Date(dateRange.end);
            } else {
                const dateRangeObj = AnalyticsService.getDateRange(period);
                startDate = dateRangeObj.startDate;
                endDate = dateRangeObj.endDate;
            }

            // Get delivery data
            const deliveries = await Delivery.find({
                createdAt: { $gte: startDate, $lte: endDate },
                status: { $in: ['completed', 'delivered'] }
            }).populate('assignedTo', 'name email area');

            // Group by driver
            const driverMap = new Map();

            deliveries.forEach(delivery => {
                const driverId = delivery.assignedTo?._id.toString();
                if (!driverId) return;

                if (!driverMap.has(driverId)) {
                    driverMap.set(driverId, {
                        driverId,
                        name: delivery.assignedTo?.name || 'Unknown',
                        email: delivery.assignedTo?.email || 'Unknown',
                        area: delivery.assignedTo?.area || 'Unknown',
                        earnings: 0,
                        deliveries: 0,
                        averagePerDelivery: 0
                    });
                }

                const driver = driverMap.get(driverId);
                driver.earnings += delivery.driverEarnings || 0;
                driver.deliveries += 1;
            });

            // Calculate averages
            const driverData = Array.from(driverMap.values()).map(driver => ({
                ...driver,
                averagePerDelivery: driver.deliveries > 0 ? driver.earnings / driver.deliveries : 0
            }));

            // Sort by specified criteria
            let sortedDrivers;
            switch (sortBy) {
                case 'earnings':
                    sortedDrivers = driverData.sort((a, b) => b.earnings - a.earnings);
                    break;
                case 'deliveries':
                    sortedDrivers = driverData.sort((a, b) => b.deliveries - a.deliveries);
                    break;
                case 'average':
                    sortedDrivers = driverData.sort((a, b) => b.averagePerDelivery - a.averagePerDelivery);
                    break;
                default:
                    sortedDrivers = driverData.sort((a, b) => b.earnings - a.earnings);
            }

            // Add ranking and performance indicators
            const topPerformers = sortedDrivers.slice(0, parseInt(limit)).map((driver, index) => {
                let performance = 'good';
                if (index < 3) performance = 'excellent';
                else if (index < 7) performance = 'very good';

                return {
                    ...driver,
                    rank: index + 1,
                    performance
                };
            });

            successResponse(res, {
                topPerformers,
                period,
                sortBy,
                limit: parseInt(limit),
                dateRange: { startDate, endDate }
            }, 'Top performers retrieved successfully');

        } catch (error) {
            console.error('Error in getTopPerformers:', error);
            errorResponse(res, error, 500);
        }
    });

    // 6. Download Generated Report
    static downloadEarningsReport = catchAsync(async (req, res) => {
        const { reportId } = req.params;

        try {
            // In a real implementation, you'd retrieve the report from storage
            // For now, we'll generate a simple CSV response

            // Get sample data (in production, you'd get this from the stored report)
            const deliveries = await Delivery.find({
                status: { $in: ['completed', 'delivered'] }
            })
                .populate('assignedTo', 'name email')
                .limit(100);

            // Generate CSV content
            const csvHeaders = 'Driver Name,Driver Email,Fee,Driver Earnings,Platform Fee,Status,Date\n';
            const csvRows = deliveries.map(d =>
                `"${d.assignedTo?.name || 'Unknown'}","${d.assignedTo?.email || 'Unknown'}",${d.fee || 0},${d.driverEarnings || 0},${(d.fee || 0) - (d.driverEarnings || 0)},${d.status},"${d.createdAt.toISOString()}"`
            ).join('\n');

            const csvContent = csvHeaders + csvRows;

            // Set response headers for file download
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="earnings-report-${reportId}.csv"`);
            res.setHeader('Content-Length', Buffer.byteLength(csvContent));

            res.send(csvContent);

        } catch (error) {
            console.error('Error in downloadEarningsReport:', error);
            errorResponse(res, error, 500);
        }
    });

    // 7. Get Report Status
    static getReportStatus = catchAsync(async (req, res) => {
        const { reportId } = req.params;

        try {
            // In a real implementation, you'd check the actual report status from storage
            // For now, we'll return a mock status

            successResponse(res, {
                reportId,
                status: 'completed',
                generatedAt: new Date().toISOString(),
                downloadUrl: `/api/admin/earnings/reports/download/${reportId}`,
                message: 'Report is ready for download'
            }, 'Report status retrieved successfully');

        } catch (error) {
            console.error('Error in getReportStatus:', error);
            errorResponse(res, error, 500);
        }
    });

    // Get available referral codes for driver invitation
    static getAvailableReferralCodes = catchAsync(async (req, res) => {
        try {
            const InvitationReferralCode = require('../models/InvitationReferralCode');

            // Get all active referral codes with referrer information
            const referralCodes = await InvitationReferralCode.find({
                status: 'active'
            })
                .populate('referrer', 'name email')
                .sort({ createdAt: -1 });

            // Format the response
            const availableCodes = referralCodes.map(code => ({
                referralCode: code.referralCode,
                referrerName: code.referrer.name,
                referrerEmail: code.referrer.email,
                createdAt: code.createdAt,
                expiresAt: code.expiresAt
            }));

            successResponse(res, {
                availableCodes,
                total: availableCodes.length
            }, 'Available referral codes retrieved successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // ========================================
    // LEADERBOARD CONTROLLER METHODS
    // ========================================

    // Get leaderboard data
    static getLeaderboard = catchAsync(async (req, res) => {
        const { category = 'overall', period = 'month', limit = 20 } = req.query;

        try {
            console.log('🎯 Leaderboard request:', { category, period, limit });

            // Get all active drivers
            const drivers = await Driver.find({
                isActive: true,
                isSuspended: false
            }).lean();

            if (!drivers || drivers.length === 0) {
                return successResponse(res, {
                    leaderboard: [],
                    category,
                    period,
                    total: 0,
                    limit: parseInt(limit)
                }, 'No drivers found for leaderboard');
            }

            console.log(`✅ Found ${drivers.length} drivers for leaderboard`);

            // Calculate leaderboard data using driver's stored statistics
            const leaderboardData = drivers.map((driver) => {
                // Use driver's stored statistics
                const totalDeliveries = driver.totalDeliveries || 0;
                const totalEarnings = driver.totalEarnings || 0;
                const completedDeliveries = driver.completedDeliveries || 0;
                const rating = driver.rating || 4.5;
                const totalReferrals = driver.referralPoints || 0;
                const completionRate = driver.completionRate || 0;
                const avgDeliveryTime = 25; // Placeholder - could be calculated from actual delivery times

                // Calculate points based on category
                const points = AdminController.calculateLeaderboardPoints({
                    totalDeliveries,
                    totalEarnings,
                    rating,
                    totalReferrals,
                    avgDeliveryTime,
                    completionRate
                }, category);

                return {
                    _id: driver._id,
                    name: driver.name || driver.fullName || 'Unknown Driver',
                    email: driver.email,
                    phone: driver.phone,
                    totalDeliveries,
                    totalEarnings,
                    rating: parseFloat(rating.toFixed(1)),
                    completionRate: parseFloat(completionRate.toFixed(1)),
                    avgDeliveryTime,
                    totalReferrals,
                    isOnline: driver.isOnline || false,
                    lastActive: driver.lastLogin || driver.updatedAt,
                    points: Math.round(points),
                    profilePicture: driver.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(driver.name || 'Driver')}&background=random`
                };
            });

            // Sort by points for the selected category
            leaderboardData.sort((a, b) => b.points - a.points);

            // Apply limit
            const limitedData = leaderboardData.slice(0, parseInt(limit));

            console.log(`✅ Leaderboard data processed: ${limitedData.length} drivers`);

            return successResponse(res, {
                leaderboard: limitedData,
                period,
                generatedAt: new Date().toISOString()
            }, 'Driver leaderboard retrieved successfully');

        } catch (error) {
            console.error('❌ Leaderboard API error:', error);
            return errorResponse(res, error, 500);
        }
    });

    // Get leaderboard categories
    static getLeaderboardCategories = catchAsync(async (req, res) => {
        try {
            const categories = [
                {
                    id: 'overall',
                    name: 'Overall Champions',
                    icon: '🏆',
                    description: 'Best overall performance across all metrics'
                },
                {
                    id: 'delivery',
                    name: 'Delivery Masters',
                    icon: '📦',
                    description: 'Most deliveries completed'
                },
                {
                    id: 'earnings',
                    name: 'Top Earners',
                    icon: '💰',
                    description: 'Highest earnings generated'
                },
                {
                    id: 'referrals',
                    name: 'Referral Kings',
                    icon: '👥',
                    description: 'Most successful referrals'
                },
                {
                    id: 'rating',
                    name: 'Rating Stars',
                    icon: '⭐',
                    description: 'Highest customer ratings'
                },
                {
                    id: 'speed',
                    name: 'Speed Demons',
                    icon: '⚡',
                    description: 'Fastest delivery times'
                }
            ];

            successResponse(res, {
                data: categories
            }, 'Leaderboard categories retrieved successfully');

        } catch (error) {
            console.error('❌ Leaderboard categories API error:', error);
            errorResponse(res, error, 500);
        }
    });

    // Helper function to calculate points based on category
    static calculateLeaderboardPoints = (driver, category) => {
        switch (category) {
            case 'overall':
                return (driver.totalDeliveries * 10) +
                    (driver.totalEarnings * 0.1) +
                    (driver.rating * 10) +
                    (driver.totalReferrals * 20) +
                    (driver.completionRate * 0.5);
            case 'delivery':
                return driver.totalDeliveries * 10;
            case 'earnings':
                return driver.totalEarnings * 0.1;
            case 'referrals':
                return driver.totalReferrals * 20;
            case 'rating':
                return driver.rating * 10;
            case 'speed':
                return driver.avgDeliveryTime ? (100 - driver.avgDeliveryTime) : 50;
            default:
                return (driver.totalDeliveries * 10) + (driver.totalEarnings * 0.1);
        }
    };

    // Validate and fix all driver earnings
    static validateAllDriverEarnings = catchAsync(async (req, res) => {
        try {
            const EarningsValidationService = require('../services/earningsValidationService');
            const validationResults = await EarningsValidationService.validateAllDriversEarnings();

            successResponse(res, validationResults, 'Driver earnings validation completed');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Fix specific driver earnings
    static fixDriverEarnings = catchAsync(async (req, res) => {
        const { driverId } = req.params;

        try {
            const EarningsValidationService = require('../services/earningsValidationService');
            const fixResult = await EarningsValidationService.fixDriverEarnings(driverId);

            if (fixResult.success) {
                successResponse(res, fixResult, 'Driver earnings fixed successfully');
            } else {
                errorResponse(res, { error: fixResult.error }, 400);
            }
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Validate specific driver earnings
    static validateDriverEarnings = catchAsync(async (req, res) => {
        const { driverId } = req.params;

        try {
            const EarningsValidationService = require('../services/earningsValidationService');
            const validationResult = await EarningsValidationService.validateDriverEarnings(driverId);

            successResponse(res, validationResult, 'Driver earnings validation completed');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

}

module.exports = AdminController;