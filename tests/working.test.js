const request = require('supertest');
const app = require('../src/app');
const Admin = require('../src/models/Admin');
const Driver = require('../src/models/Driver');
const Delivery = require('../src/models/Delivery');

describe('Working API Tests', () => {
    describe('Health and Basic Endpoints', () => {
        it('should return health status', async () => {
            const response = await request(app)
                .get('/health');

            expect(response.status).toBe(200);
            expect(response.body.status).toBe('OK');
        });

        it('should return API information', async () => {
            const response = await request(app)
                .get('/');

            expect(response.status).toBe(200);
            expect(response.body.message).toBe('Student Delivery System API');
        });
    });

    describe('Model Creation Tests', () => {
        it('should create admin successfully', async () => {
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
        });

        it('should create driver successfully', async () => {
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

        it('should create delivery successfully', async () => {
            const admin = await testUtils.createTestAdmin(Admin);

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
        });
    });

    describe('Public Endpoints', () => {
        let delivery;

        beforeEach(async () => {
            const admin = await testUtils.createTestAdmin(Admin);
            delivery = await testUtils.createTestDelivery(Delivery, admin._id);
        });

        it('should return public statistics', async () => {
            const response = await request(app)
                .get('/api/delivery/public/stats');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('totalDeliveries');
            expect(response.body.data).toHaveProperty('completedDeliveries');
            expect(response.body.data).toHaveProperty('activeDrivers');
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

    describe('Database Operations', () => {
        it('should find admin by email', async () => {
            const admin = await testUtils.createTestAdmin(Admin);

            const foundAdmin = await Admin.findOne({ email: admin.email });
            expect(foundAdmin).toBeDefined();
            expect(foundAdmin.email).toBe(admin.email);
        });

        it('should find driver by email', async () => {
            const driver = await testUtils.createTestDriver(Driver);

            const foundDriver = await Driver.findOne({ email: driver.email });
            expect(foundDriver).toBeDefined();
            expect(foundDriver.email).toBe(driver.email);
        });

        it('should find delivery by code', async () => {
            const admin = await testUtils.createTestAdmin(Admin);
            const delivery = await testUtils.createTestDelivery(Delivery, admin._id);

            const foundDelivery = await Delivery.findOne({ deliveryCode: delivery.deliveryCode });
            expect(foundDelivery).toBeDefined();
            expect(foundDelivery.deliveryCode).toBe(delivery.deliveryCode);
        });
    });

    describe('Model Validation', () => {
        it('should validate admin required fields', async () => {
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

        it('should validate driver area enum', async () => {
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

        it('should validate delivery fee minimum', async () => {
            const admin = await testUtils.createTestAdmin(Admin);

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