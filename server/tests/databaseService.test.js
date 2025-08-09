/**
 * Tests for the DatabaseService class
 */
const { describe, it, beforeEach, afterEach, expect, vi } = require('vitest');
const mongoose = require('mongoose');
const DatabaseService = require('../services/DatabaseService');

// Mock mongoose
vi.mock('mongoose', () => {
  const mockConnection = {
    readyState: 1,
    on: vi.fn(),
    db: {
      admin: vi.fn().mockReturnValue({
        ping: vi.fn().mockResolvedValue(true)
      })
    }
  };
  
  return {
    connect: vi.fn().mockResolvedValue({ connection: mockConnection }),
    connection: mockConnection,
    disconnect: vi.fn().mockResolvedValue(true)
  };
});

// Mock console methods to prevent test output pollution
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;

describe('DatabaseService', () => {
  let dbService;
  const testConfig = {
    uri: 'mongodb://localhost:27017/test',
    minPoolSize: 5,
    maxPoolSize: 20,
    socketTimeoutMS: 30000,
    connectTimeoutMS: 15000,
    maxRetries: 3,
    initialDelayMs: 50,
    maxDelayMs: 1000
  };
  
  beforeEach(() => {
    // Mock console methods
    console.error = vi.fn();
    console.warn = vi.fn();
    console.log = vi.fn();
    
    // Create a new DatabaseService instance
    dbService = new DatabaseService(testConfig);
    
    // Reset mongoose mocks
    vi.clearAllMocks();
  });
  
  afterEach(() => {
    // Restore console methods
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
    console.log = originalConsoleLog;
  });
  
  describe('constructor', () => {
    it('should initialize with correct configuration', () => {
      expect(dbService.uri).toBe(testConfig.uri);
      expect(dbService.options.minPoolSize).toBe(testConfig.minPoolSize);
      expect(dbService.options.maxPoolSize).toBe(testConfig.maxPoolSize);
      expect(dbService.options.socketTimeoutMS).toBe(testConfig.socketTimeoutMS);
      expect(dbService.options.connectTimeoutMS).toBe(testConfig.connectTimeoutMS);
      expect(dbService.maxRetries).toBe(testConfig.maxRetries);
      expect(dbService.initialDelayMs).toBe(testConfig.initialDelayMs);
      expect(dbService.maxDelayMs).toBe(testConfig.maxDelayMs);
      expect(dbService.isConnected).toBe(false);
    });
    
    it('should set up connection event handlers', () => {
      expect(mongoose.connection.on).toHaveBeenCalledWith('connected', expect.any(Function));
      expect(mongoose.connection.on).toHaveBeenCalledWith('disconnected', expect.any(Function));
      expect(mongoose.connection.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mongoose.connection.on).toHaveBeenCalledWith('reconnected', expect.any(Function));
    });
  });
  
  describe('connect', () => {
    it('should connect to MongoDB successfully', async () => {
      const connection = await dbService.connect();
      
      expect(mongoose.connect).toHaveBeenCalledWith(testConfig.uri, expect.objectContaining({
        useNewUrlParser: true,
        useUnifiedTopology: true,
        maxPoolSize: testConfig.maxPoolSize,
        minPoolSize: testConfig.minPoolSize
      }));
      
      expect(connection).toBeDefined();
      expect(dbService.isConnected).toBe(true);
    });
    
    it('should retry connection on failure', async () => {
      // Mock mongoose.connect to fail once then succeed
      mongoose.connect
        .mockRejectedValueOnce(new Error('Connection failed'))
        .mockResolvedValueOnce({ connection: mongoose.connection });
      
      const connection = await dbService.connect();
      
      expect(mongoose.connect).toHaveBeenCalledTimes(2);
      expect(connection).toBeDefined();
      expect(dbService.isConnected).toBe(true);
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('MongoDB connection attempt 1 failed'));
    });
    
    it('should fail after max retries', async () => {
      // Mock mongoose.connect to always fail
      const connectionError = new Error('Connection failed');
      mongoose.connect.mockRejectedValue(connectionError);
      
      await expect(dbService.connect()).rejects.toThrow('Connection failed');
      
      // Initial attempt + maxRetries
      expect(mongoose.connect).toHaveBeenCalledTimes(testConfig.maxRetries + 1);
      expect(dbService.isConnected).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining(`Failed to connect to MongoDB after ${testConfig.maxRetries} attempts`),
        expect.anything()
      );
    });
    
    it('should return existing connection if already connected', async () => {
      // First connect
      await dbService.connect();
      
      // Reset mocks
      vi.clearAllMocks();
      
      // Set connected state
      dbService.isConnected = true;
      mongoose.connection.readyState = 1;
      
      // Connect again
      const connection = await dbService.connect();
      
      // Should not call mongoose.connect again
      expect(mongoose.connect).not.toHaveBeenCalled();
      expect(connection).toBe(mongoose.connection);
    });
    
    it('should return existing promise if already connecting', async () => {
      // Create a pending connection promise
      const connectionPromise = dbService.connect();
      
      // Try to connect again while first connection is pending
      const secondConnectionPromise = dbService.connect();
      
      // Both promises should be the same instance
      expect(secondConnectionPromise).toBe(connectionPromise);
      
      // Wait for connection to complete
      await connectionPromise;
      
      // Should only call mongoose.connect once
      expect(mongoose.connect).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('disconnect', () => {
    it('should disconnect from MongoDB', async () => {
      // First connect
      await dbService.connect();
      
      // Then disconnect
      await dbService.disconnect();
      
      expect(mongoose.disconnect).toHaveBeenCalled();
      expect(dbService.isConnected).toBe(false);
    });
    
    it('should clear health check interval on disconnect', async () => {
      // Set up a mock interval
      dbService.healthCheckInterval = 123;
      
      // Mock global clearInterval
      const originalClearInterval = global.clearInterval;
      global.clearInterval = vi.fn();
      
      // Disconnect
      await dbService.disconnect();
      
      // Check if clearInterval was called
      expect(global.clearInterval).toHaveBeenCalledWith(123);
      expect(dbService.healthCheckInterval).toBe(null);
      
      // Restore original clearInterval
      global.clearInterval = originalClearInterval;
    });
  });
  
  describe('executeWithRetry', () => {
    it('should execute operation successfully', async () => {
      const mockOperation = vi.fn().mockResolvedValue({ success: true });
      
      const result = await dbService.executeWithRetry(mockOperation, { operationType: 'find' });
      
      expect(mockOperation).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ success: true });
      expect(dbService.metrics.operations).toBe(1);
      expect(dbService.metrics.operationTypes.find).toBe(1);
    });
    
    it('should retry failed operations', async () => {
      const mockOperation = vi.fn()
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce({ success: true });
      
      // Mock _isRetryableError to return true
      dbService._isRetryableError = vi.fn().mockReturnValue(true);
      
      const result = await dbService.executeWithRetry(mockOperation, {
        maxRetries: 3,
        initialDelay: 10,
        operationType: 'update'
      });
      
      expect(mockOperation).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ success: true });
      expect(dbService.metrics.operations).toBe(2);
      expect(dbService.metrics.failures).toBe(1);
      expect(dbService.metrics.operationTypes.update).toBe(1);
      expect(dbService._isRetryableError).toHaveBeenCalledTimes(1);
    });
    
    it('should not retry non-retryable errors', async () => {
      const mockError = new Error('Non-retryable error');
      const mockOperation = vi.fn().mockRejectedValue(mockError);
      
      // Mock _isRetryableError to return false
      dbService._isRetryableError = vi.fn().mockReturnValue(false);
      
      await expect(dbService.executeWithRetry(mockOperation, {
        maxRetries: 3,
        initialDelay: 10
      })).rejects.toThrow('Non-retryable error');
      
      expect(mockOperation).toHaveBeenCalledTimes(1);
      expect(dbService.metrics.operations).toBe(1);
      expect(dbService.metrics.failures).toBe(1);
      expect(dbService._isRetryableError).toHaveBeenCalledTimes(1);
    });
    
    it('should stop retrying after max retries', async () => {
      const mockError = new Error('Persistent error');
      const mockOperation = vi.fn().mockRejectedValue(mockError);
      
      // Mock _isRetryableError to return true
      dbService._isRetryableError = vi.fn().mockReturnValue(true);
      
      await expect(dbService.executeWithRetry(mockOperation, {
        maxRetries: 2,
        initialDelay: 10
      })).rejects.toThrow('Persistent error');
      
      // Initial attempt + 2 retries
      expect(mockOperation).toHaveBeenCalledTimes(3);
      expect(dbService.metrics.operations).toBe(3);
      expect(dbService.metrics.failures).toBe(3);
      expect(dbService._isRetryableError).toHaveBeenCalledTimes(2);
    });
    
    it('should emit operation events', async () => {
      // Mock emit method
      dbService.emit = vi.fn();
      
      const mockOperation = vi.fn().mockResolvedValue({ success: true });
      
      await dbService.executeWithRetry(mockOperation, { operationType: 'find' });
      
      expect(dbService.emit).toHaveBeenCalledWith('operation_success', expect.objectContaining({
        operationType: 'find',
        latency: expect.any(Number),
        timestamp: expect.any(Date)
      }));
    });
    
    it('should emit failure events', async () => {
      // Mock emit method
      dbService.emit = vi.fn();
      
      const mockError = new Error('Operation failed');
      const mockOperation = vi.fn().mockRejectedValue(mockError);
      
      // Mock _isRetryableError to return false
      dbService._isRetryableError = vi.fn().mockReturnValue(false);
      
      await expect(dbService.executeWithRetry(mockOperation, {
        operationType: 'delete'
      })).rejects.toThrow('Operation failed');
      
      expect(dbService.emit).toHaveBeenCalledWith('operation_failure', expect.objectContaining({
        operationType: 'delete',
        error: 'Operation failed',
        retries: 1,
        timestamp: expect.any(Date)
      }));
    });
  });
  
  describe('_isRetryableError', () => {
    it('should identify network errors as retryable', () => {
      const networkError = new Error('Network error');
      networkError.name = 'MongoNetworkError';
      
      expect(dbService._isRetryableError(networkError)).toBe(true);
    });
    
    it('should identify timeout errors as retryable', () => {
      const timeoutError = new Error('Timeout error');
      timeoutError.name = 'MongoTimeoutError';
      
      expect(dbService._isRetryableError(timeoutError)).toBe(true);
    });
    
    it('should identify specific server errors as retryable', () => {
      const serverError = new Error('Server error');
      serverError.name = 'MongoServerError';
      serverError.code = 112; // Write conflict error
      
      expect(dbService._isRetryableError(serverError)).toBe(true);
    });
    
    it('should identify non-retryable errors', () => {
      const validationError = new Error('Validation error');
      validationError.name = 'ValidationError';
      
      expect(dbService._isRetryableError(validationError)).toBe(false);
    });
  });
  
  describe('_startHealthChecks', () => {
    it('should start periodic health checks', () => {
      // Mock setInterval
      const originalSetInterval = global.setInterval;
      global.setInterval = vi.fn().mockReturnValue(123);
      
      // Start health checks
      dbService._startHealthChecks();
      
      // Check if setInterval was called
      expect(global.setInterval).toHaveBeenCalled();
      expect(dbService.healthCheckInterval).toBe(123);
      
      // Restore original setInterval
      global.setInterval = originalSetInterval;
    });
    
    it('should clear existing interval before starting new one', () => {
      // Set up a mock interval
      dbService.healthCheckInterval = 123;
      
      // Mock global interval functions
      const originalSetInterval = global.setInterval;
      const originalClearInterval = global.clearInterval;
      global.setInterval = vi.fn().mockReturnValue(456);
      global.clearInterval = vi.fn();
      
      // Start health checks
      dbService._startHealthChecks();
      
      // Check if clearInterval was called with old interval
      expect(global.clearInterval).toHaveBeenCalledWith(123);
      expect(global.setInterval).toHaveBeenCalled();
      expect(dbService.healthCheckInterval).toBe(456);
      
      // Restore original functions
      global.setInterval = originalSetInterval;
      global.clearInterval = originalClearInterval;
    });
  });
  
  describe('getConnectionStats', () => {
    it('should return connection statistics', () => {
      // Add some test data to metrics
      dbService.metrics.operations = 100;
      dbService.metrics.failures = 5;
      dbService.metrics.reconnects = 2;
      dbService.metrics.connectionLatency = [40, 50, 60];
      dbService.metrics.queryLatency = [90, 100, 110];
      dbService.metrics.activeConnections = 10;
      
      const stats = dbService.getConnectionStats();
      
      expect(stats).toEqual(expect.objectContaining({
        isConnected: dbService.isConnected,
        readyState: mongoose.connection.readyState,
        operations: 100,
        failures: 5,
        reconnects: 2,
        avgConnectionLatency: 50,
        avgQueryLatency: 100,
        activeConnections: 10
      }));
    });
    
    it('should mask credentials in connection string', () => {
      // Set a connection string with credentials
      dbService.uri = 'mongodb://username:password@localhost:27017/test';
      
      const stats = dbService.getConnectionStats();
      
      expect(stats.connectionString).toBe('mongodb://***:***@localhost:27017/test');
    });
  });
  
  describe('getDetailedMetrics', () => {
    it('should return detailed metrics', () => {
      // Add some test data to metrics
      dbService.metrics.operations = 100;
      dbService.metrics.failures = 5;
      dbService.metrics.reconnects = 2;
      dbService.metrics.connectionLatency = [40, 50, 60];
      dbService.metrics.queryLatency = [90, 100, 110];
      dbService.metrics.activeConnections = 10;
      dbService.metrics.operationTypes = {
        find: 50,
        insert: 20,
        update: 25,
        delete: 5
      };
      
      const metrics = dbService.getDetailedMetrics();
      
      expect(metrics).toEqual(expect.objectContaining({
        timestamp: expect.any(Date),
        connection: expect.objectContaining({
          status: expect.any(String),
          readyState: expect.any(Number),
          reconnects: 2
        }),
        operations: expect.objectContaining({
          total: 100,
          failures: 5,
          successRate: expect.any(Number),
          byType: expect.objectContaining({
            find: 50,
            insert: 20,
            update: 25,
            delete: 5
          })
        }),
        latency: expect.objectContaining({
          connection: expect.objectContaining({
            avg: 50,
            values: [40, 50, 60]
          }),
          query: expect.objectContaining({
            avg: 100,
            values: [90, 100, 110]
          })
        }),
        pool: expect.objectContaining({
          activeConnections: 10
        })
      }));
    });
  });
  
  describe('event handlers', () => {
    it('should handle connected event', () => {
      // Get the connected event handler
      const connectedHandler = mongoose.connection.on.mock.calls.find(
        call => call[0] === 'connected'
      )[1];
      
      // Mock emit method
      dbService.emit = vi.fn();
      
      // Trigger the event
      connectedHandler();
      
      expect(dbService.isConnected).toBe(true);
      expect(dbService.emit).toHaveBeenCalledWith('connected');
      expect(console.log).toHaveBeenCalledWith('MongoDB connection established');
    });
    
    it('should handle disconnected event', () => {
      // Get the disconnected event handler
      const disconnectedHandler = mongoose.connection.on.mock.calls.find(
        call => call[0] === 'disconnected'
      )[1];
      
      // Mock emit method
      dbService.emit = vi.fn();
      
      // Trigger the event
      disconnectedHandler();
      
      expect(dbService.isConnected).toBe(false);
      expect(dbService.emit).toHaveBeenCalledWith('disconnected');
      expect(console.log).toHaveBeenCalledWith('MongoDB disconnected');
    });
    
    it('should handle error event', () => {
      // Get the error event handler
      const errorHandler = mongoose.connection.on.mock.calls.find(
        call => call[0] === 'error'
      )[1];
      
      // Mock emit method
      dbService.emit = vi.fn();
      
      // Trigger the event with an error
      const testError = new Error('Test error');
      errorHandler(testError);
      
      expect(dbService.metrics.failures).toBe(1);
      expect(dbService.emit).toHaveBeenCalledWith('error', testError);
      expect(console.error).toHaveBeenCalledWith('MongoDB connection error:', testError);
    });
    
    it('should handle reconnected event', () => {
      // Get the reconnected event handler
      const reconnectedHandler = mongoose.connection.on.mock.calls.find(
        call => call[0] === 'reconnected'
      )[1];
      
      // Mock emit method
      dbService.emit = vi.fn();
      
      // Trigger the event
      reconnectedHandler();
      
      expect(dbService.metrics.reconnects).toBe(1);
      expect(dbService.metrics.lastReconnectTime).toBeInstanceOf(Date);
      expect(dbService.emit).toHaveBeenCalledWith('reconnected');
      expect(console.log).toHaveBeenCalledWith('MongoDB reconnected');
    });
  });
});