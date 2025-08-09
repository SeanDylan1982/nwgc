/**
 * HealthCheckService.js
 * A service for monitoring and managing database health checks and metrics collection.
 */
const EventEmitter = require('events');
const ConnectionHealthMonitor = require('./ConnectionHealthMonitor');

class HealthCheckService extends EventEmitter {
  /**
   * Create a new HealthCheckService instance
   * @param {Object} dbService - The DatabaseService instance to monitor
   * @param {Object} config - Configuration options
   */
  constructor(dbService, config = {}) {
    super();
    this.dbService = dbService;
    this.config = {
      checkIntervalMs: config.checkIntervalMs || 30000,
      unhealthyThreshold: config.unhealthyThreshold || 3,
      alertThreshold: config.alertThreshold || 5,
      latencyThresholdMs: config.latencyThresholdMs || 500,
      criticalLatencyMs: config.criticalLatencyMs || 2000,
      maxErrorRate: config.maxErrorRate || 0.1,
      metricsRetentionCount: config.metricsRetentionCount || 100,
      alertWebhookUrl: config.alertWebhookUrl || process.env.ALERT_WEBHOOK_URL,
      enableAlerts: config.enableAlerts !== undefined ? config.enableAlerts : true
    };
    
    // Initialize the connection monitor
    this.monitor = new ConnectionHealthMonitor(dbService, this.config);
    
    // Initialize metrics storage
    this.metrics = {
      history: [],
      alerts: [],
      status: {
        isHealthy: true,
        lastStatusChange: new Date(),
        currentStatus: 'healthy',
        statusHistory: []
      }
    };
    
    // Set up event listeners
    this._setupEventListeners();
  }

  /**
   * Set up event listeners for the connection monitor
   * @private
   */
  _setupEventListeners() {
    // Forward relevant events from the monitor
    this.monitor.on('healthy', (data) => {
      this._updateStatus('healthy');
      this._storeMetrics({ type: 'healthy', ...data });
      this.emit('healthy', data);
    });
    
    this.monitor.on('warning', (data) => {
      this._updateStatus('warning');
      this._storeMetrics({ type: 'warning', ...data });
      this.emit('warning', data);
    });
    
    this.monitor.on('unhealthy', (data) => {
      this._updateStatus('unhealthy');
      this._storeMetrics({ type: 'unhealthy', ...data });
      this.emit('unhealthy', data);
    });
    
    this.monitor.on('alert', (data) => {
      this._storeAlert(data);
      
      if (this.config.enableAlerts) {
        this._sendAlert(data);
      }
      
      this.emit('alert', data);
    });
    
    this.monitor.on('recovery', (data) => {
      this._updateStatus('healthy');
      this._storeMetrics({ type: 'recovery', ...data });
      this.emit('recovery', data);
    });
  }

  /**
   * Update the current status
   * @param {string} status - The new status
   * @private
   */
  _updateStatus(status) {
    const currentStatus = this.metrics.status.currentStatus;
    
    if (currentStatus !== status) {
      const timestamp = new Date();
      
      // Update status history
      this.metrics.status.statusHistory.push({
        from: currentStatus,
        to: status,
        timestamp
      });
      
      // Trim history if needed
      if (this.metrics.status.statusHistory.length > 50) {
        this.metrics.status.statusHistory.shift();
      }
      
      // Update current status
      this.metrics.status.currentStatus = status;
      this.metrics.status.lastStatusChange = timestamp;
      this.metrics.status.isHealthy = status === 'healthy';
      
      // Emit status change event
      this.emit('status_change', {
        from: currentStatus,
        to: status,
        timestamp
      });
    }
  }

  /**
   * Store metrics in history
   * @param {Object} data - Metrics data
   * @private
   */
  _storeMetrics(data) {
    const metrics = {
      timestamp: new Date(),
      type: data.type,
      dbStats: this.dbService.getConnectionStats(),
      monitorStats: this.monitor.getMetrics()
    };
    
    this.metrics.history.push(metrics);
    
    // Trim history if needed
    if (this.metrics.history.length > this.config.metricsRetentionCount) {
      this.metrics.history.shift();
    }
  }

  /**
   * Store alert in history
   * @param {Object} data - Alert data
   * @private
   */
  _storeAlert(data) {
    const alert = {
      timestamp: new Date(),
      level: data.level || 'warning',
      message: data.message,
      data: data.data
    };
    
    this.metrics.alerts.push(alert);
    
    // Trim alerts if needed
    if (this.metrics.alerts.length > 50) {
      this.metrics.alerts.shift();
    }
  }

  /**
   * Send an alert to configured notification channels
   * @param {Object} data - Alert data
   * @private
   */
  _sendAlert(data) {
    console.error(`[ALERT] ${data.level.toUpperCase()}: ${data.message}`);
    
    // If webhook URL is configured, send alert
    if (this.config.alertWebhookUrl) {
      // In a real implementation, this would send an HTTP request to the webhook
      console.log(`Would send alert to webhook: ${this.config.alertWebhookUrl}`);
      
      // For now, just log it
      console.log('Alert payload:', {
        level: data.level,
        message: data.message,
        timestamp: new Date().toISOString(),
        metrics: data.metrics
      });
    }
  }

  /**
   * Start health monitoring
   * @returns {HealthCheckService} this instance for chaining
   */
  start() {
    this.monitor.startMonitoring();
    console.log('Health check service started');
    return this;
  }

  /**
   * Stop health monitoring
   * @returns {HealthCheckService} this instance for chaining
   */
  stop() {
    this.monitor.stopMonitoring();
    console.log('Health check service stopped');
    return this;
  }

  /**
   * Run a manual health check
   * @returns {Promise<Object>} Health check results
   */
  async checkHealth() {
    return this.monitor.checkHealth();
  }

  /**
   * Get current health metrics
   * @returns {Object} Health metrics
   */
  getMetrics() {
    return {
      currentStatus: this.metrics.status.currentStatus,
      isHealthy: this.metrics.status.isHealthy,
      lastStatusChange: this.metrics.status.lastStatusChange,
      dbStats: this.dbService.getConnectionStats(),
      monitorStats: this.monitor.getMetrics(),
      alertCount: this.metrics.alerts.length,
      recentAlerts: this.metrics.alerts.slice(-5)
    };
  }

  /**
   * Get detailed health metrics history
   * @param {number} limit - Maximum number of history entries to return
   * @returns {Object} Detailed health metrics
   */
  getDetailedMetrics(limit = 20) {
    return {
      status: this.metrics.status,
      history: this.metrics.history.slice(-limit),
      alerts: this.metrics.alerts.slice(-limit),
      dbStats: this.dbService.getConnectionStats(),
      monitorStats: this.monitor.getMetrics()
    };
  }

  /**
   * Get all alerts
   * @param {number} limit - Maximum number of alerts to return
   * @returns {Array} Alert history
   */
  getAlerts(limit = 50) {
    return this.metrics.alerts.slice(-limit);
  }
}

module.exports = HealthCheckService;