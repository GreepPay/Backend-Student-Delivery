const mongoose = require('mongoose');
const Admin = require('../src/models/Admin');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const seedWisdomAdmin = async () => {
    try {
        // Connect to MongoDB
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
        console.log('✅ Connected to MongoDB successfully');

        // Check if admin already exists
        console.log('🔍 Checking if admin account exists...');
        const existingAdmin = await Admin.findOne({ email: 'wisdom@greep.io' });

        if (existingAdmin) {
            console.log('ℹ️  Admin account wisdom@greep.io already exists');
            console.log('📋 Admin details:', {
                id: existingAdmin._id,
                name: existingAdmin.name,
                email: existingAdmin.email,
                role: existingAdmin.role,
                isActive: existingAdmin.isActive,
                permissions: existingAdmin.permissions
            });

            // Update admin permissions if needed (without touching password)
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
                permission => !existingAdmin.permissions.includes(permission)
            );

            const needsUpdate = existingAdmin.role !== 'super_admin' || missingPermissions.length > 0;

            if (needsUpdate) {
                console.log('🔄 Updating admin role and permissions...');

                // Use findByIdAndUpdate to avoid pre-save middleware password validation
                const updatedAdmin = await Admin.findByIdAndUpdate(
                    existingAdmin._id,
                    {
                        role: 'super_admin',
                        permissions: requiredPermissions,
                        updatedAt: new Date()
                    },
                    { new: true, runValidators: false }
                );

                console.log('✅ Admin role and permissions updated successfully');
                console.log('📋 Updated admin details:', {
                    id: updatedAdmin._id,
                    name: updatedAdmin.name,
                    email: updatedAdmin.email,
                    role: updatedAdmin.role,
                    isActive: updatedAdmin.isActive,
                    permissions: updatedAdmin.permissions
                });
            } else {
                console.log('✅ Admin already has correct role and permissions');
            }

            return;
        }

        // Create admin account
        console.log('👤 Creating new admin account...');
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

        console.log('🎉 Admin account created successfully!');
        console.log('📋 Admin details:', {
            id: admin._id,
            name: admin.name,
            email: admin.email,
            role: admin.role,
            isActive: admin.isActive,
            permissions: admin.permissions
        });

        console.log('\n🔐 Authentication Information:');
        console.log('📧 Email: wisdom@greep.io');
        console.log('🔑 Password: WisdomGreep2024! (for reference only)');
        console.log('📱 Authentication Method: OTP-only system');
        console.log('   - Request OTP: POST /api/auth/send-otp');
        console.log('   - Verify OTP: POST /api/auth/verify-otp');
        console.log('   - No password required for login');

        console.log('\n🚀 Next Steps:');
        console.log('1. Use OTP authentication to login');
        console.log('2. The password field exists in the database but is not used for authentication');
        console.log('3. All authentication is handled through OTP system');

    } catch (error) {
        console.error('❌ Error:', error.message);

        if (error.name === 'MongooseServerSelectionError') {
            console.log('\n🔧 Troubleshooting MongoDB Connection:');
            console.log('1. Check if your IP address is whitelisted in MongoDB Atlas');
            console.log('2. Verify the MONGODB_URI in your .env file');
            console.log('3. Ensure the MongoDB Atlas cluster is running');
            console.log('4. Try connecting from a different network if needed');
        }

        if (error.code === 11000) {
            console.log('ℹ️  Admin with this email already exists');
        }
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('🔌 Disconnected from MongoDB');
        }
    }
};

// Run the seeding function
seedWisdomAdmin();
