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
                    console.log(`❌ Room ${driverRoom} does not exist - driver not connected`);
                    // Fallback: emit to general drivers room
                    this.io.to('drivers-room').emit('new-notification', notification);
                    console.log(`📨 Fallback: Emitted to general drivers room`);
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

    // Method to emit delivery broadcast for toast notification
    emitDeliveryBroadcast(delivery, eligibleDrivers) {
        try {
            if (!this.isAvailable()) {
                console.log('⚠️ Socket service not available for delivery broadcast');
                return;
            }

            const broadcastData = {
                type: 'delivery-broadcast',
                deliveryId: delivery._id,
                deliveryCode: delivery.deliveryCode,
                pickupLocation: delivery.pickupLocation,
                deliveryLocation: delivery.deliveryLocation,
                customerName: delivery.customerName,
                customerPhone: delivery.customerPhone,
                fee: delivery.fee,
                driverEarning: delivery.driverEarning,
                companyEarning: delivery.companyEarning,
                estimatedTime: delivery.estimatedTime,
                priority: delivery.priority,
                broadcastEndTime: delivery.broadcastEndTime,
                broadcastDuration: delivery.broadcastDuration,
                distance: delivery.distance,
                notes: delivery.notes,
                paymentMethod: delivery.paymentMethod,
                pickupCoordinates: delivery.pickupCoordinates,
                deliveryCoordinates: delivery.deliveryCoordinates,
                createdAt: delivery.createdAt,
                timeRemaining: Math.max(0, delivery.broadcastEndTime - new Date()),
                sound: 'delivery-broadcast.mp3', // Specific sound for delivery broadcasts
                // Toast-specific data
                toastType: 'delivery-broadcast',
                toastTitle: '🚚 New Delivery Available',
                toastMessage: `Pickup: ${delivery.pickupLocation} → Delivery: ${delivery.deliveryLocation}`,
                toastDuration: Math.min(60000, Math.max(0, delivery.broadcastEndTime - new Date())), // Toast duration in ms
                toastPriority: delivery.priority === 'high' ? 'high' : 'normal',
                toastActions: [
                    {
                        label: 'Accept',
                        action: 'accept-delivery',
                        variant: 'primary'
                    },
                    {
                        label: 'View Details',
                        action: 'view-delivery',
                        variant: 'secondary'
                    }
                ]
            };

            console.log('🚚 Emitting delivery broadcast to drivers:', broadcastData);

            // Emit to all eligible drivers
            for (const driver of eligibleDrivers) {
                const driverRoom = `driver-${driver._id}`;
                this.io.to(driverRoom).emit('delivery-broadcast', broadcastData);
                console.log(`📨 Emitted delivery broadcast to driver ${driver._id}`);
            }

            // Also emit to general drivers room as fallback
            this.io.to('drivers-room').emit('delivery-broadcast', broadcastData);
            console.log('📨 Emitted delivery broadcast to general drivers room');

        } catch (error) {
            console.error('❌ Error emitting delivery broadcast:', error);
        }
    }

    // Method to emit toast notification for delivery accepted
    emitDeliveryAccepted(delivery, driverId, acceptedDriverName) {
        try {
            if (!this.isAvailable()) {
                console.log('⚠️ Socket service not available for delivery accepted');
                return;
            }

            const acceptData = {
                type: 'delivery-accepted',
                deliveryId: delivery._id,
                deliveryCode: delivery.deliveryCode,
                acceptedBy: driverId,
                acceptedDriverName: acceptedDriverName,
                acceptedAt: delivery.acceptedAt,
                sound: 'delivery-accepted.mp3',
                // Toast-specific data
                toastType: 'delivery-accepted',
                toastTitle: '✅ Delivery Accepted',
                toastMessage: `Delivery ${delivery.deliveryCode} accepted by ${acceptedDriverName}`,
                toastDuration: 5000, // 5 seconds
                toastPriority: 'normal'
            };

            console.log('✅ Emitting delivery accepted notification');

            // Notify all other drivers that delivery is no longer available
            this.io.to('drivers-room').emit('delivery-accepted', acceptData);
            console.log('📨 Emitted delivery accepted to all drivers');

            // Notify admin
            this.io.to('admin-room').emit('delivery-accepted', {
                ...acceptData,
                type: 'admin-delivery-accepted'
            });
            console.log('📨 Emitted delivery accepted to admin');

        } catch (error) {
            console.error('❌ Error emitting delivery accepted:', error);
        }
    }

    // Method to emit toast notification for delivery expired
    emitDeliveryExpired(delivery) {
        try {
            if (!this.isAvailable()) {
                console.log('⚠️ Socket service not available for delivery expired');
                return;
            }

            const expiredData = {
                type: 'delivery-expired',
                deliveryId: delivery._id,
                deliveryCode: delivery.deliveryCode,
                expiredAt: new Date(),
                sound: 'delivery-expired.mp3'
            };

            console.log('⏰ Emitting delivery expired notification');

            // Notify all drivers that delivery has expired
            this.io.to('drivers-room').emit('delivery-expired', expiredData);
            console.log('📨 Emitted delivery expired to all drivers');

            // Notify admin
            this.io.to('admin-room').emit('delivery-expired', {
                ...expiredData,
                type: 'admin-delivery-expired'
            });
            console.log('📨 Emitted delivery expired to admin');

        } catch (error) {
            console.error('❌ Error emitting delivery expired:', error);
        }
    }

    // Method to emit toast notification
    emitToastNotification(userId, userType, toastData) {
        try {
            if (!this.isAvailable()) {
                console.log('⚠️ Socket service not available for toast notification');
                return;
            }

            const room = userType === 'admin' ? 'admin-room' : `driver-${userId}`;

            const toastNotification = {
                type: 'toast-notification',
                ...toastData,
                timestamp: new Date().toISOString(),
                sound: toastData.sound || 'notification.mp3'
            };

            this.io.to(room).emit('toast-notification', toastNotification);
            console.log(`🍞 Emitted toast notification to ${userType} ${userId}:`, toastData.toastTitle);

        } catch (error) {
            console.error('❌ Error emitting toast notification:', error);
        }
    }

    // Method to emit emergency alert as toast
    emitEmergencyAlertToast(driverId, message, location = null) {
        try {
            if (!this.isAvailable()) {
                console.log('⚠️ Socket service not available for emergency alert toast');
                return;
            }

            const emergencyToast = {
                type: 'emergency-alert',
                toastType: 'emergency-alert',
                toastTitle: '🚨 Emergency Alert',
                toastMessage: message,
                toastDuration: 10000, // 10 seconds for emergency
                toastPriority: 'urgent',
                sound: 'emergency-alert.mp3',
                location: location,
                timestamp: new Date().toISOString()
            };

            // Emit to admin room
            this.io.to('admin-room').emit('toast-notification', emergencyToast);
            console.log('🚨 Emitted emergency alert toast to admin');

        } catch (error) {
            console.error('❌ Error emitting emergency alert toast:', error);
        }
    }
}

module.exports = new SocketService(); 