const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const Driver = require('../models/Driver');
const Admin = require('../models/Admin');
const { catchAsync, successResponse, errorResponse, paginatedResponse } = require('../middleware/errorHandler');
const SocketService = require('../services/socketService');
const CloudinaryService = require('../services/cloudinaryService');

class MessageController {
    // Send a new message
    static sendMessage = catchAsync(async (req, res) => {
        const { message, type = 'general', location, responseTo, imageUrl } = req.body;
        const { user } = req;

        try {
            // Validate message content (allow empty if image is provided)
            if ((!message || message.trim().length === 0) && !imageUrl) {
                return errorResponse(res, 'Message content or image is required', 400);
            }

            // Only validate message length if message is provided
            if (message && message.length > 1000) {
                return errorResponse(res, 'Message cannot exceed 1000 characters', 400);
            }

            // Determine sender type and IDs
            let driverId, adminId, senderType;

            if (user.userType === 'driver') {
                driverId = user.id;
                senderType = 'driver';
            } else if (user.userType === 'admin') {
                adminId = user.id;
                senderType = 'admin';

                // For admin messages, either driverId or conversationId should be provided
                if (!req.body.driverId && !req.body.conversationId) {
                    return errorResponse(res, 'Either driverId or conversationId is required for admin messages', 400);
                }
                driverId = req.body.driverId;
            } else {
                return errorResponse(res, 'Invalid user type', 400);
            }

            // Find or create conversation
            let conversation;
            if (senderType === 'driver') {
                // Find existing active conversation for driver
                conversation = await Conversation.findOne({
                    driverId: driverId,
                    status: { $in: ['active', 'waiting'] }
                });

                if (!conversation) {
                    // Create new conversation
                    conversation = new Conversation({
                        driverId: driverId,
                        subject: 'New conversation',
                        status: 'waiting',
                        priority: 'normal',
                        tags: [type]
                    });
                    await conversation.save();
                }
            } else if (senderType === 'admin') {
                // For admin messages, find or create conversation
                if (req.body.conversationId && !req.body.conversationId.startsWith('temp-')) {
                    // Use provided conversationId (only if it's not a temporary ID)
                    conversation = await Conversation.findById(req.body.conversationId);
                    if (!conversation) {
                        return errorResponse(res, 'Conversation not found', 404);
                    }
                    // Set driverId from the conversation if not provided
                    if (!driverId) {
                        driverId = conversation.driverId;
                    }
                } else {
                    // Neither conversationId nor driverId provided - this is an error for admin messages
                    if (!driverId) {
                        return errorResponse(res, 'Either driverId or conversationId is required for admin messages', 400);
                    }

                    // Find existing conversation or create new one
                    conversation = await Conversation.findOne({
                        driverId: driverId,
                        status: { $in: ['active', 'waiting'] }
                    });

                    if (!conversation) {
                        // Create new conversation for admin message
                        conversation = new Conversation({
                            driverId: driverId,
                            subject: 'Admin message',
                            status: 'active',
                            priority: 'normal',
                            tags: [type]
                        });
                        await conversation.save();
                    }
                }
            }

            // Create message object
            const messageData = {
                conversationId: conversation._id,
                driverId,
                adminId,
                message: message ? message.trim() : (imageUrl ? '' : 'No message'), // Allow empty message if image is provided
                type,
                senderType,
                location: location || null,
                responseTo: responseTo || null,
                imageUrl: imageUrl || null
            };

            // Create message instance
            const newMessage = new Message(messageData);

            // Detect emergency keywords
            const isEmergency = newMessage.detectEmergency();

            // Set priority based on type and emergency detection
            if (isEmergency || type === 'emergency') {
                newMessage.priority = 'urgent';
                newMessage.type = 'emergency';
            } else if (type === 'delivery') {
                newMessage.priority = 'high';
            }

            // Save message
            await newMessage.save();

            // Update conversation
            conversation.lastMessage = {
                message: message ? message.trim() : (imageUrl ? '[Image]' : 'No message'),
                senderType: senderType,
                timestamp: newMessage.timestamp,
                isRead: false
            };
            conversation.messageCount += 1;
            conversation.updatedAt = new Date();

            // Update unread count
            if (senderType === 'driver') {
                conversation.unreadCount.admin += 1;
            } else {
                conversation.unreadCount.driver += 1;
            }

            // Update conversation priority and status if emergency
            if (isEmergency || type === 'emergency') {
                conversation.priority = 'urgent';
                conversation.isEmergency = true;
                conversation.emergencyKeywords = newMessage.emergencyKeywords || [];
                conversation.status = 'active';
            }

            await conversation.save();

            // Populate message for response
            await newMessage.populate([
                { path: 'driverId', select: 'fullName email profilePicture' },
                { path: 'adminId', select: 'name email' }
            ]);

            // Emit WebSocket event
            const socketData = {
                messageId: newMessage._id,
                driverId: newMessage.driverId._id,
                driverName: newMessage.driverId.fullName,
                message: newMessage.message,
                type: newMessage.type,
                priority: newMessage.priority,
                senderType: newMessage.senderType,
                location: newMessage.location,
                timestamp: newMessage.timestamp,
                isEmergency: newMessage.isEmergency,
                imageUrl: newMessage.imageUrl
            };

            if (senderType === 'driver') {
                // Driver sent message - notify admins
                SocketService.emitToAdmins('driver-message', {
                    ...socketData,
                    conversationId: conversation._id,
                    conversationStatus: conversation.status
                });

                // If emergency, send immediate notification
                if (isEmergency) {
                    SocketService.emitToAdmins('emergency-alert', {
                        ...socketData,
                        conversationId: conversation._id,
                        emergencyKeywords: newMessage.emergencyKeywords
                    });
                }
            } else {
                // Admin sent message - notify specific driver
                SocketService.emitToDriver(driverId, 'admin-message', {
                    ...socketData,
                    conversationId: conversation._id
                });
            }

            // Update driver's last activity
            if (senderType === 'driver') {
                await Driver.findByIdAndUpdate(driverId, {
                    lastMessageAt: new Date()
                });
            }

            successResponse(res, {
                message: newMessage,
                conversation: conversation,
                isEmergency,
                emergencyKeywords: newMessage.emergencyKeywords
            }, 'Message sent successfully');

        } catch (error) {
            console.error('Error in sendMessage:', error);
            errorResponse(res, error.message, 500);
        }
    });

