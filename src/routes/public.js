const express = require('express');
const router = express.Router();
const Delivery = require('../models/Delivery');
const Driver = require('../models/Driver');
const DriverController = require('../controllers/driverController');

// Public tracking endpoint
router.get('/track/:deliveryCode', async (req, res) => {
    try {
        const { deliveryCode } = req.params;

        if (!deliveryCode) {
            return res.status(400).json({
                success: false,
                error: 'Delivery code is required'
            });
        }

        const delivery = await Delivery.findOne({ deliveryCode })
            .populate('assignedTo', 'fullName area isOnline')
            .select('-__v');

        if (!delivery) {
            return res.status(404).json({
                success: false,
                error: 'Delivery not found'
            });
        }

        res.json({
            success: true,
            data: delivery
        });
    } catch (error) {
        console.error('Error tracking delivery:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Public user status endpoint (following your specified format)
router.get('/user/:id/status', async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                success: false,
                error: 'User ID is required'
            });
        }

        const driver = await Driver.findById(id).select('-__v');

        if (!driver) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Return the exact format your frontend expects
        res.json({
            success: true,
            data: driver.accountStatus
        });
    } catch (error) {
        console.error('Error getting user status:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Public user join date endpoint 
router.get('/user/:id/join-date', async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                success: false,
                error: 'User ID is required'
            });
        }

        const driver = await Driver.findById(id).select('joinedAt');

        if (!driver) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        res.json({
            success: true,
            data: {
                joinDate: driver.joinedAt
            }
        });
    } catch (error) {
        console.error('Error getting user join date:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Public profile options endpoint (for registration forms)
router.get('/profile-options', DriverController.getProfileOptions);

module.exports = router; 