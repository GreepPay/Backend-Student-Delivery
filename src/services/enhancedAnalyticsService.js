const Driver = require('../models/Driver');
const Delivery = require('../models/Delivery');
const Remittance = require('../models/Remittance');
const DriverInvitation = require('../models/DriverInvitation');
const moment = require('moment');

class EnhancedAnalyticsService {
    // Get comprehensive platform analytics
    static async getPlatformAnalytics(period = 'month') {
        try {
            const { startDate, endDate } = this.getDateRange(period);

            // Core metrics
            const coreMetrics = await this.getCoreMetrics(startDate, endDate);

            // Financial metrics
            const financialMetrics = await this.getFinancialMetrics(startDate, endDate);

            // Driver metrics
            const driverMetrics = await this.getDriverMetrics(startDate, endDate);

            // Delivery metrics
            const deliveryMetrics = await this.getDeliveryMetrics(startDate, endDate);

            // Performance metrics
            const performanceMetrics = await this.getPerformanceMetrics(startDate, endDate);

            // Document verification metrics
            const documentMetrics = await this.getDocumentVerificationMetrics(startDate, endDate);

            // Remittance metrics
            const remittanceMetrics = await this.getRemittanceMetrics(startDate, endDate);

            // Growth metrics
            const growthMetrics = await this.getGrowthMetrics(startDate, endDate);

            return {
                period,
                startDate,
                endDate,
                core: coreMetrics,
                financial: financialMetrics,
                drivers: driverMetrics,
                deliveries: deliveryMetrics,
                performance: performanceMetrics,
                documents: documentMetrics,
                remittances: remittanceMetrics,
                growth: growthMetrics,
                lastUpdated: new Date().toISOString()
            };
        } catch (error) {
            console.error('Platform Analytics Error:', error);
            throw error;
        }
    }

