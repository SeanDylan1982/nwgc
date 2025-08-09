/**
 * MetricsCollectionService.js
 * A service for collecting, storing, and retrieving MongoDB connection metrics.
 */
const EventEmitter = require('events');

class MetricsCollectionService extends EventEmitter {
  /**
   * Create a new MetricsCollectionService instance
   * @param {Object} dbService - The DatabaseService instance to monitor
   * @param {Object} config - Configuration options
   */
  constructor(dbService, config = {}) {
    super();
    this.dbService = dbService;
    this.config = {
      metricsRetentionPeriod: config.metricsRetentionPeriod || 24 * 60 * 60 * 1000, // 24 hours by default
      collectionIntervalMs: config.collectionIntervalMs || 60000, // 1 minute by default
      detailedMetricsLimit: config.detailedMetricsLimit || 100, // Number of detailed metrics to keep
      aggregationIntervalMs: config.aggregationIntervalMs || 5 * 60 * 1000, // 5 minutes by default
      enableAggregation: config.enableAggregation !== undefined ? config.enableAggregation : true
    };
    
    // Initialize metrics storage
    this.metrics = {
      // Connection success/failure metrics
      connection: {
        success: 0,
        failures: 0,
        reconnects: 0,
        history: []
      },
      
      // Query performance metrics
      query: {
        total: 0,
        successful: 0,
        failed: 0,
        history: []
      },
      
      // Connection pool metrics
      pool: {
        utilization: [],
        history: []
      },
      
      // Latency metrics
      latency: {
        connection: [],
        query: [],
        history: []
      },
      
      // Aggregated metrics for time series
      timeSeries: {
        hourly: [],
        daily: []
      }
    };
    
    // Collection interval
    this.collectionInterval = null;
    this.aggregationInterval = null;
    
    // Set up event listeners
    this._setupEventListeners();
  }

  /**
   * Set up event listeners for the database service
   * @private
   */
  _setupEventListeners() {
    // Listen for connection events
    this.dbService.on('connected', () => {
      this.metrics.connection.success++;
      this._recordConnectionEvent('connected');
    });
    
    this.dbService.on('disconnected', () => {
      this._recordConnectionEvent('disconnected');
    });
    
    this.dbService.on('error', (err) => {
      this.metrics.connection.failures++;
      this._recordConnectionEvent('error', { error: err.message });
    });
    
    this.dbService.on('reconnected', () => {
      this.metrics.connection.reconnects++;
      this._recordConnectionEvent('reconnected');
    });
    
    // Listen for health check events
    this.dbService.on('healthy', (data) => {
      this._recordHealthEvent('healthy', data);
    });
    
    this.dbService.on('warning', (data) => {
      this._recordHealthEvent('warning', data);
    });
    
    this.dbService.on('unhealthy', (data) => {
      this._recordHealthEvent('unhealthy', data);
    });
  }

  /**
   * Record a connection event
   * @param {string} eventType - The type of event
   * @param {Object} data - Additional event data
   * @private
   */
  _recordConnectionEvent(eventType, data = {}) {
    const timestamp = new Date();
    const connectionStats = this.dbService.getConnectionStats();
    
    const event = {
      timestamp,
      eventType,
      ...data,
      connectionStats: {
        isConnected: connectionStats.isConnected,
        readyState: connectionStats.readyState,
        reconnects: connectionStats.reconnects,
        operations: connectionStats.operations,
        failures: connectionStats.failures
      }
    };
    
    this.metrics.connection.history.unshift(event);
    
    // Trim history if needed
    if (this.metrics.connection.history.length > this.config.detailedMetricsLimit) {
      this.metrics.connection.history.pop();
    }
    
    // Emit event for real-time monitoring
    this.emit('connection_event', event);
  }

