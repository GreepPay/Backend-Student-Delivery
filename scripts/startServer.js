#!/usr/bin/env node

/**
 * Server Startup Script
 * 
 * This script helps you start the server in different modes.
 * Usage: node scripts/startServer.js [mode]
 * 
 * Modes:
 * - dev: Development mode (OTPs logged to console)
 * - prod: Production mode (real emails sent)
 * - local: Production mode with localhost override (OTPs logged to console)
 */

const { spawn } = require('child_process');

const mode = process.argv[2] || 'dev';

console.log('🚀 Starting Student Delivery Server');
console.log('===================================\n');

let env = { ...process.env };

switch (mode) {
    case 'dev':
        console.log('📋 Mode: Development');
        console.log('📧 OTPs will be logged to console');
        env.NODE_ENV = 'development';
        break;
        
    case 'prod':
        console.log('📋 Mode: Production');
        console.log('📧 Real emails will be sent via Zepto Mail');
        env.NODE_ENV = 'production';
        break;
        
    case 'local':
        console.log('📋 Mode: Production with Localhost Override');
        console.log('📧 OTPs will be logged to console (for local testing)');
        env.NODE_ENV = 'production';
        env.LOCALHOST_OVERRIDE = 'true';
        break;
        
    default:
        console.log('❌ Invalid mode. Available modes: dev, prod, local');
        console.log('Usage: node scripts/startServer.js [dev|prod|local]');
        process.exit(1);
}

console.log(`🔧 Environment: ${env.NODE_ENV}`);
console.log(`🌐 Port: ${env.PORT || 3001}`);
console.log('');

// Start the server
const server = spawn('node', ['server.js'], {
    env,
    stdio: 'inherit'
});

// Handle server exit
server.on('close', (code) => {
    console.log(`\n🛑 Server stopped with code ${code}`);
});

// Handle process signals
process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, shutting down...');
    server.kill('SIGINT');
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, shutting down...');
    server.kill('SIGTERM');
});
