const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/student-delivery', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// Import Driver model
const Driver = require('./src/models/Driver');

async function debugDriverStatus() {
    try {
        console.log('🔍 Debugging Driver Status...\n');

        // Get all drivers
        const drivers = await Driver.find({}).limit(5);
        console.log(`Found ${drivers.length} drivers\n`);

        drivers.forEach((driver, index) => {
            console.log(`Driver ${index + 1}: ${driver.name || driver.fullName}`);
            console.log(`  - isOnline: ${driver.isOnline}`);
            console.log(`  - isActive: ${driver.isActive}`);
            console.log(`  - isSuspended: ${driver.isSuspended}`);

            // Compute status using the same logic as the controller
            let status = 'offline';
            if (driver.isSuspended) {
                status = 'suspended';
            } else if (driver.isOnline && driver.isActive) {
                status = 'online';
            } else if (driver.isActive) {
                status = 'offline';
            } else {
                status = 'inactive';
            }

            console.log(`  - Computed Status: ${status}`);
            console.log('');
        });

        // Test the status computation logic
        console.log('🧪 Testing Status Logic:');
        const testCases = [
            { isOnline: true, isActive: true, isSuspended: false, expected: 'online' },
            { isOnline: false, isActive: true, isSuspended: false, expected: 'offline' },
            { isOnline: true, isActive: false, isSuspended: false, expected: 'inactive' },
            { isOnline: false, isActive: false, isSuspended: false, expected: 'inactive' },
            { isOnline: true, isActive: true, isSuspended: true, expected: 'suspended' },
        ];

        testCases.forEach((testCase, index) => {
            let status = 'offline';
            if (testCase.isSuspended) {
                status = 'suspended';
            } else if (testCase.isOnline && testCase.isActive) {
                status = 'online';
            } else if (testCase.isActive) {
                status = 'offline';
            } else {
                status = 'inactive';
            }

            const passed = status === testCase.expected;
            console.log(`  Test ${index + 1}: ${passed ? '✅' : '❌'} ${status} (expected: ${testCase.expected})`);
        });

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        mongoose.connection.close();
    }
}

debugDriverStatus();
