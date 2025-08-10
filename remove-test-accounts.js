const mongoose = require('mongoose');
const Admin = require('./src/models/Admin');
const Driver = require('./src/models/Driver');
require('dotenv').config();

const removeTestAccounts = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/student-delivery');
        console.log('Connected to MongoDB');

        console.log('🔍 Scanning for test accounts...\n');

        // Define test account patterns
        const testEmailPatterns = [
            'test@',
            'admin@test.com',
            'driver@test.com',
            'demo@',
            'example@',
            'sample@',
            'fake@',
            'mock@'
        ];

        const testNamePatterns = [
            'Test',
            'Demo',
            'Example',
            'Sample',
            'Fake',
            'Mock',
            'Dummy'
        ];

        // Find and remove test admins
        console.log('📋 Checking Admin accounts...');
        const allAdmins = await Admin.find({});
        let testAdminsRemoved = 0;

        for (const admin of allAdmins) {
            const isTestAccount = 
                testEmailPatterns.some(pattern => admin.email.includes(pattern)) ||
                testNamePatterns.some(pattern => admin.name.includes(pattern)) ||
                admin.email === 'admin@test.com' ||
                admin.name === 'Test Admin';

            if (isTestAccount) {
                console.log(`❌ Removing test admin: ${admin.name} (${admin.email})`);
                await Admin.findByIdAndDelete(admin._id);
                testAdminsRemoved++;
            } else {
                console.log(`✅ Keeping admin: ${admin.name} (${admin.email})`);
            }
        }

        // Find and remove test drivers
        console.log('\n📋 Checking Driver accounts...');
        const allDrivers = await Driver.find({});
        let testDriversRemoved = 0;

        for (const driver of allDrivers) {
            const isTestAccount = 
                testEmailPatterns.some(pattern => driver.email.includes(pattern)) ||
                testNamePatterns.some(pattern => (driver.name || driver.fullName || '').includes(pattern)) ||
                driver.email === 'driver@test.com' ||
                driver.name === 'Test Driver' ||
                driver.fullName === 'Test Driver';

            if (isTestAccount) {
                console.log(`❌ Removing test driver: ${driver.name || driver.fullName} (${driver.email})`);
                await Driver.findByIdAndDelete(driver._id);
                testDriversRemoved++;
            } else {
                console.log(`✅ Keeping driver: ${driver.name || driver.fullName} (${driver.email})`);
            }
        }

        // Summary
        console.log('\n📊 Summary:');
        console.log(`✅ Test admins removed: ${testAdminsRemoved}`);
        console.log(`✅ Test drivers removed: ${testDriversRemoved}`);
        console.log(`📋 Total test accounts removed: ${testAdminsRemoved + testDriversRemoved}`);

        if (testAdminsRemoved + testDriversRemoved === 0) {
            console.log('\n🎉 No test accounts found! Your database is clean.');
        } else {
            console.log('\n🧹 Database cleanup completed successfully!');
        }

    } catch (error) {
        console.error('❌ Error removing test accounts:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nDisconnected from MongoDB');
    }
};

// Add confirmation prompt
const readline = require('readline');
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('🚨 WARNING: This will permanently delete test accounts from your database!');
console.log('This action cannot be undone.\n');

rl.question('Are you sure you want to continue? (yes/no): ', (answer) => {
    if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
        console.log('\n🔄 Starting test account removal...\n');
        removeTestAccounts().then(() => {
            rl.close();
        });
    } else {
        console.log('❌ Operation cancelled.');
        rl.close();
    }
});
