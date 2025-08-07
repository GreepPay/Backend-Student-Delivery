const Driver = require('../models/Driver');
const Delivery = require('../models/Delivery');
const moment = require('moment');

class AnalyticsService {
    // Get driver analytics for specific period
    static async getDriverAnalytics(driverId, period = 'month', month = null, year = null, customStartDate = null, customEndDate = null) {
        try {
            let startDate, endDate;

            if (period === 'custom' && customStartDate && customEndDate) {
                startDate = new Date(customStartDate);
                endDate = new Date(customEndDate);
                // Set end date to end of day
                endDate.setHours(23, 59, 59, 999);
                console.log('🔍 Custom date range:', { startDate, endDate, customStartDate, customEndDate });
            } else {
                const dateRange = this.getDateRange(period, month, year);
                startDate = dateRange.startDate;
                endDate = dateRange.endDate;
                console.log('🔍 Predefined date range:', { startDate, endDate, period });
            }

            // Get driver info
            const driver = await Driver.findById(driverId);
            if (!driver) {
                throw new Error('Driver not found');
            }

            // Get deliveries in the period
            const deliveries = await Delivery.find({
                assignedTo: driverId,
                status: 'delivered',
                deliveredAt: { $gte: startDate, $lte: endDate }
            }).sort({ deliveredAt: 1 });

            // Calculate basic stats
            const totalDeliveries = deliveries.length;
            const totalEarnings = deliveries.reduce((sum, delivery) => sum + delivery.driverEarning, 0);

            // Group deliveries by day
            const dailyStats = this.groupDeliveriesByDay(deliveries, startDate, endDate);

            // Calculate averages
            const periodDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
            const averagePerDay = totalDeliveries / periodDays;
            const averageEarningsPerDay = totalEarnings / periodDays;

            // Get completion rate for assigned deliveries
            const assignedDeliveries = await Delivery.countDocuments({
                assignedTo: driverId,
                createdAt: { $gte: startDate, $lte: endDate }
            });

            const completionRate = assignedDeliveries > 0 ? (totalDeliveries / assignedDeliveries) * 100 : 0;

            // Get performance trends
            const trends = this.calculateTrends(dailyStats);

            return {
                period,
                startDate,
                endDate,
                driver: {
                    id: driver._id,
                    name: driver.name,
                    email: driver.email,
                    area: driver.area
                },
                stats: {
                    totalDeliveries,
                    totalEarnings,
                    averagePerDay: Math.round(averagePerDay * 10) / 10,
                    averageEarningsPerDay: Math.round(averageEarningsPerDay),
                    completionRate: Math.round(completionRate * 10) / 10,
                    averageEarningsPerDelivery: totalDeliveries > 0 ? Math.round(totalEarnings / totalDeliveries) : 0
                },
                dailyStats,
                trends,
                bestDay: this.getBestDay(dailyStats),
                remissionOwed: this.calculateRemissionOwed(deliveries)
            };
        } catch (error) {
            console.error('Driver Analytics Error:', error.message);
            throw error;
        }
    }

