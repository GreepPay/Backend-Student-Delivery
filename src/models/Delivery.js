const mongoose = require('mongoose');

const deliverySchema = new mongoose.Schema({
    pickupLocation: {
        type: String,
        required: [true, 'Pickup location is required'],
        trim: true,
        minlength: [5, 'Pickup location must be at least 5 characters long']
    },
    deliveryLocation: {
        type: String,
        required: [true, 'Delivery location is required'],
        trim: true,
        minlength: [5, 'Delivery location must be at least 5 characters long']
    },
    pickupLocationDescription: {
        type: String,
        maxlength: [500, 'Pickup location description cannot exceed 500 characters'],
        trim: true
    },
    deliveryLocationDescription: {
        type: String,
        maxlength: [500, 'Delivery location description cannot exceed 500 characters'],
        trim: true
    },
    customerName: {
        type: String,
        maxlength: [50, 'Customer name cannot exceed 50 characters'],
        trim: true
    },
    customerPhone: {
        type: String,
        match: [/^[\+]?[1-9][\d]{0,15}$/, 'Please enter a valid phone number'],
        trim: true
    },
    deliveryCode: {
        type: String,
        unique: true,
        required: false
    },
    fee: {
        type: Number,
        required: [true, 'Delivery fee is required'],
        min: [1, 'Fee must be greater than 0'],
        max: [10000, 'Fee cannot exceed 10,000₺']
    },
    driverEarning: {
        type: Number,
        min: [0, 'Driver earning cannot be negative'],
        default: 0
    },
    earningsCalculated: {
        type: Boolean,
        default: false
    },
    earningsCalculationDate: {
        type: Date
    },
    companyEarning: {
        type: Number,
        min: [0, 'Company earning cannot be negative'],
        default: 0
    },
    paymentMethod: {
        type: String,
        enum: ['cash', 'pos', 'naira_transfer', 'isbank_transfer', 'crypto_transfer'],
        default: 'cash'
    },
    estimatedTime: {
        type: Date,
        required: [true, 'Estimated delivery time is required']
    },
    notes: {
        type: String,
        maxlength: [500, 'Notes cannot exceed 500 characters'],
        trim: true
    },
    priority: {
        type: String,
        enum: ['low', 'normal', 'high', 'urgent'],
        default: 'normal'
    },
    distance: {
        type: Number,
        min: [0, 'Distance cannot be negative'],
        max: [1000, 'Distance cannot exceed 1000 km']
    },
    status: {
        type: String,
        enum: ['pending', 'broadcasting', 'accepted', 'picked_up', 'in_transit', 'delivered', 'cancelled', 'failed'],
        default: 'pending'
    },
    // Automatic broadcast fields
    broadcastStatus: {
        type: String,
        enum: ['not_started', 'broadcasting', 'accepted', 'expired', 'manual_assignment'],
        default: 'not_started'
    },
    broadcastStartTime: {
        type: Date
    },
    broadcastEndTime: {
        type: Date
    },
    broadcastRadius: {
        type: Number,
        default: 5, // km
        min: [1, 'Broadcast radius must be at least 1 km'],
        max: [50, 'Broadcast radius cannot exceed 50 km']
    },
    broadcastDuration: {
        type: Number,
        default: 60, // seconds
        min: [10, 'Broadcast duration must be at least 10 seconds'],
        max: [300, 'Broadcast duration cannot exceed 5 minutes']
    },
    broadcastAttempts: {
        type: Number,
        default: 0,
        min: [0, 'Broadcast attempts cannot be negative']
    },
    maxBroadcastAttempts: {
        type: Number,
        default: 3,
        min: [1, 'Max broadcast attempts must be at least 1'],
        max: [5, 'Max broadcast attempts cannot exceed 5']
    },
    // Driver assignment
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Driver'
    },
    assignedAt: {
        type: Date
    },
    acceptedAt: {
        type: Date
    },
    // Location coordinates for distance calculation
    pickupCoordinates: {
        lat: {
            type: Number,
            min: [-90, 'Invalid latitude'],
            max: [90, 'Invalid latitude']
        },
        lng: {
            type: Number,
            min: [-180, 'Invalid longitude'],
            max: [180, 'Invalid longitude']
        }
    },
    deliveryCoordinates: {
        lat: {
            type: Number,
            min: [-90, 'Invalid latitude'],
            max: [90, 'Invalid latitude']
        },
        lng: {
            type: Number,
            min: [-180, 'Invalid longitude'],
            max: [180, 'Invalid longitude']
        }
    },
    // Remittance tracking
    remittanceStatus: {
        type: String,
        enum: ['pending', 'settled', 'overdue'],
        default: 'pending'
    },
    remittanceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Remittance'
    },
    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    pickedUpAt: {
        type: Date
    },
    deliveredAt: {
        type: Date
    },
    cancelledAt: {
        type: Date
    },
    // Created by
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
        required: true
    }
}, {
    timestamps: true
});

