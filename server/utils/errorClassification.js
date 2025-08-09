/**
 * errorClassification.js
 * 
 * Comprehensive error classification system for MongoDB and application errors.
 * This module provides detailed error categorization by type and severity,
 * appropriate handling strategies, and enhanced logging capabilities.
 */

const mongoose = require('mongoose');

/**
 * Error severity levels
 * @enum {string}
 */
const ErrorSeverity = {
  CRITICAL: 'critical',   // Requires immediate attention, system functionality severely impacted
  HIGH: 'high',           // Significant impact on functionality, requires prompt attention
  MEDIUM: 'medium',       // Moderate impact, should be addressed soon
  LOW: 'low',             // Minor impact, can be addressed in regular maintenance
  INFO: 'info'            // Informational only, no actual error
};

/**
 * Error categories for better organization and handling
 * @enum {string}
 */
const ErrorCategory = {
  // Database related errors
  CONNECTION: 'connection',       // Database connection issues
  QUERY: 'query',                 // Query execution errors
  TRANSACTION: 'transaction',     // Transaction related errors
  VALIDATION: 'validation',       // Data validation errors
  SCHEMA: 'schema',               // Schema related errors
  
  // Application errors
  AUTHENTICATION: 'authentication', // Auth related errors
  AUTHORIZATION: 'authorization',   // Permission related errors
  INPUT: 'input',                   // User input errors
  BUSINESS_LOGIC: 'business_logic', // Business rule violations
  
  // System errors
  NETWORK: 'network',             // Network related issues
  RESOURCE: 'resource',           // Resource exhaustion (memory, CPU, etc.)
  CONFIGURATION: 'configuration', // Configuration errors
  DEPENDENCY: 'dependency',       // External dependency failures
  
  // Other
  UNKNOWN: 'unknown'              // Unclassified errors
};

/**
 * Error types with more specific categorization
 * @enum {string}
 */
const ErrorTypes = {
  // Transient errors (temporary, can be retried)
  TRANSIENT: 'transient',
  
  // Persistent errors (won't be resolved by retrying)
  PERSISTENT: 'persistent',
  
  // Fatal errors (require immediate attention)
  FATAL: 'fatal'
};

/**
 * User impact levels for errors
 * @enum {string}
 */
const UserImpact = {
  NONE: 'none',           // No direct user impact
  INDIVIDUAL: 'individual', // Affects single user
  GROUP: 'group',         // Affects group of users
  ALL: 'all'              // Affects all users
};

/**
 * MongoDB specific error codes mapped to our classification system
 */
const MONGODB_ERROR_CODES = {
  // Connection errors
  6: { category: ErrorCategory.CONNECTION, type: ErrorTypes.TRANSIENT, severity: ErrorSeverity.HIGH, retryable: true },
  7: { category: ErrorCategory.CONNECTION, type: ErrorTypes.TRANSIENT, severity: ErrorSeverity.HIGH, retryable: true },
  89: { category: ErrorCategory.CONNECTION, type: ErrorTypes.TRANSIENT, severity: ErrorSeverity.HIGH, retryable: true },
  91: { category: ErrorCategory.CONNECTION, type: ErrorTypes.TRANSIENT, severity: ErrorSeverity.HIGH, retryable: true },
  9001: { category: ErrorCategory.CONNECTION, type: ErrorTypes.TRANSIENT, severity: ErrorSeverity.HIGH, retryable: true },
  
  // Authentication errors
  18: { category: ErrorCategory.AUTHENTICATION, type: ErrorTypes.FATAL, severity: ErrorSeverity.CRITICAL, retryable: false },
  
  // Validation errors
  121: { category: ErrorCategory.VALIDATION, type: ErrorTypes.PERSISTENT, severity: ErrorSeverity.MEDIUM, retryable: false },
  
  // Duplicate key errors
  11000: { category: ErrorCategory.VALIDATION, type: ErrorTypes.PERSISTENT, severity: ErrorSeverity.MEDIUM, retryable: false },
  
  // Transaction errors
  251: { category: ErrorCategory.TRANSACTION, type: ErrorTypes.TRANSIENT, severity: ErrorSeverity.MEDIUM, retryable: true },
  
  // Server state errors
  10107: { category: ErrorCategory.CONNECTION, type: ErrorTypes.TRANSIENT, severity: ErrorSeverity.HIGH, retryable: true },
  11600: { category: ErrorCategory.CONNECTION, type: ErrorTypes.TRANSIENT, severity: ErrorSeverity.HIGH, retryable: true },
  11602: { category: ErrorCategory.CONNECTION, type: ErrorTypes.TRANSIENT, severity: ErrorSeverity.HIGH, retryable: true },
  189: { category: ErrorCategory.CONNECTION, type: ErrorTypes.TRANSIENT, severity: ErrorSeverity.HIGH, retryable: true },
  
  // Resource errors
  50: { category: ErrorCategory.RESOURCE, type: ErrorTypes.TRANSIENT, severity: ErrorSeverity.HIGH, retryable: true },
  262: { category: ErrorCategory.RESOURCE, type: ErrorTypes.TRANSIENT, severity: ErrorSeverity.HIGH, retryable: true },
  
  // Write conflicts
  112: { category: ErrorCategory.TRANSACTION, type: ErrorTypes.TRANSIENT, severity: ErrorSeverity.MEDIUM, retryable: true },
  
  // Operation errors
  8000: { category: ErrorCategory.TRANSACTION, type: ErrorTypes.FATAL, severity: ErrorSeverity.HIGH, retryable: false },
};

