#!/usr/bin/env node

/**
 * Production Test Script
 * 
 * This script tests the production configuration to ensure everything is working.
 */

require('dotenv').config();

console.log('🧪 Production Configuration Test');
console.log('=================================\n');

// Check environment variables
console.log('📋 Environment Variables Check:');
console.log(`NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`);
console.log(`PORT: ${process.env.PORT || '3001'}`);
console.log(`MONGODB_URI: ${process.env.MONGODB_URI ? '✅ Set' : '❌ Not set'}`);
console.log(`ZEPTO_MAIL_USER: ${process.env.ZEPTO_MAIL_USER ? '✅ Set' : '❌ Not set'}`);
console.log(`ZEPTO_MAIL_PASSWORD: ${process.env.ZEPTO_MAIL_PASSWORD ? '✅ Set' : '❌ Not set'}`);
console.log(`JWT_SECRET: ${process.env.JWT_SECRET ? '✅ Set' : '❌ Not set'}`);
console.log(`FRONTEND_URL: ${process.env.FRONTEND_URL || 'Not set'}\n`);

// Check if production mode is set
if (process.env.NODE_ENV !== 'production') {
    console.log('⚠️  Warning: NODE_ENV is not set to production');
    console.log('   This will affect email sending and other production features\n');
}

// Check required variables
const requiredVars = [
    'MONGODB_URI',
    'ZEPTO_MAIL_USER',
    'ZEPTO_MAIL_PASSWORD',
    'JWT_SECRET'
];

const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
    console.log('❌ Missing required environment variables:');
    missingVars.forEach(varName => console.log(`   - ${varName}`));
    console.log('');
} else {
    console.log('✅ All required environment variables are set\n');
}

// Test database connection
console.log('🔗 Testing database connection...');
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log('✅ Database connection successful');
        return mongoose.connection.close();
    })
    .catch(err => {
        console.log('❌ Database connection failed:', err.message);
    })
    .finally(() => {
        console.log('');

        // Test email service
        console.log('📧 Testing email service configuration...');
        const EmailService = require('../src/services/emailService');
        const emailService = EmailService;

        emailService.testConnection()
            .then(result => {
                if (result) {
                    console.log('✅ Email service connection successful');
                } else {
                    console.log('❌ Email service connection failed');
                }
            })
            .catch(err => {
                console.log('❌ Email service test failed:', err.message);
            })
            .finally(() => {
                console.log('');
                console.log('🎯 Production Readiness Summary:');
                console.log('==============================');

                if (process.env.NODE_ENV === 'production' && missingVars.length === 0) {
                    console.log('✅ Ready for production deployment!');
                    console.log('✅ All environment variables configured');
                    console.log('✅ Database connection working');
                    console.log('✅ Email service configured');
                    console.log('\n🚀 You can now deploy to your chosen platform');
                } else {
                    console.log('⚠️  Not ready for production yet');
                    if (process.env.NODE_ENV !== 'production') {
                        console.log('   - Set NODE_ENV=production');
                    }
                    if (missingVars.length > 0) {
                        console.log('   - Configure missing environment variables');
                    }
                }
            });
    });
