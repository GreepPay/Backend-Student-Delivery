const request = require('supertest');
const app = require('../src/app');
const Admin = require('../src/models/Admin');
const Driver = require('../src/models/Driver');
const Delivery = require('../src/models/Delivery');

describe('Basic Integration Tests', () => {
    describe('Health Check', () => {
        it('should return health status', async () => {
            const response = await request(app)
                .get('/health');

            expect(response.status).toBe(200);
            expect(response.body.status).toBe('OK');
            expect(response.body).toHaveProperty('timestamp');
            expect(response.body).toHaveProperty('uptime');
        });
    });

    describe('Root Endpoint', () => {
        it('should return API information', async () => {
            const response = await request(app)
                .get('/');

            expect(response.status).toBe(200);
            expect(response.body.message).toBe('Student Delivery System API');
            expect(response.body.version).toBe('1.0.0');
        });
    });

    describe('Public Delivery Tracking', () => {
        let delivery;

        beforeEach(async () => {
            const admin = await testUtils.createTestAdmin(Admin);
            delivery = await testUtils.createTestDelivery(Delivery, admin._id);
        });

        it('should track delivery by code', async () => {
            const response = await request(app)
                .get(`/api/delivery/track/${delivery.deliveryCode}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.deliveryCode).toBe(delivery.deliveryCode);
        });

        it('should return 404 for non-existent delivery', async () => {
            const response = await request(app)
                .get('/api/delivery/track/NONEXISTENT');

            expect(response.status).toBe(404);
            expect(response.body.success).toBe(false);
        });
    });

    describe('Public Statistics', () => {
        beforeEach(async () => {
            const admin = await testUtils.createTestAdmin(Admin);
            await testUtils.createTestDelivery(Delivery, admin._id);
            await testUtils.createTestDriver(Driver);
        });

        it('should return public statistics', async () => {
            const response = await request(app)
                .get('/api/delivery/public/stats');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('totalDeliveries');
            expect(response.body.data).toHaveProperty('completedDeliveries');
            expect(response.body.data).toHaveProperty('activeDrivers');
            expect(response.body.data).toHaveProperty('completionRate');
        });
    });

    describe('Model Tests', () => {
        describe('Admin Model', () => {
            it('should create admin with valid data', async () => {
                const adminData = {
                    name: 'Test Admin',
                    email: 'admin@test.com',
                    password: 'password123',
                    role: 'admin',
                    permissions: ['view_analytics']
                };

                const admin = await Admin.create(adminData);

                expect(admin.name).toBe(adminData.name);
                expect(admin.email).toBe(adminData.email);
                expect(admin.role).toBe(adminData.role);
                // Check that permissions include the expected ones (may have defaults)
                expect(admin.permissions).toContain('view_analytics');
            });

            it('should validate required fields', async () => {
                try {
                    await Admin.create({
                        name: 'Test Admin'
                        // Missing required fields
                    });
                    fail('Should have thrown validation error');
                } catch (error) {
                    expect(error.name).toBe('ValidationError');
                }
            });
        });

        describe('Driver Model', () => {
            it('should create driver with valid data', async () => {
                const driverData = {
                    name: 'Test Driver',
                    email: 'driver@test.com',
                    phone: '+1234567890',
                    area: 'Gonyeli'
                };

                const driver = await Driver.create(driverData);

                expect(driver.name).toBe(driverData.name);
                expect(driver.email).toBe(driverData.email);
                expect(driver.area).toBe(driverData.area);
            });

            it('should validate area enum', async () => {
                try {
                    await Driver.create({
                        name: 'Test Driver',
                        email: 'driver@test.com',
                        area: 'InvalidArea'
                    });
                    fail('Should have thrown validation error');
                } catch (error) {
                    expect(error.name).toBe('ValidationError');
                }
            });
        });

        describe('Delivery Model', () => {
            let admin;

            beforeEach(async () => {
                admin = await testUtils.createTestAdmin(Admin);
            });

            it('should create delivery with valid data', async () => {
                const deliveryData = {
                    pickupLocation: '123 Test St',
                    deliveryLocation: '456 Test Ave',
                    customerName: 'Test Customer',
                    customerPhone: '+1234567890',
                    fee: 150,
                    assignedBy: admin._id,
                    deliveryCode: 'GRP-123456'
                };

                const delivery = await Delivery.create(deliveryData);

                expect(delivery.pickupLocation).toBe(deliveryData.pickupLocation);
                expect(delivery.deliveryLocation).toBe(deliveryData.deliveryLocation);
                expect(delivery.deliveryCode).toBe(deliveryData.deliveryCode);
                expect(delivery.status).toBe('pending');
            });

            it('should validate required fields', async () => {
                try {
                    await Delivery.create({
                        pickupLocation: '123 Test St'
                        // Missing required fields
                    });
                    fail('Should have thrown validation error');
                } catch (error) {
                    expect(error.name).toBe('ValidationError');
                }
            });

            it('should validate fee minimum', async () => {
                try {
                    await Delivery.create({
                        pickupLocation: '123 Test St',
                        deliveryLocation: '456 Test Ave',
                        customerName: 'Test Customer',
                        customerPhone: '+1234567890',
                        fee: 0, // Below minimum
                        assignedBy: admin._id,
                        deliveryCode: 'GRP-123456'
                    });
                    fail('Should have thrown validation error');
                } catch (error) {
                    expect(error.name).toBe('ValidationError');
                }
            });
        });
    });

    describe('Error Handling', () => {
        it('should handle 404 errors', async () => {
            const response = await request(app)
                .get('/api/nonexistent-endpoint');

            expect(response.status).toBe(404);
            expect(response.body.success).toBe(false);
        });

        it('should handle validation errors', async () => {
            const response = await request(app)
                .post('/api/auth/send-otp')
                .send({
                    // Missing required fields
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
        });
    });

    describe('CORS', () => {
        it('should include CORS headers', async () => {
            const response = await request(app)
                .options('/api/auth/send-otp')
                .set('Origin', 'http://localhost:3000');

            expect(response.headers['access-control-allow-origin']).toBeDefined();
            expect(response.headers['access-control-allow-methods']).toBeDefined();
        });
    });
}); 