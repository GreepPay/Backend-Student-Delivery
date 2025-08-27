const mongoose = require('mongoose');
const Admin = require('../src/models/Admin');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const addAdmin = async () => {
    try {
        // Connect to MongoDB
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB successfully');

        // Check if admin already exists
        const existingAdmin = await Admin.findOne({ email: 'wisdom@greep.io' });
        if (existingAdmin) {
            console.log('Admin account wisdom@greep.io already exists');
            console.log('Admin details:', {
                id: existingAdmin._id,
                name: existingAdmin.name,
                email: existingAdmin.email,
                role: existingAdmin.role,
                isActive: existingAdmin.isActive
            });
            return;
        }

        // Create admin account
        const hashedPassword = await bcrypt.hash('WisdomGreep2024!', 12);

        const admin = await Admin.create({
            name: 'Wisdom Greep',
            email: 'wisdom@greep.io',
            password: hashedPassword,
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

        console.log('✅ Admin account created successfully!');
        console.log('Admin details:', {
            id: admin._id,
            name: admin.name,
            email: admin.email,
            role: admin.role,
            isActive: admin.isActive,
            permissions: admin.permissions
        });

        console.log('\n📧 Authentication:');
        console.log('- Email: wisdom@greep.io');
        console.log('- Use OTP authentication: POST /api/auth/send-otp');
        console.log('- Verify OTP: POST /api/auth/verify-otp');
        console.log('- No password required (OTP-only system)');

    } catch (error) {
        console.error('❌ Error creating admin account:', error.message);
        if (error.code === 11000) {
            console.log('Admin with this email already exists');
        }
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
};

addAdmin();
