const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: 'recipientModel'
    },
    recipientModel: {
        type: String,
        required: true,
        enum: ['Driver', 'Admin']
    },
    type: {
        type: String,
        required: true,
        enum: [
            'delivery_assigned',
            'delivery_picked_up',
            'delivery_delivered',
            'delivery_cancelled',
            'payment_received',
            'account_suspended',
            'account_activated',
            'system_alert',
            'earnings_update',
            'rating_received',
            'new_message',
            'reminder',
            'remittance_created',
            'remittance_calculated',
            'remittance_completed',
            'remittance_cancelled',
            'new_driver_registered',
            'driver_suspended',
            'driver_activated',
            'driver_active',
            'driver_inactive',
            'earnings_milestone',
            'rating_update',
            'low_availability'
        ]
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    message: {
        type: String,
        required: true,
        trim: true
    },
    data: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    isRead: {
        type: Boolean,
        default: false
    },
    isPinned: {
        type: Boolean,
        default: false
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
    },
    expiresAt: {
        type: Date
    },
    readAt: {
        type: Date
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'createdByModel'
    },
    createdByModel: {
        type: String,
        enum: ['Driver', 'Admin', 'System']
    }
}, {
    timestamps: true
});

// Indexes for better query performance
notificationSchema.index({ recipient: 1, isRead: 1 });
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtual for time ago
notificationSchema.virtual('timeAgo').get(function () {
    const now = new Date();
    const diffInSeconds = Math.floor((now - this.createdAt) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
});

// Static method to create notification
notificationSchema.statics.createNotification = function (data) {
    return this.create(data);
};

// Static method to get unread count
notificationSchema.statics.getUnreadCount = function (recipientId) {
    return this.countDocuments({
        recipient: recipientId,
        isRead: false
    });
};

// Static method to mark as read
notificationSchema.statics.markAsRead = function (notificationId, recipientId) {
    return this.findOneAndUpdate(
        { _id: notificationId, recipient: recipientId },
        {
            isRead: true,
            readAt: new Date()
        },
        { new: true }
    );
};

// Static method to mark all as read
notificationSchema.statics.markAllAsRead = function (recipientId) {
    return this.updateMany(
        { recipient: recipientId, isRead: false },
        {
            isRead: true,
            readAt: new Date()
        }
    );
};

// Static method to get notifications with pagination
notificationSchema.statics.getNotifications = function (recipientId, page = 1, limit = 20) {
    return this.find({ recipient: recipientId })
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);
};

// Ensure virtuals are included in JSON output
notificationSchema.set('toJSON', { virtuals: true });
notificationSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Notification', notificationSchema); 