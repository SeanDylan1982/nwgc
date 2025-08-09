/**
 * Database metrics routes
 * Provides endpoints for accessing MongoDB connection metrics
 */
const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/adminAuth');
const { dbService } = require('../config/database');
const MetricsCollectionService = require('../services/MetricsCollectionService');

// Create a singleton instance of the metrics collection service
const metricsService = new MetricsCollectionService(dbService, {
  metricsRetentionPeriod: parseInt(process.env.METRICS_RETENTION_PERIOD_MS || (24 * 60 * 60 * 1000)), // 24 hours
  collectionIntervalMs: parseInt(process.env.METRICS_COLLECTION_INTERVAL_MS || 60000), // 1 minute
  detailedMetricsLimit: parseInt(process.env.DETAILED_METRICS_LIMIT || 100),
  aggregationIntervalMs: parseInt(process.env.METRICS_AGGREGATION_INTERVAL_MS || (5 * 60 * 1000)), // 5 minutes
  enableAggregation: process.env.ENABLE_METRICS_AGGREGATION !== 'false'
});

// Start metrics collection
metricsService.startCollection();

// Apply authentication and admin role requirement to all routes
router.use(authenticateToken);
router.use(requireAdmin);

// Get current metrics summary
router.get('/', async (req, res) => {
  try {
    const metrics = metricsService.getMetrics();
    
    res.json({
      timestamp: new Date().toISOString(),
      metrics
    });
  } catch (error) {
    console.error('Error fetching metrics:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve metrics',
      error: error.message
    });
  }
});

// Get detailed metrics history
router.get('/detailed', async (req, res) => {
  try {
    const { type, limit, startDate, endDate } = req.query;
    
    const options = {
      type: type || 'all',
      limit: parseInt(limit || 100),
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined
    };
    
    const detailedMetrics = metricsService.getDetailedMetrics(options);
    
    res.json({
      timestamp: new Date().toISOString(),
      options,
      metrics: detailedMetrics
    });
  } catch (error) {
    console.error('Error fetching detailed metrics:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve detailed metrics',
      error: error.message
    });
  }
});

// Get time series metrics for charting
router.get('/time-series', async (req, res) => {
  try {
    const { period, limit } = req.query;
    
    const timeSeriesMetrics = metricsService.getTimeSeriesMetrics(
      period || 'hourly',
      parseInt(limit || 24)
    );
    
    res.json({
      timestamp: new Date().toISOString(),
      ...timeSeriesMetrics
    });
  } catch (error) {
    console.error('Error fetching time series metrics:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve time series metrics',
      error: error.message
    });
  }
});

// Get connection metrics
router.get('/connection', async (req, res) => {
  try {
    const { limit } = req.query;
    
    const detailedMetrics = metricsService.getDetailedMetrics({
      type: 'connection',
      limit: parseInt(limit || 100)
    });
    
    res.json({
      timestamp: new Date().toISOString(),
      metrics: detailedMetrics.connection
    });
  } catch (error) {
    console.error('Error fetching connection metrics:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve connection metrics',
      error: error.message
    });
  }
});

// Get query performance metrics
router.get('/query', async (req, res) => {
  try {
    const { limit } = req.query;
    
    const detailedMetrics = metricsService.getDetailedMetrics({
      type: 'query',
      limit: parseInt(limit || 100)
    });
    
    res.json({
      timestamp: new Date().toISOString(),
      metrics: detailedMetrics.query
    });
  } catch (error) {
    console.error('Error fetching query metrics:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve query metrics',
      error: error.message
    });
  }
});

// Get connection pool metrics
router.get('/pool', async (req, res) => {
  try {
    const { limit } = req.query;
    
    const detailedMetrics = metricsService.getDetailedMetrics({
      type: 'pool',
      limit: parseInt(limit || 100)
    });
    
    res.json({
      timestamp: new Date().toISOString(),
      metrics: detailedMetrics.pool
    });
  } catch (error) {
    console.error('Error fetching pool metrics:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve pool metrics',
      error: error.message
    });
  }
});

// Get latency metrics
router.get('/latency', async (req, res) => {
  try {
    const { limit } = req.query;
    
    const detailedMetrics = metricsService.getDetailedMetrics({
      type: 'latency',
      limit: parseInt(limit || 100)
    });
    
    res.json({
      timestamp: new Date().toISOString(),
      metrics: detailedMetrics.latency
    });
  } catch (error) {
    console.error('Error fetching latency metrics:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve latency metrics',
      error: error.message
    });
  }
});

// Export the router and service
module.exports = router;
module.exports.metricsService = metricsService;