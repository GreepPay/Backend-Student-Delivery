require('dotenv').config();
const mongoose = require('mongoose');
const Driver = require('../src/models/Driver');

// Connect to MongoDB
const connectDB = async () => {
    try {
        if (!process.env.MONGODB_URI) {
            console.error('❌ MONGODB_URI environment variable is not set');
            process.exit(1);
        }

        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
};

// Migration function to update Kucuk data
const migrateKucukData = async () => {
    try {
        console.log('🔄 Starting migration of Kucuk data...');

        // Find all drivers with Kucuk in area or address
        const driversWithKucuk = await Driver.find({
            $or: [
                { area: 'Kucuk' },
                { address: 'Kucuk' }
            ]
        });

        console.log(`📊 Found ${driversWithKucuk.length} drivers with Kucuk data`);

        if (driversWithKucuk.length === 0) {
            console.log('✅ No drivers with Kucuk data found. Migration complete.');
            return;
        }

        // Update each driver
        let updatedCount = 0;
        for (const driver of driversWithKucuk) {
            const updates = {};

            if (driver.area === 'Kucuk') {
                updates.area = 'Terminal/City Center'; // Default to Terminal/City Center
            }

            if (driver.address === 'Kucuk') {
                updates.address = 'Terminal/City Center'; // Default to Terminal/City Center
            }

            if (Object.keys(updates).length > 0) {
                await Driver.findByIdAndUpdate(driver._id, updates);
                console.log(`✅ Updated driver ${driver._id}: ${JSON.stringify(updates)}`);
                updatedCount++;
            }
        }

        console.log(`🎉 Migration complete! Updated ${updatedCount} drivers.`);

    } catch (error) {
        console.error('❌ Migration error:', error);
        throw error;
    }
};

// Main execution
const main = async () => {
    try {
        await connectDB();
        await migrateKucukData();
        console.log('✅ Migration completed successfully');
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        console.log('🔌 Database connection closed');
    }
};

// Run migration if this script is executed directly
if (require.main === module) {
    main();
}

module.exports = { migrateKucukData };
