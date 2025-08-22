const mongoose = require('mongoose');
const Remittance = require('./src/models/Remittance');
const Delivery = require('./src/models/Delivery');
const Driver = require('./src/models/Driver');
const Admin = require('./src/models/Admin');
require('dotenv').config();

const createRemittanceManual = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const driverId = '68a4fc0d79a93f2db0f362ad'; // Xerey
        const adminId = '688973b69cd2d8234f26bd39'; // Super Admin

        console.log(`🧪 Creating remittance for driver: ${driverId}`);

        // Get driver information
        const driver = await Driver.findById(driverId);
        if (!driver) {
            throw new Error('Driver not found');
        }
        console.log(`✅ Found driver: ${driver.fullName}`);

        // Get admin information
        const admin = await Admin.findById(adminId);
        if (!admin) {
            throw new Error('Admin not found');
        }
        console.log(`✅ Found admin: ${admin.name}`);

        // Find the delivery for this driver
        const delivery = await Delivery.findOne({
            assignedTo: driverId,
            status: 'delivered',
            paymentMethod: 'cash',
            remittanceStatus: 'pending'
        });

        if (!delivery) {
            throw new Error('No pending cash delivery found for this driver');
        }

        console.log(`✅ Found delivery: ${delivery.deliveryCode} (₺${delivery.fee})`);
        console.log(`💰 Driver earning: ₺${delivery.driverEarning}, Company earning: ₺${delivery.companyEarning}`);

        // Generate reference number
        const timestamp = Date.now().toString().slice(-6);
        const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
        const referenceNumber = `REM-${timestamp}${random}`;

        // Create remittance record
        const remittance = new Remittance({
            driverId: driver._id,
            driverName: driver.fullName,
            driverEmail: driver.email,
            driverPhone: driver.phone,
            amount: delivery.companyEarning, // ₺50
            status: 'pending',
            paymentMethod: 'cash',
            referenceNumber: referenceNumber,
            description: `Cash remittance for 1 delivery`,
            handledBy: admin._id,
            handledByName: admin.name,
            handledByEmail: admin.email,
            deliveryIds: [delivery._id],
            deliveryCount: 1,
            totalDeliveryFees: delivery.fee,
            totalDriverEarnings: delivery.driverEarning,
            totalCompanyEarnings: delivery.companyEarning,
            period: {
                startDate: new Date('2025-08-20'),
                endDate: new Date('2025-08-20')
            },
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
            createdBy: admin._id
        });

        await remittance.save();
        console.log(`✅ Remittance created successfully!`);
        console.log(`📋 Remittance ID: ${remittance._id}`);
        console.log(`💰 Amount: ₺${remittance.amount}`);
        console.log(`📅 Due Date: ${remittance.dueDate}`);

        // Update delivery remittance status
        await Delivery.findByIdAndUpdate(delivery._id, {
            remittanceStatus: 'settled',
            remittanceId: remittance._id,
            settledAt: new Date()
        });
        console.log(`✅ Delivery remittance status updated to 'settled'`);

        // Now test the remittance summary
        console.log('\n🧪 Testing remittance summary...');
        const RemittanceService = require('./src/services/remittanceService');
        const summary = await RemittanceService.getDriverRemittanceSummary(driverId);
        console.log('📊 Remittance summary:', summary);

    } catch (error) {
        console.error('❌ Error creating remittance:', error);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    }
};

createRemittanceManual();
