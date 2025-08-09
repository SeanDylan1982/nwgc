/**
 * Enhanced MongoDB database configuration
 * Uses DatabaseService for robust connection management with optimized settings
 * Implements comprehensive environment-specific configurations for development, testing, and production
 * Supports high-traffic mode for peak load scenarios
 * Auto-scales connection pool based on system resources
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const os = require('os');
const DatabaseService = require('../services/DatabaseService');
const { getConfig, getSystemInfo } = require('./database.config');

/**
 * Get the MongoDB connection string
 * We'll handle all connection parameters in the options object
 */
const getConnectionString = () => {
  let uri = process.env.MONGO_URI;
  
  if (!uri) {
    console.error('MONGO_URI environment variable is not set');
    throw new Error('MongoDB connection string is required');
  }
  
  // For Atlas connections, keep the query parameters as they're required
  const isAtlasConnection = uri.includes('mongodb+srv://') || uri.includes('.mongodb.net');
  
  if (!isAtlasConnection && uri.includes('?')) {
    // Only remove query parameters for non-Atlas connections
    uri = uri.split('?')[0];
  }
  
  return uri;
};

// Get system resource information
const systemInfo = getSystemInfo();

// Log system resources for connection pool optimization
console.log(`MongoDB Connection: Detected ${systemInfo.cpuCount} CPU cores and ${systemInfo.memoryGB.toFixed(2)}GB memory`);
console.log(`MongoDB Connection: Calculated optimal pool size: ${systemInfo.calculatedPoolSize}`);

// Get environment-specific configuration
const config = getConfig();

// Determine if we should use SSL based on environment and connection type
const isAtlasConnection = process.env.MONGO_URI && (process.env.MONGO_URI.includes('+srv') || process.env.MONGO_URI.includes('.mongodb.net'));
const useSSL = config.ssl !== undefined ? config.ssl : isAtlasConnection;

// Log environment and configuration mode
const env = process.env.NODE_ENV || 'development';
const isHighTraffic = process.env.DB_HIGH_TRAFFIC_MODE === 'true';
console.log(`MongoDB Connection: Using ${env} environment${isHighTraffic ? ' with high-traffic optimizations' : ''}`);

// Log warning if SSL is not enabled in production
if (env === 'production' && !useSSL) {
  console.warn('WARNING: SSL is not enabled for MongoDB connection in production environment!');
  console.warn('It is strongly recommended to enable SSL for production deployments.');
}

// Create singleton instance of DatabaseService with environment-specific settings
const connectionUri = getConnectionString();
const isAtlasConn = connectionUri.includes('mongodb+srv://') || connectionUri.includes('.mongodb.net');

// Atlas-specific configuration overrides
const atlasConfig = isAtlasConn ? {
  // Atlas requires TLS
  ssl: true,
  tls: true,
  tlsAllowInvalidCertificates: false,
  tlsAllowInvalidHostnames: false,
  
  // Atlas-optimized timeouts
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 30000,
  
  // Atlas-optimized connection pool
  maxPoolSize: 10,
  minPoolSize: 2,
  
  // Atlas-specific retry settings
  retryWrites: true,
  retryReads: true,
  
  // Use IPv4 for better Atlas connectivity
  family: 4,
  
  // Atlas-optimized read preference
  readPreference: 'primaryPreferred',
  readConcernLevel: 'majority'
} : {};

const dbService = new DatabaseService({
  // Connection string
  uri: connectionUri,
  
  // Apply environment-specific configuration
  ...config,
  
  // Apply Atlas-specific overrides if needed
  ...atlasConfig
});

// Export the connect function that uses the service
const connectDB = async () => {
  try {
    await dbService.connect();
    return dbService;
  } catch (error) {
    console.error('Failed to initialize database connection:', error);
    process.exit(1);
  }
};

// Export both the connect function and the service instance
module.exports = connectDB;
module.exports.dbService = dbService;