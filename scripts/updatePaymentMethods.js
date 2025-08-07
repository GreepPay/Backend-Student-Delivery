const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const Delivery = require('../src/models/Delivery');

async function updatePaymentMethods() {
    try {
        console.log('Starting payment method migration...');

        // Update old payment method values to new ones
        const updates = [
            // Update 'card' to 'pos' (most logical mapping)
            { oldValue: 'card', newValue: 'pos' },
            // Update 'transfer' to 'naira_transfer' (most logical mapping)
            { oldValue: 'transfer', newValue: 'naira_transfer' }
        ];

        let totalUpdated = 0;

        for (const update of updates) {
            const result = await Delivery.updateMany(
                { paymentMethod: update.oldValue },
                { $set: { paymentMethod: update.newValue } }
            );

            if (result.modifiedCount > 0) {
                console.log(`Updated ${result.modifiedCount} deliveries from '${update.oldValue}' to '${update.newValue}'`);
                totalUpdated += result.modifiedCount;
            }
        }

        console.log(`Migration completed successfully!`);
        console.log(`Total deliveries updated: ${totalUpdated}`);

        // Show current payment method distribution
        const paymentMethods = await Delivery.aggregate([
            { $group: { _id: '$paymentMethod', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        console.log('\nCurrent payment method distribution:');
        paymentMethods.forEach(pm => {
            console.log(`  ${pm._id}: ${pm.count} deliveries`);
        });

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        mongoose.connection.close();
        console.log('Database connection closed');
    }
}

// Run the migration
updatePaymentMethods(); 