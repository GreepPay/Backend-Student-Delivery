const mongoose = require('mongoose');
const Delivery = require('./src/models/Delivery');
require('dotenv').config();

const debugRemittanceAPI = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const driverId = '6890dc5a98ce5bc39c4e92b7';
        const startDate = new Date('2025-01-01');
        const endDate = new Date('2025-12-31');

        console.log('🔍 Debugging remittance calculation...');
        console.log('Driver ID:', driverId);
        console.log('Start Date:', startDate);
        console.log('End Date:', endDate);

        // Test the exact query that the remittance service uses
        const cashDeliveries = await Delivery.find({
            assignedTo: driverId,
            status: 'delivered',
            paymentMethod: 'cash',
            deliveredAt: { $gte: startDate, $lte: endDate },
            remittanceStatus: 'pending'
        }).sort({ deliveredAt: 1 });

        console.log(`💰 Found ${cashDeliveries.length} cash deliveries with exact query`);

        // Test each condition separately
        console.log('\n🔍 Testing each condition separately...');

        const byDriver = await Delivery.find({ assignedTo: driverId });
        console.log(`- By driver: ${byDriver.length} deliveries`);

        const byStatus = await Delivery.find({ assignedTo: driverId, status: 'delivered' });
        console.log(`- By status: ${byStatus.length} deliveries`);

        const byPayment = await Delivery.find({ assignedTo: driverId, status: 'delivered', paymentMethod: 'cash' });
        console.log(`- By payment: ${byPayment.length} deliveries`);

        const byDate = await Delivery.find({
            assignedTo: driverId,
            status: 'delivered',
            paymentMethod: 'cash',
            deliveredAt: { $gte: startDate, $lte: endDate }
        });
        console.log(`- By date: ${byDate.length} deliveries`);

        const byRemittance = await Delivery.find({
            assignedTo: driverId,
            status: 'delivered',
            paymentMethod: 'cash',
            deliveredAt: { $gte: startDate, $lte: endDate },
            remittanceStatus: 'pending'
        });
        console.log(`- By remittance status: ${byRemittance.length} deliveries`);

        // Show details of the deliveries found
        if (byRemittance.length > 0) {
            console.log('\n📦 Deliveries found:');
            byRemittance.forEach(delivery => {
                console.log(`  - ${delivery.deliveryCode}: ₺${delivery.fee}, delivered: ${delivery.deliveredAt}, remittance: ${delivery.remittanceStatus}`);
            });
        }

        // Test with different date formats
        console.log('\n📅 Testing with different date formats...');

        const dateFormats = [
            { start: '2025-01-01T00:00:00.000Z', end: '2025-12-31T23:59:59.999Z', label: 'ISO format' },
            { start: '2025-01-01', end: '2025-12-31', label: 'Date only' },
            { start: new Date('2025-01-01'), end: new Date('2025-12-31'), label: 'Date objects' }
        ];

        for (const format of dateFormats) {
            const testDeliveries = await Delivery.find({
                assignedTo: driverId,
                status: 'delivered',
                paymentMethod: 'cash',
                deliveredAt: { $gte: format.start, $lte: format.end },
                remittanceStatus: 'pending'
            });
            console.log(`- ${format.label}: ${testDeliveries.length} deliveries`);
        }

    } catch (error) {
        console.error('❌ Error debugging remittance API:', error);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    }
};

debugRemittanceAPI();
