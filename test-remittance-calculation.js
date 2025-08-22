const mongoose = require('mongoose');
const Delivery = require('./src/models/Delivery');
const RemittanceService = require('./src/services/remittanceService');
require('dotenv').config();

const testRemittanceCalculation = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Test driver ID
        const driverId = '6890dc5a98ce5bc39c4e92b7'; // wisdom agunta

        console.log(`🧪 Testing remittance calculation for driver: ${driverId}`);

        // First, let's check what deliveries exist for this driver
        const allDeliveries = await Delivery.find({
            assignedTo: driverId,
            status: 'delivered'
        }).sort({ deliveredAt: 1 });

        console.log(`📦 Found ${allDeliveries.length} delivered deliveries for driver`);

        allDeliveries.forEach(delivery => {
            console.log(`  - ${delivery.deliveryCode}: ₺${delivery.fee}, delivered: ${delivery.deliveredAt}, payment: ${delivery.paymentMethod}, remittance: ${delivery.remittanceStatus}, driverEarning: ₺${delivery.driverEarning}, companyEarning: ₺${delivery.companyEarning}`);
        });

        // Now let's check what the remittance service finds
        console.log('\n🔍 Checking remittance service query...');

        const cashDeliveries = await Delivery.find({
            assignedTo: driverId,
            status: 'delivered',
            paymentMethod: 'cash',
            deliveredAt: { $gte: new Date('2025-08-01'), $lte: new Date('2025-08-20') },
            remittanceStatus: 'pending'
        }).sort({ deliveredAt: 1 });

        console.log(`💰 Remittance service found ${cashDeliveries.length} cash deliveries`);

        cashDeliveries.forEach(delivery => {
            console.log(`  - ${delivery.deliveryCode}: ₺${delivery.fee}, delivered: ${delivery.deliveredAt}`);
        });

        // Test with different date ranges
        console.log('\n📅 Testing with different date ranges...');

        const dateRanges = [
            { start: '2025-08-01', end: '2025-08-20', label: 'August 1-20' },
            { start: '2025-08-19', end: '2025-08-20', label: 'August 19-20' },
            { start: '2025-01-01', end: '2025-12-31', label: 'All year 2025' },
            { start: '2025-08-19', end: '2025-08-19', label: 'August 19 only' }
        ];

        for (const range of dateRanges) {
            const calculation = await RemittanceService.calculateRemittanceAmount(
                driverId,
                new Date(range.start),
                new Date(range.end)
            );

            console.log(`📊 ${range.label}: ${calculation.deliveryCount} deliveries, ₺${calculation.remittanceAmount} to remit`);
        }

        // Test with no date filter
        console.log('\n🔍 Testing without date filter...');

        const noDateFilter = await Delivery.find({
            assignedTo: driverId,
            status: 'delivered',
            paymentMethod: 'cash',
            remittanceStatus: 'pending'
        });

        console.log(`💰 Found ${noDateFilter.length} cash deliveries without date filter`);

        if (noDateFilter.length > 0) {
            const totalFees = noDateFilter.reduce((sum, d) => sum + d.fee, 0);
            const totalDriverEarnings = noDateFilter.reduce((sum, d) => sum + (d.driverEarning || 0), 0);
            const totalCompanyEarnings = noDateFilter.reduce((sum, d) => sum + (d.companyEarning || 0), 0);

            console.log(`📊 Total fees: ₺${totalFees}`);
            console.log(`📊 Total driver earnings: ₺${totalDriverEarnings}`);
            console.log(`📊 Total company earnings: ₺${totalCompanyEarnings}`);
            console.log(`💰 Should remit: ₺${totalCompanyEarnings}`);
        }

    } catch (error) {
        console.error('❌ Error testing remittance calculation:', error);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    }
};

testRemittanceCalculation();
