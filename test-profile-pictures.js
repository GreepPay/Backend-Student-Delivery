const axios = require('axios');

async function testProfilePictures() {
    try {
        console.log('🧪 Testing profile picture data in dashboard...');

        // Test the dashboard endpoint
        const dashboardResponse = await axios.get('http://localhost:3001/api/admin/dashboard', {
            headers: {
                'Authorization': 'Bearer test-token-for-demo'
            }
        });

        console.log('✅ Dashboard response received');

        const { topDrivers, recentDeliveries } = dashboardResponse.data.data;

        console.log('\n📊 Top Drivers Profile Pictures:');
        topDrivers.forEach((driver, index) => {
            console.log(`${index + 1}. ${driver.name}:`);
            console.log(`   - profilePicture: ${driver.profilePicture || 'undefined'}`);
            console.log(`   - profileImage: ${driver.profileImage || 'undefined'}`);
            console.log(`   - avatar: ${driver.avatar || 'undefined'}`);
            console.log(`   - image: ${driver.image || 'undefined'}`);
        });

        console.log('\n📦 Recent Deliveries Driver Profile Pictures:');
        recentDeliveries.forEach((delivery, index) => {
            if (delivery.assignedTo) {
                console.log(`${index + 1}. ${delivery.assignedTo.name}:`);
                console.log(`   - profilePicture: ${delivery.assignedTo.profilePicture || 'undefined'}`);
                console.log(`   - profileImage: ${delivery.assignedTo.profileImage || 'undefined'}`);
                console.log(`   - avatar: ${delivery.assignedTo.avatar || 'undefined'}`);
                console.log(`   - image: ${delivery.assignedTo.image || 'undefined'}`);
            } else {
                console.log(`${index + 1}. No driver assigned`);
            }
        });

        // Test the driver status endpoint
        console.log('\n🚗 Testing driver status endpoint...');
        const statusResponse = await axios.get('http://localhost:3001/api/admin/drivers/status', {
            headers: {
                'Authorization': 'Bearer test-token-for-demo'
            }
        });

        console.log('✅ Driver status response received');

        const { drivers } = statusResponse.data.data;

        console.log('\n👥 Driver Status Profile Pictures:');
        drivers.slice(0, 5).forEach((driver, index) => {
            console.log(`${index + 1}. ${driver.name}:`);
            console.log(`   - profilePicture: ${driver.profilePicture || 'undefined'}`);
            console.log(`   - profileImage: ${driver.profileImage || 'undefined'}`);
            console.log(`   - avatar: ${driver.avatar || 'undefined'}`);
            console.log(`   - image: ${driver.image || 'undefined'}`);
        });

        console.log('\n🎉 Profile picture test completed!');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
}

// Run the test
testProfilePictures();
