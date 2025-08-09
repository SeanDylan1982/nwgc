/**
 * DatabaseService.js
 * A robust service for managing MongoDB connections with advanced reliability features.
 */
const mongoose = require('mongoose');
const EventEmitter = require('events');

class DatabaseService extends EventEmitter {
  /**
   * Create a new DatabaseService instance
   * @param {Object} config - Configuration options
   * @param {string} config.uri - MongoDB connection URI
   * @param {number} config.minPoolSize - Minimum number of connections in pool
   * @param {number} config.maxPoolSize - Maximum number of connections in pool
   * @param {number} config.socketTimeoutMS - Socket timeout in milliseconds
   * @param {number} config.connectTimeoutMS - Connection timeout in milliseconds
   * @param {number} config.maxRetries - Maximum number of retry attempts
   * @param {number} config.initialDelayMs - Initial delay for retry in milliseconds
   * @param {number} config.maxDelayMs - Maximum delay for retry in milliseconds
   */
  constructor(config) {
    super();
    
    if (!config.uri) {
      throw new Error('MongoDB URI is required');
    }
    
    this.uri = config.uri;
    
    // Detect if this is an Atlas connection
    const isAtlasConnection = this.uri.includes('mongodb+srv://') || this.uri.includes('.mongodb.net');
    
    // Enhanced connection options with optimal settings for reliability
    this.options = {
      // Timeout settings - critical for reliability
      serverSelectionTimeoutMS: config.serverSelectionTimeoutMS || 30000,
      socketTimeoutMS: config.socketTimeoutMS || 45000,
      connectTimeoutMS: config.connectTimeoutMS || 30000,
      
      // Connection pool settings - optimized for throughput and reliability
      maxPoolSize: config.maxPoolSize || 50,
      minPoolSize: config.minPoolSize || 5,
      maxIdleTimeMS: config.maxIdleTimeMS || 60000,
      heartbeatFrequencyMS: config.heartbeatFrequencyMS || 10000,
      
      // Network settings
      family: 4, // Use IPv4, skip trying IPv6 for faster connections
      autoIndex: process.env.NODE_ENV !== 'production', // Don't build indexes in production
      
      // Write settings - ensure data durability
      retryWrites: true, // Enable retryable writes
      writeConcern: {
        w: config.writeConcern || 'majority', // Write concern level
        wtimeout: config.wtimeoutMS || 10000 // Write concern timeout
      },
      
      // Read settings - optimize for read operations
      readPreference: config.readPreference || 'primaryPreferred', // Read preference
      readConcern: { level: config.readConcernLevel || 'majority' }, // Use majority read concern for compatibility with change streams
      
      // Performance optimizations
      compressors: ['zlib'], // Enable network compression
      zlibCompressionLevel: 6, // Balanced compression level
      
      // TLS settings - secure connections (Atlas requires TLS)
      tls: config.ssl !== undefined ? config.ssl : (isAtlasConnection || process.env.NODE_ENV === 'production'),
      tlsAllowInvalidCertificates: config.sslValidate === false,
      tlsAllowInvalidHostnames: false, // Always validate hostnames for security
      
      // Authentication settings
      authSource: config.authSource || 'admin'
    };
    
    // Add TLS certificates if provided
    if (config.sslCA) {
      this.options.tlsCAFile = config.sslCA;
    }
    
    if (config.sslCert && config.sslKey) {
      this.options.tlsCertificateKeyFile = config.sslCert;
      this.options.tlsCertificateKeyFilePassword = config.sslPass;
    }
    this.maxRetries = config.maxRetries || 5;
    this.initialDelayMs = config.initialDelayMs || 100;
    this.maxDelayMs = config.maxDelayMs || 10000;
    this.connection = null;
    this.isConnected = false;
    this.connectionPromise = null;
    this.healthCheckInterval = null;
    this.metrics = {
      operations: 0,
      failures: 0,
      reconnects: 0,
      lastReconnectTime: null,
      connectionLatency: [],
      queryLatency: [],
      activeConnections: 0,
      waitQueueSize: 0,
      operationTypes: {
        find: 0,
        insert: 0,
        update: 0,
        delete: 0,
        aggregate: 0,
        other: 0
      }
    };
    
    // Set up connection event handlers
    this._setupConnectionHandlers();
  }

