const request = require('supertest');
const app = require('../src/app');
const Admin = require('../src/models/Admin');
const Driver = require('../src/models/Driver');
const Delivery = require('../src/models/Delivery');

describe('Admin Endpoints Tests', () => {
    let admin, token;

    beforeEach(async () => {
        admin = await testUtils.createTestAdmin(Admin);
        token = testUtils.generateTestToken(admin._id, 'admin');
    });

    describe('GET /api/admin/dashboard', () => {
        it('should return dashboard data for admin', async () => {
            const response = await request(app)
                .get('/api/admin/dashboard')
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('totalDeliveries');
            expect(response.body.data).toHaveProperty('totalDrivers');
            expect(response.body.data).toHaveProperty('recentDeliveries');
        });

        it('should reject request without authentication', async () => {
            const response = await request(app)
                .get('/api/admin/dashboard');

            expect(response.status).toBe(401);
        });
    });

    describe('GET /api/admin/drivers', () => {
        beforeEach(async () => {
            // Create test drivers
            await testUtils.createTestDriver(Driver);
            await testUtils.createTestDriver(Driver);
        });

        it('should return all drivers', async () => {
            const response = await request(app)
                .get('/api/admin/drivers')
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('drivers');
            expect(response.body.data).toHaveProperty('pagination');
            expect(response.body.data.drivers).toHaveLength(2);
        });

        it('should filter drivers by area', async () => {
            const response = await request(app)
                .get('/api/admin/drivers')
                .query({ area: 'Downtown' })
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });

        it('should paginate results', async () => {
            const response = await request(app)
                .get('/api/admin/drivers')
                .query({ page: 1, limit: 1 })
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(200);
            expect(response.body.data.drivers).toHaveLength(1);
        });
    });

    describe('POST /api/admin/drivers', () => {
        it('should create a new driver', async () => {
            const driverData = {
                name: 'New Driver',
                email: 'newdriver@example.com',
                phone: '+1234567890',
                area: 'Uptown',
                vehicleType: 'motorcycle',
                licenseNumber: 'DL789012'
            };

            const response = await request(app)
                .post('/api/admin/drivers')
                .set('Authorization', `Bearer ${token}`)
                .send(driverData);

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.name).toBe(driverData.name);
            expect(response.body.data.email).toBe(driverData.email);
        });

        it('should reject duplicate email', async () => {
            const existingDriver = await testUtils.createTestDriver(Driver);

            const driverData = {
                name: 'Duplicate Driver',
                email: existingDriver.email,
                phone: '+1234567890',
                area: 'Uptown',
                vehicleType: 'motorcycle',
                licenseNumber: 'DL789012'
            };

            const response = await request(app)
                .post('/api/admin/drivers')
                .set('Authorization', `Bearer ${token}`)
                .send(driverData);

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
        });

        it('should validate required fields', async () => {
            const response = await request(app)
                .post('/api/admin/drivers')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    name: 'Incomplete Driver'
                    // Missing required fields
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
        });
    });

    describe('PUT /api/admin/drivers/:id', () => {
        let driver;

        beforeEach(async () => {
            driver = await testUtils.createTestDriver(Driver);
        });

        it('should update driver information', async () => {
            const updateData = {
                name: 'Updated Driver Name',
                area: 'New Area',
                isActive: false
            };

            const response = await request(app)
                .put(`/api/admin/drivers/${driver._id}`)
                .set('Authorization', `Bearer ${token}`)
                .send(updateData);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.name).toBe(updateData.name);
            expect(response.body.data.area).toBe(updateData.area);
        });

        it('should reject update with invalid ID', async () => {
            const response = await request(app)
                .put('/api/admin/drivers/invalid-id')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Updated Name' });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
        });
    });

    describe('DELETE /api/admin/drivers/:id', () => {
        let driver;

        beforeEach(async () => {
            driver = await testUtils.createTestDriver(Driver);
        });

        it('should delete driver', async () => {
            const response = await request(app)
                .delete(`/api/admin/drivers/${driver._id}`)
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);

            // Verify driver is deleted
            const deletedDriver = await Driver.findById(driver._id);
            expect(deletedDriver).toBeNull();
        });
    });

    describe('GET /api/admin/deliveries', () => {
        beforeEach(async () => {
            // Create test deliveries
            await testUtils.createTestDelivery(Delivery, admin._id);
            await testUtils.createTestDelivery(Delivery, admin._id);
        });

        it('should return all deliveries', async () => {
            const response = await request(app)
                .get('/api/admin/deliveries')
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('deliveries');
            expect(response.body.data).toHaveProperty('pagination');
        });

        it('should filter deliveries by status', async () => {
            const response = await request(app)
                .get('/api/admin/deliveries')
                .query({ status: 'pending' })
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });
    });

    describe('POST /api/admin/deliveries', () => {
        it('should create a new delivery', async () => {
            const deliveryData = {
                pickupLocation: '123 Test Street',
                deliveryLocation: '456 Test Avenue',
                customerName: 'Test Customer',
                customerPhone: '+1234567890',
                fee: 200,
                priority: 'high',
                notes: 'Fragile package'
            };

            const response = await request(app)
                .post('/api/admin/deliveries')
                .set('Authorization', `Bearer ${token}`)
                .send(deliveryData);

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.pickupLocation).toBe(deliveryData.pickupLocation);
            expect(response.body.data.deliveryLocation).toBe(deliveryData.deliveryLocation);
            expect(response.body.data.deliveryCode).toBeDefined();
        });

        it('should validate required fields', async () => {
            const response = await request(app)
                .post('/api/admin/deliveries')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    pickupLocation: '123 Test Street'
                    // Missing required fields
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
        });
    });

    describe('POST /api/admin/deliveries/:id/assign', () => {
        let delivery, driver;

        beforeEach(async () => {
            delivery = await testUtils.createTestDelivery(Delivery, admin._id);
            driver = await testUtils.createTestDriver(Driver);
        });

        it('should assign delivery to driver', async () => {
            const response = await request(app)
                .post(`/api/admin/deliveries/${delivery._id}/assign`)
                .set('Authorization', `Bearer ${token}`)
                .send({
                    driverId: driver._id
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.status).toBe('assigned');
            expect(response.body.data.assignedTo.toString()).toBe(driver._id.toString());
        });

        it('should reject assignment to non-existent driver', async () => {
            const response = await request(app)
                .post(`/api/admin/deliveries/${delivery._id}/assign`)
                .set('Authorization', `Bearer ${token}`)
                .send({
                    driverId: '507f1f77bcf86cd799439011' // Non-existent ID
                });

            expect(response.status).toBe(404);
            expect(response.body.success).toBe(false);
        });
    });

    describe('GET /api/admin/stats', () => {
        beforeEach(async () => {
            // Create test data
            await testUtils.createTestDriver(Driver);
            await testUtils.createTestDelivery(Delivery, admin._id);
        });

        it('should return system statistics', async () => {
            const response = await request(app)
                .get('/api/admin/stats')
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('totalDeliveries');
            expect(response.body.data).toHaveProperty('totalDrivers');
            expect(response.body.data).toHaveProperty('totalEarnings');
        });
    });
}); 