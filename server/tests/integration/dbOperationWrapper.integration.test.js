/**
 * Integration tests for database operation wrapper
 * 
 * These tests verify the behavior of the database operation wrapper
 * with actual MongoDB operations.
 */
const { describe, it, beforeAll, afterAll, beforeEach, afterEach, expect, vi } = require('vitest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const DatabaseService = require('../../services/DatabaseService');
const {
  withRetry,
  executeQuery,
  wrapModelMethod,
  withTransaction,
  checkDatabaseHealth
} = require('../../utils/dbOperationWrapper');

// Create a test schema and model
const TestSchema = new mongoose.Schema({
  name: { type: String, required: true },
  value: { type: Number, default: 0 },
  tags: [String],
  createdAt: { type: Date, default: Date.now }
});

describe('Database Operation Wrapper Integration Tests', () => {
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
      maxPoolSize: 5,
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
    
    // Configure database.js to use our dbService
    const database = require('../../config/database');
    database.dbService = dbService;
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
  
  describe('executeQuery', () => {
    it('should execute database queries successfully', async () => {
      // Create test document
      const doc = await executeQuery(
        () => TestModel.create({ name: 'test1', value: 42 }),
        { operationName: 'createTestDocument' }
      );
      
      // Verify document was created
      expect(doc).toBeDefined();
      expect(doc.name).toBe('test1');
      expect(doc.value).toBe(42);
      
      // Find document
      const foundDoc = await executeQuery(
        () => TestModel.findOne({ name: 'test1' }),
        { operationName: 'findTestDocument' }
      );
      
      // Verify document was found
      expect(foundDoc).toBeDefined();
      expect(foundDoc.name).toBe('test1');
      expect(foundDoc.value).toBe(42);
    });
    
    it('should handle query timeouts', async () => {
      // Create a slow operation that exceeds timeout
      const slowOperation = async () => {
        await new Promise(resolve => setTimeout(resolve, 300));
        return TestModel.findOne({ name: 'nonexistent' });
      };
      
      // Execute with short timeout
      await expect(executeQuery(
        slowOperation,
        { timeout: 100, operationName: 'slowQuery' }
      )).rejects.toThrow('Operation timed out');
    });
    
    it('should retry failed queries', async () => {
      // Create a counter to track attempts
      let attempts = 0;
      
      // Create an operation that fails twice then succeeds
      const failingOperation = async () => {
        attempts++;
        if (attempts < 3) {
          const error = new Error('Temporary failure');
          error.name = 'MongoNetworkError';
          throw error;
        }
        return TestModel.create({ name: 'retryTest', value: attempts });
      };
      
      // Execute with retry
      const result = await executeQuery(
        failingOperation,
        {
          operationName: 'retryableQuery',
          retryOptions: {
            maxRetries: 3,
            initialDelayMs: 10
          }
        }
      );
      
      // Verify operation was retried and succeeded
      expect(result).toBeDefined();
      expect(result.name).toBe('retryTest');
      expect(result.value).toBe(3);
      expect(attempts).toBe(3);
    });
  });
  
  describe('wrapModelMethod', () => {
    it('should wrap model methods with retry logic', async () => {
      // Wrap the create method
      const wrappedCreate = wrapModelMethod(TestModel, 'create', {
        operationName: 'wrappedCreate'
      });
      
      // Use the wrapped method
      const doc = await wrappedCreate({ name: 'wrappedTest', value: 100 });
      
      // Verify document was created
      expect(doc).toBeDefined();
      expect(doc.name).toBe('wrappedTest');
      expect(doc.value).toBe(100);
      
      // Find the document to confirm it was saved
      const foundDoc = await TestModel.findOne({ name: 'wrappedTest' });
      expect(foundDoc).toBeDefined();
      expect(foundDoc.value).toBe(100);
    });
    
    it('should handle errors in wrapped methods', async () => {
      // Wrap the create method
      const wrappedCreate = wrapModelMethod(TestModel, 'create', {
        operationName: 'wrappedCreateWithError'
      });
      
      // Try to create an invalid document (missing required field)
      await expect(wrappedCreate({ value: 200 })).rejects.toThrow();
    });
  });
  
  describe('withTransaction', () => {
    it('should execute operations in a transaction', async () => {
      // Execute operations in a transaction
      await withTransaction(async (session) => {
        // Create two documents in the transaction
        await TestModel.create([
          { name: 'tx1', value: 1 },
          { name: 'tx2', value: 2 }
        ], { session });
      });
      
      // Verify both documents were created
      const docs = await TestModel.find({ name: /^tx/ }).sort('value');
      expect(docs).toHaveLength(2);
      expect(docs[0].name).toBe('tx1');
      expect(docs[1].name).toBe('tx2');
    });
    
    it('should rollback transaction on error', async () => {
      // Try to execute operations in a transaction that will fail
      await expect(withTransaction(async (session) => {
        // Create one valid document
        await TestModel.create({ name: 'txValid', value: 1 }, { session });
        
        // Create an invalid document to cause the transaction to fail
        await TestModel.create({ value: 2 }, { session }); // Missing required name field
      })).rejects.toThrow();
      
      // Verify no documents were created (transaction was rolled back)
      const docs = await TestModel.find({ name: /^tx/ });
      expect(docs).toHaveLength(0);
    });
  });
  
  describe('checkDatabaseHealth', () => {
    it('should return healthy status when database is available', async () => {
      // Check database health
      const health = await checkDatabaseHealth();
      
      // Verify health status
      expect(health).toBeDefined();
      expect(health.status).toBe('healthy');
      expect(health.responseTime).toBeDefined();
      expect(health.isConnected).toBe(true);
    });
    
    it('should return unhealthy status when database is unavailable', async () => {
      // Stop MongoDB server
      await mongoServer.stop();
      
      // Wait a moment for connection to detect the issue
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Check database health
      const health = await checkDatabaseHealth();
      
      // Restart MongoDB server for other tests
      mongoServer = await MongoMemoryServer.create();
      dbService.uri = mongoServer.getUri();
      await dbService.connect();
      
      // Verify health status
      expect(health).toBeDefined();
      expect(health.status).toBe('unhealthy');
      expect(health.error).toBeDefined();
    });
  });
  
  describe('Performance under load', () => {
    it('should handle multiple concurrent operations', async () => {
      // Create multiple concurrent operations
      const operations = [];
      const count = 20;
      
      for (let i = 0; i < count; i++) {
        operations.push(executeQuery(
          () => TestModel.create({ name: `concurrent${i}`, value: i }),
          { operationName: `createConcurrent${i}` }
        ));
      }
      
      // Execute all operations concurrently
      const results = await Promise.all(operations);
      
      // Verify all operations completed successfully
      expect(results).toHaveLength(count);
      
      // Verify all documents were created
      const docs = await TestModel.find({ name: /^concurrent/ });
      expect(docs).toHaveLength(count);
    });
  });
});