const SocketService = require('../services/socketService');

// Middleware to automatically connect users to their socket rooms
const autoConnectSocket = (req, res, next) => {
    try {
        // Only proceed if user is authenticated
        if (!req.user || !req.user.id) {
            return next();
        }

        const userId = req.user.id;
        const userType = req.user.userType || req.user.role;

        // Connect to socket room if not already connected
        if (userType === 'driver' || userType === 'admin') {
            // This will be handled by the frontend when it connects to the socket
            // For now, we'll just log that the user should connect
            console.log(`🔌 User ${userId} (${userType}) should connect to socket room`);
        }

        next();
    } catch (error) {
        console.error('Error in autoConnectSocket middleware:', error);
        next();
    }
};

// Function to manually connect a user to their socket room
const connectUserToSocket = (userId, userType, socketId = null) => {
    try {
        if (!SocketService.isAvailable()) {
            console.log('⚠️ Socket service not available for manual connection');
            return false;
        }

        console.log(`🔌 Manually connecting user ${userId} (${userType}) to socket room`);

        // This would require the actual socket instance
        // For now, we'll just log the connection attempt
        return true;
    } catch (error) {
        console.error('Error connecting user to socket:', error);
        return false;
    }
};

module.exports = {
    autoConnectSocket,
    connectUserToSocket
};
