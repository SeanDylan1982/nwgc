# Health Check Service Documentation

## Overview

The Health Check Service provides comprehensive monitoring and alerting for MongoDB database connections. It continuously monitors connection health, collects performance metrics, and provides alerting when issues are detected.

## Components

### 1. HealthCheckService

The main service that coordinates health monitoring and provides an API for the application to interact with.

```javascript
const healthCheckService = new HealthCheckService(dbService, {
  checkIntervalMs: 30000,
  unhealthyThreshold: 3,
  alertThreshold: 5,
  latencyThresholdMs: 500,
  criticalLatencyMs: 2000,
  maxErrorRate: 0.1,
  enableAlerts: true
});

// Start monitoring
healthCheckService.start();

// Get current metrics
const metrics = healthCheckService.getMetrics();

// Run a manual health check
const healthStatus = await healthCheckService.checkHealth();
```

### 2. ConnectionHealthMonitor

A lower-level service that performs the actual health checks and monitors the database connection.

```javascript
const monitor = new ConnectionHealthMonitor(dbService, {
  checkIntervalMs: 30000,
  unhealthyThreshold: 3,
  alertThreshold: 5
});

// Start monitoring
monitor.startMonitoring();

// Check health manually
const healthStatus = await monitor.checkHealth();
```

## Configuration Options

| Option | Description | Default |
|--------|-------------|---------|
| `checkIntervalMs` | Interval between health checks in milliseconds | 30000 |
| `unhealthyThreshold` | Number of consecutive failures before connection is considered unhealthy | 3 |
| `alertThreshold` | Number of consecutive failures before alerting | 5 |
| `latencyThresholdMs` | Threshold for high latency warning in milliseconds | 500 |
| `criticalLatencyMs` | Threshold for critical latency alert in milliseconds | 2000 |
| `maxErrorRate` | Maximum acceptable error rate (0-1) | 0.1 |
| `enableAlerts` | Whether to enable alerts | true |
| `alertWebhookUrl` | URL to send alerts to | null |

## API Endpoints

### GET /api/health

Basic health check endpoint that returns a simple status.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2023-07-22T12:34:56.789Z",
  "uptime": 3600
}
```

### GET /api/health/detailed

Detailed health check that includes database status and metrics.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2023-07-22T12:34:56.789Z",
  "uptime": 3600,
  "database": {
    "status": "healthy",
    "connectionState": 1,
    "metrics": {
      "isConnected": true,
      "readyState": 1,
      "operations": 1000,
      "failures": 5,
      "reconnects": 2,
      "avgConnectionLatency": 50,
      "avgQueryLatency": 100
    }
  },
  "alerts": []
}
```

### GET /api/health/database

Database-specific health check.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2023-07-22T12:34:56.789Z",
  "dbStats": {
    "isConnected": true,
    "readyState": 1,
    "operations": 1000,
    "failures": 5,
    "reconnects": 2,
    "avgConnectionLatency": 50,
    "avgQueryLatency": 100
  },
  "checkResult": {
    "healthy": true
  }
}
```

### GET /api/health/metrics

Get detailed metrics history.

**Query Parameters:**
- `limit` - Maximum number of history entries to return (default: 20)

**Response:**
```json
{
  "status": {
    "isHealthy": true,
    "lastStatusChange": "2023-07-22T12:34:56.789Z",
    "currentStatus": "healthy",
    "statusHistory": [
      {
        "from": "warning",
        "to": "healthy",
        "timestamp": "2023-07-22T12:30:00.000Z"
      }
    ]
  },
  "history": [...],
  "alerts": [...],
  "dbStats": {...},
  "monitorStats": {...}
}
```

### GET /api/health/alerts

Get alert history.

**Query Parameters:**
- `limit` - Maximum number of alerts to return (default: 50)

**Response:**
```json
{
  "count": 2,
  "alerts": [
    {
      "timestamp": "2023-07-22T12:00:00.000Z",
      "level": "warning",
      "message": "High database latency: 600ms"
    },
    {
      "timestamp": "2023-07-22T11:45:00.000Z",
      "level": "critical",
      "message": "Database connection critical: connection_lost"
    }
  ]
}
```

## Events

The HealthCheckService emits the following events:

- `healthy` - Emitted when the database connection is healthy
- `warning` - Emitted when a warning condition is detected
- `unhealthy` - Emitted when the database connection is unhealthy
- `alert` - Emitted when an alert condition is detected
- `recovery` - Emitted when the database connection recovers from an unhealthy state
- `status_change` - Emitted when the status changes

## Integration with Application

The health check service is automatically started when the server starts. It monitors the database connection and provides health metrics through the API endpoints.

To access the health check service in your code:

```javascript
const { dbService } = require('../config/database');
const HealthCheckService = require('../services/HealthCheckService');

// Create a health check service instance
const healthCheckService = new HealthCheckService(dbService);

// Start monitoring
healthCheckService.start();

// Listen for events
healthCheckService.on('alert', (data) => {
  console.error(`Database alert: ${data.message}`);
});

// Get current metrics
const metrics = healthCheckService.getMetrics();
```

## Environment Variables

The following environment variables can be used to configure the health check service:

```
HEALTH_CHECK_INTERVAL_MS=30000
HEALTH_UNHEALTHY_THRESHOLD=3
HEALTH_ALERT_THRESHOLD=5
HEALTH_LATENCY_THRESHOLD_MS=500
HEALTH_CRITICAL_LATENCY_MS=2000
HEALTH_MAX_ERROR_RATE=0.1
HEALTH_ENABLE_ALERTS=true
ALERT_WEBHOOK_URL=
```