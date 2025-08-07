const mongoose = require('mongoose');
const Admin = require('../src/models/Admin');
const Driver = require('../src/models/Driver');
require('dotenv').config();

const seedDatabase = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/student-delivery');
        console.log('Connected to MongoDB');

        // Check if admin already exists
        const existingAdmin = await Admin.findOne({ email: 'admin@test.com' });
        if (existingAdmin) {
            console.log('Admin account already exists');
            return;
        }

        // Create admin account
        const admin = await Admin.create({
            name: 'Test Admin',
            email: 'admin@test.com',
            role: 'admin',
            isActive: true,
            permissions: ['create_delivery', 'edit_delivery', 'delete_delivery', 'manage_drivers', 'view_analytics']
        });

        console.log('Admin account created:', admin.email);

        // Create a test driver
        const existingDriver = await Driver.findOne({ email: 'driver@test.com' });
        if (!existingDriver) {
            const driver = await Driver.create({
                name: 'Test Driver',
                email: 'driver@test.com',
                phone: '+1234567890',
                area: 'Gonyeli',
                isActive: true
            });
            console.log('Test driver created:', driver.email);
        }

        console.log('Database seeded successfully!');
        console.log('\nTest Accounts:');
        console.log('Admin: admin@test.com');
        console.log('Driver: driver@test.com');

    } catch (error) {
        console.error('Error seeding database:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
};

seedDatabase(); 