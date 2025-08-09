/**
 * Tests for the retry utilities
 */
const { 
  classifyError, 
  calculateBackoffDelay, 
  withRetry, 
  makeRetryable,
  ErrorTypes
} = require('../utils/retryUtils');

describe('Retry Utilities', () => {
  describe('classifyError', () => {
    test('should classify network errors as transient and retryable', () => {
      const networkError = new Error('connection timed out');
      networkError.name = 'MongoNetworkError';
      
      const classification = classifyError(networkError);
      
      expect(classification.type).toBe(ErrorTypes.TRANSIENT);
      expect(classification.retryable).toBe(true);
      expect(classification.reason).toBe('network_issue');
    });
    
    test('should classify validation errors as persistent and not retryable', () => {
      const validationError = new Error('validation failed');
      validationError.name = 'ValidationError';
      
      const classification = classifyError(validationError);
      
      expect(classification.type).toBe(ErrorTypes.PERSISTENT);
      expect(classification.retryable).toBe(false);
      expect(classification.reason).toBe('validation_error');
    });
    
    test('should classify authentication errors as fatal and not retryable', () => {
      const authError = new Error('authentication failed');
      authError.code = 18;
      
      const classification = classifyError(authError);
      
      expect(classification.type).toBe(ErrorTypes.FATAL);
      expect(classification.retryable).toBe(false);
      expect(classification.reason).toBe('authentication_error');
    });
    
    test('should classify unknown errors as persistent and not retryable by default', () => {
      const unknownError = new Error('some unknown error');
      
      const classification = classifyError(unknownError);
      
      expect(classification.type).toBe(ErrorTypes.PERSISTENT);
      expect(classification.retryable).toBe(false);
    });
  });
  
  describe('calculateBackoffDelay', () => {
    test('should calculate exponential backoff correctly', () => {
      // Initial delay: 100ms
      // Attempt 1: 100ms
      // Attempt 2: 200ms
      // Attempt 3: 400ms
      // Attempt 4: 800ms
      
      const initialDelay = 100;
      const maxDelay = 1000;
      const jitterFactor = 0; // No jitter for deterministic testing
      
      expect(calculateBackoffDelay(1, initialDelay, maxDelay, jitterFactor)).toBe(100);
      expect(calculateBackoffDelay(2, initialDelay, maxDelay, jitterFactor)).toBe(200);
      expect(calculateBackoffDelay(3, initialDelay, maxDelay, jitterFactor)).toBe(400);
      expect(calculateBackoffDelay(4, initialDelay, maxDelay, jitterFactor)).toBe(800);
    });
    
    test('should respect maximum delay', () => {
      const initialDelay = 100;
      const maxDelay = 300;
      const jitterFactor = 0; // No jitter for deterministic testing
      
      expect(calculateBackoffDelay(1, initialDelay, maxDelay, jitterFactor)).toBe(100);
      expect(calculateBackoffDelay(2, initialDelay, maxDelay, jitterFactor)).toBe(200);
      expect(calculateBackoffDelay(3, initialDelay, maxDelay, jitterFactor)).toBe(300); // Capped at maxDelay
      expect(calculateBackoffDelay(4, initialDelay, maxDelay, jitterFactor)).toBe(300); // Capped at maxDelay
    });
    
    test('should add jitter within expected range', () => {
      const initialDelay = 100;
      const maxDelay = 1000;
      const jitterFactor = 0.2;
      const attempt = 2; // Base delay: 200ms
      
      // With 20% jitter, the delay should be between 160ms and 240ms
      const delay = calculateBackoffDelay(attempt, initialDelay, maxDelay, jitterFactor);
      
      expect(delay).toBeGreaterThanOrEqual(160);
      expect(delay).toBeLessThanOrEqual(240);
    });
  });
  
  describe('withRetry', () => {
    test('should retry failed operations up to maxRetries times', async () => {
      const mockOperation = jest.fn();
      mockOperation
        .mockRejectedValueOnce(new Error('Temporary failure 1'))
        .mockRejectedValueOnce(new Error('Temporary failure 2'))
        .mockResolvedValueOnce('success');
      
      const result = await withRetry(mockOperation, {
        maxRetries: 3,
        initialDelayMs: 10, // Small delay for testing
        shouldRetry: () => true, // Always retry
        logRetries: false // Disable logging for test
      });
      
      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(3);
    });
    
    test('should not retry if shouldRetry returns false', async () => {
      const mockOperation = jest.fn();
      const nonRetryableError = new Error('Non-retryable error');
      mockOperation.mockRejectedValue(nonRetryableError);
      
      await expect(withRetry(mockOperation, {
        maxRetries: 3,
        initialDelayMs: 10,
        shouldRetry: () => false, // Never retry
        logRetries: false
      })).rejects.toThrow('Non-retryable error');
      
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });
    
    test('should call onRetry callback before each retry', async () => {
      const mockOperation = jest.fn();
      mockOperation
        .mockRejectedValueOnce(new Error('Temporary failure 1'))
        .mockRejectedValueOnce(new Error('Temporary failure 2'))
        .mockResolvedValueOnce('success');
      
      const onRetry = jest.fn();
      
      await withRetry(mockOperation, {
        maxRetries: 3,
        initialDelayMs: 10,
        shouldRetry: () => true,
        onRetry,
        logRetries: false
      });
      
      expect(onRetry).toHaveBeenCalledTimes(2);
      expect(onRetry.mock.calls[0][0]).toBeInstanceOf(Error);
      expect(onRetry.mock.calls[0][1]).toBe(1); // First retry attempt
      expect(onRetry.mock.calls[1][1]).toBe(2); // Second retry attempt
    });
    
    test('should throw after maxRetries attempts', async () => {
      const mockOperation = jest.fn();
      mockOperation.mockRejectedValue(new Error('Persistent failure'));
      
      await expect(withRetry(mockOperation, {
        maxRetries: 2,
        initialDelayMs: 10,
        shouldRetry: () => true,
        logRetries: false
      })).rejects.toThrow('Persistent failure');
      
      expect(mockOperation).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });
  
  describe('makeRetryable', () => {
    test('should create a retryable version of a function', async () => {
      const mockFn = jest.fn();
      mockFn
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce('success');
      
      const retryableFn = makeRetryable(mockFn, {
        maxRetries: 2,
        initialDelayMs: 10,
        shouldRetry: () => true,
        logRetries: false
      });
      
      const result = await retryableFn('arg1', 'arg2');
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
      expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
    });
  });
});