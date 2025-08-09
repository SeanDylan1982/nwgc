# MongoDB Connection Settings

This document provides information about the optimized MongoDB connection settings used in the Neighborhood Watch application.

## Connection String Parameters

The application uses an optimized MongoDB connection string with the following parameters:

- `retryWrites=true`: Enables automatic retries for write operations that fail due to transient errors.
- `w=majority`: Write concern that ensures data is written to a majority of replica set members.
- `readPreference=primaryPreferred`: Reads from the primary node when available, falls back to secondary nodes if primary is unavailable.
- `maxStalenessSeconds=60`: Maximum staleness for secondary reads (60 seconds).
- `readConcernLevel=local`: Read concern level that returns data from the instance with no guarantee that the data has been written to a majority of the replica set members.
- `connectTimeoutMS=30000`: Connection timeout in milliseconds.
- `socketTimeoutMS=45000`: Socket timeout in milliseconds.
- `maxIdleTimeMS=60000`: Maximum time a connection can remain idle before being closed.
- `compressors=zlib`: Enables network compression for better performance.

## Connection Pool Settings

The connection pool is configured with the following settings:

- `minPoolSize=5`: Minimum number of connections to keep open.
- `maxPoolSize=50`: Maximum number of connections in the pool.
- `maxIdleTimeMS=60000`: Maximum time a connection can remain idle before being closed.
- `heartbeatFrequencyMS=10000`: Frequency of heartbeat to check server status.

## Keepalive Settings

TCP keepalive is enabled to prevent idle connections from being closed by network devices:

- `keepAlive=true`: Enables TCP keepalive.
- `keepAliveInitialDelay=300000`: Initial delay before sending keepalive packets (5 minutes).

## SSL/TLS Configuration

For secure connections, SSL/TLS is configured with the following settings:

- `ssl=true`: Enables SSL/TLS for MongoDB connections.
- `sslValidate=true`: Validates SSL certificates.

### SSL Certificate Setup

For production environments, SSL/TLS is required. The application supports two methods for SSL configuration:

1. **MongoDB Atlas**: If using MongoDB Atlas, SSL is handled automatically.

2. **Self-hosted MongoDB**: For self-hosted MongoDB instances, you need to configure SSL certificates:

   a. Generate SSL certificates using the provided script:
   ```
   node server/scripts/generate-ssl-certs.js
   ```

   b. Configure the following environment variables:
   ```
   DB_USE_SSL=true
   DB_SSL_CA_PATH=./config/certs/ca.crt
   DB_SSL_CERT_PATH=./config/certs/client.crt
   DB_SSL_KEY_PATH=./config/certs/client.key
   ```

## Retry Settings

The application implements retry logic for database operations with the following settings:

- `maxRetries=5`: Maximum number of retry attempts for failed operations.
- `initialDelayMs=100`: Initial delay before first retry in milliseconds.
- `maxDelayMs=10000`: Maximum delay between retries in milliseconds.

## Environment-Specific Configurations

The application now supports comprehensive environment-specific configurations for different deployment scenarios. These configurations are automatically applied based on the `NODE_ENV` environment variable.

### Development Environment

Optimized for local development with faster feedback and more verbose logging:

- Smaller connection pool (`minPoolSize=2`, `maxPoolSize=10`)
- Faster timeouts for quicker feedback
- More lenient write concern (`writeConcern='1'`)
- Verbose logging (`logLevel='debug'`)
- Auto-indexing enabled (`autoIndex=true`)
- SSL disabled for easier local development

### Testing Environment

Configured for automated tests with minimal resources and faster timeouts:

- Minimal connection pool (`minPoolSize=1`, `maxPoolSize=5`)
- Very short timeouts for faster tests
- Local write concern for speed (`writeConcern='1'`)
- Faster retry settings (`maxRetries=2`, `initialDelayMs=50`)
- Option for in-memory storage engine when available

### Production Environment

Tuned for reliability and performance in production with secure connections:

- Larger connection pool (`minPoolSize=10`, `maxPoolSize=100+`)
- Longer timeouts for stability
- Majority write concern for data durability (`writeConcern='majority'`)
- SSL/TLS enabled and required (`ssl=true`)
- More aggressive retry settings for reliability
- Auto-indexing disabled for performance

### High-Traffic Mode

Enhanced settings for handling peak load scenarios, optimized for throughput:

- Much larger connection pool (`minPoolSize=20`, `maxPoolSize=200+`)
- Optimized for high throughput
- More aggressive connection monitoring
- Performance-optimized read preference (`readPreference='nearest'`)
- Load balancing enabled when supported
- Faster compression for better throughput

To enable high-traffic mode, set the environment variable:
```
DB_HIGH_TRAFFIC_MODE=true
```

## Validating Connection Settings

You can validate your MongoDB connection settings using the provided scripts:

### Connection Validation

```
node server/scripts/validate-db-connection.js
```

This script will:
- Test the connection to MongoDB
- Analyze the current settings
- Provide recommendations for optimization
- Report connection performance metrics

### Configuration Validation

```
node server/scripts/validate-db-config.js [environment]
```

This script will:
- Compare your current configuration with recommended settings
- Provide optimization suggestions based on your system resources
- Display detailed information about each configuration option
- Help you tune your configuration for different environments

Available environments:
- `development` - For local development
- `testing` - For automated tests
- `production` - For production deployment
- `high-traffic` - For high-load scenarios

## Troubleshooting

If you encounter connection issues:

1. Check network connectivity to the MongoDB server.
2. Verify that SSL certificates are valid and accessible.
3. Ensure that the MongoDB user has appropriate permissions.
4. Check firewall settings to ensure MongoDB ports are open.
5. Increase timeouts if operating in high-latency environments.

For persistent issues, examine the application logs for detailed error messages.