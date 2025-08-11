const mongoose = require('mongoose');
const Admin = require('./src/models/Admin');
require('dotenv').config();

const fixAdminAuth = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/student-delivery');
        console.log('Connected to MongoDB');

        console.log('🔍 Checking admin accounts...\n');

        // Find admin account
        const admin = await Admin.findOne({ email: 'wisdom@greep.io' });

        if (!admin) {
            console.log('❌ Admin account not found: wisdom@greep.io');
            console.log('\n📋 Creating admin account...');

            const newAdmin = await Admin.create({
                name: 'Super Admin',
                email: 'wisdom@greep.io',
                role: 'super_admin',
                isActive: true,
                permissions: ['all', 'create_delivery', 'edit_delivery', 'delete_delivery', 'manage_drivers', 'view_analytics', 'ai_verification']
            });

            console.log('✅ Admin account created:', newAdmin.email);
            console.log('Role:', newAdmin.role);
            console.log('Permissions:', newAdmin.permissions);
        } else {
            console.log('✅ Admin account found:', admin.email);
            console.log('Current role:', admin.role);
            console.log('Current permissions:', admin.permissions);
            console.log('Is active:', admin.isActive);

            // Check if role and permissions need updating
            if (admin.role !== 'super_admin' || !admin.permissions.includes('all')) {
                console.log('\n🔄 Updating admin role and permissions...');

                admin.role = 'super_admin';
                admin.permissions = ['all', 'create_delivery', 'edit_delivery', 'delete_delivery', 'manage_drivers', 'view_analytics', 'ai_verification'];
                admin.isActive = true;

                await admin.save();

                console.log('✅ Admin account updated successfully!');
                console.log('New role:', admin.role);
                console.log('New permissions:', admin.permissions);
            } else {
                console.log('✅ Admin account is properly configured!');
            }
        }

        // Show all admin accounts
        console.log('\n📋 All admin accounts:');
        const allAdmins = await Admin.find({});
        allAdmins.forEach((admin, index) => {
            console.log(`${index + 1}. ${admin.name} (${admin.email})`);
            console.log(`   Role: ${admin.role}`);
            console.log(`   Permissions: ${admin.permissions.join(', ')}`);
            console.log(`   Active: ${admin.isActive}`);
            console.log('   ---');
        });

    } catch (error) {
        console.error('❌ Error fixing admin auth:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nDisconnected from MongoDB');
    }
};

fixAdminAuth();

