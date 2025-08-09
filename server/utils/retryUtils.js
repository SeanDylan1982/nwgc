/**
 * retryUtils.js
 * Comprehensive utilities for implementing retry logic with exponential backoff
 * and proper error classification for MongoDB operations.
 */

const { 
  ErrorTypes, 
  classifyError: detailedClassifyError, 
  enhanceError 
} = require('./errorClassification');

/**
 * Simplified version of classifyError that focuses on retryability
 * @param {Error} error - The error to classify
 * @returns {Object} Classification details including type and whether it's retryable
 */
function classifyError(error) {
  // Use the detailed classification system
  const detailedClassification = detailedClassifyError(error);
  
  // Return a simplified version for backward compatibility
  return {
    type: detailedClassification.type,
    retryable: detailedClassification.retryable,
    message: error.message,
    code: detailedClassification.code,
    reason: detailedClassification.reason
  };
}

/**
 * Calculates exponential backoff delay with jitter
 * @param {number} attempt - Current attempt number (starting from 1)
 * @param {number} initialDelayMs - Initial delay in milliseconds
 * @param {number} maxDelayMs - Maximum delay in milliseconds
 * @param {number} jitterFactor - Factor to determine jitter amount (0-1)
 * @returns {number} Calculated delay with jitter in milliseconds
 */
function calculateBackoffDelay(attempt, initialDelayMs, maxDelayMs, jitterFactor = 0.2) {
  // Calculate base exponential delay: initialDelay * 2^(attempt-1)
  const baseDelay = initialDelayMs * Math.pow(2, attempt - 1);
  
  // Cap the delay at the maximum
  const cappedDelay = Math.min(baseDelay, maxDelayMs);
  
  // Add jitter to prevent thundering herd problem
  // Jitter is a random value between -jitterFactor*delay and +jitterFactor*delay
  const jitterAmount = cappedDelay * jitterFactor;
  const jitter = (Math.random() * 2 - 1) * jitterAmount;
  
  // Ensure the final delay is positive and doesn't exceed maxDelayMs
  return Math.max(0, Math.min(cappedDelay + jitter, maxDelayMs));
}

/**
 * Executes an operation with configurable retry logic and exponential backoff
 * @param {Function} operation - The operation to execute
 * @param {Object} options - Retry configuration options
 * @param {number} options.maxRetries - Maximum number of retry attempts
 * @param {number} options.initialDelayMs - Initial delay before first retry in milliseconds
 * @param {number} options.maxDelayMs - Maximum delay between retries in milliseconds
 * @param {number} options.jitterFactor - Factor to determine jitter amount (0-1)
 * @param {Function} options.shouldRetry - Custom function to determine if operation should be retried
 * @param {Function} options.onRetry - Callback function executed before each retry
 * @param {boolean} options.logRetries - Whether to log retry attempts
 * @returns {Promise<*>} Result of the operation
 */
async function withRetry(operation, options = {}) {
  const {
    maxRetries = 3,
    initialDelayMs = 100,
    maxDelayMs = 5000,
    jitterFactor = 0.2,
    shouldRetry = (error) => {
      const classification = classifyError(error);
      return classification.retryable;
    },
    onRetry = null,
    logRetries = true
  } = options;

  let attempt = 0;
  let lastError;

  while (attempt <= maxRetries) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      attempt++;
      
      // Check if we've exceeded max retries or if the error is not retryable
      if (attempt > maxRetries || !shouldRetry(error)) {
        // Enhance error with retry information
        if (error.retryAttempts === undefined) {
          error.retryAttempts = attempt - 1;
          error.classification = classifyError(error);
        }
        throw error;
      }
      
      // Calculate delay with jitter
      const delay = calculateBackoffDelay(
        attempt, 
        initialDelayMs, 
        maxDelayMs, 
        jitterFactor
      );
      
      // Log retry information if enabled
      if (logRetries) {
        const errorClass = classifyError(error);
        console.warn(
          `Operation failed (attempt ${attempt}/${maxRetries}). ` +
          `Error type: ${errorClass.type}, Reason: ${errorClass.reason}. ` +
          `Retrying in ${Math.round(delay)}ms...`
        );
        console.error(`Error details: ${error.message}`);
      }
      
      // Execute onRetry callback if provided
      if (onRetry && typeof onRetry === 'function') {
        try {
          await onRetry(error, attempt, delay);
        } catch (callbackError) {
          console.error('Error in retry callback:', callbackError);
        }
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // This should never be reached due to the throw in the catch block
  throw lastError;
}

/**
 * Creates a retryable version of a function
 * @param {Function} fn - The function to make retryable
 * @param {Object} options - Retry configuration options
 * @returns {Function} A wrapped function that will retry on failure
 */
function makeRetryable(fn, options = {}) {
  return async (...args) => {
    return withRetry(() => fn(...args), options);
  };
}

/**
 * Executes an operation with timeout and retry logic
 * @param {Function} operation - The operation to execute
 * @param {Object} options - Configuration options
 * @param {number} options.timeout - Timeout in milliseconds
 * @param {Object} options.retryOptions - Options for retry logic
 * @param {string} options.errorMessage - Custom error message prefix
 * @returns {Promise<*>} Result of the operation
 */
async function executeWithTimeout(operation, options = {}) {
  const {
    timeout = 30000,
    retryOptions = {},
    errorMessage = 'Operation failed'
  } = options;

  try {
    // Execute operation with timeout and retry logic
    return await Promise.race([
      withRetry(operation, retryOptions),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Operation timed out')), timeout)
      )
    ]);
  } catch (error) {
    // Enhance error with additional context
    const enhancedError = new Error(`${errorMessage}: ${error.message}`);
    enhancedError.originalError = error;
    enhancedError.timestamp = new Date();
    enhancedError.classification = error.classification || classifyError(error);
    
    throw enhancedError;
  }
}

module.exports = {
  ErrorTypes,
  classifyError,
  calculateBackoffDelay,
  withRetry,
  makeRetryable,
  executeWithTimeout
};