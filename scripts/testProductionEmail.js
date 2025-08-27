#!/usr/bin/env node

/**
 * Test Production Email Configuration
 * 
 * This script tests the email functionality in production mode.
 * WARNING: This will attempt to send actual emails!
 */

require('dotenv').config();
const EmailService = require('../src/services/emailService');

async function testProductionEmail() {
    console.log('🧪 Testing Production Email Configuration');
    console.log('==========================================\n');

    // Set production mode
    process.env.NODE_ENV = 'production';

    console.log('📋 Production Configuration:');
    console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`ZEPTO_MAIL_USER: ${process.env.ZEPTO_MAIL_USER ? '✅ Set' : '❌ Not set'}`);
    console.log(`ZEPTO_MAIL_PASSWORD: ${process.env.ZEPTO_MAIL_PASSWORD ? '✅ Set' : '❌ Not set'}\n`);

    if (!process.env.ZEPTO_MAIL_USER || !process.env.ZEPTO_MAIL_PASSWORD) {
        console.log('❌ Missing required environment variables!');
        console.log('Please set ZEPTO_MAIL_USER and ZEPTO_MAIL_PASSWORD');
        return;
    }

    console.log('⚠️  WARNING: This will attempt to send actual emails!');
    console.log('Make sure you have valid Zepto Mail credentials and are not on localhost.\n');

    try {
        const emailService = EmailService;

        // Test SMTP connection
        console.log('🔗 Testing SMTP connection...');
        const connectionTest = await emailService.testConnection();

        if (connectionTest) {
            console.log('✅ SMTP connection successful!\n');

            // Test OTP email (will actually send)
            console.log('📧 Testing OTP email in production mode...');
            const testEmail = 'test@example.com'; // Change this to a real email for testing
            const testOTP = '123456';

            try {
                const result = await emailService.sendOTP(testEmail, testOTP, 'admin');
                console.log('✅ Production OTP email test completed!');
                console.log(`Result: ${JSON.stringify(result, null, 2)}\n`);
                console.log('🎉 Production email configuration is working correctly!');
            } catch (error) {
                console.log('⚠️  Production OTP email test failed:');
                console.log(`Error: ${error.message}`);
                console.log('\n💡 This might be expected if:');
                console.log('- You\'re testing from localhost (relay restrictions)');
                console.log('- The email address is invalid');
                console.log('- Zepto Mail credentials are incorrect');
            }

        } else {
            console.log('❌ SMTP connection failed!');
            console.log('Please check your Zepto Mail credentials.');
        }

    } catch (error) {
        console.log('❌ Production email test failed:');
        console.log(`Error: ${error.message}`);
    }
}

// Run the test
testProductionEmail().catch(console.error);
