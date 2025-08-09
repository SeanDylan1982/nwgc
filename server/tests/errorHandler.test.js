/**
 * Tests for the error handler
 */
const { describe, it, beforeEach, afterEach, expect, vi } = require('vitest');
const {
  handleDatabaseError,
  createErrorResponse,
  errorMiddleware,
  asyncHandler,
  handleSocketError
} = require('../utils/errorHandler');

// Mock the error classification module
vi.mock('../utils/errorClassification', () => {
  return {
    ErrorSeverity: {
      CRITICAL: 'critical',
      HIGH: 'high',
      MEDIUM: 'medium',
      LOW: 'low',
      INFO: 'info'
    },
    ErrorCategory: {
      CONNECTION: 'connection',
      AUTHENTICATION: 'authentication',
      AUTHORIZATION: 'authorization',
      VALIDATION: 'validation',
      INPUT: 'input',
      RESOURCE: 'resource',
      UNKNOWN: 'unknown'
    },
    ErrorTypes: {
      TRANSIENT: 'transient',
      PERSISTENT: 'persistent',
      FATAL: 'fatal'
    },
    classifyError: vi.fn().mockImplementation((error) => ({
      type: 'persistent',
      category: 'unknown',
      severity: 'medium',
      retryable: false,
      userFriendlyMessage: 'Something went wrong',
      code: error.code || 'unknown',
      reason: 'unknown_error'
    })),
    enhanceError: vi.fn().mockImplementation((error) => {
      if (!error.classification) {
        error.classification = {
          type: 'persistent',
          category: 'unknown',
          severity: 'medium',
          retryable: false,
          userFriendlyMessage: 'Something went wrong',
          code: error.code || 'unknown',
          reason: 'unknown_error'
        };
      }
      return error;
    }),
    logClassifiedError: vi.fn(),
    getHandlingStrategy: vi.fn().mockReturnValue('log_and_report')
  };
});