  /**
   * Set up mongoose connection event handlers
   * @private
   */
  _setupConnectionHandlers() {
    mongoose.connection.on('connected', () => {
      this.isConnected = true;
      this.emit('connected');
      console.log('MongoDB connection established');
    });

    mongoose.connection.on('disconnected', () => {
      this.isConnected = false;
      this.emit('disconnected');
      console.log('MongoDB disconnected');
    });

    mongoose.connection.on('error', (err) => {
      this.metrics.failures++;
      this.emit('error', err);
      console.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('reconnected', () => {
      this.metrics.reconnects++;
      this.metrics.lastReconnectTime = new Date();
      this.emit('reconnected');
      console.log('MongoDB reconnected');
    });

    // Handle process termination
    process.on('SIGINT', this._handleTermination.bind(this));
    process.on('SIGTERM', this._handleTermination.bind(this));
  }

  /**
   * Handle graceful shutdown on process termination
   * @private
   */
  async _handleTermination() {
    try {
      await this.disconnect();
      console.log('MongoDB connection closed through app termination');
      process.exit(0);
    } catch (error) {
      console.error('Error during MongoDB disconnection:', error);
      process.exit(1);
    }
  }

  /**
   * Connect to MongoDB with retry logic
   * @returns {Promise<mongoose.Connection>} Mongoose connection
   */
  async connect() {
    // If already connecting, return the existing promise
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    // If already connected, return the connection
    if (this.isConnected && mongoose.connection.readyState === 1) {
      return mongoose.connection;
    }

    // Create a new connection promise
    this.connectionPromise = new Promise(async (resolve, reject) => {
      let retries = 0;
      let delay = this.initialDelayMs;
      
      while (retries <= this.maxRetries) {
        try {
          const startTime = Date.now();
          
          // Attempt to connect
          this.connection = await mongoose.connect(this.uri, this.options);
          
          // Calculate and store connection latency
          const latency = Date.now() - startTime;
          this.metrics.connectionLatency.push(latency);
          if (this.metrics.connectionLatency.length > 10) {
            this.metrics.connectionLatency.shift(); // Keep only the last 10 measurements
          }
          
          this.isConnected = true;
          this.connectionPromise = null;
          
          // Start health checks
          this._startHealthChecks();
          
          console.log(`MongoDB connected successfully after ${retries > 0 ? retries + ' retries' : 'initial attempt'}`);
          return resolve(this.connection);
        } catch (error) {
          retries++;
          this.metrics.failures++;
          
          if (retries > this.maxRetries) {
            this.connectionPromise = null;
            console.error(`Failed to connect to MongoDB after ${this.maxRetries} attempts:`, error);
            return reject(error);
          }
          
          // Calculate backoff with jitter
          delay = Math.min(delay * 2, this.maxDelayMs);
          const jitteredDelay = delay + (Math.random() * delay * 0.2);
          
          console.warn(`MongoDB connection attempt ${retries} failed. Retrying in ${Math.round(jitteredDelay)}ms...`);
          await new Promise(resolve => setTimeout(resolve, jitteredDelay));
        }
      }
    });

    return this.connectionPromise;
  }

  /**
   * Disconnect from MongoDB
   * @returns {Promise<void>}
   */
  async disconnect() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      this.isConnected = false;
      console.log('MongoDB disconnected');
    }
  }

