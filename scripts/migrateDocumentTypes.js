const mongoose = require('mongoose');
const Driver = require('../src/models/Driver');
require('dotenv').config();

async function migrateDocumentTypes() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Get all drivers
        const drivers = await Driver.find({});
        console.log(`📊 Found ${drivers.length} drivers to process`);

        let updatedCount = 0;
        let identityCardCount = 0;
        let universityEnrollmentCount = 0;

        for (const driver of drivers) {
            let needsUpdate = false;
            const updateData = {};

            // Check if driver has identityCard document
            if (driver.documents && driver.documents.identityCard) {
                console.log(`🔄 Migrating identityCard to passportPhoto for driver: ${driver.fullName || driver.name || driver.email}`);

                // Move identityCard to passportPhoto
                updateData['documents.passportPhoto'] = driver.documents.identityCard;
                updateData['$unset'] = { 'documents.identityCard': '' };
                needsUpdate = true;
                identityCardCount++;
            }

            // Check if driver has universityEnrollment document
            if (driver.documents && driver.documents.universityEnrollment) {
                console.log(`🗑️  Removing universityEnrollment document for driver: ${driver.fullName || driver.name || driver.email}`);

                // Remove universityEnrollment
                if (!updateData['$unset']) {
                    updateData['$unset'] = {};
                }
                updateData['$unset']['documents.universityEnrollment'] = '';
                needsUpdate = true;
                universityEnrollmentCount++;
            }

            // Update the driver if needed
            if (needsUpdate) {
                await Driver.findByIdAndUpdate(driver._id, updateData);
                updatedCount++;
                console.log(`✅ Updated driver: ${driver.fullName || driver.name || driver.email}`);
            }
        }

        // Now recalculate verification status for all drivers
        console.log('\n🔄 Recalculating verification status for all drivers...');
        const allDrivers = await Driver.find({});

        for (const driver of allDrivers) {
            // Check if all required documents are verified (3 documents now)
            const allDocumentsVerified = driver.documents?.studentId?.status === 'verified' &&
                driver.documents?.profilePhoto?.status === 'verified' &&
                driver.documents?.passportPhoto?.status === 'verified';

            // Update isDocumentVerified field if it's different
            if (driver.isDocumentVerified !== allDocumentsVerified) {
                driver.isDocumentVerified = allDocumentsVerified;
                await driver.save();
                console.log(`🔄 Updated verification status for: ${driver.fullName || driver.name || driver.email} - ${allDocumentsVerified ? 'VERIFIED' : 'NOT VERIFIED'}`);
            }
        }

        console.log('\n📊 Migration Summary:');
        console.log(`Total drivers processed: ${drivers.length}`);
        console.log(`Drivers updated: ${updatedCount}`);
        console.log(`Identity cards migrated to passport photos: ${identityCardCount}`);
        console.log(`University enrollment documents removed: ${universityEnrollmentCount}`);
        console.log(`Document structure updated from 4/4 to 3/3`);

        // Disconnect from MongoDB
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');

    } catch (error) {
        console.error('❌ Error during migration:', error);
        process.exit(1);
    }
}

// Run the migration
migrateDocumentTypes();