    // Get message history
    static getMessageHistory = catchAsync(async (req, res) => {
        const { driverId, page = 1, limit = 50, type, unreadOnly = false } = req.query;
        const { user } = req;

        try {
            // Build query
            let query = { isDeleted: false };

            // For drivers, only show their own messages
            if (user.userType === 'driver') {
                query.driverId = user.id;
            } else if (user.userType === 'admin') {
                // For admins, filter by driverId if provided
                if (driverId) {
                    query.driverId = driverId;
                }
            }

            // Filter by type
            if (type && type !== 'all') {
                query.type = type;
            }

            // Filter unread messages
            if (unreadOnly) {
                const readField = user.userType === 'driver'
                    ? 'readBy.driver.isRead'
                    : 'readBy.admin.isRead';
                query[readField] = false;
            }

            // Get messages with pagination
            const messages = await Message.find(query)
                .populate('driverId', 'fullName email profilePicture')
                .populate('adminId', 'name email')
                .sort({ timestamp: -1 })
                .skip((page - 1) * limit)
                .limit(parseInt(limit));

            // Get total count
            const total = await Message.countDocuments(query);

            // Mark messages as delivered (not read yet)
            const messageIds = messages.map(msg => msg._id);
            await Message.updateMany(
                { _id: { $in: messageIds } },
                {
                    $set: {
                        status: 'delivered',
                        [`readBy.${user.userType}.readAt`]: new Date()
                    }
                }
            );

            paginatedResponse(res, {
                messages: messages.reverse(), // Show oldest first
                unreadCount: await Message.getUnreadCount(user.id, user.userType)
            }, {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }, 'Message history retrieved successfully');

        } catch (error) {
            console.error('Error in getMessageHistory:', error);
            errorResponse(res, error.message, 500);
        }
    });

