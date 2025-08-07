const request = require('supertest');
const app = require('../src/app');

describe('Basic API Tests', () => {
    describe('Health Check', () => {
        it('should return health status', async () => {
            const response = await request(app)
                .get('/health');

            expect(response.status).toBe(200);
            expect(response.body.status).toBe('OK');
        });
    });

    describe('Root Endpoint', () => {
        it('should return API information', async () => {
            const response = await request(app)
                .get('/');

            expect(response.status).toBe(200);
            expect(response.body.message).toBe('Student Delivery System API');
        });
    });

    describe('Error Handling', () => {
        it('should handle 404 errors', async () => {
            const response = await request(app)
                .get('/api/nonexistent-endpoint');

            expect(response.status).toBe(404);
            expect(response.body.success).toBe(false);
        });
    });

    describe('CORS', () => {
        it('should include CORS headers', async () => {
            const response = await request(app)
                .options('/api/auth/send-otp')
                .set('Origin', 'http://localhost:3000');

            expect(response.headers['access-control-allow-origin']).toBeDefined();
        });
    });
}); 