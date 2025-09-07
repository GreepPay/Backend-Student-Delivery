const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

// Import rate limiting configuration
const { createBroadcastLimiter, createGeneralLimiter, createProductionLimiter } = require('./config/rateLimit');

// Import CORS configuration
const { expressCorsConfig, logCorsConfig } = require('./config/cors');

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
const messageRoutes = require('./routes/messages');
const conversationRoutes = require('./routes/conversations');

// Import middleware
const { errorHandler, notFound } = require('./middleware/errorHandler');

const app = express();

// Create rate limiters
const broadcastLimiter = createBroadcastLimiter();
const generalLimiter = createGeneralLimiter();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors(expressCorsConfig));

// Log CORS configuration on startup
logCorsConfig();

// Rate limiting - Now handled by centralized configuration
const limiter = createProductionLimiter();
app.use('/api/', limiter);

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
app.use('/api/messages', messageRoutes);
app.use('/api/conversations', conversationRoutes);

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