const express = require('express');
const SystemSettingsController = require('../controllers/systemSettingsController');
const { authenticateToken, adminOnly } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');

const router = express.Router();

// Public routes (no authentication required)
router.get('/public', SystemSettingsController.getPublicSettings);

// Apply authentication middleware to protected routes
router.use(authenticateToken);

// Admin-only routes
router.get('/admin', adminOnly, SystemSettingsController.getSettings);
router.get('/admin/:category', adminOnly, SystemSettingsController.getCategorySettings);
router.put('/admin', adminOnly, SystemSettingsController.updateSettings);
router.put('/admin/:category', adminOnly, SystemSettingsController.updateCategorySettings);
router.post('/admin/reset', adminOnly, SystemSettingsController.resetToDefaults);

// Driver routes (limited access)
router.get('/driver', SystemSettingsController.getDriverSettings);

module.exports = router; 