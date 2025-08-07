const request = require('supertest');
const app = require('../src/app');
const Admin = require('../src/models/Admin');
const Driver = require('../src/models/Driver');
const OTP = require('../src/models/OTP');

describe('Authentication Tests', () => {
    describe('POST /api/auth/send-otp', () => {
        it('should send OTP to valid admin email', async () => {
            const admin = await testUtils.createTestAdmin(Admin);

            const response = await request(app)
                .post('/api/auth/send-otp')
                .send({
                    email: admin.email,
                    userType: 'admin'
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toContain('OTP sent');
        });

        it('should send OTP to valid driver email', async () => {
            const driver = await testUtils.createTestDriver(Driver);

            const response = await request(app)
                .post('/api/auth/send-otp')
                .send({
                    email: driver.email,
                    userType: 'driver'
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });

        it('should reject invalid email format', async () => {
            const response = await request(app)
                .post('/api/auth/send-otp')
                .send({
                    email: 'invalid-email',
                    userType: 'admin'
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
        });

        it('should reject invalid user type', async () => {
            const response = await request(app)
                .post('/api/auth/send-otp')
                .send({
                    email: 'test@example.com',
                    userType: 'invalid'
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
        });
    });

    describe('POST /api/auth/verify-otp', () => {
        let admin, otp;

        beforeEach(async () => {
            admin = await testUtils.createTestAdmin(Admin);

            // Create a test OTP
            otp = await OTP.create({
                email: admin.email,
                otp: '123456',
                userType: 'admin',
                expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes from now
            });
        });

        it('should verify valid OTP and return token', async () => {
            const response = await request(app)
                .post('/api/auth/verify-otp')
                .send({
                    email: admin.email,
                    otp: '123456',
                    userType: 'admin'
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('token');
            expect(response.body.data).toHaveProperty('user');
            expect(response.body.data.user.email).toBe(admin.email);
        });

        it('should reject invalid OTP', async () => {
            const response = await request(app)
                .post('/api/auth/verify-otp')
                .send({
                    email: admin.email,
                    otp: '000000',
                    userType: 'admin'
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
        });

        it('should reject expired OTP', async () => {
            // Create expired OTP
            await OTP.create({
                email: admin.email,
                otp: '654321',
                userType: 'admin',
                expiresAt: new Date(Date.now() - 10 * 60 * 1000) // 10 minutes ago
            });

            const response = await request(app)
                .post('/api/auth/verify-otp')
                .send({
                    email: admin.email,
                    otp: '654321',
                    userType: 'admin'
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
        });
    });

    describe('POST /api/auth/resend-otp', () => {
        it('should resend OTP to valid email', async () => {
            const admin = await testUtils.createTestAdmin(Admin);

            const response = await request(app)
                .post('/api/auth/resend-otp')
                .send({
                    email: admin.email,
                    userType: 'admin'
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });
    });

    describe('GET /api/auth/can-request-otp', () => {
        it('should return true for new email', async () => {
            const response = await request(app)
                .get('/api/auth/can-request-otp')
                .query({
                    email: 'new@example.com',
                    userType: 'admin'
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.canRequest).toBe(true);
        });

        it('should return false for recently requested email', async () => {
            const admin = await testUtils.createTestAdmin(Admin);

            // Create recent OTP
            await OTP.create({
                email: admin.email,
                otp: '123456',
                userType: 'admin',
                expiresAt: new Date(Date.now() + 10 * 60 * 1000)
            });

            const response = await request(app)
                .get('/api/auth/can-request-otp')
                .query({
                    email: admin.email,
                    userType: 'admin'
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.canRequest).toBe(false);
        });
    });

    describe('Protected Routes', () => {
        let admin, token;

        beforeEach(async () => {
            admin = await testUtils.createTestAdmin(Admin);
            token = testUtils.generateTestToken(admin._id, 'admin');
        });

        describe('GET /api/auth/profile', () => {
            it('should return user profile with valid token', async () => {
                const response = await request(app)
                    .get('/api/auth/profile')
                    .set('Authorization', `Bearer ${token}`);

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
                expect(response.body.data.email).toBe(admin.email);
            });

            it('should reject request without token', async () => {
                const response = await request(app)
                    .get('/api/auth/profile');

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
        });

        describe('POST /api/auth/logout', () => {
            it('should logout successfully', async () => {
                const response = await request(app)
                    .post('/api/auth/logout')
                    .set('Authorization', `Bearer ${token}`);

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
            });
        });
    });
}); 