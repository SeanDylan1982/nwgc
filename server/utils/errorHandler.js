/**
 * errorHandler.js
 * 
 * Comprehensive error handling utilities that implement appropriate strategies
 * based on error classification. This module provides standardized error handling
 * across the application with detailed logging and user feedback.
 */

const { 
  ErrorSeverity, 
  ErrorCategory, 
  ErrorTypes,
  classifyError, 
  enhanceError,
  logClassifiedError,
  getHandlingStrategy
} = require('./errorClassification');

/**
 * Handles database errors with appropriate strategies based on classification
 * @param {Error} error - The error to handle
 * @param {Object} options - Handler options
 * @param {boolean} options.shouldThrow - Whether to throw the error after handling
 * @param {Function} options.onCritical - Callback for critical errors
 * @param {Object} options.context - Additional context for logging
 * @returns {Object} Handling result with error details and user message
 */
function handleDatabaseError(error, options = {}) {
  const {
    shouldThrow = true,
    onCritical = null,
    context = {},
    defaultMessage = 'Database operation failed',
    defaultStatusCode = 500
  } = options;
  
  // Ensure error has classification
  const enhancedError = enhanceError(error);
  const classification = enhancedError.classification;
  
  // Log the error with context
  logClassifiedError(enhancedError, {
    source: 'database',
    ...context
  });
  
  // Handle based on strategy
  const strategy = getHandlingStrategy(enhancedError);
  let result = {
    handled: true,
    error: enhancedError,
    userMessage: classification.userFriendlyMessage,
    retry: false,
    strategy
  };
  
  switch (strategy) {
    case 'alert_and_report':
      // For critical errors, we might want to alert operations team
      if (onCritical && typeof onCritical === 'function') {
        onCritical(enhancedError);
      }
      result.retry = false;
      break;
      
    case 'retry_with_backoff':
      // For transient errors, suggest retry
      result.retry = true;
      result.backoffMs = 1000; // Default backoff
      break;
      
    case 'return_validation_details':
      // For validation errors, include details
      result.validationErrors = classification.validationErrors || [];
      result.retry = false;
      break;
      
    case 'prompt_authentication':
      // For auth errors, suggest re-authentication
      result.requiresAuthentication = true;
      result.retry = false;
      break;
      
    default:
      // Default handling
      result.retry = false;
  }
  
  // Create appropriate response
  const { statusCode, body } = createErrorResponse(enhancedError, defaultMessage, defaultStatusCode);
  
  // Throw if requested (for use in catch blocks)
  if (shouldThrow) {
    throw enhancedError;
  }
  
  return {
    ...result,
    statusCode,
    errorResponse: body
  };
}

/**
 * Creates an appropriate HTTP response for an error
 * @param {Error} error - The error to create a response for
 * @param {string} defaultMessage - Default message to use if none is available
 * @param {number} defaultStatusCode - Default status code to use if none is determined
 * @returns {Object} HTTP response object with status and body
 */
function createErrorResponse(error, defaultMessage = 'An error occurred', defaultStatusCode = 500) {
  // Ensure error has classification
  const enhancedError = enhanceError(error);
  const classification = enhancedError.classification;
  
  // Determine HTTP status code based on error category
  let statusCode = defaultStatusCode; // Default to server error
  
  switch (classification.category) {
    case ErrorCategory.AUTHENTICATION:
      statusCode = 401;
      break;
    case ErrorCategory.AUTHORIZATION:
      statusCode = 403;
      break;
    case ErrorCategory.VALIDATION:
    case ErrorCategory.INPUT:
      statusCode = 400;
      break;
    case ErrorCategory.RESOURCE:
      statusCode = 503;
      break;
    case ErrorCategory.CONNECTION:
      statusCode = classification.severity === ErrorSeverity.CRITICAL ? 503 : 500;
      break;
    default:
      statusCode = defaultStatusCode;
  }
  
  // Create response body
  const response = {
    error: {
      message: classification.userFriendlyMessage || defaultMessage,
      code: classification.code || 'error',
      status: statusCode
    }
  };
  
  // Add validation details if available
  if (classification.category === ErrorCategory.VALIDATION && classification.validationErrors) {
    response.error.details = classification.validationErrors;
  }
  
  // Add retry information for transient errors
  if (classification.retryable) {
    response.error.retryable = true;
    response.error.retryAfter = 1; // Seconds to wait before retry
  }
  
  // In development, include more details
  if (process.env.NODE_ENV === 'development') {
    response.error.debug = {
      stack: enhancedError.stack,
      classification: {
        type: classification.type,
        category: classification.category,
        severity: classification.severity,
        reason: classification.reason
      }
    };
  }
  
  return {
    statusCode,
    body: response
  };
}

/**
 * Express middleware for handling errors
 * @param {Error} err - The error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function errorMiddleware(err, req, res, next) {
  // Skip if headers already sent
  if (res.headersSent) {
    return next(err);
  }
  
  // Ensure error has classification
  const enhancedError = enhanceError(err);
  
  // Log the error with request context
  logClassifiedError(enhancedError, {
    source: 'api',
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userId: req.user ? req.user.id : 'anonymous'
  });
  
  // Create appropriate response
  const { statusCode, body } = createErrorResponse(enhancedError);
  
  // Send response
  res.status(statusCode).json(body);
}

/**
 * Wraps an async route handler with error handling
 * @param {Function} handler - Async route handler function
 * @returns {Function} Wrapped handler with error handling
 */
function asyncHandler(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(enhanceError(error));
    }
  };
}

/**
 * Handles errors in socket.io context
 * @param {Error} error - The error to handle
 * @param {Object} socket - Socket.io socket object
 * @param {Object} options - Additional options
 */
function handleSocketError(error, socket, options = {}) {
  const enhancedError = enhanceError(error);
  const classification = enhancedError.classification;
  
  // Log the error
  logClassifiedError(enhancedError, {
    source: 'socket',
    socketId: socket.id,
    userId: socket.user ? socket.user.id : 'anonymous',
    ...options.context
  });
  
  // Emit appropriate error to client
  socket.emit('error', {
    message: classification.userFriendlyMessage,
    code: classification.code || 'socket_error',
    retryable: classification.retryable
  });
  
  // For critical errors, we might want to disconnect the socket
  if (classification.severity === ErrorSeverity.CRITICAL) {
    socket.disconnect(true);
  }
}

module.exports = {
  handleDatabaseError,
  createErrorResponse,
  errorMiddleware,
  asyncHandler,
  handleSocketError
};