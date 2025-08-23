const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const driverRoutes = require('./routes/driver');
const adminRoutes = require('./routes/admin');
const deliveryRoutes = require('./routes/delivery');
const notificationRoutes = require('./routes/notifications');
const socketRoutes = require('./routes/socket');
const backgroundJobRoutes = require('./routes/backgroundJobs');
const systemSettingsRoutes = require('./routes/systemSettings');
const driverRatingRoutes = require('./routes/driverRating');
const referralRoutes = require('./routes/referral');
const referralRewardsRoutes = require('./routes/referralRewards');
const publicRoutes = require('./routes/public');
const remittanceRoutes = require('./routes/remittance');

// Import middleware
const { errorHandler, notFound } = require('./middleware/errorHandler');

const app = express();

// Rate limiting for broadcast endpoint
const broadcastLimiter = rateLimit({
    windowMs: 5 * 1000, // 5 seconds
    max: 3, // limit each IP to 3 requests per windowMs
    message: {
        success: false,
        error: 'Too many broadcast requests, please wait 5 seconds'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// General rate limiting
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
        success: false,
        error: 'Too many requests from this IP, please try again later'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting - Disabled for development
if (process.env.NODE_ENV === 'production') {
    const limiter = rateLimit({
        windowMs: 60 * 60 * 1000, // 1 hour
        max: process.env.MAX_REQUESTS_PER_HOUR || 1000,
        message: {
            error: 'Too many requests from this IP, please try again later.'
        },
        standardHeaders: true,
        legacyHeaders: false,
    });
    app.use('/api/', limiter);
}

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging middleware
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('combined'));//logging middleware
}

// Health check endpoint
app.get('/health', (req, res) => {
    const mongoose = require('mongoose');
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        mongodb: {
            connected: mongoose.connection.readyState === 1,
            state: mongoose.connection.readyState,
            host: mongoose.connection.host || 'Not connected'
        }
    });
});

// API routes
app.use('/api/auth', authRoutes);

// Profile route alias
app.use('/api/profile', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/driver', driverRoutes);
app.use('/api/delivery', deliveryRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/socket', socketRoutes);
app.use('/api/background-jobs', backgroundJobRoutes);
app.use('/api/system-settings', systemSettingsRoutes);
app.use('/api/driver-rating', driverRatingRoutes);
app.use('/api/referral', referralRoutes);
app.use('/api/referral-rewards', referralRewardsRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/admin/remittances', remittanceRoutes);

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'Student Delivery System API',
        version: '1.0.0',
        documentation: '/api/docs'
    });
});

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

module.exports = app;