const express = require('express');
const router = express.Router();
const ConversationController = require('../controllers/conversationController');
const { authenticateToken, driverOnly, adminOnly } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const Joi = require('joi');

// Joi schemas for conversation validation
const conversationSchemas = {
    createOrGetConversation: Joi.object({
        driverId: Joi.string().optional(), // Required for admin, optional for driver
        subject: Joi.string().max(200).optional(),
        type: Joi.string().valid('general', 'emergency', 'document', 'delivery', 'earnings').default('general')
    }),
    assignConversation: Joi.object({
        adminId: Joi.string().optional() // null to unassign
    }),
    updateConversationStatus: Joi.object({
        status: Joi.string().valid('active', 'resolved', 'archived', 'waiting').required(),
        resolution: Joi.string().optional()
    }),
    getAdminConversations: Joi.object({
        status: Joi.string().valid('active', 'waiting', 'resolved', 'archived', 'all').default('active'),
        priority: Joi.string().valid('low', 'normal', 'high', 'urgent').optional(),
        assigned: Joi.string().valid('me', 'unassigned', 'all').optional(),
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(100).default(20)
    }),
    getDriverConversations: Joi.object({
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(100).default(10)
    }),
    getConversationDetails: Joi.object({
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(100).default(50)
    })
};

// Driver and Admin can create/get conversations
router.post('/create-or-get', authenticateToken, validate(conversationSchemas.createOrGetConversation), ConversationController.createOrGetConversation);

// Admin routes
router.get('/admin', authenticateToken, adminOnly, validate(conversationSchemas.getAdminConversations), ConversationController.getAdminConversations);
router.get('/admin/stats', authenticateToken, adminOnly, ConversationController.getConversationStats);
router.put('/:conversationId/assign', authenticateToken, adminOnly, validate(conversationSchemas.assignConversation), ConversationController.assignConversation);
router.put('/:conversationId/status', authenticateToken, adminOnly, validate(conversationSchemas.updateConversationStatus), ConversationController.updateConversationStatus);

// Driver routes
router.get('/driver', authenticateToken, driverOnly, validate(conversationSchemas.getDriverConversations), ConversationController.getDriverConversations);

// Shared routes
router.get('/:conversationId', authenticateToken, validate(conversationSchemas.getConversationDetails), ConversationController.getConversationDetails);
router.put('/:conversationId/read', authenticateToken, ConversationController.markConversationAsRead);

module.exports = router;
