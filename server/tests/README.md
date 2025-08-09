# MongoDB Reliability Tests

This directory contains comprehensive tests for the MongoDB reliability optimization features.

## Test Structure

- **Unit Tests**: Test individual components in isolation with mocked dependencies
- **Integration Tests**: Test components working together with a real MongoDB instance
- **Performance Tests**: Test behavior under load and stress conditions

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (for development)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run a specific test file
npx vitest run tests/databaseService.test.js

# Run tests with verbose output
VERBOSE_TESTS=true npm test
```

## Test Categories

### Database Service Tests

Tests for the core `DatabaseService` class that manages MongoDB connections:

- Connection management
- Retry logic
- Error handling
- Connection pooling
- Health checks

### Error Classification Tests

Tests for the error classification system:

- Error categorization
- Retryability determination
- User-friendly messages
- Handling strategies

### Database Operation Wrapper Tests

Tests for the database operation wrapper utilities:

- Operation retry logic
- Timeout handling
- Transaction support
- Model method wrapping

### Connection Health Monitoring Tests

Tests for the health monitoring services:

- Health checks
- Metrics collection
- Alerting
- Recovery mechanisms

### Integration Tests

Tests for components working together:

- Connection resilience
- Operation retry under network issues
- Performance under connection pool saturation
- Error handling and recovery

## Test Environment

Tests use `mongodb-memory-server` to create an in-memory MongoDB instance for testing, which provides:

- Isolated test environment
- No need for external MongoDB instance
- Fast test execution
- Ability to simulate network issues and failures

## Adding New Tests

When adding new tests:

1. Place unit tests in the `tests/` directory
2. Place integration tests in the `tests/integration/` directory
3. Follow the naming convention: `*.test.js`
4. Use the appropriate test utilities and mocks
5. Ensure tests are isolated and don't depend on external state