const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const conversationSchema = new mongoose.Schema({
    driverId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Driver',
        required: true
    },
    assignedAdminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
        // Optional - conversation can be unassigned initially
        default: null
    },
    status: {
        type: String,
        enum: ['active', 'resolved', 'archived', 'waiting'],
        default: 'waiting'
    },
    priority: {
        type: String,
        enum: ['low', 'normal', 'high', 'urgent'],
        default: 'normal'
    },
    subject: {
        type: String,
        trim: true,
        maxlength: [200, 'Subject cannot exceed 200 characters']
    },
    lastMessage: {
        message: String,
        senderType: {
            type: String,
            enum: ['driver', 'admin']
        },
        timestamp: {
            type: Date,
            default: Date.now
        },
        isRead: {
            type: Boolean,
            default: false
        }
    },
    messageCount: {
        type: Number,
        default: 0
    },
    unreadCount: {
        driver: {
            type: Number,
            default: 0
        },
        admin: {
            type: Number,
            default: 0
        }
    },
    tags: [{
        type: String,
        enum: ['document', 'delivery', 'earnings', 'technical', 'emergency', 'general']
    }],
    isEmergency: {
        type: Boolean,
        default: false
    },
    emergencyKeywords: [{
        type: String
    }],
    location: { // For emergency conversations
        lat: { type: Number },
        lng: { type: Number }
    },
    resolvedAt: {
        type: Date
    },
    resolvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin'
    },
    resolution: {
        type: String,
        trim: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for conversation age
conversationSchema.virtual('age').get(function () {
    const now = new Date();
    const diffMs = now - this.createdAt;
    const diffMinutes = Math.round(diffMs / (1000 * 60));
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
});

// Virtual for last message age
conversationSchema.virtual('lastMessageAge').get(function () {
    if (!this.lastMessage?.timestamp) return 'No messages';

    const now = new Date();
    const diffMs = now - this.lastMessage.timestamp;
    const diffMinutes = Math.round(diffMs / (1000 * 60));
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
});

// Virtual for conversation summary
conversationSchema.virtual('summary').get(function () {
    if (this.subject) return this.subject;
    if (this.lastMessage?.message) {
        return this.lastMessage.message.length > 50
            ? this.lastMessage.message.substring(0, 50) + '...'
            : this.lastMessage.message;
    }
    return 'New conversation';
});

// Indexes for efficient querying
conversationSchema.index({ driverId: 1, status: 1 });
conversationSchema.index({ assignedAdminId: 1, status: 1 });
conversationSchema.index({ status: 1, priority: 1, updatedAt: -1 });
conversationSchema.index({ isEmergency: 1, status: 1 });
conversationSchema.index({ 'lastMessage.timestamp': -1 });

// Update the updatedAt field before saving
conversationSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

// Add pagination plugin
conversationSchema.plugin(mongoosePaginate);

const Conversation = mongoose.model('Conversation', conversationSchema);
module.exports = Conversation;
