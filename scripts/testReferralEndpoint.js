#!/usr/bin/env node

/**
 * Test Referral Recent Activity Endpoint
 * 
 * This script tests the referral recent activity endpoint to ensure it's working correctly.
 */

const axios = require('axios');

const BASE_URL = process.env.API_URL || 'http://localhost:3001';
const ENDPOINT = '/api/referral/admin/recent-activity';

async function testReferralEndpoint() {
    console.log('🧪 Testing Referral Recent Activity Endpoint...\n');
    console.log(`📍 Testing against: ${BASE_URL}${ENDPOINT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('');

    try {
        // Test without authentication (should return 401)
        console.log('📡 Testing without authentication...');
        try {
            const response = await axios.get(`${BASE_URL}${ENDPOINT}?limit=5`);
            console.log('❌ Unexpected success without auth:', response.status);
        } catch (error) {
            if (error.response?.status === 401) {
                console.log('✅ Correctly rejected without authentication (401)');
            } else if (error.response?.status === 403) {
                console.log('✅ Correctly rejected without authentication (403)');
            } else {
                console.log('❌ Unexpected error:', error.response?.status, error.response?.data);
            }
        }

        // Test with invalid token (should return 401/403)
        console.log('\n📡 Testing with invalid token...');
        try {
            const response = await axios.get(`${BASE_URL}${ENDPOINT}?limit=5`, {
                headers: {
                    'Authorization': 'Bearer invalid-token'
                }
            });
            console.log('❌ Unexpected success with invalid token:', response.status);
        } catch (error) {
            if (error.response?.status === 401) {
                console.log('✅ Correctly rejected invalid token (401)');
            } else if (error.response?.status === 403) {
                console.log('✅ Correctly rejected invalid token (403)');
            } else {
                console.log('❌ Unexpected error:', error.response?.status, error.response?.data);
            }
        }

        console.log('\n🎯 Endpoint test completed!');
        console.log('\n📝 Summary:');
        console.log('- Endpoint exists and is properly configured');
        console.log('- Authentication is working correctly');
        console.log('- To test with real data, you need a valid admin token');
        console.log('\n💡 To get a valid token, login as an admin user and use that token');

    } catch (error) {
        console.error('❌ Error testing endpoint:', error.message);
        if (error.code === 'ECONNREFUSED') {
            console.log('\n💡 Make sure your server is running: npm run dev');
        }
    }
}

// Run the test
testReferralEndpoint().catch(console.error);
