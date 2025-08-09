/**
 * DatabaseRecoveryManager.js
 * A service for managing database recovery strategies and graceful degradation.
 */
const EventEmitter = require('events');
const CircuitBreaker = require('../utils/CircuitBreaker');

class DatabaseRecoveryManager extends EventEmitter {
  /**
   * Create a new DatabaseRecoveryManager instance
   * @param {Object} dbService - The DatabaseService instance
   * @param {Object} healthCheckService - The HealthCheckService instance
   * @param {Object} options - Configuration options
   */
  constructor(dbService, healthCheckService, options = {}) {
    super();
    this.dbService = dbService;
    this.healthCheckService = healthCheckService;
    
    this.options = {
      circuitBreakerFailureThreshold: options.circuitBreakerFailureThreshold || 5,
      circuitBreakerResetTimeout: options.circuitBreakerResetTimeout || 30000,
      maxRecoveryAttempts: options.maxRecoveryAttempts || 3,
      recoveryBackoffMs: options.recoveryBackoffMs || 5000,
      enableCircuitBreaker: options.enableCircuitBreaker !== undefined ? options.enableCircuitBreaker : true,
      enableGracefulDegradation: options.enableGracefulDegradation !== undefined ? options.enableGracefulDegradation : true
    };
    
    // Initialize circuit breakers for different database operations
    this.circuitBreakers = {
      read: new CircuitBreaker({
        failureThreshold: this.options.circuitBreakerFailureThreshold,
        resetTimeout: this.options.circuitBreakerResetTimeout,
        fallbackFunction: this._createFallbackFunction('read')
      }),
      write: new CircuitBreaker({
        failureThreshold: this.options.circuitBreakerFailureThreshold,
        resetTimeout: this.options.circuitBreakerResetTimeout,
        fallbackFunction: this._createFallbackFunction('write')
      }),
      query: new CircuitBreaker({
        failureThreshold: this.options.circuitBreakerFailureThreshold,
        resetTimeout: this.options.circuitBreakerResetTimeout,
        fallbackFunction: this._createFallbackFunction('query')
      })
    };
    
    // Recovery state
    this.recoveryState = {
      isRecovering: false,
      lastRecoveryAttempt: null,
      recoveryAttempts: 0,
      successfulRecoveries: 0,
      failedRecoveries: 0
    };
    
    // Cache for graceful degradation
    this.cache = new Map();
    
    // Set up event listeners
    this._setupEventListeners();
  }

  /**
   * Set up event listeners
   * @private
   */
  _setupEventListeners() {
    // Listen for health check events
    if (this.healthCheckService) {
      this.healthCheckService.on('unhealthy', async (data) => {
        console.warn('Health check detected unhealthy database connection:', data.message);
        await this.attemptRecovery();
      });
      
      this.healthCheckService.on('recovery', (data) => {
        console.log('Health check detected database recovery:', data.message);
        this.resetCircuitBreakers();
      });
    }
    
    // Listen for circuit breaker events
    Object.entries(this.circuitBreakers).forEach(([operation, breaker]) => {
      breaker.on('state_change', (data) => {
        console.log(`Circuit breaker for ${operation} operations changed from ${data.from} to ${data.to}`);
        this.emit('circuit_state_change', { operation, ...data });
      });
      
      breaker.on('failure', (data) => {
        console.warn(`Circuit breaker for ${operation} operations detected failure:`, data.error);
      });
      
      breaker.on('rejected', () => {
        console.warn(`Circuit breaker for ${operation} operations rejected request (circuit open)`);
      });
    });
  }

  /**
   * Create a fallback function for circuit breaker
   * @param {string} operationType - Type of operation (read, write, query)
   * @returns {Function} Fallback function
   * @private
   */
  _createFallbackFunction(operationType) {
    return (...args) => {
      console.warn(`Using fallback for ${operationType} operation`);
      
      // For read operations, try to return cached data if available
      if (operationType === 'read' && this.options.enableGracefulDegradation) {
        const cacheKey = this._generateCacheKey(args);
        if (this.cache.has(cacheKey)) {
          const cachedData = this.cache.get(cacheKey);
          console.log(`Returning cached data for ${operationType} operation`);
          return Promise.resolve({
            data: cachedData.data,
            fromCache: true,
            cachedAt: cachedData.timestamp
          });
        }
      }
      
      // For write operations, queue them for later execution
      if (operationType === 'write' && this.options.enableGracefulDegradation) {
        const operation = { type: operationType, args, timestamp: Date.now() };
        this._queueOperation(operation);
        return Promise.resolve({
          queued: true,
          queuedAt: operation.timestamp
        });
      }
      
      // For query operations or if no fallback is available
      return Promise.reject(new Error(`Database ${operationType} operation failed (circuit open)`));
    };
  }

  /**
   * Generate a cache key for an operation
   * @param {Array} args - Operation arguments
   * @returns {string} Cache key
   * @private
   */
  _generateCacheKey(args) {
    try {
      // Simple cache key generation - in production, use a more robust method
      return JSON.stringify(args);
    } catch (error) {
      console.error('Failed to generate cache key:', error);
      return `key_${Date.now()}_${Math.random()}`;
    }
  }

  /**
   * Queue an operation for later execution
   * @param {Object} operation - Operation to queue
   * @private
   */
  _queueOperation(operation) {
    // In a real implementation, this would store the operation in a persistent queue
    console.log(`Queued ${operation.type} operation for later execution`);
    this.emit('operation_queued', operation);
  }

