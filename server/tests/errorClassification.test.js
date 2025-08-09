/**
 * Tests for the error classification system
 */
const { describe, it, expect } = require('vitest');
const {
  ErrorSeverity,
  ErrorCategory,
  ErrorTypes,
  UserImpact,
  classifyError,
  enhanceError,
  createError,
  getHandlingStrategy,
  logClassifiedError
} = require('../utils/errorClassification');

describe('Error Classification System', () => {
  describe('classifyError', () => {
    it('should classify MongoDB error codes correctly', () => {
      // Connection error
      const connectionError = new Error('Connection error');
      connectionError.code = 6;
      
      const connectionClassification = classifyError(connectionError);
      expect(connectionClassification.category).toBe(ErrorCategory.CONNECTION);
      expect(connectionClassification.type).toBe(ErrorTypes.TRANSIENT);
      expect(connectionClassification.severity).toBe(ErrorSeverity.HIGH);
      expect(connectionClassification.retryable).toBe(true);
      
      // Authentication error
      const authError = new Error('Authentication error');
      authError.code = 18;
      
      const authClassification = classifyError(authError);
      expect(authClassification.category).toBe(ErrorCategory.AUTHENTICATION);
      expect(authClassification.type).toBe(ErrorTypes.FATAL);
      expect(authClassification.severity).toBe(ErrorSeverity.CRITICAL);
      expect(authClassification.retryable).toBe(false);
      
      // Validation error
      const validationError = new Error('Validation error');
      validationError.code = 121;
      
      const validationClassification = classifyError(validationError);
      expect(validationClassification.category).toBe(ErrorCategory.VALIDATION);
      expect(validationClassification.type).toBe(ErrorTypes.PERSISTENT);
      expect(validationClassification.severity).toBe(ErrorSeverity.MEDIUM);
      expect(validationClassification.retryable).toBe(false);
      
      // Duplicate key error
      const duplicateKeyError = new Error('Duplicate key error');
      duplicateKeyError.code = 11000;
      duplicateKeyError.name = 'MongoServerError';
      
      const duplicateKeyClassification = classifyError(duplicateKeyError);
      expect(duplicateKeyClassification.category).toBe(ErrorCategory.VALIDATION);
      expect(duplicateKeyClassification.type).toBe(ErrorTypes.PERSISTENT);
      expect(duplicateKeyClassification.retryable).toBe(false);
      expect(duplicateKeyClassification.reason).toBe('duplicate_key');
    });
    
    it('should classify network errors correctly', () => {
      // Network error
      const networkError = new Error('connection timed out');
      networkError.name = 'MongoNetworkError';
      
      const networkClassification = classifyError(networkError);
      expect(networkClassification.category).toBe(ErrorCategory.CONNECTION);
      expect(networkClassification.type).toBe(ErrorTypes.TRANSIENT);
      expect(networkClassification.severity).toBe(ErrorSeverity.HIGH);
      expect(networkClassification.retryable).toBe(true);
      expect(networkClassification.reason).toBe('network_issue');
      
      // Server selection timeout
      const serverSelectionError = new Error('Server selection timed out');
      
      const serverSelectionClassification = classifyError(serverSelectionError);
      expect(serverSelectionClassification.category).toBe(ErrorCategory.CONNECTION);
      expect(serverSelectionClassification.type).toBe(ErrorTypes.TRANSIENT);
      expect(serverSelectionClassification.retryable).toBe(true);
      expect(serverSelectionClassification.reason).toBe('server_selection_timeout');
    });
    
    it('should classify transaction errors correctly', () => {
      // Transaction error
      const transactionError = new Error('Transaction error');
      transactionError.errorLabels = ['TransientTransactionError'];
      
      const transactionClassification = classifyError(transactionError);
      expect(transactionClassification.category).toBe(ErrorCategory.TRANSACTION);
      expect(transactionClassification.type).toBe(ErrorTypes.TRANSIENT);
      expect(transactionClassification.severity).toBe(ErrorSeverity.MEDIUM);
      expect(transactionClassification.retryable).toBe(true);
      expect(transactionClassification.reason).toBe('transaction_error');
    });
    
    it('should classify validation errors correctly', () => {
      // Validation error
      const validationError = new Error('validation failed');
      validationError.name = 'ValidationError';
      validationError.errors = {
        name: { message: 'Name is required' },
        email: { message: 'Invalid email format' }
      };
      
      const validationClassification = classifyError(validationError);
      expect(validationClassification.category).toBe(ErrorCategory.VALIDATION);
      expect(validationClassification.type).toBe(ErrorTypes.PERSISTENT);
      expect(validationClassification.severity).toBe(ErrorSeverity.MEDIUM);
      expect(validationClassification.retryable).toBe(false);
      expect(validationClassification.reason).toBe('validation_error');
      expect(validationClassification.validationErrors).toEqual([
        { field: 'name', message: 'Name is required' },
        { field: 'email', message: 'Invalid email format' }
      ]);
    });
    
    it('should classify unknown errors with default values', () => {
      // Unknown error
      const unknownError = new Error('Some unknown error');
      
      const unknownClassification = classifyError(unknownError);
      expect(unknownClassification.category).toBe(ErrorCategory.UNKNOWN);
      expect(unknownClassification.type).toBe(ErrorTypes.PERSISTENT);
      expect(unknownClassification.severity).toBe(ErrorSeverity.MEDIUM);
      expect(unknownClassification.retryable).toBe(false);
      expect(unknownClassification.reason).toBe('unknown_error');
    });
    
    it('should determine user impact based on severity and category', () => {
      // Critical error should impact all users
      const criticalError = new Error('Critical error');
      criticalError.code = 18; // Authentication error (critical)
      
      const criticalClassification = classifyError(criticalError);
      expect(criticalClassification.userImpact).toBe(UserImpact.ALL);
      
      // Connection error should impact a group of users
      const connectionError = new Error('Connection error');
      connectionError.code = 6;
      
      const connectionClassification = classifyError(connectionError);
      expect(connectionClassification.userImpact).toBe(UserImpact.GROUP);
      
      // Validation error should impact individual user
      const validationError = new Error('Validation error');
      validationError.code = 121;
      
      const validationClassification = classifyError(validationError);
      expect(validationClassification.userImpact).toBe(UserImpact.INDIVIDUAL);
    });
  });
  
  describe('enhanceError', () => {
    it('should add classification to error object', () => {
      const error = new Error('Test error');
      const enhancedError = enhanceError(error);
      
      expect(enhancedError.classification).toBeDefined();
      expect(enhancedError.getUserFriendlyMessage).toBeInstanceOf(Function);
      expect(enhancedError.isRetryable).toBeInstanceOf(Function);
      expect(enhancedError.getSeverity).toBeInstanceOf(Function);
      expect(enhancedError.getCategory).toBeInstanceOf(Function);
    });
    
    it('should not reclassify already classified errors', () => {
      const error = new Error('Test error');
      error.classification = { custom: true };
      
      const enhancedError = enhanceError(error);
      expect(enhancedError.classification).toEqual({ custom: true });
    });
    
    it('should add helper methods that work correctly', () => {
      const error = new Error('Test error');
      error.classification = {
        userFriendlyMessage: 'User friendly message',
        retryable: true,
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.CONNECTION
      };
      
      const enhancedError = enhanceError(error);
      
      expect(enhancedError.getUserFriendlyMessage()).toBe('User friendly message');
      expect(enhancedError.isRetryable()).toBe(true);
      expect(enhancedError.getSeverity()).toBe(ErrorSeverity.HIGH);
      expect(enhancedError.getCategory()).toBe(ErrorCategory.CONNECTION);
    });
  });
  
  describe('createError', () => {
    it('should create an error with classification', () => {
      const error = createError('Test error', {
        code: 'TEST_ERROR',
        category: ErrorCategory.BUSINESS_LOGIC,
        severity: ErrorSeverity.MEDIUM,
        retryable: false,
        metadata: { test: true }
      });
      
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.timestamp).toBeInstanceOf(Date);
      expect(error.metadata).toEqual({ test: true });
      expect(error.classification).toBeDefined();
      expect(error.classification.category).toBe(ErrorCategory.BUSINESS_LOGIC);
      expect(error.classification.severity).toBe(ErrorSeverity.MEDIUM);
      expect(error.classification.retryable).toBe(false);
    });
    
    it('should include cause if provided', () => {
      const cause = new Error('Original error');
      const error = createError('Wrapped error', { cause });
      
      expect(error.cause).toBe(cause);
    });
    
    it('should set user-friendly message based on category', () => {
      const connectionError = createError('Connection failed', {
        category: ErrorCategory.CONNECTION
      });
      
      expect(connectionError.classification.userFriendlyMessage).toBe(
        "We're having trouble connecting to the database. Please try again shortly."
      );
      
      const validationError = createError('Validation failed', {
        category: ErrorCategory.VALIDATION
      });
      
      expect(validationError.classification.userFriendlyMessage).toBe(
        "The information provided contains errors. Please check your input and try again."
      );
    });
  });
  
  describe('getHandlingStrategy', () => {
    it('should return alert_and_report for critical errors', () => {
      const error = createError('Critical error', {
        severity: ErrorSeverity.CRITICAL
      });
      
      expect(getHandlingStrategy(error)).toBe('alert_and_report');
    });
    
    it('should return retry_with_backoff for transient errors', () => {
      const error = createError('Transient error', {
        category: ErrorCategory.CONNECTION,
        retryable: true
      });
      
      error.classification.type = ErrorTypes.TRANSIENT;
      
      expect(getHandlingStrategy(error)).toBe('retry_with_backoff');
    });
    
    it('should return return_validation_details for validation errors', () => {
      const error = createError('Validation error', {
        category: ErrorCategory.VALIDATION
      });
      
      expect(getHandlingStrategy(error)).toBe('return_validation_details');
    });
    
    it('should return prompt_authentication for authentication errors', () => {
      const error = createError('Authentication error', {
        category: ErrorCategory.AUTHENTICATION
      });
      
      expect(getHandlingStrategy(error)).toBe('prompt_authentication');
    });
    
    it('should return log_and_report for other errors', () => {
      const error = createError('Unknown error', {
        category: ErrorCategory.UNKNOWN
      });
      
      expect(getHandlingStrategy(error)).toBe('log_and_report');
    });
  });
  
  describe('logClassifiedError', () => {
    it('should log errors with appropriate severity level', () => {
      // Mock console methods
      const originalConsoleError = console.error;
      const originalConsoleWarn = console.warn;
      const originalConsoleInfo = console.info;
      const originalConsoleLog = console.log;
      
      console.error = vi.fn();
      console.warn = vi.fn();
      console.info = vi.fn();
      console.log = vi.fn();
      
      try {
        // Critical error
        const criticalError = createError('Critical error', {
          severity: ErrorSeverity.CRITICAL
        });
        
        logClassifiedError(criticalError);
        expect(console.error).toHaveBeenCalledWith(
          'CRITICAL ERROR:',
          expect.stringContaining('Critical error')
        );
        
        // High severity error
        const highError = createError('High severity error', {
          severity: ErrorSeverity.HIGH
        });
        
        logClassifiedError(highError);
        expect(console.error).toHaveBeenCalledWith(
          'HIGH SEVERITY ERROR:',
          expect.stringContaining('High severity error')
        );
        
        // Medium severity error
        const mediumError = createError('Medium severity error', {
          severity: ErrorSeverity.MEDIUM
        });
        
        logClassifiedError(mediumError);
        expect(console.warn).toHaveBeenCalledWith(
          'ERROR:',
          expect.stringContaining('Medium severity error')
        );
        
        // Low severity error
        const lowError = createError('Low severity error', {
          severity: ErrorSeverity.LOW
        });
        
        logClassifiedError(lowError);
        expect(console.info).toHaveBeenCalledWith(
          'MINOR ERROR:',
          expect.stringContaining('Low severity error')
        );
      } finally {
        // Restore console methods
        console.error = originalConsoleError;
        console.warn = originalConsoleWarn;
        console.info = originalConsoleInfo;
        console.log = originalConsoleLog;
      }
    });
    
    it('should include context information in log', () => {
      // Mock console.error
      const originalConsoleError = console.error;
      console.error = vi.fn();
      
      try {
        const error = createError('Test error', {
          severity: ErrorSeverity.CRITICAL
        });
        
        const context = {
          userId: '123',
          operation: 'test_operation',
          metadata: { test: true }
        };
        
        logClassifiedError(error, context);
        
        expect(console.error).toHaveBeenCalledWith(
          'CRITICAL ERROR:',
          expect.stringContaining('"userId":"123"')
        );
        expect(console.error).toHaveBeenCalledWith(
          'CRITICAL ERROR:',
          expect.stringContaining('"operation":"test_operation"')
        );
      } finally {
        // Restore console.error
        console.error = originalConsoleError;
      }
    });
  });
});