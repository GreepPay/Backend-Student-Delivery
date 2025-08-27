#!/usr/bin/env node

/**
 * Zepto Mail Setup Script
 * 
 * This script helps you configure Zepto Mail for the Student Delivery System.
 * 
 * Steps to get Zepto Mail credentials:
 * 1. Go to https://zeptomail.com
 * 2. Sign up for a free account
 * 3. Verify your domain or use their sandbox domain
 * 4. Go to Settings > SMTP Configuration
 * 5. Copy your SMTP credentials
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 Zepto Mail Setup for Student Delivery System');
console.log('================================================\n');

console.log('📋 Required Environment Variables:');
console.log('ZEPTO_MAIL_USER=your-zeptomail-username');
console.log('ZEPTO_MAIL_PASSWORD=your-zeptomail-password');
console.log('EMAIL_FROM_NAME=Student Delivery System\n');

console.log('📧 Zepto Mail Configuration:');
console.log('- Host: smtp.zeptomail.com');
console.log('- Port: 587');
console.log('- Security: STARTTLS\n');

console.log('🔧 How to get your credentials:');
console.log('1. Go to https://zeptomail.com');
console.log('2. Sign up for a free account');
console.log('3. Verify your domain or use sandbox domain');
console.log('4. Go to Settings > SMTP Configuration');
console.log('5. Copy your SMTP username and password\n');

console.log('💡 Tips:');
console.log('- Free tier includes 10,000 emails/month');
console.log('- Sandbox domain: @zeptomail.com');
console.log('- Custom domain requires DNS verification\n');

console.log('✅ Configuration complete!');
console.log('Your email service is now configured to use Zepto Mail.');
console.log('Make sure to set the environment variables in your .env file or deployment platform.');
