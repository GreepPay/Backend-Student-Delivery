/**
 * CORS Configuration
 * 
 * Centralized CORS configuration for the application.
 * This file manages all CORS settings for both Express and Socket.IO.
 */

// Default allowed origins
const defaultAllowedOrigins = [
    "*"
];

// Get allowed origins from environment
function getAllowedOrigins() {
    const origins = [...defaultAllowedOrigins];

    // Add FRONTEND_URL from environment if it exists
    if (process.env.FRONTEND_URL) {
        origins.push(process.env.FRONTEND_URL);
    }

    // Add additional origins from environment if specified
    if (process.env.ADDITIONAL_CORS_ORIGINS) {
        const additionalOrigins = process.env.ADDITIONAL_CORS_ORIGINS.split(',').map(origin => origin.trim());
        origins.push(...additionalOrigins);
    }

    // Remove duplicates
    return [...new Set(origins)];
}

// Express CORS configuration
const expressCorsConfig = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        const allowedOrigins = getAllowedOrigins();

        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.log('🚫 CORS blocked origin:', origin);
            console.log('✅ Allowed origins:', allowedOrigins);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Origin',
        'Access-Control-Request-Method',
        'Access-Control-Request-Headers'
    ],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    maxAge: 86400 // 24 hours
};

// Socket.IO CORS configuration
const socketCorsConfig = {
    origin: getAllowedOrigins(),
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Origin'
    ]
};

// Log CORS configuration on startup
function logCorsConfig() {
    const origins = getAllowedOrigins();
    console.log('🌐 CORS Configuration:');
    console.log('   Allowed origins:', origins);
    console.log('   Environment:', process.env.NODE_ENV || 'development');
    console.log('   FRONTEND_URL:', process.env.FRONTEND_URL || 'not set');
    console.log('   ADDITIONAL_CORS_ORIGINS:', process.env.ADDITIONAL_CORS_ORIGINS || 'not set');
}

module.exports = {
    expressCorsConfig,
    socketCorsConfig,
    getAllowedOrigins,
    logCorsConfig
};

