# MongoDB Database Configuration Guide

This guide provides detailed information about the MongoDB connection configuration options available in the Neighborhood Watch application. The application uses environment-specific configurations to optimize MongoDB connections for different scenarios.

## Configuration Overview

The application uses a layered configuration approach with the following precedence (highest to lowest):

1. Custom configuration passed to `getConfig()`
2. Environment variables
3. High-traffic configuration (if enabled)
4. Environment-specific configuration (development, testing, production)
5. Base configuration

## Environment-Specific Configurations

### Development Environment

Optimized for local development with faster feedback and more verbose logging.

```javascript
{
  minPoolSize: 2,
  maxPoolSize: 10,
  socketTimeoutMS: 30000,
  connectTimeoutMS: 20000,
  writeConcern: '1',
  ssl: false,
  autoIndex: true,
  logLevel: 'debug',
  monitorCommands: true,
  // ... additional settings
}
```

### Testing Environment

Configured for automated tests with minimal resources and faster timeouts.

```javascript
{
  minPoolSize: 1,
  maxPoolSize: 5,
  socketTimeoutMS: 10000,
  connectTimeoutMS: 5000,
  writeConcern: '1',
  ssl: false,
  autoIndex: true,
  maxRetries: 2,
  // ... additional settings
}
```

### Production Environment

Tuned for reliability and performance in production with secure connections.

```javascript
{
  minPoolSize: 10,
  maxPoolSize: 100, // Auto-scaled based on system resources
  socketTimeoutMS: 60000,
  connectTimeoutMS: 30000,
  writeConcern: 'majority',
  ssl: true,
  sslValidate: true,
  autoIndex: false,
  maxRetries: 7,
  // ... additional settings
}
```

### High-Traffic Mode

Enhanced settings for handling peak load scenarios, optimized for throughput.

```javascript
{
  minPoolSize: 20,
  maxPoolSize: 200, // Auto-scaled based on system resources
  socketTimeoutMS: 90000,
  connectTimeoutMS: 45000,
  readPreference: 'nearest',
  maxRetries: 10,
  loadBalanced: true,
  // ... additional settings
}
```

## Configuration Categories

### Connection Pool Settings

| Setting | Description | Default | Recommended |
|---------|-------------|---------|------------|
| `minPoolSize` | Minimum number of connections to keep open | 5 | 2 (dev), 10 (prod) |
| `maxPoolSize` | Maximum number of connections in the pool | 50 | Auto-scaled based on CPU and memory |
| `maxIdleTimeMS` | Maximum time a connection can remain idle | 60000 | 30000 (high traffic) |
| `maxConnecting` | Maximum number of simultaneous connection attempts | 10 | 10 |

### Timeout Settings

| Setting | Description | Default | Recommended |
|---------|-------------|---------|------------|
| `socketTimeoutMS` | How long to wait for responses | 45000 | 30000 (dev), 60000 (prod) |
| `connectTimeoutMS` | How long to wait for initial connection | 30000 | 20000 (dev), 30000 (prod) |
| `serverSelectionTimeoutMS` | How long to wait for server selection | 30000 | 20000 (dev), 45000 (prod) |
| `maxTimeMS` | Maximum time for query execution | 30000 | 10000 (dev), 60000 (prod) |

### Write Concern Settings

| Setting | Description | Default | Recommended |
|---------|-------------|---------|------------|
| `writeConcern` | Write concern level | 'majority' | '1' (dev), 'majority' (prod) |
| `wtimeoutMS` | Write concern timeout | 10000 | 5000 (dev), 15000 (prod) |
| `journal` | Whether to wait for journal commit | true | false (dev), true (prod) |

### Read Preference Settings

| Setting | Description | Default | Recommended |
|---------|-------------|---------|------------|
| `readPreference` | Read preference | 'primaryPreferred' | 'primary' (dev), 'nearest' (high traffic) |
| `readConcernLevel` | Read concern level | 'local' | 'local' (dev), 'majority' (prod) |
| `secondaryAcceptableLatencyMS` | Max acceptable latency for secondary reads | 15 | 15 (prod), 50 (high traffic) |

### SSL/TLS Settings

| Setting | Description | Default | Recommended |
|---------|-------------|---------|------------|
| `ssl` | Whether to use SSL/TLS | false | false (dev), true (prod) |
| `sslValidate` | Whether to validate SSL certificates | true | true |
| `sslCA` | CA certificate | null | Required for SSL |
| `sslCert` | Client certificate | null | Optional for mutual TLS |
| `sslKey` | Client key | null | Optional for mutual TLS |
| `sslPass` | Passphrase for client key | null | If key is encrypted |

### Retry Settings