// Indexes for better query performance
deliverySchema.index({ status: 1, broadcastStatus: 1 });
deliverySchema.index({ assignedTo: 1, status: 1 });
deliverySchema.index({ broadcastStatus: 1, broadcastEndTime: 1 });
deliverySchema.index({ pickupCoordinates: '2dsphere' });
deliverySchema.index({ deliveryCoordinates: '2dsphere' });
deliverySchema.index({ createdAt: -1 });
deliverySchema.index({ priority: 1, status: 1 });

// Pre-save middleware to update updatedAt and generate delivery code
deliverySchema.pre('save', function (next) {
    this.updatedAt = new Date();

    // Generate delivery code if not already set
    if (!this.deliveryCode) {
        const timestamp = Date.now().toString().slice(-6);
        const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
        this.deliveryCode = `GRP-${timestamp}${random}`;
    }

    next();
});

// Static method to find deliveries ready for broadcast
deliverySchema.statics.findReadyForBroadcast = function () {
    return this.find({
        status: 'pending',
        broadcastStatus: 'not_started',
        assignedTo: null
    }).sort({ priority: -1, createdAt: 1 });
};

// Static method to find active broadcasts
deliverySchema.statics.findActiveBroadcasts = function () {
    return this.find({
        broadcastStatus: 'broadcasting',
        broadcastEndTime: { $gt: new Date() }
    });
};

// Static method to find expired broadcasts
deliverySchema.statics.findExpiredBroadcasts = function () {
    return this.find({
        broadcastStatus: 'broadcasting',
        broadcastEndTime: { $lte: new Date() }
    });
};

// Static method to find available deliveries for a driver
deliverySchema.statics.findAvailableForDriver = function (driverId, location, radius = 5) {
    return this.find({
        broadcastStatus: 'broadcasting',
        broadcastEndTime: { $gt: new Date() },
        assignedTo: null,
        status: 'pending'
    }).where('pickupCoordinates').near({
        center: {
            type: 'Point',
            coordinates: [location.lng, location.lat]
        },
        maxDistance: radius * 1000, // Convert km to meters
        spherical: true
    });
};

// Instance method to start broadcast
deliverySchema.methods.startBroadcast = function () {
    this.broadcastStatus = 'broadcasting';
    this.broadcastStartTime = new Date();
    this.broadcastEndTime = new Date(Date.now() + (this.broadcastDuration * 1000));
    this.broadcastAttempts += 1;
    return this.save();
};

// Instance method to accept delivery
deliverySchema.methods.acceptDelivery = function (driverId) {
    this.assignedTo = driverId;
    this.assignedAt = new Date();
    this.acceptedAt = new Date();
    this.broadcastStatus = 'accepted';
    this.status = 'accepted';
    return this.save();
};

// Instance method to expire broadcast
deliverySchema.methods.expireBroadcast = function () {
    this.broadcastStatus = 'expired';
    return this.save();
};

// Instance method to retry broadcast with larger radius
deliverySchema.methods.retryBroadcast = function () {
    if (this.broadcastAttempts < this.maxBroadcastAttempts) {
        this.broadcastRadius = Math.min(this.broadcastRadius * 1.5, 50); // Increase radius by 50%, max 50km
        this.broadcastDuration = Math.min(this.broadcastDuration * 1.2, 300); // Increase duration by 20%, max 5min
        this.broadcastStatus = 'not_started';
        return this.save();
    } else {
        this.broadcastStatus = 'manual_assignment';
        return this.save();
    }
};

// Instance method to manually assign
deliverySchema.methods.manualAssign = function (driverId) {
    this.assignedTo = driverId;
    this.assignedAt = new Date();
    this.broadcastStatus = 'manual_assignment';
    this.status = 'accepted';
    return this.save();
};

module.exports = mongoose.model('Delivery', deliverySchema);