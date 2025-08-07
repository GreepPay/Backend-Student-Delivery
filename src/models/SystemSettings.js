const mongoose = require('mongoose');

const systemSettingsSchema = new mongoose.Schema({
    // Notification Settings
    notifications: {
        email: {
            type: Boolean,
            default: true
        },
        push: {
            type: Boolean,
            default: true
        },
        sms: {
            type: Boolean,
            default: false
        },
        deliveryUpdates: {
            type: Boolean,
            default: true
        },
        driverAssignments: {
            type: Boolean,
            default: true
        },
        systemAlerts: {
            type: Boolean,
            default: true
        },
        soundEnabled: {
            type: Boolean,
            default: true
        }
    },

    // Display Settings
    display: {
        language: {
            type: String,
            enum: ['en', 'tr', 'es', 'fr'],
            default: 'en'
        },
        timezone: {
            type: String,
            default: 'Europe/Istanbul'
        },
        currency: {
            type: String,
            enum: ['TRY', 'USD', 'EUR', 'GBP'],
            default: 'TRY'
        }
    },

    // Security Settings
    security: {
        twoFactor: {
            type: Boolean,
            default: false
        },
        sessionTimeout: {
            type: Number,
            min: 5,
            max: 1440, // 24 hours in minutes
            default: 30
        },
        loginNotifications: {
            type: Boolean,
            default: true
        }
    },

    // Delivery Settings
    delivery: {
        autoAssignDrivers: {
            type: Boolean,
            default: true
        },
        requireDriverConfirmation: {
            type: Boolean,
            default: false
        },
        maxDeliveryDistance: {
            type: Number,
            default: 50 // km
        },
        deliveryTimeEstimate: {
            type: Number,
            default: 30 // minutes
        }
    },

    // Earnings Settings
    earnings: {
        commissionRate: {
            type: Number,
            min: 0,
            max: 100,
            default: 80 // percentage
        },
        minimumPayout: {
            type: Number,
            default: 100 // TRY
        },
        payoutSchedule: {
            type: String,
            enum: ['daily', 'weekly', 'monthly'],
            default: 'weekly'
        }
    },

    // System Settings
    system: {
        maintenanceMode: {
            type: Boolean,
            default: false
        },
        allowNewRegistrations: {
            type: Boolean,
            default: true
        },
        maxActiveDeliveries: {
            type: Number,
            default: 5
        },
        driverRatingEnabled: {
            type: Boolean,
            default: true
        }
    },

    // Updated by
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
        required: true
    }
}, {
    timestamps: true
});

// Ensure only one system settings document exists
systemSettingsSchema.statics.getSettings = async function () {
    let settings = await this.findOne();
    if (!settings) {
        // Create default settings if none exist
        settings = await this.create({
            updatedBy: '000000000000000000000000' // Default admin ID
        });
    }
    return settings;
};

// Update settings
systemSettingsSchema.statics.updateSettings = async function (updates, adminId) {
    let settings = await this.findOne();
    if (!settings) {
        settings = new this({
            updatedBy: adminId
        });
    }

    // Update the settings
    Object.keys(updates).forEach(category => {
        if (settings[category]) {
            Object.keys(updates[category]).forEach(setting => {
                if (settings[category][setting] !== undefined) {
                    settings[category][setting] = updates[category][setting];
                }
            });
        }
    });

    settings.updatedBy = adminId;
    return await settings.save();
};

// Get settings for specific category
systemSettingsSchema.statics.getCategorySettings = async function (category) {
    const settings = await this.getSettings();
    return settings[category] || {};
};

// Validate settings before saving
systemSettingsSchema.pre('save', function (next) {
    // Validate currency
    if (this.display && !['TRY', 'USD', 'EUR', 'GBP'].includes(this.display.currency)) {
        return next(new Error('Invalid currency'));
    }

    // Validate language
    if (this.display && !['en', 'tr', 'es', 'fr'].includes(this.display.language)) {
        return next(new Error('Invalid language'));
    }

    // Validate session timeout
    if (this.security && (this.security.sessionTimeout < 5 || this.security.sessionTimeout > 1440)) {
        return next(new Error('Session timeout must be between 5 and 1440 minutes'));
    }

    // Validate commission rate
    if (this.earnings && (this.earnings.commissionRate < 0 || this.earnings.commissionRate > 100)) {
        return next(new Error('Commission rate must be between 0 and 100'));
    }

    next();
});

module.exports = mongoose.model('SystemSettings', systemSettingsSchema); 