/**
 * User-friendly error messages for common error scenarios
 */
const USER_FRIENDLY_MESSAGES = {
  // Connection errors
  [ErrorCategory.CONNECTION]: {
    default: "We're having trouble connecting to the database. Please try again shortly.",
    [ErrorSeverity.CRITICAL]: "We're experiencing database connectivity issues. Our team has been notified."
  },
  
  // Authentication errors
  [ErrorCategory.AUTHENTICATION]: {
    default: "Authentication failed. Please check your credentials and try again.",
    [ErrorSeverity.CRITICAL]: "Your account has been locked due to security concerns. Please contact support."
  },
  
  // Validation errors
  [ErrorCategory.VALIDATION]: {
    default: "The information provided contains errors. Please check your input and try again.",
    duplicate_key: "This information already exists in our system. Please use unique values."
  },
  
  // Transaction errors
  [ErrorCategory.TRANSACTION]: {
    default: "Your request couldn't be completed. Please try again.",
    [ErrorSeverity.HIGH]: "We couldn't process your transaction. Please try again or contact support."
  },
  
  // Default fallback
  default: "Something went wrong. Please try again later."
};

/**
 * Classifies an error with detailed information about type, severity, and handling strategy
 * @param {Error} error - The error to classify
 * @returns {Object} Comprehensive classification details
 */
