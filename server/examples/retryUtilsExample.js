/**
 * Example usage of the retry utilities
 * This file demonstrates how to use the new retry utilities for database operations
 */

const mongoose = require('mongoose');
const { 
  withRetry, 
  makeRetryable, 
  classifyError, 
  ErrorTypes 
} = require('../utils/retryUtils');
const { executeQuery } = require('../utils/dbOperationWrapper');

// Example 1: Basic retry with default settings
async function findUserWithRetry(userId) {
  return withRetry(async () => {
    const User = mongoose.model('User');
    return await User.findById(userId);
  });
}

// Example 2: Retry with custom configuration
async function createDocumentWithCustomRetry(Model, data) {
  return withRetry(
    async () => {
      const document = new Model(data);
      return await document.save();
    },
    {
      maxRetries: 5,
      initialDelayMs: 200,
      maxDelayMs: 8000,
      jitterFactor: 0.3,
      shouldRetry: (error) => {
        // Only retry on network errors, not validation errors
        const classification = classifyError(error);
        return classification.type === ErrorTypes.TRANSIENT;
      },
      onRetry: (error, attempt, delay) => {
        console.log(`Retry attempt ${attempt} after error: ${error.message}`);
        console.log(`Waiting ${Math.round(delay)}ms before next attempt`);
      }
    }
  );
}

// Example 3: Making an existing function retryable
async function rawFindNeighbourhood(id) {
  const Neighbourhood = mongoose.model('Neighbourhood');
  return await Neighbourhood.findById(id);
}

// Create a retryable version of the function
const findNeighbourhoodWithRetry = makeRetryable(rawFindNeighbourhood, {
  maxRetries: 3,
  initialDelayMs: 100,
  maxDelayMs: 3000
});

// Example 4: Using executeQuery with timeout
async function findReportsWithTimeout(criteria) {
  return executeQuery(
    async () => {
      const Report = mongoose.model('Report');
      return await Report.find(criteria);
    },
    {
      timeout: 5000,
      errorMessage: 'Failed to retrieve reports',
      retryOptions: {
        maxRetries: 2,
        initialDelayMs: 200
      }
    }
  );
}

// Example 5: Handling different error types
async function demonstrateErrorClassification() {
  try {
    // Simulate different types of errors
    const errors = [
      new mongoose.Error.ValidationError(), // Validation error
      new mongoose.Error.CastError('ObjectId', 'invalid', 'userId'), // Cast error
      Object.assign(new Error('connection timed out'), { name: 'MongoNetworkError' }), // Network error
      Object.assign(new Error('duplicate key error'), { code: 11000, name: 'MongoServerError' }) // Duplicate key
    ];
    
    // Classify each error
    errors.forEach(error => {
      const classification = classifyError(error);
      console.log(`Error: ${error.message}`);
      console.log(`Classification: ${JSON.stringify(classification)}`);
      console.log(`Should retry: ${classification.retryable}`);
      console.log('---');
    });
  } catch (error) {
    console.error('Error in demonstration:', error);
  }
}

// Example 6: Using retry with MongoDB transactions
async function performTransactionWithRetry(operations) {
  return withRetry(async () => {
    const session = await mongoose.startSession();
    
    try {
      session.startTransaction();
      
      // Execute all operations in the transaction
      const results = [];
      for (const operation of operations) {
        const result = await operation(session);
        results.push(result);
      }
      
      await session.commitTransaction();
      return results;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }, {
    maxRetries: 3,
    shouldRetry: (error) => {
      // Only retry on transaction-specific errors
      return error.errorLabels && (
        error.errorLabels.includes('TransientTransactionError') ||
        error.errorLabels.includes('UnknownTransactionCommitResult')
      );
    }
  });
}

module.exports = {
  findUserWithRetry,
  createDocumentWithCustomRetry,
  findNeighbourhoodWithRetry,
  findReportsWithTimeout,
  demonstrateErrorClassification,
  performTransactionWithRetry
};