describe('Error Handler', () => {
  // Mock console methods
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;
  const originalConsoleLog = console.log;
  
  beforeEach(() => {
    console.error = vi.fn();
    console.warn = vi.fn();
    console.log = vi.fn();
    
    // Reset mocks
    vi.clearAllMocks();
  });
  
  afterEach(() => {
    // Restore console methods
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
    console.log = originalConsoleLog;
  });
  
  describe('handleDatabaseError', () => {
    it('should handle database errors and return appropriate result', () => {
      const error = new Error('Database error');
      
      // Mock getHandlingStrategy to return specific strategy
      const { getHandlingStrategy } = require('../utils/errorClassification');
      getHandlingStrategy.mockReturnValueOnce('log_and_report');
      
      const result = handleDatabaseError(error, { shouldThrow: false });
      
      expect(result).toEqual(expect.objectContaining({
        handled: true,
        error: expect.any(Error),
        userMessage: expect.any(String),
        retry: false,
        strategy: 'log_and_report'
      }));
    });
    
    it('should throw error when shouldThrow is true', () => {
      const error = new Error('Database error');
      
      expect(() => handleDatabaseError(error)).toThrow('Database error');
    });
    
    it('should call onCritical callback for critical errors', () => {
      const error = new Error('Critical database error');
      error.classification = {
        severity: 'critical',
        userFriendlyMessage: 'A critical error occurred'
      };
      
      // Mock getHandlingStrategy to return alert_and_report
      const { getHandlingStrategy } = require('../utils/errorClassification');
      getHandlingStrategy.mockReturnValueOnce('alert_and_report');
      
      const onCritical = vi.fn();
      
      const result = handleDatabaseError(error, {
        shouldThrow: false,
        onCritical
      });
      
      expect(onCritical).toHaveBeenCalledWith(error);
      expect(result.strategy).toBe('alert_and_report');
      expect(result.retry).toBe(false);
    });
    
    it('should suggest retry for transient errors', () => {
      const error = new Error('Transient database error');
      error.classification = {
        type: 'transient',
        retryable: true,
        userFriendlyMessage: 'Please try again'
      };
      
      // Mock getHandlingStrategy to return retry_with_backoff
      const { getHandlingStrategy } = require('../utils/errorClassification');
      getHandlingStrategy.mockReturnValueOnce('retry_with_backoff');
      
      const result = handleDatabaseError(error, { shouldThrow: false });
      
      expect(result.retry).toBe(true);
      expect(result.backoffMs).toBeDefined();
      expect(result.strategy).toBe('retry_with_backoff');
    });
    
    it('should include validation details for validation errors', () => {
      const error = new Error('Validation error');
      error.classification = {
        category: 'validation',
        validationErrors: [
          { field: 'name', message: 'Name is required' }
        ],
        userFriendlyMessage: 'Please check your input'
      };
      
      // Mock getHandlingStrategy to return return_validation_details
      const { getHandlingStrategy } = require('../utils/errorClassification');
      getHandlingStrategy.mockReturnValueOnce('return_validation_details');
      
      const result = handleDatabaseError(error, { shouldThrow: false });
      
      expect(result.validationErrors).toEqual([
        { field: 'name', message: 'Name is required' }
      ]);
      expect(result.strategy).toBe('return_validation_details');
      expect(result.retry).toBe(false);
    });
    
    it('should suggest re-authentication for auth errors', () => {
      const error = new Error('Authentication error');
      error.classification = {
        category: 'authentication',
        userFriendlyMessage: 'Please log in again'
      };
      
      // Mock getHandlingStrategy to return prompt_authentication
      const { getHandlingStrategy } = require('../utils/errorClassification');
      getHandlingStrategy.mockReturnValueOnce('prompt_authentication');
      
      const result = handleDatabaseError(error, { shouldThrow: false });
      
      expect(result.requiresAuthentication).toBe(true);
      expect(result.strategy).toBe('prompt_authentication');
      expect(result.retry).toBe(false);
    });
  });
  
  describe('createErrorResponse', () => {
    it('should create appropriate HTTP response for different error categories', () => {
      // Authentication error
      const authError = new Error('Authentication error');
      authError.classification = {
        category: 'authentication',
        userFriendlyMessage: 'Please log in again',
        code: 'auth_error'
      };
      
      const authResponse = createErrorResponse(authError);
      expect(authResponse.statusCode).toBe(401);
      expect(authResponse.body.error.message).toBe('Please log in again');
      expect(authResponse.body.error.code).toBe('auth_error');
      
      // Authorization error
      const authzError = new Error('Authorization error');
      authzError.classification = {
        category: 'authorization',
        userFriendlyMessage: 'Not authorized',
        code: 'forbidden'
      };
      
      const authzResponse = createErrorResponse(authzError);
      expect(authzResponse.statusCode).toBe(403);
      
      // Validation error
      const validationError = new Error('Validation error');
      validationError.classification = {
        category: 'validation',
        userFriendlyMessage: 'Invalid input',
        code: 'invalid_input',
        validationErrors: [
          { field: 'name', message: 'Name is required' }
        ]
      };
      
      const validationResponse = createErrorResponse(validationError);
      expect(validationResponse.statusCode).toBe(400);
      expect(validationResponse.body.error.details).toEqual([
        { field: 'name', message: 'Name is required' }
      ]);
      
      // Resource error
      const resourceError = new Error('Resource error');
      resourceError.classification = {
        category: 'resource',
        userFriendlyMessage: 'Service unavailable',
        code: 'unavailable'
      };
      
      const resourceResponse = createErrorResponse(resourceError);
      expect(resourceResponse.statusCode).toBe(503);
      
      // Connection error (critical)
      const connectionError = new Error('Connection error');
      connectionError.classification = {
        category: 'connection',
        severity: 'critical',
        userFriendlyMessage: 'Database unavailable',
        code: 'db_error'
      };
      
      const connectionResponse = createErrorResponse(connectionError);
      expect(connectionResponse.statusCode).toBe(503);
      
      // Unknown error
      const unknownError = new Error('Unknown error');
      unknownError.classification = {
        category: 'unknown',
        userFriendlyMessage: 'Something went wrong',
        code: 'error'
      };
      
      const unknownResponse = createErrorResponse(unknownError);
      expect(unknownResponse.statusCode).toBe(500);
    });
    
    it('should include retry information for retryable errors', () => {
      const retryableError = new Error('Temporary error');
      retryableError.classification = {
        retryable: true,
        userFriendlyMessage: 'Please try again',
        code: 'temp_error'
      };
      
      const response = createErrorResponse(retryableError);
      expect(response.body.error.retryable).toBe(true);
      expect(response.body.error.retryAfter).toBeDefined();
    });
    
    it('should include debug information in development environment', () => {
      // Save original NODE_ENV
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      try {
        const error = new Error('Test error');
        error.stack = 'Error: Test error\n    at test.js:1:1';
        error.classification = {
          type: 'persistent',
          category: 'unknown',
          severity: 'medium',
          reason: 'test_error',
          userFriendlyMessage: 'Something went wrong',
          code: 'error'
        };
        
        const response = createErrorResponse(error);
        expect(response.body.error.debug).toBeDefined();
        expect(response.body.error.debug.stack).toBe(error.stack);
        expect(response.body.error.debug.classification).toBeDefined();
      } finally {
        // Restore original NODE_ENV
        process.env.NODE_ENV = originalNodeEnv;
      }
    });
  });
  
  describe('errorMiddleware', () => {
    it('should send appropriate error response', () => {
      const error = new Error('Test error');
      
      // Mock Express req, res, next
      const req = {
        method: 'GET',
        path: '/test',
        query: {},
        ip: '127.0.0.1',
        user: { id: 'user123' }
      };
      
      const res = {
        headersSent: false,
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };
      
      const next = vi.fn();
      
      // Call middleware
      errorMiddleware(error, req, res, next);
      
      // Check if response was sent
      expect(res.status).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });
    
    it('should call next if headers already sent', () => {
      const error = new Error('Test error');
      
      // Mock Express req, res, next
      const req = {};
      const res = { headersSent: true };
      const next = vi.fn();
      
      // Call middleware
      errorMiddleware(error, req, res, next);
      
      // Check if next was called with error
      expect(next).toHaveBeenCalledWith(error);
    });
  });
  
  describe('asyncHandler', () => {
    it('should wrap async route handler with error handling', async () => {
      // Create a successful handler
      const successHandler = vi.fn().mockResolvedValue('success');
      
      // Wrap it
      const wrappedSuccessHandler = asyncHandler(successHandler);
      
      // Mock Express req, res, next
      const req = {};
      const res = {};
      const next = vi.fn();
      
      // Call wrapped handler
      await wrappedSuccessHandler(req, res, next);
      
      // Check if original handler was called
      expect(successHandler).toHaveBeenCalledWith(req, res, next);
      expect(next).not.toHaveBeenCalled();
      
      // Create a failing handler
      const error = new Error('Handler error');
      const failingHandler = vi.fn().mockRejectedValue(error);
      
      // Wrap it
      const wrappedFailingHandler = asyncHandler(failingHandler);
      
      // Call wrapped handler
      await wrappedFailingHandler(req, res, next);
      
      // Check if next was called with error
      expect(failingHandler).toHaveBeenCalledWith(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });
  
  describe('handleSocketError', () => {
    it('should emit error to socket', () => {
      const error = new Error('Socket error');
      error.classification = {
        userFriendlyMessage: 'Connection error',
        code: 'socket_error',
        retryable: true,
        severity: 'medium'
      };
      
      // Mock socket
      const socket = {
        id: 'socket123',
        user: { id: 'user123' },
        emit: vi.fn(),
        disconnect: vi.fn()
      };
      
      // Handle error
      handleSocketError(error, socket);
      
      // Check if error was emitted
      expect(socket.emit).toHaveBeenCalledWith('error', expect.objectContaining({
        message: 'Connection error',
        code: 'socket_error',
        retryable: true
      }));
      
      // Should not disconnect for non-critical errors
      expect(socket.disconnect).not.toHaveBeenCalled();
    });
    
    it('should disconnect socket for critical errors', () => {
      const criticalError = new Error('Critical socket error');
      criticalError.classification = {
        severity: 'critical',
        userFriendlyMessage: 'Critical error',
        code: 'critical_error'
      };
      
      // Mock socket
      const socket = {
        id: 'socket123',
        user: { id: 'user123' },
        emit: vi.fn(),
        disconnect: vi.fn()
      };
      
      // Handle error
      handleSocketError(criticalError, socket);
      
      // Check if error was emitted and socket disconnected
      expect(socket.emit).toHaveBeenCalled();
      expect(socket.disconnect).toHaveBeenCalledWith(true);
    });
  });
});