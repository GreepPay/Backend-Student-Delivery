const Joi = require('joi');

// Validation middleware
const validate = (schema) => {
    return (req, res, next) => {
        const { error } = schema.validate(req.body, {
            context: {
                userType: req.user?.userType
            }
        });
        if (error) {
            return res.status(400).json({
                success: false,
                error: error.details[0].message
            });
        }
        next();
    };
};

const validateBody = (schema) => {
    return (req, res, next) => {
        const { error } = schema.validate(req.body, {
            context: {
                userType: req.user?.userType
            }
        });
        if (error) {
            return res.status(400).json({
                success: false,
                error: error.details[0].message
            });
        }
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
        fullName: Joi.string().min(2).max(50).required(),
        phone: Joi.string().pattern(/^[\+]?[1-9][\d]{0,15}$/).allow('').messages({
            'string.pattern.base': 'Please enter a valid phone number'
        }),
        studentId: Joi.string().min(4).max(20).allow(''),
        area: Joi.string().valid(
            'Kaymakli',
            'Hamitköy',
            'Yenişehir',
            'Kumsal',
            'Gönyeli',
            'Dereboyu',
            'Ortaköy',
            'Yenikent',
            'Taskinkoy',
            'Metehan',
            'nkoy',
            'Haspolat',
            'Alaykoy',
            'Marmara',
            'Terminal/City Center'
        ).default('Terminal/City Center'),
        university: Joi.string().valid(
            'Eastern Mediterranean University (EMU)',
            'Near East University (NEU)',
            'Cyprus International University (CIU)',
            'Girne American University (GAU)',
            'University of Kyrenia (UoK)',
            'European University of Lefke (EUL)',
            'Middle East Technical University (METU) – Northern Cyprus Campus',
            'Final International University (FIU)',
            'Bahçeşehir Cyprus University (BAU)',
            'University of Mediterranean Karpasia (UMK)',
            'Cyprus Health and Social Science University',
            'Arkin University of Creative Arts & Design',
            'Cyprus West University'
        ).default('Eastern Mediterranean University (EMU)'),
        transportationType: Joi.string().valid('bicycle', 'motorcycle', 'scooter', 'car', 'walking', 'other').default('other'),
        address: Joi.string().valid(
            'Kaymakli',
            'Hamitköy',
            'Yenişehir',
            'Kumsal',
            'Gönyeli',
            'Dereboyu',
            'Ortaköy',
            'Yenikent',
            'Taskinkoy',
            'Metehan',
            'Gocmenkoy',
            'Haspolat',
            'Alaykoy',
            'Marmara',
            'Terminal/City Center'
        ).default('Terminal/City Center').messages({
            'any.only': 'Please select a valid service area'
        })
    }),

    updateDriver: Joi.object({
        email: Joi.string().email(),
        fullName: Joi.string().min(2).max(50),
        phone: Joi.string().pattern(/^[\+]?[1-9][\d]{0,15}$/).allow(''),
        studentId: Joi.string().min(4).max(20).allow(''),
        area: Joi.string().valid(
            'Kaymakli',
            'Hamitköy',
            'Yenişehir',
            'Kumsal',
            'Gönyeli',
            'Dereboyu',
            'Ortaköy',
            'Yenikent',
            'Taskinkoy',
            'Metehan',
            'Gocmenkoy',
            'Haspolat',
            'Alaykoy',
            'Marmara',
            'Terminal/City Center'
        ),
        university: Joi.string().valid(
            'Eastern Mediterranean University (EMU)',
            'Near East University (NEU)',
            'Cyprus International University (CIU)',
            'Girne American University (GAU)',
            'University of Kyrenia (UoK)',
            'European University of Lefke (EUL)',
            'Middle East Technical University (METU) – Northern Cyprus Campus',
            'Final International University (FIU)',
            'Bahçeşehir Cyprus University (BAU)',
            'University of Mediterranean Karpasia (UMK)',
            'Cyprus Health and Social Science University',
            'Arkin University of Creative Arts & Design',
            'Cyprus West University'
        ),
        transportationType: Joi.string().valid('bicycle', 'motorcycle', 'scooter', 'car', 'walking', 'other'),
        address: Joi.string().valid(
            'Kaymakli',
            'Hamitköy',
            'Yenişehir',
            'Kumsal',
            'Gönyeli',
            'Dereboyu',
            'Ortaköy',
            'Yenikent',
            'Taskinkoy',
            'Metehan',
            'Gocmenkoy',
            'Haspolat',
            'Alaykoy',
            'Marmara',
            'Terminal/City Center'
        ).default('Terminal/City Center').messages({
            'any.only': 'Please select a valid service area'
        }),
        isActive: Joi.boolean()
    }),

    updateDriverProfile: Joi.object({
        fullName: Joi.string().min(2).max(50),
        phone: Joi.string().pattern(/^[\+]?[1-9][\d]{0,15}$/).allow(''),
        area: Joi.string().valid(
            'Kaymakli',
            'Hamitköy',
            'Yenişehir',
            'Kumsal',
            'Gönyeli',
            'Dereboyu',
            'Ortaköy',
            'Yenikent',
            'Taskinkoy',
            'Metehan',
            'Gocmenkoy',
            'Haspolat',
            'Alaykoy',
            'Marmara',
            'Terminal/City Center'
        ),
        transportationType: Joi.string().valid('bicycle', 'motorcycle', 'scooter', 'car', 'walking', 'other'),
        transportationMethod: Joi.string().valid('bicycle', 'motorcycle', 'scooter', 'car', 'walking', 'other'),
        university: Joi.string().valid(
            'Eastern Mediterranean University (EMU)',
            'Near East University (NEU)',
            'Cyprus International University (CIU)',
            'Girne American University (GAU)',
            'University of Kyrenia (UoK)',
            'European University of Lefke (EUL)',
            'Middle East Technical University (METU) – Northern Cyprus Campus',
            'Final International University (FIU)',
            'Bahçeşehir Cyprus University (BAU)',
            'University of Mediterranean Karpasia (UMK)',
            'Cyprus Health and Social Science University',
            'Arkin University of Creative Arts & Design',
            'Cyprus West University'
        ),
        studentId: Joi.string().min(4).max(20),
        address: Joi.string().valid(
            'Kaymakli',
            'Hamitköy',
            'Yenişehir',
            'Kumsal',
            'Gönyeli',
            'Dereboyu',
            'Ortaköy',
            'Yenikent',
            'Taskinkoy',
            'Metehan',
            'Gocmenkoy',
            'Haspolat',
            'Alaykoy',
            'Marmara',
            'Terminal/City Center'
        ).default('Terminal/City Center').messages({
            'any.only': 'Please select a valid service area'
        }),
        isActive: Joi.boolean(),
        isOnline: Joi.boolean()
    }),

    updateDriverStatus: Joi.object({
        isActive: Joi.boolean(),
        isOnline: Joi.boolean(),
        status: Joi.string().valid('active', 'offline', 'inactive')
    }),

    updateDriverVerification: Joi.object({
        isEmailVerified: Joi.boolean(),
        isPhoneVerified: Joi.boolean(),
        isDocumentVerified: Joi.boolean()
    }),

    updateAdminProfile: Joi.object({
        name: Joi.string().min(2).max(50),
        phone: Joi.string().pattern(/^[\+]?[1-9][\d]{0,15}$/).allow('')
    }),

    // Delivery schemas (removed duplicate - using the one below)

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
        status: Joi.string().valid('picked_up', 'in_transit', 'delivered', 'cancelled', 'failed').required(),
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
        area: Joi.string().valid(
            'Kaymakli',
            'Hamitköy',
            'Yenişehir',
            'Kumsal',
            'Gönyeli',
            'Dereboyu',
            'Ortaköy',
            'Yenikent',
            'Taskinkoy',
            'Metehan',
            'Gocmenkoy',
            'Haspolat',
            'Alaykoy',
            'Marmara',
            'Terminal/City Center'
        ),
        priority: Joi.string().valid('low', 'normal', 'high', 'urgent'),
        paymentMethod: Joi.string().valid('cash', 'pos', 'naira_transfer', 'isbank_transfer', 'crypto_transfer')
    }),

    deliveryQuery: Joi.object({
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(100).default(20),
        status: Joi.string().valid('pending', 'assigned', 'picked_up', 'delivered', 'cancelled'),
        assignedTo: Joi.string().pattern(/^[0-9a-fA-F]{24}$/),
        startDate: Joi.date(),
        endDate: Joi.date().min(Joi.ref('startDate')),
        area: Joi.string().valid(
            'Kaymakli',
            'Hamitköy',
            'Yenişehir',
            'Kumsal',
            'Gönyeli',
            'Dereboyu',
            'Ortaköy',
            'Yenikent',
            'Taskinkoy',
            'Metehan',
            'Gocmenkoy',
            'Haspolat',
            'Alaykoy',
            'Marmara',
            'Terminal/City Center'
        ),
        priority: Joi.string().valid('low', 'normal', 'high', 'urgent'),
        paymentMethod: Joi.string().valid('cash', 'pos', 'naira_transfer', 'isbank_transfer', 'crypto_transfer')
    }),

    driverFilters: Joi.object({
        area: Joi.string().valid(
            'Kaymakli',
            'Hamitköy',
            'Yenişehir',
            'Kumsal',
            'Gönyeli',
            'Dereboyu',
            'Ortaköy',
            'Yenikent',
            'Taskinkoy',
            'Metehan',
            'Gocmenkoy',
            'Haspolat',
            'Alaykoy',
            'Marmara',
            'Terminal/City Center'
        ),
        isActive: Joi.boolean(),
        sortBy: Joi.string().valid('name', 'totalDeliveries', 'totalEarnings', 'joinedAt').default('name'),
        sortOrder: Joi.string().valid('asc', 'desc').default('asc')
    }),

    analyticsQuery: Joi.object({
        period: Joi.string().valid(
            'today',
            'week',
            'thisWeek',      // Added for frontend compatibility
            'thisMonth',     // Added for frontend compatibility
            'thisYear',      // Added for frontend compatibility
            'month',
            'monthly',       // Added for frontend compatibility
            'currentPeriod', // Added for frontend compatibility
            'year',
            'all-time',
            'allTime',       // Added for frontend compatibility  
            'custom'
        ).default('month'),
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
    }),

    // Remittance schemas
    remittanceQuery: Joi.object({
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(100).default(10),
        status: Joi.string().valid('pending', 'completed', 'cancelled', 'overdue').optional(),
        driverId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).optional(),
        startDate: Joi.date().iso().optional(),
        endDate: Joi.date().iso().optional()
    }),

    createRemittance: Joi.object({
        driverId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
        startDate: Joi.date().iso().required(),
        endDate: Joi.date().iso().required(),
        dueDateDays: Joi.number().integer().min(1).max(30).default(7)
    }),

    completeRemittance: Joi.object({
        amount: Joi.number().min(0).required(),
        paymentDate: Joi.date().iso().optional(),
        reference: Joi.string().optional(),
        notes: Joi.string().optional()
    }),

    cancelRemittance: Joi.object({
        reason: Joi.string().min(1).max(500).required()
    }),

    remittanceId: Joi.object({
        remittanceId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required()
    }),

    driverId: Joi.object({
        driverId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required()
    }),

    calculateRemittance: Joi.object({
        startDate: Joi.date().iso().required(),
        endDate: Joi.date().iso().required()
    }),

    calculateBalancedRemittance: Joi.object({
        startDate: Joi.date().iso().required(),
        endDate: Joi.date().iso().required()
    }),

    generateBalancedRemittance: Joi.object({
        driverId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
        startDate: Joi.date().iso().required(),
        endDate: Joi.date().iso().required(),
        dueDateDays: Joi.number().integer().min(1).max(30).default(7),
        // Allow additional fields from frontend (optional)
        remittanceType: Joi.string().optional(),
        amount: Joi.number().optional(),
        cashRemittanceOwed: Joi.number().optional(),
        nonCashEarningsOwed: Joi.number().optional(),
        netRemittanceAmount: Joi.number().optional(),
        breakdown: Joi.object().optional()
    }).unknown(true), // Allow unknown fields

    dueSoonQuery: Joi.object({
        daysAhead: Joi.number().integer().min(1).max(30).default(3)
    }),

    bulkGenerateRemittances: Joi.object({
        startDate: Joi.date().iso().required(),
        endDate: Joi.date().iso().required(),
        dueDateDays: Joi.number().integer().min(1).max(30).default(7)
    }),

    // Admin management schemas
    adminQuery: Joi.object({
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(100).default(10),
        role: Joi.string().valid('admin', 'super_admin').optional(),
        isActive: Joi.boolean().optional(),
        search: Joi.string().min(1).max(100).optional()
    }),

    createAdmin: Joi.object({
        email: Joi.string().email().required().messages({
            'string.email': 'Please enter a valid email address',
            'any.required': 'Email is required'
        }),
        name: Joi.string().min(2).max(50).required().messages({
            'string.min': 'Name must be at least 2 characters long',
            'string.max': 'Name cannot exceed 50 characters',
            'any.required': 'Name is required'
        }),
        role: Joi.string().valid('admin', 'super_admin').default('admin'),
        permissions: Joi.array().items(
            Joi.string().valid('create_delivery', 'edit_delivery', 'delete_delivery', 'manage_drivers', 'view_analytics', 'manage_remittances', 'manage_admins', 'manage_system_settings')
        ).optional(),
        sendInvitation: Joi.boolean().default(true)
    }),

    updateAdmin: Joi.object({
        name: Joi.string().min(2).max(50).optional(),
        role: Joi.string().valid('admin', 'super_admin').optional(),
        permissions: Joi.array().items(
            Joi.string().valid('create_delivery', 'edit_delivery', 'delete_delivery', 'manage_drivers', 'view_analytics', 'manage_remittances', 'manage_admins', 'manage_system_settings')
        ).optional(),
        isActive: Joi.boolean().optional()
    }),

    adminId: Joi.object({
        id: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required()
    }),

    // System settings schemas
    updateSystemSettings: Joi.object({
        settings: Joi.object({
            notifications: Joi.object({
                email: Joi.boolean(),
                push: Joi.boolean(),
                sms: Joi.boolean(),
                deliveryUpdates: Joi.boolean(),
                driverAssignments: Joi.boolean(),
                systemAlerts: Joi.boolean(),
                soundEnabled: Joi.boolean()
            }).optional(),
            display: Joi.object({
                language: Joi.string().valid('en', 'tr', 'es', 'fr'),
                timezone: Joi.string(),
                currency: Joi.string().valid('TRY', 'USD', 'EUR', 'GBP')
            }).optional(),
            security: Joi.object({
                twoFactor: Joi.boolean(),
                sessionTimeout: Joi.number().min(5).max(1440),
                loginNotifications: Joi.boolean()
            }).optional(),
            delivery: Joi.object({
                autoAssignDrivers: Joi.boolean(),
                requireDriverConfirmation: Joi.boolean(),
                maxDeliveryDistance: Joi.number().min(1).max(1000),
                maxDeliveryTime: Joi.number().min(5).max(480)
            }).optional(),
            earnings: Joi.object({
                commissionRate: Joi.number().min(0).max(100),
                minimumPayout: Joi.number().min(0),
                payoutSchedule: Joi.string().valid('daily', 'weekly', 'monthly')
            }).optional(),
            system: Joi.object({
                maintenanceMode: Joi.boolean(),
                allowNewRegistrations: Joi.boolean(),
                maxActiveDeliveries: Joi.number().min(1).max(20),
                driverRatingEnabled: Joi.boolean()
            }).optional()
        }).required()
    }),

    updateCurrency: Joi.object({
        currency: Joi.string().valid('TRY', 'USD', 'EUR', 'GBP').required()
    }),

    // Earnings configuration schemas
    createEarningsConfiguration: Joi.object({
        name: Joi.string().min(3).max(100).required(),
        rules: Joi.array().items(
            Joi.object({
                minFee: Joi.number().min(0).required(),
                maxFee: Joi.number().min(0).required(),
                driverPercentage: Joi.number().min(0).max(100).allow(null),
                driverFixed: Joi.number().min(0).allow(null),
                companyPercentage: Joi.number().min(0).max(100).allow(null),
                companyFixed: Joi.number().min(0).allow(null),
                description: Joi.string().max(200).optional()
            })
        ).min(1).required(),
        notes: Joi.string().max(500).optional()
    }),

    updateEarningsConfiguration: Joi.object({
        name: Joi.string().min(3).max(100).optional(),
        rules: Joi.array().items(
            Joi.object({
                minFee: Joi.number().min(0).required(),
                maxFee: Joi.number().min(0).required(),
                driverPercentage: Joi.number().min(0).max(100).allow(null),
                driverFixed: Joi.number().min(0).allow(null),
                companyPercentage: Joi.number().min(0).max(100).allow(null),
                companyFixed: Joi.number().min(0).allow(null),
                description: Joi.string().max(200).optional()
            })
        ).min(1).optional(),
        notes: Joi.string().max(500).optional(),
        isActive: Joi.boolean().optional()
    }),

    earningsConfigId: Joi.object({
        id: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required()
    }),

    // Password reset schema
    resetAdminPassword: Joi.object({
        sendEmail: Joi.boolean().default(true)
    }),

    // Delivery broadcast schemas
    createDelivery: Joi.object({
        pickupLocation: Joi.string().min(5).max(200).required().messages({
            'string.min': 'Pickup location must be at least 5 characters',
            'string.max': 'Pickup location cannot exceed 200 characters',
            'any.required': 'Pickup location is required'
        }),
        deliveryLocation: Joi.string().min(5).max(200).required().messages({
            'string.min': 'Delivery location must be at least 5 characters',
            'string.max': 'Delivery location cannot exceed 200 characters',
            'any.required': 'Delivery location is required'
        }),
        customerName: Joi.string().max(50).allow(''),
        customerPhone: Joi.string().pattern(/^[\+]?[1-9][\d]{0,15}$/).allow(''),
        fee: Joi.number().min(1).max(10000).required().messages({
            'number.min': 'Fee must be greater than 0',
            'number.max': 'Fee cannot exceed 10,000₺',
            'any.required': 'Delivery fee is required'
        }),
        paymentMethod: Joi.string().valid('cash', 'pos', 'naira_transfer', 'isbank_transfer', 'crypto_transfer').default('cash'),
        estimatedTime: Joi.date().min('now').required().messages({
            'date.min': 'Estimated time cannot be in the past',
            'any.required': 'Estimated delivery time is required'
        }),
        notes: Joi.string().max(500).allow(''),
        priority: Joi.string().valid('low', 'normal', 'high', 'urgent').default('normal'),
        distance: Joi.number().min(0).max(1000),
        assignedTo: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).allow(null, '').optional(), // MongoDB ObjectId for manual assignment
        pickupLocationLink: Joi.string().uri().optional().messages({
            'string.uri': 'Pickup location must be a valid Google Maps link'
        }),
        deliveryLocationLink: Joi.string().uri().optional().messages({
            'string.uri': 'Delivery location must be a valid Google Maps link'
        }),
        pickupLocationDescription: Joi.string().max(500).optional().messages({
            'string.max': 'Pickup location description cannot exceed 500 characters'
        }),
        deliveryLocationDescription: Joi.string().max(500).optional().messages({
            'string.max': 'Delivery location description cannot exceed 500 characters'
        }),
        pickupCoordinates: Joi.object({
            lat: Joi.number().min(-90).max(90),
            lng: Joi.number().min(-180).max(180)
        }).optional(),
        deliveryCoordinates: Joi.object({
            lat: Joi.number().min(-90).max(90),
            lng: Joi.number().min(-180).max(180)
        }).optional(),
        useAutoBroadcast: Joi.boolean().default(true),
        broadcastRadius: Joi.when('useAutoBroadcast', {
            is: true,
            then: Joi.number().min(1).max(50).default(5).required(),
            otherwise: Joi.optional()
        }),
        broadcastDuration: Joi.when('useAutoBroadcast', {
            is: true,
            then: Joi.number().min(10).max(300).default(60).required(),
            otherwise: Joi.optional()
        })
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
        pickupCoordinates: Joi.object({
            lat: Joi.number().min(-90).max(90),
            lng: Joi.number().min(-180).max(180)
        }),
        deliveryCoordinates: Joi.object({
            lat: Joi.number().min(-90).max(90),
            lng: Joi.number().min(-180).max(180)
        })
    }),

    deliveryQuery: Joi.object({
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(100).default(10),
        status: Joi.string().valid('pending', 'broadcasting', 'accepted', 'picked_up', 'in_transit', 'delivered', 'cancelled', 'failed'),
        broadcastStatus: Joi.string().valid('not_started', 'broadcasting', 'accepted', 'expired', 'manual_assignment'),
        priority: Joi.string().valid('low', 'normal', 'high', 'urgent')
    }),

    deliveryId: Joi.object({
        id: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required()
    }),

    manualAssignment: Joi.object({
        driverId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required()
    }),

    updateDeliveryStatus: Joi.object({
        status: Joi.string().valid('picked_up', 'in_transit', 'delivered', 'cancelled', 'failed').required(),
        notes: Joi.string().max(500).allow(''),
        deliveryProof: Joi.string().uri().allow(''), // URL to proof image
        rating: Joi.number().min(1).max(5),
        feedback: Joi.string().max(1000).allow('')
    }),

    broadcastQuery: Joi.object({
        lat: Joi.number().min(-90).max(90),
        lng: Joi.number().min(-180).max(180)
    }),

    driverDeliveryQuery: Joi.object({
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(100).default(10),
        status: Joi.string().valid('pending', 'broadcasting', 'accepted', 'picked_up', 'in_transit', 'delivered', 'cancelled', 'failed')
    }),

    // Notification schemas
    sendMessage: Joi.object({
        driverId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).optional(),
        adminId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).optional(),
        message: Joi.string().min(1).max(1000).required().messages({
            'string.min': 'Message cannot be empty',
            'string.max': 'Message cannot exceed 1000 characters',
            'any.required': 'Message is required'
        })
    }).custom((value, helpers) => {
        // For driver-to-admin messages, we don't need to specify adminId
        // The system will automatically route to all admins
        // For admin-to-driver messages, driverId is required
        if (value.driverId && value.adminId) {
            return helpers.error('Cannot provide both driverId and adminId');
        }
        return value;
    }),

    emergencyAlert: Joi.object({
        message: Joi.string().min(1).max(500).required().messages({
            'string.min': 'Emergency message cannot be empty',
            'string.max': 'Emergency message cannot exceed 500 characters',
            'any.required': 'Emergency message is required'
        }),
        location: Joi.object({
            lat: Joi.number().min(-90).max(90),
            lng: Joi.number().min(-180).max(180)
        }).optional()
    }),

    systemNotification: Joi.object({
        recipients: Joi.array().items(Joi.object({
            _id: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
            userType: Joi.string().valid('admin', 'driver').required()
        })).min(1).required(),
        type: Joi.string().required(),
        title: Joi.string().required(),
        message: Joi.string().required(),
        data: Joi.object().optional()
    }),

    // Referral schemas
    validateReferralCode: Joi.object({
        referralCode: Joi.string()
            .pattern(/^GRP-SDS\d{3}-[A-Z]{2}$/)
            .required()
            .messages({
                'string.pattern.base': 'Referral code must be in format GRP-SDS001-XX',
                'any.required': 'Referral code is required'
            })
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
    validateBody,
    validateBatchOperation,
    schemas,
    paramSchemas,
    sanitizeInput,
    validateFileUpload,
    customValidators
};