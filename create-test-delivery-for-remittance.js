const mongoose = require('mongoose');
const Delivery = require('./src/models/Delivery');
const Driver = require('./src/models/Driver');
const EarningsService = require('./src/services/earningsService');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/student-delivery')
    .then(async () => {
        console.log('✅ Connected to MongoDB');

        try {
            // Find the driver
            const driver = await Driver.findById('68a4fc0d79a93f2db0f362ad');
            if (!driver) {
                console.error('❌ Driver not found');
                process.exit(1);
            }

            console.log('✅ Found driver:', driver.name);

            // Create a test delivery with cash payment
            const testDelivery = new Delivery({
                pickupLocation: {
                    address: 'Test Pickup Address',
                    coordinates: [35.1856, 33.3823],
                    area: 'Lefkosa'
                },
                dropoffLocation: {
                    address: 'Test Dropoff Address',
                    coordinates: [35.1856, 33.3823],
                    area: 'Lefkosa'
                },
                customerName: 'Test Customer',
                customerPhone: '+905338481193',
                customerEmail: 'test@example.com',
                packageDetails: {
                    description: 'Test package for remittance',
                    weight: 1.5,
                    dimensions: '20x15x10 cm'
                },
                fee: 200, // ₺200 delivery fee
                paymentMethod: 'cash',
                status: 'delivered',
                assignedTo: driver._id,
                deliveredAt: new Date('2025-08-20T10:00:00Z'),
                remittanceStatus: 'pending' // This is important for remittance calculation
            });

            await testDelivery.save();
            console.log('✅ Created test delivery:', testDelivery._id);

            // Calculate earnings for this delivery
            const earnings = await EarningsService.calculateEarnings(testDelivery.fee);
            console.log('💰 Calculated earnings:', earnings);

            // Update the delivery with earnings
            await Delivery.findByIdAndUpdate(testDelivery._id, {
                driverEarning: earnings.driverEarning,
                companyEarning: earnings.companyEarning
            });

            console.log('✅ Updated delivery with earnings');
            console.log('📊 Delivery details:');
            console.log('   - Fee: ₺' + testDelivery.fee);
            console.log('   - Driver earning: ₺' + earnings.driverEarning);
            console.log('   - Company earning: ₺' + earnings.companyEarning);
            console.log('   - Payment method: ' + testDelivery.paymentMethod);
            console.log('   - Status: ' + testDelivery.status);
            console.log('   - Remittance status: ' + testDelivery.remittanceStatus);

            console.log('\n🎯 Now you can create a remittance for this delivery!');
            console.log('   - Driver ID: ' + driver._id);
            console.log('   - Date range: 2025-08-20 to 2025-08-20');
            console.log('   - Expected remittance amount: ₺' + earnings.companyEarning);

            process.exit(0);
        } catch (error) {
            console.error('❌ Error:', error);
            process.exit(1);
        }
    }).catch(err => {
        console.error('❌ MongoDB connection error:', err);
        process.exit(1);
    });
