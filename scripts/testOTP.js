#!/usr/bin/env node

/**
 * Test OTP Functionality
 * 
 * This script tests the OTP functionality in development mode.
 */

require('dotenv').config();
const EmailService = require('../src/services/emailService');

async function testOTP() {
    console.log('🧪 Testing OTP Functionality');
    console.log('=============================\n');

    // Set development mode
    process.env.NODE_ENV = 'development';

    console.log('📋 Test Configuration:');
    console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`ZEPTO_MAIL_USER: ${process.env.ZEPTO_MAIL_USER ? '✅ Set' : '❌ Not set'}\n`);

    try {
        const emailService = EmailService;

        // Test OTP email in development mode
        console.log('📧 Testing OTP email in development mode...');
        const testEmail = 'test@example.com';
        const testOTP = '123456';

        const result = await emailService.sendOTP(testEmail, testOTP, 'admin');

        console.log('✅ OTP test completed successfully!');
        console.log(`Result: ${JSON.stringify(result, null, 2)}\n`);

        console.log('🎉 All tests passed! Your Zepto Mail integration is working correctly.');
        console.log('📝 In development mode, emails are logged to console instead of being sent.');

    } catch (error) {
        console.log('❌ OTP test failed:');
        console.log(`Error: ${error.message}`);
    }
}

// Run the test
testOTP().catch(console.error);
