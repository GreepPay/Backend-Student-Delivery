const mongoose = require('mongoose');

const remittanceSchema = new mongoose.Schema({
    // Driver Information
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
    driverPhone: {
        type: String,
        required: true
    },

    // Remittance Details
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    // New balanced remittance fields
    remittanceType: {
        type: String,
        enum: ['driver_owes_company', 'company_owes_driver', 'balanced'],
        default: 'driver_owes_company'
    },
    cashRemittanceOwed: {
        type: Number,
        default: 0,
        min: 0
    },
    nonCashEarningsOwed: {
        type: Number,
        default: 0,
        min: 0
    },
    netRemittanceAmount: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'cancelled', 'overdue'],
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
        default: 'Cash remittance payment'
    },

    // Admin Handling
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

    // Delivery Details
    deliveryIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Delivery'
    }],
    deliveryCount: {
        type: Number,
        default: 0
    },
    cashDeliveryCount: {
        type: Number,
        default: 0
    },
    nonCashDeliveryCount: {
        type: Number,
        default: 0
    },
    totalDeliveryFees: {
        type: Number,
        default: 0
    },
    totalDriverEarnings: {
        type: Number,
        default: 0
    },
    totalCompanyEarnings: {
        type: Number,
        default: 0
    },
    // Detailed breakdown for balanced remittance
    breakdown: {
        cash: {
            count: { type: Number, default: 0 },
            totalFees: { type: Number, default: 0 },
            driverEarnings: { type: Number, default: 0 },
            companyEarnings: { type: Number, default: 0 }
        },
        nonCash: {
            count: { type: Number, default: 0 },
            totalFees: { type: Number, default: 0 },
            driverEarnings: { type: Number, default: 0 },
            companyEarnings: { type: Number, default: 0 }
        }
    },

    // Period Information
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

    // Due Date and Notifications
    dueDate: {
        type: Date,
        required: true
    },
    reminderSent: {
        type: Boolean,
        default: false
    },
    reminderSentAt: {
        type: Date
    },
    reminderCount: {
        type: Number,
        default: 0
    },
    lastReminderDate: {
        type: Date
    },

    // Payment Details
    actualPaymentAmount: {
        type: Number,
        min: 0
    },
    paymentDate: {
        type: Date
    },
    paymentReference: {
        type: String
    },
    paymentNotes: {
        type: String
    },

    // Communication
    emailSent: {
        type: Boolean,
        default: false
    },
    emailSentAt: {
        type: Date
    },
    notificationSent: {
        type: Boolean,
        default: false
    },
    notificationSentAt: {
        type: Date
    },

    // Notes and Comments
    notes: {
        type: String,
        default: ''
    },
    adminNotes: {
        type: String,
        default: ''
    },

    // Status Tracking
    isOverdue: {
        type: Boolean,
        default: false
    },
    overdueDays: {
        type: Number,
        default: 0
    },

    // Audit Trail
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
        required: true
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin'
    },

    // Cancellation Details
    cancelledAt: {
        type: Date
    },
    cancelledBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin'
    },
    cancelReason: {
        type: String
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

// Update overdue status
remittanceSchema.pre('save', function (next) {
    if (this.dueDate && this.status === 'pending') {
        const now = new Date();
        if (now > this.dueDate) {
            this.isOverdue = true;
            this.overdueDays = Math.floor((now - this.dueDate) / (1000 * 60 * 60 * 24));
            if (this.status === 'pending') {
                this.status = 'overdue';
            }
        } else {
            this.isOverdue = false;
            this.overdueDays = 0;
        }
    }
    next();
});

// Indexes for efficient queries
remittanceSchema.index({ driverId: 1, status: 1 });
remittanceSchema.index({ handledBy: 1 });
remittanceSchema.index({ createdAt: -1 });
remittanceSchema.index({ dueDate: 1 });
remittanceSchema.index({ status: 1, dueDate: 1 });
remittanceSchema.index({ isOverdue: 1 });

// Static methods
remittanceSchema.statics.findOverdueRemittances = function () {
    return this.find({
        status: { $in: ['pending', 'overdue'] },
        dueDate: { $lt: new Date() }
    });
};

remittanceSchema.statics.findPendingRemittances = function () {
    return this.find({
        status: 'pending',
        dueDate: { $gte: new Date() }
    });
};

remittanceSchema.statics.findDriverRemittances = function (driverId) {
    return this.find({ driverId }).sort({ createdAt: -1 });
};

// Instance methods
remittanceSchema.methods.calculateOverdueDays = function () {
    if (this.dueDate && this.status === 'pending') {
        const now = new Date();
        if (now > this.dueDate) {
            return Math.floor((now - this.dueDate) / (1000 * 60 * 60 * 24));
        }
    }
    return 0;
};

remittanceSchema.methods.markAsCompleted = function (paymentDetails) {
    this.status = 'completed';
    this.actualPaymentAmount = paymentDetails.amount;
    this.paymentDate = paymentDetails.paymentDate || new Date();
    this.paymentReference = paymentDetails.reference;
    this.paymentNotes = paymentDetails.notes;
    this.handledAt = new Date();
};

module.exports = mongoose.model('Remittance', remittanceSchema); 