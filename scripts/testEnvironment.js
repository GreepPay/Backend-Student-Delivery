#!/usr/bin/env node

/**
 * Test Environment Configuration
 */

require('dotenv').config();

console.log('🔍 Environment Configuration Test');
console.log('==================================\n');

console.log('📋 Environment Variables:');
console.log(`NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`);
console.log(`ZEPTO_MAIL_USER: ${process.env.ZEPTO_MAIL_USER ? 'Set' : 'Not set'}`);
console.log(`ZEPTO_MAIL_PASSWORD: ${process.env.ZEPTO_MAIL_PASSWORD ? 'Set' : 'Not set'}`);
console.log(`EMAIL_FROM_NAME: ${process.env.EMAIL_FROM_NAME || 'Not set'}\n`);

// Test the development mode logic
const isDevelopment = process.env.NODE_ENV === 'development';
const hasEmailCredentials = process.env.ZEPTO_MAIL_USER && process.env.ZEPTO_MAIL_PASSWORD;

console.log('🔍 Development Mode Logic:');
console.log(`isDevelopment: ${isDevelopment}`);
console.log(`hasEmailCredentials: ${hasEmailCredentials}`);
console.log(`Should log to console: ${isDevelopment && !hasEmailCredentials}`);
console.log(`Should send email: ${!isDevelopment || hasEmailCredentials}\n`);

console.log('✅ Environment test completed');
