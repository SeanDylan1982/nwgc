# Retry Utilities Documentation

This document provides an overview of the retry utilities implemented for MongoDB operations in the Neighbourhood Watch application.

## Overview

The retry utilities provide a robust mechanism for handling transient errors in MongoDB operations through exponential backoff with jitter. This helps prevent cascading failures and improves application reliability during network fluctuations or database unavailability.

## Key Components

### 1. Error Classification

The `classifyError` function categorizes MongoDB errors into three types:

- **Transient Errors**: Temporary issues that can be resolved with retries (network timeouts, connection resets)
- **Persistent Errors**: Issues requiring intervention (validation errors, duplicate keys)
- **Fatal Errors**: Critical issues requiring immediate attention (authentication failures)

```javascript
const classification = classifyError(error);
console.log(`Error type: ${classification.type}`);
console.log(`Should retry: ${classification.retryable}`);
```

### 2. Exponential Backoff with Jitter

The retry mechanism uses exponential backoff with jitter to prevent the "thundering herd" problem:

- **Exponential Backoff**: Each retry waits longer than the previous one (e.g., 100ms, 200ms, 400ms)
- **Jitter**: Random variation added to delay times to prevent synchronized retries

```javascript
const delay = calculateBackoffDelay(attempt, initialDelayMs, maxDelayMs, jitterFactor);
```

### 3. Retry Wrapper

The `withRetry` function wraps operations with configurable retry logic:

```javascript
const result = await withRetry(
  async () => {
    // Database operation here
    return await User.findById(userId);
  },
  {
    maxRetries: 3,
    initialDelayMs: 100,
    maxDelayMs: 5000,
    jitterFactor: 0.2
  }
);
```

### 4. Database Operation Wrapper

The `executeQuery` function combines retry logic with timeout handling:

```javascript
const users = await executeQuery(
  async () => {
    return await User.find({ active: true });
  },
  {
    timeout: 5000,
    errorMessage: 'Failed to retrieve active users',
    retryOptions: { maxRetries: 3 }
  }
);
```

## Configuration Options

### withRetry Options

| Option | Description | Default |
|--------|-------------|---------|
| maxRetries | Maximum number of retry attempts | 3 |
| initialDelayMs | Initial delay before first retry (ms) | 100 |
| maxDelayMs | Maximum delay between retries (ms) | 5000 |
| jitterFactor | Factor to determine jitter amount (0-1) | 0.2 |
| shouldRetry | Function to determine if operation should be retried | Based on error classification |
| onRetry | Callback function executed before each retry | null |
| logRetries | Whether to log retry attempts | true |

### executeQuery Options

| Option | Description | Default |
|--------|-------------|---------|
| timeout | Operation timeout in milliseconds | 30000 |
| retryOptions | Options passed to withRetry | {} |
| errorMessage | Custom error message prefix | 'Operation failed' |

## Best Practices

1. **Use for Network-Dependent Operations**: Apply retry logic to operations that might fail due to network issues.
2. **Avoid for Validation Errors**: Don't retry operations that fail due to validation or business logic errors.
3. **Configure Appropriately**: Adjust retry parameters based on operation criticality and expected failure modes.
4. **Monitor Retry Rates**: High retry rates may indicate underlying infrastructure issues.
5. **Use Circuit Breakers**: For persistent failures, consider implementing circuit breakers to prevent cascading failures.

## Examples

### Basic Retry

```javascript
const user = await withRetry(async () => {
  return await User.findById(userId);
});
```

### Custom Retry Configuration

```javascript
const result = await withRetry(
  async () => {
    return await someOperation();
  },
  {
    maxRetries: 5,
    initialDelayMs: 200,
    shouldRetry: (error) => error.name === 'MongoNetworkError'
  }
);
```

### Making Functions Retryable

```javascript
const findUserById = makeRetryable(
  async (id) => await User.findById(id),
  { maxRetries: 3 }
);

// Later use
const user = await findUserById('123');
```

### With Timeout

```javascript
const reports = await executeWithTimeout(
  async () => await Report.find({ urgent: true }),
  { timeout: 3000 }
);
```