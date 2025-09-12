const axios = require('axios');

// Test the verify-token endpoint
async function testVerifyToken() {
    try {
        console.log('🧪 Testing /api/auth/verify-token endpoint...');

        // Test with demo token
        const response = await axios.get('http://localhost:5000/api/auth/verify-token', {
            headers: {
                'Authorization': 'Bearer test-token-for-demo'
            }
        });

        console.log('✅ Success Response:');
        console.log('Status:', response.status);
        console.log('Data:', JSON.stringify(response.data, null, 2));

    } catch (error) {
        console.log('❌ Error Response:');
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.log('Error:', error.message);
        }
    }
}

// Test without token
async function testWithoutToken() {
    try {
        console.log('\n🧪 Testing /api/auth/verify-token without token...');

        const response = await axios.get('http://localhost:5000/api/auth/verify-token');

        console.log('✅ Success Response:');
        console.log('Status:', response.status);
        console.log('Data:', JSON.stringify(response.data, null, 2));

    } catch (error) {
        console.log('❌ Expected Error Response:');
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.log('Error:', error.message);
        }
    }
}

// Run tests
async function runTests() {
    await testVerifyToken();
    await testWithoutToken();
}

runTests();
