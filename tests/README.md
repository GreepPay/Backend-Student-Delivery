# Testing Guide for Student Delivery Backend

This document provides a comprehensive guide to running and writing tests for the Student Delivery Backend API.

## 🧪 Test Structure

```
tests/
├── setup.js              # Test configuration and utilities
├── auth.test.js          # Authentication endpoint tests
├── admin.test.js         # Admin endpoint tests
├── driver.test.js        # Driver endpoint tests
├── delivery.test.js      # Delivery endpoint tests
├── middleware.test.js    # Middleware tests
└── README.md            # This file
```

## 🚀 Running Tests

### Basic Test Commands

```bash
# Run all tests
npm test

# Run tests in watch mode (recommended for development)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run tests for CI/CD
npm run test:ci
```

### Running Specific Tests

```bash
# Run only authentication tests
npm test -- --testNamePattern="Authentication"

# Run only admin tests
npm test -- --testNamePattern="Admin"

# Run only driver tests
npm test -- --testNamePattern="Driver"

# Run only delivery tests
npm test -- --testNamePattern="Delivery"

# Run only middleware tests
npm test -- --testNamePattern="Middleware"
```

## 📊 Test Coverage

The test suite aims for 70% coverage across:

- **Lines**: 70%
- **Functions**: 70%
- **Branches**: 70%
- **Statements**: 70%

### Coverage Report

After running `npm run test:coverage`, you can view the detailed coverage report:

- **HTML Report**: Open `coverage/lcov-report/index.html` in your browser
- **Console Report**: Coverage summary is displayed in the terminal

## 🏗️ Test Setup

### Test Environment

- **Database**: Uses MongoDB Memory Server for isolated testing
- **Authentication**: Mocked JWT tokens for testing
- **Data**: Fresh test data for each test
- **Cleanup**: Automatic cleanup between tests

### Test Utilities

The `tests/setup.js` file provides global test utilities:

```javascript
// Create test admin
const admin = await testUtils.createTestAdmin(Admin);

// Create test driver
const driver = await testUtils.createTestDriver(Driver);

// Create test delivery
const delivery = await testUtils.createTestDelivery(Delivery, adminId);

// Generate test JWT token
const token = testUtils.generateTestToken(userId, userType);
```

## 📝 Writing Tests

### Test Structure

```javascript
describe("Feature Name", () => {
  let setupData;

  beforeEach(async () => {
    // Setup test data
    setupData = await createTestData();
  });

  describe("Endpoint Name", () => {
    it("should do something specific", async () => {
      // Arrange
      const requestData = {
        /* test data */
      };

      // Act
      const response = await request(app)
        .post("/api/endpoint")
        .send(requestData);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
```

### Best Practices

1. **Test Isolation**: Each test should be independent
2. **Descriptive Names**: Use clear, descriptive test names
3. **Arrange-Act-Assert**: Follow the AAA pattern
4. **Edge Cases**: Test error conditions and edge cases
5. **Validation**: Test input validation thoroughly

### Common Test Patterns

#### Authentication Tests

```javascript
it("should reject request without authentication", async () => {
  const response = await request(app).get("/api/protected-endpoint");

  expect(response.status).toBe(401);
  expect(response.body.success).toBe(false);
});
```

#### Validation Tests

```javascript
it("should validate required fields", async () => {
  const response = await request(app).post("/api/endpoint").send({
    // Missing required fields
  });

  expect(response.status).toBe(400);
  expect(response.body.success).toBe(false);
});
```

#### CRUD Tests

```javascript
it("should create new resource", async () => {
  const data = {
    /* test data */
  };

  const response = await request(app).post("/api/resources").send(data);

  expect(response.status).toBe(201);
  expect(response.body.data).toMatchObject(data);
});
```

## 🔧 Test Configuration

### Jest Configuration (`jest.config.js`)

- **Test Environment**: Node.js
- **Coverage Thresholds**: 70% across all metrics
- **Test Timeout**: 10 seconds
- **Setup Files**: `tests/setup.js`
- **Coverage Reports**: HTML, LCOV, and console

### Environment Variables

For testing, the following environment variables are used:

- `JWT_SECRET`: Test JWT secret (defaults to 'test-secret')
- `NODE_ENV`: Set to 'test' automatically

## 🐛 Debugging Tests

### Running Tests in Debug Mode

```bash
# Run specific test with debugging
node --inspect-brk node_modules/.bin/jest --runInBand tests/auth.test.js
```

### Common Issues

1. **Database Connection**: Ensure MongoDB Memory Server is working
2. **JWT Tokens**: Check token generation and validation
3. **Async Operations**: Use proper async/await patterns
4. **Test Data**: Ensure test data is properly created and cleaned up

### Debugging Tips

1. **Console Logs**: Add `console.log()` statements for debugging
2. **Test Isolation**: Ensure tests don't interfere with each other
3. **Data Cleanup**: Verify cleanup is working properly
4. **Error Messages**: Check error messages for clues

## 📈 Continuous Integration

### GitHub Actions Example

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: "18"
      - run: npm ci
      - run: npm run test:ci
```

## 🎯 Test Categories

### 1. Unit Tests

- Individual function testing
- Model validation
- Utility functions

### 2. Integration Tests

- API endpoint testing
- Database operations
- Authentication flows

### 3. End-to-End Tests

- Complete user workflows
- Cross-module interactions

## 📚 Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [MongoDB Memory Server](https://github.com/nodkz/mongodb-memory-server)

## 🤝 Contributing

When adding new features:

1. **Write Tests First**: Follow TDD principles
2. **Cover Edge Cases**: Test error conditions
3. **Update Documentation**: Keep this README updated
4. **Maintain Coverage**: Ensure coverage stays above 70%

## 📞 Support

If you encounter issues with tests:

1. Check the test logs for error messages
2. Verify test data setup
3. Ensure all dependencies are installed
4. Check Jest configuration
5. Review the test examples in this guide
