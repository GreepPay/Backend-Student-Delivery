const mongoose = require('mongoose');
const Delivery = require('./src/models/Delivery');
const Remittance = require('./src/models/Remittance');
const Driver = require('./src/models/Driver');
const Admin = require('./src/models/Admin');
const EarningsService = require('./src/services/earningsService');
require('dotenv').config();

const createTestDeliveryAndRemittance = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const driverId = '68a4fc0d79a93f2db0f362ad'; // Xerey
        const adminId = '688973b69cd2d8234f26bd39'; // Super Admin

        console.log(`🧪 Creating test delivery and remittance for driver: ${driverId}`);

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

        // Create a test delivery
        const testDelivery = new Delivery({
            pickupLocation: 'Test Pickup Location',
            deliveryLocation: 'Test Delivery Location',
            customerName: 'Test Customer',
            customerPhone: '+905338481193',
            deliveryCode: `GRP-${Date.now()}`,
            fee: 200, // ₺200 delivery
            paymentMethod: 'cash',
            estimatedTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
            notes: 'Test delivery for remittance testing',
            priority: 'normal',
            status: 'delivered', // Mark as delivered
            broadcastStatus: 'accepted',
            broadcastRadius: 5,
            broadcastDuration: 60,
            broadcastAttempts: 1,
            maxBroadcastAttempts: 3,
            remittanceStatus: 'pending',
            createdBy: admin._id,
            assignedTo: driver._id,
            deliveredAt: new Date()
        });

        await testDelivery.save();
        console.log(`✅ Created test delivery: ${testDelivery.deliveryCode} (₺${testDelivery.fee})`);

        // Calculate earnings for the delivery
        const earnings = await EarningsService.calculateEarnings(testDelivery.fee);
        console.log(`💰 Calculated earnings: Driver gets ₺${earnings.driverEarning}, Company gets ₺${earnings.companyEarning}`);

        // Update delivery with earnings
        await Delivery.findByIdAndUpdate(testDelivery._id, {
            driverEarning: earnings.driverEarning,
            companyEarning: earnings.companyEarning
        });
        console.log(`✅ Updated delivery with earnings`);

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
            amount: earnings.companyEarning, // ₺80 (company portion of ₺200 delivery)
            status: 'pending',
            paymentMethod: 'cash',
            referenceNumber: referenceNumber,
            description: `Cash remittance for 1 delivery`,
            handledBy: admin._id,
            handledByName: admin.name,
            handledByEmail: admin.email,
            deliveryIds: [testDelivery._id],
            deliveryCount: 1,
            totalDeliveryFees: testDelivery.fee,
            totalDriverEarnings: earnings.driverEarning,
            totalCompanyEarnings: earnings.companyEarning,
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
        await Delivery.findByIdAndUpdate(testDelivery._id, {
            remittanceStatus: 'settled',
            remittanceId: remittance._id,
            settledAt: new Date()
        });
        console.log(`✅ Delivery remittance status updated to 'settled'`);

        // Test WebSocket notification
        console.log('\n🧪 Testing WebSocket notification...');
        const RemittanceService = require('./src/services/remittanceService');
        await RemittanceService.sendWebSocketNotification(remittance);
        console.log('✅ WebSocket notification sent');

        // Now test the remittance summary
        console.log('\n🧪 Testing remittance summary...');
        const summary = await RemittanceService.getDriverRemittanceSummary(driverId);
        console.log('📊 Remittance summary:', summary);

    } catch (error) {
        console.error('❌ Error creating test delivery and remittance:', error);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    }
};

createTestDeliveryAndRemittance();
