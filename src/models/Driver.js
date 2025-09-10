const mongoose = require('mongoose');

const driverSchema = new mongoose.Schema({
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    fullName: {
        type: String,
        trim: true,
        minlength: [2, 'Full name must be at least 2 characters long']
    },
    // Backward compatibility - keep old field for existing documents
    name: {
        type: String,
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
        enum: ['Lefkosa'],
        default: 'Lefkosa'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isOnline: {
        type: Boolean,
        default: false
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
        default: 3.0,
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
    // Referral points system
    referralPoints: {
        type: Number,
        default: 0,
        min: 0
    },
    profilePicture: {
        type: String,
        trim: true
    },
    transportationType: {
        type: String,
        enum: ['bicycle', 'motorcycle', 'scooter', 'car', 'walking', 'other'],
        default: 'other',
        trim: true
    },
    // Verification fields for account status
    isEmailVerified: {
        type: Boolean,
        default: true // Since they use OTP login, email is verified
    },
    isPhoneVerified: {
        type: Boolean,
        default: false
    },
    isDocumentVerified: {
        type: Boolean,
        default: false // For ID/license verification
    },
    // Document verification tracking
    documents: {
        studentId: {
            status: {
                type: String,
                enum: ['pending', 'verified', 'rejected'],
                default: 'pending'
            },
            uploadDate: Date,
            documentUrl: String,
            rejectionReason: String,
            verificationDate: Date,
            aiVerification: {
                classification: Object,
                extractedText: Object,
                faceDetection: Object,
                authenticity: Object,
                fraudDetection: Object,
                confidence: Number
            }
        },
        profilePhoto: {
            status: {
                type: String,
                enum: ['pending', 'verified', 'rejected'],
                default: 'pending'
            },
            uploadDate: Date,
            documentUrl: String,
            rejectionReason: String,
            verificationDate: Date,
            aiVerification: {
                classification: Object,
                extractedText: Object,
                faceDetection: Object,
                authenticity: Object,
                fraudDetection: Object,
                confidence: Number
            }
        },
        passportPhoto: {
            status: {
                type: String,
                enum: ['pending', 'verified', 'rejected'],
                default: 'pending'
            },
            uploadDate: Date,
            documentUrl: String,
            rejectionReason: String,
            verificationDate: Date,
            aiVerification: {
                classification: Object,
                extractedText: Object,
                faceDetection: Object,
                authenticity: Object,
                fraudDetection: Object,
                confidence: Number
            }
        },

    },
    // University information
    university: {
        type: String,
        enum: [
            'Eastern Mediterranean University (EMU)',
            'Near East University (NEU)',
            'Cyprus International University (CIU)',
            'Girne American University (GAU)',
            'University of Kyrenia (UoK)',
            'European University of Lefke (EUL)',
            'Middle East Technical University (METU) – Northern Cyprus Campus',
            'Final International University (FIU)',
            'Bahçeşehir Cyprus University (BAU)',
            'University of Mediterranean Karpasia (UMK)',
            'Cyprus Health and Social Science University',
            'Arkin University of Creative Arts & Design',
            'Cyprus West University'
        ],
        default: 'Eastern Mediterranean University (EMU)'
    },
    // Address information - Lefkosa service areas
    address: {
        type: String,
        trim: true,
        enum: [
            'Kaymakli',
            'Hamitköy',
            'Yenişehir',
            'Kumsal',
            'Gönyeli',
            'Dereboyu',
            'Ortaköy',
            'Yenikent',
            'Taskinkoy',
            'Metehan',
            'Gocmenkoy',
            'Haspolat',
            'Alaykoy',
            'Marmara',
            'Terminal/City Center'
        ],
        default: 'Terminal/City Center'
    },
    // Violations and suspensions tracking
    violations: [{
        type: {
            type: String,
            enum: ['late_delivery', 'customer_complaint', 'policy_violation', 'other']
        },
        description: String,
        date: {
            type: Date,
            default: Date.now
        },
        severity: {
            type: String,
            enum: ['low', 'medium', 'high'],
            default: 'medium'
        }
    }],
    suspensions: [{
        reason: String,
        startDate: Date,
        endDate: Date,
        isActive: {
            type: Boolean,
            default: false
        }
    }],

    // Persistent profile completion data
    storedProfileCompletion: {
        overall: {
            type: Number,
            default: 0,
            min: 0,
            max: 100
        },
        sections: {
            personalDetails: {
                completed: { type: Number, default: 0 },
                total: { type: Number, default: 4 },
                percentage: { type: Number, default: 0 }
            },
            studentInfo: {
                completed: { type: Number, default: 0 },
                total: { type: Number, default: 2 },
                percentage: { type: Number, default: 0 }
            },
            transportation: {
                completed: { type: Number, default: 0 },
                total: { type: Number, default: 2 },
                percentage: { type: Number, default: 0 }
            },
            verification: {
                completed: { type: Number, default: 0 },
                total: { type: Number, default: 3 },
                percentage: { type: Number, default: 0 }
            },
            documents: {
                completed: { type: Number, default: 0 },
                total: { type: Number, default: 5 },
                percentage: { type: Number, default: 0 }
            }
        },
        isComplete: {
            type: Boolean,
            default: false
        },
        readyForDeliveries: {
            type: Boolean,
            default: false
        },
        lastCalculated: {
            type: Date,
            default: Date.now
        }
    },

    // Persistent verification status
    storedVerification: {
        studentVerified: {
            type: Boolean,
            default: false
        },
        profileComplete: {
            type: Boolean,
            default: false
        },
        activeDeliveryPartner: {
            type: Boolean,
            default: false
        },
        lastUpdated: {
            type: Date,
            default: Date.now
        }
    }
}, {
    timestamps: true
});

// Indexes for better query performance
driverSchema.index({ email: 1, isActive: 1 });
driverSchema.index({ area: 1, isActive: 1 });
driverSchema.index({ totalDeliveries: -1 });
driverSchema.index({ totalEarnings: -1 });

// Virtual getter for fullName that handles backward compatibility
driverSchema.virtual('fullNameComputed').get(function () {
    return this.fullName || this.name || '';
});

// Ensure fullName is always available for frontend
driverSchema.methods.getFullName = function () {
    return this.fullName || this.name || '';
};

// Calculate and store profile completion data
driverSchema.methods.calculateAndStoreCompletion = function () {
    // Get the current computed completion
    const computed = this.profileCompletion;

    // Store in database fields
    this.storedProfileCompletion = {
        overall: computed.overall,
        sections: computed.sections,
        isComplete: computed.isComplete,
        readyForDeliveries: computed.readyForDeliveries,
        lastCalculated: new Date()
    };

    return this.storedProfileCompletion;
};

// Calculate and store verification status
driverSchema.methods.calculateAndStoreVerification = function () {
    // Get the current computed verification status
    const accountStatus = this.accountStatus;

    // Store in database fields
    this.storedVerification = {
        studentVerified: accountStatus.verification.studentVerified,
        profileComplete: accountStatus.verification.profileComplete,
        activeDeliveryPartner: accountStatus.verification.activeDeliveryPartner,
        lastUpdated: new Date()
    };

    return this.storedVerification;
};

// Pre-save hook to synchronize name fields and update completion data
driverSchema.pre('save', function (next) {
    // If fullName is set but name isn't, copy fullName to name for backward compatibility
    if (this.fullName && !this.name) {
        this.name = this.fullName;
    }
    // If name is set but fullName isn't, copy name to fullName for forward compatibility
    else if (this.name && !this.fullName) {
        this.fullName = this.name;
    }

    // Automatically calculate and store completion data when driver is saved
    try {
        this.calculateAndStoreCompletion();
        this.calculateAndStoreVerification();
    } catch (error) {
        console.warn('Error calculating profile completion:', error.message);
    }

    next();
});

// Ensure toObject and toJSON include the computed fullName
driverSchema.set('toObject', { virtuals: true });
driverSchema.set('toJSON', {
    virtuals: true,
    transform: function (doc, ret) {
        // Always ensure fullName is present in API responses
        if (!ret.fullName && ret.name) {
            ret.fullName = ret.name;
        }
        // Remove the name field from API responses to enforce fullName usage
        delete ret.name;
        return ret;
    }
});

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

// Virtual for verification status
driverSchema.virtual('verificationStatus').get(function () {
    if (this.isSuspended) {
        return {
            status: 'suspended',
            message: 'Account suspended',
            reason: this.suspensionReason
        };
    }

    if (!this.isActive) {
        return {
            status: 'inactive',
            message: 'Account inactive'
        };
    }

    const isDocumentsVerified = this.documents?.studentId?.status === 'verified' &&
        this.documents?.profilePhoto?.status === 'verified' &&
        this.documents?.passportPhoto?.status === 'verified';

    const verificationCount = [
        this.isEmailVerified,
        isDocumentsVerified
    ].filter(Boolean).length;

    if (verificationCount === 2) {
        return {
            status: 'verified',
            message: 'Account fully verified'
        };
    } else if (verificationCount >= 1) {
        return {
            status: 'partial',
            message: 'Account partially verified'
        };
    } else {
        return {
            status: 'unverified',
            message: 'Account not verified'
        };
    }
});

// Virtual for member since (formatted)
driverSchema.virtual('memberSince').get(function () {
    return this.joinedAt;
});

// Virtual for account age in days
driverSchema.virtual('accountAge').get(function () {
    if (!this.joinedAt) return 0;
    const diffTime = Math.abs(new Date() - this.joinedAt);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for verification progress percentage
driverSchema.virtual('verificationProgress').get(function () {
    const checks = [
        // Basic profile information
        (this.fullName || this.name) && (this.fullName || this.name).trim().length >= 2,
        this.email && this.email.includes('@'),
        this.phone && this.phone.length >= 8,
        this.studentId && this.studentId.trim().length >= 4,
        this.university && this.university !== '',
        this.area && this.area !== 'Other',
        this.transportationType && this.transportationType !== 'other',
        this.address && this.address !== 'Other',

        // Verification status
        this.isEmailVerified,

        // Document verification
        this.documents?.studentId?.status === 'verified',
        this.documents?.profilePhoto?.status === 'verified',
        this.documents?.passportPhoto?.status === 'verified'
    ];



    const completedChecks = checks.filter(Boolean).length;
    return Math.round((completedChecks / checks.length) * 100);
});

// Virtual for profile completion status with detailed breakdown
driverSchema.virtual('profileCompletion').get(function () {
    const sections = {
        personalDetails: {
            name: (this.fullName || this.name) && (this.fullName || this.name).trim().length >= 2,
            email: this.email && this.email.includes('@'),
            phone: this.phone && this.phone.length >= 8,
            address: this.address && this.address !== 'Other'
        },
        studentInfo: {
            studentId: this.studentId && this.studentId.trim().length >= 4,
            university: this.university && this.university !== ''
        },
        transportation: {
            method: this.transportationType && this.transportationType !== 'other',
            area: this.area && this.area !== 'Other'
        },
        verification: {
            email: this.isEmailVerified,
            documents: this.documents?.studentId?.status === 'verified' &&
                this.documents?.profilePhoto?.status === 'verified' &&
                this.documents?.passportPhoto?.status === 'verified'
        },
        documents: {
            studentId: this.documents?.studentId?.status === 'verified',
            profilePhoto: this.documents?.profilePhoto?.status === 'verified' || (this.profilePicture && this.profilePicture.includes('cloudinary.com')),
            passportPhoto: this.documents?.passportPhoto?.status === 'verified'
        }
    };

    // Calculate completion percentage for each section
    const sectionCompletions = {};
    let totalComplete = 0;
    let totalPossible = 0;

    for (const [sectionName, fields] of Object.entries(sections)) {
        const completed = Object.values(fields).filter(Boolean).length;
        const total = Object.values(fields).length;
        sectionCompletions[sectionName] = {
            completed,
            total,
            percentage: Math.round((completed / total) * 100)
        };
        totalComplete += completed;
        totalPossible += total;
    }

    return {
        overall: Math.round((totalComplete / totalPossible) * 100),
        sections: sectionCompletions,
        isComplete: totalComplete === totalPossible,
        readyForDeliveries: this.isActive && !this.isSuspended &&
            sectionCompletions.verification.percentage >= 100 && // 2/2 verified (email + documents)
            sectionCompletions.personalDetails.percentage >= 75 && // 3/4 complete
            sectionCompletions.studentInfo.percentage === 100 // All student info
    };
});

// Virtual for comprehensive account status
driverSchema.virtual('accountStatus').get(function () {
    const violations = this.violations || [];
    const activeSuspensions = (this.suspensions || []).filter(s => s.isActive);
    const profileCompletion = this.profileCompletion;

    return {
        profile: {
            personalDetails: {
                fullName: this.fullName || this.name,
                email: this.email,
                phone: this.phone,
                address: this.address
            },
            studentInfo: {
                studentId: this.studentId,
                university: this.university
            },
            transportation: {
                method: this.transportationType,
                area: this.area
            }
        },
        verification: {
            studentVerified: this.documents?.studentId?.status === 'verified',
            profileComplete: profileCompletion.overall >= 80,
            activeDeliveryPartner: this.isActive && !this.isSuspended && profileCompletion.readyForDeliveries
        },
        documents: {
            studentId: {
                status: this.documents?.studentId?.status || 'pending',
                uploadDate: this.documents?.studentId?.uploadDate,
                rejectionReason: this.documents?.studentId?.rejectionReason
            },
            profilePhoto: {
                status: this.documents?.profilePhoto?.status === 'verified' || (this.profilePicture && this.profilePicture.includes('cloudinary.com')) ? 'verified' : 'pending',
                uploadDate: this.documents?.profilePhoto?.uploadDate || (this.profilePicture ? new Date() : undefined),
                rejectionReason: this.documents?.profilePhoto?.rejectionReason
            },
            passportPhoto: {
                status: this.documents?.passportPhoto?.status || 'pending',
                uploadDate: this.documents?.passportPhoto?.uploadDate,
                rejectionReason: this.documents?.passportPhoto?.rejectionReason
            },

        },
        completion: profileCompletion,
        deliveries: {
            total: this.totalDeliveries,
            completed: this.completedDeliveries,
            cancelled: this.totalDeliveries - this.completedDeliveries,
            rating: this.rating,
            completionRate: this.completionRate
        },
        account: {
            age: this.accountAge,
            memberSince: this.joinedAt,
            lastLogin: this.lastLogin,
            isActive: this.isActive,
            isSuspended: this.isSuspended,
            suspensionReason: this.suspensionReason,
            referralPoints: this.referralPoints || 0
        },
        violations: violations,
        suspensions: activeSuspensions
    };
});

// Static method to find active driver by email
driverSchema.statics.findActiveByEmail = function (email) {
    return this.findOne({ email, isActive: true });
};

// Static method to get drivers by area
driverSchema.statics.findByArea = function (area, activeOnly = true) {
    const query = { area };
    if (activeOnly) query.isActive = true;
    return this.find(query).sort({ fullName: 1 });
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