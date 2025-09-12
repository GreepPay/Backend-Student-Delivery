const express = require('express');
const AuthController = require('../controllers/authController');
const { authenticateToken, superAdminOnly } = require('../middleware/auth');
const { validate, schemas, sanitizeInput } = require('../middleware/validation');

const router = express.Router();

// Apply input sanitization to all routes
router.use(sanitizeInput);

// Public routes (no authentication required)
router.post('/send-otp',
    validate(schemas.sendOTP),
    AuthController.sendOTP
);

router.post('/verify-otp',
    validate(schemas.verifyOTP),
    AuthController.verifyOTP
);

router.post('/resend-otp',
    validate(schemas.sendOTP),
    AuthController.resendOTP
);

router.get('/can-request-otp',
    AuthController.canRequestOTP
);

// Protected routes (authentication required)
router.use(authenticateToken);

router.post('/logout', AuthController.logout);

router.post('/refresh-token', AuthController.refreshToken);

router.get('/profile', AuthController.getProfile);

router.get('/profile/:userId',
    (req, res, next) => {
        // Add admin-only middleware for this route
        if (req.user.userType !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Admin access required'
            });
        }
        next();
    },
    AuthController.getProfileById
);

router.put('/profile',
    (req, res, next) => {
        // Use appropriate schema based on user type
        const schema = req.user?.userType === 'admin' ? schemas.updateAdminProfile : schemas.updateDriverProfile;
        const { error } = schema.validate(req.body, { abortEarly: false });

        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message
            }));

            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: errors
            });
        }
        next();
    },
    AuthController.updateProfile
);

// Admin route to update specific user profile
router.put('/profile/:userId',
    (req, res, next) => {
        // Admin-only middleware for this route
        if (req.user.userType !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Admin access required'
            });
        }

        // Use appropriate schema based on user type
        const schema = req.user?.userType === 'admin' ? schemas.updateAdminProfile : schemas.updateDriverProfile;
        const { error } = schema.validate(req.body, { abortEarly: false });

        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message
            }));

            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: errors
            });
        }
        next();
    },
    AuthController.updateProfileById
);

router.post('/change-password', AuthController.changePassword);

router.get('/validate-session', AuthController.validateSession);

router.get('/verify-token', AuthController.verifyToken);

// Super admin only routes
router.get('/stats',
    superAdminOnly,
    AuthController.getAuthStats
);

router.post('/cleanup-otps',
    superAdminOnly,
    AuthController.cleanupOTPs
);

module.exports = router;