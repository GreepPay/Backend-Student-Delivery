const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Driver = require('../models/Driver');
const Admin = require('../models/Admin');
const { catchAsync, successResponse, errorResponse, paginatedResponse } = require('../middleware/errorHandler');
const SocketService = require('../services/socketService');

class ConversationController {
    // Create or get existing conversation for driver
    static createOrGetConversation = catchAsync(async (req, res) => {
        const { driverId, subject, type = 'general' } = req.body;
        const senderType = req.user.userType; // 'driver' or 'admin'
        const senderId = req.user.id;

        let actualDriverId = driverId;
        if (senderType === 'driver') {
            actualDriverId = senderId;
        }

        // Check if there's an active conversation for this driver
        let conversation = await Conversation.findOne({
            driverId: actualDriverId,
            status: { $in: ['active', 'waiting'] }
        }).populate('driverId', 'fullName email profilePicture area');

        if (!conversation) {
            // Create new conversation
            conversation = new Conversation({
                driverId: actualDriverId,
                subject: subject || 'New conversation',
                status: 'waiting',
                priority: type === 'emergency' ? 'urgent' : 'normal',
                tags: [type],
                isEmergency: type === 'emergency'
            });

            await conversation.save();
            await conversation.populate('driverId', 'fullName email profilePicture area');
        }

        successResponse(res, { conversation }, 'Conversation retrieved successfully');
    });

    // Get all conversations for admin
    static getAdminConversations = catchAsync(async (req, res) => {
        const { status = 'active', priority, assigned, page = 1, limit = 20 } = req.query;
        const { user } = req;

        let query = {};

        // Filter by status
        if (status === 'all') {
            query.status = { $in: ['active', 'waiting', 'resolved'] };
        } else {
            query.status = status;
        }

        // Filter by priority
        if (priority) {
            query.priority = priority;
        }

        // Filter by assignment
        if (assigned === 'me') {
            query.assignedAdminId = user.id;
        } else if (assigned === 'unassigned') {
            query.assignedAdminId = null;
        }

        const options = {
            page: parseInt(page),
            limit: parseInt(limit),
            sort: {
                priority: -1, // Urgent first
                updatedAt: -1
            },
            populate: [
                { path: 'driverId', select: 'fullName email profilePicture area isOnline' },
                { path: 'assignedAdminId', select: 'fullName email' }
            ]
        };

        const conversations = await Conversation.paginate(query, options);

        successResponse(res, conversations, 'Conversations retrieved successfully');
    });

    // Get conversation details with messages
    static getConversationDetails = catchAsync(async (req, res) => {
        const { conversationId } = req.params;
        const { page = 1, limit = 50 } = req.query;

        const conversation = await Conversation.findById(conversationId)
            .populate('driverId', 'fullName email profilePicture area phone')
            .populate('assignedAdminId', 'fullName email')
            .populate('resolvedBy', 'fullName email');

        if (!conversation) {
            return errorResponse(res, 'Conversation not found', 404);
        }

        // Get messages for this conversation
        const messageOptions = {
            page: parseInt(page),
            limit: parseInt(limit),
            sort: { timestamp: 1 }, // Oldest first for conversation view
            populate: [
                { path: 'driverId', select: 'fullName email profilePicture' },
                { path: 'adminId', select: 'fullName email profilePicture' }
            ]
        };

        const messages = await Message.paginate(
            { conversationId: conversationId },
            messageOptions
        );

        successResponse(res, {
            conversation,
            messages: messages.docs,
            pagination: {
                page: messages.page,
                limit: messages.limit,
                total: messages.totalDocs,
                pages: messages.totalPages
            }
        }, 'Conversation details retrieved successfully');
    });

    // Assign conversation to admin
    static assignConversation = catchAsync(async (req, res) => {
        const { conversationId } = req.params;
        const { adminId } = req.body;
        const { user } = req;

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
            return errorResponse(res, 'Conversation not found', 404);
        }

        // Check if admin exists
        if (adminId) {
            const admin = await Admin.findById(adminId);
            if (!admin) {
                return errorResponse(res, 'Admin not found', 404);
            }
        }

        conversation.assignedAdminId = adminId;
        conversation.status = adminId ? 'active' : 'waiting';
        conversation.updatedAt = new Date();

        await conversation.save();
        await conversation.populate('assignedAdminId', 'fullName email');

        // Emit assignment notification
        SocketService.emitToAdmins('conversation-assigned', {
            conversationId: conversation._id,
            driverId: conversation.driverId,
            assignedAdminId: adminId,
            assignedBy: user.id
        });

        successResponse(res, { conversation }, 'Conversation assigned successfully');
    });

    // Update conversation status
    static updateConversationStatus = catchAsync(async (req, res) => {
        const { conversationId } = req.params;
        const { status, resolution } = req.body;
        const { user } = req;

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
            return errorResponse(res, 'Conversation not found', 404);
        }

        conversation.status = status;
        if (status === 'resolved') {
            conversation.resolvedAt = new Date();
            conversation.resolvedBy = user.id;
            conversation.resolution = resolution;
        }

        await conversation.save();

        // Emit status update
        SocketService.emitToAdmins('conversation-status-updated', {
            conversationId: conversation._id,
            status: status,
            updatedBy: user.id
        });

        successResponse(res, { conversation }, 'Conversation status updated successfully');
    });

    // Get conversation statistics
    static getConversationStats = catchAsync(async (req, res) => {
        const stats = await Conversation.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        const priorityStats = await Conversation.aggregate([
            {
                $group: {
                    _id: '$priority',
                    count: { $sum: 1 }
                }
            }
        ]);

        const emergencyCount = await Conversation.countDocuments({ isEmergency: true, status: { $in: ['active', 'waiting'] } });
        const unassignedCount = await Conversation.countDocuments({ assignedAdminId: null, status: { $in: ['active', 'waiting'] } });

        successResponse(res, {
            statusStats: stats,
            priorityStats: priorityStats,
            emergencyCount,
            unassignedCount
        }, 'Conversation statistics retrieved successfully');
    });

    // Get driver's conversations
    static getDriverConversations = catchAsync(async (req, res) => {
        const { user } = req;
        const { page = 1, limit = 10 } = req.query;

        const options = {
            page: parseInt(page),
            limit: parseInt(limit),
            sort: { updatedAt: -1 },
            populate: [
                { path: 'assignedAdminId', select: 'fullName email' }
            ]
        };

        const conversations = await Conversation.paginate(
            { driverId: user.id },
            options
        );

        successResponse(res, conversations, 'Driver conversations retrieved successfully');
    });

    // Mark conversation as read
    static markConversationAsRead = catchAsync(async (req, res) => {
        const { conversationId } = req.params;
        const { user } = req;

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
            return errorResponse(res, 'Conversation not found', 404);
        }

        // Update unread count based on user type
        if (user.userType === 'admin') {
            conversation.unreadCount.admin = 0;
        } else if (user.userType === 'driver') {
            conversation.unreadCount.driver = 0;
        }

        await conversation.save();

        successResponse(res, { conversation }, 'Conversation marked as read successfully');
    });
}

module.exports = ConversationController;
