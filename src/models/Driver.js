const mongoose = require('mongoose');

const driverSchema = new mongoose.Schema({
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        minlength: [2, 'Name must be at least 2 characters long']
    },
    phone: {
        type: String,
        trim: true,
        match: [/^[\+]?[1-9][\d]{0,15}$/, 'Please enter a valid phone number']
    },
    studentId: {
        type: String,
        trim: true,
        unique: true,
        sparse: true // Allows multiple null values
    },
    area: {
        type: String,
        trim: true,
        enum: ['Gonyeli', 'Kucuk', 'Lefkosa', 'Famagusta', 'Kyrenia', 'Other'],
        default: 'Other'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isSuspended: {
        type: Boolean,
        default: false
    },
    suspensionReason: {
        type: String,
        trim: true
    },
    suspendedAt: {
        type: Date
    },
    suspendedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin'
    },
    joinedAt: {
        type: Date,
        default: Date.now
    },
    totalDeliveries: {
        type: Number,
        default: 0,
        min: 0
    },
    totalEarnings: {
        type: Number,
        default: 0,
        min: 0
    },
    completedDeliveries: {
        type: Number,
        default: 0,
        min: 0
    },
    rating: {
        type: Number,
        default: 5.0,
        min: 1,
        max: 5
    },
    lastLogin: {
        type: Date
    },
    addedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin'
    },
    achievedMilestones: {
        type: [Number],
        default: []
    },
    profilePicture: {
        type: String,
        trim: true
    }
}, {
    timestamps: true
});

// Indexes for better query performance
driverSchema.index({ email: 1, isActive: 1 });
driverSchema.index({ area: 1, isActive: 1 });
driverSchema.index({ totalDeliveries: -1 });
driverSchema.index({ totalEarnings: -1 });

// Virtual for completion rate
driverSchema.virtual('completionRate').get(function () {
    if (this.totalDeliveries === 0) return 0;
    return Math.round((this.completedDeliveries / this.totalDeliveries) * 100);
});

// Virtual for average earnings per delivery
driverSchema.virtual('averageEarningsPerDelivery').get(function () {
    if (this.completedDeliveries === 0) return 0;
    return Math.round(this.totalEarnings / this.completedDeliveries);
});

// Static method to find driver by email (allows inactive drivers to login)
driverSchema.statics.findActiveByEmail = function (email) {
    return this.findOne({ email });
};

// Static method to get drivers by area
driverSchema.statics.findByArea = function (area, activeOnly = true) {
    const query = { area };
    if (activeOnly) query.isActive = true;
    return this.find(query).sort({ name: 1 });
};

// Static method to recalculate driver stats from deliveries
driverSchema.statics.recalculateStats = async function (driverId) {
    const Delivery = require('./Delivery');

    const stats = await Delivery.aggregate([
        { $match: { assignedTo: driverId } },
        {
            $group: {
                _id: null,
                totalDeliveries: { $sum: 1 },
                completedDeliveries: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
                totalEarnings: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, '$driverEarning', 0] } }
            }
        }
    ]);

    if (stats.length > 0) {
        const stat = stats[0];
        await this.findByIdAndUpdate(driverId, {
            totalDeliveries: stat.totalDeliveries,
            completedDeliveries: stat.completedDeliveries,
            totalEarnings: stat.totalEarnings
        });
    }

    return stats[0] || { totalDeliveries: 0, completedDeliveries: 0, totalEarnings: 0 };
};

// Instance method to update delivery stats
driverSchema.methods.updateDeliveryStats = function (earnings) {
    this.totalDeliveries += 1;
    this.completedDeliveries += 1;
    this.totalEarnings += earnings;
    return this.save();
};

// Instance method to update last login
driverSchema.methods.updateLastLogin = function () {
    this.lastLogin = new Date();
    this.isOnline = true;
    return this.save();
};

// Instance method to set offline
driverSchema.methods.setOffline = function () {
    this.isOnline = false;
    return this.save();
};

// Ensure virtuals are included in JSON output
driverSchema.set('toJSON', { virtuals: true });
driverSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Driver', driverSchema);