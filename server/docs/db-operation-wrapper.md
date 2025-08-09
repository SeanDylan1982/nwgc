# Database Operation Wrapper

This document provides guidance on using the enhanced database operation wrapper for reliable MongoDB operations in the Neighbourhood Watch application.

## Overview

The `dbOperationWrapper` module provides robust utilities for executing database operations with:

- Automatic retry with exponential backoff
- Timeout handling for long-running operations
- Comprehensive error classification and handling
- Detailed logging for debugging and monitoring
- Transaction support with proper error handling

## Key Features

1. **Retry Logic**: Automatically retries failed operations with exponential backoff and jitter
2. **Timeout Handling**: Prevents operations from hanging indefinitely
3. **Error Classification**: Categorizes errors to determine if they are retryable
4. **Enhanced Logging**: Provides detailed context for debugging
5. **Transaction Support**: Simplifies transaction management with proper error handling

## Core Functions

### executeQuery

The primary function for executing database operations with retry logic and timeout handling.

```javascript
const { executeQuery } = require('../utils/dbOperationWrapper');

// Example usage
const user = await executeQuery(
  async () => {
    return await User.findById(userId);
  },
  {
    timeout: 5000,                    // 5 second timeout
    errorMessage: 'Failed to get user',
    operationName: 'getUserById',     // For logging
    metadata: { userId },             // Additional context
    retryOptions: {
      maxRetries: 3,                  // Retry up to 3 times
      initialDelayMs: 100             // Start with 100ms delay
    }
  }
);
```

### withRetry

Lower-level function for retrying operations without timeout handling.

```javascript
const { withRetry } = require('../utils/dbOperationWrapper');

// Example usage
const result = await withRetry(
  async () => {
    return await someOperation();
  },
  {
    maxRetries: 3,
    initialDelayMs: 100,
    operationName: 'customOperation'
  }
);
```

### withTransaction

Executes operations within a MongoDB transaction with retry logic.

```javascript
const { withTransaction } = require('../utils/dbOperationWrapper');

// Example usage
const result = await withTransaction(
  async (session) => {
    // Operations within transaction
    const user = await User.create([userData], { session });
    const post = await Post.create([postData], { session });
    return { user, post };
  },
  {
    timeout: 30000,
    operationName: 'createUserAndPost'
  }
);
```

### wrapModelMethod

Creates a wrapped version of a Mongoose model method with retry and timeout.

```javascript
const { wrapModelMethod } = require('../utils/dbOperationWrapper');

// Example usage
const User = mongoose.model('User');
const findUserReliably = wrapModelMethod(User, 'findById', {
  timeout: 5000,
  retryOptions: { maxRetries: 3 }
});

// Use the wrapped method
const user = await findUserReliably(userId);
```

### checkDatabaseHealth

Checks if the database is available and responsive.

```javascript
const { checkDatabaseHealth } = require('../utils/dbOperationWrapper');

// Example usage
const healthStatus = await checkDatabaseHealth();
console.log(healthStatus);
// { status: 'healthy', responseTime: 45, ... }
```

## Configuration Options

### executeQuery Options

| Option | Type | Description |
|--------|------|-------------|
| `timeout` | number | Maximum time (ms) to wait for operation completion |
| `retryOptions` | object | Options for retry logic (see below) |
| `errorMessage` | string | Custom error message prefix |
| `operationName` | string | Name of operation for logging |
| `metadata` | object | Additional context for logging |
| `criticalOperation` | boolean | Whether this is a critical operation |

### Retry Options

| Option | Type | Description |
|--------|------|-------------|
| `maxRetries` | number | Maximum number of retry attempts |
| `initialDelayMs` | number | Initial delay before first retry |
| `maxDelayMs` | number | Maximum delay between retries |
| `shouldRetry` | function | Custom function to determine if operation should be retried |
| `onRetry` | function | Callback executed before each retry |
| `logRetries` | boolean | Whether to log retry attempts |

## Best Practices

1. **Use Descriptive Operation Names**: Always provide an `operationName` for better logging and debugging
2. **Set Appropriate Timeouts**: Use timeouts that match the expected duration of the operation
3. **Include Relevant Metadata**: Add context information in the `metadata` option
4. **Custom Retry Logic**: Use `shouldRetry` for operation-specific retry conditions
5. **Critical Operations**: Mark important operations with `criticalOperation: true`

## Error Handling

The wrapper enhances errors with additional context:

```javascript
try {
  await executeQuery(/* ... */);
} catch (error) {
  console.error(`Operation failed: ${error.message}`);
  console.error(`Operation: ${error.operationName}`);
  console.error(`Duration: ${error.duration}ms`);
  console.error(`Error type: ${error.classification.type}`);
  console.error(`Retryable: ${error.classification.retryable}`);
}
```

## Examples

See `server/examples/reliableDbOperations.js` for comprehensive examples of using the database operation wrapper.