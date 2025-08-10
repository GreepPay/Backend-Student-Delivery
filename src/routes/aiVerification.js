const express = require('express');
const Joi = require('joi');
const AIVerificationController = require('../controllers/aiVerificationController');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { validate, validateParams } = require('../middleware/validation');

const router = express.Router();

// Apply authentication to all AI verification routes
router.use(authenticateToken);

// Validation schemas for AI verification
const aiVerificationSchemas = {
    verifyDocument: Joi.object({
        documentType: Joi.string().valid('studentId', 'profilePhoto', 'universityEnrollment', 'identityCard', 'transportationLicense').required(),
        documentUrl: Joi.string().uri().required(),
        driverId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required()
    }),

    classifyDocument: Joi.object({
        documentUrl: Joi.string().uri().required(),
        expectedType: Joi.string().valid('studentId', 'profilePhoto', 'universityEnrollment', 'identityCard', 'transportationLicense').required()
    }),

    extractText: Joi.object({
        documentUrl: Joi.string().uri().required(),
        documentType: Joi.string().valid('studentId', 'profilePhoto', 'universityEnrollment', 'identityCard', 'transportationLicense').required()
    }),

    detectFace: Joi.object({
        documentUrl: Joi.string().uri().required(),
        documentType: Joi.string().valid('studentId', 'profilePhoto', 'universityEnrollment', 'identityCard', 'transportationLicense').required()
    }),

    verifyAuthenticity: Joi.object({
        documentUrl: Joi.string().uri().required(),
        documentType: Joi.string().valid('studentId', 'profilePhoto', 'universityEnrollment', 'identityCard', 'transportationLicense').required()
    }),

    detectFraud: Joi.object({
        documentUrl: Joi.string().uri().required(),
        documentType: Joi.string().valid('studentId', 'profilePhoto', 'universityEnrollment', 'identityCard', 'transportationLicense').required()
    }),

    verifyBatch: Joi.object({
        documents: Joi.array().items(
            Joi.object({
                documentId: Joi.string().required(),
                documentType: Joi.string().valid('studentId', 'profilePhoto', 'universityEnrollment', 'identityCard', 'transportationLicense').required(),
                documentUrl: Joi.string().uri().required(),
                driverId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required()
            })
        ).min(1).max(50).required() // Limit batch size to 50 documents
    })
};

// Parameter validation schemas
const paramSchemas = {
    verificationId: Joi.object({
        id: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required().messages({
            'string.pattern.base': 'Invalid verification ID format'
        })
    })
};

// 1. Complete verification pipeline
router.post('/documents/verify',
    requirePermission('ai_verification'),
    validate(aiVerificationSchemas.verifyDocument),
    AIVerificationController.verifyDocument
);

// 2. Document classification
router.post('/documents/classify',
    requirePermission('ai_verification'),
    validate(aiVerificationSchemas.classifyDocument),
    AIVerificationController.classifyDocument
);

// 3. OCR text extraction
router.post('/documents/extract-text',
    requirePermission('ai_verification'),
    validate(aiVerificationSchemas.extractText),
    AIVerificationController.extractText
);

// 4. Face detection
router.post('/documents/detect-face',
    requirePermission('ai_verification'),
    validate(aiVerificationSchemas.detectFace),
    AIVerificationController.detectFace
);

// 5. Authenticity verification
router.post('/documents/verify-authenticity',
    requirePermission('ai_verification'),
    validate(aiVerificationSchemas.verifyAuthenticity),
    AIVerificationController.verifyAuthenticity
);

// 6. Fraud detection
router.post('/documents/detect-fraud',
    requirePermission('ai_verification'),
    validate(aiVerificationSchemas.detectFraud),
    AIVerificationController.detectFraud
);

// 7. Status checking
router.get('/documents/status/:id',
    requirePermission('ai_verification'),
    validateParams(paramSchemas.verificationId),
    AIVerificationController.getVerificationStatus
);

// 8. Batch verification
router.post('/documents/verify-batch',
    requirePermission('ai_verification'),
    validate(aiVerificationSchemas.verifyBatch),
    AIVerificationController.verifyBatch
);

// Health check endpoint for AI verification service
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'AI Verification Service is running',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        endpoints: {
            verifyDocument: 'POST /api/ai/documents/verify',
            classifyDocument: 'POST /api/ai/documents/classify',
            extractText: 'POST /api/ai/documents/extract-text',
            detectFace: 'POST /api/ai/documents/detect-face',
            verifyAuthenticity: 'POST /api/ai/documents/verify-authenticity',
            detectFraud: 'POST /api/ai/documents/detect-fraud',
            getStatus: 'GET /api/ai/documents/status/:id',
            verifyBatch: 'POST /api/ai/documents/verify-batch'
        }
    });
});

module.exports = router;
