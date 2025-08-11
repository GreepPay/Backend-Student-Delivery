const socketIO = require('socket.io');

class SocketService {
    constructor() {
        this.io = null;
        this.connectedUsers = new Map(); // Map to store user connections
        this.isInitialized = false;
    }

    initialize(server) {
        try {
            this.io = socketIO(server, {
                cors: {
                    origin: process.env.FRONTEND_URL || "http://localhost:3000",
                    methods: ["GET", "POST"],
                    credentials: true
                }
            });

            this.io.on('connection', (socket) => {
                console.log('User connected:', socket.id);

                // Handle user authentication and room joining
                socket.on('authenticate', (data) => {
                    const { userId, userType } = data;
                    console.log('Socket authentication received:', { userId, userType, socketId: socket.id });

                    // Store user connection
                    this.connectedUsers.set(socket.id, { userId, userType });

                    // Join appropriate rooms
                    if (userType === 'admin') {
                        socket.join('admin-room');
                        console.log(`Admin ${userId} joined admin room`);
                        console.log('🔍 Admin room members:', this.io.sockets.adapter.rooms.get('admin-room')?.size || 0);
                    } else if (userType === 'driver') {
                        socket.join(`driver-${userId}`);
                        socket.join('drivers-room');
                        console.log(`Driver ${userId} joined driver rooms`);
                        console.log(`🔍 Driver room: driver-${userId}`);
                        console.log(`🔍 Drivers room members: ${this.io.sockets.adapter.rooms.get('drivers-room')?.size || 0}`);
                    }
                });

                // Handle driver status updates
                socket.on('driver-status-update', (data) => {
                    const { driverId, isOnline, lastLogin } = data;

                    // Broadcast to admin room
                    this.io.to('admin-room').emit('driver-status-changed', {
                        driverId,
                        isOnline,
                        lastLogin,
                        timestamp: new Date().toISOString()
                    });

                    console.log(`Driver ${driverId} status updated: ${isOnline ? 'online' : 'offline'}`);
                });

                // Handle driver location updates (for future use)
                socket.on('driver-location-update', (data) => {
                    const { driverId, location } = data;

                    // Broadcast to admin room
                    this.io.to('admin-room').emit('driver-location-changed', {
                        driverId,
                        location,
                        timestamp: new Date().toISOString()
                    });
                });

                // Handle delivery status updates
                socket.on('delivery-status-update', (data) => {
                    const { deliveryId, status, driverId } = data;

                    // Broadcast to admin room
                    this.io.to('admin-room').emit('delivery-status-changed', {
                        deliveryId,
                        status,
                        driverId,
                        timestamp: new Date().toISOString()
                    });
                });

                // Handle general notifications
                socket.on('notification', (data) => {
                    const userInfo = this.connectedUsers.get(socket.id);

                    // Broadcast notification to appropriate rooms
                    if (data.target === 'drivers') {
                        this.io.to('drivers-room').emit('notification', data);
                    } else if (data.target === 'admins') {
                        this.io.to('admin-room').emit('notification', data);
                    } else {
                        // Broadcast to all
                        this.io.emit('notification', data);
                    }
                });

                // Handle emergency alerts
                socket.on('emergency-alert', async (data) => {
                    console.log('🚨 Emergency alert received:', data);

                    const { driverId, message, location } = data;

                    // Broadcast emergency alert to admin room
                    this.io.to('admin-room').emit('emergency-alert', {
                        driverId,
                        message,
                        location,
                        timestamp: new Date().toISOString()
                    });

                    console.log(`🚨 Emergency alert broadcasted to admin room for driver ${driverId}`);
                });

                // Handle emergency reply from admin
                socket.on('emergency-reply', (data) => {
                    const { driverId, message, adminId } = data;

                    // Send reply to specific driver
                    this.io.to(`driver-${driverId}`).emit('emergency-reply', {
                        message,
                        adminId,
                        timestamp: new Date().toISOString()
                    });

                    console.log(`📞 Emergency reply sent to driver ${driverId}`);
                });

                socket.on('disconnect', () => {
                    const userInfo = this.connectedUsers.get(socket.id);
                    if (userInfo) {
                        console.log(`User ${userInfo.userId} (${userInfo.userType}) disconnected`);
                        this.connectedUsers.delete(socket.id);
                    }
                    console.log('User disconnected:', socket.id);
                });
            });

            this.isInitialized = true;
            console.log('✅ Socket.IO service initialized successfully');
        } catch (error) {
            console.error('❌ Error initializing Socket.IO service:', error);
            this.isInitialized = false;
        }
    }

    // Check if socket service is available
    isAvailable() {
        return this.isInitialized && this.io !== null;
    }

