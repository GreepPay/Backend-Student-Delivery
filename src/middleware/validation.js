const Joi = require('joi');

// Validation middleware factory
const validate = (schema) => {
    return (req, res, next) => {
        console.log('Validation middleware called with schema:', schema);
        console.log('Request body:', req.body);

        const { error } = schema.validate(req.body, { abortEarly: false });

        if (error) {
            console.log('Validation error:', error.details);
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message
            }));

            return res.status(400).json({
                success: false,
                error: 'Parameter validation failed',
                details: errors
            });
        }

        console.log('Validation passed');
        next();
    };
};

// Validation schemas
const schemas = {
    // Authentication schemas
    sendOTP: Joi.object({
        email: Joi.string().email().required().messages({
            'string.email': 'Please enter a valid email address',
            'any.required': 'Email is required'
        }),
        userType: Joi.string().valid('admin', 'driver').required().messages({
            'any.only': 'User type must be either admin or driver',
            'any.required': 'User type is required'
        })
    }),

    verifyOTP: Joi.object({
        email: Joi.string().email().required(),
        otp: Joi.string().length(6).pattern(/^\d+$/).required().messages({
            'string.length': 'OTP must be 6 digits',
            'string.pattern.base': 'OTP must contain only numbers',
            'any.required': 'OTP is required'
        }),
        userType: Joi.string().valid('admin', 'driver').required()
    }),

    // Admin schemas
    createAdmin: Joi.object({
        email: Joi.string().email().required(),
        name: Joi.string().min(2).max(50).required().messages({
            'string.min': 'Name must be at least 2 characters long',
            'string.max': 'Name cannot exceed 50 characters'
        }),
        role: Joi.string().valid('admin', 'super_admin').default('admin')
    }),

    updateAdmin: Joi.object({
        name: Joi.string().min(2).max(50),
        isActive: Joi.boolean(),
        permissions: Joi.array().items(
            Joi.string().valid('create_delivery', 'edit_delivery', 'delete_delivery', 'manage_drivers', 'view_analytics')
        )
    }),

    // Driver schemas
    createDriver: Joi.object({
        email: Joi.string().email().required(),
        name: Joi.string().min(2).max(50).required(),
        phone: Joi.string().pattern(/^[\+]?[1-9][\d]{0,15}$/).allow('').messages({
            'string.pattern.base': 'Please enter a valid phone number'
        }),
        studentId: Joi.string().max(20).allow(''),
        area: Joi.string().valid('Gonyeli', 'Kucuk', 'Lefkosa', 'Famagusta', 'Kyrenia', 'Other').default('Other')
    }),

    updateDriver: Joi.object({
        email: Joi.string().email(),
        name: Joi.string().min(2).max(50),
        phone: Joi.string().pattern(/^[\+]?[1-9][\d]{0,15}$/).allow(''),
        studentId: Joi.string().max(20).allow(''),
        area: Joi.string().valid('Gonyeli', 'Kucuk', 'Lefkosa', 'Famagusta', 'Kyrenia', 'Other'),
        isActive: Joi.boolean()
    }),

    updateDriverProfile: Joi.object({
        name: Joi.string().min(2).max(50),
        phone: Joi.string().pattern(/^[\+]?[1-9][\d]{0,15}$/).allow('')
    }),

    updateAdminProfile: Joi.object({
        name: Joi.string().min(2).max(50),
        phone: Joi.string().pattern(/^[\+]?[1-9][\d]{0,15}$/).allow('')
    }),

    // Delivery schemas
    createDelivery: Joi.object({
        pickupLocation: Joi.string().min(5).max(200).required().messages({
            'string.min': 'Pickup location must be at least 5 characters',
            'string.max': 'Pickup location cannot exceed 200 characters'
        }),
        deliveryLocation: Joi.string().min(5).max(200).required().messages({
            'string.min': 'Delivery location must be at least 5 characters',
            'string.max': 'Delivery location cannot exceed 200 characters'
        }),
        customerName: Joi.string().max(50).allow(''),
        customerPhone: Joi.string().pattern(/^[\+]?[1-9][\d]{0,15}$/).allow(''),
        fee: Joi.number().min(1).max(10000).default(150).messages({
            'number.min': 'Fee must be greater than 0',
            'number.max': 'Fee cannot exceed 10,000₺'
        }),
        paymentMethod: Joi.string().valid('cash', 'pos', 'naira_transfer', 'isbank_transfer', 'crypto_transfer').default('cash'),
        estimatedTime: Joi.date().min('now'),
        notes: Joi.string().max(500).allow(''),
        priority: Joi.string().valid('low', 'normal', 'high', 'urgent').default('normal'),
        distance: Joi.number().min(0).max(1000),
        assignedTo: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).allow(null) // MongoDB ObjectId
    }),

    updateDelivery: Joi.object({
        pickupLocation: Joi.string().min(5).max(200),
        deliveryLocation: Joi.string().min(5).max(200),
        customerName: Joi.string().max(50).allow(''),
        customerPhone: Joi.string().pattern(/^[\+]?[1-9][\d]{0,15}$/).allow(''),
        fee: Joi.number().min(1).max(10000),
        paymentMethod: Joi.string().valid('cash', 'pos', 'naira_transfer', 'isbank_transfer', 'crypto_transfer'),
        estimatedTime: Joi.date().min('now'),
        notes: Joi.string().max(500).allow(''),
        priority: Joi.string().valid('low', 'normal', 'high', 'urgent'),
        distance: Joi.number().min(0).max(1000),
        assignedTo: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).allow(null),
        status: Joi.string().valid('pending', 'assigned', 'picked_up', 'delivered', 'cancelled')
    }),

    updateDeliveryStatus: Joi.object({
        status: Joi.string().valid('picked_up', 'delivered', 'cancelled').required(),
        notes: Joi.string().max(500).allow(''),
        deliveryProof: Joi.string().uri().allow(''), // URL to proof image
        rating: Joi.number().min(1).max(5),
        feedback: Joi.string().max(1000).allow('')
    }),

    assignDelivery: Joi.object({
        driverId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required().messages({
            'string.pattern.base': 'Invalid driver ID format'
        }),
        notes: Joi.string().max(500).allow('')
    }),

    // Query parameter validation schemas
    pagination: Joi.object({
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(100).default(20)
    }),

    deliveryFilters: Joi.object({
        status: Joi.string().valid('pending', 'assigned', 'picked_up', 'delivered', 'cancelled'),
        assignedTo: Joi.string().pattern(/^[0-9a-fA-F]{24}$/),
        startDate: Joi.date(),
        endDate: Joi.date().min(Joi.ref('startDate')),
        area: Joi.string().valid('Gonyeli', 'Kucuk', 'Lefkosa', 'Famagusta', 'Kyrenia', 'Other'),
        priority: Joi.string().valid('low', 'normal', 'high', 'urgent'),
        paymentMethod: Joi.string().valid('cash', 'pos', 'naira_transfer', 'isbank_transfer', 'crypto_transfer')
    }),

    driverFilters: Joi.object({
        area: Joi.string().valid('Gonyeli', 'Kucuk', 'Lefkosa', 'Famagusta', 'Kyrenia', 'Other'),
        isActive: Joi.boolean(),
        sortBy: Joi.string().valid('name', 'totalDeliveries', 'totalEarnings', 'joinedAt').default('name'),
        sortOrder: Joi.string().valid('asc', 'desc').default('asc')
    }),

    analyticsQuery: Joi.object({
        period: Joi.string().valid('today', 'week', 'month', 'year', 'all-time', 'custom').default('month'),
        month: Joi.number().integer().min(1).max(12),
        year: Joi.number().integer().min(2020).max(2030),
        startDate: Joi.date(),
        endDate: Joi.date().min(Joi.ref('startDate'))
    }).with('month', 'year'), // If month is provided, year is required

    // Create system notification validation
    createSystemNotification: Joi.object({
        recipients: Joi.array().items(Joi.object({
            id: Joi.string().required(),
            type: Joi.string().valid('driver', 'admin').required()
        })).min(1).required(),
        title: Joi.string().min(1).max(100).required(),
        message: Joi.string().min(1).max(500).required(),
        priority: Joi.string().valid('low', 'medium', 'high', 'urgent').default('medium')
    }),

    // Earnings configuration validation
    createEarningsConfig: Joi.object({
        name: Joi.string().min(1).max(100).required(),
        rules: Joi.array().items(Joi.object({
            minFee: Joi.number().min(0).required(),
            maxFee: Joi.number().min(0).required(),
            driverPercentage: Joi.number().min(0).max(100).allow(null),
            driverFixed: Joi.number().min(0).allow(null),
            companyPercentage: Joi.number().min(0).max(100).allow(null),
            companyFixed: Joi.number().min(0).allow(null),
            description: Joi.string().max(200).allow('')
        })).min(1).required(),
        notes: Joi.string().max(500).allow('')
    }),

    updateEarningsConfig: Joi.object({
        name: Joi.string().min(1).max(100),
        rules: Joi.array().items(Joi.object({
            minFee: Joi.number().min(0).required(),
            maxFee: Joi.number().min(0).required(),
            driverPercentage: Joi.number().min(0).max(100).allow(null),
            driverFixed: Joi.number().min(0).allow(null),
            companyPercentage: Joi.number().min(0).max(100).allow(null),
            companyFixed: Joi.number().min(0).allow(null),
            description: Joi.string().max(200).allow('')
        })),
        notes: Joi.string().max(500).allow(''),
        isActive: Joi.boolean()
    }),

    testEarningsCalculation: Joi.object({
        fee: Joi.number().min(1).required()
    }),

    bulkUpdateEarnings: Joi.object({
        deliveryIds: Joi.array().items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/)).min(1).required(),
        configId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).allow(null)
    }),

    earningsStatsQuery: Joi.object({
        startDate: Joi.date(),
        endDate: Joi.date().min(Joi.ref('startDate')),
        driverId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/)
    })
};

