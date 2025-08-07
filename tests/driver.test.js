const request = require('supertest');
const app = require('../src/app');
const Driver = require('../src/models/Driver');
const Delivery = require('../src/models/Delivery');
const Admin = require('../src/models/Admin');

describe('Driver Endpoints Tests', () => {
    let driver, token, admin;

    beforeEach(async () => {
        driver = await testUtils.createTestDriver(Driver);
        token = testUtils.generateTestToken(driver._id, 'driver');
        admin = await testUtils.createTestAdmin(Admin);
    });

    describe('GET /api/driver/profile', () => {
        it('should return driver profile', async () => {
            const response = await request(app)
                .get('/api/driver/profile')
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.email).toBe(driver.email);
            expect(response.body.data.name).toBe(driver.name);
        });

        it('should reject request without authentication', async () => {
            const response = await request(app)
                .get('/api/driver/profile');

            expect(response.status).toBe(401);
        });
    });

    describe('PUT /api/driver/profile', () => {
        it('should update driver profile', async () => {
            const updateData = {
                name: 'Updated Driver Name',
                phone: '+9876543210',
                area: 'New Area'
            };

            const response = await request(app)
                .put('/api/driver/profile')
                .set('Authorization', `Bearer ${token}`)
                .send(updateData);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.name).toBe(updateData.name);
            expect(response.body.data.phone).toBe(updateData.phone);
            expect(response.body.data.area).toBe(updateData.area);
        });

        it('should validate phone number format', async () => {
            const response = await request(app)
                .put('/api/driver/profile')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    phone: 'invalid-phone'
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
        });
    });

    describe('POST /api/driver/toggle-online', () => {
        it('should toggle online status', async () => {
            const response = await request(app)
                .post('/api/driver/toggle-online')
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.isOnline).toBeDefined();
        });
    });

    describe('GET /api/driver/analytics', () => {
        beforeEach(async () => {
            // Create test deliveries for the driver
            await testUtils.createTestDelivery(Delivery, admin._id);
            await testUtils.createTestDelivery(Delivery, admin._id);

            // Assign deliveries to driver
            const deliveries = await Delivery.find();
            for (let delivery of deliveries) {
                delivery.assignedTo = driver._id;
                delivery.status = 'delivered';
                delivery.deliveredAt = new Date();
                await delivery.save();
            }
        });

        it('should return driver analytics', async () => {
            const response = await request(app)
                .get('/api/driver/analytics')
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('totalDeliveries');
            expect(response.body.data).toHaveProperty('completedDeliveries');
            expect(response.body.data).toHaveProperty('totalEarnings');
        });

        it('should filter analytics by date range', async () => {
            const response = await request(app)
                .get('/api/driver/analytics')
                .query({
                    startDate: '2024-01-01',
                    endDate: '2024-12-31'
                })
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });
    });

    describe('GET /api/driver/earnings', () => {
        beforeEach(async () => {
            // Create test deliveries with earnings
            const delivery1 = await testUtils.createTestDelivery(Delivery, admin._id);
            const delivery2 = await testUtils.createTestDelivery(Delivery, admin._id);

            delivery1.assignedTo = driver._id;
            delivery1.status = 'delivered';
            delivery1.deliveredAt = new Date();
            delivery1.driverEarning = 100;
            await delivery1.save();

            delivery2.assignedTo = driver._id;
            delivery2.status = 'delivered';
            delivery2.deliveredAt = new Date();
            delivery2.driverEarning = 150;
            await delivery2.save();
        });

        it('should return driver earnings', async () => {
            const response = await request(app)
                .get('/api/driver/earnings')
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('totalEarnings');
            expect(response.body.data).toHaveProperty('monthlyEarnings');
        });
    });

    describe('GET /api/driver/performance', () => {
        it('should return performance summary', async () => {
            const response = await request(app)
                .get('/api/driver/performance')
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('totalDeliveries');
            expect(response.body.data).toHaveProperty('completionRate');
            expect(response.body.data).toHaveProperty('averageRating');
        });
    });

    describe('GET /api/driver/deliveries', () => {
        beforeEach(async () => {
            // Create test deliveries
            const delivery1 = await testUtils.createTestDelivery(Delivery, admin._id);
            const delivery2 = await testUtils.createTestDelivery(Delivery, admin._id);

            delivery1.assignedTo = driver._id;
            await delivery1.save();

            delivery2.assignedTo = driver._id;
            delivery2.status = 'delivered';
            await delivery2.save();
        });

        it('should return driver deliveries', async () => {
            const response = await request(app)
                .get('/api/driver/deliveries')
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('deliveries');
            expect(response.body.data).toHaveProperty('pagination');
            expect(response.body.data.deliveries).toHaveLength(2);
        });

        it('should filter deliveries by status', async () => {
            const response = await request(app)
                .get('/api/driver/deliveries')
                .query({ status: 'delivered' })
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.deliveries).toHaveLength(1);
        });

        it('should paginate results', async () => {
            const response = await request(app)
                .get('/api/driver/deliveries')
                .query({ page: 1, limit: 1 })
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(200);
            expect(response.body.data.deliveries).toHaveLength(1);
        });
    });

    describe('GET /api/driver/deliveries/nearby', () => {
        it('should return nearby deliveries', async () => {
            const response = await request(app)
                .get('/api/driver/deliveries/nearby')
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('deliveries');
        });
    });

    describe('GET /api/driver/deliveries/:deliveryId', () => {
        let delivery;

        beforeEach(async () => {
            delivery = await testUtils.createTestDelivery(Delivery, admin._id);
            delivery.assignedTo = driver._id;
            await delivery.save();
        });

        it('should return specific delivery details', async () => {
            const response = await request(app)
                .get(`/api/driver/deliveries/${delivery._id}`)
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data._id).toBe(delivery._id.toString());
        });

        it('should reject access to unassigned delivery', async () => {
            const unassignedDelivery = await testUtils.createTestDelivery(Delivery, admin._id);

            const response = await request(app)
                .get(`/api/driver/deliveries/${unassignedDelivery._id}`)
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(403);
            expect(response.body.success).toBe(false);
        });
    });

    describe('PUT /api/driver/deliveries/:deliveryId/status', () => {
        let delivery;

        beforeEach(async () => {
            delivery = await testUtils.createTestDelivery(Delivery, admin._id);
            delivery.assignedTo = driver._id;
            delivery.status = 'assigned';
            await delivery.save();
        });

        it('should update delivery status to picked_up', async () => {
            const response = await request(app)
                .put(`/api/driver/deliveries/${delivery._id}/status`)
                .set('Authorization', `Bearer ${token}`)
                .send({
                    status: 'picked_up',
                    notes: 'Package picked up successfully'
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.status).toBe('picked_up');
            expect(response.body.data.pickedUpAt).toBeDefined();
        });

        it('should update delivery status to delivered', async () => {
            // First pick up the delivery
            delivery.status = 'picked_up';
            delivery.pickedUpAt = new Date();
            await delivery.save();

            const response = await request(app)
                .put(`/api/driver/deliveries/${delivery._id}/status`)
                .set('Authorization', `Bearer ${token}`)
                .send({
                    status: 'delivered',
                    notes: 'Package delivered successfully'
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.status).toBe('delivered');
            expect(response.body.data.deliveredAt).toBeDefined();
        });

        it('should reject invalid status transition', async () => {
            const response = await request(app)
                .put(`/api/driver/deliveries/${delivery._id}/status`)
                .set('Authorization', `Bearer ${token}`)
                .send({
                    status: 'delivered' // Cannot go directly from assigned to delivered
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
        });

        it('should reject access to unassigned delivery', async () => {
            const unassignedDelivery = await testUtils.createTestDelivery(Delivery, admin._id);

            const response = await request(app)
                .put(`/api/driver/deliveries/${unassignedDelivery._id}/status`)
                .set('Authorization', `Bearer ${token}`)
                .send({
                    status: 'picked_up'
                });

            expect(response.status).toBe(403);
            expect(response.body.success).toBe(false);
        });
    });

    describe('GET /api/driver/leaderboard', () => {
        beforeEach(async () => {
            // Create additional drivers for leaderboard
            await testUtils.createTestDriver(Driver);
            await testUtils.createTestDriver(Driver);
        });

        it('should return leaderboard data', async () => {
            const response = await request(app)
                .get('/api/driver/leaderboard')
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('leaderboard');
            expect(response.body.data.leaderboard).toBeInstanceOf(Array);
        });
    });
}); 