    // Method to emit driver status update
    emitDriverStatusUpdate(driverData) {
        try {
            if (!this.isAvailable()) {
                console.log('⚠️ Socket service not available for RealTimeDriverStatus');
                return;
            }

            if (!driverData || !driverData._id) {
                console.log('⚠️ Invalid driver data provided for status update');
                return;
            }

            const eventData = {
                driverId: driverData._id,
                name: driverData.name || 'Unknown',
                email: driverData.email || '',
                isOnline: driverData.isActive || false, // Use isActive as online status
                isActive: driverData.isActive || false,
                lastLogin: driverData.lastLogin,
                area: driverData.area || '',
                totalDeliveries: driverData.totalDeliveries || 0,
                completedDeliveries: driverData.completedDeliveries || 0,
                totalEarnings: driverData.totalEarnings || 0,
                rating: driverData.rating || 0,
                timestamp: new Date().toISOString()
            };

            console.log('📡 Emitting driver status update:', eventData);
            this.io.to('admin-room').emit('driver-status-changed', eventData);
        } catch (error) {
            console.error('❌ Error emitting driver status update:', error);
        }
    }

    // Method to emit delivery status update
    emitDeliveryStatusUpdate(deliveryData) {
        try {
            if (!this.isAvailable()) {
                console.log('⚠️ Socket service not available for delivery status update');
                return;
            }

            this.io.to('admin-room').emit('delivery-status-changed', {
                deliveryId: deliveryData._id,
                deliveryCode: deliveryData.deliveryCode,
                status: deliveryData.status,
                driverId: deliveryData.assignedTo,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('❌ Error emitting delivery status update:', error);
        }
    }

    // Method to emit new notification
    emitNewNotification(notification) {
        try {
            if (!this.isAvailable()) {
                console.log('⚠️ Socket service not available for notification');
                return;
            }

            console.log('🔔 Emitting new notification:', notification);

            // Emit to appropriate room based on recipient model
            if (notification.recipientModel === 'Driver') {
                // Emit to driver's personal room
                const driverRoom = `driver-${notification.recipient}`;
                console.log(`🎯 Emitting to driver room: ${driverRoom}`);
                this.io.to(driverRoom).emit('new-notification', notification);
                console.log(`📨 Emitted notification to driver room: ${driverRoom}`);

                // Check if room exists and has members
                const room = this.io.sockets.adapter.rooms.get(driverRoom);
                if (room) {
                    console.log(`👥 Room ${driverRoom} has ${room.size} members`);
                } else {
                    console.log(`❌ Room ${driverRoom} does not exist`);
                }
            } else if (notification.recipientModel === 'Admin') {
                // Emit to admin room
                this.io.to('admin-room').emit('new-notification', notification);
                console.log('📨 Emitted notification to admin room');
            } else {
                // Fallback: emit to both rooms
                this.io.to('admin-room').emit('new-notification', notification);
                this.io.to('drivers-room').emit('new-notification', notification);
                console.log('📨 Emitted notification to both admin and drivers rooms');
            }
        } catch (error) {
            console.error('❌ Error emitting new notification:', error);
        }
    }

    // Method to emit admin notification with sound
    emitAdminNotification(notification, sound = null) {
        try {
            if (!this.isAvailable()) {
                console.log('⚠️ Socket service not available for admin notification');
                return;
            }

            const eventData = {
                notification,
                sound,
                timestamp: new Date().toISOString()
            };
            console.log(`📢 Emitting admin notification with sound: ${sound}`);
            this.io.to('admin-room').emit('admin-notification', eventData);
        } catch (error) {
            console.error('❌ Error emitting admin notification:', error);
        }
    }

    // Method to emit notification update
    emitNotificationUpdate(notification) {
        try {
            if (!this.isAvailable()) {
                console.log('⚠️ Socket service not available for notification update');
                return;
            }

            console.log('📝 Emitting notification update:', notification);

            // Emit to appropriate room based on recipient model
            if (notification.recipientModel === 'Driver') {
                // Emit to driver's personal room
                this.io.to(`driver-${notification.recipient}`).emit('notification-updated', notification);
                console.log(`📨 Emitted notification update to driver room: driver-${notification.recipient}`);
            } else if (notification.recipientModel === 'Admin') {
                // Emit to admin room
                this.io.to('admin-room').emit('notification-updated', notification);
                console.log('📨 Emitted notification update to admin room');
            } else {
                // Fallback: emit to both rooms
                this.io.to('admin-room').emit('notification-updated', notification);
                this.io.to('drivers-room').emit('notification-updated', notification);
                console.log('📨 Emitted notification update to both admin and drivers rooms');
            }
        } catch (error) {
            console.error('❌ Error emitting notification update:', error);
        }
    }

    // Method to get connected users count
    getConnectedUsersCount() {
        return this.connectedUsers.size;
    }

    // Method to get connected admins count
    getConnectedAdminsCount() {
        let count = 0;
        for (const userInfo of this.connectedUsers.values()) {
            if (userInfo.userType === 'admin') {
                count++;
            }
        }
        return count;
    }

    // Method to get connected drivers count
    getConnectedDriversCount() {
        let count = 0;
        for (const userInfo of this.connectedUsers.values()) {
            if (userInfo.userType === 'driver') {
                count++;
            }
        }
        return count;
    }

    // Method to get socket service status
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            isAvailable: this.isAvailable(),
            connectedUsers: this.getConnectedUsersCount(),
            connectedAdmins: this.getConnectedAdminsCount(),
            connectedDrivers: this.getConnectedDriversCount()
        };
    }
}

module.exports = new SocketService(); 