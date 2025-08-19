const express = require('express');
const backgroundJobService = require('../services/backgroundJobService');
const { authenticateToken, adminOnly } = require('../middleware/auth');
const { successResponse, errorResponse } = require('../middleware/errorHandler');

const router = express.Router();

// Apply middleware to all background job routes
router.use(authenticateToken);
router.use(adminOnly);

// Get background job status
router.get('/status', async (req, res) => {
    try {
        const status = backgroundJobService.getStatus();
        successResponse(res, status, 'Background job status retrieved successfully');
    } catch (error) {
        errorResponse(res, error, 500);
    }
});

// Trigger expired broadcast handling
router.post('/trigger-expired-broadcasts', async (req, res) => {
    try {
        await backgroundJobService.triggerExpiredBroadcastHandling();
        successResponse(res, { message: 'Expired broadcast handling triggered' }, 'Expired broadcast handling triggered successfully');
    } catch (error) {
        errorResponse(res, error, 500);
    }
});

// Trigger broadcast processing
router.post('/trigger-broadcast-processing', async (req, res) => {
    try {
        await backgroundJobService.triggerBroadcastProcessing();
        successResponse(res, { message: 'Broadcast processing triggered' }, 'Broadcast processing triggered successfully');
    } catch (error) {
        errorResponse(res, error, 500);
    }
});

// Start background jobs
router.post('/start', async (req, res) => {
    try {
        await backgroundJobService.start();
        successResponse(res, { message: 'Background jobs started' }, 'Background jobs started successfully');
    } catch (error) {
        errorResponse(res, error, 500);
    }
});

// Stop background jobs
router.post('/stop', async (req, res) => {
    try {
        await backgroundJobService.stop();
        successResponse(res, { message: 'Background jobs stopped' }, 'Background jobs stopped successfully');
    } catch (error) {
        errorResponse(res, error, 500);
    }
});

module.exports = router;
