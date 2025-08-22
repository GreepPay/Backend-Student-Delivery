const express = require('express');
const router = express.Router();
const PublicController = require('../controllers/publicController');

// Public endpoints (no authentication required)
router.get('/profile-options', PublicController.getProfileOptions);

module.exports = router; 