const mongoose = require('mongoose');
const EarningsConfig = require('../models/EarningsConfig');
require('dotenv').config();

const defaultEarningsRules = [
    {
        minFee: 0,
        maxFee: 100,
        driverPercentage: 60,
        driverFixed: null,
        companyPercentage: 40,
        companyFixed: null,
        description: 'Deliveries up to ₺100: 60% to driver, 40% to company'
    },
    {
        minFee: 101,
        maxFee: 150,
        driverPercentage: null,
        driverFixed: 100,
        companyPercentage: null,
        companyFixed: 50,
        description: 'Deliveries ₺101-₺150: ₺100 to driver, ₺50 to company'
    },
    {
        minFee: 151,
        maxFee: 999999,
        driverPercentage: 60,
        driverFixed: null,
        companyPercentage: 40,
        companyFixed: null,
        description: 'Deliveries over ₺150: 60% to driver, 40% to company'
    }
];

async function initializeEarningsConfig() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('Connected to MongoDB');

        // Check if there's already an active configuration
        const existingConfig = await EarningsConfig.findOne({ isActive: true });

        if (existingConfig) {
            console.log('Active earnings configuration already exists. Skipping initialization.');
            console.log('Current active config:', existingConfig.name);
            return;
        }

        // Create default configuration
        const defaultConfig = new EarningsConfig({
            name: 'Default Earnings Rules',
            rules: defaultEarningsRules,
            isActive: true,
            createdBy: null, // Will be set by admin when they first access
            notes: 'Default earnings configuration created during system initialization',
            effectiveDate: new Date()
        });

        // Validate the configuration
        defaultConfig.validateRules();

        // Save the configuration
        await defaultConfig.save();

        console.log('✅ Default earnings configuration created successfully!');
        console.log('📋 Rules:');
        defaultEarningsRules.forEach((rule, index) => {
            console.log(`   ${index + 1}. ₺${rule.minFee}-₺${rule.maxFee}: ${rule.driverPercentage ? `${rule.driverPercentage}%` : `₺${rule.driverFixed}`} to driver`);
        });

    } catch (error) {
        console.error('❌ Error initializing earnings configuration:', error.message);
        throw error;
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

// Run the initialization if this script is executed directly
if (require.main === module) {
    initializeEarningsConfig()
        .then(() => {
            console.log('🎉 Earnings configuration initialization completed!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Initialization failed:', error);
            process.exit(1);
        });
}

module.exports = { initializeEarningsConfig }; 