// Query validation middleware
const validateQuery = (schema) => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.query, {
            abortEarly: false,
            allowUnknown: true,
            stripUnknown: true
        });

        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message
            }));

            return res.status(400).json({
                success: false,
                error: 'Query validation failed',
                details: errors
            });
        }

        // Replace query with validated and cleaned values
        req.query = { ...req.query, ...value };
        next();
    };
};

// Parameter validation middleware
const validateParams = (schema) => {
    return (req, res, next) => {
        const { error } = schema.validate(req.params, { abortEarly: false });

        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message
            }));

            return res.status(400).json({
                success: false,
                error: 'Parameter validation failed',
                details: errors
            });
        }

        next();
    };
};

// Common parameter schemas
const paramSchemas = {
    mongoId: Joi.object({
        id: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required().messages({
            'string.pattern.base': 'Invalid ID format'
        })
    }),

    driverId: Joi.object({
        driverId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required().messages({
            'string.pattern.base': 'Invalid driver ID format'
        })
    }),

    deliveryCode: Joi.object({
        deliveryCode: Joi.string().pattern(/^GRP-\d{6}$/).required().messages({
            'string.pattern.base': 'Invalid delivery code format (expected: GRP-123456)'
        })
    })
};

// Sanitize input middleware
const sanitizeInput = (req, res, next) => {
    // Remove any potential XSS patterns
    const sanitize = (obj) => {
        for (const key in obj) {
            if (typeof obj[key] === 'string') {
                // Basic XSS prevention
                obj[key] = obj[key]
                    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
                    .replace(/javascript:/gi, '')
                    .replace(/on\w+\s*=/gi, '');
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                sanitize(obj[key]);
            }
        }
    };

    if (req.body) sanitize(req.body);
    if (req.query) sanitize(req.query);
    if (req.params) sanitize(req.params);

    next();
};

