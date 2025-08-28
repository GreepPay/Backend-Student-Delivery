#!/usr/bin/env node

/**
 * Email Configuration Test Script
 * 
 * This script tests the email configuration and shows what's happening
 * with the email service.
 */

require('dotenv').config();

console.log('📧 Testing Email Configuration...\n');

// Check environment variables
console.log('🔍 Environment Variables:');
console.log(`NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
console.log(`ZEPTO_MAIL_USER: ${process.env.ZEPTO_MAIL_USER ? '✅ Set' : '❌ Not set'}`);
console.log(`ZEPTO_MAIL_PASSWORD: ${process.env.ZEPTO_MAIL_PASSWORD ? '✅ Set' : '❌ Not set'}`);
console.log(`EMAIL_USER: ${process.env.EMAIL_USER ? '✅ Set' : '❌ Not set'}`);
console.log(`EMAIL_PASSWORD: ${process.env.EMAIL_PASSWORD ? '✅ Set' : '❌ Not set'}`);
console.log(`EMAIL_FROM_NAME: ${process.env.EMAIL_FROM_NAME || 'not set'}`);
console.log(`FROM_EMAIL: ${process.env.FROM_EMAIL || 'not set (will use SMTP user)'}\n`);

// Test email service
const emailService = require('../src/services/emailService');

console.log('📧 Email Service Configuration:');
console.log(`Provider: ${emailService.emailProvider || 'unknown'}`);
console.log(`From Email: ${emailService.fromEmail || 'not set'}`);
console.log(`Transporter: ${emailService.transporter ? '✅ Available' : '❌ Not available'}\n`);

// Test connection
console.log('🔗 Testing Email Connection...');
emailService.testConnection()
    .then((isConnected) => {
        if (isConnected) {
            console.log('✅ Email service is working correctly!');
        } else {
            console.log('❌ Email service connection failed');
        }
    })
    .catch((error) => {
        console.error('❌ Error testing email connection:', error.message);
    });

// Test OTP sending in development
if (process.env.NODE_ENV === 'development') {
    console.log('\n🧪 Testing OTP sending in development mode...');
    emailService.sendOTP('test@example.com', '123456', 'driver')
        .then((result) => {
            console.log('✅ OTP test successful:', result);
        })
        .catch((error) => {
            console.error('❌ OTP test failed:', error.message);
        });
}

console.log('\n📝 Summary:');
if (process.env.NODE_ENV === 'development') {
    console.log('- In development mode, OTPs are logged to console instead of sending emails');
    console.log('- This prevents the "553 Relaying disallowed" error you were seeing');
} else {
    console.log('- In production mode, emails will be sent using the configured provider');
}

if (!emailService.transporter) {
    console.log('\n⚠️  WARNING: No email configuration available!');
    console.log('   To fix this, set either:');
    console.log('   - ZEPTO_MAIL_USER and ZEPTO_MAIL_PASSWORD (for ZeptoMail)');
    console.log('   - EMAIL_USER and EMAIL_PASSWORD (for Gmail)');
}

if (!process.env.FROM_EMAIL) {
    console.log('\n💡 TIP: To use noreply@greep.io as FROM email, add to your .env file:');
    console.log('   FROM_EMAIL=noreply@greep.io');
}