    // Get system-wide analytics for admin dashboard
    static async getSystemAnalytics(period = 'month', month = null, year = null) {
        try {
            const { startDate, endDate } = this.getDateRange(period, month, year);

            // For all-time, we don't apply date filters to basic counts
            const dateFilter = period === 'all-time' ? {} : { createdAt: { $gte: startDate, $lte: endDate } };
            const deliveredDateFilter = period === 'all-time' ? {} : { deliveredAt: { $gte: startDate, $lte: endDate } };

            // Basic counts
            const [
                totalDrivers,
                activeDrivers,
                totalDeliveries,
                completedDeliveries,
                pendingDeliveries,
                assignedDeliveries
            ] = await Promise.all([
                Driver.countDocuments(),
                Driver.countDocuments({ isActive: true }),
                Delivery.countDocuments(dateFilter),
                Delivery.countDocuments({
                    status: 'delivered',
                    ...deliveredDateFilter
                }),
                Delivery.countDocuments({ status: 'pending' }),
                Delivery.countDocuments({ status: 'assigned' })
            ]);

            // Calculate revenue
            const revenueData = await Delivery.aggregate([
                {
                    $match: {
                        status: 'delivered',
                        ...deliveredDateFilter
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalRevenue: { $sum: '$fee' },
                        totalDriverEarnings: { $sum: '$driverEarning' }
                    }
                }
            ]);

            const totalRevenue = revenueData.length > 0 ? revenueData[0].totalRevenue : 0;
            const totalDriverEarnings = revenueData.length > 0 ? revenueData[0].totalDriverEarnings : 0;

            // Calculate completion rate
            const completionRate = totalDeliveries > 0 ? (completedDeliveries / totalDeliveries) * 100 : 0;

            // Get previous period for comparison (skip for all-time)
            let previousCompleted = 0;
            let deliveryChange = 0;

            if (period !== 'all-time') {
                const previousPeriod = this.getPreviousPeriod(startDate, endDate);
                previousCompleted = await Delivery.countDocuments({
                    status: 'delivered',
                    deliveredAt: { $gte: previousPeriod.startDate, $lte: previousPeriod.endDate }
                });

                deliveryChange = previousCompleted > 0 ?
                    ((completedDeliveries - previousCompleted) / previousCompleted) * 100 : 0;
            }

            return {
                period,
                startDate,
                endDate,
                stats: {
                    totalDrivers,
                    activeDrivers,
                    totalDeliveries,
                    completedDeliveries,
                    pendingDeliveries,
                    assignedDeliveries,
                    totalRevenue,
                    totalDriverEarnings,
                    completionRate: Math.round(completionRate * 10) / 10,
                    deliveryChange: Math.round(deliveryChange * 10) / 10
                }
            };
        } catch (error) {
            console.error('System Analytics Error:', error.message);
            throw error;
        }
    }

    // Get system stats (simplified version)
    static async getSystemStats(period = 'month') {
        try {
            const analytics = await this.getSystemAnalytics(period);
            return analytics.stats;
        } catch (error) {
            console.error('System Stats Error:', error.message);
            throw error;
        }
    }

