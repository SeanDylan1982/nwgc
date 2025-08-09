/**
 * ConnectionHealthMonitor.js
 * A service for monitoring MongoDB connection health and taking corrective actions.
 */
const EventEmitter = require('events');

class ConnectionHealthMonitor extends EventEmitter {
  /**
   * Create a new ConnectionHealthMonitor instance
   * @param {Object} dbService - The DatabaseService instance to monitor
   * @param {Object} config - Configuration options
   * @param {number} config.checkIntervalMs - Interval between health checks in milliseconds
   * @param {number} config.unhealthyThreshold - Number of consecutive failures before connection is considered unhealthy
   * @param {number} config.alertThreshold - Number of consecutive failures before alerting
   * @param {number} config.latencyThresholdMs - Threshold for high latency warning in milliseconds
   * @param {number} config.criticalLatencyMs - Threshold for critical latency alert in milliseconds
   * @param {number} config.maxErrorRate - Maximum acceptable error rate (0-1)
   */
  constructor(dbService, config = {}) {
    super();
    this.dbService = dbService;
    this.checkIntervalMs = config.checkIntervalMs || 30000;
    this.unhealthyThreshold = config.unhealthyThreshold || 3;
    this.alertThreshold = config.alertThreshold || 5;
    this.latencyThresholdMs = config.latencyThresholdMs || 500;
    this.criticalLatencyMs = config.criticalLatencyMs || 2000;
    this.maxErrorRate = config.maxErrorRate || 0.1; // 10% error rate
    
    this.consecutiveFailures = 0;
    this.consecutiveWarnings = 0;
    this.interval = null;
    this.isMonitoring = false;
    this.metrics = {
      checks: 0,
      failures: 0,
      warnings: 0,
      recoveries: 0,
      lastCheckTime: null,
      lastFailureTime: null,
      lastWarningTime: null,
      lastRecoveryTime: null,
      latencyHistory: [],
      errorRateHistory: []
    };
    
    // Listen to database service events
    this._setupEventListeners();
  }

  /**
   * Set up event listeners for the database service
   * @private
   */
  _setupEventListeners() {
    // Listen for health-related events from the database service
    this.dbService.on('healthy', (data) => {
      if (this.consecutiveFailures > 0) {
        this.metrics.recoveries++;
        this.metrics.lastRecoveryTime = new Date();
        this.consecutiveFailures = 0;
        this.emit('recovery', { 
          message: 'Database connection recovered after failures',
          metrics: this.getMetrics()
        });
      }
      
      // Track latency
      this.metrics.latencyHistory.push(data.latency);
      if (this.metrics.latencyHistory.length > 100) {
        this.metrics.latencyHistory.shift(); // Keep only the last 100 measurements
      }
    });
    
    this.dbService.on('warning', (data) => {
      this.consecutiveWarnings++;
      this.metrics.warnings++;
      this.metrics.lastWarningTime = new Date();
      
      if (this.consecutiveWarnings >= this.alertThreshold) {
        this.emit('alert', {
          level: 'warning',
          message: `Database performance degraded: ${data.reason}`,
          value: data.value,
          metrics: this.getMetrics()
        });
      }
    });
    
    this.dbService.on('unhealthy', (data) => {
      this.consecutiveFailures++;
      this.metrics.failures++;
      this.metrics.lastFailureTime = new Date();
      
      if (this.consecutiveFailures >= this.unhealthyThreshold) {
        this.emit('unhealthy', {
          message: `Database connection unhealthy: ${data.reason}`,
          error: data.error,
          metrics: this.getMetrics()
        });
        
        if (this.consecutiveFailures >= this.alertThreshold) {
          this.emit('alert', {
            level: 'critical',
            message: `Database connection critical: ${data.reason}`,
            error: data.error,
            metrics: this.getMetrics()
          });
        }
      }
    });
    
    this.dbService.on('error', (error) => {
      // Track error rate
      const stats = this.dbService.getConnectionStats();
      const errorRate = stats.failures / (stats.operations || 1);
      
      this.metrics.errorRateHistory.push(errorRate);
      if (this.metrics.errorRateHistory.length > 20) {
        this.metrics.errorRateHistory.shift(); // Keep only the last 20 measurements
      }
      
      // Check if error rate exceeds threshold
      const avgErrorRate = this.metrics.errorRateHistory.reduce((sum, rate) => sum + rate, 0) / 
                          this.metrics.errorRateHistory.length;
      
      if (avgErrorRate > this.maxErrorRate) {
        this.emit('alert', {
          level: 'warning',
          message: `High database error rate detected: ${(avgErrorRate * 100).toFixed(2)}%`,
          metrics: this.getMetrics()
        });
      }
    });
  }

  /**
   * Start monitoring the database connection
   * @returns {ConnectionHealthMonitor} this instance for chaining
   */
  startMonitoring() {
    if (this.isMonitoring) {
      return this;
    }
    
    this.isMonitoring = true;
    this.interval = setInterval(() => this.checkHealth(), this.checkIntervalMs);
    
    // Run an initial check immediately
    this.checkHealth();
    
    console.log(`Database health monitoring started (interval: ${this.checkIntervalMs}ms)`);
    return this;
  }

