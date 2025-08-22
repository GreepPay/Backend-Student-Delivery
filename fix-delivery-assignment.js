const mongoose = require('mongoose');
const Delivery = require('./src/models/Delivery');
const Driver = require('./src/models/Driver');
require('dotenv').config();

async function fixDeliveryAssignment() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const deliveryId = '68a5d5a2fffc283cd7d81963';

        // Find the delivery
        const delivery = await Delivery.findById(deliveryId);
        if (!delivery) {
            console.log('❌ Delivery not found');
            return;
        }

        console.log('📦 Current delivery status:', {
            id: delivery._id,
            status: delivery.status,
            broadcastStatus: delivery.broadcastStatus,
            assignedTo: delivery.assignedTo,
            fee: delivery.fee
        });

        // Find an active driver to assign
        const driver = await Driver.findOne({
            isActive: true,
            isSuspended: false
        });

        if (!driver) {
            console.log('❌ No active drivers found');
            return;
        }

        console.log('🚗 Found driver:', {
            id: driver._id,
            name: driver.name,
            email: driver.email
        });

        // Update the delivery to assign it to the driver
        const updatedDelivery = await Delivery.findByIdAndUpdate(
            deliveryId,
            {
                assignedTo: driver._id,
                status: 'accepted',
                broadcastStatus: 'completed',
                acceptedAt: new Date(),
                acceptedBy: driver._id
            },
            { new: true }
        );

        console.log('✅ Delivery updated successfully:', {
            id: updatedDelivery._id,
            status: updatedDelivery.status,
            assignedTo: updatedDelivery.assignedTo,
            acceptedAt: updatedDelivery.acceptedAt
        });

        // Now let's also mark it as picked up to simulate a completed delivery
        const completedDelivery = await Delivery.findByIdAndUpdate(
            deliveryId,
            {
                status: 'picked_up',
                pickedUpAt: new Date()
            },
            { new: true }
        );

        console.log('✅ Delivery marked as picked up:', {
            status: completedDelivery.status,
            pickedUpAt: completedDelivery.pickedUpAt
        });

        console.log('🎉 Delivery is now ready for remittance generation!');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

// Run the script
fixDeliveryAssignment();
