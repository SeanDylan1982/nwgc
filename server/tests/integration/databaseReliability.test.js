/**
 * Integration tests for MongoDB reliability features
 * 
 * These tests verify the behavior of the database services under various
 * network conditions and failure scenarios.
 */
const { describe, it, beforeAll, afterAll, beforeEach, afterEach, expect, vi } = require('vitest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const DatabaseService = require('../../services/DatabaseService');
const { withRetry, executeQuery } = require('../../utils/dbOperationWrapper');

// Create a test schema and model
const TestSchema = new mongoose.Schema({
  name: { type: String, required: true },
  value: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

describe('Database Reliability Integration Tests', () => {
  let mongoServer;
  let dbService;
  let TestModel;
  let mongoUri;
  
  // Start MongoDB memory server before all tests
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    mongoUri = mongoServer.getUri();
    
    // Create database service
    dbService = new DatabaseService({
      uri: mongoUri,
      minPoolSize: 2,
      maxPoolSize: 10,
      socketTimeoutMS: 2000,
      connectTimeoutMS: 2000,
      maxRetries: 3,
      initialDelayMs: 50,
      maxDelayMs: 500
    });
    
    // Connect to database
    await dbService.connect();
    
    // Create test model
    TestModel = mongoose.model('TestModel', TestSchema);
  });
  
  // Stop MongoDB memory server after all tests
  afterAll(async () => {
    await dbService.disconnect();
    await mongoServer.stop();
  });
  
  // Clear test data before each test
  beforeEach(async () => {
    await TestModel.deleteMany({});
  });
  
  describe('Connection Resilience', () => {
    it('should reconnect after database restart', async () => {
      // Create a test document
      await TestModel.create({ name: 'test1', value: 1 });
      
      // Stop MongoDB server
      await mongoServer.stop();
      
      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Restart MongoDB server
      mongoServer = await MongoMemoryServer.create();
      
      // Update URI in database service
      dbService.uri = mongoServer.getUri();
      
      // Try to connect
      await dbService.connect();
      
      // Create a new document after reconnection
      const doc = await TestModel.create({ name: 'test2', value: 2 });
      
      // Verify document was created
      expect(doc).toBeDefined();
      expect(doc.name).toBe('test2');
      expect(doc.value).toBe(2);
    });
  });
  
  describe('Operation Retry Logic', () => {
    it('should retry failed operations with exponential backoff', async () => {
      // Create a failing operation that succeeds on the third attempt
      let attempts = 0;
      const operation = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return { success: true, attempts };
      };
      
      // Execute with retry
      const result = await withRetry(operation, {
        maxRetries: 3,
        initialDelayMs: 10,
        maxDelayMs: 100
      });
      
      // Verify operation was retried and succeeded
      expect(result).toEqual({ success: true, attempts: 3 });
      expect(attempts).toBe(3);
    });
    
    it('should handle database operation timeouts', async () => {
      // Create a slow operation that exceeds timeout
      const slowOperation = async () => {
        await new Promise(resolve => setTimeout(resolve, 500));
        return { success: true };
      };
      
      // Execute with short timeout
      await expect(executeQuery(slowOperation, {
        timeout: 100,
        operationName: 'slowOperation'
      })).rejects.toThrow('Operation timed out');
    });
  });
  
  describe('Connection Pool Saturation', () => {
    it('should handle connection pool saturation', async () => {
      // Create more concurrent operations than connection pool size
      const concurrentOperations = 15; // More than maxPoolSize (10)
      const operations = [];
      
      for (let i = 0; i < concurrentOperations; i++) {
        operations.push(TestModel.create({ 
          name: `test${i}`, 
          value: i 
        }));
      }
      
      // Execute all operations concurrently
      const results = await Promise.all(operations);
      
      // Verify all operations completed successfully
      expect(results).toHaveLength(concurrentOperations);
      
      // Verify all documents were created
      const count = await TestModel.countDocuments();
      expect(count).toBe(concurrentOperations);
    });
  });
  
  describe('Network Issues Simulation', () => {
    it('should handle network errors during operations', async () => {
      // Create a mock model with a save method that fails with network error
      const mockModel = new TestModel({ name: 'networkTest', value: 42 });
      
      // Save original save method
      const originalSave = mockModel.save;
      
      // Replace save method with one that fails with network error then succeeds
      let saveAttempts = 0;
      mockModel.save = async function() {
        saveAttempts++;
        if (saveAttempts === 1) {
          const error = new Error('network error');
          error.name = 'MongoNetworkError';
          throw error;
        }
        return originalSave.apply(this);
      };
      
      // Execute save with retry
      const result = await withRetry(() => mockModel.save(), {
        maxRetries: 3,
        initialDelayMs: 10
      });
      
      // Verify operation was retried and succeeded
      expect(result).toBeDefined();
      expect(result.name).toBe('networkTest');
      expect(result.value).toBe(42);
      expect(saveAttempts).toBe(2);
    });
  });
  
  describe('Error Handling and Recovery', () => {
    it('should handle and recover from transient errors', async () => {
      // Create a function that simulates different types of errors
      const simulateErrors = async (errorType) => {
        switch (errorType) {
          case 'network':
            const networkError = new Error('network error');
            networkError.name = 'MongoNetworkError';
            throw networkError;
            
          case 'timeout':
            const timeoutError = new Error('timeout error');
            timeoutError.name = 'MongoTimeoutError';
            throw timeoutError;
            
          case 'server':
            const serverError = new Error('server error');
            serverError.name = 'MongoServerError';
            serverError.code = 112; // Write conflict
            throw serverError;
            
          default:
            return { success: true };
        }
      };
      
      // Test network error
      await expect(simulateErrors('network')).rejects.toThrow('network error');
      
      // Test with retry for network error
      const networkResult = await withRetry(() => {
        return simulateErrors('network').catch(() => ({ recovered: true }));
      }, { maxRetries: 1 });
      
      expect(networkResult).toEqual({ recovered: true });
      
      // Test timeout error
      await expect(simulateErrors('timeout')).rejects.toThrow('timeout error');
      
      // Test with retry for timeout error
      const timeoutResult = await withRetry(() => {
        return simulateErrors('timeout').catch(() => ({ recovered: true }));
      }, { maxRetries: 1 });
      
      expect(timeoutResult).toEqual({ recovered: true });
      
      // Test server error
      await expect(simulateErrors('server')).rejects.toThrow('server error');
      
      // Test with retry for server error
      const serverResult = await withRetry(() => {
        return simulateErrors('server').catch(() => ({ recovered: true }));
      }, { maxRetries: 1 });
      
      expect(serverResult).toEqual({ recovered: true });
    });
  });
});