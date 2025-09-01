const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const InvitationReferralCode = require('../src/models/InvitationReferralCode');
const Driver = require('../src/models/Driver');

async function migrateReferralCodes() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        console.log('🔄 Starting referral code migration...');
        console.log('='.repeat(60));

        // Find all existing referral codes
        const existingCodes = await InvitationReferralCode.find({});
        console.log(`📋 Found ${existingCodes.length} existing referral codes`);

        let migratedCount = 0;
        let skippedCount = 0;

        for (const code of existingCodes) {
            console.log(`\n🔍 Processing: ${code.referralCode}`);

            // Check if this code needs migration
            const needsMigration = code.expiresAt || code.status === 'used' || code.status === 'expired';

            if (needsMigration) {
                console.log(`   Status: ${code.status} -> active`);

                // Convert old usage data to new format
                if (code.usedBy && code.usedAt) {
                    const usedByDriver = await Driver.findById(code.usedBy).select('name email');
                    if (usedByDriver) {
                        code.usageHistory = [{
                            usedBy: code.usedBy,
                            usedAt: code.usedAt,
                            driverName: usedByDriver.name,
                            driverEmail: usedByDriver.email
                        }];
                        code.totalUses = 1;
                        console.log(`   Converted usage: ${usedByDriver.name} (${usedByDriver.email})`);
                    }
                }

                // Remove old fields
                code.expiresAt = undefined;
                code.usedAt = undefined;
                code.usedBy = undefined;
                code.status = 'active';

                await code.save();
                migratedCount++;
                console.log(`   ✅ Migrated successfully`);
            } else {
                console.log(`   Status: ${code.status} (no migration needed)`);
                skippedCount++;
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('📊 Migration Summary:');
        console.log(`   Total codes processed: ${existingCodes.length}`);
        console.log(`   Codes migrated: ${migratedCount}`);
        console.log(`   Codes skipped: ${skippedCount}`);

        if (migratedCount > 0) {
            console.log('\n✅ Migration completed successfully!');
            console.log('🎉 All referral codes are now permanent and reusable.');
        } else {
            console.log('\nℹ️  No migration needed - codes are already in the new format.');
        }

        // Show some examples of the new system
        console.log('\n📋 Example of new permanent referral codes:');
        const activeCodes = await InvitationReferralCode.find({ status: 'active' })
            .populate('referrer', 'name email')
            .limit(5);

        activeCodes.forEach(code => {
            console.log(`   ${code.referralCode} (${code.referrer?.name}) - Uses: ${code.totalUses}`);
        });

    } catch (error) {
        console.error('❌ Error during migration:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

// Run the migration
migrateReferralCodes();