function classifyError(error) {
  // Default classification
  let classification = {
    type: ErrorTypes.PERSISTENT,
    category: ErrorCategory.UNKNOWN,
    severity: ErrorSeverity.MEDIUM,
    retryable: false,
    userImpact: UserImpact.INDIVIDUAL,
    message: error.message,
    code: error.code || 'unknown',
    reason: 'unknown_error',
    timestamp: new Date(),
    userFriendlyMessage: USER_FRIENDLY_MESSAGES.default,
    handlingStrategy: 'log_and_report'
  };

  // Check for MongoDB specific error codes
  if (error.code && MONGODB_ERROR_CODES[error.code]) {
    const codeInfo = MONGODB_ERROR_CODES[error.code];
    classification.type = codeInfo.type;
    classification.category = codeInfo.category;
    classification.severity = codeInfo.severity;
    classification.retryable = codeInfo.retryable;
    classification.reason = `mongodb_error_${error.code}`;
    
    // Set user-friendly message based on category and severity
    if (USER_FRIENDLY_MESSAGES[codeInfo.category]) {
      if (USER_FRIENDLY_MESSAGES[codeInfo.category][codeInfo.severity]) {
        classification.userFriendlyMessage = USER_FRIENDLY_MESSAGES[codeInfo.category][codeInfo.severity];
      } else {
        classification.userFriendlyMessage = USER_FRIENDLY_MESSAGES[codeInfo.category].default;
      }
    }
  }
  // Network and connection errors
  else if (
    error.name === 'MongoNetworkError' ||
    error.name === 'MongoTimeoutError' ||
    error.message.includes('connection timed out') ||
    error.message.includes('socket timeout') ||
    error.message.includes('network error') ||
    error.message.includes('connection closed')
  ) {
    classification.type = ErrorTypes.TRANSIENT;
    classification.category = ErrorCategory.CONNECTION;
    classification.severity = ErrorSeverity.HIGH;
    classification.retryable = true;
    classification.reason = 'network_issue';
    classification.userFriendlyMessage = USER_FRIENDLY_MESSAGES[ErrorCategory.CONNECTION].default;
    classification.handlingStrategy = 'retry_with_backoff';
  }
  // Server selection errors
  else if (error.message.includes('Server selection timed out')) {
    classification.type = ErrorTypes.TRANSIENT;
    classification.category = ErrorCategory.CONNECTION;
    classification.severity = ErrorSeverity.HIGH;
    classification.retryable = true;
    classification.reason = 'server_selection_timeout';
    classification.userFriendlyMessage = USER_FRIENDLY_MESSAGES[ErrorCategory.CONNECTION].default;
    classification.handlingStrategy = 'retry_with_backoff';
  }
  // Transaction errors
  else if (error.errorLabels && (
    error.errorLabels.includes('TransientTransactionError') ||
    error.errorLabels.includes('UnknownTransactionCommitResult')
  )) {
    classification.type = ErrorTypes.TRANSIENT;
    classification.category = ErrorCategory.TRANSACTION;
    classification.severity = ErrorSeverity.MEDIUM;
    classification.retryable = true;
    classification.reason = 'transaction_error';
    classification.userFriendlyMessage = USER_FRIENDLY_MESSAGES[ErrorCategory.TRANSACTION].default;
    classification.handlingStrategy = 'retry_transaction';
  }
  // Authentication errors
  else if (
    error.message.includes('authentication failed') ||
    error.message.includes('not authorized')
  ) {
    classification.type = ErrorTypes.FATAL;
    classification.category = ErrorCategory.AUTHENTICATION;
    classification.severity = ErrorSeverity.CRITICAL;
    classification.retryable = false;
    classification.reason = 'authentication_error';
    classification.userFriendlyMessage = USER_FRIENDLY_MESSAGES[ErrorCategory.AUTHENTICATION].default;
    classification.handlingStrategy = 'alert_and_report';
  }
  // Validation errors
  else if (
    error.name === 'ValidationError' ||
    error.name === 'CastError' ||
    error.message.includes('validation failed')
  ) {
    classification.type = ErrorTypes.PERSISTENT;
    classification.category = ErrorCategory.VALIDATION;
    classification.severity = ErrorSeverity.MEDIUM;
    classification.retryable = false;
    classification.reason = 'validation_error';
    classification.userFriendlyMessage = USER_FRIENDLY_MESSAGES[ErrorCategory.VALIDATION].default;
    classification.handlingStrategy = 'return_validation_details';
    
    // Extract validation details if available
    if (error.errors) {
      classification.validationErrors = Object.keys(error.errors).map(field => ({
        field,
        message: error.errors[field].message
      }));
    }
  }
  // Duplicate key errors
  else if (error.name === 'MongoServerError' && error.code === 11000) {
    classification.type = ErrorTypes.PERSISTENT;
    classification.category = ErrorCategory.VALIDATION;
    classification.severity = ErrorSeverity.MEDIUM;
    classification.retryable = false;
    classification.reason = 'duplicate_key';
    classification.userFriendlyMessage = USER_FRIENDLY_MESSAGES[ErrorCategory.VALIDATION].duplicate_key;
    classification.handlingStrategy = 'return_validation_error';
    
    // Extract the duplicate key field if possible
    try {
      const keyPattern = error.keyPattern ? Object.keys(error.keyPattern)[0] : 'unknown';
      classification.duplicateKey = keyPattern;
    } catch (e) {
      // Ignore extraction errors
    }
  }

  // Determine user impact based on severity and category
  if (classification.severity === ErrorSeverity.CRITICAL) {
    classification.userImpact = UserImpact.ALL;
  } else if (classification.category === ErrorCategory.CONNECTION) {
    classification.userImpact = UserImpact.GROUP;
  }

  return classification;
}

/**
 * Enhances an error with classification information
 * @param {Error} error - The error to enhance
 * @returns {Error} The enhanced error
 */
