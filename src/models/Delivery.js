const mongoose = require('mongoose');

const deliverySchema = new mongoose.Schema({
    deliveryCode: {
        type: String,
        unique: true
    },
    pickupLocation: {
        type: String,
        required: [true, 'Pickup location is required'],
        trim: true
    },
    pickupLocationLink: {
        type: String,
        trim: true,
        validate: {
            validator: function (v) {
                if (!v) return true; // Allow empty
                return /^https?:\/\/.+/.test(v);
            },
            message: 'Pickup location link must be a valid URL'
        }
    },
    deliveryLocation: {
        type: String,
        required: [true, 'Delivery location is required'],
        trim: true
    },
    deliveryLocationLink: {
        type: String,
        trim: true,
        validate: {
            validator: function (v) {
                if (!v) return true; // Allow empty
                return /^https?:\/\/.+/.test(v);
            },
            message: 'Delivery location link must be a valid URL'
        }
    },
    customerName: {
        type: String,
        trim: true
    },
    customerPhone: {
        type: String,
        trim: true,
        match: [/^[\+]?[1-9][\d]{0,15}$/, 'Please enter a valid phone number']
    },
    fee: {
        type: Number,
        required: [true, 'Delivery fee is required'],
        default: 150,
        min: [1, 'Fee must be greater than 0']
    },
    driverEarning: {
        type: Number,
        required: true,
        default: 100,
        min: 0
    },
    companyEarning: {
        type: Number,
        required: true,
        default: 50,
        min: 0
    },
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Driver'
    },
    assignedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'assigned', 'picked_up', 'delivered', 'cancelled'],
        default: 'pending'
    },
    remittanceStatus: {
        type: String,
        enum: ['pending', 'settled'],
        default: 'pending'
    },
    remittanceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Remittance'
    },
    settledAt: {
        type: Date
    },
    paymentMethod: {
        type: String,
        enum: ['cash', 'pos', 'naira_transfer', 'isbank_transfer', 'crypto_transfer'],
        default: 'cash'
    },
    deliveryTime: {
        type: Date
    },
    estimatedTime: {
        type: Date
    },
    assignedAt: {
        type: Date
    },
    pickedUpAt: {
        type: Date
    },
    deliveredAt: {
        type: Date
    },
    notes: {
        type: String,
        trim: true,
        maxlength: [500, 'Notes cannot exceed 500 characters']
    },
    priority: {
        type: String,
        enum: ['low', 'normal', 'high', 'urgent'],
        default: 'normal'
    },
    distance: {
        type: Number, // in kilometers
        min: 0
    },
    deliveryProof: {
        type: String, // URL to image or document
        trim: true
    },
    rating: {
        type: Number,
        min: 1,
        max: 5
    },
    feedback: {
        type: String,
        trim: true,
        maxlength: [1000, 'Feedback cannot exceed 1000 characters']
    }
}, {
    timestamps: true
});

// Indexes for better query performance
deliverySchema.index({ status: 1, createdAt: -1 });
deliverySchema.index({ assignedTo: 1, status: 1 });
deliverySchema.index({ assignedBy: 1, createdAt: -1 });
deliverySchema.index({ createdAt: -1 });

// Pre-save middleware to generate delivery code
deliverySchema.pre('save', async function (next) {
    if (this.isNew && !this.deliveryCode) {
        // Generate GRP- format with random 6-digit number
        const randomNumber = Math.floor(100000 + Math.random() * 900000);
        this.deliveryCode = `GRP-${randomNumber}`;
    }

    // Set assignment timestamp
    if (this.isModified('assignedTo') && this.assignedTo && !this.assignedAt) {
        this.assignedAt = new Date();
        if (this.status === 'pending') {
            this.status = 'assigned';
        }
    }

    // Set status-specific timestamps
    if (this.isModified('status')) {
        const now = new Date();
        switch (this.status) {
            case 'picked_up':
                if (!this.pickedUpAt) this.pickedUpAt = now;
                break;
            case 'delivered':
                if (!this.deliveredAt) this.deliveredAt = now;
                this.deliveryTime = now;
                break;
        }
    }

    next();
});

// Virtual for delivery duration (in minutes)
deliverySchema.virtual('deliveryDuration').get(function () {
    if (!this.assignedAt || !this.deliveredAt) return null;
    return Math.round((this.deliveredAt - this.assignedAt) / (1000 * 60));
});

// Virtual for status color (for frontend)
deliverySchema.virtual('statusColor').get(function () {
    const colors = {
        pending: '#fbbf24',
        assigned: '#3b82f6',
        picked_up: '#f59e0b',
        delivered: '#10b981',
        cancelled: '#ef4444'
    };
    return colors[this.status] || '#6b7280';
});

// Static method to get next delivery code
deliverySchema.statics.getNextDeliveryCode = async function () {
    // Generate GRP- format with random 6-digit number
    const randomNumber = Math.floor(100000 + Math.random() * 900000);
    return `GRP-${randomNumber}`;
};

// Static method to find deliveries by status
deliverySchema.statics.findByStatus = function (status, limit = 50) {
    return this.find({ status })
        .populate('assignedTo', 'name email area')
        .populate('assignedBy', 'name email')
        .sort({ createdAt: -1 })
        .limit(limit);
};

// Static method to find driver's deliveries
deliverySchema.statics.findByDriver = function (driverId, status = null) {
    const query = { assignedTo: driverId };
    if (status) query.status = status;

    return this.find(query)
        .populate('assignedBy', 'name email')
        .sort({ createdAt: -1 });
};

// Instance method to assign to driver
deliverySchema.methods.assignToDriver = async function (driverId, adminId) {
    this.assignedTo = driverId;
    this.assignedBy = adminId;
    this.status = 'assigned';
    this.assignedAt = new Date();

    // Update driver stats
    const Driver = require('./Driver');
    await Driver.findByIdAndUpdate(driverId, {
        $inc: { totalDeliveries: 1 }
    });

    return this.save();
};

// Instance method to mark as delivered
deliverySchema.methods.markAsDelivered = function (notes = '') {
    this.status = 'delivered';
    this.deliveredAt = new Date();
    this.deliveryTime = new Date();
    if (notes) this.notes = notes;
    return this.save();
};

// Ensure virtuals are included in JSON output
deliverySchema.set('toJSON', { virtuals: true });
deliverySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Delivery', deliverySchema);