    // Get detailed analytics for analytics page
    static async getDetailedAnalytics(period = 'month') {
        try {
            const { startDate, endDate } = this.getDateRange(period);

            // Get basic stats - include all deliveries in the period, not just delivered ones
            const [
                totalDrivers,
                activeDrivers,
                totalDeliveries,
                completedDeliveries,
                pendingDeliveries,
                assignedDeliveries
            ] = await Promise.all([
                Driver.countDocuments(),
                Driver.countDocuments({ isActive: true }),
                Delivery.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } }),
                Delivery.countDocuments({
                    status: 'delivered',
                    deliveredAt: { $gte: startDate, $lte: endDate }
                }),
                Delivery.countDocuments({ status: 'pending' }),
                Delivery.countDocuments({ status: 'assigned' })
            ]);

            // Calculate revenue from completed deliveries
            const revenueData = await Delivery.aggregate([
                {
                    $match: {
                        status: 'delivered',
                        deliveredAt: { $gte: startDate, $lte: endDate }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalRevenue: { $sum: '$fee' },
                        totalDriverEarnings: { $sum: '$driverEarning' }
                    }
                }
            ]);

            const totalRevenue = revenueData.length > 0 ? revenueData[0].totalRevenue : 0;
            const totalDriverEarnings = revenueData.length > 0 ? revenueData[0].totalDriverEarnings : 0;

            // Get previous period for comparison
            const previousPeriod = this.getPreviousPeriod(startDate, endDate);
            const previousCompleted = await Delivery.countDocuments({
                status: 'delivered',
                deliveredAt: { $gte: previousPeriod.startDate, $lte: previousPeriod.endDate }
            });

            const previousRevenue = await Delivery.aggregate([
                {
                    $match: {
                        status: 'delivered',
                        deliveredAt: { $gte: previousPeriod.startDate, $lte: previousPeriod.endDate }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalRevenue: { $sum: '$fee' }
                    }
                }
            ]);

            const previousRevenueAmount = previousRevenue.length > 0 ? previousRevenue[0].totalRevenue : 0;

            // Calculate changes
            const deliveryChange = previousCompleted > 0 ?
                ((completedDeliveries - previousCompleted) / previousCompleted) * 100 : 0;
            const revenueChange = previousRevenueAmount > 0 ?
                ((totalRevenue - previousRevenueAmount) / previousRevenueAmount) * 100 : 0;

            // Calculate average rating (mock for now)
            const avgRating = 4.8;
            const ratingChange = 0.2;

            return {
                revenue: totalRevenue,
                revenueChange: Math.round(revenueChange * 10) / 10,
                deliveries: totalDeliveries, // Use total deliveries instead of just completed
                deliveriesChange: Math.round(deliveryChange * 10) / 10,
                drivers: activeDrivers,
                driversChange: 15.2, // Mock for now
                rating: avgRating,
                ratingChange: ratingChange
            };
        } catch (error) {
            console.error('Detailed Analytics Error:', error.message);
            throw error;
        }
    }

    // Get revenue data for charts
    static async getRevenueData(period = 'month') {
        try {
            const { startDate, endDate } = this.getDateRange(period);

            // Group by month for the last 6 months
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
                            month: { $month: '$deliveredAt' }
                        },
                        revenue: { $sum: '$fee' }
                    }
                },
                {
                    $sort: { '_id.year': 1, '_id.month': 1 }
                }
            ]);

            // Format for frontend
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return revenueData.map(item => ({
                month: months[item._id.month - 1],
                revenue: item.revenue
            }));
        } catch (error) {
            console.error('Revenue Data Error:', error.message);
            throw error;
        }
    }

    // Get delivery status breakdown
    static async getDeliveryStatus(period = 'month') {
        try {
            const { startDate, endDate } = this.getDateRange(period);

            const statusData = await Delivery.aggregate([
                {
                    $match: {
                        createdAt: { $gte: startDate, $lte: endDate }
                    }
                },
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 }
                    }
                }
            ]);

            const total = statusData.reduce((sum, item) => sum + item.count, 0);

            return statusData.map(item => ({
                status: item._id === 'delivered' ? 'Completed' :
                    item._id === 'assigned' ? 'In Progress' : 'Pending',
                count: item.count,
                percentage: total > 0 ? Math.round((item.count / total) * 100 * 10) / 10 : 0
            }));
        } catch (error) {
            console.error('Delivery Status Error:', error.message);
            throw error;
        }
    }

    // Get top areas
    static async getTopAreas(period = 'month') {
        try {
            const { startDate, endDate } = this.getDateRange(period);

            const areaData = await Delivery.aggregate([
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
                        revenue: { $sum: '$fee' }
                    }
                },
                {
                    $sort: { deliveries: -1 }
                },
                {
                    $limit: 5
                }
            ]);

            return areaData.map(item => ({
                area: item._id,
                deliveries: item.deliveries,
                revenue: item.revenue
            }));
        } catch (error) {
            console.error('Top Areas Error:', error.message);
            throw error;
        }
    }

    // Get driver performance
    static async getDriverPerformance(period = 'month') {
        try {
            const { startDate, endDate } = this.getDateRange(period);

            const driverData = await Delivery.aggregate([
                {
                    $match: {
                        status: 'delivered',
                        deliveredAt: { $gte: startDate, $lte: endDate }
                    }
                },
                {
                    $group: {
                        _id: '$assignedTo',
                        deliveries: { $sum: 1 },
                        earnings: { $sum: '$driverEarning' }
                    }
                },
                {
                    $sort: { deliveries: -1 }
                },
                {
                    $limit: 5
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
                }
            ]);

            return driverData.map(item => ({
                name: item.driver.name,
                deliveries: item.deliveries,
                rating: 4.8, // Mock for now
                earnings: item.earnings
            }));
        } catch (error) {
            console.error('Driver Performance Error:', error.message);
            throw error;
        }
    }

    // Get date range based on period
    static getDateRange(period, month = null, year = null) {
        const now = moment();
        let startDate, endDate;

        switch (period) {
            case 'today':
                // Use local timezone for today's calculations
                startDate = moment().startOf('day').toDate();
                endDate = moment().endOf('day').toDate();
                break;
            case 'week':
                startDate = moment().startOf('week').toDate();
                endDate = moment().endOf('week').toDate();
                break;
            case 'month':
                if (month && year) {
                    startDate = moment().year(year).month(month - 1).startOf('month').toDate();
                    endDate = moment().year(year).month(month - 1).endOf('month').toDate();
                } else {
                    startDate = moment().startOf('month').toDate();
                    endDate = moment().endOf('month').toDate();
                }
                break;
            case 'year':
                if (year) {
                    startDate = moment().year(year).startOf('year').toDate();
                    endDate = moment().year(year).endOf('year').toDate();
                } else {
                    startDate = moment().startOf('year').toDate();
                    endDate = moment().endOf('year').toDate();
                }
                break;
            case 'all-time':
                // For all-time, we don't set date limits - will get all data
                startDate = new Date(0); // Unix epoch start
                endDate = new Date(); // Current date
                break;
            default:
                startDate = moment().startOf('month').toDate();
                endDate = moment().endOf('month').toDate();
        }

        return { startDate, endDate };
    }

    // Group deliveries by day
    static groupDeliveriesByDay(deliveries, startDate, endDate) {
        const dailyStats = {};

        // Initialize all days in range with zero values
        let currentDate = moment(startDate);
        while (currentDate.isSameOrBefore(endDate, 'day')) {
            const dateKey = currentDate.format('YYYY-MM-DD');
            dailyStats[dateKey] = {
                date: dateKey,
                deliveries: 0,
                earnings: 0
            };
            currentDate.add(1, 'day');
        }

        // Add actual delivery data
        deliveries.forEach(delivery => {
            const dateKey = moment(delivery.deliveredAt).format('YYYY-MM-DD');
            if (dailyStats[dateKey]) {
                dailyStats[dateKey].deliveries += 1;
                dailyStats[dateKey].earnings += delivery.driverEarning;
            }
        });

        return Object.values(dailyStats).sort((a, b) => a.date.localeCompare(b.date));
    }

    // Calculate performance trends
    static calculateTrends(dailyStats) {
        if (dailyStats.length < 2) {
            return { deliveryTrend: 0, earningsTrend: 0 };
        }

        const firstHalf = dailyStats.slice(0, Math.floor(dailyStats.length / 2));
        const secondHalf = dailyStats.slice(Math.floor(dailyStats.length / 2));

        const firstHalfAvgDeliveries = firstHalf.reduce((sum, day) => sum + day.deliveries, 0) / firstHalf.length;
        const secondHalfAvgDeliveries = secondHalf.reduce((sum, day) => sum + day.deliveries, 0) / secondHalf.length;

        const firstHalfAvgEarnings = firstHalf.reduce((sum, day) => sum + day.earnings, 0) / firstHalf.length;
        const secondHalfAvgEarnings = secondHalf.reduce((sum, day) => sum + day.earnings, 0) / secondHalf.length;

        const deliveryTrend = firstHalfAvgDeliveries > 0
            ? ((secondHalfAvgDeliveries - firstHalfAvgDeliveries) / firstHalfAvgDeliveries) * 100
            : 0;

        const earningsTrend = firstHalfAvgEarnings > 0
            ? ((secondHalfAvgEarnings - firstHalfAvgEarnings) / firstHalfAvgEarnings) * 100
            : 0;

        return {
            deliveryTrend: Math.round(deliveryTrend * 10) / 10,
            earningsTrend: Math.round(earningsTrend * 10) / 10
        };
    }

    // Get best performing day
    static getBestDay(dailyStats) {
        if (dailyStats.length === 0) return null;

        return dailyStats.reduce((best, current) => {
            if (current.deliveries > best.deliveries ||
                (current.deliveries === best.deliveries && current.earnings > best.earnings)) {
                return current;
            }
            return best;
        });
    }

    // Calculate remission owed based on deliveries
    static calculateRemissionOwed(deliveries) {
        const remissionPerDelivery = 50; // Company's share per cash delivery
        // Filter for cash deliveries that are NOT settled (remittanceStatus !== 'settled')
        const unsettledCashDeliveries = deliveries.filter(delivery =>
            delivery.paymentMethod === 'cash' &&
            delivery.remittanceStatus !== 'settled'
        );
        const totalOwed = unsettledCashDeliveries.length * remissionPerDelivery;

        return {
            totalDeliveries: deliveries.length,
            cashDeliveries: deliveries.filter(d => d.paymentMethod === 'cash').length,
            unsettledCashDeliveries: unsettledCashDeliveries.length,
            amountPerDelivery: remissionPerDelivery,
            totalOwed: totalOwed
        };
    }

    // Get top performing drivers
    static async getTopDrivers(startDate, endDate, limit = 5) {
        try {
            // For all-time, don't apply date filters but still filter by status and assignedTo
            const dateFilter = startDate.getTime() === new Date(0).getTime() ? {
                status: 'delivered',
                assignedTo: { $ne: null }
            } : {
                status: 'delivered',
                deliveredAt: { $gte: startDate, $lte: endDate },
                assignedTo: { $ne: null }
            };

            const topDrivers = await Delivery.aggregate([
                {
                    $match: dateFilter
                },
                {
                    $group: {
                        _id: '$assignedTo',
                        totalDeliveries: { $sum: 1 },
                        totalEarnings: { $sum: '$driverEarning' },
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
                        _id: 1,
                        name: '$driver.name',
                        email: '$driver.email',
                        area: '$driver.area',
                        totalDeliveries: 1,
                        totalEarnings: 1,
                        avgDeliveryTime: { $round: ['$avgDeliveryTime', 1] },
                        avgEarningsPerDelivery: {
                            $round: [{ $divide: ['$totalEarnings', '$totalDeliveries'] }, 0]
                        }
                    }
                },
                {
                    $sort: { totalDeliveries: -1, totalEarnings: -1 }
                },
                {
                    $limit: limit
                }
            ]);

            return topDrivers;
        } catch (error) {
            console.error('Top Drivers Error:', error.message);
            return [];
        }
    }

    // Get system daily trends
    static async getSystemDailyTrends(startDate, endDate) {
        try {
            const trends = await Delivery.aggregate([
                {
                    $match: {
                        createdAt: { $gte: startDate, $lte: endDate }
                    }
                },
                {
                    $group: {
                        _id: {
                            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                            status: '$status'
                        },
                        count: { $sum: 1 },
                        revenue: {
                            $sum: {
                                $cond: [{ $eq: ['$status', 'delivered'] }, '$fee', 0]
                            }
                        }
                    }
                },
                {
                    $group: {
                        _id: '$_id.date',
                        total: { $sum: '$count' },
                        delivered: {
                            $sum: {
                                $cond: [{ $eq: ['$_id.status', 'delivered'] }, '$count', 0]
                            }
                        },
                        pending: {
                            $sum: {
                                $cond: [{ $eq: ['$_id.status', 'pending'] }, '$count', 0]
                            }
                        },
                        revenue: { $sum: '$revenue' }
                    }
                },
                {
                    $sort: { _id: 1 }
                }
            ]);

            return trends.map(trend => ({
                date: trend._id,
                totalDeliveries: trend.total,
                completedDeliveries: trend.delivered,
                pendingDeliveries: trend.pending,
                revenue: trend.revenue,
                completionRate: trend.total > 0 ? Math.round((trend.delivered / trend.total) * 100) : 0
            }));
        } catch (error) {
            console.error('Daily Trends Error:', error.message);
            return [];
        }
    }

    // Get area performance
    static async getAreaPerformance(startDate, endDate) {
        try {
            const areaStats = await Delivery.aggregate([
                {
                    $match: {
                        status: 'delivered',
                        deliveredAt: { $gte: startDate, $lte: endDate },
                        assignedTo: { $ne: null }
                    }
                },
                {
                    $lookup: {
                        from: 'drivers',
                        localField: 'assignedTo',
                        foreignField: '_id',
                        as: 'driver'
                    }
                },
                {
                    $unwind: '$driver'
                },
                {
                    $group: {
                        _id: '$driver.area',
                        totalDeliveries: { $sum: 1 },
                        totalRevenue: { $sum: '$fee' },
                        totalDrivers: { $addToSet: '$assignedTo' },
                        avgDeliveryTime: {
                            $avg: {
                                $divide: [
                                    { $subtract: ['$deliveredAt', '$assignedAt'] },
                                    1000 * 60
                                ]
                            }
                        }
                    }
                },
                {
                    $project: {
                        area: '$_id',
                        totalDeliveries: 1,
                        totalRevenue: 1,
                        totalDrivers: { $size: '$totalDrivers' },
                        avgDeliveryTime: { $round: ['$avgDeliveryTime', 1] },
                        avgDeliveriesPerDriver: {
                            $round: [
                                { $divide: ['$totalDeliveries', { $size: '$totalDrivers' }] },
                                1
                            ]
                        }
                    }
                },
                {
                    $sort: { totalDeliveries: -1 }
                }
            ]);

            return areaStats;
        } catch (error) {
            console.error('Area Performance Error:', error.message);
            return [];
        }
    }

    // Get driver leaderboard
    static async getDriverLeaderboard(period = 'month', limit = 10) {
        try {
            const { startDate, endDate } = this.getDateRange(period);

            const leaderboard = await Delivery.aggregate([
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
                        totalDeliveries: { $sum: 1 },
                        totalEarnings: { $sum: '$driverEarning' },
                        totalRevenue: { $sum: '$fee' }
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
                        _id: 1,
                        name: '$driver.name',
                        area: '$driver.area',
                        totalDeliveries: 1,
                        totalEarnings: 1,
                        totalRevenue: 1,
                        rank: { $add: ['$totalDeliveries', { $divide: ['$totalEarnings', 100] }] } // Weighted ranking
                    }
                },
                {
                    $sort: { rank: -1, totalDeliveries: -1 }
                },
                {
                    $limit: limit
                }
            ]);

            // Add position numbers
            return leaderboard.map((driver, index) => ({
                ...driver,
                position: index + 1
            }));
        } catch (error) {
            console.error('Leaderboard Error:', error.message);
            return [];
        }
    }

    // Get earnings breakdown for a driver
    static async getDriverEarningsBreakdown(driverId, period = 'month', customStartDate = null, customEndDate = null) {
        try {
            let startDate, endDate;

            if (period === 'custom' && customStartDate && customEndDate) {
                startDate = new Date(customStartDate);
                endDate = new Date(customEndDate);
                // Set end date to end of day
                endDate.setHours(23, 59, 59, 999);
            } else {
                const dateRange = this.getDateRange(period);
                startDate = dateRange.startDate;
                endDate = dateRange.endDate;
            }

            // Get all delivered deliveries in the date range
            const deliveries = await Delivery.find({
                assignedTo: driverId,
                status: 'delivered',
                deliveredAt: { $gte: startDate, $lte: endDate }
            }).sort({ deliveredAt: 1 });

            // Group by week
            const weeklyBreakdown = {};

            deliveries.forEach(delivery => {
                const deliveryDate = new Date(delivery.deliveredAt);
                const weekKey = `${deliveryDate.getFullYear()}-W${this.getWeekNumber(deliveryDate)}`;

                if (!weeklyBreakdown[weekKey]) {
                    weeklyBreakdown[weekKey] = {
                        week: this.getWeekNumber(deliveryDate),
                        year: deliveryDate.getFullYear(),
                        deliveries: 0,
                        earnings: 0,
                        revenue: 0,
                        remissionOwed: 0
                    };
                }

                weeklyBreakdown[weekKey].deliveries += 1;
                weeklyBreakdown[weekKey].earnings += delivery.driverEarning || 0;
                weeklyBreakdown[weekKey].revenue += delivery.fee || 0;
                // Only add remission for cash payments (drivers owe remission for cash they collected)
                if (delivery.paymentMethod === 'cash') {
                    weeklyBreakdown[weekKey].remissionOwed += 50; // ₺50 per cash delivery
                }
            });

            const result = Object.values(weeklyBreakdown).sort((a, b) => {
                if (a.year !== b.year) return a.year - b.year;
                return a.week - b.week;
            });

            return result;
        } catch (error) {
            console.error('Earnings Breakdown Error:', error.message);
            return [];
        }
    }

    // Helper method to get week number
    static getWeekNumber(date) {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    }

    // Helper method to get previous period
    static getPreviousPeriod(startDate, endDate) {
        const duration = endDate - startDate;
        return {
            startDate: new Date(startDate.getTime() - duration),
            endDate: new Date(startDate.getTime())
        };
    }
}

module.exports = AnalyticsService;