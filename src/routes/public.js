const express = require('express');
const router = express.Router();
const Delivery = require('../models/Delivery');

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
            .populate('assignedTo', 'name area isOnline')
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

module.exports = router; 