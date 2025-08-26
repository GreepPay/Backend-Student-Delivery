const mongoose = require('mongoose');
const Driver = require('../src/models/Driver');
require('dotenv').config();

async function fixDocumentVerification() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Get all drivers
        const drivers = await Driver.find({});
        console.log(`📊 Found ${drivers.length} drivers to process`);

        let updatedCount = 0;
        let verifiedCount = 0;

        for (const driver of drivers) {
            // Check if all required documents are verified
            const allDocumentsVerified = driver.documents?.studentId?.status === 'verified' &&
                driver.documents?.profilePhoto?.status === 'verified' &&
                driver.documents?.identityCard?.status === 'verified' &&
                driver.documents?.universityEnrollment?.status === 'verified';

            // Update isDocumentVerified field if it's different
            if (driver.isDocumentVerified !== allDocumentsVerified) {
                driver.isDocumentVerified = allDocumentsVerified;
                await driver.save();
                updatedCount++;

                if (allDocumentsVerified) {
                    verifiedCount++;
                    console.log(`✅ Updated ${driver.fullName || driver.name || driver.email} - Documents verified`);
                } else {
                    console.log(`⚠️  Updated ${driver.fullName || driver.name || driver.email} - Documents not verified`);
                }
            } else if (allDocumentsVerified) {
                verifiedCount++;
                console.log(`✅ ${driver.fullName || driver.name || driver.email} - Already correctly marked as verified`);
            }
        }

        console.log('\n📊 Migration Summary:');
        console.log(`Total drivers processed: ${drivers.length}`);
        console.log(`Drivers updated: ${updatedCount}`);
        console.log(`Total verified drivers: ${verifiedCount}`);
        console.log(`Verification rate: ${((verifiedCount / drivers.length) * 100).toFixed(1)}%`);

        // Disconnect from MongoDB
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');

    } catch (error) {
        console.error('❌ Error during migration:', error);
        process.exit(1);
    }
}

// Run the migration
fixDocumentVerification();
