/**
 * Database Recovery Example
 * 
 * This example demonstrates how to use the database recovery mechanisms
 * in your application code.
 */
const { dbService } = require('../config/database');
const HealthCheckService = require('../services/HealthCheckService');
const DatabaseRecoveryManager = require('../services/DatabaseRecoveryManager');

// Create health check service
const healthCheckService = new HealthCheckService(dbService, {
  checkIntervalMs: 30000,
  unhealthyThreshold: 3,
  alertThreshold: 5
});

// Create recovery manager
const recoveryManager = new DatabaseRecoveryManager(dbService, healthCheckService, {
  circuitBreakerFailureThreshold: 5,
  circuitBreakerResetTimeout: 30000,
  maxRecoveryAttempts: 3,
  recoveryBackoffMs: 5000
});

// Start health check service
healthCheckService.start();

// Example: Execute a read operation with circuit breaker protection
async function getUserById(userId) {
  return await recoveryManager.executeOperation('read', async () => {
    return await dbService.executeWithRetry(() => {
      return db.collection('users').findOne({ _id: userId });
    });
  }, true, [userId]);
}

// Example: Execute a write operation with circuit breaker protection
async function createUser(userData) {
  return await recoveryManager.executeOperation('write', async () => {
    return await dbService.executeWithRetry(() => {
      return db.collection('users').insertOne(userData);
    });
  });
}

// Example: Execute a query operation with circuit breaker protection
async function countUsers(filter) {
  return await recoveryManager.executeOperation('query', async () => {
    return await dbService.executeWithRetry(() => {
      return db.collection('users').countDocuments(filter);
    });
  });
}

// Example: Listen for recovery events
recoveryManager.on('recovery_started', (data) => {
  console.log(`Recovery attempt ${data.attempt} started at ${new Date(data.timestamp).toISOString()}`);
});

recoveryManager.on('recovery_successful', (data) => {
  console.log(`Recovery successful at ${new Date(data.timestamp).toISOString()}`);
});

recoveryManager.on('recovery_failed', (data) => {
  console.error(`Recovery attempt ${data.attempt} failed at ${new Date(data.timestamp).toISOString()}`);
  console.error('Error:', data.error);
});

recoveryManager.on('circuit_state_change', (data) => {
  console.log(`Circuit breaker for ${data.operation} changed from ${data.from} to ${data.to} at ${new Date(data.timestamp).toISOString()}`);
});

// Example: Manual recovery
async function triggerManualRecovery() {
  console.log('Triggering manual recovery...');
  const result = await recoveryManager.attemptRecovery();
  console.log('Recovery result:', result ? 'Successful' : 'Failed or skipped');
  return result;
}

// Example: Reset circuit breakers
function resetCircuitBreakers() {
  console.log('Resetting circuit breakers...');
  recoveryManager.resetCircuitBreakers();
  console.log('Circuit breakers reset');
}

// Example: Get recovery status
function getRecoveryStatus() {
  const status = recoveryManager.getStatus();
  console.log('Recovery status:', status);
  return status;
}

// Export functions for use in other files
module.exports = {
  getUserById,
  createUser,
  countUsers,
  triggerManualRecovery,
  resetCircuitBreakers,
  getRecoveryStatus,
  recoveryManager,
  healthCheckService
};