  /**
   * Record a health check event
   * @param {string} status - The health status
   * @param {Object} data - Health check data
   * @private
   */
  _recordHealthEvent(status, data = {}) {
    const timestamp = new Date();
    const connectionStats = this.dbService.getConnectionStats();
    
    const event = {
      timestamp,
      status,
      ...data,
      connectionStats: {
        isConnected: connectionStats.isConnected,
        readyState: connectionStats.readyState,
        avgQueryLatency: connectionStats.avgQueryLatency,
        avgConnectionLatency: connectionStats.avgConnectionLatency
      }
    };
    
    // Store latency metrics
    if (connectionStats.avgQueryLatency) {
      this.metrics.latency.query.push(connectionStats.avgQueryLatency);
      if (this.metrics.latency.query.length > 100) {
        this.metrics.latency.query.shift();
      }
    }
    
    if (connectionStats.avgConnectionLatency) {
      this.metrics.latency.connection.push(connectionStats.avgConnectionLatency);
      if (this.metrics.latency.connection.length > 100) {
        this.metrics.latency.connection.shift();
      }
    }
    
    // Store health event in history
    this.metrics.latency.history.unshift(event);
    if (this.metrics.latency.history.length > this.config.detailedMetricsLimit) {
      this.metrics.latency.history.pop();
    }
    
    // Emit event for real-time monitoring
    this.emit('health_event', event);
  }

  /**
   * Record query metrics
   * @param {Object} queryMetrics - Query metrics data
   */
  recordQueryMetrics(queryMetrics) {
    const timestamp = new Date();
    
    this.metrics.query.total++;
    if (queryMetrics.success) {
      this.metrics.query.successful++;
    } else {
      this.metrics.query.failed++;
    }
    
    const event = {
      timestamp,
      ...queryMetrics,
      successRate: this.metrics.query.successful / this.metrics.query.total
    };
    
    this.metrics.query.history.unshift(event);
    if (this.metrics.query.history.length > this.config.detailedMetricsLimit) {
      this.metrics.query.history.pop();
    }
    
    // Emit event for real-time monitoring
    this.emit('query_event', event);
  }

  /**
   * Record connection pool metrics
   * @param {Object} poolMetrics - Pool metrics data
   */
  recordPoolMetrics(poolMetrics) {
    const timestamp = new Date();
    
    // Calculate pool utilization
    const utilization = poolMetrics.activeConnections / poolMetrics.maxPoolSize;
    this.metrics.pool.utilization.push(utilization);
    if (this.metrics.pool.utilization.length > 100) {
      this.metrics.pool.utilization.shift();
    }
    
    const event = {
      timestamp,
      ...poolMetrics,
      utilization
    };
    
    this.metrics.pool.history.unshift(event);
    if (this.metrics.pool.history.length > this.config.detailedMetricsLimit) {
      this.metrics.pool.history.pop();
    }
    
    // Emit event for real-time monitoring
    this.emit('pool_event', event);
  }

  /**
   * Start collecting metrics
   * @returns {MetricsCollectionService} this instance for chaining
   */
  startCollection() {
    if (this.collectionInterval) {
      return this;
    }
    
    // Start periodic collection
    this.collectionInterval = setInterval(() => this._collectMetrics(), this.config.collectionIntervalMs);
    
    // Start aggregation if enabled
    if (this.config.enableAggregation) {
      this.aggregationInterval = setInterval(() => this._aggregateMetrics(), this.config.aggregationIntervalMs);
    }
    
    console.log(`Database metrics collection started (interval: ${this.config.collectionIntervalMs}ms)`);
    return this;
  }

  /**
   * Stop collecting metrics
   * @returns {MetricsCollectionService} this instance for chaining
   */
  stopCollection() {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = null;
    }
    
    if (this.aggregationInterval) {
      clearInterval(this.aggregationInterval);
      this.aggregationInterval = null;
    }
    
