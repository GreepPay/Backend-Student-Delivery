#!/usr/bin/env node

/**
 * Test Zepto Mail Configuration
 * 
 * This script tests the Zepto Mail configuration to ensure it's working correctly.
 */

require('dotenv').config();
const EmailService = require('../src/services/emailService');

async function testZeptoMail() {
    console.log('🧪 Testing Zepto Mail Configuration');
    console.log('===================================\n');

    // Check environment variables
    console.log('📋 Environment Variables:');
    console.log(`ZEPTO_MAIL_USER: ${process.env.ZEPTO_MAIL_USER ? '✅ Set' : '❌ Not set'}`);
    console.log(`ZEPTO_MAIL_PASSWORD: ${process.env.ZEPTO_MAIL_PASSWORD ? '✅ Set' : '❌ Not set'}`);
    console.log(`EMAIL_FROM_NAME: ${process.env.EMAIL_FROM_NAME || 'Student Delivery System'}\n`);

    if (!process.env.ZEPTO_MAIL_USER || !process.env.ZEPTO_MAIL_PASSWORD) {
        console.log('❌ Missing required environment variables!');
        console.log('Please set ZEPTO_MAIL_USER and ZEPTO_MAIL_PASSWORD in your .env file');
        return;
    }

    try {
        const emailService = EmailService; // EmailService is already an instance

        // Test connection
        console.log('🔗 Testing SMTP connection...');
        const connectionTest = await emailService.testConnection();

        if (connectionTest) {
            console.log('✅ SMTP connection successful!\n');

            // Test OTP email (will only log in development)
            console.log('📧 Testing OTP email...');
            const testEmail = 'test@example.com';
            const testOTP = '123456';

            try {
                const result = await emailService.sendOTP(testEmail, testOTP, 'admin');
                console.log('✅ OTP email test completed!');
                console.log(`Result: ${JSON.stringify(result, null, 2)}\n`);
            } catch (error) {
                console.log('⚠️  OTP email test failed (this might be expected in development):');
                console.log(`Error: ${error.message}\n`);
            }

        } else {
            console.log('❌ SMTP connection failed!');
            console.log('Please check your Zepto Mail credentials and try again.');
        }

    } catch (error) {
        console.log('❌ Email service test failed:');
        console.log(`Error: ${error.message}`);
    }
}

// Run the test
testZeptoMail().catch(console.error);
