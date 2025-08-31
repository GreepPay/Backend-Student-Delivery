#!/usr/bin/env node

/**
 * CORS Test Script
 * 
 * This script tests CORS configuration with different origins
 * to ensure the backend accepts requests from allowed domains.
 */

const axios = require('axios');

const BASE_URL = process.env.API_URL || 'http://localhost:3001';
const TEST_ENDPOINT = '/health';

// Test origins
const testOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'https://student-delivery.greep.io',
    'https://student-delivery.greep.io/',
    'https://blocked-domain.com' // This should be blocked
];

async function testCors() {
    console.log('🌐 Testing CORS Configuration...\n');
    console.log(`📍 Testing against: ${BASE_URL}${TEST_ENDPOINT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('');

    for (const origin of testOrigins) {
        console.log(`📡 Testing origin: ${origin}`);

        try {
            const response = await axios.get(`${BASE_URL}${TEST_ENDPOINT}`, {
                headers: {
                    'Origin': origin
                }
            });

            // Check if CORS headers are present
            const corsHeaders = {
                'Access-Control-Allow-Origin': response.headers['access-control-allow-origin'],
                'Access-Control-Allow-Credentials': response.headers['access-control-allow-credentials'],
                'Access-Control-Allow-Methods': response.headers['access-control-allow-methods']
            };

            console.log(`  ✅ Request successful (${response.status})`);
            console.log(`  📋 CORS Headers:`, corsHeaders);

            // Check if the origin is allowed
            if (corsHeaders['Access-Control-Allow-Origin'] === origin ||
                corsHeaders['Access-Control-Allow-Origin'] === '*') {
                console.log(`  ✅ Origin allowed by CORS`);
            } else {
                console.log(`  ⚠️  Origin not explicitly allowed (but request succeeded)`);
            }

        } catch (error) {
            if (error.response?.status === 403) {
                console.log(`  🚫 Origin blocked by CORS (403)`);
            } else if (error.code === 'ECONNREFUSED') {
                console.log(`  ❌ Connection refused - server not running`);
                break;
            } else {
                console.log(`  ❌ Error: ${error.message}`);
            }
        }

        console.log('');
    }

    // Test preflight request
    console.log('🛫 Testing preflight request...');
    try {
        const preflightResponse = await axios.options(`${BASE_URL}${TEST_ENDPOINT}`, {
            headers: {
                'Origin': 'http://localhost:3000',
                'Access-Control-Request-Method': 'GET',
                'Access-Control-Request-Headers': 'Content-Type'
            }
        });

        console.log(`  ✅ Preflight successful (${preflightResponse.status})`);
        console.log(`  📋 Preflight Headers:`, {
            'Access-Control-Allow-Origin': preflightResponse.headers['access-control-allow-origin'],
            'Access-Control-Allow-Methods': preflightResponse.headers['access-control-allow-methods'],
            'Access-Control-Allow-Headers': preflightResponse.headers['access-control-allow-headers']
        });

    } catch (error) {
        console.log(`  ❌ Preflight failed: ${error.message}`);
    }

    console.log('\n🎯 CORS test completed!');
    console.log('\n📝 Summary:');
    console.log('- Allowed origins should return 200 status');
    console.log('- Blocked origins should return 403 status');
    console.log('- CORS headers should be present in responses');
    console.log('\n💡 To add more origins, set ADDITIONAL_CORS_ORIGINS in your .env file');
}

// Run the test
testCors().catch(console.error);

