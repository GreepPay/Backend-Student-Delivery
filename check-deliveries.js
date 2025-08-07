const mongoose = require('mongoose');
const Delivery = require('./src/models/Delivery');
const Driver = require('./src/models/Driver');
require('dotenv').config();

const checkDeliveries = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/student-delivery');
        console.log('Connected to MongoDB');

        // Get all deliveries
        const deliveries = await Delivery.find({}).populate('assignedTo', 'name email');

        console.log(`Found ${deliveries.length} deliveries in database:`);

        deliveries.forEach((delivery, index) => {
            console.log(`${index + 1}. ID: ${delivery._id}`);
            console.log(`   Status: ${delivery.status}`);
            console.log(`   Assigned to: ${delivery.assignedTo?.name || 'None'}`);
            console.log(`   Created: ${delivery.createdAt}`);
            console.log(`   Assigned: ${delivery.assignedAt || 'Not assigned'}`);
            console.log(`   Delivered: ${delivery.deliveredAt || 'Not delivered'}`);
            console.log('   ---');
        });

    } catch (error) {
        console.error('Error checking deliveries:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
};

checkDeliveries(); 