const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => console.error('❌ MongoDB connection error:', err));

const Remittance = require('./src/models/Remittance');
const Driver = require('./src/models/Driver');

async function createTestRemittance() {
    try {
        // Find a driver
        const driver = await Driver.findOne();
        if (!driver) {
            console.log('❌ No drivers found');
            return;
        }

        console.log('✅ Found driver:', driver.name || driver.fullName);

        // Create a test remittance
        const testRemittance = new Remittance({
            driverId: driver._id,
            driverName: driver.name || driver.fullName || 'Test Driver',
            driverEmail: driver.email,
            driverPhone: driver.phone,
            amount: 100,
            status: 'pending',
            paymentMethod: 'cash',
            referenceNumber: `REM-TEST-${Date.now()}`,
            description: 'Test remittance for completion testing',
            handledBy: new mongoose.Types.ObjectId(), // Test admin ID
            handledByName: 'Test Admin',
            handledByEmail: 'test@example.com',
            deliveryIds: [],
            deliveryCount: 0,
            totalDeliveryFees: 200,
            totalDriverEarnings: 100,
            totalCompanyEarnings: 100,
            period: {
                startDate: new Date(),
                endDate: new Date()
            },
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
            createdBy: new mongoose.Types.ObjectId() // Test admin ID
        });

        await testRemittance.save();

        console.log('✅ Test remittance created:', {
            id: testRemittance._id,
            referenceNumber: testRemittance.referenceNumber,
            amount: testRemittance.amount,
            status: testRemittance.status
        });

    } catch (error) {
        console.error('❌ Error creating test remittance:', error);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    }
}

createTestRemittance();
