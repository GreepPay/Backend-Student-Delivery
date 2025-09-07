const mongoose = require('mongoose');
const Driver = require('../src/models/Driver');
require('dotenv').config();

async function fixDocumentMigration() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Get all drivers
        const drivers = await Driver.find({});
        console.log(`📊 Found ${drivers.length} drivers to process`);

        let updatedCount = 0;

        for (const driver of drivers) {
            let needsUpdate = false;
            const updateData = {};

            console.log(`\n🔍 Processing driver: ${driver.fullName || driver.name || driver.email}`);
            console.log(`📄 Current documents:`, Object.keys(driver.documents || {}));

            // Check if driver has old document types
            if (driver.documents) {
                // Remove universityEnrollment completely
                if (driver.documents.universityEnrollment) {
                    console.log(`🗑️  Removing universityEnrollment document`);
                    if (!updateData['$unset']) {
                        updateData['$unset'] = {};
                    }
                    updateData['$unset']['documents.universityEnrollment'] = '';
                    needsUpdate = true;
                }

                // Remove identityCard completely (should have been migrated to passportPhoto)
                if (driver.documents.identityCard) {
                    console.log(`🗑️  Removing identityCard document (migrated to passportPhoto)`);
                    if (!updateData['$unset']) {
                        updateData['$unset'] = {};
                    }
                    updateData['$unset']['documents.identityCard'] = '';
                    needsUpdate = true;
                }

                // Remove any other old document types
                const validDocumentTypes = ['studentId', 'profilePhoto', 'passportPhoto'];
                const currentDocumentTypes = Object.keys(driver.documents);

                for (const docType of currentDocumentTypes) {
                    if (!validDocumentTypes.includes(docType)) {
                        console.log(`🗑️  Removing invalid document type: ${docType}`);
                        if (!updateData['$unset']) {
                            updateData['$unset'] = {};
                        }
                        updateData['$unset'][`documents.${docType}`] = '';
                        needsUpdate = true;
                    }
                }
            }

            // Update the driver if needed
            if (needsUpdate) {
                await Driver.findByIdAndUpdate(driver._id, updateData);
                updatedCount++;
                console.log(`✅ Updated driver: ${driver.fullName || driver.name || driver.email}`);
            } else {
                console.log(`✅ No changes needed for driver: ${driver.fullName || driver.name || driver.email}`);
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
        console.log(`Document structure cleaned up - only valid types remain`);

        // Disconnect from MongoDB
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');

    } catch (error) {
        console.error('❌ Error during migration:', error);
        process.exit(1);
    }
}

// Run the migration
fixDocumentMigration();

