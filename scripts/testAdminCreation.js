const mongoose = require('mongoose');
const Admin = require('../src/models/Admin');
require('dotenv').config();

const testAdminCreation = async () => {
    try {
        // Connect to MongoDB
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
        console.log('✅ Connected to MongoDB successfully');

        // Check if admin exists
        console.log('🔍 Checking for wisdom@greep.io admin account...');
        const admin = await Admin.findOne({ email: 'wisdom@greep.io' });

        if (!admin) {
            console.log('❌ Admin account wisdom@greep.io not found');
            console.log('💡 Please run the seeding script first: node scripts/seedWisdomAdmin.js');
            return;
        }

        console.log('✅ Admin account found!');
        console.log('📋 Admin details:', {
            id: admin._id,
            name: admin.name,
            email: admin.email,
            role: admin.role,
            isActive: admin.isActive,
            permissions: admin.permissions,
            createdAt: admin.createdAt,
            lastLogin: admin.lastLogin
        });

        // Verify permissions
        const requiredPermissions = [
            'create_delivery',
            'edit_delivery',
            'delete_delivery',
            'manage_drivers',
            'view_analytics',
            'manage_remittances',
            'manage_admins',
            'manage_system_settings',
            'manage_earnings_config'
        ];

        const missingPermissions = requiredPermissions.filter(
            permission => !admin.permissions.includes(permission)
        );

        if (missingPermissions.length > 0) {
            console.log('⚠️  Missing permissions:', missingPermissions);
        } else {
            console.log('✅ All required permissions are present');
        }

        // Verify role
        if (admin.role !== 'super_admin') {
            console.log('⚠️  Admin role should be super_admin, but is:', admin.role);
        } else {
            console.log('✅ Admin role is correctly set to super_admin');
        }

        // Verify active status
        if (!admin.isActive) {
            console.log('⚠️  Admin account is not active');
        } else {
            console.log('✅ Admin account is active');
        }

        console.log('\n🎉 Admin account verification complete!');
        console.log('\n📧 Ready to use with:');
        console.log('- Email: wisdom@greep.io');
        console.log('- Authentication: OTP-only system');
        console.log('- Login: POST /api/auth/send-otp');

    } catch (error) {
        console.error('❌ Error:', error.message);

        if (error.name === 'MongooseServerSelectionError') {
            console.log('\n🔧 MongoDB Connection Issue:');
            console.log('1. Check if your IP is whitelisted in MongoDB Atlas');
            console.log('2. Verify the MONGODB_URI in your .env file');
            console.log('3. Ensure the MongoDB Atlas cluster is running');
        }
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('🔌 Disconnected from MongoDB');
        }
    }
};

// Run the test
testAdminCreation();