  /**
   * Execute a database operation with circuit breaker protection
   * @param {string} operationType - Type of operation (read, write, query)
   * @param {Function} operation - The operation to execute
   * @param {boolean} cacheResult - Whether to cache the result (for read operations)
   * @param {Array} args - Arguments to identify the operation (for caching)
   * @returns {Promise<any>} - Result of the operation
   */
  async executeOperation(operationType, operation, cacheResult = false, args = []) {
    // Skip circuit breaker if disabled
    if (!this.options.enableCircuitBreaker) {
      return operation();
    }
    
    // Get the appropriate circuit breaker
    const circuitBreaker = this.circuitBreakers[operationType] || this.circuitBreakers.query;
    
    // Execute with circuit breaker
    const result = await circuitBreaker.execute(operation, ...args);
    
    // Cache result if needed
    if (operationType === 'read' && cacheResult && this.options.enableGracefulDegradation) {
      const cacheKey = this._generateCacheKey(args);
      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });
    }
    
    return result;
  }

  /**
   * Reset all circuit breakers
   */
  resetCircuitBreakers() {
    Object.values(this.circuitBreakers).forEach(breaker => {
      breaker.reset();
    });
    console.log('All circuit breakers reset to CLOSED state');
  }

  /**
   * Attempt to recover the database connection
   * @returns {Promise<boolean>} Whether recovery was successful
   */
  async attemptRecovery() {
    // If already recovering, don't start another recovery
    if (this.recoveryState.isRecovering) {
      console.log('Recovery already in progress, skipping');
      return false;
    }
    
    // Check if we've exceeded max recovery attempts
    if (this.recoveryState.recoveryAttempts >= this.options.maxRecoveryAttempts) {
      console.warn(`Exceeded maximum recovery attempts (${this.options.maxRecoveryAttempts}), waiting for manual intervention`);
      this.emit('max_recovery_attempts_exceeded', {
        attempts: this.recoveryState.recoveryAttempts,
        lastAttempt: this.recoveryState.lastRecoveryAttempt
      });
      return false;
    }
    
    // Start recovery
    this.recoveryState.isRecovering = true;
    this.recoveryState.recoveryAttempts++;
    this.recoveryState.lastRecoveryAttempt = Date.now();
    
    console.log(`Attempting database recovery (attempt ${this.recoveryState.recoveryAttempts}/${this.options.maxRecoveryAttempts})`);
    this.emit('recovery_started', {
      attempt: this.recoveryState.recoveryAttempts,
      timestamp: this.recoveryState.lastRecoveryAttempt
    });
    
    try {
      // Disconnect and reconnect
      await this.dbService.disconnect();
      
      // Add backoff delay based on attempt number
      const backoffDelay = this.options.recoveryBackoffMs * Math.pow(2, this.recoveryState.recoveryAttempts - 1);
      console.log(`Waiting ${backoffDelay}ms before reconnecting...`);
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
      
      await this.dbService.connect();
      
      // Recovery successful
      this.recoveryState.isRecovering = false;
      this.recoveryState.successfulRecoveries++;
      this.resetCircuitBreakers();
      
      console.log('Database recovery successful');
      this.emit('recovery_successful', {
        attempt: this.recoveryState.recoveryAttempts,
        timestamp: Date.now()
      });
      
      return true;
    } catch (error) {
      // Recovery failed
      this.recoveryState.isRecovering = false;
      this.recoveryState.failedRecoveries++;
      
      console.error('Database recovery failed:', error);
      this.emit('recovery_failed', {
        attempt: this.recoveryState.recoveryAttempts,
        error,
        timestamp: Date.now()
      });
      
      return false;
    }
  }

  /**
   * Process queued operations
   * @returns {Promise<Object>} Processing results
   */
  async processQueuedOperations() {
    // In a real implementation, this would process operations from a persistent queue
    console.log('Processing queued operations');
    this.emit('queue_processing_started');
    
    // Simulate processing
    await new Promise(resolve => setTimeout(resolve, 100));
    
    this.emit('queue_processing_completed', {
      processed: 0,
      successful: 0,
      failed: 0
    });
    
    return {
      processed: 0,
      successful: 0,
      failed: 0
    };
  }

  /**
   * Clear the cache
   */
  clearCache() {
    const cacheSize = this.cache.size;
    this.cache.clear();
    console.log(`Cache cleared (${cacheSize} entries)`);
  }

  /**
   * Get recovery manager status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      circuitBreakers: {
        read: this.circuitBreakers.read.getState(),
        write: this.circuitBreakers.write.getState(),
        query: this.circuitBreakers.query.getState()
      },
      recovery: this.recoveryState,
      cacheSize: this.cache.size,
      options: this.options
    };
  }

  /**
   * Get detailed metrics
   * @returns {Object} Detailed metrics
   */
  getDetailedMetrics() {
    return {
      circuitBreakers: {
        read: this.circuitBreakers.read.getMetrics(),
        write: this.circuitBreakers.write.getMetrics(),
        query: this.circuitBreakers.query.getMetrics()
      },
      recovery: this.recoveryState,
      cacheSize: this.cache.size,
      options: this.options
    };
  }
}

module.exports = DatabaseRecoveryManager;