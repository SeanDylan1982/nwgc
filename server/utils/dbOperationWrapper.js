/**
 * dbOperationWrapper.js
 * 
 * Comprehensive utility for wrapping database operations with retry logic,
 * timeout handling, and proper error propagation and logging.
 * 
 * This module provides robust error handling and retry mechanisms for all
 * database operations, ensuring maximum reliability even during network
 * fluctuations or temporary database unavailability.
 */

const mongoose = require('mongoose');
const { dbService } = require('../config/database');
const {
  withRetry: retryWithBackoff,
  executeWithTimeout
} = require('./retryUtils');

const {
  classifyError,
  enhanceError,
  logClassifiedError,
  ErrorSeverity
} = require('./errorClassification');

const {
  handleDatabaseError
} = require('./errorHandler');

// Configure logging
const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug'
};

/**
 * Enhanced logging function that includes operation context
 * @param {string} level - Log level (error, warn, info, debug)
 * @param {string} message - Log message
 * @param {Object} context - Additional context information
 * @param {Error} [error] - Optional error object
 */
function logWithContext(level, message, context = {}, error = null) {
  const timestamp = new Date().toISOString();
  const logData = {
    timestamp,
    level,
    message,
    ...context
  };
  
  if (error) {
    // Use our enhanced error classification
    const enhancedErr = enhanceError(error);
    
    logData.error = {
      name: enhancedErr.name,
      message: enhancedErr.message,
      stack: enhancedErr.stack,
      code: enhancedErr.code
    };
    
    if (enhancedErr.classification) {
      logData.errorClassification = enhancedErr.classification;
    }
  }
  
  // Use appropriate console method based on level
  switch (level) {
    case LOG_LEVELS.ERROR:
      console.error(JSON.stringify(logData));
      break;
    case LOG_LEVELS.WARN:
      console.warn(JSON.stringify(logData));
      break;
    case LOG_LEVELS.INFO:
      console.info(JSON.stringify(logData));
      break;
    case LOG_LEVELS.DEBUG:
      console.debug(JSON.stringify(logData));
      break;
    default:
      console.log(JSON.stringify(logData));
  }
}

/**
 * Wraps a database operation with retry logic and connection management
 * @param {Function} operation - The database operation to execute
 * @param {Object} options - Options for the retry mechanism
 * @param {number} options.maxRetries - Maximum number of retry attempts
 * @param {number} options.initialDelayMs - Initial delay before first retry in milliseconds
 * @param {number} options.maxDelayMs - Maximum delay between retries in milliseconds
 * @param {Function} options.shouldRetry - Custom function to determine if operation should be retried
 * @param {Function} options.onRetry - Callback function executed before each retry
 * @param {boolean} options.logRetries - Whether to log retry attempts
 * @param {string} options.operationName - Name of the operation for logging purposes
 * @returns {Promise<*>} - Result of the database operation
 */
async function withRetry(operation, options = {}) {
  const {
    operationName = 'Database operation',
    ...retryOptions
  } = options;
  
  const context = {
    operation: operationName,
    connectionState: dbService ? dbService.isConnected : 'unknown'
  };
  
  return retryWithBackoff(operation, {
    ...retryOptions,
    onRetry: async (error, attempt, delay) => {
      // Enhanced logging with context
      logWithContext(
        LOG_LEVELS.WARN,
        `${operationName} failed (attempt ${attempt}). Retrying in ${Math.round(delay)}ms...`,
        {
          ...context,
          attempt,
          delay: Math.round(delay),
          errorType: error.classification ? error.classification.type : 'unknown'
        },
        error
      );
      
      // Check database connection before retry
      if (dbService && !dbService.isConnected) {
        try {
          logWithContext(LOG_LEVELS.INFO, 'Attempting to reconnect to database before retry...', context);
          await dbService.connect();
        } catch (reconnectError) {
          logWithContext(
            LOG_LEVELS.ERROR,
            'Failed to reconnect to database before retry',
            context,
            reconnectError
          );
        }
      }
      
      // Call the user-provided onRetry if it exists
      if (retryOptions.onRetry) {
        await retryOptions.onRetry(error, attempt, delay);
      }
    }
  });
}

