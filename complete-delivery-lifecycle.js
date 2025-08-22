const mongoose = require('mongoose');
const Delivery = require('./src/models/Delivery');
const Driver = require('./src/models/Driver');
const RemittanceService = require('./src/services/remittanceService');
require('dotenv').config();

async function completeDeliveryLifecycle() {
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
            fee: delivery.fee,
            paymentMethod: delivery.paymentMethod
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

        // Step 1: Assign delivery to driver (simulate driver accepting)
        console.log('\n🔄 Step 1: Assigning delivery to driver...');
        const acceptedDelivery = await Delivery.findByIdAndUpdate(
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

        console.log('✅ Delivery accepted by driver');

        // Step 2: Mark as picked up
        console.log('\n🔄 Step 2: Marking delivery as picked up...');
        const pickedUpDelivery = await Delivery.findByIdAndUpdate(
            deliveryId,
            {
                status: 'picked_up',
                pickedUpAt: new Date()
            },
            { new: true }
        );

        console.log('✅ Delivery marked as picked up');

        // Step 3: Mark as delivered
        console.log('\n🔄 Step 3: Marking delivery as delivered...');
        const deliveredDelivery = await Delivery.findByIdAndUpdate(
            deliveryId,
            {
                status: 'delivered',
                deliveredAt: new Date(),
                deliveryProof: 'https://example.com/proof.jpg' // Mock proof
            },
            { new: true }
        );

        console.log('✅ Delivery marked as delivered');

        // Step 4: Generate remittance
        console.log('\n🔄 Step 4: Generating remittance...');
        try {
            // Get admin for remittance generation
            const Admin = require('./src/models/Admin');
            const admin = await Admin.findOne();

            if (!admin) {
                console.log('⚠️ No admin found for remittance generation');
            } else {
                // Generate remittance for the driver
                const remittanceResult = await RemittanceService.generateRemittance(
                    driver._id, // driverId
                    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // startDate (7 days ago)
                    new Date(), // endDate (today)
                    admin._id, // adminId
                    7 // dueDateDays
                );

                console.log('✅ Remittance generated:', {
                    id: remittanceResult.remittance._id,
                    amount: remittanceResult.remittance.amount,
                    status: remittanceResult.remittance.status,
                    message: remittanceResult.message
                });
            }
        } catch (remittanceError) {
            console.log('⚠️ Remittance generation failed:', remittanceError.message);
        }

        // Step 5: Check final delivery status
        const finalDelivery = await Delivery.findById(deliveryId)
            .populate('assignedTo', 'name email');

        console.log('\n🎉 Final delivery status:', {
            id: finalDelivery._id,
            status: finalDelivery.status,
            assignedTo: finalDelivery.assignedTo ? {
                id: finalDelivery.assignedTo._id,
                name: finalDelivery.assignedTo.name,
                email: finalDelivery.assignedTo.email
            } : null,
            fee: finalDelivery.fee,
            driverEarning: finalDelivery.driverEarning,
            companyEarning: finalDelivery.companyEarning,
            paymentMethod: finalDelivery.paymentMethod,
            deliveredAt: finalDelivery.deliveredAt
        });

        console.log('\n✅ Delivery lifecycle completed successfully!');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

// Run the script
completeDeliveryLifecycle();
