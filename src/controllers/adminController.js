const Admin = require('../models/Admin');
const Driver = require('../models/Driver');
const Delivery = require('../models/Delivery');
const AnalyticsService = require('../services/analyticsService');
const EmailService = require('../services/emailService');
const DriverInvitationService = require('../services/driverInvitationService');
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

    // Get recent deliveries for dashboard
    static getRecentDeliveries = catchAsync(async (req, res) => {
        try {
            const recentDeliveries = await Delivery.find()
                .populate('assignedTo', 'name email area')
                .populate('assignedBy', 'name email')
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
                .select('_id name email area isOnline lastLogin totalDeliveries totalEarnings rating')
                .sort({ lastLogin: -1 });

            const driverStatus = drivers.map(driver => ({
                id: driver._id,
                name: driver.name,
                email: driver.email,
                area: driver.area,
                isOnline: driver.isOnline || false,
                lastLogin: driver.lastLogin,
                totalDeliveries: driver.totalDeliveries || 0,
                totalEarnings: driver.totalEarnings || 0,
                rating: driver.rating || 0
            }));

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
        const { name, email } = req.body;
        const { user } = req;

        try {
            const invitation = await DriverInvitationService.createInvitation({
                name,
                email,
                invitedBy: user.id
            });

            successResponse(res, {
                invitationId: invitation._id,
                email: invitation.email,
                status: invitation.status,
                expiresAt: invitation.expiresAt
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

    // Document Management Methods
    static getPendingDocuments = catchAsync(async (req, res) => {
        const { status = 'pending', documentType, page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;

        try {
            // Build query based on filters
            let query = {};

            // Filter by document status
            if (status !== 'all') {
                query[`documents.${documentType || 'studentId'}.status`] = status;
            }

            // Filter by specific document type if provided
            if (documentType) {
                query[`documents.${documentType}`] = { $exists: true };
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
                        if (doc && doc.documentUrl) {
                            documents.push({
                                id: `${driver._id}_${docType}`,
                                driverId: driver._id,
                                driverName: driver.fullName || driver.name,
                                driverEmail: driver.email,
                                driverPhone: driver.phone,
                                studentId: driver.studentId,
                                documentType: docType,
                                status: doc.status || 'pending',
                                documentUrl: doc.documentUrl,
                                uploadDate: doc.uploadDate,
                                verifiedAt: doc.verifiedAt,
                                verifiedBy: doc.verifiedBy,
                                rejectionReason: doc.rejectionReason,
                                aiVerificationResult: doc.aiVerificationResult,
                                profilePicture: driver.profilePicture,
                                joinedAt: driver.joinedAt
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


}

module.exports = AdminController;