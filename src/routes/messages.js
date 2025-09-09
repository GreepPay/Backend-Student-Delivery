const express = require('express');
const router = express.Router();
const MessageController = require('../controllers/messageController');
const { authenticateToken } = require('../middleware/auth');
const { validate, validateQuery, validateParams } = require('../middleware/validation');
const { uploadSingleImage, handleUploadError } = require('../middleware/upload');
const Joi = require('joi');

// Validation schemas
const messageSchemas = {
    sendMessage: Joi.object({
        message: Joi.string().trim().max(1000).allow(''),
        type: Joi.string().valid('general', 'emergency', 'document', 'delivery', 'earnings').default('general'),
        imageUrl: Joi.string().uri().allow('', null).optional(),
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
    }).custom((value, helpers) => {
        // Custom validation: either message or imageUrl must be provided
        if ((!value.message || value.message.trim() === '') && !value.imageUrl) {
            return helpers.error('custom.messageOrImageRequired');
        }
        return value;
    }).messages({
        'custom.messageOrImageRequired': 'Either message content or image is required'
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

// Upload message image
router.post('/upload-image',
    authenticateToken,
    (req, res, next) => {
        // Use upload middleware with custom field name
        const upload = require('multer')({
            storage: require('multer').memoryStorage(),
            fileFilter: (req, file, cb) => {
                const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
                if (allowedTypes.includes(file.mimetype)) {
                    cb(null, true);
                } else {
                    cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'), false);
                }
            },
            limits: {
                fileSize: 5 * 1024 * 1024, // 5MB limit
                files: 1
            }
        }).single('messageImage');

        upload(req, res, (err) => {
            if (err) {
                return handleUploadError(err, req, res, next);
            }
            next();
        });
    },
    MessageController.uploadMessageImage
);

// Delete message image
router.delete('/delete-image',
    authenticateToken,
    MessageController.deleteMessageImage
);

module.exports = router;