  /**
   * Stop monitoring the database connection
   * @returns {ConnectionHealthMonitor} this instance for chaining
   */
  stopMonitoring() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    
    this.isMonitoring = false;
    console.log('Database health monitoring stopped');
    return this;
  }

  /**
   * Check the health of the database connection
   * @returns {Promise<Object>} Health check results
   */
  async checkHealth() {
    this.metrics.checks++;
    this.metrics.lastCheckTime = new Date();
    
    try {
      // Get connection stats
      const stats = this.dbService.getConnectionStats();
      
      // Check connection state
      if (!stats.isConnected || stats.readyState !== 1) {
        this.handleUnhealthyConnection({
          reason: 'connection_not_ready',
          readyState: stats.readyState
        });
        return { healthy: false, reason: 'connection_not_ready' };
      }
      
      // Check latency
      if (stats.avgQueryLatency > this.criticalLatencyMs) {
        this.emit('alert', {
          level: 'critical',
          message: `Critical database latency: ${stats.avgQueryLatency}ms`,
          metrics: this.getMetrics()
        });
        return { healthy: false, reason: 'critical_latency', latency: stats.avgQueryLatency };
      } else if (stats.avgQueryLatency > this.latencyThresholdMs) {
        this.emit('warning', {
          message: `High database latency: ${stats.avgQueryLatency}ms`,
          metrics: this.getMetrics()
        });
        return { healthy: true, warning: true, reason: 'high_latency', latency: stats.avgQueryLatency };
      }
      
      // Check error rate
      const errorRate = stats.failures / (stats.operations || 1);
      if (errorRate > this.maxErrorRate) {
        this.emit('warning', {
          message: `High database error rate: ${(errorRate * 100).toFixed(2)}%`,
          metrics: this.getMetrics()
        });
        return { healthy: true, warning: true, reason: 'high_error_rate', errorRate };
      }
      
      // All checks passed
      this.emit('healthy', {
        message: 'Database connection is healthy',
        metrics: this.getMetrics()
      });
      
      return { healthy: true };
    } catch (error) {
      this.handleUnhealthyConnection({
        reason: 'health_check_failed',
        error
      });
      
      return { healthy: false, reason: 'health_check_failed', error };
    }
  }

  /**
   * Handle an unhealthy connection
   * @param {Object} data - Unhealthy connection data
   * @private
   */
  handleUnhealthyConnection(data) {
    this.consecutiveFailures++;
    this.metrics.failures++;
    this.metrics.lastFailureTime = new Date();
    
    // Emit unhealthy event if threshold reached
    if (this.consecutiveFailures >= this.unhealthyThreshold) {
      this.emit('unhealthy', {
        message: `Database connection unhealthy: ${data.reason}`,
        data,
        metrics: this.getMetrics()
      });
      
      // Emit alert if alert threshold reached
      if (this.consecutiveFailures >= this.alertThreshold) {
        this.alertAdministrators(data);
      }
      
      // Try to recover the connection
      this.attemptRecovery();
    }
  }

  /**
   * Alert administrators about critical database issues
   * @param {Object} data - Alert data
   * @private
   */
  alertAdministrators(data) {
    this.emit('alert', {
      level: 'critical',
      message: `Database connection critical: ${data.reason}`,
      data,
      consecutiveFailures: this.consecutiveFailures,
      metrics: this.getMetrics()
    });
    
    // Log the alert
    console.error(`[CRITICAL] Database connection alert: ${data.reason}`, {
      consecutiveFailures: this.consecutiveFailures,
      lastFailureTime: this.metrics.lastFailureTime,
      data
    });
    
    // In a real-world scenario, this would send notifications via email, SMS, etc.
    // For now, we'll just log it
  }

  /**
   * Attempt to recover the database connection
   * @returns {Promise<boolean>} Whether recovery was successful
   */
  async attemptRecovery() {
    try {
      console.log('Attempting to recover database connection...');
      
      // Disconnect and reconnect
      await this.dbService.disconnect();
      await this.dbService.connect();
      
      this.consecutiveFailures = 0;
      this.metrics.recoveries++;
      this.metrics.lastRecoveryTime = new Date();
      
      this.emit('recovery', {
        message: 'Database connection recovered successfully',
        metrics: this.getMetrics()
      });
      
      console.log('Database connection recovered successfully');
      return true;
    } catch (error) {
      console.error('Failed to recover database connection:', error);
      
      this.emit('recovery_failed', {
        message: 'Failed to recover database connection',
        error,
        metrics: this.getMetrics()
      });
      
      return false;
    }
  }

  /**
   * Get monitoring metrics
   * @returns {Object} Monitoring metrics
   */
  getMetrics() {
    const avgLatency = this.metrics.latencyHistory.length > 0
      ? this.metrics.latencyHistory.reduce((sum, val) => sum + val, 0) / this.metrics.latencyHistory.length
      : 0;
    
    const avgErrorRate = this.metrics.errorRateHistory.length > 0
      ? this.metrics.errorRateHistory.reduce((sum, rate) => sum + rate, 0) / this.metrics.errorRateHistory.length
      : 0;
    
    return {
      isMonitoring: this.isMonitoring,
      consecutiveFailures: this.consecutiveFailures,
      consecutiveWarnings: this.consecutiveWarnings,
      checks: this.metrics.checks,
      failures: this.metrics.failures,
      warnings: this.metrics.warnings,
      recoveries: this.metrics.recoveries,
      lastCheckTime: this.metrics.lastCheckTime,
      lastFailureTime: this.metrics.lastFailureTime,
      lastWarningTime: this.metrics.lastWarningTime,
      lastRecoveryTime: this.metrics.lastRecoveryTime,
      avgLatency: Math.round(avgLatency),
      avgErrorRate: avgErrorRate,
      dbServiceStats: this.dbService.getConnectionStats()
    };
  }
}

module.exports = ConnectionHealthMonitor;