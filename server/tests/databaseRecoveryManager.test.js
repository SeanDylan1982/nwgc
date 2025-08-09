/**
 * Database Recovery Manager Tests
 */
const { describe, it, beforeEach, afterEach, expect, vi } = require('vitest');
const DatabaseRecoveryManager = require('../services/DatabaseRecoveryManager');
const CircuitBreaker = require('../utils/CircuitBreaker');

// Mock CircuitBreaker
vi.mock('../utils/CircuitBreaker', () => {
  const mockCircuitBreaker = vi.fn().mockImplementation(() => ({
    execute: vi.fn(),
    reset: vi.fn(),
    getState: vi.fn().mockReturnValue('CLOSED'),
    getMetrics: vi.fn().mockReturnValue({}),
    on: vi.fn()
  }));
  
  mockCircuitBreaker.STATES = {
    CLOSED: 'CLOSED',
    OPEN: 'OPEN',
    HALF_OPEN: 'HALF_OPEN'
  };
  
  return mockCircuitBreaker;
});

describe('DatabaseRecoveryManager', () => {
  let dbService;
  let healthCheckService;
  let recoveryManager;
  
  beforeEach(() => {
    // Create mock services
    dbService = {
      connect: vi.fn().mockResolvedValue(true),
      disconnect: vi.fn().mockResolvedValue(true),
      on: vi.fn(),
      emit: vi.fn()
    };
    
    healthCheckService = {
      on: vi.fn(),
      emit: vi.fn()
    };
    
    // Create recovery manager
    recoveryManager = new DatabaseRecoveryManager(dbService, healthCheckService, {
      circuitBreakerFailureThreshold: 3,
      circuitBreakerResetTimeout: 1000,
      maxRecoveryAttempts: 3,
      recoveryBackoffMs: 100
    });
    
    // Mock emit method
    recoveryManager.emit = vi.fn();
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  it('should create a DatabaseRecoveryManager instance', () => {
    expect(recoveryManager).toBeDefined();
    expect(recoveryManager.dbService).toBe(dbService);
    expect(recoveryManager.healthCheckService).toBe(healthCheckService);
    expect(recoveryManager.options.circuitBreakerFailureThreshold).toBe(3);
    expect(recoveryManager.options.maxRecoveryAttempts).toBe(3);
    expect(recoveryManager.circuitBreakers.read).toBeDefined();
    expect(recoveryManager.circuitBreakers.write).toBeDefined();
    expect(recoveryManager.circuitBreakers.query).toBeDefined();
  });
  
  it('should execute operation with circuit breaker', async () => {
    const operation = vi.fn().mockResolvedValue('result');
    const executeMethod = vi.fn().mockResolvedValue('result');
    
    // Mock circuit breaker execute method
    recoveryManager.circuitBreakers.read.execute = executeMethod;
    
    const result = await recoveryManager.executeOperation('read', operation, true, ['arg1']);
    
    expect(executeMethod).toHaveBeenCalledWith(operation, 'arg1');
    expect(result).toBe('result');
  });
  
  it('should skip circuit breaker if disabled', async () => {
    // Create recovery manager with circuit breaker disabled
    const recoveryManagerNoCB = new DatabaseRecoveryManager(dbService, healthCheckService, {
      enableCircuitBreaker: false
    });
    
    const operation = vi.fn().mockResolvedValue('direct result');
    const result = await recoveryManagerNoCB.executeOperation('read', operation);
    
    expect(operation).toHaveBeenCalled();
    expect(result).toBe('direct result');
  });
  
  it('should reset all circuit breakers', () => {
    recoveryManager.resetCircuitBreakers();
    
    expect(recoveryManager.circuitBreakers.read.reset).toHaveBeenCalled();
    expect(recoveryManager.circuitBreakers.write.reset).toHaveBeenCalled();
    expect(recoveryManager.circuitBreakers.query.reset).toHaveBeenCalled();
  });
  
  it('should attempt recovery', async () => {
    // Mock setTimeout
    vi.spyOn(global, 'setTimeout').mockImplementation((fn) => {
      fn();
      return 123;
    });
    
    const result = await recoveryManager.attemptRecovery();
    
    expect(dbService.disconnect).toHaveBeenCalled();
    expect(dbService.connect).toHaveBeenCalled();
    expect(recoveryManager.emit).toHaveBeenCalledWith('recovery_started', expect.any(Object));
    expect(recoveryManager.emit).toHaveBeenCalledWith('recovery_successful', expect.any(Object));
    expect(result).toBe(true);
    expect(recoveryManager.recoveryState.recoveryAttempts).toBe(1);
    expect(recoveryManager.recoveryState.successfulRecoveries).toBe(1);
    expect(recoveryManager.recoveryState.isRecovering).toBe(false);
  });
  
  it('should handle failed recovery attempt', async () => {
    // Mock setTimeout
    vi.spyOn(global, 'setTimeout').mockImplementation((fn) => {
      fn();
      return 123;
    });
    
    // Mock connect to throw error
    dbService.connect.mockRejectedValue(new Error('Connection failed'));
    
    const result = await recoveryManager.attemptRecovery();
    
    expect(dbService.disconnect).toHaveBeenCalled();
    expect(dbService.connect).toHaveBeenCalled();
    expect(recoveryManager.emit).toHaveBeenCalledWith('recovery_started', expect.any(Object));
    expect(recoveryManager.emit).toHaveBeenCalledWith('recovery_failed', expect.any(Object));
    expect(result).toBe(false);
    expect(recoveryManager.recoveryState.recoveryAttempts).toBe(1);
    expect(recoveryManager.recoveryState.failedRecoveries).toBe(1);
    expect(recoveryManager.recoveryState.isRecovering).toBe(false);
  });
  
  it('should not attempt recovery if already recovering', async () => {
    // Set isRecovering to true
    recoveryManager.recoveryState.isRecovering = true;
    
    const result = await recoveryManager.attemptRecovery();
    
    expect(dbService.disconnect).not.toHaveBeenCalled();
    expect(dbService.connect).not.toHaveBeenCalled();
    expect(result).toBe(false);
  });
  
  it('should not attempt recovery if max attempts exceeded', async () => {
    // Set recoveryAttempts to max
    recoveryManager.recoveryState.recoveryAttempts = 3;
    
    const result = await recoveryManager.attemptRecovery();
    
    expect(dbService.disconnect).not.toHaveBeenCalled();
    expect(dbService.connect).not.toHaveBeenCalled();
    expect(recoveryManager.emit).toHaveBeenCalledWith('max_recovery_attempts_exceeded', expect.any(Object));
    expect(result).toBe(false);
  });
  
  it('should clear cache', () => {
    // Add some items to cache
    recoveryManager.cache.set('key1', { data: 'value1', timestamp: Date.now() });
    recoveryManager.cache.set('key2', { data: 'value2', timestamp: Date.now() });
    
    expect(recoveryManager.cache.size).toBe(2);
    
    recoveryManager.clearCache();
    
    expect(recoveryManager.cache.size).toBe(0);
  });
  
  it('should get status', () => {
    const status = recoveryManager.getStatus();
    
    expect(status).toBeDefined();
    expect(status.circuitBreakers).toBeDefined();
    expect(status.recovery).toBeDefined();
    expect(status.cacheSize).toBe(0);
    expect(status.options).toBeDefined();
  });
  
  it('should get detailed metrics', () => {
    const metrics = recoveryManager.getDetailedMetrics();
    
    expect(metrics).toBeDefined();
    expect(metrics.circuitBreakers).toBeDefined();
    expect(metrics.recovery).toBeDefined();
    expect(metrics.cacheSize).toBe(0);
    expect(metrics.options).toBeDefined();
  });
});