    // Core platform metrics
    static async getCoreMetrics(startDate, endDate) {
        const [
            totalDrivers,
            activeDrivers,
            onlineDrivers,
            totalDeliveries,
            completedDeliveries,
            pendingDeliveries,
            totalRevenue,
            totalDriverEarnings,
            platformFees
        ] = await Promise.all([
            Driver.countDocuments(),
            Driver.countDocuments({ isActive: true }),
            Driver.countDocuments({ isOnline: true }),
            Delivery.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } }),
            Delivery.countDocuments({
                status: 'delivered',
                deliveredAt: { $gte: startDate, $lte: endDate }
            }),
            Delivery.countDocuments({
                status: 'pending',
                createdAt: { $gte: startDate, $lte: endDate }
            }),
            Delivery.aggregate([
                {
                    $match: {
                        status: 'delivered',
                        deliveredAt: { $gte: startDate, $lte: endDate }
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: '$fee' }
                    }
                }
            ]).then(result => result[0]?.total || 0),
            Delivery.aggregate([
                {
                    $match: {
                        status: 'delivered',
                        deliveredAt: { $gte: startDate, $lte: endDate }
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: '$driverEarning' }
                    }
                }
            ]).then(result => result[0]?.total || 0),
            Delivery.aggregate([
                {
                    $match: {
                        status: 'delivered',
                        deliveredAt: { $gte: startDate, $lte: endDate }
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: { $subtract: ['$fee', '$driverEarning'] } }
                    }
                }
            ]).then(result => result[0]?.total || 0)
        ]);

        return {
            totalDrivers,
            activeDrivers,
            onlineDrivers,
            totalDeliveries,
            completedDeliveries,
            pendingDeliveries,
            totalRevenue,
            totalDriverEarnings,
            platformFees,
            completionRate: totalDeliveries > 0 ? Math.round((completedDeliveries / totalDeliveries) * 100 * 10) / 10 : 0,
            activeDriverRate: totalDrivers > 0 ? Math.round((activeDrivers / totalDrivers) * 100 * 10) / 10 : 0,
            onlineDriverRate: totalDrivers > 0 ? Math.round((onlineDrivers / totalDrivers) * 100 * 10) / 10 : 0
        };
    }

    // Financial metrics
    static async getFinancialMetrics(startDate, endDate) {
        const revenueData = await Delivery.aggregate([
            {
                $match: {
                    status: 'delivered',
                    deliveredAt: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$deliveredAt' },
                        month: { $month: '$deliveredAt' },
                        day: { $dayOfMonth: '$deliveredAt' }
                    },
                    revenue: { $sum: '$fee' },
                    driverEarnings: { $sum: '$driverEarning' },
                    platformFees: { $sum: { $subtract: ['$fee', '$driverEarning'] } },
                    deliveries: { $sum: 1 }
                }
            },
            {
                $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
            }
        ]);

        const paymentMethodBreakdown = await Delivery.aggregate([
            {
                $match: {
                    status: 'delivered',
                    deliveredAt: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: '$paymentMethod',
                    count: { $sum: 1 },
                    revenue: { $sum: '$fee' }
                }
            }
        ]);

        const averageOrderValue = await Delivery.aggregate([
            {
                $match: {
                    status: 'delivered',
                    deliveredAt: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: null,
                    avgOrderValue: { $avg: '$fee' },
                    avgDriverEarning: { $avg: '$driverEarning' }
                }
            }
        ]);

        return {
            revenueData,
            paymentMethodBreakdown,
            averageOrderValue: averageOrderValue[0]?.avgOrderValue || 0,
            averageDriverEarning: averageOrderValue[0]?.avgDriverEarning || 0,
            totalRevenue: revenueData.reduce((sum, day) => sum + day.revenue, 0),
            totalDriverEarnings: revenueData.reduce((sum, day) => sum + day.driverEarnings, 0),
            totalPlatformFees: revenueData.reduce((sum, day) => sum + day.platformFees, 0)
        };
    }

    // Driver metrics
    static async getDriverMetrics(startDate, endDate) {
        const driverStats = await Driver.aggregate([
            {
                $lookup: {
                    from: 'deliveries',
                    localField: '_id',
                    foreignField: 'assignedTo',
                    as: 'deliveries'
                }
            },
            {
                $addFields: {
                    completedDeliveries: {
                        $size: {
                            $filter: {
                                input: { $ifNull: ['$deliveries', []] },
                                cond: {
                                    $and: [
                                        { $eq: ['$$this.status', 'delivered'] },
                                        { $gte: ['$$this.deliveredAt', startDate] },
                                        { $lte: ['$$this.deliveredAt', endDate] }
                                    ]
                                }
                            }
                        }
                    },
                    totalEarnings: {
                        $sum: {
                            $map: {
                                input: {
                                    $filter: {
                                        input: { $ifNull: ['$deliveries', []] },
                                        cond: {
                                            $and: [
                                                { $eq: ['$$this.status', 'delivered'] },
                                                { $gte: ['$$this.deliveredAt', startDate] },
                                                { $lte: ['$$this.deliveredAt', endDate] }
                                            ]
                                        }
                                    }
                                },
                                as: 'delivery',
                                in: '$$delivery.driverEarning'
                            }
                        }
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    totalDrivers: { $sum: 1 },
                    activeDrivers: { $sum: { $cond: ['$isActive', 1, 0] } },
                    onlineDrivers: { $sum: { $cond: ['$isOnline', 1, 0] } },
                    verifiedDrivers: { $sum: { $cond: ['$isDocumentVerified', 1, 0] } },
                    suspendedDrivers: { $sum: { $cond: ['$isSuspended', 1, 0] } },
                    avgDeliveriesPerDriver: { $avg: '$completedDeliveries' },
                    avgEarningsPerDriver: { $avg: '$totalEarnings' },
                    totalDriverEarnings: { $sum: '$totalEarnings' }
                }
            }
        ]);

        const driverActivity = await Driver.aggregate([
            {
                $match: {
                    lastLogin: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$lastLogin' },
                        month: { $month: '$lastLogin' },
                        day: { $dayOfMonth: '$lastLogin' }
                    },
                    activeDrivers: { $sum: 1 }
                }
            },
            {
                $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
            }
        ]);

        const topPerformers = await Delivery.aggregate([
            {
                $match: {
                    status: 'delivered',
                    deliveredAt: { $gte: startDate, $lte: endDate },
                    assignedTo: { $ne: null }
                }
            },
            {
                $group: {
                    _id: '$assignedTo',
                    deliveries: { $sum: 1 },
                    earnings: { $sum: '$driverEarning' },
                    avgRating: { $avg: '$driverRating' }
                }
            },
            {
                $lookup: {
                    from: 'drivers',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'driver'
                }
            },
            {
                $unwind: '$driver'
            },
            {
                $project: {
                    name: '$driver.fullName',
                    area: '$driver.area',
                    deliveries: 1,
                    earnings: 1,
                    avgRating: { $round: ['$avgRating', 1] },
                    avgEarningsPerDelivery: { $round: [{ $divide: ['$earnings', '$deliveries'] }, 0] }
                }
            },
            {
                $sort: { deliveries: -1, earnings: -1 }
            },
            {
                $limit: 10
            }
        ]);

        return {
            stats: driverStats[0] || {
                totalDrivers: 0,
                activeDrivers: 0,
                onlineDrivers: 0,
                verifiedDrivers: 0,
                suspendedDrivers: 0,
                avgDeliveriesPerDriver: 0,
                avgEarningsPerDriver: 0,
                totalDriverEarnings: 0
            },
            activity: driverActivity,
            topPerformers
        };
    }

    // Delivery metrics
    static async getDeliveryMetrics(startDate, endDate) {
        const deliveryStats = await Delivery.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    revenue: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, '$fee', 0] } }
                }
            }
        ]);

        const deliveryTrends = await Delivery.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' },
                        day: { $dayOfMonth: '$createdAt' }
                    },
                    total: { $sum: 1 },
                    completed: {
                        $sum: {
                            $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0]
                        }
                    },
                    revenue: {
                        $sum: {
                            $cond: [{ $eq: ['$status', 'delivered'] }, '$fee', 0]
                        }
                    }
                }
            },
            {
                $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
            }
        ]);

        const areaPerformance = await Delivery.aggregate([
            {
                $match: {
                    status: 'delivered',
                    deliveredAt: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: '$pickupLocation',
                    deliveries: { $sum: 1 },
                    revenue: { $sum: '$fee' },
                    avgDeliveryTime: {
                        $avg: {
                            $divide: [
                                { $subtract: ['$deliveredAt', '$assignedAt'] },
                                1000 * 60 // Convert to minutes
                            ]
                        }
                    }
                }
            },
            {
                $sort: { deliveries: -1 }
            },
            {
                $limit: 10
            }
        ]);

        return {
            statusBreakdown: deliveryStats,
            trends: deliveryTrends,
            areaPerformance,
            totalDeliveries: deliveryStats.reduce((sum, stat) => sum + stat.count, 0),
            completedDeliveries: deliveryStats.find(s => s._id === 'delivered')?.count || 0,
            totalRevenue: deliveryStats.reduce((sum, stat) => sum + stat.revenue, 0)
        };
    }

    // Performance metrics
    static async getPerformanceMetrics(startDate, endDate) {
        const performanceData = await Delivery.aggregate([
            {
                $match: {
                    status: 'delivered',
                    deliveredAt: { $gte: startDate, $lte: endDate },
                    assignedTo: { $ne: null }
                }
            },
            {
                $group: {
                    _id: '$assignedTo',
                    deliveries: { $sum: 1 },
                    totalTime: {
                        $sum: {
                            $divide: [
                                { $subtract: ['$deliveredAt', '$assignedAt'] },
                                1000 * 60 // Convert to minutes
                            ]
                        }
                    },
                    avgRating: { $avg: '$driverRating' }
                }
            },
            {
                $lookup: {
                    from: 'drivers',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'driver'
                }
            },
            {
                $unwind: '$driver'
            },
            {
                $project: {
                    name: '$driver.fullName',
                    area: '$driver.area',
                    deliveries: 1,
                    avgDeliveryTime: { $round: [{ $divide: ['$totalTime', '$deliveries'] }, 1] },
                    avgRating: { $round: ['$avgRating', 1] }
                }
            }
        ]);

        const avgDeliveryTime = performanceData.length > 0
            ? performanceData.reduce((sum, driver) => sum + driver.avgDeliveryTime, 0) / performanceData.length
            : 0;

        const avgRating = performanceData.length > 0
            ? performanceData.reduce((sum, driver) => sum + driver.avgRating, 0) / performanceData.length
            : 0;

        return {
            driverPerformance: performanceData,
            avgDeliveryTime: Math.round(avgDeliveryTime * 10) / 10,
            avgRating: Math.round(avgRating * 10) / 10,
            totalDrivers: performanceData.length
        };
    }

    // Document verification metrics
    static async getDocumentVerificationMetrics(startDate, endDate) {
        const documentStats = await Driver.aggregate([
            {
                $project: {
                    documents: { $ifNull: ['$documents', {}] },
                    isDocumentVerified: 1,
                    joinedAt: 1
                }
            },
            {
                $addFields: {
                    pendingDocuments: {
                        $size: {
                            $filter: {
                                input: { $objectToArray: '$documents' },
                                cond: { $eq: ['$$this.v.status', 'pending'] }
                            }
                        }
                    },
                    verifiedDocuments: {
                        $size: {
                            $filter: {
                                input: { $objectToArray: '$documents' },
                                cond: { $eq: ['$$this.v.status', 'verified'] }
                            }
                        }
                    },
                    rejectedDocuments: {
                        $size: {
                            $filter: {
                                input: { $objectToArray: '$documents' },
                                cond: { $eq: ['$$this.v.status', 'rejected'] }
                            }
                        }
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    totalDrivers: { $sum: 1 },
                    verifiedDrivers: { $sum: { $cond: ['$isDocumentVerified', 1, 0] } },
                    pendingDrivers: { $sum: { $cond: [{ $gt: ['$pendingDocuments', 0] }, 1, 0] } },
                    totalPendingDocuments: { $sum: '$pendingDocuments' },
                    totalVerifiedDocuments: { $sum: '$verifiedDocuments' },
                    totalRejectedDocuments: { $sum: '$rejectedDocuments' }
                }
            }
        ]);

        const documentTrends = await Driver.aggregate([
            {
                $match: {
                    joinedAt: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$joinedAt' },
                        month: { $month: '$joinedAt' },
                        day: { $dayOfMonth: '$joinedAt' }
                    },
                    newDrivers: { $sum: 1 },
                    verifiedDrivers: { $sum: { $cond: ['$isDocumentVerified', 1, 0] } }
                }
            },
            {
                $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
            }
        ]);

        return {
            stats: documentStats[0] || {
                totalDrivers: 0,
                verifiedDrivers: 0,
                pendingDrivers: 0,
                totalPendingDocuments: 0,
                totalVerifiedDocuments: 0,
                totalRejectedDocuments: 0
            },
            trends: documentTrends,
            verificationRate: documentStats[0]?.totalDrivers > 0
                ? Math.round((documentStats[0].verifiedDrivers / documentStats[0].totalDrivers) * 100 * 10) / 10
                : 0
        };
    }

    // Remittance metrics
    static async getRemittanceMetrics(startDate, endDate) {
        const remittanceStats = await Remittance.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    totalAmount: { $sum: '$amount' }
                }
            }
        ]);

        const remittanceTrends = await Remittance.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' },
                        day: { $dayOfMonth: '$createdAt' }
                    },
                    count: { $sum: 1 },
                    totalAmount: { $sum: '$amount' }
                }
            },
            {
                $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
            }
        ]);

        const pendingRemittances = await Remittance.countDocuments({ status: 'pending' });
        const completedRemittances = await Remittance.countDocuments({ status: 'completed' });

        return {
            statusBreakdown: remittanceStats,
            trends: remittanceTrends,
            pendingRemittances,
            completedRemittances,
            totalRemittances: remittanceStats.reduce((sum, stat) => sum + stat.count, 0),
            totalAmount: remittanceStats.reduce((sum, stat) => sum + stat.totalAmount, 0)
        };
    }

    // Growth metrics
    static async getGrowthMetrics(startDate, endDate) {
        const previousPeriod = this.getPreviousPeriod(startDate, endDate);

        const [currentMetrics, previousMetrics] = await Promise.all([
            this.getCoreMetrics(startDate, endDate),
            this.getCoreMetrics(previousPeriod.startDate, previousPeriod.endDate)
        ]);

        const driverGrowth = previousMetrics.totalDrivers > 0
            ? ((currentMetrics.totalDrivers - previousMetrics.totalDrivers) / previousMetrics.totalDrivers) * 100
            : 0;

        const deliveryGrowth = previousMetrics.totalDeliveries > 0
            ? ((currentMetrics.totalDeliveries - previousMetrics.totalDeliveries) / previousMetrics.totalDeliveries) * 100
            : 0;

        const revenueGrowth = previousMetrics.totalRevenue > 0
            ? ((currentMetrics.totalRevenue - previousMetrics.totalRevenue) / previousMetrics.totalRevenue) * 100
            : 0;

        return {
            driverGrowth: Math.round(driverGrowth * 10) / 10,
            deliveryGrowth: Math.round(deliveryGrowth * 10) / 10,
            revenueGrowth: Math.round(revenueGrowth * 10) / 10,
            currentPeriod: currentMetrics,
            previousPeriod: previousMetrics
        };
    }

    // Get date range helper
    static getDateRange(period) {
        const now = moment();
        let startDate, endDate;

        switch (period) {
            case 'today':
                startDate = moment().startOf('day').toDate();
                endDate = moment().endOf('day').toDate();
                break;
            case 'week':
                startDate = moment().startOf('week').toDate();
                endDate = moment().endOf('week').toDate();
                break;
            case 'month':
                startDate = moment().startOf('month').toDate();
                endDate = moment().endOf('month').toDate();
                break;
            case 'quarter':
                startDate = moment().startOf('quarter').toDate();
                endDate = moment().endOf('quarter').toDate();
                break;
            case 'year':
                startDate = moment().startOf('year').toDate();
                endDate = moment().endOf('year').toDate();
                break;
            default:
                startDate = moment().startOf('month').toDate();
                endDate = moment().endOf('month').toDate();
        }

        return { startDate, endDate };
    }

    // Get previous period helper
    static getPreviousPeriod(startDate, endDate) {
        const duration = endDate - startDate;
        return {
            startDate: new Date(startDate.getTime() - duration),
            endDate: new Date(startDate.getTime())
        };
    }
}

module.exports = EnhancedAnalyticsService;
