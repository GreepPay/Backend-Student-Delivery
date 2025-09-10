const mongoose = require('mongoose');
const Driver = require('../src/models/Driver');
const DriverRatingService = require('../src/services/driverRatingService');

async function recalculateAllDriverRatings() {
    try {
        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/student-delivery');
        console.log('🔍 Recalculating all driver ratings...');

        // Get all drivers
        const drivers = await Driver.find({});
        console.log(`📊 Found ${drivers.length} drivers to recalculate`);

        let updatedCount = 0;

        for (const driver of drivers) {
            try {
                console.log(`\n🔄 Recalculating rating for: ${driver.fullName || driver.name || 'Unknown'}`);

                // Calculate new rating
                const ratingResult = await DriverRatingService.calculateDriverRating(driver._id);

                console.log(`   Old Rating: ${driver.rating}`);
                console.log(`   New Rating: ${ratingResult.rating}`);
                console.log(`   Score: ${ratingResult.score}`);

                if (Math.abs(driver.rating - ratingResult.rating) > 0.1) {
                    updatedCount++;
                    console.log(`   ✅ Rating updated!`);
                } else {
                    console.log(`   ⏸️  Rating unchanged`);
                }

            } catch (error) {
                console.error(`   ❌ Error calculating rating for ${driver.fullName}:`, error.message);
            }
        }

        console.log(`\n🎉 Rating recalculation complete!`);
        console.log(`📈 Updated ${updatedCount} out of ${drivers.length} drivers`);

        await mongoose.disconnect();

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

// Run the script
recalculateAllDriverRatings();
