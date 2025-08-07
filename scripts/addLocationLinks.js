const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const Delivery = require('../src/models/Delivery');

async function addLocationLinks() {
    try {
        console.log('Starting migration to add location links...');

        // Update all existing deliveries to add the new fields
        const result = await Delivery.updateMany(
            {}, // Update all documents
            {
                $set: {
                    pickupLocationLink: '',
                    deliveryLocationLink: ''
                }
            }
        );

        console.log(`Migration completed successfully!`);
        console.log(`Updated ${result.modifiedCount} deliveries`);

        // Verify the update
        const totalDeliveries = await Delivery.countDocuments();
        console.log(`Total deliveries in database: ${totalDeliveries}`);

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        mongoose.connection.close();
        console.log('Database connection closed');
    }
}

// Run the migration
addLocationLinks(); 