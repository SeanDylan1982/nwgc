/**
 * Connection Health Monitor Tests
 */
const { describe, it, beforeEach, afterEach, expect, vi } = require('vitest');
const ConnectionHealthMonitor = require('../services/ConnectionHealthMonitor');

describe('ConnectionHealthMonitor', () => {
  let dbService;
  let monitor;
  
  beforeEach(() => {
    // Create a mock DatabaseService
    dbService = {
      getConnectionStats: vi.fn().mockReturnValue({
        isConnected: true,
        readyState: 1,
        operations: 100,
        failures: 5,
        reconnects: 2,
        avgConnectionLatency: 50,
        avgQueryLatency: 100
      }),
      disconnect: vi.fn().mockResolvedValue(true),
      connect: vi.fn().mockResolvedValue(true),
      on: vi.fn(),
      emit: vi.fn()
    };
    
    // Create the ConnectionHealthMonitor
    monitor = new ConnectionHealthMonitor(dbService, {
      checkIntervalMs: 1000,
      unhealthyThreshold: 3,
      alertThreshold: 5,
      latencyThresholdMs: 500,
      criticalLatencyMs: 2000,
      maxErrorRate: 0.1
    });
    
    // Mock setInterval and clearInterval
    vi.spyOn(global, 'setInterval').mockImplementation(() => 123);
    vi.spyOn(global, 'clearInterval').mockImplementation(() => {});
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  it('should create a ConnectionHealthMonitor instance', () => {
    expect(monitor).toBeDefined();
    expect(monitor.dbService).toBe(dbService);
    expect(monitor.checkIntervalMs).toBe(1000);
    expect(monitor.unhealthyThreshold).toBe(3);
    expect(monitor.alertThreshold).toBe(5);
    expect(monitor.latencyThresholdMs).toBe(500);
    expect(monitor.criticalLatencyMs).toBe(2000);
    expect(monitor.maxErrorRate).toBe(0.1);
  });
  
  it('should start monitoring', () => {
    monitor.startMonitoring();
    expect(global.setInterval).toHaveBeenCalled();
    expect(monitor.isMonitoring).toBe(true);
    expect(monitor.interval).toBe(123);
  });
  
  it('should stop monitoring', () => {
    monitor.interval = 123;
    monitor.isMonitoring = true;
    
    monitor.stopMonitoring();
    expect(global.clearInterval).toHaveBeenCalledWith(123);
    expect(monitor.isMonitoring).toBe(false);
    expect(monitor.interval).toBe(null);
  });
  
  it('should check health and return healthy status', async () => {
    const result = await monitor.checkHealth();
    expect(result).toBeDefined();
    expect(result.healthy).toBe(true);
    expect(monitor.metrics.checks).toBe(1);
    expect(monitor.metrics.lastCheckTime).toBeDefined();
  });
  
  it('should handle unhealthy connection', () => {
    // Mock emit method
    monitor.emit = vi.fn();
    
    // Mock dbService.getConnectionStats to return unhealthy state
    dbService.getConnectionStats.mockReturnValue({
      isConnected: false,
      readyState: 0,
      operations: 100,
      failures: 20,
      reconnects: 5
    });
    
    // Set consecutive failures to trigger alert
    monitor.consecutiveFailures = monitor.alertThreshold;
    
    // Call handleUnhealthyConnection
    monitor.handleUnhealthyConnection({ reason: 'connection_lost' });
    
    // Check if emit was called with 'unhealthy' and 'alert'
    expect(monitor.emit).toHaveBeenCalledWith('unhealthy', expect.objectContaining({
      message: expect.stringContaining('Database connection unhealthy')
    }));
    
    expect(monitor.emit).toHaveBeenCalledWith('alert', expect.objectContaining({
      level: 'critical',
      message: expect.stringContaining('Database connection critical')
    }));
    
    expect(monitor.metrics.failures).toBe(1);
    expect(monitor.metrics.lastFailureTime).toBeDefined();
  });
  
  it('should attempt recovery', async () => {
    // Mock emit method
    monitor.emit = vi.fn();
    
    // Call attemptRecovery
    const result = await monitor.attemptRecovery();
    
    // Check if disconnect and connect were called
    expect(dbService.disconnect).toHaveBeenCalled();
    expect(dbService.connect).toHaveBeenCalled();
    
    // Check if emit was called with 'recovery'
    expect(monitor.emit).toHaveBeenCalledWith('recovery', expect.objectContaining({
      message: expect.stringContaining('Database connection recovered')
    }));
    
    expect(result).toBe(true);
    expect(monitor.consecutiveFailures).toBe(0);
    expect(monitor.metrics.recoveries).toBe(1);
    expect(monitor.metrics.lastRecoveryTime).toBeDefined();
  });
  
  it('should handle failed recovery attempt', async () => {
    // Mock emit method
    monitor.emit = vi.fn();
    
    // Mock connect to throw an error
    dbService.connect.mockRejectedValue(new Error('Connection failed'));
    
    // Call attemptRecovery
    const result = await monitor.attemptRecovery();
    
    // Check if disconnect and connect were called
    expect(dbService.disconnect).toHaveBeenCalled();
    expect(dbService.connect).toHaveBeenCalled();
    
    // Check if emit was called with 'recovery_failed'
    expect(monitor.emit).toHaveBeenCalledWith('recovery_failed', expect.objectContaining({
      message: expect.stringContaining('Failed to recover')
    }));
    
    expect(result).toBe(false);
  });
  
  it('should get metrics', () => {
    const metrics = monitor.getMetrics();
    expect(metrics).toBeDefined();
    expect(metrics.isMonitoring).toBe(false);
    expect(metrics.consecutiveFailures).toBe(0);
    expect(metrics.checks).toBe(0);
    expect(metrics.failures).toBe(0);
    expect(metrics.warnings).toBe(0);
    expect(metrics.recoveries).toBe(0);
    expect(metrics.dbServiceStats).toBeDefined();
  });
});