const axios = require('axios');

const API_BASE_URL = 'http://localhost:3001/api';

// Test if status field is being returned
async function testStatusResponse() {
    try {
        console.log('🔍 Testing Status Response...\n');

        // Test the API response (without auth for now)
        console.log('📋 Testing GET /admin/drivers endpoint...');

        try {
            const response = await axios.get(`${API_BASE_URL}/admin/drivers?limit=3`);

            console.log('✅ API Response Status:', response.status);
            console.log('📊 Response Data Structure:');

            if (response.data && response.data.drivers) {
                const drivers = response.data.drivers;
                console.log(`   Drivers returned: ${drivers.length}`);

                if (drivers.length > 0) {
                    console.log('\n📋 Driver Status Check:');
                    drivers.forEach((driver, index) => {
                        console.log(`   Driver ${index + 1}: ${driver.name || driver.fullName}`);
                        console.log(`     - Status field exists: ${driver.hasOwnProperty('status') ? '✅' : '❌'}`);
                        console.log(`     - Status value: ${driver.status || 'undefined'}`);
                        console.log(`     - isOnline: ${driver.isOnline}`);
                        console.log(`     - isActive: ${driver.isActive}`);
                        console.log(`     - isSuspended: ${driver.isSuspended}`);
                        console.log('');
                    });
                }
            } else {
                console.log('❌ No drivers array in response');
                console.log('Response structure:', Object.keys(response.data || {}));
            }

        } catch (error) {
            console.log('❌ Error calling API:', error.response?.status, error.response?.data?.error || error.message);
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the test
testStatusResponse();
