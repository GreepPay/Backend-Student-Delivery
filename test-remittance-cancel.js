const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => console.error('❌ MongoDB connection error:', err));

const Remittance = require('./src/models/Remittance');

async function testRemittanceCancel() {
    try {
        // Find a pending remittance to test with
        const pendingRemittance = await Remittance.findOne({ status: 'pending' });

        if (!pendingRemittance) {
            console.log('❌ No pending remittances found for testing');
            return;
        }

        console.log('✅ Found pending remittance for testing:', {
            id: pendingRemittance._id,
            referenceNumber: pendingRemittance.referenceNumber,
            amount: pendingRemittance.amount,
            status: pendingRemittance.status
        });

        // Test the cancellation logic
        const testReason = 'Test cancellation - API verification';

        // Update remittance status (simulating the API call)
        pendingRemittance.status = 'cancelled';
        pendingRemittance.cancelledAt = new Date();
        pendingRemittance.cancelledBy = new mongoose.Types.ObjectId(); // Test admin ID
        pendingRemittance.cancelReason = testReason;

        await pendingRemittance.save();

        console.log('✅ Remittance cancelled successfully:', {
            id: pendingRemittance._id,
            status: pendingRemittance.status,
            cancelledAt: pendingRemittance.cancelledAt,
            cancelReason: pendingRemittance.cancelReason
        });

        // Verify the cancellation
        const updatedRemittance = await Remittance.findById(pendingRemittance._id);
        console.log('✅ Verification - Updated remittance:', {
            id: updatedRemittance._id,
            status: updatedRemittance.status,
            cancelledAt: updatedRemittance.cancelledAt,
            cancelReason: updatedRemittance.cancelReason
        });

    } catch (error) {
        console.error('❌ Error testing remittance cancellation:', error);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    }
}

testRemittanceCancel();
