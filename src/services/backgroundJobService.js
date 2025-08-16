const BroadcastService = require('./broadcastService');
const Delivery = require('../models/Delivery');

class BackgroundJobService {
    constructor() {
        this.jobs = new Map();
        this.isRunning = false;
    }

    // Start the background job service
    start() {
        if (this.isRunning) {
            console.log('Background job service is already running');
            return;
        }

        this.isRunning = true;
        console.log('🚀 Background job service started');

        // Start the expired broadcast handler
        this.startExpiredBroadcastHandler();

        // Start the broadcast processor
        this.startBroadcastProcessor();
    }

    // Stop the background job service
    stop() {
        this.isRunning = false;

        // Clear all running jobs
        for (const [jobId, interval] of this.jobs) {
            clearInterval(interval);
            console.log(`Stopped job: ${jobId}`);
        }
        this.jobs.clear();

        console.log('🛑 Background job service stopped');
    }

    // Start expired broadcast handler (runs every 30 seconds)
    startExpiredBroadcastHandler() {
        const jobId = 'expired-broadcast-handler';
        const interval = setInterval(async () => {
            if (!this.isRunning) return;

            try {
                const processedCount = await BroadcastService.handleExpiredBroadcasts();
                if (processedCount > 0) {
                    console.log(`🔄 Processed ${processedCount} expired broadcasts`);
                }
            } catch (error) {
                console.error('❌ Error processing expired broadcasts:', error);
            }
        }, 30000); // 30 seconds

        this.jobs.set(jobId, interval);
        console.log(`✅ Started job: ${jobId}`);
    }

    // Start broadcast processor (runs every 10 seconds)
    startBroadcastProcessor() {
        const jobId = 'broadcast-processor';
        const interval = setInterval(async () => {
            if (!this.isRunning) return;

            try {
                await this.processReadyBroadcasts();
            } catch (error) {
                console.error('❌ Error processing ready broadcasts:', error);
            }
        }, 10000); // 10 seconds

        this.jobs.set(jobId, interval);
        console.log(`✅ Started job: ${jobId}`);
    }

    // Process deliveries ready for broadcast
    async processReadyBroadcasts() {
        try {
            const readyDeliveries = await Delivery.findReadyForBroadcast();

            for (const delivery of readyDeliveries) {
                try {
                    await BroadcastService.startBroadcast(delivery._id);
                    console.log(`📡 Started broadcast for delivery ${delivery._id}`);
                } catch (error) {
                    console.error(`❌ Failed to start broadcast for delivery ${delivery._id}:`, error);
                }
            }

            if (readyDeliveries.length > 0) {
                console.log(`📡 Processed ${readyDeliveries.length} ready broadcasts`);
            }
        } catch (error) {
            console.error('❌ Error finding ready broadcasts:', error);
        }
    }

    // Get job status
    getStatus() {
        return {
            isRunning: this.isRunning,
            activeJobs: Array.from(this.jobs.keys()),
            jobCount: this.jobs.size
        };
    }

    // Manually trigger expired broadcast handling
    async triggerExpiredBroadcastHandling() {
        try {
            const processedCount = await BroadcastService.handleExpiredBroadcasts();
            console.log(`🔄 Manually processed ${processedCount} expired broadcasts`);
            return processedCount;
        } catch (error) {
            console.error('❌ Error in manual expired broadcast handling:', error);
            throw error;
        }
    }

    // Manually trigger broadcast processing
    async triggerBroadcastProcessing() {
        try {
            await this.processReadyBroadcasts();
            console.log('📡 Manual broadcast processing completed');
        } catch (error) {
            console.error('❌ Error in manual broadcast processing:', error);
            throw error;
        }
    }
}

// Create singleton instance
const backgroundJobService = new BackgroundJobService();

module.exports = backgroundJobService;
