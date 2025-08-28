#!/usr/bin/env node

/**
 * Development Environment Setup Script
 * 
 * This script helps developers set up their environment for development mode
 * and ensures rate limiting is properly disabled.
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up development environment...\n');

// Check if .env file exists
const envPath = path.join(process.cwd(), '.env');
const envExists = fs.existsSync(envPath);

if (!envExists) {
    console.log('⚠️  No .env file found. Creating one...');

    const defaultEnvContent = `# Development Environment Configuration
NODE_ENV=development
PORT=3001
MONGODB_URI=mongodb://localhost:27017/student-delivery-dev

# Rate Limiting (disabled in development)
MAX_REQUESTS_PER_HOUR=1000

# JWT Configuration
JWT_SECRET=your-jwt-secret-key-here
JWT_EXPIRES_IN=24h

# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# Frontend URL
FRONTEND_URL=http://localhost:3000

# OTP Configuration
OTP_EXPIRY_MINUTES=10

# Cloudinary Configuration (optional)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
`;

    fs.writeFileSync(envPath, defaultEnvContent);
    console.log('✅ Created .env file with default development settings');
} else {
    console.log('✅ .env file already exists');

    // Check if NODE_ENV is set to development
    const envContent = fs.readFileSync(envPath, 'utf8');
    if (!envContent.includes('NODE_ENV=development')) {
        console.log('⚠️  NODE_ENV is not set to development in .env file');
        console.log('   Please add or update: NODE_ENV=development');
    } else {
        console.log('✅ NODE_ENV is properly set to development');
    }
}

// Check current environment
console.log(`\n🌍 Current NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);

if (process.env.NODE_ENV !== 'development') {
    console.log('\n⚠️  WARNING: NODE_ENV is not set to development!');
    console.log('   Rate limiting may still be active.');
    console.log('   To fix this, run: export NODE_ENV=development');
    console.log('   Or add NODE_ENV=development to your .env file');
} else {
    console.log('\n✅ Rate limiting is disabled for development mode');
}

// Check if server is running
console.log('\n🔍 Checking if server is running...');
const http = require('http');

const checkServer = () => {
    return new Promise((resolve) => {
        const req = http.get('http://localhost:3001/health', (res) => {
            if (res.statusCode === 200) {
                resolve(true);
            } else {
                resolve(false);
            }
        });

        req.on('error', () => {
            resolve(false);
        });

        req.setTimeout(2000, () => {
            req.destroy();
            resolve(false);
        });
    });
};

checkServer().then((isRunning) => {
    if (isRunning) {
        console.log('✅ Server is running on http://localhost:3001');
        console.log('\n🧪 You can now test rate limiting with:');
        console.log('   npm run test:rate-limit');
    } else {
        console.log('❌ Server is not running');
        console.log('\n🚀 To start the server:');
        console.log('   npm run dev');
    }
});

console.log('\n📚 For more information, see: docs/RATE_LIMITING.md');
