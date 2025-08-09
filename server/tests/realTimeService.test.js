/**
 * Tests for the RealTimeService
 */
const RealTimeService = require('../services/RealTimeService');
const ChangeStreamManager = require('../services/ChangeStreamManager');

// Mock dependencies
jest.mock('../services/ChangeStreamManager');

describe('RealTimeService', () => {
  let realTimeService;
  let mockIo;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock Socket.IO
    mockIo = {
      to: jest.fn().mockReturnValue({
        emit: jest.fn()
      })
    };
    
    // Mock ChangeStreamManager implementation
    ChangeStreamManager.mockImplementation(() => {
      return {
        initialize: jest.fn().mockResolvedValue(undefined),
        addListener: jest.fn(),
        on: jest.fn(),
        close: jest.fn().mockResolvedValue(undefined),
        getStatus: jest.fn().mockReturnValue({
          isConnected: true,
          collections: {
            messages: { active: true, listeners: 1 },
            reports: { active: true, listeners: 1 }
          },
          activeStreams: 2,
          totalListeners: 2
        })
      };
    });
  });
  
  test('should create instance with default options', () => {
    realTimeService = new RealTimeService(mockIo);
    
    expect(realTimeService.io).toBe(mockIo);
    expect(realTimeService.options.collections).toContain('messages');
    expect(realTimeService.options.collections).toContain('reports');
    expect(realTimeService.options.collections).toContain('notices');
    expect(realTimeService.initialized).toBe(false);
  });
  
  test('should create instance with custom options', () => {
    const options = {
      collections: ['users', 'products'],
      maxRetries: 5
    };
    
    realTimeService = new RealTimeService(mockIo, options);
    
    expect(realTimeService.options.collections).toEqual(options.collections);
    expect(realTimeService.options.maxRetries).toBe(options.maxRetries);
  });
  
  test('should initialize change stream manager', async () => {
    realTimeService = new RealTimeService(mockIo);
    
    await realTimeService.initialize();
    
    expect(realTimeService.changeStreamManager.initialize).toHaveBeenCalled();
    expect(realTimeService.changeStreamManager.addListener).toHaveBeenCalledWith('messages', expect.any(Function));
    expect(realTimeService.changeStreamManager.addListener).toHaveBeenCalledWith('reports', expect.any(Function));
    expect(realTimeService.changeStreamManager.addListener).toHaveBeenCalledWith('notices', expect.any(Function));
    expect(realTimeService.initialized).toBe(true);
  });
  
  test('should not initialize twice', async () => {
    realTimeService = new RealTimeService(mockIo);
    
    // Initialize once
    await realTimeService.initialize();
    
    // Reset mock
    realTimeService.changeStreamManager.initialize.mockClear();
    
    // Try to initialize again
    await realTimeService.initialize();
    
    // Should not call initialize again
    expect(realTimeService.changeStreamManager.initialize).not.toHaveBeenCalled();
  });
  
  test('should close change stream manager', async () => {
    realTimeService = new RealTimeService(mockIo);
    
    // Initialize first
    await realTimeService.initialize();
    
    // Close
    await realTimeService.close();
    
    expect(realTimeService.changeStreamManager.close).toHaveBeenCalled();
    expect(realTimeService.initialized).toBe(false);
  });
  
  test('should get status', async () => {
    realTimeService = new RealTimeService(mockIo);
    
    // Initialize first
    await realTimeService.initialize();
    
    const status = realTimeService.getStatus();
    
    expect(status).toHaveProperty('initialized', true);
    expect(status).toHaveProperty('changeStreams');
    expect(status.changeStreams).toHaveProperty('isConnected', true);
    expect(status.changeStreams).toHaveProperty('activeStreams', 2);
  });
  
  test('should handle message changes', async () => {
    realTimeService = new RealTimeService(mockIo);
    
    // Mock methods
    realTimeService._emitToPrivateChatParticipants = jest.fn();
    realTimeService._getMessageById = jest.fn().mockResolvedValue({
      _id: 'message-id',
      chatId: 'group-id',
      chatType: 'group',
      content: 'Test message'
    });
    
    // Initialize
    await realTimeService.initialize();
    
    // Get the message listener callback
    const messageListener = realTimeService.changeStreamManager.addListener.mock.calls.find(
      call => call[0] === 'messages'
    )[1];
    
    // Create a mock insert change
    const insertChange = {
      operationType: 'insert',
      fullDocument: {
        _id: 'message-id',
        chatId: 'group-id',
        chatType: 'group',
        content: 'Test message'
      }
    };
    
    // Call the listener with the mock change
    messageListener(insertChange);
    
    // Check if the socket emit was called correctly
    expect(mockIo.to).toHaveBeenCalledWith('group_group-id');
    expect(mockIo.to('group_group-id').emit).toHaveBeenCalledWith('new_message_sync', {
      type: 'new',
      message: insertChange.fullDocument
    });
  });
  
  test('should handle private message changes', async () => {
    realTimeService = new RealTimeService(mockIo);
    
    // Mock methods
    realTimeService._emitToPrivateChatParticipants = jest.fn();
    
    // Initialize
    await realTimeService.initialize();
    
    // Get the message listener callback
    const messageListener = realTimeService.changeStreamManager.addListener.mock.calls.find(
      call => call[0] === 'messages'
    )[1];
    
    // Create a mock insert change for private message
    const insertChange = {
      operationType: 'insert',
      fullDocument: {
        _id: 'message-id',
        chatId: 'private-chat-id',
        chatType: 'private',
        content: 'Private message'
      }
    };
    
    // Call the listener with the mock change
    messageListener(insertChange);
    
    // Check if the private chat emit method was called correctly
    expect(realTimeService._emitToPrivateChatParticipants).toHaveBeenCalledWith(
      'private-chat-id',
      'new_private_message_sync',
      {
        type: 'new',
        message: insertChange.fullDocument
      }
    );
  });
  
  test('should handle report changes', async () => {
    realTimeService = new RealTimeService(mockIo);
    
    // Mock methods
    realTimeService._getReportById = jest.fn().mockResolvedValue({
      _id: 'report-id',
      neighbourhoodId: 'neighbourhood-id',
      title: 'Test report'
    });
    
    // Initialize
    await realTimeService.initialize();
    
    // Get the report listener callback
    const reportListener = realTimeService.changeStreamManager.addListener.mock.calls.find(
      call => call[0] === 'reports'
    )[1];
    
    // Create a mock insert change
    const insertChange = {
      operationType: 'insert',
      fullDocument: {
        _id: 'report-id',
        neighbourhoodId: 'neighbourhood-id',
        title: 'Test report'
      }
    };
    
    // Call the listener with the mock change
    reportListener(insertChange);
    
    // Check if the socket emit was called correctly
    expect(mockIo.to).toHaveBeenCalledWith('neighbourhood_neighbourhood-id');
    expect(mockIo.to('neighbourhood_neighbourhood-id').emit).toHaveBeenCalledWith('report_sync', {
      type: 'new',
      report: insertChange.fullDocument
    });
  });
});