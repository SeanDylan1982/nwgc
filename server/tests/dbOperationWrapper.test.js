/**
 * Tests for the database operation wrapper
 */
const mongoose = require('mongoose');
const { 
  executeQuery, 
  withRetry, 
  wrapModelMethod, 
  withTransaction,
  checkDatabaseHealth,
  classifyError
} = require('../utils/dbOperationWrapper');

// Mock the database service
jest.mock('../config/database', () => ({
  dbService: {
    isConnected: true,
    connect: jest.fn().mockResolvedValue(true),
    getConnectionStats: jest.fn().mockReturnValue({
      isConnected: true,
      readyState: 1,
      operations: 100,
      failures: 5
    })
  }
}));

// Mock console methods to prevent test output pollution
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleInfo = console.info;
const originalConsoleDebug = console.debug;

beforeAll(() => {
  console.error = jest.fn();
  console.warn = jest.fn();
  console.info = jest.fn();
  console.debug = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
  console.info = originalConsoleInfo;
  console.debug = originalConsoleDebug;
});

// Mock mongoose
jest.mock('mongoose', () => {
  const mockConnection = {
    readyState: 1,
    db: {
      admin: () => ({
        ping: jest.fn().mockResolvedValue(true)
      })
    }
  };
  
  return {
    connection: mockConnection,
    startSession: jest.fn().mockReturnValue({
      startTransaction: jest.fn(),
      commitTransaction: jest.fn().mockResolvedValue(true),
      abortTransaction: jest.fn().mockResolvedValue(true),
      endSession: jest.fn()
    })
  };
});

describe('Database Operation Wrapper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('executeQuery', () => {
    test('should execute successful operations', async () => {
      const mockOperation = jest.fn().mockResolvedValue({ success: true });
      
      const result = await executeQuery(mockOperation, {
        operationName: 'testOperation'
      });
      
      expect(mockOperation).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ success: true });
    });
    
    test('should handle operation timeouts', async () => {
      // Create a function that never resolves to simulate timeout
      const mockOperation = jest.fn(() => new Promise(() => {}));
      
      await expect(executeQuery(mockOperation, {
        timeout: 100, // Very short timeout for testing
        operationName: 'timeoutOperation'
      })).rejects.toThrow('Operation timed out');
    });
    
    test('should retry failed operations', async () => {
      // Operation fails once then succeeds
      const mockOperation = jest.fn()
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce({ success: true });
      
      const result = await executeQuery(mockOperation, {
        operationName: 'retryOperation',
        retryOptions: {
          maxRetries: 3,
          initialDelayMs: 10 // Short delay for testing
        }
      });
      
      expect(mockOperation).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ success: true });
    });
    
    test('should enhance errors with context', async () => {
      const originalError = new Error('Database error');
      const mockOperation = jest.fn().mockRejectedValue(originalError);
      
      try {
        await executeQuery(mockOperation, {
          operationName: 'errorOperation',
          metadata: { testId: 123 }
        });
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toContain('Database query failed: Database error');
        expect(error.originalError).toBe(originalError);
        expect(error.operationName).toBe('errorOperation');
        expect(error.metadata).toEqual({ testId: 123 });
        expect(error.isDbError).toBe(true);
      }
    });
  });

  describe('withRetry', () => {
    test('should retry operations with backoff', async () => {
      const mockOperation = jest.fn()
        .mockRejectedValueOnce(new Error('Failure 1'))
        .mockRejectedValueOnce(new Error('Failure 2'))
        .mockResolvedValueOnce({ success: true });
      
      const result = await withRetry(mockOperation, {
        maxRetries: 3,
        initialDelayMs: 10,
        operationName: 'retryTest'
      });
      
      expect(mockOperation).toHaveBeenCalledTimes(3);
      expect(result).toEqual({ success: true });
    });
    
    test('should stop retrying after max attempts', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('Persistent failure'));
      
      await expect(withRetry(mockOperation, {
        maxRetries: 2,
        initialDelayMs: 10
      })).rejects.toThrow('Persistent failure');
      
      expect(mockOperation).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe('withTransaction', () => {
    test('should execute transaction and commit on success', async () => {
      const mockTransactionFn = jest.fn().mockResolvedValue({ success: true });
      
      const result = await withTransaction(mockTransactionFn);
      
      expect(mongoose.startSession).toHaveBeenCalled();
      expect(mockTransactionFn).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });
    
    test('should abort transaction on error', async () => {
      const mockSession = {
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        abortTransaction: jest.fn().mockResolvedValue(true),
        endSession: jest.fn()
      };
      
      mongoose.startSession.mockReturnValueOnce(mockSession);
      
      const mockTransactionFn = jest.fn().mockRejectedValue(new Error('Transaction error'));
      
      await expect(withTransaction(mockTransactionFn)).rejects.toThrow();
      
      expect(mockSession.startTransaction).toHaveBeenCalled();
      expect(mockSession.abortTransaction).toHaveBeenCalled();
      expect(mockSession.endSession).toHaveBeenCalled();
    });
  });

  describe('checkDatabaseHealth', () => {
    test('should return healthy status when database is responsive', async () => {
      const health = await checkDatabaseHealth();
      
      expect(health.status).toBe('healthy');
      expect(health.isConnected).toBe(true);
    });
    
    test('should return unhealthy status when ping fails', async () => {
      // Mock the ping to fail
      mongoose.connection.db.admin = () => ({
        ping: jest.fn().mockRejectedValue(new Error('Ping failed'))
      });
      
      const health = await checkDatabaseHealth();
      
      expect(health.status).toBe('unhealthy');
      expect(health.error).toBeDefined();
    });
  });

  describe('classifyError', () => {
    test('should classify network errors as retryable', () => {
      const networkError = new Error('connection timed out');
      networkError.name = 'MongoNetworkError';
      
      const classification = classifyError(networkError);
      
      expect(classification.retryable).toBe(true);
      expect(classification.type).toBe('transient');
    });
    
    test('should classify validation errors as non-retryable', () => {
      const validationError = new Error('validation failed');
      validationError.name = 'ValidationError';
      
      const classification = classifyError(validationError);
      
      expect(classification.retryable).toBe(false);
      expect(classification.type).toBe('persistent');
    });
    
    test('should classify authentication errors as fatal', () => {
      const authError = new Error('authentication failed');
      authError.code = 18;
      
      const classification = classifyError(authError);
      
      expect(classification.retryable).toBe(false);
      expect(classification.type).toBe('fatal');
    });
  });
});