    // Mark messages as read
    static markAsRead = catchAsync(async (req, res) => {
        const { messageIds } = req.body;
        const { user } = req;

        try {
            if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
                return errorResponse(res, 'Message IDs are required', 400);
            }

            // Update messages
            const result = await Message.updateMany(
                {
                    _id: { $in: messageIds },
                    isDeleted: false
                },
                {
                    $set: {
                        [`readBy.${user.userType}.isRead`]: true,
                        [`readBy.${user.userType}.readAt`]: new Date(),
                        status: 'read'
                    }
                }
            );

            successResponse(res, {
                modifiedCount: result.modifiedCount,
                messageIds
            }, 'Messages marked as read');

        } catch (error) {
            console.error('Error in markAsRead:', error);
            errorResponse(res, error.message, 500);
        }
    });

    // Get unread message count
    static getUnreadCount = catchAsync(async (req, res) => {
        const { user } = req;

        try {
            const unreadCount = await Message.getUnreadCount(user.id, user.userType);

            successResponse(res, {
                unreadCount,
                hasUnread: unreadCount > 0
            }, 'Unread count retrieved successfully');

        } catch (error) {
            console.error('Error in getUnreadCount:', error);
            errorResponse(res, error.message, 500);
        }
    });

    // Get emergency messages
    static getEmergencyMessages = catchAsync(async (req, res) => {
        const { page = 1, limit = 20 } = req.query;
        const { user } = req;

        try {
            // Only admins can access emergency messages
            if (user.userType !== 'admin') {
                return errorResponse(res, 'Access denied', 403);
            }

            const messages = await Message.find({
                isEmergency: true,
                isDeleted: false
            })
                .populate('driverId', 'fullName email phone profilePicture')
                .populate('adminId', 'name email')
                .sort({ timestamp: -1 })
                .skip((page - 1) * limit)
                .limit(parseInt(limit));

            const total = await Message.countDocuments({
                isEmergency: true,
                isDeleted: false
            });

            paginatedResponse(res, {
                messages,
                emergencyCount: total
            }, {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }, 'Emergency messages retrieved successfully');

        } catch (error) {
            console.error('Error in getEmergencyMessages:', error);
            errorResponse(res, error.message, 500);
        }
    });

    // Delete message
    static deleteMessage = catchAsync(async (req, res) => {
        const { messageId } = req.params;
        const { user } = req;

        try {
            const message = await Message.findById(messageId);

            if (!message) {
                return errorResponse(res, 'Message not found', 404);
            }

            // Check permissions
            if (user.userType === 'driver' && message.driverId.toString() !== user.id) {
                return errorResponse(res, 'Access denied', 403);
            }

            // Soft delete
            message.isDeleted = true;
            await message.save();

            successResponse(res, {
                messageId: message._id
            }, 'Message deleted successfully');

        } catch (error) {
            console.error('Error in deleteMessage:', error);
            errorResponse(res, error.message, 500);
        }
    });

    // Get message statistics
    static getMessageStats = catchAsync(async (req, res) => {
        const { user } = req;

        try {
            // Only admins can access message statistics
            if (user.userType !== 'admin') {
                return errorResponse(res, 'Access denied', 403);
            }

            const stats = await Message.aggregate([
                {
                    $match: {
                        isDeleted: false,
                        timestamp: {
                            $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
                        }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalMessages: { $sum: 1 },
                        emergencyMessages: {
                            $sum: { $cond: ['$isEmergency', 1, 0] }
                        },
                        unreadMessages: {
                            $sum: { $cond: ['$readBy.admin.isRead', 0, 1] }
                        },
                        driverMessages: {
                            $sum: { $cond: [{ $eq: ['$senderType', 'driver'] }, 1, 0] }
                        },
                        adminMessages: {
                            $sum: { $cond: [{ $eq: ['$senderType', 'admin'] }, 1, 0] }
                        }
                    }
                }
            ]);

            const result = stats[0] || {
                totalMessages: 0,
                emergencyMessages: 0,
                unreadMessages: 0,
                driverMessages: 0,
                adminMessages: 0
            };

            successResponse(res, result, 'Message statistics retrieved successfully');

        } catch (error) {
            console.error('Error in getMessageStats:', error);
            errorResponse(res, error.message, 500);
        }
    });

    // Upload message image
    static uploadMessageImage = catchAsync(async (req, res) => {
        try {
            // Check if file was uploaded
            if (!req.file) {
                return errorResponse(res, 'No image file provided', 400);
            }

            // Validate the image file
            const validation = CloudinaryService.validateImage(req.file);
            if (!validation.valid) {
                return errorResponse(res, validation.error, 400);
            }

            console.log('📸 Uploading message image...', {
                originalName: req.file.originalname,
                mimetype: req.file.mimetype,
                size: req.file.size
            });

            // Upload to Cloudinary
            const uploadResult = await CloudinaryService.uploadImage(req.file, 'message-images');

            if (!uploadResult.success) {
                console.error('❌ Cloudinary upload failed:', uploadResult.error);
                return errorResponse(res, 'Failed to upload image: ' + uploadResult.error, 500);
            }

            console.log('✅ Message image uploaded successfully:', uploadResult.url);

            return successResponse(res, {
                imageUrl: uploadResult.url,
                publicId: uploadResult.public_id,
                width: uploadResult.width,
                height: uploadResult.height,
                bytes: uploadResult.bytes
            }, 'Image uploaded successfully');

        } catch (error) {
            console.error('❌ Message image upload error:', error);
            return errorResponse(res, 'Failed to upload image: ' + error.message, 500);
        }
    });

    // Delete message image
    static deleteMessageImage = catchAsync(async (req, res) => {
        try {
            const { imageUrl } = req.body;

            if (!imageUrl) {
                return errorResponse(res, 'Image URL is required', 400);
            }

            // Extract public_id from Cloudinary URL
            let publicId = null;
            if (imageUrl.includes('cloudinary.com')) {
                const urlParts = imageUrl.split('/');
                const filename = urlParts[urlParts.length - 1];
                const folder = urlParts[urlParts.length - 2];
                publicId = `${folder}/${filename.split('.')[0]}`;
            }

            if (!publicId) {
                return errorResponse(res, 'Invalid image URL', 400);
            }

            console.log('🗑️ Deleting message image:', publicId);

            // Delete from Cloudinary
            const deleteResult = await CloudinaryService.deleteImage(publicId);

            if (!deleteResult.success) {
                console.error('❌ Cloudinary delete failed:', deleteResult.error);
                return errorResponse(res, 'Failed to delete image: ' + deleteResult.error, 500);
            }

            console.log('✅ Message image deleted successfully');

            return successResponse(res, {
                deleted: true,
                publicId: publicId
            }, 'Image deleted successfully');

        } catch (error) {
            console.error('❌ Message image delete error:', error);
            return errorResponse(res, 'Failed to delete image: ' + error.message, 500);
        }
    });
}

module.exports = MessageController;
