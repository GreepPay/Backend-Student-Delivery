// Custom error class
class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}

// Handle different types of errors
const handleCastErrorDB = (err) => {
    const message = `Invalid ${err.path}: ${err.value}`;
    return new AppError(message, 400);
};

const handleDuplicateFieldsDB = (err) => {
    const value = err.errmsg.match(/(["'])(\\?.)*?\1/)[0];
    const message = `Duplicate field value: ${value}. Please use another value!`;
    return new AppError(message, 400);
};

const handleValidationErrorDB = (err) => {
    const errors = Object.values(err.errors).map(el => el.message);
    const message = `Invalid input data. ${errors.join('. ')}`;
    return new AppError(message, 400);
};

const handleJWTError = () =>
    new AppError('Invalid token. Please log in again!', 401);

const handleJWTExpiredError = () =>
    new AppError('Your token has expired! Please log in again.', 401);

// Send error in development
const sendErrorDev = (err, res) => {
    res.status(err.statusCode).json({
        success: false,
        error: err.message,
        stack: err.stack,
        details: err
    });
};

// Send error in production
const sendErrorProd = (err, res) => {
    // Operational, trusted error: send message to client
    if (err.isOperational) {
        res.status(err.statusCode).json({
            success: false,
            error: err.message
        });
    } else {
        // Programming or other unknown error: don't leak error details
        console.error('ERROR 💥', err);

        res.status(500).json({
            success: false,
            error: 'Something went wrong!'
        });
    }
};

// Global error handling middleware
const errorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    if (process.env.NODE_ENV === 'development') {
        sendErrorDev(err, res);
    } else {
        let error = { ...err };
        error.message = err.message;

        // Handle different types of errors
        if (error.name === 'CastError') error = handleCastErrorDB(error);
        if (error.code === 11000) error = handleDuplicateFieldsDB(error);
        if (error.name === 'ValidationError') error = handleValidationErrorDB(error);
        if (error.name === 'JsonWebTokenError') error = handleJWTError();
        if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();

        sendErrorProd(error, res);
    }
};

// Catch 404 errors
const notFound = (req, res, next) => {
    const message = `Can't find ${req.originalUrl} on this server!`;
    const error = new AppError(message, 404);
    next(error);
};

// Async error handler wrapper
const catchAsync = (fn) => {
    return (req, res, next) => {
        fn(req, res, next).catch(next);
    };
};

// Rate limit error handler
const rateLimitHandler = (req, res) => {
    res.status(429).json({
        success: false,
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: req.rateLimit?.resetTime
    });
};

// Validation error formatter
const formatValidationError = (error) => {
    if (error.details) {
        return {
            success: false,
            error: 'Validation failed',
            details: error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message,
                value: detail.context?.value
            }))
        };
    }
    return {
        success: false,
        error: error.message || 'Validation failed'
    };
};

// Database connection error handler
const handleDBError = (error) => {
    console.error('Database Error:', error.message);

    if (error.name === 'MongoNetworkError') {
        return {
            success: false,
            error: 'Database connection failed. Please try again later.'
        };
    }

    if (error.name === 'MongoTimeoutError') {
        return {
            success: false,
            error: 'Database operation timed out. Please try again.'
        };
    }

    return {
        success: false,
        error: 'Database operation failed'
    };
};

// Email service error handler
const handleEmailError = (error) => {
    console.error('Email Service Error:', error.message);

    if (error.code === 'EAUTH') {
        return {
            success: false,
            error: 'Email authentication failed'
        };
    }

    if (error.code === 'ENOTFOUND') {
        return {
            success: false,
            error: 'Email service unavailable'
        };
    }

    return {
        success: false,
        error: 'Failed to send email notification'
    };
};

// File upload error handler
const handleFileUploadError = (error) => {
    console.error('File Upload Error:', error.message);

    if (error.code === 'LIMIT_FILE_SIZE') {
        return {
            success: false,
            error: 'File too large. Maximum size is 5MB.'
        };
    }

    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
        return {
            success: false,
            error: 'Too many files or unexpected field name.'
        };
    }

    return {
        success: false,
        error: 'File upload failed'
    };
};

// OTP error handler
const handleOTPError = (error) => {
    const otpErrorMessages = {
        'OTP has expired': 'Your verification code has expired. Please request a new one.',
        'OTP has already been used': 'This verification code has already been used. Please request a new one.',
        'Invalid OTP': 'Invalid verification code. Please check and try again.',
        'Maximum OTP attempts exceeded': 'Too many failed attempts. Please request a new verification code.',
        'Too many OTP requests': 'Too many requests. Please wait before requesting another code.'
    };

    return {
        success: false,
        error: otpErrorMessages[error.message] || 'Verification failed'
    };
};

// Success response helper
const successResponse = (res, data, message = 'Success', statusCode = 200) => {
    res.status(statusCode).json({
        success: true,
        message,
        data,
        timestamp: new Date().toISOString()
    });
};

// Paginated response helper
const paginatedResponse = (res, data, pagination, message = 'Success') => {
    res.status(200).json({
        success: true,
        message,
        data,
        pagination: {
            page: pagination.page,
            limit: pagination.limit,
            total: pagination.total,
            pages: Math.ceil(pagination.total / pagination.limit),
            hasNext: pagination.page < Math.ceil(pagination.total / pagination.limit),
            hasPrev: pagination.page > 1
        },
        timestamp: new Date().toISOString()
    });
};

// Error response helper
const errorResponse = (res, error, statusCode = 500) => {
    console.error('API Error:', error);

    res.status(statusCode).json({
        success: false,
        error: error.message || 'Internal server error',
        timestamp: new Date().toISOString(),
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
};

// Log errors for monitoring
const logError = (error, req = null) => {
    const errorInfo = {
        timestamp: new Date().toISOString(),
        error: {
            message: error.message,
            stack: error.stack,
            name: error.name
        },
        ...(req && {
            request: {
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                user: req.user?.id || 'anonymous'
            }
        })
    };

    // In production, you might want to send this to a logging service
    console.error('Error Log:', JSON.stringify(errorInfo, null, 2));

    // TODO: Integrate with logging service (e.g., Winston, Sentry)
    // logger.error(errorInfo);
};

module.exports = {
    AppError,
    errorHandler,
    notFound,
    catchAsync,
    rateLimitHandler,
    formatValidationError,
    handleDBError,
    handleEmailError,
    handleFileUploadError,
    handleOTPError,
    successResponse,
    paginatedResponse,
    errorResponse,
    logError
};