const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const Driver = require('../models/Driver');

// Generate JWT token
const generateToken = (user, userType) => {
    return jwt.sign(
        {
            id: user._id,
            email: user.email,
            userType,
            name: user.name,
            ...(userType === 'admin' && { role: user.role, permissions: user.permissions }),
            ...(userType === 'driver' && { area: user.area })
        },
        process.env.JWT_SECRET,
        {
            expiresIn: process.env.JWT_EXPIRES_IN || '7d'
        }
    );
};

// Verify JWT token
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'Access token required'
            });
        }

        // For demo purposes, accept test token
        if (token === 'test-token-for-demo') {
            // Check if this is an admin endpoint by looking at the URL
            const isAdminEndpoint = req.originalUrl.includes('/admin/') ||
                req.originalUrl.includes('/remittance/') ||
                req.method === 'POST' && req.originalUrl.includes('/remittance/calculate/') ||
                req.method === 'POST' && req.originalUrl.includes('/delivery') ||
                req.method === 'PUT' && req.originalUrl.includes('/delivery') ||
                req.method === 'DELETE' && req.originalUrl.includes('/delivery');

            let mockUser;

            if (isAdminEndpoint) {
                // Create a mock admin user for admin endpoints
                mockUser = {
                    id: '688973b69cd2d8234f26bd39', // Admin ID for wisdom@greep.io
                    email: 'wisdom@greep.io',
                    userType: 'admin',
                    name: 'Super Admin',
                    role: 'super_admin',
                    permissions: ['all', 'create_delivery', 'edit_delivery', 'delete_delivery', 'manage_drivers', 'view_analytics', 'ai_verification']
                };
            } else {
                // Create a mock driver user for driver endpoints
                mockUser = {
                    id: '6890dc5a98ce5bc39c4e92b7', // Driver ID for wisdom agunta
                    email: 'aguntawisdom@gmail.com',
                    userType: 'driver',
                    name: 'wisdom agunta',
                    area: 'Famagusta'
                };
            }

            req.user = {
                ...mockUser,
                userData: mockUser
            };

            return next();
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Verify user still exists and is active
        let user;
        if (decoded.userType === 'admin') {
            user = await Admin.findById(decoded.id).select('-__v');
            if (!user || !user.isActive) {
                return res.status(401).json({
                    success: false,
                    error: 'Admin account not found or inactive'
                });
            }
        } else if (decoded.userType === 'driver') {
            user = await Driver.findById(decoded.id).select('-__v');
            if (!user) {
                return res.status(401).json({
                    success: false,
                    error: 'Driver account not found'
                });
            }
            if (user.isSuspended) {
                return res.status(401).json({
                    success: false,
                    error: `Account suspended: ${user.suspensionReason || 'No reason provided'}`
                });
            }
        } else {
            return res.status(401).json({
                success: false,
                error: 'Invalid user type'
            });
        }

        // Add user info to request
        req.user = {
            ...decoded,
            userData: user
        };

        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(403).json({
                success: false,
                error: 'Invalid token'
            });
        }

        if (error.name === 'TokenExpiredError') {
            return res.status(403).json({
                success: false,
                error: 'Token expired'
            });
        }

        console.error('Authentication error:', error.message);
        return res.status(500).json({
            success: false,
            error: 'Authentication failed'
        });
    }
};

// Admin-only middleware (allows both admin and super_admin roles)
const adminOnly = (req, res, next) => {
    if (req.user.userType !== 'admin') {
        return res.status(403).json({
            success: false,
            error: 'Admin access required',
            details: {
                userType: req.user.userType,
                role: req.user.role,
                allowedRoles: ['admin', 'super_admin']
            }
        });
    }
    next();
};

// Driver-only middleware
const driverOnly = (req, res, next) => {
    if (req.user.userType !== 'driver') {
        return res.status(403).json({
            success: false,
            error: 'Driver access required'
        });
    }
    next();
};

