/**
 * Comprehensive error handling middleware for API routes
 * Provides consistent error responses and logging
 */

const { enhanceError, logClassifiedError } = require('../utils/errorClassification');

/**
 * Global error handling middleware
 * @param {Error} err - The error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const globalErrorHandler = (err, req, res, next) => {
  // Skip if headers already sent
  if (res.headersSent) {
    return next(err);
  }

  // Enhance error with classification
  const enhancedError = enhanceError(err);
  const classification = enhancedError.classification;

  // Log the error with request context
  logClassifiedError(enhancedError, {
    source: 'api',
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userId: req.user ? req.user.userId : 'anonymous',
    userAgent: req.get('User-Agent')
  });

  // Determine HTTP status code
  let statusCode = 500;
  
  switch (classification.category) {
    case 'authentication':
      statusCode = 401;
      break;
    case 'authorization':
      statusCode = 403;
      break;
    case 'validation':
    case 'input':
      statusCode = 400;
      break;
    case 'resource':
      statusCode = 503;
      break;
    case 'connection':
      statusCode = classification.severity === 'critical' ? 503 : 500;
      break;
    default:
      statusCode = 500;
  }

  // Create response body
  const response = {
    error: {
      message: classification.userFriendlyMessage,
      code: classification.code || 'error',
      status: statusCode
    }
  };

  // Add validation details if available
  if (classification.category === 'validation' && classification.validationErrors) {
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

  res.status(statusCode).json(response);
};

/**
 * Async route wrapper to catch errors
 * @param {Function} fn - Async route handler
 * @returns {Function} Wrapped route handler
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Database timeout handler
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Function} Middleware function
 */
const timeoutHandler = (timeout = 10000) => {
  return (req, res, next) => {
    // Set timeout for the request
    req.setTimeout(timeout, () => {
      const error = new Error('Request timeout');
      error.code = 'TIMEOUT';
      error.statusCode = 504;
      next(error);
    });
    
    next();
  };
};

/**
 * Validation error handler for express-validator
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const validationErrorHandler = (req, res, next) => {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const validationError = new Error('Validation failed');
    validationError.code = 'VALIDATION_ERROR';
    validationError.statusCode = 400;
    validationError.validationErrors = errors.array();
    return next(validationError);
  }
  
  next();
};

/**
 * Rate limit error handler
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const rateLimitErrorHandler = (req, res, next) => {
  if (req.rateLimit && req.rateLimit.remaining === 0) {
    const error = new Error('Too many requests');
    error.code = 'RATE_LIMIT_EXCEEDED';
    error.statusCode = 429;
    error.retryAfter = Math.ceil(req.rateLimit.resetTime / 1000);
    return next(error);
  }
  
  next();
};

/**
 * Not found handler for undefined routes
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const notFoundHandler = (req, res, next) => {
  const error = new Error(`Route not found: ${req.method} ${req.path}`);
  error.code = 'ROUTE_NOT_FOUND';
  error.statusCode = 404;
  next(error);
};

/**
 * Database connection error handler
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const databaseErrorHandler = (req, res, next) => {
  const mongoose = require('mongoose');
  
  if (mongoose.connection.readyState !== 1) {
    const error = new Error('Database connection unavailable');
    error.code = 'DATABASE_UNAVAILABLE';
    error.statusCode = 503;
    return next(error);
  }
  
  next();
};

module.exports = {
  globalErrorHandler,
  asyncHandler,
  timeoutHandler,
  validationErrorHandler,
  rateLimitErrorHandler,
  notFoundHandler,
  databaseErrorHandler
};