/**
 * Wraps a database query with timeout, retry logic, and comprehensive error handling
 * @param {Function} queryFn - The database query function to execute
 * @param {Object} options - Options for the query execution
 * @param {number} options.timeout - Timeout in milliseconds
 * @param {Object} options.retryOptions - Options for retry logic
 * @param {string} options.errorMessage - Custom error message prefix
 * @param {string} options.operationName - Name of the operation for logging purposes
 * @param {Object} options.metadata - Additional metadata for logging
 * @param {boolean} options.criticalOperation - Whether this is a critical operation that should alert on failure
 * @returns {Promise<*>} - Result of the database query
 */
async function executeQuery(queryFn, options = {}) {
  const {
    timeout = 30000,
    retryOptions = {},
    errorMessage = 'Database query failed',
    operationName = 'Database query',
    metadata = {},
    criticalOperation = false
  } = options;
  
  const startTime = Date.now();
  const context = {
    operation: operationName,
    timeout,
    metadata,
    critical: criticalOperation,
    connectionState: dbService ? dbService.isConnected : 'unknown'
  };
  
  try {
    // Log operation start for debugging
    if (process.env.NODE_ENV === 'development') {
      logWithContext(LOG_LEVELS.DEBUG, `${operationName} started`, context);
    }
    
    // Execute operation with timeout and retry logic
    const result = await executeWithTimeout(queryFn, {
      timeout,
      retryOptions: {
        ...retryOptions,
        onRetry: async (error, attempt, delay) => {
          // Enhanced logging with context
          logWithContext(
            LOG_LEVELS.WARN,
            `${operationName} failed (attempt ${attempt}). Retrying in ${Math.round(delay)}ms...`,
            {
              ...context,
              attempt,
              delay: Math.round(delay),
              errorType: error.classification ? error.classification.type : 'unknown'
            },
            error
          );
          
          // Check database connection before retry
          if (dbService && !dbService.isConnected) {
            try {
              logWithContext(LOG_LEVELS.INFO, 'Attempting to reconnect to database before retry...', context);
              await dbService.connect();
            } catch (reconnectError) {
              logWithContext(
                LOG_LEVELS.ERROR,
                'Failed to reconnect to database before retry',
                context,
                reconnectError
              );
            }
          }
          
          // Call the user-provided onRetry if it exists
          if (retryOptions.onRetry) {
            await retryOptions.onRetry(error, attempt, delay);
          }
        }
      },
      errorMessage
    });
    
    // Log successful completion with timing information
    const duration = Date.now() - startTime;
    if (duration > 1000) {
      // Log slow operations as warnings
      logWithContext(
        LOG_LEVELS.WARN,
        `${operationName} completed slowly`,
        {
          ...context,
          duration,
          slow: true
        }
      );
    } else if (process.env.NODE_ENV === 'development') {
      // Log normal operations as debug in development
      logWithContext(
        LOG_LEVELS.DEBUG,
        `${operationName} completed successfully`,
        {
          ...context,
          duration
        }
      );
    }
    
    return result;
  } catch (error) {
    // Calculate operation duration
    const duration = Date.now() - startTime;
    
    // Use our enhanced error classification system
    const enhancedError = enhanceError(error);
    enhancedError.duration = duration;
    enhancedError.operationName = operationName;
    enhancedError.metadata = { ...enhancedError.metadata, ...metadata };
    enhancedError.isDbError = true;
    enhancedError.connectionState = dbService ? dbService.isConnected : 'unknown';
    
    // Use our comprehensive error logging
    logClassifiedError(enhancedError, {
      ...context,
      duration,
      operationName,
      criticalOperation
    });
    
    // For critical operations, we might want to alert or take additional actions
    if (criticalOperation) {
      // Handle critical errors with special attention
      handleDatabaseError(enhancedError, {
        shouldThrow: false,
        onCritical: (err) => {
          // In a real implementation, this might send alerts or notifications
          console.error(`CRITICAL DATABASE OPERATION FAILED: ${operationName}`, {
            error: err.message,
            severity: err.classification.severity,
            category: err.classification.category
          });
        },
        context: {
          ...context,
          criticalOperation: true
        }
      });
    }
    
    throw enhancedError;
  }
}

