const EarningsConfig = require('../models/EarningsConfig');
const EarningsService = require('../services/earningsService');
const { catchAsync, successResponse, errorResponse } = require('../middleware/errorHandler');

class EarningsConfigController {
    // Get current active earnings configuration
    static getActiveConfig = catchAsync(async (req, res) => {
        try {
            const config = await EarningsConfig.getActiveConfig();

            if (!config) {
                return res.status(404).json({
                    success: false,
                    error: 'No active earnings configuration found'
                });
            }

            successResponse(res, config, 'Active earnings configuration retrieved successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Get all earnings configurations
    static getAllConfigs = catchAsync(async (req, res) => {
        try {
            const { page = 1, limit = 20 } = req.query;

            const configs = await EarningsConfig.find()
                .populate('createdBy', 'name email')
                .populate('updatedBy', 'name email')
                .sort({ effectiveDate: -1 })
                .limit(limit * 1)
                .skip((page - 1) * limit);

            const total = await EarningsConfig.countDocuments();

            res.status(200).json({
                success: true,
                message: 'Earnings configurations retrieved successfully',
                data: {
                    configs,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        pages: Math.ceil(total / parseInt(limit))
                    }
                }
            });
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Create new earnings configuration
    static createConfig = catchAsync(async (req, res) => {
        try {
            const { name, rules, notes } = req.body;
            const { user } = req;

            // Validate rules
            const config = new EarningsConfig({
                name,
                rules,
                notes,
                createdBy: user.id,
                effectiveDate: new Date()
            });

            // Validate the configuration
            config.validateRules();

            // Deactivate all other configs
            await EarningsConfig.updateMany(
                { isActive: true },
                { isActive: false }
            );

            // Save new configuration
            const savedConfig = await config.save();

            successResponse(res, savedConfig, 'Earnings configuration created successfully');
        } catch (error) {
            errorResponse(res, error, 400);
        }
    });

    // Update earnings configuration
    static updateConfig = catchAsync(async (req, res) => {
        try {
            const { configId } = req.params;
            const { name, rules, notes, isActive } = req.body;
            const { user } = req;

            const config = await EarningsConfig.findById(configId);
            if (!config) {
                return res.status(404).json({
                    success: false,
                    error: 'Earnings configuration not found'
                });
            }

            // Update fields
            if (name) config.name = name;
            if (rules) config.rules = rules;
            if (notes !== undefined) config.notes = notes;
            if (isActive !== undefined) config.isActive = isActive;

            config.updatedBy = user.id;
            config.version += 1;

            // Validate the configuration
            config.validateRules();

            // If activating this config, deactivate others
            if (isActive) {
                await EarningsConfig.updateMany(
                    { _id: { $ne: configId }, isActive: true },
                    { isActive: false }
                );
            }

            const updatedConfig = await config.save();

            successResponse(res, updatedConfig, 'Earnings configuration updated successfully');
        } catch (error) {
            errorResponse(res, error, 400);
        }
    });

    // Delete earnings configuration
    static deleteConfig = catchAsync(async (req, res) => {
        try {
            const { configId } = req.params;

            const config = await EarningsConfig.findById(configId);
            if (!config) {
                return res.status(404).json({
                    success: false,
                    error: 'Earnings configuration not found'
                });
            }

            // Don't allow deletion of active config
            if (config.isActive) {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot delete active earnings configuration'
                });
            }

            await EarningsConfig.findByIdAndDelete(configId);

            successResponse(res, null, 'Earnings configuration deleted successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Test earnings calculation with current rules
    static testEarningsCalculation = catchAsync(async (req, res) => {
        try {
            const { fee } = req.body;

            if (!fee || typeof fee !== 'number' || fee <= 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Valid fee amount is required'
                });
            }

            // Get active configuration
            const config = await EarningsConfig.getActiveConfig();
            const rules = config ? config.getRulesArray() : EarningsService.defaultEarningsRules.rules;

            const earnings = await EarningsService.calculateEarnings(fee, rules);

            successResponse(res, {
                fee,
                earnings,
                rulesApplied: rules
            }, 'Earnings calculation test completed');
        } catch (error) {
            errorResponse(res, error, 400);
        }
    });

    // Bulk update existing deliveries with new earnings rules
    static bulkUpdateDeliveries = catchAsync(async (req, res) => {
        try {
            const { deliveryIds, configId } = req.body;
            const { user } = req;

            if (!Array.isArray(deliveryIds) || deliveryIds.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Delivery IDs array is required'
                });
            }

            let rules = null;
            if (configId) {
                const config = await EarningsConfig.findById(configId);
                if (!config) {
                    return res.status(404).json({
                        success: false,
                        error: 'Earnings configuration not found'
                    });
                }
                rules = config.getRulesArray();
            }

            const results = await EarningsService.bulkUpdateEarnings(deliveryIds, rules);

            const successCount = results.filter(r => r.success).length;
            const failureCount = results.filter(r => !r.success).length;

            successResponse(res, {
                results,
                summary: {
                    total: deliveryIds.length,
                    success: successCount,
                    failure: failureCount
                }
            }, `Bulk update completed: ${successCount} successful, ${failureCount} failed`);
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Get earnings statistics
    static getEarningsStats = catchAsync(async (req, res) => {
        try {
            const { startDate, endDate, driverId } = req.query;

            let query = {};
            if (startDate && endDate) {
                query.deliveredAt = {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                };
            }

            if (driverId) {
                query.assignedTo = driverId;
            }

            const stats = await EarningsService.getSystemEarningsStats(query);

            successResponse(res, stats, 'Earnings statistics retrieved successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });
}

module.exports = EarningsConfigController; 