const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

// Setup before all tests
beforeAll(async () => {
    // Set test environment variables
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-secret-key';
    process.env.JWT_EXPIRES_IN = '1h';
    process.env.EMAIL_USER = 'test@example.com';
    process.env.EMAIL_PASSWORD = 'test-password';
    process.env.EMAIL_FROM_NAME = 'Test System';

    // Start in-memory MongoDB server
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    // Connect to in-memory database
    await mongoose.connect(mongoUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });
});

// Cleanup after each test
afterEach(async () => {
    // Clear all collections
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        const collection = collections[key];
        await collection.deleteMany();
    }
});

// Cleanup after all tests
afterAll(async () => {
    // Close database connection
    await mongoose.connection.close();

    // Stop in-memory server
    if (mongoServer) {
        await mongoServer.stop();
    }
});

// Mock email service for testing
jest.mock('../src/services/emailService', () => ({
    EmailService: jest.fn().mockImplementation(() => ({
        sendOTP: jest.fn().mockResolvedValue({ success: true, messageId: 'test-message-id' }),
        sendDriverInvitation: jest.fn().mockResolvedValue({ success: true, messageId: 'test-message-id' }),
        sendDeliveryAssignment: jest.fn().mockResolvedValue({ success: true, messageId: 'test-message-id' }),
        sendMonthlyReport: jest.fn().mockResolvedValue({ success: true, messageId: 'test-message-id' }),
        testConnection: jest.fn().mockResolvedValue(true)
    }))
}));

// Global test utilities
global.testUtils = {
    // Create test admin
    createTestAdmin: async (Admin) => {
        return await Admin.create({
            name: 'Test Admin',
            email: 'admin@test.com',
            password: 'password123',
            role: 'admin',
            permissions: ['view_analytics', 'manage_drivers', 'create_delivery']
        });
    },

    // Create test driver
    createTestDriver: async (Driver) => {
        return await Driver.create({
            name: 'Test Driver',
            email: 'driver@test.com',
            phone: '+1234567890',
            area: 'Gonyeli',
            isActive: true
        });
    },

    // Create test delivery
    createTestDelivery: async (Delivery, adminId) => {
        return await Delivery.create({
            pickupLocation: '123 Test St',
            deliveryLocation: '456 Test Ave',
            customerName: 'Test Customer',
            customerPhone: '+1234567890',
            fee: 150,
            assignedBy: adminId,
            status: 'pending',
            deliveryCode: 'GRP-123456'
        });
    },

    // Generate JWT token for testing
    generateTestToken: (userId, userType = 'admin') => {
        const jwt = require('jsonwebtoken');
        return jwt.sign(
            { id: userId, userType },
            process.env.JWT_SECRET || 'test-secret',
            { expiresIn: '1h' }
        );
    }
}; 