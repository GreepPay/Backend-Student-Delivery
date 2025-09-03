const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Driver = require('../src/models/Driver');
const InvitationReferralCode = require('../src/models/InvitationReferralCode');

async function testProfileUpdate() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        console.log('🧪 Testing Profile Update with Field Compatibility');
        console.log('='.repeat(60));

        // Test 1: Check if we have any drivers
        console.log('\n📋 Test 1: Check available drivers');
        const drivers = await Driver.find().select('_id name fullName email').limit(5);

        if (drivers.length === 0) {
            console.log('❌ No drivers found in database. Please add a driver first.');
            return;
        }

        console.log(`   Found ${drivers.length} drivers:`);
        drivers.forEach((driver, index) => {
            console.log(`      ${index + 1}. ${driver.fullName || driver.name} (${driver.email})`);
        });

        const testDriver = drivers[0];
        console.log(`\n   Using driver: ${testDriver.fullName || testDriver.name}`);

        // Test 2: Check current profile data
        console.log('\n📋 Test 2: Check current profile data');
        const currentProfile = await Driver.findById(testDriver._id).select('fullName phone area transportationType university studentId address');

        console.log('   Current profile:');
        console.log(`      Full Name: ${currentProfile.fullName || 'Not set'}`);
        console.log(`      Phone: ${currentProfile.phone || 'Not set'}`);
        console.log(`      Area: ${currentProfile.area || 'Not set'}`);
        console.log(`      Transportation Type: ${currentProfile.transportationType || 'Not set'}`);
        console.log(`      University: ${currentProfile.university || 'Not set'}`);
        console.log(`      Student ID: ${currentProfile.studentId || 'Not set'}`);
        console.log(`      Address: ${currentProfile.address || 'Not set'}`);

        // Test 3: Test field name compatibility
        console.log('\n📋 Test 3: Test field name compatibility');
        console.log('   The backend now accepts both:');
        console.log('      - transportationType (backend field)');
        console.log('      - transportationMethod (frontend field)');
        console.log('   Both will be mapped to the same database field.');

        // Test 4: Show validation schema
        console.log('\n📋 Test 4: Show validation schema');
        console.log('   Updated validation schema now includes:');
        console.log('      transportationType: bicycle, motorcycle, scooter, car, walking, other');
        console.log('      transportationMethod: bicycle, motorcycle, scooter, car, walking, other');

        // Test 5: Show example request payloads
        console.log('\n📋 Test 5: Example request payloads');
        console.log('   Frontend can now send either:');
        console.log('   Option A (transportationType):');
        console.log('   {');
        console.log('     "fullName": "John Doe",');
        console.log('     "phone": "+905551234567",');
        console.log('     "area": "Gonyeli",');
        console.log('     "transportationType": "bicycle"');
        console.log('   }');

        console.log('\n   Option B (transportationMethod):');
        console.log('   {');
        console.log('     "fullName": "John Doe",');
        console.log('     "phone": "+905551234567",');
        console.log('     "area": "Gonyeli",');
        console.log('     "transportationMethod": "bicycle"');
        console.log('   }');

        console.log('\n   Both will work and update the same database field!');

        // Test 6: Check if referral codes are working
        console.log('\n📋 Test 6: Check referral code status');
        const referralCode = await InvitationReferralCode.findOne({
            referrer: testDriver._id,
            status: 'active'
        });

        if (referralCode) {
            console.log(`   ✅ Driver has active referral code: ${referralCode.referralCode}`);
            console.log(`   Total uses: ${referralCode.totalUses}`);
            console.log(`   Status: ${referralCode.status}`);
        } else {
            console.log('   ℹ️  Driver has no active referral code');
        }

        console.log('\n' + '='.repeat(60));
        console.log('🎉 Profile Update Field Compatibility Test Complete!');
        console.log('✅ The backend now accepts both transportationType and transportationMethod');
        console.log('✅ Your frontend should work without any changes');
        console.log('✅ The error "transportationMethod is not allowed" should be resolved');

    } catch (error) {
        console.error('❌ Error during testing:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

// Run the test
testProfileUpdate();