    console.log('Database metrics collection stopped');
    return this;
  }

  /**
   * Collect metrics from the database service
   * @private
   */
  async _collectMetrics() {
    try {
      // Get connection stats
      const connectionStats = this.dbService.getConnectionStats();
      
      // Record connection pool metrics
      this.recordPoolMetrics({
        activeConnections: connectionStats.activeConnections || 0,
        maxPoolSize: connectionStats.poolSize || 0,
        minPoolSize: connectionStats.minPoolSize || 0,
        waitQueueSize: connectionStats.waitQueueSize || 0
      });
      
      // Record query latency metrics if available
      if (connectionStats.avgQueryLatency) {
        this.recordQueryMetrics({
          latency: connectionStats.avgQueryLatency,
          success: true,
          operationType: 'aggregate'
        });
      }
      
      // Emit collection event
      this.emit('metrics_collected', {
        timestamp: new Date(),
        connectionStats
      });
    } catch (error) {
      console.error('Error collecting metrics:', error);
    }
  }

  /**
   * Aggregate metrics for time series analysis
   * @private
   */
  _aggregateMetrics() {
    try {
      const timestamp = new Date();
      
      // Calculate aggregated metrics
      const connectionStats = this.dbService.getConnectionStats();
      const avgQueryLatency = this.metrics.latency.query.length > 0
        ? this.metrics.latency.query.reduce((sum, val) => sum + val, 0) / this.metrics.latency.query.length
        : 0;
      
      const avgConnectionLatency = this.metrics.latency.connection.length > 0
        ? this.metrics.latency.connection.reduce((sum, val) => sum + val, 0) / this.metrics.latency.connection.length
        : 0;
      
      const avgPoolUtilization = this.metrics.pool.utilization.length > 0
        ? this.metrics.pool.utilization.reduce((sum, val) => sum + val, 0) / this.metrics.pool.utilization.length
        : 0;
      
      const successRate = this.metrics.query.total > 0
        ? this.metrics.query.successful / this.metrics.query.total
        : 1;
      
      // Create hourly aggregation
      const hourlyMetrics = {
        timestamp,
        period: 'hourly',
        connection: {
          success: this.metrics.connection.success,
          failures: this.metrics.connection.failures,
          reconnects: this.metrics.connection.reconnects,
          uptime: connectionStats.uptime
        },
        query: {
          total: this.metrics.query.total,
          successful: this.metrics.query.successful,
          failed: this.metrics.query.failed,
          successRate,
          avgLatency: avgQueryLatency
        },
        pool: {
          avgUtilization: avgPoolUtilization
        },
        latency: {
          avgQuery: avgQueryLatency,
          avgConnection: avgConnectionLatency
        }
      };
      
      this.metrics.timeSeries.hourly.unshift(hourlyMetrics);
      
      // Keep only the last 24 hourly metrics (24 hours)
      if (this.metrics.timeSeries.hourly.length > 24) {
        this.metrics.timeSeries.hourly.pop();
      }
      
      // Create daily aggregation every 24 hours
      const isNewDay = this.metrics.timeSeries.daily.length === 0 || 
        new Date(this.metrics.timeSeries.daily[0].timestamp).getDate() !== timestamp.getDate();
      
      if (isNewDay) {
        const dailyMetrics = {
          timestamp,
          period: 'daily',
          ...hourlyMetrics
        };
        
        this.metrics.timeSeries.daily.unshift(dailyMetrics);
        
        // Keep only the last 30 daily metrics (30 days)
        if (this.metrics.timeSeries.daily.length > 30) {
          this.metrics.timeSeries.daily.pop();
        }
      }
      
      // Emit aggregation event
      this.emit('metrics_aggregated', {
        timestamp,
        hourlyMetrics,
        isNewDay
      });
    } catch (error) {
      console.error('Error aggregating metrics:', error);
    }
  }

  /**
   * Clean up old metrics based on retention period
   * @private
   */
  _cleanupOldMetrics() {
    const cutoffTime = new Date(Date.now() - this.config.metricsRetentionPeriod);
    
    // Clean up connection history
    this.metrics.connection.history = this.metrics.connection.history.filter(
      event => new Date(event.timestamp) >= cutoffTime
    );
    
    // Clean up query history
    this.metrics.query.history = this.metrics.query.history.filter(
      event => new Date(event.timestamp) >= cutoffTime
    );
    
    // Clean up pool history
    this.metrics.pool.history = this.metrics.pool.history.filter(
      event => new Date(event.timestamp) >= cutoffTime
    );
    
    // Clean up latency history
    this.metrics.latency.history = this.metrics.latency.history.filter(
      event => new Date(event.timestamp) >= cutoffTime
    );
  }

  /**
   * Get current metrics
   * @returns {Object} Current metrics
   */
  getMetrics() {
    const connectionStats = this.dbService.getConnectionStats();
    
    // Calculate averages
    const avgQueryLatency = this.metrics.latency.query.length > 0
      ? this.metrics.latency.query.reduce((sum, val) => sum + val, 0) / this.metrics.latency.query.length
      : 0;
    
    const avgConnectionLatency = this.metrics.latency.connection.length > 0
      ? this.metrics.latency.connection.reduce((sum, val) => sum + val, 0) / this.metrics.latency.connection.length
      : 0;
    
    const avgPoolUtilization = this.metrics.pool.utilization.length > 0
      ? this.metrics.pool.utilization.reduce((sum, val) => sum + val, 0) / this.metrics.pool.utilization.length
      : 0;
    
    return {
      timestamp: new Date(),
      connection: {
        isConnected: connectionStats.isConnected,
        readyState: connectionStats.readyState,
        success: this.metrics.connection.success,
        failures: this.metrics.connection.failures,
        reconnects: this.metrics.connection.reconnects,
        uptime: connectionStats.uptime
      },
      query: {
        total: this.metrics.query.total,
        successful: this.metrics.query.successful,
        failed: this.metrics.query.failed,
        successRate: this.metrics.query.total > 0 
          ? this.metrics.query.successful / this.metrics.query.total 
          : 1
      },
      pool: {
        maxSize: connectionStats.poolSize,
        utilization: avgPoolUtilization
      },
      latency: {
        avgQuery: avgQueryLatency,
        avgConnection: avgConnectionLatency
      }
    };
  }

  /**
   * Get detailed metrics history
   * @param {Object} options - Options for filtering metrics
   * @param {string} options.type - Type of metrics to retrieve (connection, query, pool, latency)
   * @param {number} options.limit - Maximum number of records to retrieve
   * @param {Date} options.startDate - Start date for filtering
   * @param {Date} options.endDate - End date for filtering
   * @returns {Object} Detailed metrics history
   */
  getDetailedMetrics(options = {}) {
    const { type = 'all', limit = 100, startDate, endDate } = options;
    
    // Filter function for date range
    const dateFilter = (event) => {
      if (!event.timestamp) return false;
      const timestamp = new Date(event.timestamp);
      if (startDate && timestamp < new Date(startDate)) return false;
      if (endDate && timestamp > new Date(endDate)) return false;
      return true;
    };
    
    // Get metrics based on type
    let result = {};
    
    if (type === 'all' || type === 'connection') {
      result.connection = {
        success: this.metrics.connection.success,
        failures: this.metrics.connection.failures,
        reconnects: this.metrics.connection.reconnects,
        history: this.metrics.connection.history
          .filter(dateFilter)
          .slice(0, limit)
      };
    }
    
    if (type === 'all' || type === 'query') {
      result.query = {
        total: this.metrics.query.total,
        successful: this.metrics.query.successful,
        failed: this.metrics.query.failed,
        history: this.metrics.query.history
          .filter(dateFilter)
          .slice(0, limit)
      };
    }
    
    if (type === 'all' || type === 'pool') {
      result.pool = {
        utilization: this.metrics.pool.utilization.slice(-limit),
        history: this.metrics.pool.history
          .filter(dateFilter)
          .slice(0, limit)
      };
    }
    
    if (type === 'all' || type === 'latency') {
      result.latency = {
        connection: this.metrics.latency.connection.slice(-limit),
        query: this.metrics.latency.query.slice(-limit),
        history: this.metrics.latency.history
          .filter(dateFilter)
          .slice(0, limit)
      };
    }
    
    if (type === 'all' || type === 'timeSeries') {
      result.timeSeries = {
        hourly: this.metrics.timeSeries.hourly
          .filter(dateFilter)
          .slice(0, limit),
        daily: this.metrics.timeSeries.daily
          .filter(dateFilter)
          .slice(0, limit)
      };
    }
    
    return result;
  }

  /**
   * Get time series metrics for charting
   * @param {string} period - Period for time series (hourly or daily)
   * @param {number} limit - Maximum number of records to retrieve
   * @returns {Object} Time series metrics
   */
  getTimeSeriesMetrics(period = 'hourly', limit = 24) {
    const timeSeries = period === 'daily' 
      ? this.metrics.timeSeries.daily.slice(0, limit)
      : this.metrics.timeSeries.hourly.slice(0, limit);
    
    // Format for charting
    const timestamps = timeSeries.map(entry => entry.timestamp);
    const queryLatency = timeSeries.map(entry => entry.latency.avgQuery);
    const connectionLatency = timeSeries.map(entry => entry.latency.avgConnection);
    const poolUtilization = timeSeries.map(entry => entry.pool.avgUtilization);
    const successRate = timeSeries.map(entry => entry.query.successRate);
    
    return {
      period,
      timestamps,
      series: {
        queryLatency,
        connectionLatency,
        poolUtilization,
        successRate
      },
      rawData: timeSeries
    };
  }
}

module.exports = MetricsCollectionService;