const mongoose = require('mongoose');
const Admin = require('../src/models/Admin');
const Driver = require('../src/models/Driver');
require('dotenv').config();

const seedDatabase = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/student-delivery');
        console.log('Connected to MongoDB');

        // Check if test admin already exists
        const existingTestAdmin = await Admin.findOne({ email: 'admin@test.com' });
        if (!existingTestAdmin) {
            // Create test admin account
            const testAdmin = await Admin.create({
                name: 'Test Admin',
                email: 'admin@test.com',
                password: 'TestAdmin123!', // Secure default password for testing
                role: 'admin',
                isActive: true,
                permissions: ['create_delivery', 'edit_delivery', 'delete_delivery', 'manage_drivers', 'view_analytics']
            });
            console.log('Test admin account created:', testAdmin.email);
        } else {
            console.log('Test admin account already exists');
        }

        // Check if real admin already exists
        const existingRealAdmin = await Admin.findOne({ email: 'wisdom@greep.io' });
        if (!existingRealAdmin) {
            // Create real admin account
            const realAdmin = await Admin.create({
                name: 'Wisdom Greep',
                email: 'wisdom@greep.io',
                password: 'WisdomGreep2024!', // Secure default password
                role: 'super_admin',
                isActive: true,
                permissions: [
                    'create_delivery',
                    'edit_delivery',
                    'delete_delivery',
                    'manage_drivers',
                    'view_analytics',
                    'manage_remittances',
                    'manage_admins',
                    'manage_system_settings',
                    'manage_earnings_config'
                ]
            });
            console.log('Real admin account created:', realAdmin.email);
        } else {
            console.log('Real admin account already exists');
        }

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
        console.log('\nAdmin Accounts:');
        console.log('Test Admin: admin@test.com (OTP authentication)');
        console.log('Real Admin: wisdom@greep.io (OTP authentication)');
        console.log('Driver: driver@test.com (OTP authentication)');
        console.log('\nAuthentication Method:');
        console.log('- Both admins and drivers use OTP-only authentication');
        console.log('- Request OTP: POST /api/auth/send-otp');
        console.log('- Verify OTP: POST /api/auth/verify-otp');
        console.log('\nNote: Password field exists in Admin model but is not used for authentication');

    } catch (error) {
        console.error('Error seeding database:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
};

seedDatabase(); 