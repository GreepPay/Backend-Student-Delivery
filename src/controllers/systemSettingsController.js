const SystemSettings = require('../models/SystemSettings');
const { catchAsync, successResponse, errorResponse } = require('../middleware/errorHandler');

class SystemSettingsController {
    // Get all system settings
    static getSettings = catchAsync(async (req, res) => {
        try {
            const settings = await SystemSettings.getSettings();

            // Remove sensitive fields before sending to frontend
            const safeSettings = {
                notifications: settings.notifications,
                display: settings.display,
                security: {
                    twoFactor: settings.security.twoFactor,
                    sessionTimeout: settings.security.sessionTimeout,
                    loginNotifications: settings.security.loginNotifications
                },
                delivery: settings.delivery,
                earnings: settings.earnings,
                system: settings.system,
                updatedAt: settings.updatedAt
            };

            successResponse(res, safeSettings, 'System settings retrieved successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Get settings for a specific category
    static getCategorySettings = catchAsync(async (req, res) => {
        try {
            const { category } = req.params;
            const settings = await SystemSettings.getCategorySettings(category);

            successResponse(res, settings, `${category} settings retrieved successfully`);
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Update system settings
    static updateSettings = catchAsync(async (req, res) => {
        try {
            const { updates } = req.body;
            const { user } = req;

            if (!user || user.userType !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied. Admin privileges required.'
                });
            }

            const updatedSettings = await SystemSettings.updateSettings(updates, user.id);

            // Remove sensitive fields before sending to frontend
            const safeSettings = {
                notifications: updatedSettings.notifications,
                display: updatedSettings.display,
                security: {
                    twoFactor: updatedSettings.security.twoFactor,
                    sessionTimeout: updatedSettings.security.sessionTimeout,
                    loginNotifications: updatedSettings.security.loginNotifications
                },
                delivery: updatedSettings.delivery,
                earnings: updatedSettings.earnings,
                system: updatedSettings.system,
                updatedAt: updatedSettings.updatedAt
            };

            successResponse(res, safeSettings, 'System settings updated successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Update specific category settings
    static updateCategorySettings = catchAsync(async (req, res) => {
        try {
            const { category } = req.params;
            const { updates } = req.body;
            const { user } = req;

            if (!user || user.userType !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied. Admin privileges required.'
                });
            }

            const categoryUpdates = { [category]: updates };
            const updatedSettings = await SystemSettings.updateSettings(categoryUpdates, user.id);

            successResponse(res, updatedSettings[category], `${category} settings updated successfully`);
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Reset settings to defaults
    static resetToDefaults = catchAsync(async (req, res) => {
        try {
            const { user } = req;

            if (!user || user.userType !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied. Admin privileges required.'
                });
            }

            // Delete existing settings and create new ones with defaults
            await SystemSettings.deleteMany({});
            const defaultSettings = await SystemSettings.create({
                updatedBy: user.id
            });

            successResponse(res, defaultSettings, 'Settings reset to defaults successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Get settings for drivers (limited access)
    static getDriverSettings = catchAsync(async (req, res) => {
        try {
            const settings = await SystemSettings.getSettings();

            // Only send driver-relevant settings
            const driverSettings = {
                display: settings.display,
                delivery: settings.delivery,
                earnings: settings.earnings,
                system: {
                    maxActiveDeliveries: settings.system.maxActiveDeliveries,
                    driverRatingEnabled: settings.system.driverRatingEnabled
                }
            };

            successResponse(res, driverSettings, 'Driver settings retrieved successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });

    // Get settings for public access (very limited)
    static getPublicSettings = catchAsync(async (req, res) => {
        try {
            const settings = await SystemSettings.getSettings();

            // Only send public settings
            const publicSettings = {
                display: {
                    currency: settings.display.currency,
                    language: settings.display.language
                },
                system: {
                    maintenanceMode: settings.system.maintenanceMode,
                    allowNewRegistrations: settings.system.allowNewRegistrations
                }
            };

            successResponse(res, publicSettings, 'Public settings retrieved successfully');
        } catch (error) {
            errorResponse(res, error, 500);
        }
    });
}

module.exports = SystemSettingsController; 