const mongoose = require('mongoose');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

// Import the Express app from app.js
const app = require('./src/app');

const server = http.createServer(app);

// Import CORS configuration
const { socketCorsConfig } = require('./src/config/cors');

const io = socketIo(server, {
    cors: socketCorsConfig
});

// Import background job service
const backgroundJobService = require('./src/services/backgroundJobService');

// Socket.IO setup
const SocketService = require('./src/services/socketService');
SocketService.initialize(io);

// Background job status endpoint
app.get('/api/background-jobs/status', (req, res) => {
    res.json({
        success: true,
        data: backgroundJobService.getStatus()
    });
});

// Manual trigger endpoints for testing
app.post('/api/background-jobs/trigger-expired-broadcasts', async (req, res) => {
    try {
        const processedCount = await backgroundJobService.triggerExpiredBroadcastHandling();
        res.json({
            success: true,
            data: { processedCount },
            message: `Processed ${processedCount} expired broadcasts`
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.post('/api/background-jobs/trigger-broadcast-processing', async (req, res) => {
    try {
        await backgroundJobService.triggerBroadcastProcessing();
        res.json({
            success: true,
            message: 'Broadcast processing completed'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Database connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log('✅ Connected to MongoDB');

        // Start background job service after database connection
        backgroundJobService.start();

        const PORT = process.env.PORT || 3001;
        server.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`📡 Socket.IO server ready`);
            console.log(`🔄 Background jobs started`);
        });
    })
    .catch(err => {
        console.error('❌ MongoDB connection error:', err);
        process.exit(1);
    });

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully');
    backgroundJobService.stop();
    server.close(() => {
        console.log('✅ Server closed');
        mongoose.connection.close();
        console.log('✅ Database connection closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('🛑 SIGINT received, shutting down gracefully');
    backgroundJobService.stop();
    server.close(() => {
        console.log('✅ Server closed');
        mongoose.connection.close();
        console.log('✅ Database connection closed');
        process.exit(0);
    });
});