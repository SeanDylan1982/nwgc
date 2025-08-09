/**
 * Health Check Service Tests
 */
const { describe, it, beforeEach, afterEach, expect, vi } = require('vitest');
const DatabaseService = require('../services/DatabaseService');
const HealthCheckService = require('../services/HealthCheckService');
const ConnectionHealthMonitor = require('../services/ConnectionHealthMonitor');

// Mock the DatabaseService
vi.mock('../services/DatabaseService', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      connect: vi.fn().mockResolvedValue(true),
      disconnect: vi.fn().mockResolvedValue(true),
      executeWithRetry: vi.fn(),
      getConnectionStats: vi.fn().mockReturnValue({
        isConnected: true,
        readyState: 1,
        operations: 100,
        failures: 5,
        reconnects: 2,
        avgConnectionLatency: 50,
        avgQueryLatency: 100
      }),
      on: vi.fn(),
      emit: vi.fn()
    }))
  };
});

// Mock the ConnectionHealthMonitor
vi.mock('../services/ConnectionHealthMonitor', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      startMonitoring: vi.fn().mockReturnThis(),
      stopMonitoring: vi.fn().mockReturnThis(),
      checkHealth: vi.fn().mockResolvedValue({ healthy: true }),
      getMetrics: vi.fn().mockReturnValue({
        isMonitoring: true,
        consecutiveFailures: 0,
        checks: 10,
        failures: 1,
        warnings: 2,
        recoveries: 1
      }),
      on: vi.fn(),
      emit: vi.fn()
    }))
  };
});

describe('HealthCheckService', () => {
  let dbService;
  let healthCheckService;
  
  beforeEach(() => {
    // Create a mock DatabaseService
    dbService = {
      connect: vi.fn().mockResolvedValue(true),
      disconnect: vi.fn().mockResolvedValue(true),
      executeWithRetry: vi.fn(),
      getConnectionStats: vi.fn().mockReturnValue({
        isConnected: true,
        readyState: 1,
        operations: 100,
        failures: 5,
        reconnects: 2,
        avgConnectionLatency: 50,
        avgQueryLatency: 100
      }),
      on: vi.fn(),
      emit: vi.fn()
    };
    
    // Create the HealthCheckService
    healthCheckService = new HealthCheckService(dbService, {
      checkIntervalMs: 1000,
      unhealthyThreshold: 3,
      alertThreshold: 5
    });
    
    // Mock the monitor
    healthCheckService.monitor = {
      startMonitoring: vi.fn().mockReturnThis(),
      stopMonitoring: vi.fn().mockReturnThis(),
      checkHealth: vi.fn().mockResolvedValue({ healthy: true }),
      getMetrics: vi.fn().mockReturnValue({
        isMonitoring: true,
        consecutiveFailures: 0,
        checks: 10,
        failures: 1,
        warnings: 2,
        recoveries: 1
      }),
      on: vi.fn()
    };
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  it('should create a HealthCheckService instance', () => {
    expect(healthCheckService).toBeDefined();
    expect(healthCheckService.dbService).toBe(dbService);
    expect(healthCheckService.config.checkIntervalMs).toBe(1000);
    expect(healthCheckService.config.unhealthyThreshold).toBe(3);
    expect(healthCheckService.config.alertThreshold).toBe(5);
  });
  
  it('should start monitoring', () => {
    healthCheckService.start();
    expect(healthCheckService.monitor.startMonitoring).toHaveBeenCalled();
  });
  
  it('should stop monitoring', () => {
    healthCheckService.stop();
    expect(healthCheckService.monitor.stopMonitoring).toHaveBeenCalled();
  });
  
  it('should check health', async () => {
    const result = await healthCheckService.checkHealth();
    expect(result).toEqual({ healthy: true });
    expect(healthCheckService.monitor.checkHealth).toHaveBeenCalled();
  });
  
  it('should get metrics', () => {
    const metrics = healthCheckService.getMetrics();
    expect(metrics).toBeDefined();
    expect(metrics.currentStatus).toBe('healthy');
    expect(metrics.isHealthy).toBe(true);
    expect(metrics.dbStats).toBeDefined();
    expect(metrics.monitorStats).toBeDefined();
  });
  
  it('should get detailed metrics', () => {
    const metrics = healthCheckService.getDetailedMetrics();
    expect(metrics).toBeDefined();
    expect(metrics.status).toBeDefined();
    expect(metrics.history).toBeDefined();
    expect(metrics.alerts).toBeDefined();
    expect(metrics.dbStats).toBeDefined();
    expect(metrics.monitorStats).toBeDefined();
  });
  
  it('should get alerts', () => {
    const alerts = healthCheckService.getAlerts();
    expect(alerts).toBeDefined();
    expect(Array.isArray(alerts)).toBe(true);
  });
  
  it('should update status when events are emitted', () => {
    // Mock the _updateStatus method
    healthCheckService._updateStatus = vi.fn();
    
    // Get the event handler for 'healthy' event
    const healthyHandler = healthCheckService.monitor.on.mock.calls.find(call => call[0] === 'healthy')[1];
    
    // Trigger the event
    healthyHandler({ message: 'Healthy connection' });
    
    // Check if _updateStatus was called with 'healthy'
    expect(healthCheckService._updateStatus).toHaveBeenCalledWith('healthy');
  });
});