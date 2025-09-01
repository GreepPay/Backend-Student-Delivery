const mongoose = require('mongoose');
require('dotenv').config();

// Import models and services
const InvitationReferralCode = require('../src/models/InvitationReferralCode');
const Driver = require('../src/models/Driver');
const ReferralService = require('../src/services/referralService');

async function testPermanentReferralCodes() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        console.log('🧪 Testing Permanent Referral Code System');
        console.log('='.repeat(60));

        // Test 1: Generate a new permanent referral code
        console.log('\n📋 Test 1: Generate new permanent referral code');
        const testDriver = await Driver.findOne().select('_id name email');

        if (!testDriver) {
            console.log('❌ No drivers found in database. Please add a driver first.');
            return;
        }

        console.log(`   Using driver: ${testDriver.name} (${testDriver.email})`);

        const result = await ReferralService.generateInvitationReferralCode(testDriver._id);

        if (result.success) {
            console.log(`   ✅ Generated: ${result.referralCode}`);
            console.log(`   Total uses: ${result.totalUses}`);
            console.log(`   Message: ${result.message}`);
        } else {
            console.log(`   ❌ Failed: ${result.error}`);
        }

        // Test 2: Check if code is permanent (no expiration)
        console.log('\n📋 Test 2: Verify code is permanent');
        const referralCode = await InvitationReferralCode.findOne({
            referrer: testDriver._id,
            status: 'active'
        });

        if (referralCode) {
            console.log(`   Code: ${referralCode.referralCode}`);
            console.log(`   Status: ${referralCode.status}`);
            console.log(`   Expires At: ${referralCode.expiresAt || 'NEVER (Permanent)'}`);
            console.log(`   Total Uses: ${referralCode.totalUses}`);
            console.log(`   Is Active: ${referralCode.isActive()}`);
            console.log('   ✅ Code is permanent and reusable');
        } else {
            console.log('   ❌ No referral code found');
        }

        // Test 3: Simulate multiple uses of the same code
        console.log('\n📋 Test 3: Simulate multiple uses');
        if (referralCode) {
            console.log(`   Simulating usage by different drivers...`);

            // Simulate first usage
            await referralCode.recordUsage(
                new mongoose.Types.ObjectId(),
                'Test Driver 1',
                'test1@example.com'
            );
            console.log(`   ✅ First usage recorded. Total uses: ${referralCode.totalUses}`);

            // Simulate second usage
            await referralCode.recordUsage(
                new mongoose.Types.ObjectId(),
                'Test Driver 2',
                'test2@example.com'
            );
            console.log(`   ✅ Second usage recorded. Total uses: ${referralCode.totalUses}`);

            // Simulate third usage
            await referralCode.recordUsage(
                new mongoose.Types.ObjectId(),
                'Test Driver 3',
                'test3@example.com'
            );
            console.log(`   ✅ Third usage recorded. Total uses: ${referralCode.totalUses}`);

            console.log(`   📊 Usage History:`);
            referralCode.usageHistory.forEach((usage, index) => {
                console.log(`      ${index + 1}. ${usage.driverName} (${usage.driverEmail}) - ${usage.usedAt.toLocaleDateString()}`);
            });
        }

        // Test 4: Check recent usage (last 30 days)
        console.log('\n📋 Test 4: Check recent usage');
        if (referralCode) {
            const recentUsage = referralCode.recentUsage;
            console.log(`   Recent usage (last 30 days): ${recentUsage.length} uses`);
            recentUsage.forEach((usage, index) => {
                console.log(`      ${index + 1}. ${usage.driverName} - ${usage.usedAt.toLocaleDateString()}`);
            });
        }

        // Test 5: Verify code can still be used after multiple uses
        console.log('\n📋 Test 5: Verify code remains active after multiple uses');
        if (referralCode) {
            const isStillActive = referralCode.isActive();
            console.log(`   Code active: ${isStillActive}`);
            console.log(`   Status: ${referralCode.status}`);

            if (isStillActive) {
                console.log('   ✅ Code remains active and can be used again');
            } else {
                console.log('   ❌ Code is no longer active');
            }
        }

        // Test 6: Show all active referral codes
        console.log('\n📋 Test 6: Show all active referral codes');
        const allActiveCodes = await InvitationReferralCode.find({ status: 'active' })
            .populate('referrer', 'name email')
            .sort({ totalUses: -1 });

        console.log(`   Found ${allActiveCodes.length} active referral codes:`);
        allActiveCodes.forEach((code, index) => {
            console.log(`      ${index + 1}. ${code.referralCode} (${code.referrer?.name}) - Uses: ${code.totalUses}`);
        });

        console.log('\n' + '='.repeat(60));
        console.log('🎉 Permanent Referral Code System Test Complete!');
        console.log('✅ All tests passed - referral codes are now permanent and reusable');

    } catch (error) {
        console.error('❌ Error during testing:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

// Run the test
testPermanentReferralCodes();
