const axios = require('axios');

async function testLeaderboardEndpoints() {
    try {
        console.log('🧪 Testing Leaderboard Endpoints...\n');

        const baseURL = 'http://localhost:3001/api';
        const headers = {
            'Authorization': 'Bearer test-token-for-demo',
            'Content-Type': 'application/json'
        };

        // Test 1: Get leaderboard categories
        console.log('📋 Test 1: Getting leaderboard categories...');
        try {
            const categoriesResponse = await axios.get(`${baseURL}/admin/leaderboard/categories`, { headers });

            console.log('✅ Categories endpoint working');
            console.log(`   Found ${categoriesResponse.data.data.data.length} categories`);
            categoriesResponse.data.data.data.forEach(cat => {
                console.log(`   - ${cat.icon} ${cat.name}: ${cat.description}`);
            });
        } catch (error) {
            console.log('❌ Categories endpoint failed:', error.response?.data?.error || error.message);
        }

        console.log('\n📊 Test 2: Getting leaderboard data...');

        // Test different categories and periods
        const testCases = [
            { category: 'overall', period: 'month', description: 'Overall champions this month' },
            { category: 'delivery', period: 'month', description: 'Delivery masters this month' },
            { category: 'earnings', period: 'month', description: 'Top earners this month' },
            { category: 'overall', period: 'all-time', description: 'Overall champions all time' }
        ];

        for (const testCase of testCases) {
            try {
                console.log(`\n   Testing: ${testCase.description}...`);
                const leaderboardResponse = await axios.get(
                    `${baseURL}/admin/leaderboard?category=${testCase.category}&period=${testCase.period}&limit=5`,
                    { headers }
                );

                // The response structure is: { success: true, message: "...", data: { leaderboard: [...], period: "...", generatedAt: "..." } }
                const responseData = leaderboardResponse.data.data;
                const { leaderboard, period } = responseData;

                console.log(`   ✅ Success: ${leaderboard.length} drivers found`);
                console.log(`   📈 Period: ${period}`);

                if (leaderboard.length > 0) {
                    console.log('   🏆 Top 3 drivers:');
                    leaderboard.slice(0, 3).forEach((driver, index) => {
                        console.log(`      ${index + 1}. ${driver.name} - ${driver.points} points (${driver.totalDeliveries} deliveries, ₺${driver.totalEarnings})`);
                    });
                } else {
                    console.log('   ⚠️ No drivers found for this period');
                }

            } catch (error) {
                console.log(`   ❌ Failed: ${error.response?.data?.error || error.message}`);
            }
        }

        console.log('\n🎯 Test 3: Testing error handling...');

        // Test invalid category
        try {
            await axios.get(`${baseURL}/admin/leaderboard?category=invalid`, { headers });
            console.log('   ❌ Should have failed with invalid category');
        } catch (error) {
            if (error.response?.status === 400) {
                console.log('   ✅ Properly rejected invalid category');
            } else {
                console.log('   ❌ Unexpected error for invalid category:', error.response?.data?.error || error.message);
            }
        }

        // Test invalid period
        try {
            await axios.get(`${baseURL}/admin/leaderboard?period=invalid`, { headers });
            console.log('   ❌ Should have failed with invalid period');
        } catch (error) {
            if (error.response?.status === 400) {
                console.log('   ✅ Properly rejected invalid period');
            } else {
                console.log('   ❌ Unexpected error for invalid period:', error.response?.data?.error || error.message);
            }
        }

        console.log('\n🎉 Leaderboard endpoint testing completed!');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
}

// Run the test
testLeaderboardEndpoints();
