const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminSchema = new mongoose.Schema({
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
    role: {
        type: String,
        enum: ['super_admin', 'admin'],
        default: 'admin'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastLogin: {
        type: Date
    },
    permissions: [{
        type: String,
        enum: ['create_delivery', 'edit_delivery', 'delete_delivery', 'manage_drivers', 'view_analytics']
    }],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin'
    },
    profilePicture: {
        type: String,
        trim: true
    }
}, {
    timestamps: true
});

// Index for better query performance
adminSchema.index({ email: 1, isActive: 1 });

// Pre-save middleware to set default permissions
adminSchema.pre('save', function (next) {
    if (this.isNew && this.role === 'admin') {
        this.permissions = ['create_delivery', 'edit_delivery', 'delete_delivery', 'manage_drivers', 'view_analytics'];
    } else if (this.isNew && this.role === 'super_admin') {
        this.permissions = ['create_delivery', 'edit_delivery', 'delete_delivery', 'manage_drivers', 'view_analytics'];
    }
    next();
});

// Instance method to check permissions
adminSchema.methods.hasPermission = function (permission) {
    return this.permissions.includes(permission) || this.role === 'super_admin';
};

// Static method to find active admin by email
adminSchema.statics.findActiveByEmail = function (email) {
    return this.findOne({ email, isActive: true });
};

// Update last login
adminSchema.methods.updateLastLogin = function () {
    this.lastLogin = new Date();
    return this.save();
};

module.exports = mongoose.model('Admin', adminSchema);