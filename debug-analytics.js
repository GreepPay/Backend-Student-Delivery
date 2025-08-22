// Debug script to test AnalyticsService
const mongoose = require('mongoose');

// MongoDB connection
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/greep-delivery';

async function debugAnalytics() {
    try {
        // Connect to MongoDB
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB');

        // Import models and services
        const Driver = require('./src/models/Driver');
        const Delivery = require('./src/models/Delivery');
        const AnalyticsService = require('./src/services/analyticsService');

        const driverId = '6890dc5a98ce5bc39c4e92b7'; // Your driver ID

        console.log('\n🔍 Debugging Analytics Service for driver:', driverId);

        // 1. Check if driver exists
        const driver = await Driver.findById(driverId);
        console.log('\n👤 Driver found:', !!driver);
        if (driver) {
            console.log('   Name:', driver.fullName);
            console.log('   Joined:', driver.joinedAt || driver.createdAt);
        }

        // 2. Check raw deliveries for this driver
        const allDeliveries = await Delivery.find({ assignedTo: driverId });
        console.log('\n📦 Total deliveries assigned to driver:', allDeliveries.length);

        const deliveredDeliveries = await Delivery.find({ 
            assignedTo: driverId, 
            status: 'delivered' 
        });
        console.log('📦 Delivered deliveries:', deliveredDeliveries.length);

        // Show some delivery details
        if (deliveredDeliveries.length > 0) {
            console.log('\n📅 Delivery dates:');
            deliveredDeliveries.forEach((delivery, index) => {
                console.log(`   ${index + 1}. ${delivery.deliveryCode} - Delivered: ${delivery.deliveredAt?.toISOString() || 'No deliveredAt'}`);
            });
        }

        // 3. Test date ranges
        console.log('\n📅 Testing date ranges:');
        
        // Today
        const todayRange = AnalyticsService.getDateRange('today');
        console.log('TODAY:', todayRange.startDate.toISOString(), 'to', todayRange.endDate.toISOString());
        
        // This Week
        const weekRange = AnalyticsService.getDateRange('week');
        console.log('WEEK:', weekRange.startDate.toISOString(), 'to', weekRange.endDate.toISOString());
        
        // This Month
        const monthRange = AnalyticsService.getDateRange('month');
        console.log('MONTH:', monthRange.startDate.toISOString(), 'to', monthRange.endDate.toISOString());

        // 4. Test deliveries in month range
        const monthDeliveries = await Delivery.find({
            assignedTo: driverId,
            status: 'delivered',
            deliveredAt: { $gte: monthRange.startDate, $lte: monthRange.endDate }
        });
        console.log('\n📊 Deliveries in month range:', monthDeliveries.length);

        // 5. Test AnalyticsService methods
        console.log('\n🧮 Testing AnalyticsService methods:');
        
        try {
            const todayAnalytics = await AnalyticsService.getDriverAnalytics(driverId, 'today');
            console.log('TODAY analytics:', {
                totalDeliveries: todayAnalytics.stats.totalDeliveries,
                totalEarnings: todayAnalytics.stats.totalEarnings
            });
        } catch (error) {
            console.log('❌ TODAY analytics error:', error.message);
        }

        try {
            const weekAnalytics = await AnalyticsService.getDriverAnalytics(driverId, 'week');
            console.log('WEEK analytics:', {
                totalDeliveries: weekAnalytics.stats.totalDeliveries,
                totalEarnings: weekAnalytics.stats.totalEarnings
            });
        } catch (error) {
            console.log('❌ WEEK analytics error:', error.message);
        }

        try {
            const monthAnalytics = await AnalyticsService.getDriverAnalytics(driverId, 'month');
            console.log('MONTH analytics:', {
                totalDeliveries: monthAnalytics.stats.totalDeliveries,
                totalEarnings: monthAnalytics.stats.totalEarnings
            });
        } catch (error) {
            console.log('❌ MONTH analytics error:', error.message);
        }

        try {
            const allTimeAnalytics = await AnalyticsService.getDriverAnalytics(driverId, 'all-time');
            console.log('ALL-TIME analytics:', {
                totalDeliveries: allTimeAnalytics.stats.totalDeliveries,
                totalEarnings: allTimeAnalytics.stats.totalEarnings
            });
        } catch (error) {
            console.log('❌ ALL-TIME analytics error:', error.message);
        }

    } catch (error) {
        console.error('❌ Debug error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n✅ Disconnected from MongoDB');
        process.exit(0);
    }
}

debugAnalytics();
