require('dotenv').config();
const mongoose = require('mongoose');
const SystemSettings = require('../src/models/SystemSettings');

async function initializeSystemSettings() {
    try {
        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('Connected to MongoDB');

        // Check if settings already exist
        const existingSettings = await SystemSettings.findOne();

        if (existingSettings) {
            console.log('System settings already exist. Skipping initialization.');
            return;
        }

        // Create default system settings
        const defaultSettings = new SystemSettings({
            updatedBy: '000000000000000000000000' // Default admin ID
        });

        await defaultSettings.save();

        console.log('✅ System settings initialized successfully!');
        console.log('Default settings created with:');
        console.log('- Currency: TRY (₺)');
        console.log('- Language: English');
        console.log('- Timezone: Europe/Istanbul');
        console.log('- Commission Rate: 80%');
        console.log('- Minimum Payout: 100₺');
        console.log('- Max Active Deliveries: 5');
        console.log('- Driver Rating: Enabled');
        console.log('- Sound Notifications: Enabled');

    } catch (error) {
        console.error('❌ Error initializing system settings:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

// Run the initialization if this script is executed directly
if (require.main === module) {
    initializeSystemSettings();
}

module.exports = initializeSystemSettings; 