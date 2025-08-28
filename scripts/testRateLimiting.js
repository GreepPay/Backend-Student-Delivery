const axios = require('axios');

// Test configuration
const BASE_URL = process.env.API_URL || 'http://localhost:3001';
const TEST_ENDPOINTS = [
    '/api/public/test',
    '/health',
    '/api/delivery/broadcast/active'
];

async function testRateLimiting() {
    console.log('🧪 Testing rate limiting in development mode...');
    console.log(`📍 Testing against: ${BASE_URL}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('');

    for (const endpoint of TEST_ENDPOINTS) {
        console.log(`📡 Testing endpoint: ${endpoint}`);

        try {
            // Make multiple rapid requests to test rate limiting
            const promises = [];
            for (let i = 0; i < 10; i++) {
                promises.push(
                    axios.get(`${BASE_URL}${endpoint}`)
                        .then(response => ({ success: true, status: response.status }))
                        .catch(error => ({ success: false, status: error.response?.status, error: error.message }))
                );
            }

            const results = await Promise.all(promises);
            const successful = results.filter(r => r.success);
            const rateLimited = results.filter(r => r.status === 429);

            console.log(`  ✅ Successful requests: ${successful.length}/10`);
            console.log(`  🚫 Rate limited requests: ${rateLimited.length}/10`);

            if (rateLimited.length > 0) {
                console.log(`  ⚠️  WARNING: Rate limiting is still active for ${endpoint}`);
            } else {
                console.log(`  ✅ Rate limiting is properly disabled for ${endpoint}`);
            }

        } catch (error) {
            console.log(`  ❌ Error testing ${endpoint}:`, error.message);
        }

        console.log('');
    }

    console.log('🎯 Rate limiting test completed!');
    console.log('');
    console.log('📝 Summary:');
    console.log('- If you see any "Rate limited requests" above, rate limiting is still active');
    console.log('- If all requests are successful, rate limiting is properly disabled');
    console.log('- Make sure NODE_ENV=development is set in your environment');
}

// Run the test
testRateLimiting().catch(console.error);