// Super admin only middleware
const superAdminOnly = (req, res, next) => {
    if (req.user.userType !== 'admin' || req.user.role !== 'super_admin') {
        return res.status(403).json({
            success: false,
            error: 'Super admin access required',
            details: {
                userType: req.user.userType,
                role: req.user.role,
                requiredRole: 'super_admin'
            }
        });
    }
    next();
};

// Admin or super admin middleware (for general admin access)
const adminOrSuperAdmin = (req, res, next) => {
    if (req.user.userType !== 'admin') {
        return res.status(403).json({
            success: false,
            error: 'Admin access required',
            details: {
                userType: req.user.userType,
                role: req.user.role,
                allowedRoles: ['admin', 'super_admin']
            }
        });
    }
    next();
};

// Permission-based middleware
const requirePermission = (permission) => {
    return (req, res, next) => {
        if (req.user.userType !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Admin access required'
            });
        }

        if (req.user.role === 'super_admin' || req.user.permissions.includes(permission)) {
            return next();
        }

        return res.status(403).json({
            success: false,
            error: `Permission required: ${permission}`
        });
    };
};

// Middleware to check if user can access specific driver data
const canAccessDriverData = (req, res, next) => {
    const requestedDriverId = req.params.driverId || req.params.id;

    // Admin can access any driver data
    if (req.user.userType === 'admin') {
        return next();
    }

    // Driver can only access their own data
    if (req.user.userType === 'driver' && req.user.id === requestedDriverId) {
        return next();
    }

    return res.status(403).json({
        success: false,
        error: 'Access denied'
    });
};

// Optional authentication (for public endpoints that can show more data if authenticated)
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            req.user = null;
            return next();
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        let user;
        if (decoded.userType === 'admin') {
            user = await Admin.findById(decoded.id).select('-__v');
        } else if (decoded.userType === 'driver') {
            user = await Driver.findById(decoded.id).select('-__v');
        }

        if (user && user.isActive) {
            req.user = {
                ...decoded,
                userData: user
            };

            // Log user context for debugging
            console.log('User context set:', {
                id: req.user.id,
                email: req.user.email,
                userType: req.user.userType,
                role: req.user.role
            });
        } else {
            req.user = null;
        }

        next();
    } catch (error) {
        // Ignore auth errors for optional auth
        req.user = null;
        next();
    }
};

// Rate limiting per user
const userRateLimit = (maxRequests = 100, windowMs = 60 * 60 * 1000) => {
    const requests = new Map();

    return (req, res, next) => {
        if (!req.user) return next();

        const userId = req.user.id;
        const now = Date.now();
        const windowStart = now - windowMs;

        // Clean old entries
        if (requests.has(userId)) {
            const userRequests = requests.get(userId).filter(time => time > windowStart);
            requests.set(userId, userRequests);
        } else {
            requests.set(userId, []);
        }

        const userRequests = requests.get(userId);

        if (userRequests.length >= maxRequests) {
            return res.status(429).json({
                success: false,
                error: 'Too many requests. Please try again later.',
                retryAfter: Math.ceil((userRequests[0] + windowMs - now) / 1000)
            });
        }

        userRequests.push(now);
        next();
    };
};

// User context validation middleware
const validateUserContext = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: 'User context not found',
            details: {
                message: 'User authentication required',
                path: req.originalUrl
            }
        });
    }

    // Log user context for debugging
    console.log('User context validated:', {
        id: req.user.id,
        email: req.user.email,
        userType: req.user.userType,
        role: req.user.role,
        path: req.originalUrl
    });

    next();
};

// Refresh token
const refreshToken = (req, res) => {
    try {
        const { user } = req;
        const newToken = generateToken(user.userData, user.userType);

        res.json({
            success: true,
            token: newToken,
            expiresIn: process.env.JWT_EXPIRES_IN || '24h'
        });
    } catch (error) {
        console.error('Token refresh error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to refresh token'
        });
    }
};

module.exports = {
    generateToken,
    authenticateToken,
    adminOnly,
    adminOrSuperAdmin,
    driverOnly,
    superAdminOnly,
    requirePermission,
    canAccessDriverData,
    optionalAuth,
    validateUserContext,
    userRateLimit,
    refreshToken
};