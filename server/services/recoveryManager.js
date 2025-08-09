/**
 * Recovery Manager Singleton
 * 
 * This file exports a singleton instance of the DatabaseRecoveryManager
 * to be used throughout the application.
 */
const { dbService } = require('../config/database');
const HealthCheckService = require('./HealthCheckService');
const DatabaseRecoveryManager = require('./DatabaseRecoveryManager');
require('dotenv').config();

// Create health check service if not already created
let healthCheckService;
try {
  // Try to get the health check service from the health routes
  healthCheckService = require('../routes/health').healthCheckService;
} catch (error) {
  // Create a new health check service if not available
  healthCheckService = new HealthCheckService(dbService, {
    checkIntervalMs: parseInt(process.env.HEALTH_CHECK_INTERVAL_MS || '30000'),
    unhealthyThreshold: parseInt(process.env.HEALTH_UNHEALTHY_THRESHOLD || '3'),
    alertThreshold: parseInt(process.env.HEALTH_ALERT_THRESHOLD || '5'),
    latencyThresholdMs: parseInt(process.env.HEALTH_LATENCY_THRESHOLD_MS || '500'),
    criticalLatencyMs: parseInt(process.env.HEALTH_CRITICAL_LATENCY_MS || '2000'),
    maxErrorRate: parseFloat(process.env.HEALTH_MAX_ERROR_RATE || '0.1'),
    enableAlerts: process.env.HEALTH_ENABLE_ALERTS !== 'false'
  });
  
  // Start the health check service
  healthCheckService.start();
}

// Create recovery manager
const recoveryManager = new DatabaseRecoveryManager(dbService, healthCheckService, {
  circuitBreakerFailureThreshold: parseInt(process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD || '5'),
  circuitBreakerResetTimeout: parseInt(process.env.CIRCUIT_BREAKER_RESET_TIMEOUT || '30000'),
  maxRecoveryAttempts: parseInt(process.env.MAX_RECOVERY_ATTEMPTS || '3'),
  recoveryBackoffMs: parseInt(process.env.RECOVERY_BACKOFF_MS || '5000'),
  enableCircuitBreaker: process.env.ENABLE_CIRCUIT_BREAKER !== 'false',
  enableGracefulDegradation: process.env.ENABLE_GRACEFUL_DEGRADATION !== 'false'
});

// Export the recovery manager
module.exports = recoveryManager;