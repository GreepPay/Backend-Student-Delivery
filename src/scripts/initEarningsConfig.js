const mongoose = require('mongoose');
const EarningsConfig = require('../models/EarningsConfig');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const defaultEarningsRules = [
    {
        minFee: 0,
        maxFee: 100,
        driverPercentage: 60,
        driverFixed: null,
        companyPercentage: 40,
        companyFixed: null,
        description: 'Under 100: 60% driver, 40% company'
    },
    {
        minFee: 101,
        maxFee: 150,
        driverPercentage: null,
        driverFixed: 100,
        companyPercentage: null,
        companyFixed: 50,
        description: '100-150: 100 flat fee for driver, 50 for company'
    },
    {
        minFee: 151,
        maxFee: 999999,
        driverPercentage: 60,
        driverFixed: null,
        companyPercentage: 40,
        companyFixed: null,
        description: 'Above 150: 60% driver, 40% company'
    }
];

async function initializeEarningsConfig() {
    try {
        console.log('🔄 Initializing earnings configuration...');

        // Check if there's already an active configuration
        const existingConfig = await EarningsConfig.findOne({ isActive: true });

        if (existingConfig) {
            console.log('⚠️ Active earnings configuration already exists. Skipping initialization.');
            console.log('Current config:', existingConfig.name);
            return;
        }

        // Create new earnings configuration
        const newConfig = new EarningsConfig({
            name: 'Default Earnings Rules - Greep SDS',
            rules: defaultEarningsRules,
            isActive: true,
            effectiveDate: new Date(),
            version: 1,
            notes: 'Initial earnings configuration with Greep SDS fee structure'
        });

        await newConfig.save();

        console.log('✅ Earnings configuration initialized successfully!');
        console.log('📋 Rules applied:');
        defaultEarningsRules.forEach((rule, index) => {
            console.log(`  ${index + 1}. ${rule.description}`);
        });

    } catch (error) {
        console.error('❌ Error initializing earnings configuration:', error);
    } finally {
        mongoose.connection.close();
    }
}

// Run the initialization
initializeEarningsConfig(); 