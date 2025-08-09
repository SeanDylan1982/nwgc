/**
 * Tests for the ChangeStreamManager service
 */
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const ChangeStreamManager = require('../services/ChangeStreamManager');
const { EventEmitter } = require('events');

// Mock MongoDB server
let mongoServer;
let changeStreamManager;

// Setup before tests
beforeAll(async () => {
  // Create in-memory MongoDB server
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  // Connect to in-memory database
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
});

// Cleanup after tests
afterAll(async () => {
  // Close change stream manager if it exists
  if (changeStreamManager) {
    await changeStreamManager.close();
  }
  
  // Disconnect from MongoDB
  await mongoose.disconnect();
  
  // Stop MongoDB server
  await mongoServer.stop();
});

describe('ChangeStreamManager', () => {
  test('should be an instance of EventEmitter', () => {
    changeStreamManager = new ChangeStreamManager();
    expect(changeStreamManager).toBeInstanceOf(EventEmitter);
  });
  
  test('should initialize with default options', () => {
    changeStreamManager = new ChangeStreamManager();
    expect(changeStreamManager.collections).toEqual(['messages', 'reports', 'notices']);
    expect(changeStreamManager.maxRetries).toBe(10);
    expect(changeStreamManager.initialDelayMs).toBe(1000);
    expect(changeStreamManager.maxDelayMs).toBe(60000);
  });
  
  test('should initialize with custom options', () => {
    const options = {
      collections: ['users', 'products'],
      maxRetries: 5,
      initialDelayMs: 500,
      maxDelayMs: 5000
    };
    
    changeStreamManager = new ChangeStreamManager(options);
    expect(changeStreamManager.collections).toEqual(options.collections);
    expect(changeStreamManager.maxRetries).toBe(options.maxRetries);
    expect(changeStreamManager.initialDelayMs).toBe(options.initialDelayMs);
    expect(changeStreamManager.maxDelayMs).toBe(options.maxDelayMs);
  });
  
  test('should add and remove listeners', () => {
    changeStreamManager = new ChangeStreamManager();
    
    const mockListener = jest.fn();
    
    // Add listener
    changeStreamManager.addListener('messages', mockListener);
    expect(changeStreamManager.listeners.has('messages')).toBe(true);
    expect(changeStreamManager.listeners.get('messages').has(mockListener)).toBe(true);
    
    // Remove listener
    changeStreamManager.removeListener('messages', mockListener);
    expect(changeStreamManager.listeners.get('messages').has(mockListener)).toBe(false);
  });
  
  test('should get status information', () => {
    changeStreamManager = new ChangeStreamManager({
      collections: ['messages', 'reports']
    });
    
    const status = changeStreamManager.getStatus();
    
    expect(status).toHaveProperty('isConnected');
    expect(status).toHaveProperty('collections');
    expect(status).toHaveProperty('activeStreams');
    expect(status).toHaveProperty('totalListeners');
    expect(status.collections).toHaveProperty('messages');
    expect(status.collections).toHaveProperty('reports');
  });
  
  // Mock tests for methods that require actual change streams
  test('should mock handleChange method', () => {
    changeStreamManager = new ChangeStreamManager();
    
    // Add a mock listener
    const mockListener = jest.fn();
    changeStreamManager.addListener('messages', mockListener);
    
    // Create a mock change event
    const mockChange = {
      _id: { _data: 'mock-resume-token' },
      operationType: 'insert',
      fullDocument: { content: 'Test message' }
    };
    
    // Call handleChange method
    changeStreamManager.handleChange('messages', mockChange);
    
    // Check if resume token was stored
    expect(changeStreamManager.resumeTokens.get('messages')).toEqual(mockChange._id);
    
    // Check if listener was called
    expect(mockListener).toHaveBeenCalledWith(mockChange);
  });
  
  test('should mock handleError method', () => {
    changeStreamManager = new ChangeStreamManager();
    
    // Spy on reconnectStream method
    const reconnectSpy = jest.spyOn(changeStreamManager, 'reconnectStream').mockImplementation(() => {});
    
    // Create a mock error
    const mockError = new Error('Test error');
    
    // Call handleError method
    changeStreamManager.handleError('messages', mockError);
    
    // Check if reconnectStream was called
    expect(reconnectSpy).toHaveBeenCalledWith('messages');
    
    // Restore the spy
    reconnectSpy.mockRestore();
  });
  
  test('should calculate exponential backoff with jitter in reconnectStream', async () => {
    changeStreamManager = new ChangeStreamManager({
      initialDelayMs: 100,
      maxDelayMs: 1000,
      maxRetries: 3
    });
    
    // Mock watchCollection to prevent actual reconnection
    const watchSpy = jest.spyOn(changeStreamManager, 'watchCollection').mockImplementation(() => {});
    
    // Set initial attempt count
    changeStreamManager.reconnectAttempts.set('messages', 1);
    
    // Call reconnectStream
    await changeStreamManager.reconnectStream('messages');
    
    // Check if attempt count was incremented
    expect(changeStreamManager.reconnectAttempts.get('messages')).toBe(2);
    
    // Check if watchCollection was called
    expect(watchSpy).toHaveBeenCalledWith('messages');
    
    // Restore the spy
    watchSpy.mockRestore();
  });
  
  test('should not exceed max retries in reconnectStream', async () => {
    changeStreamManager = new ChangeStreamManager({
      maxRetries: 3
    });
    
    // Set attempt count to max
    changeStreamManager.reconnectAttempts.set('messages', 3);
    
    // Spy on watchCollection to ensure it's not called
    const watchSpy = jest.spyOn(changeStreamManager, 'watchCollection').mockImplementation(() => {});
    
    // Call reconnectStream
    await changeStreamManager.reconnectStream('messages');
    
    // Check that watchCollection was not called
    expect(watchSpy).not.toHaveBeenCalled();
    
    // Restore the spy
    watchSpy.mockRestore();
  });
});

// Integration tests that require actual MongoDB change streams
// These tests are marked as skipped because they require a replica set
// which is not available in the MongoDB memory server
describe.skip('ChangeStreamManager Integration', () => {
  test('should initialize change streams', async () => {
    changeStreamManager = new ChangeStreamManager({
      collections: ['messages']
    });
    
    // Listen for initialization event
    const initPromise = new Promise(resolve => {
      changeStreamManager.once('initialized', resolve);
    });
    
    // Initialize change streams
    await changeStreamManager.initialize();
    
    // Wait for initialization event
    await initPromise;
    
    // Check if stream was created
    expect(changeStreamManager.streams.has('messages')).toBe(true);
    expect(changeStreamManager.isConnected).toBe(true);
    
    // Close change streams
    await changeStreamManager.close();
  });
  
  test('should detect changes in collections', async () => {
    // Create a test model
    const MessageSchema = new mongoose.Schema({
      content: String,
      sender: String
    });
    const Message = mongoose.model('Message', MessageSchema);
    
    // Initialize change stream manager
    changeStreamManager = new ChangeStreamManager({
      collections: ['messages']
    });
    
    // Create a promise that resolves when a change is detected
    const changePromise = new Promise(resolve => {
      changeStreamManager.once('messages_change', change => {
        resolve(change);
      });
    });
    
    // Initialize change streams
    await changeStreamManager.initialize();
    
    // Insert a document to trigger a change
    await Message.create({ content: 'Test message', sender: 'Test user' });
    
    // Wait for change event
    const change = await changePromise;
    
    // Check change event
    expect(change.operationType).toBe('insert');
    expect(change.fullDocument.content).toBe('Test message');
    
    // Close change streams
    await changeStreamManager.close();
  });
});