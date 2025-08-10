const socketIO = require('socket.io');

class SocketService {
    constructor() {
        this.io = null;
        this.connectedUsers = new Map(); // Map to store user connections
    }

    initialize(server) {
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
                const userInfo = this.connectedUsers.get(socket.id);
                console.log('🔍 User info for emergency alert:', userInfo);
                console.log('🔍 Socket ID:', socket.id);
                console.log('🔍 Connected users:', this.connectedUsers.size);

                try {
                    // Fetch driver details for proper identification
                    const Driver = require('../models/Driver');
                    const driver = await Driver.findById(userInfo?.userId).select('fullName email phone area');

                    // Broadcast emergency alert to admin room with complete driver info
                    const emergencyPayload = {
                        driverId: userInfo?.userId,
                        driverName: driver?.fullName || 'Unknown Driver',
                        driverEmail: driver?.email || 'No email available',
                        driverPhone: driver?.phone || 'No phone available',
                        driverArea: driver?.area || 'Unknown area',
                        message: data.message,
                        timestamp: data.timestamp || new Date().toISOString(),
                        socketId: socket.id,
                        // Communication details
                        contactInfo: {
                            phone: driver?.phone,
                            email: driver?.email,
                            area: driver?.area
                        },
                        // Response instructions
                        responseInstructions: {
                            callDriver: `Call driver at ${driver?.phone || 'No phone available'}`,
                            emailDriver: `Email driver at ${driver?.email || 'No email available'}`,
                            replyViaSocket: `Reply via socket ID: ${socket.id}`,
                            driverLocation: `Driver is in ${driver?.area || 'Unknown area'}`
                        }
                    };

                    console.log('🚨 Broadcasting emergency alert to admin room:', emergencyPayload);
                    console.log('🔍 Admin room members:', this.io.sockets.adapter.rooms.get('admin-room')?.size || 0);

                    // Check if admin room exists
                    const adminRoom = this.io.sockets.adapter.rooms.get('admin-room');
                    if (adminRoom) {
                        console.log('🔍 Admin room sockets:', Array.from(adminRoom));
                    } else {
                        console.log('❌ Admin room does not exist');
                    }

                    this.io.to('admin-room').emit('emergency-alert', emergencyPayload);

                    console.log('🚨 Emergency alert broadcasted to admin room');

                    // Also emit to the specific driver for immediate feedback
                    this.io.to(`driver-${userInfo?.userId}`).emit('emergency-sent', {
                        message: 'Emergency alert sent to admin',
                        timestamp: new Date().toISOString()
                    });
                } catch (error) {
                    console.error('❌ Error processing emergency alert:', error);

                    // Fallback emergency payload
                    const fallbackPayload = {
                        driverId: userInfo?.userId,
                        driverName: 'Unknown Driver',
                        driverEmail: 'No email available',
                        driverPhone: 'No phone available',
                        driverArea: 'Unknown area',
                        message: data.message,
                        timestamp: data.timestamp || new Date().toISOString(),
                        socketId: socket.id,
                        error: 'Failed to fetch driver details',
                        contactInfo: {
                            phone: 'No phone available',
                            email: 'No email available',
                            area: 'Unknown area'
                        },
                        responseInstructions: {
                            callDriver: 'Driver phone not available',
                            emailDriver: 'Driver email not available',
                            replyViaSocket: `Reply via socket ID: ${socket.id}`,
                            driverLocation: 'Driver location unknown'
                        }
                    };

                    this.io.to('admin-room').emit('emergency-alert', fallbackPayload);
                }
            });

            // Handle admin replies to emergency alerts
            socket.on('admin-emergency-reply', (data) => {
                console.log('📞 Admin emergency reply received:', data);
                const { driverId, message, adminName } = data;

                console.log(`🔍 Sending to driver room: driver-${driverId}`);
                console.log(`🔍 Driver room members: ${this.io.sockets.adapter.rooms.get(`driver-${driverId}`)?.size || 0}`);
                console.log(`🔍 All rooms:`, Array.from(this.io.sockets.adapter.rooms.keys()));

                // Send reply to specific driver
                this.io.to(`driver-${driverId}`).emit('emergency-reply', {
                    message: message,
                    adminName: adminName || 'Admin',
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

        console.log('Socket.IO service initialized');
    }

    // Method to emit driver status update
    emitDriverStatusUpdate(driverData) {
        if (this.io) {
            const eventData = {
                driverId: driverData._id,
                name: driverData.name,
                email: driverData.email,
                isOnline: driverData.isActive, // Use isActive as online status
                isActive: driverData.isActive,
                lastLogin: driverData.lastLogin,
                area: driverData.area,
                totalDeliveries: driverData.totalDeliveries,
                completedDeliveries: driverData.completedDeliveries,
                totalEarnings: driverData.totalEarnings,
                rating: driverData.rating,
                timestamp: new Date().toISOString()
            };

            console.log('Emitting driver status update:', eventData);
            this.io.to('admin-room').emit('driver-status-changed', eventData);
        } else {
            console.log('Socket.IO not initialized');
        }
    }

    // Method to emit delivery status update
    emitDeliveryStatusUpdate(deliveryData) {
        if (this.io) {
            this.io.to('admin-room').emit('delivery-status-changed', {
                deliveryId: deliveryData._id,
                deliveryCode: deliveryData.deliveryCode,
                status: deliveryData.status,
                driverId: deliveryData.assignedTo,
                timestamp: new Date().toISOString()
            });
        }
    }

    // Method to emit new notification
    emitNewNotification(notification) {
        if (this.io) {
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
        } else {
            console.log('❌ Socket.IO not initialized');
        }
    }

    // Method to emit admin notification with sound
    emitAdminNotification(notification, sound = null) {
        if (this.io) {
            const eventData = {
                notification,
                sound,
                timestamp: new Date().toISOString()
            };
            console.log(`Emitting admin notification with sound: ${sound}`);
            this.io.to('admin-room').emit('admin-notification', eventData);
        }
    }

    // Method to emit notification update
    emitNotificationUpdate(notification) {
        if (this.io) {
            console.log('Emitting notification update:', notification);

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
}

module.exports = new SocketService(); 