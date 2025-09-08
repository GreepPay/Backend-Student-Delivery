const express = require('express');
const router = express.Router();
const MessageController = require('../controllers/messageController');
const { authenticateToken } = require('../middleware/auth');
const { validate, validateQuery, validateParams } = require('../middleware/validation');
const Joi = require('joi');

// Validation schemas
const messageSchemas = {
    sendMessage: Joi.object({
        message: Joi.string().trim().min(1).max(1000).required(),
        type: Joi.string().valid('general', 'emergency', 'document', 'delivery', 'earnings').default('general'),
        location: Joi.object({
            lat: Joi.number().min(-90).max(90),
            lng: Joi.number().min(-180).max(180),
            address: Joi.string().optional(),
            accuracy: Joi.number().optional()
        }).optional(),
        responseTo: Joi.string().optional(),
        driverId: Joi.string().when('$userType', {
            is: 'admin',
            then: Joi.optional(), // driverId is optional for admin messages
            otherwise: Joi.forbidden()
        }),
        conversationId: Joi.string().when('$userType', {
            is: 'admin',
            then: Joi.optional(), // conversationId is optional for admin messages
            otherwise: Joi.forbidden()
        })
    }),

    getMessageHistory: Joi.object({
        driverId: Joi.string().optional(),
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(100).default(50),
        type: Joi.string().valid('general', 'emergency', 'document', 'delivery', 'earnings', 'all').default('all'),
        unreadOnly: Joi.boolean().default(false)
    }),

    markAsRead: Joi.object({
        messageIds: Joi.array().items(Joi.string()).min(1).required()
    }),

    getEmergencyMessages: Joi.object({
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(100).default(20)
    }),

    deleteMessage: Joi.object({
        messageId: Joi.string().required()
    })
};

// Apply authentication to all routes
router.use(authenticateToken);

// Send a new message
router.post('/send',
    authenticateToken,
    validate(messageSchemas.sendMessage),
    MessageController.sendMessage
);

// Get message history
router.get('/history',
    validateQuery(messageSchemas.getMessageHistory),
    MessageController.getMessageHistory
);

// Mark messages as read
router.put('/read',
    validate(messageSchemas.markAsRead),
    MessageController.markAsRead
);

// Get unread message count
router.get('/unread-count',
    MessageController.getUnreadCount
);

// Get emergency messages (admin only)
router.get('/emergency',
    validateQuery(messageSchemas.getEmergencyMessages),
    MessageController.getEmergencyMessages
);

// Delete a message
router.delete('/:messageId',
    validateParams(messageSchemas.deleteMessage),
    MessageController.deleteMessage
);

// Get message statistics (admin only)
router.get('/stats',
    MessageController.getMessageStats
);

module.exports = router;

