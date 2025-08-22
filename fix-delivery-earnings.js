const mongoose = require('mongoose');
const Delivery = require('./src/models/Delivery');
const EarningsService = require('./src/services/earningsService');
require('dotenv').config();

const fixDeliveryEarnings = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Find all delivered deliveries that don't have earnings calculated
        const deliveredDeliveries = await Delivery.find({
            status: 'delivered',
            $or: [
                { driverEarning: { $exists: false } },
                { driverEarning: 0 },
                { companyEarning: { $exists: false } },
                { companyEarning: 0 }
            ]
        });

        console.log(`📦 Found ${deliveredDeliveries.length} delivered deliveries without earnings calculated`);

        if (deliveredDeliveries.length === 0) {
            console.log('✅ All delivered deliveries already have earnings calculated');
            return;
        }

        let updatedCount = 0;
        let errorCount = 0;

        for (const delivery of deliveredDeliveries) {
            try {
                console.log(`💰 Calculating earnings for delivery ${delivery.deliveryCode} (₺${delivery.fee})`);

                // Calculate earnings
                const earnings = await EarningsService.calculateEarnings(delivery.fee);

                // Update delivery with earnings
                await Delivery.findByIdAndUpdate(delivery._id, {
                    driverEarning: earnings.driverEarning,
                    companyEarning: earnings.companyEarning
                });

                console.log(`✅ Updated delivery ${delivery.deliveryCode}: Driver ₺${earnings.driverEarning}, Company ₺${earnings.companyEarning}`);
                updatedCount++;
            } catch (error) {
                console.error(`❌ Error updating delivery ${delivery.deliveryCode}:`, error.message);
                errorCount++;
            }
        }

        console.log('\n📊 Summary:');
        console.log(`✅ Successfully updated: ${updatedCount} deliveries`);
        console.log(`❌ Errors: ${errorCount} deliveries`);
        console.log(`💰 Total processed: ${deliveredDeliveries.length} deliveries`);

        // Now let's test the remittance calculation for a driver
        console.log('\n🧪 Testing remittance calculation...');

        // Get a driver with completed deliveries
        const driverWithDeliveries = await Delivery.aggregate([
            { $match: { status: 'delivered', driverEarning: { $gt: 0 } } },
            { $group: { _id: '$assignedTo', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 1 }
        ]);

        if (driverWithDeliveries.length > 0) {
            const driverId = driverWithDeliveries[0]._id;
            console.log(`🧪 Testing remittance for driver: ${driverId}`);

            const RemittanceService = require('./src/services/remittanceService');
            const calculation = await RemittanceService.calculateRemittanceAmount(
                driverId,
                new Date('2025-08-01'),
                new Date('2025-08-20')
            );

            console.log('🧪 Remittance calculation result:', {
                deliveryCount: calculation.deliveryCount,
                totalDeliveryFees: calculation.totalDeliveryFees,
                totalDriverEarnings: calculation.totalDriverEarnings,
                totalCompanyEarnings: calculation.totalCompanyEarnings,
                remittanceAmount: calculation.remittanceAmount,
                message: calculation.message
            });
        }

    } catch (error) {
        console.error('❌ Error fixing delivery earnings:', error);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    }
};

fixDeliveryEarnings();
