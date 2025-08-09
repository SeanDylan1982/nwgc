/**
 * Integration tests for connection health monitoring
 * 
 * These tests verify the behavior of the health monitoring services
 * under various database conditions.
 */
const { describe, it, beforeAll, afterAll, beforeEach, afterEach, expect, vi } = require('vitest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const DatabaseService = require('../../services/DatabaseService');
const ConnectionHealthMonitor = require('../../services/ConnectionHealthMonitor');
const HealthCheckService = require('../../services/HealthCheckService');

describe('Connection Health Monitoring Integration Tests', () => {
  let mongoServer;
  let dbService;
  let healthMonitor;
  let healthCheckService;
  let mongoUri;
  
  // Start MongoDB memory server before all tests
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    mongoUri = mongoServer.getUri();
    
    // Create database service
    dbService = new DatabaseService({
      uri: mongoUri,
      minPoolSize: 2,
      maxPoolSize: 5,
      socketTimeoutMS: 2000,
      connectTimeoutMS: 2000,
      maxRetries: 3,
      initialDelayMs: 50,
      maxDelayMs: 500
    });
    
    // Connect to database
    await dbService.connect();
  });
  
  // Stop MongoDB memory server after all tests
  afterAll(async () => {
    if (healthMonitor && healthMonitor.isMonitoring) {
      healthMonitor.stopMonitoring();
    }
    
    if (healthCheckService) {
      healthCheckService.stop();
    }
    
    await dbService.disconnect();
    await mongoServer.stop();
  });
  
  // Create fresh monitors before each test
  beforeEach(() => {
    // Create connection health monitor
    healthMonitor = new ConnectionHealthMonitor(dbService, {
      checkIntervalMs: 500, // Short interval for testing
      unhealthyThreshold: 2,
      alertThreshold: 3,
      latencyThresholdMs: 500,
      criticalLatencyMs: 1000
    });
    
    // Create health check service
    healthCheckService = new HealthCheckService(dbService, {
      checkIntervalMs: 500, // Short interval for testing
      unhealthyThreshold: 2,
      alertThreshold: 3,
      metricsRetentionCount: 10
    });
  });
  
  // Stop monitors after each test
  afterEach(() => {
    if (healthMonitor && healthMonitor.isMonitoring) {
      healthMonitor.stopMonitoring();
    }
    
    if (healthCheckService) {
      healthCheckService.stop();
    }
  });
  
  describe('ConnectionHealthMonitor', () => {
    it('should detect healthy connection', async () => {
      // Set up event listener
      const healthyEvents = [];
      healthMonitor.on('healthy', (data) => {
        healthyEvents.push(data);
      });
      
      // Start monitoring
      healthMonitor.startMonitoring();
      
      // Wait for health check
      await new Promise(resolve => setTimeout(resolve, 600));
      
      // Stop monitoring
      healthMonitor.stopMonitoring();
      
      // Verify healthy event was emitted
      expect(healthyEvents.length).toBeGreaterThan(0);
      expect(healthyEvents[0].message).toContain('healthy');
      
      // Check health manually
      const healthResult = await healthMonitor.checkHealth();
      expect(healthResult.healthy).toBe(true);
    });
    
    it('should detect database unavailability', async () => {
      // Set up event listeners
      const unhealthyEvents = [];
      healthMonitor.on('unhealthy', (data) => {
        unhealthyEvents.push(data);
      });
      
      // Start monitoring
      healthMonitor.startMonitoring();
      
      // Wait for initial health check
      await new Promise(resolve => setTimeout(resolve, 600));
      
      // Stop MongoDB server to simulate database unavailability
      await mongoServer.stop();
      
      // Wait for health checks to detect unavailability
      // Need to wait for multiple checks due to unhealthyThreshold
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Stop monitoring
      healthMonitor.stopMonitoring();
      
      // Restart MongoDB server for other tests
      mongoServer = await MongoMemoryServer.create();
      dbService.uri = mongoServer.getUri();
      await dbService.connect();
      
      // Verify unhealthy event was emitted
      expect(unhealthyEvents.length).toBeGreaterThan(0);
      expect(unhealthyEvents[0].message).toContain('unhealthy');
    });
    
    it('should attempt recovery when connection is unhealthy', async () => {
      // Mock the attemptRecovery method
      const originalAttemptRecovery = healthMonitor.attemptRecovery;
      healthMonitor.attemptRecovery = vi.fn().mockImplementation(() => {
        return originalAttemptRecovery.call(healthMonitor);
      });
      
      // Set up event listener
      const unhealthyEvents = [];
      healthMonitor.on('unhealthy', (data) => {
        unhealthyEvents.push(data);
      });
      
      // Start monitoring
      healthMonitor.startMonitoring();
      
      // Wait for initial health check
      await new Promise(resolve => setTimeout(resolve, 600));
      
      // Simulate consecutive failures
      healthMonitor.consecutiveFailures = healthMonitor.unhealthyThreshold;
      
      // Manually trigger handleUnhealthyConnection
      healthMonitor.handleUnhealthyConnection({
        reason: 'test_failure'
      });
      
      // Verify attemptRecovery was called
      expect(healthMonitor.attemptRecovery).toHaveBeenCalled();
      
      // Stop monitoring
      healthMonitor.stopMonitoring();
    });
  });
  
  describe('HealthCheckService', () => {
    it('should collect and store health metrics', async () => {
      // Start health check service
      healthCheckService.start();
      
      // Wait for metrics collection
      await new Promise(resolve => setTimeout(resolve, 600));
      
      // Get metrics
      const metrics = healthCheckService.getMetrics();
      
      // Verify metrics
      expect(metrics).toBeDefined();
      expect(metrics.currentStatus).toBe('healthy');
      expect(metrics.isHealthy).toBe(true);
      expect(metrics.dbStats).toBeDefined();
      expect(metrics.monitorStats).toBeDefined();
      
      // Get detailed metrics
      const detailedMetrics = healthCheckService.getDetailedMetrics();
      
      // Verify detailed metrics
      expect(detailedMetrics).toBeDefined();
      expect(detailedMetrics.status).toBeDefined();
      expect(detailedMetrics.history).toBeDefined();
      expect(detailedMetrics.history.length).toBeGreaterThan(0);
      
      // Stop health check service
      healthCheckService.stop();
    });
    
    it('should track status changes', async () => {
      // Set up event listener
      const statusChanges = [];
      healthCheckService.on('status_change', (data) => {
        statusChanges.push(data);
      });
      
      // Start with healthy status
      healthCheckService._updateStatus('healthy');
      
      // Update to warning status
      healthCheckService._updateStatus('warning');
      
      // Update to unhealthy status
      healthCheckService._updateStatus('unhealthy');
      
      // Update back to healthy status
      healthCheckService._updateStatus('healthy');
      
      // Verify status changes were tracked
      expect(statusChanges.length).toBe(3);
      expect(statusChanges[0].from).toBe('healthy');
      expect(statusChanges[0].to).toBe('warning');
      expect(statusChanges[1].from).toBe('warning');
      expect(statusChanges[1].to).toBe('unhealthy');
      expect(statusChanges[2].from).toBe('unhealthy');
      expect(statusChanges[2].to).toBe('healthy');
      
      // Verify status history was stored
      expect(healthCheckService.metrics.status.statusHistory.length).toBe(3);
    });
    
    it('should store alerts', async () => {
      // Store some test alerts
      healthCheckService._storeAlert({
        level: 'warning',
        message: 'Test warning',
        data: { test: true }
      });
      
      healthCheckService._storeAlert({
        level: 'critical',
        message: 'Test critical alert',
        data: { critical: true }
      });
      
      // Get alerts
      const alerts = healthCheckService.getAlerts();
      
      // Verify alerts were stored
      expect(alerts.length).toBe(2);
      expect(alerts[0].level).toBe('warning');
      expect(alerts[0].message).toBe('Test warning');
      expect(alerts[1].level).toBe('critical');
      expect(alerts[1].message).toBe('Test critical alert');
    });
  });
  
  describe('Integration between services', () => {
    it('should propagate events from monitor to health check service', async () => {
      // Set up event listeners
      const healthyEvents = [];
      const warningEvents = [];
      const unhealthyEvents = [];
      
      healthCheckService.on('healthy', (data) => {
        healthyEvents.push(data);
      });
      
      healthCheckService.on('warning', (data) => {
        warningEvents.push(data);
      });
      
      healthCheckService.on('unhealthy', (data) => {
        unhealthyEvents.push(data);
      });
      
      // Start health check service
      healthCheckService.start();
      
      // Wait for initial health check
      await new Promise(resolve => setTimeout(resolve, 600));
      
      // Manually trigger events on the monitor
      healthCheckService.monitor.emit('healthy', {
        message: 'Test healthy event',
        metrics: {}
      });
      
      healthCheckService.monitor.emit('warning', {
        message: 'Test warning event',
        metrics: {}
      });
      
      healthCheckService.monitor.emit('unhealthy', {
        message: 'Test unhealthy event',
        metrics: {}
      });
      
      // Verify events were propagated
      expect(healthyEvents.length).toBeGreaterThan(0);
      expect(warningEvents.length).toBeGreaterThan(0);
      expect(unhealthyEvents.length).toBeGreaterThan(0);
      
      // Stop health check service
      healthCheckService.stop();
    });
  });
});