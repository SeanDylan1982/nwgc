# Database Configuration

This directory contains the MongoDB database configuration for the Neighborhood Watch application.

## Files

- `database.js` - Main database connection module that uses the DatabaseService
- `database.config.js` - Environment-specific configuration module

## Environment-Specific Configurations

The application supports different configurations for various environments:

- **Development** - Optimized for local development with faster feedback
- **Testing** - Configured for automated tests with minimal resources
- **Production** - Tuned for reliability and performance with secure connections
- **High-Traffic** - Enhanced settings for handling peak load scenarios

## Usage

The database configuration is automatically applied based on the `NODE_ENV` environment variable:

```javascript
// In your application code
const connectDB = require('./config/database');

// Connect to MongoDB with environment-specific settings
const dbService = await connectDB();
```

## High-Traffic Mode

For peak load scenarios, you can enable high-traffic mode by setting:

```
DB_HIGH_TRAFFIC_MODE=true
```

This applies optimizations for high throughput and scalability.

## Auto-Scaling

The configuration automatically scales connection pool size based on system resources (CPU cores and memory).

## Documentation

For detailed information about the configuration options, see:

- `server/docs/database-configuration-guide.md` - Comprehensive configuration guide
- `server/docs/mongodb-connection-settings.md` - MongoDB connection settings documentation

## Validation

You can validate your configuration using the provided scripts:

```
node server/scripts/validate-db-config.js [environment]
node server/scripts/validate-db-connection.js
```