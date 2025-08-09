# Database Recovery Mechanisms Documentation

## Overview

This document describes the automatic recovery mechanisms implemented for MongoDB connections in the Neighborhood Watch application. These mechanisms help ensure database reliability and graceful degradation during outages.

## Components

### 1. CircuitBreaker

The Circuit Breaker pattern prevents cascading failures by failing fast when a service is unavailable. It has three states:

- **CLOSED**: Normal operation, requests pass through
- **OPEN**: Failure threshold exceeded, requests fail fast
- **HALF_OPEN**: Testing if service has recovered

```javascript
const CircuitBreaker = require('../utils/CircuitBreaker');

// Create a circuit breaker
const breaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeout: 30000,
  halfOpenSuccessThreshold: 2,
  fallbackFunction: (arg1, arg2) => {
    // Fallback logic when circuit is open
    return 'fallback result';
  }
});

// Execute a function with circuit breaker protection
try {
  const result = await breaker.execute(async () => {
    // Database operation
    return await db.collection('users').findOne({ _id: userId });
  });
} catch (error) {
  // Handle error or circuit open state
}
```

### 2. DatabaseRecoveryManager

The DatabaseRecoveryManager coordinates recovery strategies and graceful degradation during database outages.

```javascript
const recoveryManager = new DatabaseRecoveryManager(dbService, healthCheckService, {
  circuitBreakerFailureThreshold: 5,
  circuitBreakerResetTimeout: 30000,
  maxRecoveryAttempts: 3,
  recoveryBackoffMs: 5000
});

// Execute a database operation with circuit breaker protection
const result = await recoveryManager.executeOperation('read', async () => {
  return await db.collection('users').findOne({ _id: userId });
}, true, [userId]);

// Attempt manual recovery
const recoverySuccessful = await recoveryManager.attemptRecovery();

// Reset circuit breakers
recoveryManager.resetCircuitBreakers();
```

## Recovery Strategies

### 1. Connection Reset

When a connection is detected as unhealthy, the system will:

1. Disconnect from the database
2. Wait for a backoff period
3. Attempt to reconnect
4. Reset circuit breakers if successful

### 2. Circuit Breaker Pattern

The circuit breaker pattern is implemented for three types of operations:

- **Read Operations**: Queries that retrieve data
- **Write Operations**: Commands that modify data
- **Query Operations**: Other database operations

When a circuit is open:

1. Requests fail fast without hitting the database
2. Fallback mechanisms are used when available
3. After a timeout period, the circuit transitions to half-open
4. A test request is allowed through to check if the service has recovered

### 3. Graceful Degradation

During database outages, the system can:

1. **Cache Results**: Read operations can return cached data
2. **Queue Write Operations**: Write operations can be queued for later execution
3. **Provide Fallbacks**: Critical operations can have fallback implementations

## API Endpoints

### GET /api/health/recovery

Get the current recovery status.

**Response:**
```json
{
  "timestamp": "2023-07-22T12:34:56.789Z",
  "circuitBreakers": {
    "read": "CLOSED",
    "write": "CLOSED",
    "query": "CLOSED"
  },
  "recovery": {
    "isRecovering": false,
    "lastRecoveryAttempt": "2023-07-22T12:30:00.000Z",
    "recoveryAttempts": 1,
    "successfulRecoveries": 1,
    "failedRecoveries": 0
  },
  "cacheSize": 10,
  "options": {
    "circuitBreakerFailureThreshold": 5,
    "circuitBreakerResetTimeout": 30000,
    "maxRecoveryAttempts": 3,
    "recoveryBackoffMs": 5000,
    "enableCircuitBreaker": true,
    "enableGracefulDegradation": true
  }
}
```

### POST /api/health/recovery

Trigger a manual recovery attempt.

**Response:**
```json
{
  "timestamp": "2023-07-22T12:34:56.789Z",
  "success": true,
  "message": "Recovery successful",
  "recoveryState": {
    "isRecovering": false,
    "lastRecoveryAttempt": "2023-07-22T12:34:56.789Z",
    "recoveryAttempts": 2,
    "successfulRecoveries": 2,
    "failedRecoveries": 0
  }
}
```

### POST /api/health/circuit-breakers/reset

Reset all circuit breakers to CLOSED state.

**Response:**
```json
{
  "timestamp": "2023-07-22T12:34:56.789Z",
  "message": "Circuit breakers reset successfully",
  "circuitBreakers": {
    "read": "CLOSED",
    "write": "CLOSED",
    "query": "CLOSED"
  }
}
```

## Configuration Options

| Option | Description | Default |
|--------|-------------|---------|
| `circuitBreakerFailureThreshold` | Number of failures before opening circuit | 5 |
| `circuitBreakerResetTimeout` | Time in ms before attempting reset (half-open) | 30000 |
| `maxRecoveryAttempts` | Maximum number of automatic recovery attempts | 3 |
| `recoveryBackoffMs` | Base backoff time in ms between recovery attempts | 5000 |
| `enableCircuitBreaker` | Whether to enable circuit breaker protection | true |
| `enableGracefulDegradation` | Whether to enable graceful degradation strategies | true |

## Environment Variables

The following environment variables can be used to configure the recovery mechanisms:

```
CIRCUIT_BREAKER_FAILURE_THRESHOLD=5
CIRCUIT_BREAKER_RESET_TIMEOUT=30000
MAX_RECOVERY_ATTEMPTS=3
RECOVERY_BACKOFF_MS=5000
ENABLE_CIRCUIT_BREAKER=true
ENABLE_GRACEFUL_DEGRADATION=true
```

## Integration with Application Code

To use the recovery mechanisms in your application code:

```javascript
const { dbService } = require('../config/database');
const recoveryManager = require('../services/recoveryManager');

// Execute a database operation with circuit breaker protection
async function getUserById(userId) {
  return await recoveryManager.executeOperation('read', async () => {
    return await dbService.executeWithRetry(() => {
      return db.collection('users').findOne({ _id: userId });
    });
  }, true, [userId]);
}

// Listen for recovery events
recoveryManager.on('recovery_successful', (data) => {
  console.log('Database recovered successfully:', data);
});

recoveryManager.on('circuit_state_change', (data) => {
  console.log(`Circuit breaker for ${data.operation} changed from ${data.from} to ${data.to}`);
});
```