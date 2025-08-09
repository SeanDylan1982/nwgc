/**
 * reliableDbOperations.js
 * 
 * Comprehensive examples of using the enhanced database operation wrapper
 * for reliable MongoDB operations with proper error handling and retry logic.
 */

const mongoose = require('mongoose');
const { 
  executeQuery, 
  withRetry, 
  wrapModelMethod, 
  withTransaction,
  checkDatabaseHealth,
  LOG_LEVELS,
  logWithContext
} = require('../utils/dbOperationWrapper');
const { dbService } = require('../config/database');

/**
 * Example 1: Basic query with retry logic and timeout
 * Demonstrates retrieving a user with comprehensive error handling
 */
async function getUserReliably(userId) {
  return executeQuery(
    async () => {
      const User = mongoose.model('User');
      return await User.findById(userId).lean();
    },
    {
      timeout: 5000,
      errorMessage: `Failed to retrieve user with ID: ${userId}`,
      operationName: 'getUserReliably',
      metadata: { userId },
      retryOptions: {
        maxRetries: 3,
        initialDelayMs: 100
      }
    }
  );
}

/**
 * Example 2: Document creation with custom retry logic
 * Shows how to create a document with specific retry conditions
 */
async function createDocumentReliably(Model, data) {
  return executeQuery(
    async () => {
      const document = new Model(data);
      return await document.save();
    },
    {
      timeout: 10000,
      errorMessage: `Failed to create ${Model.modelName} document`,
      operationName: `create${Model.modelName}`,
      metadata: { modelName: Model.modelName },
      retryOptions: {
        maxRetries: 2,
        shouldRetry: (err) => {
          // Only retry on connection issues, not validation errors
          return err.name === 'MongoNetworkError' || 
                 err.message.includes('connection') ||
                 (err.code && [112, 251].includes(err.code));
        }
      }
    }
  );
}

/**
 * Example 3: Reliable transaction with proper error handling
 * Demonstrates how to perform a transaction with retry logic
 */
async function performTransactionReliably(operations) {
  return withTransaction(
    async (session) => {
      // Execute all operations in the transaction
      const results = [];
      for (const operation of operations) {
        const result = await operation(session);
        results.push(result);
      }
      return results;
    },
    {
      timeout: 30000,
      errorMessage: 'Failed to complete transaction',
      operationName: 'performTransaction',
      retryOptions: {
        maxRetries: 3,
        initialDelayMs: 200
      }
    }
  );
}

/**
 * Example 4: Wrapping a model method for consistent error handling
 * Shows how to create a wrapped version of a model method
 */
function getReliableUserModel() {
  const User = mongoose.model('User');
  
  return {
    findByIdReliable: wrapModelMethod(User, 'findById', {
      timeout: 5000,
      retryOptions: { maxRetries: 3 }
    }),
    
    findOneReliable: wrapModelMethod(User, 'findOne', {
      timeout: 5000,
      retryOptions: { maxRetries: 3 }
    }),
    
    createReliable: async (userData) => {
      return executeQuery(
        async () => {
          const user = new User(userData);
          return await user.save();
        },
        {
          operationName: 'User.create',
          timeout: 10000,
          retryOptions: { maxRetries: 2 }
        }
      );
    }
  };
}

/**
 * Example 5: Complex query with timeout and critical operation flag
 * Demonstrates a more complex query with additional options
 */
async function findActiveNeighbourhoods(criteria, options = {}) {
  return executeQuery(
    async () => {
      const Neighbourhood = mongoose.model('Neighbourhood');
      
      // Build the query
      const query = Neighbourhood.find({ 
        ...criteria,
        isActive: true 
      });
      
      // Apply pagination if provided
      if (options.page && options.limit) {
        const skip = (options.page - 1) * options.limit;
        query.skip(skip).limit(options.limit);
      }
      
      // Apply sorting if provided
      if (options.sort) {
        query.sort(options.sort);
      }
      
      // Execute the query
      return await query.lean();
    },
    {
      timeout: 15000,
      errorMessage: 'Failed to retrieve active neighbourhoods',
      operationName: 'findActiveNeighbourhoods',
      metadata: { criteria, options },
      criticalOperation: options.critical || false,
      retryOptions: {
        maxRetries: 3,
        initialDelayMs: 200
      }
    }
  );
}

/**
 * Example 6: Database health check with detailed status
 * Shows how to check database health and connection status
 */
async function checkDatabaseStatus() {
  try {
    const healthStatus = await checkDatabaseHealth({
      timeout: 3000,
      operationName: 'applicationHealthCheck'
    });
    
    logWithContext(
      healthStatus.status === 'healthy' ? LOG_LEVELS.INFO : LOG_LEVELS.WARN,
      `Database health check: ${healthStatus.status}`,
      healthStatus
    );
    
    return healthStatus;
  } catch (error) {
    logWithContext(
      LOG_LEVELS.ERROR,
      'Health check failed',
      { error: error.message }
    );
    throw error;
  }
}

/**
 * Example 7: Bulk operations with retry logic
 * Demonstrates how to perform bulk operations reliably
 */
async function bulkUpdateReliably(Model, filter, update) {
  return executeQuery(
    async () => {
      return await Model.updateMany(filter, update);
    },
    {
      timeout: 60000, // Longer timeout for bulk operations
      errorMessage: `Failed to perform bulk update on ${Model.modelName}`,
      operationName: `bulkUpdate${Model.modelName}`,
      metadata: { modelName: Model.modelName, filter },
      retryOptions: {
        maxRetries: 5,
        initialDelayMs: 500,
        maxDelayMs: 10000
      }
    }
  );
}

/**
 * Example 8: Aggregation pipeline with timeout and retry
 * Shows how to execute a complex aggregation pipeline reliably
 */
async function aggregateReliably(Model, pipeline, options = {}) {
  return executeQuery(
    async () => {
      return await Model.aggregate(pipeline).option({ maxTimeMS: options.maxTimeMS || 30000 });
    },
    {
      timeout: options.timeout || 45000, // Longer timeout for aggregations
      errorMessage: `Failed to execute aggregation on ${Model.modelName}`,
      operationName: `aggregate${Model.modelName}`,
      metadata: { modelName: Model.modelName, pipelineStages: pipeline.length },
      retryOptions: {
        maxRetries: options.maxRetries || 2,
        initialDelayMs: 1000
      }
    }
  );
}

module.exports = {
  getUserReliably,
  createDocumentReliably,
  performTransactionReliably,
  getReliableUserModel,
  findActiveNeighbourhoods,
  checkDatabaseStatus,
  bulkUpdateReliably,
  aggregateReliably
};