function enhanceError(error) {
  if (!error.classification) {
    error.classification = classifyError(error);
  }
  
  error.getUserFriendlyMessage = function() {
    return this.classification.userFriendlyMessage;
  };
  
  error.isRetryable = function() {
    return this.classification.retryable;
  };
  
  error.getSeverity = function() {
    return this.classification.severity;
  };
  
  error.getCategory = function() {
    return this.classification.category;
  };
  
  return error;
}

/**
 * Creates a standardized error object with classification
 * @param {string} message - Error message
 * @param {Object} options - Additional error options
 * @returns {Error} Classified error object
 */
function createError(message, options = {}) {
  const {
    code,
    category = ErrorCategory.UNKNOWN,
    severity = ErrorSeverity.MEDIUM,
    retryable = false,
    cause = null,
    metadata = {}
  } = options;
  
  const error = new Error(message);
  error.code = code;
  error.timestamp = new Date();
  error.metadata = metadata;
  
  if (cause) {
    error.cause = cause;
  }
  
  // Create initial classification
  error.classification = {
    type: retryable ? ErrorTypes.TRANSIENT : ErrorTypes.PERSISTENT,
    category,
    severity,
    retryable,
    userImpact: UserImpact.INDIVIDUAL,
    message,
    code: code || 'unknown',
    reason: category,
    timestamp: new Date(),
    userFriendlyMessage: USER_FRIENDLY_MESSAGES[category]?.default || USER_FRIENDLY_MESSAGES.default,
    handlingStrategy: severity === ErrorSeverity.CRITICAL ? 'alert_and_report' : 'log_and_report'
  };
  
  return enhanceError(error);
}

/**
 * Determines the appropriate handling strategy for an error
 * @param {Error} error - The error to handle
 * @returns {string} Handling strategy recommendation
 */
function getHandlingStrategy(error) {
  const classification = error.classification || classifyError(error);
  
  // Critical errors require immediate attention
  if (classification.severity === ErrorSeverity.CRITICAL) {
    return 'alert_and_report';
  }
  
  // Transient errors can be retried
  if (classification.type === ErrorTypes.TRANSIENT) {
    return 'retry_with_backoff';
  }
  
  // Validation errors should return details to the user
  if (classification.category === ErrorCategory.VALIDATION) {
    return 'return_validation_details';
  }
  
  // Authentication errors should prompt re-authentication
  if (classification.category === ErrorCategory.AUTHENTICATION) {
    return 'prompt_authentication';
  }
  
  // Default strategy
  return 'log_and_report';
}

/**
 * Enhanced logging for classified errors
 * @param {Error} error - The error to log
 * @param {Object} context - Additional context information
 */
function logClassifiedError(error, context = {}) {
  const classification = error.classification || classifyError(error);
  
  const logData = {
    timestamp: new Date().toISOString(),
    message: error.message,
    stack: error.stack,
    classification: {
      type: classification.type,
      category: classification.category,
      severity: classification.severity,
      retryable: classification.retryable,
      reason: classification.reason
    },
    context,
    metadata: error.metadata || {}
  };
  
  // Log with appropriate level based on severity
  switch (classification.severity) {
    case ErrorSeverity.CRITICAL:
      console.error('CRITICAL ERROR:', JSON.stringify(logData));
      break;
    case ErrorSeverity.HIGH:
      console.error('HIGH SEVERITY ERROR:', JSON.stringify(logData));
      break;
    case ErrorSeverity.MEDIUM:
      console.warn('ERROR:', JSON.stringify(logData));
      break;
    case ErrorSeverity.LOW:
      console.info('MINOR ERROR:', JSON.stringify(logData));
      break;
    default:
      console.log('ERROR:', JSON.stringify(logData));
  }
  
  // In a production environment, you might want to send critical errors
  // to a monitoring service or alert system
  if (classification.severity === ErrorSeverity.CRITICAL && process.env.NODE_ENV === 'production') {
    // This would be implemented with your monitoring service
    // alertMonitoringService(error, classification);
  }
}

module.exports = {
  ErrorSeverity,
  ErrorCategory,
  ErrorTypes,
  UserImpact,
  MONGODB_ERROR_CODES,
  USER_FRIENDLY_MESSAGES,
  classifyError,
  enhanceError,
  createError,
  getHandlingStrategy,
  logClassifiedError
};