const Remittance = require('../models/Remittance');
const Driver = require('../models/Driver');
const Delivery = require('../models/Delivery');
const RemittanceService = require('../services/remittanceService');
const { catchAsync, successResponse, errorResponse, paginatedResponse } = require('../middleware/errorHandler');

class RemittanceController {
    // Get all remittances with filters
    static getRemittances = catchAsync(async (req, res) => {
        const { page = 1, limit = 10, status, driverId, startDate, endDate } = req.query;
        const { user } = req;

        try {
            // Build filter object
            const filter = {};

            if (status) {
                filter.status = status;
            }

            if (driverId) {
                filter.driverId = driverId;
            }

            if (startDate && endDate) {
                filter.createdAt = {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                };
            }

            // Get remittances with pagination
            const remittances = await Remittance.find(filter)
                .populate('driverId', 'fullName email phone area')
                .populate('handledBy', 'name email')
                .sort({ createdAt: -1 })
                .limit(limit * 1)
                .skip((page - 1) * limit);

            // Get total count
            const total = await Remittance.countDocuments(filter);

            // Get statistics
            const statistics = await RemittanceService.getRemittanceStatistics();

            successResponse(res, {
                remittances,
                pagination: {
                    currentPage: page * 1,
                    totalPages: Math.ceil(total / limit),
                    totalItems: total,
                    itemsPerPage: limit * 1
                },
                statistics
            }, 'Remittances retrieved successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Create new remittance
    static createRemittance = catchAsync(async (req, res) => {
        const { driverId, startDate, endDate, dueDateDays = 7 } = req.body;
        const { user } = req;

        try {
            // Generate remittance using service
            const result = await RemittanceService.generateRemittance(
                driverId,
                new Date(startDate),
                new Date(endDate),
                user.id,
                dueDateDays
            );

            successResponse(res, result, 'Remittance created successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Get remittance by ID
    static getRemittanceById = catchAsync(async (req, res) => {
        const { remittanceId } = req.params;

        try {
            const remittance = await Remittance.findById(remittanceId)
                .populate('driverId', 'fullName email phone area')
                .populate('handledBy', 'name email')
                .populate('createdBy', 'name email');

            if (!remittance) {
                return res.status(404).json({
                    success: false,
                    error: 'Remittance not found'
                });
            }

            successResponse(res, { remittance }, 'Remittance retrieved successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Complete remittance
    static completeRemittance = catchAsync(async (req, res) => {
        const { remittanceId } = req.params;
        const { amount, paymentDate, reference, notes } = req.body;
        const { user } = req;

        try {
            const paymentDetails = {
                amount: parseFloat(amount),
                paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
                reference,
                notes
            };

            const result = await RemittanceService.completeRemittance(
                remittanceId,
                paymentDetails,
                user.id
            );

            successResponse(res, result, 'Remittance completed successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Cancel remittance
    static cancelRemittance = catchAsync(async (req, res) => {
        const { remittanceId } = req.params;
        const { reason } = req.body;
        const { user } = req;

        try {
            const remittance = await Remittance.findById(remittanceId);

            if (!remittance) {
                return res.status(404).json({
                    success: false,
                    error: 'Remittance not found'
                });
            }

            if (remittance.status === 'completed') {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot cancel completed remittance'
                });
            }

            remittance.status = 'cancelled';
            remittance.adminNotes = reason || 'Cancelled by admin';
            remittance.updatedBy = user.id;
            await remittance.save();

            successResponse(res, { remittance }, 'Remittance cancelled successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Send reminder for remittance
    static sendReminder = catchAsync(async (req, res) => {
        const { remittanceId } = req.params;
        const { user } = req;

        try {
            const result = await RemittanceService.sendReminder(remittanceId);
            successResponse(res, result, 'Reminder sent successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Calculate remittance amount for a driver
    static calculateRemittanceAmount = catchAsync(async (req, res) => {
        const { driverId, startDate, endDate } = req.query;

        try {
            const calculation = await RemittanceService.calculateRemittanceAmount(
                driverId,
                new Date(startDate),
                new Date(endDate)
            );

            successResponse(res, calculation, 'Remittance calculation completed');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Get driver remittance summary
    static getDriverRemittanceSummary = catchAsync(async (req, res) => {
        const { driverId } = req.params;

        try {
            const summary = await RemittanceService.getDriverRemittanceSummary(driverId);
            successResponse(res, { summary }, 'Driver remittance summary retrieved successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Get overdue remittances
    static getOverdueRemittances = catchAsync(async (req, res) => {
        try {
            const overdueRemittances = await RemittanceService.getOverdueRemittances();
            successResponse(res, { overdueRemittances }, 'Overdue remittances retrieved successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Get remittances due soon
    static getRemittancesDueSoon = catchAsync(async (req, res) => {
        const { daysAhead = 3 } = req.query;

        try {
            const dueSoonRemittances = await RemittanceService.getRemittancesDueSoon(parseInt(daysAhead));
            successResponse(res, { dueSoonRemittances }, 'Remittances due soon retrieved successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Get remittance statistics
    static getRemittanceStatistics = catchAsync(async (req, res) => {
        try {
            const statistics = await RemittanceService.getRemittanceStatistics();
            successResponse(res, { statistics }, 'Remittance statistics retrieved successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Bulk generate remittances for all drivers
    static bulkGenerateRemittances = catchAsync(async (req, res) => {
        const { startDate, endDate, dueDateDays = 7 } = req.body;
        const { user } = req;

        try {
            // Get all active drivers
            const drivers = await Driver.find({ isActive: true });

            const results = [];
            const errors = [];

            for (const driver of drivers) {
                try {
                    const calculation = await RemittanceService.calculateRemittanceAmount(
                        driver._id,
                        new Date(startDate),
                        new Date(endDate)
                    );

                    if (calculation.remittanceAmount > 0) {
                        const result = await RemittanceService.generateRemittance(
                            driver._id,
                            new Date(startDate),
                            new Date(endDate),
                            user.id,
                            dueDateDays
                        );
                        results.push(result);
                    }
                } catch (error) {
                    errors.push({
                        driverId: driver._id,
                        driverName: driver.fullName,
                        error: error.message
                    });
                }
            }

            successResponse(res, {
                generated: results.length,
                errors: errors.length,
                results,
                errors
            }, `Bulk remittance generation completed. Generated: ${results.length}, Errors: ${errors.length}`);
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Get current payment structure for remittance calculations
    static getPaymentStructure = catchAsync(async (req, res) => {
        try {
            const EarningsConfig = require('../models/EarningsConfig');
            const activeConfig = await EarningsConfig.getActiveConfig();

            let paymentStructure;
            if (activeConfig) {
                paymentStructure = {
                    name: activeConfig.name,
                    rules: activeConfig.getRulesArray(),
                    effectiveDate: activeConfig.effectiveDate,
                    notes: activeConfig.notes
                };
            } else {
                // Return default structure
                const EarningsService = require('../services/earningsService');
                paymentStructure = {
                    name: 'Default Earnings Rules',
                    rules: EarningsService.defaultEarningsRules.rules,
                    effectiveDate: new Date(),
                    notes: 'Default system configuration'
                };
            }

            successResponse(res, {
                paymentStructure,
                description: 'Current payment structure used for remittance calculations'
            }, 'Payment structure retrieved successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Get driver remittances with earnings summary for authenticated driver
    static getDriverRemittances = catchAsync(async (req, res) => {
        const { user } = req;
        const { page = 1, limit = 10 } = req.query;

        try {
            const remittances = await Remittance.find({ driverId: user.id })
                .sort({ createdAt: -1 })
                .limit(limit * 1)
                .skip((page - 1) * limit);

            const total = await Remittance.countDocuments({ driverId: user.id });
            const summary = await RemittanceService.getDriverRemittanceSummary(user.id);

            successResponse(res, {
                remittances,
                summary,
                pagination: {
                    currentPage: page * 1,
                    totalPages: Math.ceil(total / limit),
                    totalItems: total,
                    itemsPerPage: limit * 1
                }
            }, 'Driver remittance summary retrieved successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });
}

module.exports = RemittanceController; 