/**
 * Creates a wrapped version of a Mongoose model method with retry and timeout
 * @param {mongoose.Model} model - The Mongoose model
 * @param {string} methodName - The method name to wrap
 * @param {Object} options - Options for executeQuery
 * @returns {Function} - Wrapped function with retry and timeout
 */
function wrapModelMethod(model, methodName, options = {}) {
  const originalMethod = model[methodName];
  
  if (typeof originalMethod !== 'function') {
    throw new Error(`${methodName} is not a function on the provided model`);
  }
  
  return async function(...args) {
    const operationName = options.operationName || `${model.modelName}.${methodName}`;
    
    return executeQuery(
      () => originalMethod.apply(model, args),
      {
        ...options,
        operationName
      }
    );
  };
}

/**
 * Wraps a database transaction with retry logic and proper error handling
 * @param {Function} transactionFn - Function that executes operations within a transaction
 * @param {Object} options - Options for the transaction
 * @returns {Promise<*>} - Result of the transaction
 */
async function withTransaction(transactionFn, options = {}) {
  const {
    timeout = 60000,
    retryOptions = {},
    errorMessage = 'Database transaction failed',
    operationName = 'Database transaction',
    metadata = {}
  } = options;
  
  return executeQuery(
    async () => {
      const session = await mongoose.startSession();
      try {
        session.startTransaction();
        const result = await transactionFn(session);
        await session.commitTransaction();
        return result;
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }
    },
    {
      timeout,
      retryOptions: {
        ...retryOptions,
        // Default shouldRetry for transactions
        shouldRetry: retryOptions.shouldRetry || ((error) => {
          // Retry on transaction-specific errors
          return error.errorLabels && (
            error.errorLabels.includes('TransientTransactionError') ||
            error.errorLabels.includes('UnknownTransactionCommitResult')
          );
        })
      },
      errorMessage,
      operationName,
      metadata
    }
  );
}

/**
 * Checks if the database is available and responsive
 * @param {Object} options - Options for the health check
 * @returns {Promise<Object>} - Health check result
 */
async function checkDatabaseHealth(options = {}) {
  const {
    timeout = 5000,
    operationName = 'Database health check'
  } = options;
  
  try {
    const startTime = Date.now();
    
    // Execute a simple ping operation
    await executeQuery(
      async () => {
        if (!mongoose.connection || mongoose.connection.readyState !== 1) {
          throw new Error('Database not connected');
        }
        return await mongoose.connection.db.admin().ping();
      },
      {
        timeout,
        operationName,
        retryOptions: {
          maxRetries: 1,
          initialDelayMs: 100
        }
      }
    );
    
    const responseTime = Date.now() - startTime;
    
    // Get connection stats from the service
    const stats = dbService ? dbService.getConnectionStats() : { isConnected: mongoose.connection.readyState === 1 };
    
    return {
      status: 'healthy',
      responseTime,
      ...stats
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      connectionState: dbService ? dbService.isConnected : 'unknown',
      readyState: mongoose.connection ? mongoose.connection.readyState : 0
    };
  }
}

module.exports = {
  withRetry,
  executeQuery,
  wrapModelMethod,
  withTransaction,
  checkDatabaseHealth,
  classifyError,
  LOG_LEVELS,
  logWithContext
};