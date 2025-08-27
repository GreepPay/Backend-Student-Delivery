#!/usr/bin/env node

/**
 * Production Setup Script
 * 
 * This script helps you set up the production environment for the Student Delivery System.
 */

require('dotenv').config();

console.log('🚀 Production Setup for Student Delivery System');
console.log('===============================================\n');

console.log('📋 Required Production Environment Variables:');
console.log('NODE_ENV=production');
console.log('PORT=3001 (or your preferred port)');
console.log('MONGODB_URI=your_production_mongodb_connection_string');
console.log('ZEPTO_MAIL_USER=your_zeptomail_username');
console.log('ZEPTO_MAIL_PASSWORD=your_zeptomail_password');
console.log('EMAIL_FROM_NAME=Student Delivery System');
console.log('JWT_SECRET=your_secure_jwt_secret');
console.log('JWT_EXPIRES_IN=24h');
console.log('FRONTEND_URL=https://student-delivery.greep.io');
console.log('OTP_EXPIRY_MINUTES=10');
console.log('MAX_REQUESTS_PER_HOUR=1000\n');

console.log('🔧 Production Configuration:');
console.log('- Email Service: Zepto Mail SMTP');
console.log('- Authentication: JWT with OTP');
console.log('- Database: MongoDB Atlas');
console.log('- Rate Limiting: Enabled');
console.log('- CORS: Configured for production domain\n');

console.log('📧 Zepto Mail Production Setup:');
console.log('1. Ensure your Zepto Mail account is verified');
console.log('2. Use a verified domain (not sandbox)');
console.log('3. Set proper SMTP credentials');
console.log('4. Test email delivery\n');

console.log('🌐 Deployment Options:');
console.log('1. Heroku: Easy deployment with environment variables');
console.log('2. Railway: Simple deployment with automatic scaling');
console.log('3. DigitalOcean: Full control with App Platform');
console.log('4. AWS: EC2 or Elastic Beanstalk');
console.log('5. Vercel: Serverless deployment\n');

console.log('🔒 Security Checklist:');
console.log('✅ Use strong JWT secret');
console.log('✅ Enable HTTPS in production');
console.log('✅ Set proper CORS origins');
console.log('✅ Configure rate limiting');
console.log('✅ Use environment variables for secrets');
console.log('✅ Enable MongoDB connection security\n');

console.log('📊 Monitoring Setup:');
console.log('- Set up logging (Winston, Bunyan)');
console.log('- Configure error tracking (Sentry)');
console.log('- Set up health checks');
console.log('- Monitor email delivery rates\n');

console.log('✅ Production setup guide completed!');
console.log('Your application is ready for production deployment.');
