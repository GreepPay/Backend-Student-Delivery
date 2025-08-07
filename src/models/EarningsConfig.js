const mongoose = require('mongoose');

const earningsRuleSchema = new mongoose.Schema({
    minFee: {
        type: Number,
        required: true,
        min: 0
    },
    maxFee: {
        type: Number,
        required: true,
        min: 0
    },
    driverPercentage: {
        type: Number,
        min: 0,
        max: 100,
        default: null
    },
    driverFixed: {
        type: Number,
        min: 0,
        default: null
    },
    companyPercentage: {
        type: Number,
        min: 0,
        max: 100,
        default: null
    },
    companyFixed: {
        type: Number,
        min: 0,
        default: null
    },
    description: {
        type: String,
        trim: true
    }
});

const earningsConfigSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        default: 'Default Earnings Rules'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    rules: [earningsRuleSchema],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
        required: false // Allow null for system initialization
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin'
    },
    version: {
        type: Number,
        default: 1
    },
    effectiveDate: {
        type: Date,
        default: Date.now
    },
    notes: {
        type: String,
        trim: true
    }
}, {
    timestamps: true
});

// Indexes
earningsConfigSchema.index({ isActive: 1 });
earningsConfigSchema.index({ effectiveDate: -1 });

// Static method to get active configuration
earningsConfigSchema.statics.getActiveConfig = function () {
    return this.findOne({ isActive: true }).sort({ effectiveDate: -1 });
};

// Static method to create new configuration
earningsConfigSchema.statics.createConfig = function (configData) {
    return this.create(configData);
};

// Instance method to validate rules
earningsConfigSchema.methods.validateRules = function () {
    if (!this.rules || this.rules.length === 0) {
        throw new Error('At least one earnings rule is required');
    }

    // Check for overlapping fee ranges
    const sortedRules = this.rules.sort((a, b) => a.minFee - b.minFee);

    for (let i = 0; i < sortedRules.length; i++) {
        const rule = sortedRules[i];

        // Validate individual rule
        if (rule.minFee > rule.maxFee) {
            throw new Error(`Rule ${i + 1}: minFee cannot be greater than maxFee`);
        }

        if (rule.driverFixed !== null && rule.driverPercentage !== null) {
            throw new Error(`Rule ${i + 1}: Cannot have both fixed and percentage for driver earnings`);
        }

        if (rule.driverFixed === null && rule.driverPercentage === null) {
            throw new Error(`Rule ${i + 1}: Must specify either fixed amount or percentage for driver earnings`);
        }

        if (rule.driverFixed !== null && rule.driverFixed < 0) {
            throw new Error(`Rule ${i + 1}: Driver fixed amount cannot be negative`);
        }

        if (rule.driverPercentage !== null && (rule.driverPercentage < 0 || rule.driverPercentage > 100)) {
            throw new Error(`Rule ${i + 1}: Driver percentage must be between 0 and 100`);
        }

        // Check for gaps or overlaps with next rule
        if (i < sortedRules.length - 1) {
            const nextRule = sortedRules[i + 1];
            if (rule.maxFee >= nextRule.minFee) {
                throw new Error(`Rule ${i + 1} overlaps with rule ${i + 2}: fee ranges must be distinct`);
            }
        }
    }

    return true;
};

// Instance method to get rules as array for earnings service
earningsConfigSchema.methods.getRulesArray = function () {
    return this.rules.map(rule => ({
        minFee: rule.minFee,
        maxFee: rule.maxFee,
        driverPercentage: rule.driverPercentage,
        driverFixed: rule.driverFixed,
        companyPercentage: rule.companyPercentage,
        companyFixed: rule.companyFixed
    }));
};

module.exports = mongoose.model('EarningsConfig', earningsConfigSchema); 