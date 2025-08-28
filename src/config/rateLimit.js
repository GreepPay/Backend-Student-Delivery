/**
 * Rate Limiting Configuration
 * 
 * This file centralizes all rate limiting configurations for the application.
 * Rate limiting is automatically disabled in development mode.
 */

const rateLimit = require('express-rate-limit');

// Check if we're in development mode
const isDevelopment = process.env.NODE_ENV === 'development';

// Helper function to create a no-op middleware for development
const createNoOpMiddleware = () => (req, res, next) => next();

// Broadcast rate limiting configuration
const createBroadcastLimiter = () => {
    if (isDevelopment) {
        console.log('🚫 Rate limiting disabled for development mode');
        return createNoOpMiddleware();
    }

    return rateLimit({
        windowMs: 10 * 1000, // 10 seconds
        max: 30, // limit each IP to 30 requests per 10 seconds
        message: {
            success: false,
            error: 'Too many broadcast requests, please wait 10 seconds'
        },
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => {
            // Use user ID if authenticated, otherwise use IP
            return req.user ? req.user.id : req.ip;
        }
    });
};

// General API rate limiting configuration
const createGeneralLimiter = () => {
    if (isDevelopment) {
        return createNoOpMiddleware();
    }

    return rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // limit each IP to 100 requests per windowMs
        message: {
            success: false,
            error: 'Too many requests from this IP, please try again later'
        },
        standardHeaders: true,
        legacyHeaders: false,
    });
};

// Production rate limiting configuration
const createProductionLimiter = () => {
    if (isDevelopment) {
        return createNoOpMiddleware();
    }

    return rateLimit({
        windowMs: 60 * 60 * 1000, // 1 hour
        max: process.env.MAX_REQUESTS_PER_HOUR || 1000,
        message: {
            error: 'Too many requests from this IP, please try again later.'
        },
        standardHeaders: true,
        legacyHeaders: false,
    });
};

// User-specific rate limiting configuration
const createUserRateLimiter = (maxRequests = 100, windowMs = 60 * 60 * 1000) => {
    if (isDevelopment) {
        return createNoOpMiddleware();
    }

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

// OTP rate limiting configuration
const createOTPRateLimiter = (timeWindow = 5, maxAttempts = 3) => {
    if (isDevelopment) {
        return async () => true;
    }

    return async function (email, userType) {
        const windowStart = new Date(Date.now() - timeWindow * 60 * 1000);
        const OTP = require('../models/OTP');

        const recentAttempts = await OTP.countDocuments({
            email,
            userType,
            createdAt: { $gte: windowStart }
        });

        if (recentAttempts >= maxAttempts) {
            throw new Error(`Too many OTP requests. Please wait ${timeWindow} minutes before trying again.`);
        }

        return true;
    };
};

module.exports = {
    isDevelopment,
    createBroadcastLimiter,
    createGeneralLimiter,
    createProductionLimiter,
    createUserRateLimiter,
    createOTPRateLimiter,
    createNoOpMiddleware
};
