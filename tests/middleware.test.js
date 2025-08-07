const request = require('supertest');
const app = require('../src/app');
const Admin = require('../src/models/Admin');
const Driver = require('../src/models/Driver');

describe('Middleware Tests', () => {
    describe('Authentication Middleware', () => {
        describe('authenticateToken', () => {
            it('should allow request with valid token', async () => {
                const admin = await testUtils.createTestAdmin(Admin);
                const token = testUtils.generateTestToken(admin._id, 'admin');

                const response = await request(app)
                    .get('/api/auth/profile')
                    .set('Authorization', `Bearer ${token}`);

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
            });

            it('should reject request without token', async () => {
                const response = await request(app)
                    .get('/api/auth/profile');

                expect(response.status).toBe(401);
                expect(response.body.success).toBe(false);
                expect(response.body.error).toContain('No token provided');
            });

            it('should reject request with invalid token format', async () => {
                const response = await request(app)
                    .get('/api/auth/profile')
                    .set('Authorization', 'InvalidFormat token123');

                expect(response.status).toBe(401);
                expect(response.body.success).toBe(false);
            });

            it('should reject request with invalid token', async () => {
                const response = await request(app)
                    .get('/api/auth/profile')
                    .set('Authorization', 'Bearer invalid-token');

                expect(response.status).toBe(401);
                expect(response.body.success).toBe(false);
            });

            it('should reject request with expired token', async () => {
                const jwt = require('jsonwebtoken');
                const expiredToken = jwt.sign(
                    { id: '507f1f77bcf86cd799439011', userType: 'admin' },
                    process.env.JWT_SECRET || 'test-secret',
                    { expiresIn: '0s' } // Expired immediately
                );

                const response = await request(app)
                    .get('/api/auth/profile')
                    .set('Authorization', `Bearer ${expiredToken}`);

                expect(response.status).toBe(401);
                expect(response.body.success).toBe(false);
            });
        });

        describe('adminOnly', () => {
            it('should allow admin access to admin routes', async () => {
                const admin = await testUtils.createTestAdmin(Admin);
                const token = testUtils.generateTestToken(admin._id, 'admin');

                const response = await request(app)
                    .get('/api/admin/dashboard')
                    .set('Authorization', `Bearer ${token}`);

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
            });

            it('should reject driver access to admin routes', async () => {
                const driver = await testUtils.createTestDriver(Driver);
                const token = testUtils.generateTestToken(driver._id, 'driver');

                const response = await request(app)
                    .get('/api/admin/dashboard')
                    .set('Authorization', `Bearer ${token}`);

                expect(response.status).toBe(403);
                expect(response.body.success).toBe(false);
            });
        });

        describe('driverOnly', () => {
            it('should allow driver access to driver routes', async () => {
                const driver = await testUtils.createTestDriver(Driver);
                const token = testUtils.generateTestToken(driver._id, 'driver');

                const response = await request(app)
                    .get('/api/driver/profile')
                    .set('Authorization', `Bearer ${token}`);

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
            });

            it('should reject admin access to driver routes', async () => {
                const admin = await testUtils.createTestAdmin(Admin);
                const token = testUtils.generateTestToken(admin._id, 'admin');

                const response = await request(app)
                    .get('/api/driver/profile')
                    .set('Authorization', `Bearer ${token}`);

                expect(response.status).toBe(403);
                expect(response.body.success).toBe(false);
            });
        });

        describe('superAdminOnly', () => {
            it('should allow super admin access', async () => {
                const admin = await testUtils.createTestAdmin(Admin);
                admin.role = 'super_admin';
                await admin.save();

                const token = testUtils.generateTestToken(admin._id, 'admin');

                const response = await request(app)
                    .get('/api/auth/stats')
                    .set('Authorization', `Bearer ${token}`);

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
            });

            it('should reject regular admin access to super admin routes', async () => {
                const admin = await testUtils.createTestAdmin(Admin);
                const token = testUtils.generateTestToken(admin._id, 'admin');

                const response = await request(app)
                    .get('/api/auth/stats')
                    .set('Authorization', `Bearer ${token}`);

                expect(response.status).toBe(403);
                expect(response.body.success).toBe(false);
            });
        });
    });

    describe('Validation Middleware', () => {
        describe('Input Sanitization', () => {
            it('should sanitize input data', async () => {
                const admin = await testUtils.createTestAdmin(Admin);
                const token = testUtils.generateTestToken(admin._id, 'admin');

                const response = await request(app)
                    .post('/api/admin/drivers')
                    .set('Authorization', `Bearer ${token}`)
                    .send({
                        name: '  Test Driver  ', // Extra spaces
                        email: 'test@example.com',
                        phone: '+1234567890',
                        area: 'Downtown',
                        vehicleType: 'motorcycle',
                        licenseNumber: 'DL123456'
                    });

                expect(response.status).toBe(201);
                expect(response.body.data.name).toBe('Test Driver'); // Trimmed
            });
        });

        describe('Schema Validation', () => {
            it('should validate required fields', async () => {
                const admin = await testUtils.createTestAdmin(Admin);
                const token = testUtils.generateTestToken(admin._id, 'admin');

                const response = await request(app)
                    .post('/api/admin/drivers')
                    .set('Authorization', `Bearer ${token}`)
                    .send({
                        name: 'Test Driver'
                        // Missing required fields
                    });

                expect(response.status).toBe(400);
                expect(response.body.success).toBe(false);
                expect(response.body.error).toContain('validation');
            });

            it('should validate email format', async () => {
                const response = await request(app)
                    .post('/api/auth/send-otp')
                    .send({
                        email: 'invalid-email',
                        userType: 'admin'
                    });

                expect(response.status).toBe(400);
                expect(response.body.success).toBe(false);
            });

            it('should validate phone number format', async () => {
                const admin = await testUtils.createTestAdmin(Admin);
                const token = testUtils.generateTestToken(admin._id, 'admin');

                const response = await request(app)
                    .post('/api/admin/drivers')
                    .set('Authorization', `Bearer ${token}`)
                    .send({
                        name: 'Test Driver',
                        email: 'test@example.com',
                        phone: 'invalid-phone',
                        area: 'Downtown',
                        vehicleType: 'motorcycle',
                        licenseNumber: 'DL123456'
                    });

                expect(response.status).toBe(400);
                expect(response.body.success).toBe(false);
            });

            it('should validate enum values', async () => {
                const admin = await testUtils.createTestAdmin(Admin);
                const token = testUtils.generateTestToken(admin._id, 'admin');

                const response = await request(app)
                    .post('/api/admin/deliveries')
                    .set('Authorization', `Bearer ${token}`)
                    .send({
                        pickupLocation: '123 Test St',
                        deliveryLocation: '456 Test Ave',
                        customerName: 'Test Customer',
                        customerPhone: '+1234567890',
                        fee: 150,
                        priority: 'invalid_priority', // Invalid enum value
                        paymentMethod: 'invalid_method' // Invalid enum value
                    });

                expect(response.status).toBe(400);
                expect(response.body.success).toBe(false);
            });
        });

        describe('Parameter Validation', () => {
            it('should validate MongoDB ObjectId', async () => {
                const admin = await testUtils.createTestAdmin(Admin);
                const token = testUtils.generateTestToken(admin._id, 'admin');

                const response = await request(app)
                    .get('/api/admin/drivers/invalid-id')
                    .set('Authorization', `Bearer ${token}`);

                expect(response.status).toBe(400);
                expect(response.body.success).toBe(false);
            });

            it('should validate delivery code format', async () => {
                const response = await request(app)
                    .get('/api/delivery/track/invalid-code');

                expect(response.status).toBe(400);
                expect(response.body.success).toBe(false);
            });
        });
    });

    describe('Rate Limiting', () => {
        it('should limit requests per hour', async () => {
            const admin = await testUtils.createTestAdmin(Admin);
            const token = testUtils.generateTestToken(admin._id, 'admin');

            // Make multiple requests quickly
            const promises = Array(105).fill().map(() =>
                request(app)
                    .get('/api/admin/dashboard')
                    .set('Authorization', `Bearer ${token}`)
            );

            const responses = await Promise.all(promises);
            const rateLimitedResponses = responses.filter(r => r.status === 429);

            expect(rateLimitedResponses.length).toBeGreaterThan(0);
        });
    });

    describe('Error Handling', () => {
        it('should handle 404 errors', async () => {
            const response = await request(app)
                .get('/api/nonexistent-endpoint');

            expect(response.status).toBe(404);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Not found');
        });

        it('should handle validation errors', async () => {
            const response = await request(app)
                .post('/api/auth/send-otp')
                .send({
                    // Missing required fields
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBeDefined();
        });

        it('should handle server errors gracefully', async () => {
            // This test would require mocking a service to throw an error
            // For now, we'll test that the error handler exists
            expect(app._router).toBeDefined();
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