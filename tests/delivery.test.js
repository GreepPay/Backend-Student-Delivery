const request = require('supertest');
const app = require('../src/app');
const Delivery = require('../src/models/Delivery');
const Admin = require('../src/models/Admin');
const Driver = require('../src/models/Driver');

describe('Delivery Endpoints Tests', () => {
    let admin, delivery;

    beforeEach(async () => {
        admin = await testUtils.createTestAdmin(Admin);
        delivery = await testUtils.createTestDelivery(Delivery, admin._id);
    });

    describe('GET /api/delivery/track/:deliveryCode', () => {
        it('should track delivery by code', async () => {
            const response = await request(app)
                .get(`/api/delivery/track/${delivery.deliveryCode}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.deliveryCode).toBe(delivery.deliveryCode);
            expect(response.body.data.status).toBe(delivery.status);
            expect(response.body.data.pickupLocation).toBe(delivery.pickupLocation);
            expect(response.body.data.deliveryLocation).toBe(delivery.deliveryLocation);
        });

        it('should return 404 for non-existent delivery code', async () => {
            const response = await request(app)
                .get('/api/delivery/track/NONEXISTENT');

            expect(response.status).toBe(404);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Delivery not found');
        });
    });

    describe('GET /api/delivery/public/stats', () => {
        beforeEach(async () => {
            // Create additional test data
            await testUtils.createTestDelivery(Delivery, admin._id);
            await testUtils.createTestDelivery(Delivery, admin._id);

            // Mark some deliveries as completed
            const deliveries = await Delivery.find();
            deliveries[1].status = 'delivered';
            await deliveries[1].save();
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
            expect(response.body.data.totalDeliveries).toBeGreaterThan(0);
        });
    });

    describe('GET /api/delivery/:id (Authenticated)', () => {
        let token;

        beforeEach(async () => {
            token = testUtils.generateTestToken(admin._id, 'admin');
        });

        it('should return delivery details for authenticated user', async () => {
            const response = await request(app)
                .get(`/api/delivery/${delivery._id}`)
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data._id).toBe(delivery._id.toString());
            expect(response.body.data.pickupLocation).toBe(delivery.pickupLocation);
            expect(response.body.data.deliveryLocation).toBe(delivery.deliveryLocation);
        });

        it('should return 404 for non-existent delivery', async () => {
            const response = await request(app)
                .get('/api/delivery/507f1f77bcf86cd799439011')
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(404);
            expect(response.body.success).toBe(false);
        });

        it('should reject request without authentication', async () => {
            const response = await request(app)
                .get(`/api/delivery/${delivery._id}`);

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
        });
    });

    describe('GET /api/delivery (Authenticated)', () => {
        let token;

        beforeEach(async () => {
            token = testUtils.generateTestToken(admin._id, 'admin');
            // Create additional deliveries
            await testUtils.createTestDelivery(Delivery, admin._id);
            await testUtils.createTestDelivery(Delivery, admin._id);
        });

        it('should return all deliveries for authenticated user', async () => {
            const response = await request(app)
                .get('/api/delivery')
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('deliveries');
            expect(response.body.data).toHaveProperty('pagination');
            expect(response.body.data.deliveries).toHaveLength(3);
        });

        it('should filter deliveries by status', async () => {
            const response = await request(app)
                .get('/api/delivery')
                .query({ status: 'pending' })
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.deliveries).toHaveLength(3); // All are pending
        });

        it('should paginate results', async () => {
            const response = await request(app)
                .get('/api/delivery')
                .query({ page: 1, limit: 2 })
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.deliveries).toHaveLength(2);
            expect(response.body.data.pagination).toHaveProperty('totalPages');
            expect(response.body.data.pagination).toHaveProperty('currentPage');
        });

        it('should filter by date range', async () => {
            const response = await request(app)
                .get('/api/delivery')
                .query({
                    startDate: '2024-01-01',
                    endDate: '2024-12-31'
                })
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });

        it('should search by customer name', async () => {
            const response = await request(app)
                .get('/api/delivery')
                .query({ search: 'Test Customer' })
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });
    });
});

describe('Delivery Model Tests', () => {
    let admin;

    beforeEach(async () => {
        admin = await testUtils.createTestAdmin(Admin);
    });

    describe('Delivery Creation', () => {
        it('should create delivery with auto-generated code', async () => {
            const deliveryData = {
                pickupLocation: '123 Test St',
                deliveryLocation: '456 Test Ave',
                customerName: 'Test Customer',
                customerPhone: '+1234567890',
                fee: 150,
                assignedBy: admin._id
            };

            const delivery = await Delivery.create(deliveryData);

            expect(delivery.deliveryCode).toBeDefined();
            expect(delivery.deliveryCode).toMatch(/^GRP-\d{6}$/);
            expect(delivery.status).toBe('pending');
            expect(delivery.fee).toBe(150);
            expect(delivery.driverEarning).toBe(100); // Default value
            expect(delivery.companyEarning).toBe(50); // Default value
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
                    assignedBy: admin._id
                });
                fail('Should have thrown validation error');
            } catch (error) {
                expect(error.name).toBe('ValidationError');
            }
        });
    });

    describe('Delivery Status Transitions', () => {
        let delivery;

        beforeEach(async () => {
            delivery = await testUtils.createTestDelivery(Delivery, admin._id);
        });

        it('should update status to assigned', async () => {
            const driver = await testUtils.createTestDriver(Driver);

            delivery.assignedTo = driver._id;
            delivery.status = 'assigned';
            await delivery.save();

            expect(delivery.status).toBe('assigned');
            expect(delivery.assignedAt).toBeDefined();
        });

        it('should update status to picked_up', async () => {
            delivery.status = 'picked_up';
            await delivery.save();

            expect(delivery.status).toBe('picked_up');
            expect(delivery.pickedUpAt).toBeDefined();
        });

        it('should update status to delivered', async () => {
            delivery.status = 'delivered';
            await delivery.save();

            expect(delivery.status).toBe('delivered');
            expect(delivery.deliveredAt).toBeDefined();
            expect(delivery.deliveryTime).toBeDefined();
        });

        it('should calculate delivery duration', async () => {
            delivery.assignedAt = new Date('2024-01-01T10:00:00Z');
            delivery.deliveredAt = new Date('2024-01-01T11:30:00Z');
            await delivery.save();

            expect(delivery.deliveryDuration).toBe(90); // 90 minutes
        });
    });

    describe('Delivery Virtuals', () => {
        let delivery;

        beforeEach(async () => {
            delivery = await testUtils.createTestDelivery(Delivery, admin._id);
        });

        it('should return correct status color', () => {
            const statusColors = {
                pending: '#fbbf24',
                assigned: '#3b82f6',
                picked_up: '#f59e0b',
                delivered: '#10b981',
                cancelled: '#ef4444'
            };

            delivery.status = 'pending';
            expect(delivery.statusColor).toBe(statusColors.pending);

            delivery.status = 'delivered';
            expect(delivery.statusColor).toBe(statusColors.delivered);
        });
    });

    describe('Delivery Static Methods', () => {
        beforeEach(async () => {
            // Create some test deliveries
            await testUtils.createTestDelivery(Delivery, admin._id);
            await testUtils.createTestDelivery(Delivery, admin._id);
        });

        it('should get next delivery code', async () => {
            const nextCode = await Delivery.getNextDeliveryCode();
            expect(nextCode).toMatch(/^#\d{3}$/);
        });

        it('should find deliveries by status', async () => {
            const pendingDeliveries = await Delivery.findByStatus('pending');
            expect(pendingDeliveries).toBeInstanceOf(Array);
            expect(pendingDeliveries.length).toBeGreaterThan(0);
        });

        it('should find deliveries by driver', async () => {
            const driver = await testUtils.createTestDriver(Driver);
            const delivery = await testUtils.createTestDelivery(Delivery, admin._id);
            delivery.assignedTo = driver._id;
            await delivery.save();

            const driverDeliveries = await Delivery.findByDriver(driver._id);
            expect(driverDeliveries).toBeInstanceOf(Array);
            expect(driverDeliveries.length).toBe(1);
        });
    });
}); 