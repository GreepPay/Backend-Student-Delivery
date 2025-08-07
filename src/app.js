const express = require('express');
const cors = require('cors');//cors middleware
const helmet = require('helmet');//security middleware
const morgan = require('morgan');//logging middleware
const rateLimit = require('express-rate-limit');//rate limiting middleware 

// Import routes
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const driverRoutes = require('./routes/driver');
const deliveryRoutes = require('./routes/delivery');
const notificationRoutes = require('./routes/notifications');
const earningsConfigRoutes = require('./routes/earningsConfig');
const driverRatingRoutes = require('./routes/driverRating');
const systemSettingsRoutes = require('./routes/systemSettings');
const remittanceRoutes = require('./routes/remittance');
const publicRoutes = require('./routes/public');

// Import middleware
const { errorHandler, notFound } = require('./middleware/errorHandler');

const app = express();

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
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/driver', driverRoutes);
app.use('/api/delivery', deliveryRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/earnings-config', earningsConfigRoutes);
app.use('/api/driver-rating', driverRatingRoutes);
app.use('/api/system-settings', systemSettingsRoutes);
app.use('/api/remittance', remittanceRoutes);
app.use('/api/public', publicRoutes);

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