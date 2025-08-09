const express = require('express');
const router = express.Router();

/**
 * Health routes that use the services initialized in the main server
 * This ensures we use the same service instances across the application
 */

// Basic health check endpoint for connectivity testing
router.get('/', (req, res) => {
  const healthCheckService = req.app.get('healthCheckService');
  
  if (!healthCheckService) {
    return res.status(503).json({
      status: 'error',
      message: 'Health check service not initialized',
      timestamp: new Date().toISOString()
    });
  }
  
  const metrics = healthCheckService.getMetrics();
  const status = metrics.isHealthy ? 'ok' : 'degraded';
  
  res.status(metrics.isHealthy ? 200 : 503).json({
    status,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// HEAD request for lightweight connectivity check
router.head('/', (req, res) => {
  res.status(200).end();
});

// Detailed health check including database status
router.get('/detailed', async (req, res) => {
  try {
    const healthCheckService = req.app.get('healthCheckService');
    
    if (!healthCheckService) {
      return res.status(503).json({
        status: 'error',
        message: 'Health check service not initialized',
        timestamp: new Date().toISOString()
      });
    }
    
    // Run a manual health check
    await healthCheckService.checkHealth();
    
    // Get metrics
    const metrics = healthCheckService.getMetrics();
    const statusCode = metrics.isHealthy ? 200 : 503;
    
    res.status(statusCode).json({
      status: metrics.currentStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: {
        status: metrics.currentStatus,
        connectionState: metrics.dbStats.readyState,
        metrics: metrics.dbStats
      },
      alerts: metrics.recentAlerts
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: {
        status: 'error',
        error: error.message
      }
    });
  }
});

// Database-specific health check
router.get('/database', async (req, res) => {
  try {
    const healthCheckService = req.app.get('healthCheckService');
    
    if (!healthCheckService) {
      return res.status(503).json({
        status: 'error',
        message: 'Health check service not initialized',
        timestamp: new Date().toISOString()
      });
    }
    
    const result = await healthCheckService.checkHealth();
    const metrics = healthCheckService.getMetrics();
    const statusCode = metrics.isHealthy ? 200 : 503;
    
    res.status(statusCode).json({
      status: metrics.currentStatus,
      timestamp: new Date().toISOString(),
      dbStats: metrics.dbStats,
      checkResult: result
    });
  } catch (error) {
    // Use our enhanced error classification system
    const { createErrorResponse } = require('../utils/errorHandler');
    const { enhanceError } = require('../utils/errorClassification');
    
    // Enhance the error with our classification
    const enhancedError = enhanceError(error);
    
    // Create appropriate response
    const { statusCode, body } = createErrorResponse(enhancedError);
    
    res.status(statusCode).json({
      ...body,
      timestamp: new Date().toISOString()
    });
  }
});

// Get detailed metrics history
router.get('/metrics', async (req, res) => {
  try {
    const healthCheckService = req.app.get('healthCheckService');
    
    if (!healthCheckService) {
      return res.status(503).json({
        status: 'error',
        message: 'Health check service not initialized',
        timestamp: new Date().toISOString()
      });
    }
    
    const limit = parseInt(req.query.limit || '20');
    const metrics = healthCheckService.getDetailedMetrics(limit);
    
    res.status(200).json(metrics);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get alert history
router.get('/alerts', async (req, res) => {
  try {
    const healthCheckService = req.app.get('healthCheckService');
    
    if (!healthCheckService) {
      return res.status(503).json({
        status: 'error',
        message: 'Health check service not initialized',
        timestamp: new Date().toISOString()
      });
    }
    
    const limit = parseInt(req.query.limit || '50');
    const alerts = healthCheckService.getAlerts(limit);
    
    res.status(200).json({
      count: alerts.length,
      alerts
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get recovery status
router.get('/recovery', async (req, res) => {
  try {
    const recoveryManager = req.app.get('recoveryManager');
    
    if (!recoveryManager) {
      return res.status(503).json({
        status: 'error',
        message: 'Recovery manager not initialized',
        timestamp: new Date().toISOString()
      });
    }
    
    const status = recoveryManager.getStatus();
    
    res.status(200).json({
      timestamp: new Date().toISOString(),
      ...status
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Trigger manual recovery
router.post('/recovery', async (req, res) => {
  try {
    const recoveryManager = req.app.get('recoveryManager');
    
    if (!recoveryManager) {
      return res.status(503).json({
        status: 'error',
        message: 'Recovery manager not initialized',
        timestamp: new Date().toISOString()
      });
    }
    
    const result = await recoveryManager.attemptRecovery();
    
    res.status(200).json({
      timestamp: new Date().toISOString(),
      success: result,
      message: result ? 'Recovery successful' : 'Recovery failed or skipped',
      recoveryState: recoveryManager.recoveryState
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Reset circuit breakers
router.post('/circuit-breakers/reset', async (req, res) => {
  try {
    const recoveryManager = req.app.get('recoveryManager');
    
    if (!recoveryManager) {
      return res.status(503).json({
        status: 'error',
        message: 'Recovery manager not initialized',
        timestamp: new Date().toISOString()
      });
    }
    
    recoveryManager.resetCircuitBreakers();
    
    res.status(200).json({
      timestamp: new Date().toISOString(),
      message: 'Circuit breakers reset successfully',
      circuitBreakers: recoveryManager.getStatus().circuitBreakers
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Change streams health check
router.get('/change-streams', async (req, res) => {
  try {
    const realTimeService = req.app.get('realTimeService');
    
    if (!realTimeService) {
      return res.status(503).json({ 
        status: 'unavailable',
        message: 'Real-time service not initialized'
      });
    }
    
    const status = realTimeService.getStatus();
    res.json({
      status: 'available',
      initialized: status.initialized,
      activeStreams: status.changeStreams.activeStreams,
      collections: status.changeStreams.collections,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Restart change streams
router.post('/change-streams/restart', async (req, res) => {
  try {
    const realTimeService = req.app.get('realTimeService');
    
    if (!realTimeService) {
      return res.status(503).json({ 
        status: 'unavailable',
        message: 'Real-time service not initialized'
      });
    }
    
    // Close and reinitialize
    await realTimeService.close();
    await realTimeService.initialize();
    
    const status = realTimeService.getStatus();
    res.json({
      status: 'restarted',
      initialized: status.initialized,
      activeStreams: status.changeStreams.activeStreams,
      collections: status.changeStreams.collections,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Export the router
module.exports = router;