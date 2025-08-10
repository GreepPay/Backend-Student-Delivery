const mongoose = require('mongoose');
const Admin = require('./src/models/Admin');
const Driver = require('./src/models/Driver');
require('dotenv').config();

const previewTestAccounts = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/student-delivery');
        console.log('Connected to MongoDB');

        console.log('🔍 Scanning for test accounts (PREVIEW MODE)...\n');

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

        // Find test admins
        console.log('📋 Checking Admin accounts...');
        const allAdmins = await Admin.find({});
        let testAdminsFound = 0;

        for (const admin of allAdmins) {
            const isTestAccount = 
                testEmailPatterns.some(pattern => admin.email.includes(pattern)) ||
                testNamePatterns.some(pattern => admin.name.includes(pattern)) ||
                admin.email === 'admin@test.com' ||
                admin.name === 'Test Admin';

            if (isTestAccount) {
                console.log(`⚠️  Would remove test admin: ${admin.name} (${admin.email})`);
                testAdminsFound++;
            } else {
                console.log(`✅ Would keep admin: ${admin.name} (${admin.email})`);
            }
        }

        // Find test drivers
        console.log('\n📋 Checking Driver accounts...');
        const allDrivers = await Driver.find({});
        let testDriversFound = 0;

        for (const driver of allDrivers) {
            const isTestAccount = 
                testEmailPatterns.some(pattern => driver.email.includes(pattern)) ||
                testNamePatterns.some(pattern => (driver.name || driver.fullName || '').includes(pattern)) ||
                driver.email === 'driver@test.com' ||
                driver.name === 'Test Driver' ||
                driver.fullName === 'Test Driver';

            if (isTestAccount) {
                console.log(`⚠️  Would remove test driver: ${driver.name || driver.fullName} (${driver.email})`);
                testDriversFound++;
            } else {
                console.log(`✅ Would keep driver: ${driver.name || driver.fullName} (${driver.email})`);
            }
        }

        // Summary
        console.log('\n📊 Preview Summary:');
        console.log(`⚠️  Test admins that would be removed: ${testAdminsFound}`);
        console.log(`⚠️  Test drivers that would be removed: ${testDriversFound}`);
        console.log(`📋 Total test accounts that would be removed: ${testAdminsFound + testDriversFound}`);

        if (testAdminsFound + testDriversFound === 0) {
            console.log('\n🎉 No test accounts found! Your database is clean.');
        } else {
            console.log('\n💡 To actually remove these accounts, run: node remove-test-accounts.js');
        }

    } catch (error) {
        console.error('❌ Error previewing test accounts:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nDisconnected from MongoDB');
    }
};

previewTestAccounts();