// File upload validation (for delivery proof images)
const validateFileUpload = (req, res, next) => {
    if (!req.file) {
        return next();
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!allowedTypes.includes(req.file.mimetype)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid file type. Only JPEG, PNG, and JPG images are allowed.'
        });
    }

    if (req.file.size > maxSize) {
        return res.status(400).json({
            success: false,
            error: 'File too large. Maximum size is 5MB.'
        });
    }

    next();
};

// Batch operation validation
const validateBatchOperation = (req, res, next) => {
    const { ids, operation } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
            success: false,
            error: 'IDs array is required and cannot be empty'
        });
    }

    if (ids.length > 50) {
        return res.status(400).json({
            success: false,
            error: 'Cannot process more than 50 items at once'
        });
    }

    // Validate each ID format
    for (const id of ids) {
        if (!/^[0-9a-fA-F]{24}$/.test(id)) {
            return res.status(400).json({
                success: false,
                error: `Invalid ID format: ${id}`
            });
        }
    }

    const allowedOperations = ['delete', 'activate', 'deactivate', 'assign', 'cancel'];
    if (!allowedOperations.includes(operation)) {
        return res.status(400).json({
            success: false,
            error: `Invalid operation. Allowed operations: ${allowedOperations.join(', ')}`
        });
    }

    next();
};

// Custom validation helpers
const customValidators = {
    // Check if email domain is allowed (for student emails)
    studentEmail: (value, helpers) => {
        const allowedDomains = ['student.edu', 'university.edu']; // Add your allowed domains
        const domain = value.split('@')[1];

        if (!allowedDomains.includes(domain)) {
            return helpers.message('Email must be from an allowed educational domain');
        }

        return value;
    },

    // Validate Turkish phone number format
    turkishPhone: (value, helpers) => {
        const turkishPhoneRegex = /^(\+90|0)?[5][0-9]{9}$/;

        if (!turkishPhoneRegex.test(value.replace(/\s/g, ''))) {
            return helpers.message('Please enter a valid Turkish phone number');
        }

        return value;
    },

    // Validate delivery time is within business hours
    businessHours: (value, helpers) => {
        const hour = new Date(value).getHours();

        if (hour < 8 || hour > 22) {
            return helpers.message('Delivery time must be between 8:00 AM and 10:00 PM');
        }

        return value;
    }
};

// Export all validation functions
module.exports = {
    validate,
    validateQuery,
    validateParams,
    sanitizeInput,
    validateFileUpload,
    validateBatchOperation,
    schemas,
    paramSchemas,
    customValidators
};