| Setting | Description | Default | Recommended |
|---------|-------------|---------|------------|
| `maxRetries` | Maximum retry attempts | 5 | 2 (dev), 7 (prod), 10 (high traffic) |
| `initialDelayMs` | Initial delay before first retry | 100 | 50 (dev), 200 (prod) |
| `maxDelayMs` | Maximum delay between retries | 10000 | 1000 (dev), 15000 (prod) |
| `retryReads` | Whether to retry read operations | true | true |
| `retryWrites` | Whether to retry write operations | true | true |

### Monitoring Settings

| Setting | Description | Default | Recommended |
|---------|-------------|---------|------------|
| `monitorCommands` | Whether to monitor commands | false | true (dev), false (prod) |
| `logLevel` | Log level | 'warn' | 'debug' (dev), 'error' (prod) |

### Performance Settings

| Setting | Description | Default | Recommended |
|---------|-------------|---------|------------|
| `compressors` | Compression algorithms | 'zlib' | 'zlib' |
| `zlibCompressionLevel` | Compression level for zlib | 6 | 0 (dev), 6 (prod), 1 (high traffic) |

### Connection Stability Settings

| Setting | Description | Default | Recommended |
|---------|-------------|---------|------------|
| `autoReconnect` | Whether to automatically reconnect | true | true |
| `reconnectTries` | Number of reconnection attempts | 30 | 10 (dev), 30 (prod), 60 (high traffic) |
| `reconnectInterval` | Interval between reconnection attempts | 1000 | 500 (dev), 1000 (prod) |

## High-Traffic Optimization

The application includes special optimizations for high-traffic scenarios. To enable high-traffic mode, set the environment variable:

```
DB_HIGH_TRAFFIC_MODE=true
```

High-traffic mode applies the following optimizations:

1. **Increased Connection Pool**: Larger connection pool to handle more concurrent operations
2. **Performance-Optimized Read Preference**: Uses 'nearest' read preference to minimize latency
3. **Faster Compression**: Uses lower compression level for better throughput
4. **Aggressive Reconnection**: More aggressive reconnection settings for stability
5. **Load Balancing**: Enables load balancing across replica set members

## Auto-Scaling Based on System Resources

The application automatically scales certain settings based on available system resources:

```javascript
// Calculate optimal pool size based on system resources
const calculateOptimalPoolSize = (baseSize) => {
  const memoryFactor = Math.max(1, Math.min(4, systemMemoryGB / 2));
  const calculatedSize = Math.floor((cpuCount * 2 + 1) * memoryFactor);
  return Math.max(baseSize, Math.min(calculatedSize, 200)); // Cap between baseSize and 200
};
```

This ensures that the connection pool size is appropriate for the server's capabilities.

## Environment Variables

All configuration options can be overridden using environment variables. See the `.env.example` file for a complete list of available environment variables.

## Best Practices

### Development Environment

- Use smaller connection pools to conserve resources
- Enable verbose logging for debugging
- Use faster timeouts for quicker feedback
- Disable SSL for easier local development

### Testing Environment

- Use minimal connection pools
- Set very short timeouts for faster tests
- Consider using in-memory storage for faster tests
- Enable auto-indexing for convenience

### Production Environment

- Enable SSL/TLS for security
- Use 'majority' write concern for data durability
- Disable auto-indexing for performance
- Configure appropriate connection pool size based on expected load
- Use longer timeouts for stability

### High-Traffic Scenarios

- Increase connection pool size
- Optimize for throughput over consistency where appropriate
- Use 'nearest' read preference to minimize latency
- Enable load balancing if supported by your deployment
- Consider sharding for horizontal scaling

## Troubleshooting

### Connection Issues

- Check network connectivity to MongoDB server
- Verify SSL certificate validity and paths
- Ensure MongoDB user has appropriate permissions
- Check firewall settings

### Performance Issues

- Monitor connection pool utilization
- Adjust maxPoolSize based on concurrent operations
- Check for slow queries and optimize
- Consider enabling compression for network efficiency

### Memory Issues

- Reduce maxPoolSize if server memory is constrained
- Adjust maxIdleTimeMS to close idle connections faster
- Monitor memory usage during peak loads

## Monitoring Connection Health

The application includes a ConnectionHealthMonitor service that continuously monitors connection health. Configure health check settings in your environment variables:

```
HEALTH_CHECK_INTERVAL_MS=30000
HEALTH_UNHEALTHY_THRESHOLD=3
HEALTH_ALERT_THRESHOLD=5
```

## Additional Resources

- [MongoDB Connection String URI Format](https://docs.mongodb.com/manual/reference/connection-string/)
- [MongoDB Node.js Driver Documentation](https://mongodb.github.io/node-mongodb-native/)
- [MongoDB Connection Pooling](https://docs.mongodb.com/manual/administration/connection-pool-overview/)