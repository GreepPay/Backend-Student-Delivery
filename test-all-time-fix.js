const mongoose = require('mongoose');
const AnalyticsService = require('./src/services/analyticsService');
require('dotenv').config();

async function testAllTimeFix() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Test all-time analytics
        console.log('\n=== TESTING ALL-TIME ANALYTICS ===');
        const allTimeAnalytics = await AnalyticsService.getSystemAnalytics('all-time');

        console.log('✅ All-time analytics successful!');
        console.log('📊 Results:');
        console.log(`  - Total Deliveries: ${allTimeAnalytics.stats.totalDeliveries}`);
        console.log(`  - Completed Deliveries: ${allTimeAnalytics.stats.completedDeliveries}`);
        console.log(`  - Total Revenue: ₺${allTimeAnalytics.stats.totalRevenue}`);
        console.log(`  - Total Driver Earnings: ₺${allTimeAnalytics.stats.totalDriverEarnings}`);
        console.log(`  - Completion Rate: ${allTimeAnalytics.stats.completionRate}%`);
        console.log(`  - Delivery Change: ${allTimeAnalytics.stats.deliveryChange}%`);

        // Test other periods
        const periods = ['today', 'week', 'month', 'year'];

        for (const period of periods) {
            console.log(`\n=== TESTING ${period.toUpperCase()} ANALYTICS ===`);
            try {
                const analytics = await AnalyticsService.getSystemAnalytics(period);
                console.log(`✅ ${period} analytics successful!`);
                console.log(`  - Total Deliveries: ${analytics.stats.totalDeliveries}`);
                console.log(`  - Completed Deliveries: ${analytics.stats.completedDeliveries}`);
            } catch (error) {
                console.log(`❌ ${period} analytics failed:`, error.message);
            }
        }

        await mongoose.disconnect();
        console.log('\n✅ All tests completed successfully!');
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        await mongoose.disconnect();
    }
}

testAllTimeFix(); 