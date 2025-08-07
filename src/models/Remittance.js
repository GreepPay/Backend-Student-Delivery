const mongoose = require('mongoose');

const remittanceSchema = new mongoose.Schema({
    driverId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Driver',
        required: true
    },
    driverName: {
        type: String,
        required: true
    },
    driverEmail: {
        type: String,
        required: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'cancelled'],
        default: 'pending'
    },
    paymentMethod: {
        type: String,
        enum: ['cash', 'bank_transfer', 'mobile_money', 'other'],
        required: true
    },
    referenceNumber: {
        type: String,
        unique: true,
        required: true
    },
    description: {
        type: String,
        default: 'Remittance payment'
    },
    handledBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
        required: true
    },
    handledByName: {
        type: String,
        required: true
    },
    handledByEmail: {
        type: String,
        required: true
    },
    handledAt: {
        type: Date,
        default: Date.now
    },
    deliveryIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Delivery'
    }],
    period: {
        startDate: {
            type: Date,
            required: true
        },
        endDate: {
            type: Date,
            required: true
        }
    },
    notes: {
        type: String,
        default: ''
    },
    emailSent: {
        type: Boolean,
        default: false
    },
    notificationSent: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Generate reference number
remittanceSchema.pre('save', async function (next) {
    if (this.isNew && !this.referenceNumber) {
        try {
            const count = await this.constructor.countDocuments();
            this.referenceNumber = `REM-${Date.now()}-${count + 1}`;
            console.log('Generated reference number:', this.referenceNumber);
        } catch (error) {
            console.error('Error generating reference number:', error);
            // Fallback reference number
            this.referenceNumber = `REM-${Date.now()}-FALLBACK`;
        }
    }
    next();
});

// Index for efficient queries
remittanceSchema.index({ driverId: 1, status: 1 });
remittanceSchema.index({ handledBy: 1 });
remittanceSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Remittance', remittanceSchema); 