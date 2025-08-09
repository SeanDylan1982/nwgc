/**
 * Circuit Breaker Tests
 */
const { describe, it, beforeEach, afterEach, expect, vi } = require('vitest');
const CircuitBreaker = require('../utils/CircuitBreaker');
const { STATES } = CircuitBreaker;

describe('CircuitBreaker', () => {
  let circuitBreaker;
  
  beforeEach(() => {
    // Create a new circuit breaker for each test
    circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 1000,
      halfOpenSuccessThreshold: 2
    });
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  it('should create a CircuitBreaker instance with default state CLOSED', () => {
    expect(circuitBreaker).toBeDefined();
    expect(circuitBreaker.getState()).toBe(STATES.CLOSED);
    expect(circuitBreaker.failureThreshold).toBe(3);
    expect(circuitBreaker.resetTimeout).toBe(1000);
    expect(circuitBreaker.halfOpenSuccessThreshold).toBe(2);
  });
  
  it('should execute function successfully in CLOSED state', async () => {
    const mockFn = vi.fn().mockResolvedValue('success');
    const result = await circuitBreaker.execute(mockFn, 'arg1', 'arg2');
    
    expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
    expect(result).toBe('success');
    expect(circuitBreaker.getState()).toBe(STATES.CLOSED);
    expect(circuitBreaker.failureCount).toBe(0);
    expect(circuitBreaker.metrics.successfulCalls).toBe(1);
    expect(circuitBreaker.metrics.failedCalls).toBe(0);
  });
  
  it('should transition to OPEN state after failure threshold is reached', async () => {
    const mockFn = vi.fn().mockRejectedValue(new Error('test error'));
    
    // Mock state change event
    const stateChangeSpy = vi.fn();
    circuitBreaker.on('state_change', stateChangeSpy);
    
    // Execute and fail 3 times (threshold)
    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(mockFn);
      } catch (error) {
        expect(error.message).toBe('test error');
      }
    }
    
    expect(mockFn).toHaveBeenCalledTimes(3);
    expect(circuitBreaker.getState()).toBe(STATES.OPEN);
    expect(circuitBreaker.failureCount).toBe(3);
    expect(circuitBreaker.metrics.successfulCalls).toBe(0);
    expect(circuitBreaker.metrics.failedCalls).toBe(3);
    expect(stateChangeSpy).toHaveBeenCalledWith(expect.objectContaining({
      from: STATES.CLOSED,
      to: STATES.OPEN
    }));
  });
  
  it('should reject requests immediately when in OPEN state', async () => {
    // Force circuit to OPEN state
    circuitBreaker.forceState(STATES.OPEN);
    
    const mockFn = vi.fn().mockResolvedValue('success');
    
    try {
      await circuitBreaker.execute(mockFn);
      // Should not reach here
      expect(false).toBe(true);
    } catch (error) {
      expect(error.message).toContain('Circuit breaker is open');
    }
    
    expect(mockFn).not.toHaveBeenCalled();
    expect(circuitBreaker.metrics.rejectedCalls).toBe(1);
  });
  
  it('should use fallback function when provided and circuit is OPEN', async () => {
    const fallbackFn = vi.fn().mockReturnValue('fallback result');
    const mockFn = vi.fn().mockRejectedValue(new Error('test error'));
    
    // Create circuit breaker with fallback
    const cbWithFallback = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 1000,
      fallbackFunction: fallbackFn
    });
    
    // Force to OPEN state
    cbWithFallback.forceState(STATES.OPEN);
    
    const result = await cbWithFallback.execute(mockFn, 'arg1', 'arg2');
    
    expect(mockFn).not.toHaveBeenCalled();
    expect(fallbackFn).toHaveBeenCalledWith('arg1', 'arg2');
    expect(result).toBe('fallback result');
  });
  
  it('should transition to HALF_OPEN state after resetTimeout', async () => {
    // Force circuit to OPEN state
    circuitBreaker.forceState(STATES.OPEN);
    
    // Set nextAttempt to now
    circuitBreaker.nextAttempt = Date.now();
    
    const mockFn = vi.fn().mockResolvedValue('success');
    
    // Execute should transition to HALF_OPEN and try the function
    const result = await circuitBreaker.execute(mockFn);
    
    expect(mockFn).toHaveBeenCalled();
    expect(result).toBe('success');
    expect(circuitBreaker.getState()).toBe(STATES.HALF_OPEN);
    expect(circuitBreaker.successCount).toBe(1);
  });
  
  it('should transition from HALF_OPEN to CLOSED after success threshold', async () => {
    // Force circuit to HALF_OPEN state
    circuitBreaker.forceState(STATES.HALF_OPEN);
    
    const mockFn = vi.fn().mockResolvedValue('success');
    
    // First success
    await circuitBreaker.execute(mockFn);
    expect(circuitBreaker.getState()).toBe(STATES.HALF_OPEN);
    expect(circuitBreaker.successCount).toBe(1);
    
    // Second success should close the circuit
    await circuitBreaker.execute(mockFn);
    expect(circuitBreaker.getState()).toBe(STATES.CLOSED);
    expect(circuitBreaker.successCount).toBe(0); // Reset on state change
    expect(circuitBreaker.failureCount).toBe(0);
  });
  
  it('should transition from HALF_OPEN to OPEN on failure', async () => {
    // Force circuit to HALF_OPEN state
    circuitBreaker.forceState(STATES.HALF_OPEN);
    
    const mockFn = vi.fn().mockRejectedValue(new Error('test error'));
    
    try {
      await circuitBreaker.execute(mockFn);
      // Should not reach here
      expect(false).toBe(true);
    } catch (error) {
      expect(error.message).toBe('test error');
    }
    
    expect(circuitBreaker.getState()).toBe(STATES.OPEN);
  });
  
  it('should reset the circuit breaker', () => {
    // Force circuit to OPEN state
    circuitBreaker.forceState(STATES.OPEN);
    circuitBreaker.failureCount = 10;
    
    // Reset
    circuitBreaker.reset();
    
    expect(circuitBreaker.getState()).toBe(STATES.CLOSED);
    expect(circuitBreaker.failureCount).toBe(0);
    expect(circuitBreaker.successCount).toBe(0);
  });
  
  it('should provide metrics', () => {
    const metrics = circuitBreaker.getMetrics();
    
    expect(metrics).toBeDefined();
    expect(metrics.state).toBe(STATES.CLOSED);
    expect(metrics.failureCount).toBe(0);
    expect(metrics.successCount).toBe(0);
    expect(metrics.totalCalls).toBe(0);
    expect(metrics.successfulCalls).toBe(0);
    expect(metrics.failedCalls).toBe(0);
    expect(metrics.rejectedCalls).toBe(0);
    expect(metrics.stateHistory).toHaveLength(1);
  });
});