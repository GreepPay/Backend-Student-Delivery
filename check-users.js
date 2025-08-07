const mongoose = require('mongoose');
const Driver = require('./src/models/Driver');
require('dotenv').config();

const checkUsers = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/student-delivery');
        console.log('Connected to MongoDB');

        // Get all drivers
        const drivers = await Driver.find({});

        console.log(`Found ${drivers.length} drivers in database:`);

        drivers.forEach((driver, index) => {
            console.log(`${index + 1}. ID: ${driver._id}`);
            console.log(`   Name: ${driver.name}`);
            console.log(`   Email: ${driver.email}`);
            console.log(`   Area: ${driver.area}`);
            console.log(`   Active: ${driver.isActive}`);
            console.log('   ---');
        });

    } catch (error) {
        console.error('Error checking users:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
};

checkUsers(); 