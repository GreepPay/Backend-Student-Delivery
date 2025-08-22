const mongoose = require('mongoose');
const Admin = require('./src/models/Admin');
require('dotenv').config();

const createTestAdmin = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Check if test admin already exists
        const existingAdmin = await Admin.findOne({ email: 'test@example.com' });

        if (existingAdmin) {
            console.log('⚠️ Test admin already exists:', existingAdmin.email);
            console.log('✅ You can now try logging in with: test@example.com');
            return;
        }

        // Create test admin
        const testAdmin = new Admin({
            name: 'Test Admin',
            email: 'test@example.com',
            password: 'test123456', // Will be hashed by pre-save middleware
            role: 'admin',
            isActive: true
        });

        await testAdmin.save();
        console.log('✅ Test admin created successfully!');
        console.log('📧 Email: test@example.com');
        console.log('🔑 Role: admin');
        console.log('✅ You can now try logging in with this account');

    } catch (error) {
        console.error('❌ Error creating test admin:', error);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    }
};

createTestAdmin();
