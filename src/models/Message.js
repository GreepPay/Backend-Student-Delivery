const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const messageSchema = new mongoose.Schema({
    // Conversation reference
    conversationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Conversation',
        required: true
    },

    // Message participants
    driverId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Driver',
        required: true
    },
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
        required: false // Can be null for driver-initiated messages
    },
    senderType: {
        type: String,
        enum: ['driver', 'admin'],
        required: true
    },

    // Message content
    message: {
        type: String,
        required: true,
        trim: true,
        maxlength: [1000, 'Message cannot exceed 1000 characters']
    },

    // Message type and priority
    type: {
        type: String,
        enum: ['general', 'emergency', 'document', 'delivery', 'earnings'],
        default: 'general'
    },
    priority: {
        type: String,
        enum: ['low', 'normal', 'high', 'urgent'],
        default: 'normal'
    },

    // Message direction
    senderType: {
        type: String,
        enum: ['driver', 'admin'],
        required: true
    },

    // Location data (for emergency messages)
    location: {
        lat: {
            type: Number,
            min: -90,
            max: 90
        },
        lng: {
            type: Number,
            min: -180,
            max: 180
        },
        address: String,
        accuracy: Number
    },

    // Message status
    status: {
        type: String,
        enum: ['sent', 'delivered', 'read'],
        default: 'sent'
    },

    // Read status
    readBy: {
        driver: {
            readAt: Date,
            isRead: { type: Boolean, default: false }
        },
        admin: {
            readAt: Date,
            isRead: { type: Boolean, default: false }
        }
    },

    // Emergency handling
    isEmergency: {
        type: Boolean,
        default: false
    },
    emergencyKeywords: [String], // Keywords that triggered emergency detection

    // Message metadata
    timestamp: {
        type: Date,
        default: Date.now
    },

    // Response tracking
    responseTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message'
    },

    // Attachments (for future use)
    attachments: [{
        type: {
            type: String,
            enum: ['image', 'document', 'audio']
        },
        url: String,
        filename: String,
        size: Number
    }],

    // System flags
    isSystemMessage: {
        type: Boolean,
        default: false
    },
    isDeleted: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Indexes for better performance
messageSchema.index({ driverId: 1, timestamp: -1 });
messageSchema.index({ adminId: 1, timestamp: -1 });
messageSchema.index({ type: 1, priority: 1 });
messageSchema.index({ isEmergency: 1, timestamp: -1 });
messageSchema.index({ status: 1 });

// Virtual for message age
messageSchema.virtual('age').get(function () {
    const now = new Date();
    const diff = now - this.timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
});

// Virtual for formatted timestamp
messageSchema.virtual('formattedTime').get(function () {
    return this.timestamp.toLocaleString();
});

// Method to mark as read
messageSchema.methods.markAsRead = function (userType) {
    if (userType === 'driver') {
        this.readBy.driver.isRead = true;
        this.readBy.driver.readAt = new Date();
    } else if (userType === 'admin') {
        this.readBy.admin.isRead = true;
        this.readBy.admin.readAt = new Date();
    }

    // Update overall status
    if (this.readBy.driver.isRead && this.readBy.admin.isRead) {
        this.status = 'read';
    } else if (this.readBy.driver.isRead || this.readBy.admin.isRead) {
        this.status = 'delivered';
    }

    return this.save();
};

// Method to detect emergency keywords
messageSchema.methods.detectEmergency = function () {
    const emergencyKeywords = [
        'emergency', 'urgent', 'help', 'accident', 'crash', 'injury',
        'stuck', 'broken', 'danger', 'police', 'ambulance', 'fire',
        'theft', 'robbery', 'assault', 'harassment', 'threat'
    ];

    const messageText = this.message.toLowerCase();
    const foundKeywords = emergencyKeywords.filter(keyword =>
        messageText.includes(keyword)
    );

    if (foundKeywords.length > 0) {
        this.isEmergency = true;
        this.type = 'emergency';
        this.priority = 'urgent';
        this.emergencyKeywords = foundKeywords;
    }

    return foundKeywords.length > 0;
};

// Static method to get unread count
messageSchema.statics.getUnreadCount = function (userId, userType) {
    const query = userType === 'driver'
        ? { driverId: userId, 'readBy.driver.isRead': false, isDeleted: false }
        : { adminId: userId, 'readBy.admin.isRead': false, isDeleted: false };

    return this.countDocuments(query);
};

// Static method to get recent messages
messageSchema.statics.getRecentMessages = function (driverId, limit = 50) {
    return this.find({
        driverId,
        isDeleted: false
    })
        .populate('driverId', 'fullName email profilePicture')
        .populate('adminId', 'name email')
        .sort({ timestamp: -1 })
        .limit(limit);
};

// Ensure virtuals are included in JSON output
messageSchema.set('toJSON', { virtuals: true });
messageSchema.set('toObject', { virtuals: true });

// Add pagination plugin
messageSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('Message', messageSchema);