  /**
   * Start periodic health checks
   * @private
   */
  _startHealthChecks() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    this.healthCheckInterval = setInterval(async () => {
      try {
        if (mongoose.connection.readyState !== 1) {
          console.warn('MongoDB connection health check failed: Connection not ready');
          this.emit('unhealthy', { reason: 'connection_not_ready' });
          return;
        }
        
        // Perform a simple ping to check connection
        const startTime = Date.now();
        await mongoose.connection.db.admin().ping();
        const latency = Date.now() - startTime;
        
        // Store ping latency
        this.metrics.queryLatency.push(latency);
        if (this.metrics.queryLatency.length > 20) {
          this.metrics.queryLatency.shift(); // Keep only the last 20 measurements
        }
        
        // Check if latency is too high
        const avgLatency = this.metrics.queryLatency.reduce((sum, val) => sum + val, 0) / 
                          this.metrics.queryLatency.length;
        
        if (avgLatency > 500) { // 500ms threshold
          console.warn(`MongoDB connection health check warning: High latency (${Math.round(avgLatency)}ms)`);
          this.emit('warning', { reason: 'high_latency', value: avgLatency });
        } else {
          this.emit('healthy', { latency });
        }
      } catch (error) {
        console.error('MongoDB health check failed:', error);
        this.emit('unhealthy', { reason: 'ping_failed', error });
        
        // Try to reconnect if ping fails
        if (mongoose.connection.readyState !== 1) {
          try {
            await this.connect();
          } catch (reconnectError) {
            console.error('Failed to reconnect after health check failure:', reconnectError);
          }
        }
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Execute a database operation with retry logic
   * @param {Function} operation - The database operation to execute
   * @param {Object} options - Retry options
   * @param {string} options.operationType - Type of operation (find, insert, update, delete, aggregate)
   * @returns {Promise<any>} - Result of the operation
   */
  async executeWithRetry(operation, options = {}) {
    const maxRetries = options.maxRetries || this.maxRetries;
    const initialDelay = options.initialDelay || this.initialDelayMs;
    const maxDelay = options.maxDelay || this.maxDelayMs;
    const operationType = options.operationType || 'other';
    
    let retries = 0;
    let delay = initialDelay;
    
    // Track operation type
    if (this.metrics.operationTypes[operationType] !== undefined) {
      this.metrics.operationTypes[operationType]++;
    } else {
      this.metrics.operationTypes.other++;
    }
    
    // Update active connections count
    this.metrics.activeConnections++;
    
    while (true) {
      try {
        this.metrics.operations++;
        const startTime = Date.now();
        const result = await operation();
        
        // Track operation latency
        const latency = Date.now() - startTime;
        this.metrics.queryLatency.push(latency);
        if (this.metrics.queryLatency.length > 20) {
          this.metrics.queryLatency.shift(); // Keep only the last 20 measurements
        }
        
        if (latency > 1000) { // Log slow operations (>1s)
          console.warn(`Slow MongoDB operation detected: ${latency}ms (${operationType})`);
        }
        
        // Emit success event with metrics
        this.emit('operation_success', {
          operationType,
          latency,
          timestamp: new Date()
        });
        
        // Decrease active connections count
        this.metrics.activeConnections--;
        
        return result;
      } catch (error) {
        this.metrics.failures++;
        retries++;
        
        // Emit failure event with metrics
        this.emit('operation_failure', {
          operationType,
          error: error.message,
          retries,
          timestamp: new Date()
        });
        
        // Check if error is retryable
        if (retries > maxRetries || !this._isRetryableError(error)) {
          // Decrease active connections count
          this.metrics.activeConnections--;
          throw error;
        }
        
        // Calculate backoff with jitter
        delay = Math.min(delay * 2, maxDelay);
        const jitteredDelay = delay + (Math.random() * delay * 0.2);
        
        console.warn(`MongoDB operation failed. Retrying (${retries}/${maxRetries}) in ${Math.round(jitteredDelay)}ms...`);
        console.error('Operation error:', error);
        
        await new Promise(resolve => setTimeout(resolve, jitteredDelay));
        
        // Check if we need to reconnect before retrying
        if (mongoose.connection.readyState !== 1) {
          try {
            await this.connect();
          } catch (reconnectError) {
            console.error('Failed to reconnect before operation retry:', reconnectError);
          }
        }
      }
    }
  }

  /**
   * Check if an error is retryable
   * @param {Error} error - The error to check
   * @returns {boolean} - Whether the error is retryable
   * @private
   */
  _isRetryableError(error) {
    // Network errors are generally retryable
    if (error.name === 'MongoNetworkError') return true;
    
    // Timeout errors are retryable
    if (error.name === 'MongoTimeoutError') return true;
    
    // Some server errors are retryable
    if (error.name === 'MongoServerError') {
      // Transient transaction errors
      if (error.code === 251 || error.code === 112) return true;
      
      // Write conflict errors
      if (error.code === 112) return true;
      
      // Connection errors
      if ([6, 7, 89, 91, 189, 9001].includes(error.code)) return true;
    }
    
    // Not a retryable error
    return false;
  }

  /**
   * Get connection statistics and metrics
   * @returns {Object} - Connection metrics
   */
  getConnectionStats() {
    const avgConnectionLatency = this.metrics.connectionLatency.length > 0 
      ? this.metrics.connectionLatency.reduce((sum, val) => sum + val, 0) / this.metrics.connectionLatency.length 
      : 0;
    
    const avgQueryLatency = this.metrics.queryLatency.length > 0
      ? this.metrics.queryLatency.reduce((sum, val) => sum + val, 0) / this.metrics.queryLatency.length
      : 0;
    
    // Get pool stats if available
    let poolStats = {};
    if (mongoose.connection.readyState === 1 && mongoose.connection.client && 
        mongoose.connection.client.topology && mongoose.connection.client.topology.s && 
        mongoose.connection.client.topology.s.pool) {
      
      const pool = mongoose.connection.client.topology.s.pool;
      poolStats = {
        minPoolSize: pool.minPoolSize || this.options.minPoolSize,
        maxPoolSize: pool.maxPoolSize || this.options.maxPoolSize,
        waitQueueSize: pool.waitQueueSize || this.metrics.waitQueueSize,
        activeConnections: this.metrics.activeConnections
      };
    } else {
      poolStats = {
        minPoolSize: this.options.minPoolSize,
        maxPoolSize: this.options.maxPoolSize,
        waitQueueSize: this.metrics.waitQueueSize,
        activeConnections: this.metrics.activeConnections
      };
    }
    
    // Calculate uptime
    let uptime = 0;
    if (mongoose.connection.readyState === 1) {
      // Try to get actual server uptime if available
      if (mongoose.connection.client && mongoose.connection.client.s && 
          mongoose.connection.client.s.options && mongoose.connection.client.s.options.serverSelectionTimeoutMS) {
        uptime = Math.round((Date.now() - mongoose.connection.client.s.options.serverSelectionTimeoutMS) / 1000);
      } else {
        // Fallback to process uptime
        uptime = Math.round(process.uptime());
      }
    }
    
    return {
      isConnected: this.isConnected,
      readyState: mongoose.connection.readyState,
      connectionString: this.uri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@'), // Mask credentials
      maxPoolSize: this.options.maxPoolSize,
      minPoolSize: this.options.minPoolSize,
      operations: this.metrics.operations,
      failures: this.metrics.failures,
      reconnects: this.metrics.reconnects,
      lastReconnectTime: this.metrics.lastReconnectTime,
      avgConnectionLatency: Math.round(avgConnectionLatency),
      avgQueryLatency: Math.round(avgQueryLatency),
      uptime,
      activeConnections: this.metrics.activeConnections,
      waitQueueSize: this.metrics.waitQueueSize,
      operationTypes: this.metrics.operationTypes,
      ...poolStats
    };
  }
  
  /**
   * Get detailed metrics for monitoring
   * @returns {Object} - Detailed metrics
   */
  getDetailedMetrics() {
    const connectionStats = this.getConnectionStats();
    
    // Calculate success rate
    const successRate = this.metrics.operations > 0
      ? (this.metrics.operations - this.metrics.failures) / this.metrics.operations
      : 1;
    
    // Calculate pool utilization
    const poolUtilization = connectionStats.maxPoolSize > 0
      ? connectionStats.activeConnections / connectionStats.maxPoolSize
      : 0;
    
    return {
      timestamp: new Date(),
      connection: {
        status: this.isConnected ? 'connected' : 'disconnected',
        readyState: mongoose.connection.readyState,
        reconnects: this.metrics.reconnects,
        lastReconnectTime: this.metrics.lastReconnectTime,
        uptime: connectionStats.uptime
      },
      operations: {
        total: this.metrics.operations,
        failures: this.metrics.failures,
        successRate,
        byType: this.metrics.operationTypes
      },
      latency: {
        connection: {
          avg: connectionStats.avgConnectionLatency,
          values: this.metrics.connectionLatency.slice()
        },
        query: {
          avg: connectionStats.avgQueryLatency,
          values: this.metrics.queryLatency.slice()
        }
      },
      pool: {
        utilization: poolUtilization,
        activeConnections: connectionStats.activeConnections,
        maxPoolSize: connectionStats.maxPoolSize,
        minPoolSize: connectionStats.minPoolSize,
        waitQueueSize: connectionStats.waitQueueSize
      }
    };
  }
}

module.exports = DatabaseService;