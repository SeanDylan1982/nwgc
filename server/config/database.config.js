/**
 * MongoDB database configuration module
 * Provides environment-specific configurations for MongoDB connections
 * 
 * This module implements comprehensive configuration profiles for different environments:
 * - Development: Optimized for local development with faster feedback
 * - Testing: Configured for automated tests with minimal resources
 * - Production: Tuned for reliability and performance in production
 * - High-Traffic: Enhanced settings for handling peak load scenarios
 */
const path = require('path');
const fs = require('fs');
const os = require('os');

// Determine system resources for auto-scaling configurations
const systemMemoryGB = os.totalmem() / (1024 * 1024 * 1024);
const cpuCount = os.cpus().length;

// Calculate optimal pool size based on system resources
// Formula: (Number of CPUs * 2) + 1, adjusted by available memory
// but capped at reasonable limits
const calculateOptimalPoolSize = (baseSize) => {
  const memoryFactor = Math.max(1, Math.min(4, systemMemoryGB / 2));
  const calculatedSize = Math.floor((cpuCount * 2 + 1) * memoryFactor);
  return Math.max(baseSize, Math.min(calculatedSize, 200)); // Cap between baseSize and 200
};

// Base configuration with common settings for all environments
const baseConfig = {
  // Connection pool settings
  minPoolSize: 5,
  maxPoolSize: calculateOptimalPoolSize(50),
  maxIdleTimeMS: 60000,
  heartbeatFrequencyMS: 10000,
  
  // Timeout settings
  socketTimeoutMS: 45000,
  connectTimeoutMS: 30000,
  serverSelectionTimeoutMS: 30000,
  
  // Keepalive settings
  keepAlive: true,
  keepAliveInitialDelay: 300000,
  
  // Write concern settings
  writeConcern: 'majority',
  wtimeoutMS: 10000,
  
  // Read preference settings
  readPreference: 'primaryPreferred',
  readConcernLevel: 'majority', // Using majority for compatibility with change streams
  
  // Retry settings
  maxRetries: 5,
  initialDelayMs: 100,
  maxDelayMs: 10000,
  
  // SSL settings
  ssl: false,
  sslValidate: true,
  
  // Monitoring settings
  monitorCommands: false,
  logLevel: 'warn',
  
  // Performance settings
  compressors: 'zlib',
  zlibCompressionLevel: 6,
  
  // Connection stability
  autoReconnect: true,
  reconnectTries: 30,
  reconnectInterval: 1000,
  
  // Query settings
  maxTimeMS: 30000,
  
  // Replication settings
  replicaSet: null,
  secondaryAcceptableLatencyMS: 15
};

// Development environment configuration
const developmentConfig = {
  // Use smaller connection pool for development
  minPoolSize: 2,
  maxPoolSize: 10,
  
  // Faster timeouts for development
  socketTimeoutMS: 30000,
  connectTimeoutMS: 20000,
  serverSelectionTimeoutMS: 20000,
  
  // More lenient write concern for faster development
  writeConcern: '1',
  wtimeoutMS: 5000,
  
  // Disable SSL for local development by default
  ssl: false,
  
  // Enable auto-indexing in development
  autoIndex: true,
  
  // More verbose logging in development
  logLevel: 'debug',
  monitorCommands: true,
  
  // Faster heartbeat for quicker feedback during development
  heartbeatFrequencyMS: 5000,
  
  // Development-specific settings
  retryReads: true,
  retryWrites: true,
  
  // Shorter keepalive for development
  keepAliveInitialDelay: 60000,
  
  // Development performance settings
  compressors: 'zlib',
  zlibCompressionLevel: 0, // Fastest compression level
  
  // Query settings for development
  maxTimeMS: 10000,
  
  // Local development typically doesn't use replica sets
  replicaSet: null,
  
  // Development-specific monitoring
  enableUtf8Validation: true,
  
  // Development-specific recovery settings
  reconnectTries: 10,
  reconnectInterval: 500
};

// Testing environment configuration
const testingConfig = {
  // Minimal connection pool for tests
  minPoolSize: 1,
  maxPoolSize: 5,
  
  // Faster timeouts for tests
  socketTimeoutMS: 10000,
  connectTimeoutMS: 5000,
  serverSelectionTimeoutMS: 10000,
  
  // Use local write concern for faster tests
  writeConcern: '1',
  wtimeoutMS: 2000,
  
  // Disable SSL for tests by default
  ssl: false,
  
  // Shorter keepalive for tests
  keepAliveInitialDelay: 60000,
  
  // Faster retry for tests
  maxRetries: 2,
  initialDelayMs: 50,
  maxDelayMs: 1000,
  
  // Enable auto-indexing in testing
  autoIndex: true,
  
  // Testing-specific settings
  retryReads: true,
  retryWrites: true,
  
  // Faster heartbeat for tests
  heartbeatFrequencyMS: 3000,
  
  // Testing performance settings
  compressors: null, // Disable compression for tests
  
  // Testing-specific monitoring
  monitorCommands: true,
  logLevel: 'debug',
  
  // Testing-specific query settings
  maxTimeMS: 5000,
  
  // In-memory storage engine for faster tests when available
  inMemory: process.env.DB_USE_IN_MEMORY === 'true',
  
  // Testing-specific recovery settings
  reconnectTries: 5,
  reconnectInterval: 200,
  
  // Testing-specific read preference
  readPreference: 'primary',
  readConcernLevel: 'local'
};

// Production environment configuration
const productionConfig = {
  // Larger connection pool for production
  minPoolSize: 10,
  maxPoolSize: calculateOptimalPoolSize(100),
  
  // Longer timeouts for production stability
  socketTimeoutMS: 60000,
  connectTimeoutMS: 30000,
  serverSelectionTimeoutMS: 45000,
  
  // Majority write concern for data durability
  writeConcern: 'majority',
  wtimeoutMS: 15000,
  
  // Enable SSL for production security
  ssl: true,
  sslValidate: true,
  
  // More aggressive retry settings for production reliability
  maxRetries: 7,
  initialDelayMs: 200,
  maxDelayMs: 15000,
  
  // Disable auto-indexing in production for performance
  autoIndex: false,
  
  // Longer keepalive for production
  keepAliveInitialDelay: 300000,
  
  // Production-specific settings
  retryReads: true,
  retryWrites: true,
  
  // Production heartbeat settings
  heartbeatFrequencyMS: 10000,
  
  // Production performance settings
  compressors: 'zlib',
  zlibCompressionLevel: 6, // Balance between speed and compression
  
  // Production monitoring
  monitorCommands: false,
  logLevel: 'error',
  
  // Production-specific query settings
  maxTimeMS: 60000,
  
  // Production-specific read preference
  readPreference: 'primaryPreferred',
  readConcernLevel: 'majority', // Stronger consistency for production
  
  // Production-specific recovery settings
  reconnectTries: 30,
  reconnectInterval: 1000,
  
  // Production-specific replication settings
  secondaryAcceptableLatencyMS: 15,
  
  // Production-specific security settings
  authSource: 'admin',
  authMechanism: 'SCRAM-SHA-256'
};

// High-traffic scenario configuration (extends production)
const highTrafficConfig = {
  // Much larger connection pool for high traffic
  minPoolSize: 20,
  maxPoolSize: calculateOptimalPoolSize(200),
  
  // Optimized for high throughput
  socketTimeoutMS: 90000,
  connectTimeoutMS: 45000,
  serverSelectionTimeoutMS: 60000,
  
  // More aggressive connection monitoring
  heartbeatFrequencyMS: 5000,
  
  // Optimize for performance over consistency in high traffic
  readPreference: 'nearest',
  readConcernLevel: 'local',
  
  // More aggressive retry settings
  maxRetries: 10,
  initialDelayMs: 100,
  maxDelayMs: 20000,
  
  // High-traffic specific settings
  maxIdleTimeMS: 30000, // Shorter idle time to recycle connections faster
  
  // High-traffic performance settings
  compressors: 'zlib',
  zlibCompressionLevel: 1, // Faster compression for high throughput
  
  // High-traffic query settings
  maxTimeMS: 90000,
  
  // High-traffic specific monitoring
  monitorCommands: false,
  logLevel: 'warn',
  
  // High-traffic specific recovery settings
  reconnectTries: 60,
  reconnectInterval: 500,
  
  // High-traffic specific write concern
  // Use w:1 with journal for better performance while maintaining durability
  writeConcern: '1',
  journal: true,
  wtimeoutMS: 10000,
  
  // High-traffic specific connection management
  maxConnecting: 10, // Allow more simultaneous connection attempts
  
  // High-traffic specific load balancing
  loadBalanced: true, // Enable load balancing if supported by deployment
  
  // High-traffic specific replication settings
  secondaryAcceptableLatencyMS: 50 // Allow higher latency for secondaries
};

/**
 * Get configuration for the current environment
 * @param {Object} customConfig - Custom configuration to override defaults
 * @returns {Object} - The merged configuration
 */
function getConfig(customConfig = {}) {
  // Determine the current environment
  const env = process.env.NODE_ENV || 'development';
  
  // Select the appropriate environment config
  let envConfig;
  switch (env) {
    case 'production':
      envConfig = productionConfig;
      break;
    case 'staging':
      // Staging uses production config with specific overrides
      envConfig = {
        ...productionConfig,
        maxPoolSize: Math.floor(productionConfig.maxPoolSize * 0.5),
        logLevel: 'info'
      };
      break;
    case 'testing':
    case 'test':
      envConfig = testingConfig;
      break;
    case 'development':
    default:
      envConfig = developmentConfig;
      break;
  }
  
  // Check if high traffic mode is enabled
  const isHighTraffic = process.env.DB_HIGH_TRAFFIC_MODE === 'true';
  const trafficConfig = isHighTraffic ? highTrafficConfig : {};
  
  // Load SSL certificates if configured and SSL is enabled
  let sslConfig = {};
  const useSSL = customConfig.ssl || envConfig.ssl || baseConfig.ssl;
  
  if (useSSL) {
    try {
      const sslCAPath = process.env.DB_SSL_CA_PATH;
      const sslCertPath = process.env.DB_SSL_CERT_PATH;
      const sslKeyPath = process.env.DB_SSL_KEY_PATH;
      
      if (sslCAPath && fs.existsSync(sslCAPath)) {
        sslConfig.sslCA = fs.readFileSync(sslCAPath);
        sslConfig.tlsCAFile = sslCAPath; // Modern TLS option
      }
      
      if (sslCertPath && fs.existsSync(sslCertPath)) {
        sslConfig.sslCert = fs.readFileSync(sslCertPath);
        sslConfig.tlsCertificateKeyFile = sslCertPath; // Modern TLS option
      }
      
      if (sslKeyPath && fs.existsSync(sslKeyPath)) {
        sslConfig.sslKey = fs.readFileSync(sslKeyPath);
        // Modern TLS options use the same certificate key file
      }
      
      // Add passphrase if provided
      if (process.env.DB_SSL_KEY_PASSPHRASE) {
        sslConfig.sslPass = process.env.DB_SSL_KEY_PASSPHRASE;
      }
    } catch (error) {
      console.error('Error loading SSL certificates:', error);
      if (env === 'production') {
        console.error('SSL certificates are required for production. Using default settings.');
      }
    }
  }
  
  // Override with environment variables if provided
  const envOverrides = {
    // Connection pool settings
    minPoolSize: process.env.DB_MIN_POOL_SIZE ? parseInt(process.env.DB_MIN_POOL_SIZE) : undefined,
    maxPoolSize: process.env.DB_MAX_POOL_SIZE ? parseInt(process.env.DB_MAX_POOL_SIZE) : undefined,
    maxIdleTimeMS: process.env.DB_MAX_IDLE_TIME_MS ? parseInt(process.env.DB_MAX_IDLE_TIME_MS) : undefined,
    
    // Timeout settings
    socketTimeoutMS: process.env.DB_SOCKET_TIMEOUT_MS ? parseInt(process.env.DB_SOCKET_TIMEOUT_MS) : undefined,
    connectTimeoutMS: process.env.DB_CONNECT_TIMEOUT_MS ? parseInt(process.env.DB_CONNECT_TIMEOUT_MS) : undefined,
    serverSelectionTimeoutMS: process.env.DB_SERVER_SELECTION_TIMEOUT_MS ? parseInt(process.env.DB_SERVER_SELECTION_TIMEOUT_MS) : undefined,
    maxTimeMS: process.env.DB_MAX_TIME_MS ? parseInt(process.env.DB_MAX_TIME_MS) : undefined,
    
    // Keepalive settings
    keepAlive: process.env.DB_KEEP_ALIVE ? process.env.DB_KEEP_ALIVE !== 'false' : undefined,
    keepAliveInitialDelay: process.env.DB_KEEP_ALIVE_INITIAL_DELAY_MS ? parseInt(process.env.DB_KEEP_ALIVE_INITIAL_DELAY_MS) : undefined,
    
    // Heartbeat settings
    heartbeatFrequencyMS: process.env.DB_HEARTBEAT_FREQUENCY_MS ? parseInt(process.env.DB_HEARTBEAT_FREQUENCY_MS) : undefined,
    
    // Write concern settings
    writeConcern: process.env.DB_WRITE_CONCERN,
    wtimeoutMS: process.env.DB_WRITE_TIMEOUT_MS ? parseInt(process.env.DB_WRITE_TIMEOUT_MS) : undefined,
    journal: process.env.DB_JOURNAL ? process.env.DB_JOURNAL === 'true' : undefined,
    
    // Read preference settings
    readPreference: process.env.DB_READ_PREFERENCE,
    readConcernLevel: process.env.DB_READ_CONCERN_LEVEL,
    secondaryAcceptableLatencyMS: process.env.DB_SECONDARY_ACCEPTABLE_LATENCY_MS ? 
      parseInt(process.env.DB_SECONDARY_ACCEPTABLE_LATENCY_MS) : undefined,
    
    // SSL settings
    ssl: process.env.DB_USE_SSL ? process.env.DB_USE_SSL === 'true' : undefined,
    sslValidate: process.env.DB_SSL_VALIDATE ? process.env.DB_SSL_VALIDATE !== 'false' : undefined,
    
    // Authentication settings
    authSource: process.env.DB_AUTH_SOURCE,
    authMechanism: process.env.DB_AUTH_MECHANISM,
    
    // Retry settings
    maxRetries: process.env.DB_MAX_RETRIES ? parseInt(process.env.DB_MAX_RETRIES) : undefined,
    initialDelayMs: process.env.DB_INITIAL_DELAY_MS ? parseInt(process.env.DB_INITIAL_DELAY_MS) : undefined,
    maxDelayMs: process.env.DB_MAX_DELAY_MS ? parseInt(process.env.DB_MAX_DELAY_MS) : undefined,
    retryReads: process.env.DB_RETRY_READS ? process.env.DB_RETRY_READS === 'true' : undefined,
    retryWrites: process.env.DB_RETRY_WRITES ? process.env.DB_RETRY_WRITES === 'true' : undefined,
    
    // Monitoring settings
    monitorCommands: process.env.DB_MONITOR_COMMANDS ? process.env.DB_MONITOR_COMMANDS === 'true' : undefined,
    logLevel: process.env.DB_LOG_LEVEL,
    
    // Performance settings
    compressors: process.env.DB_COMPRESSORS,
    zlibCompressionLevel: process.env.DB_ZLIB_COMPRESSION_LEVEL ? 
      parseInt(process.env.DB_ZLIB_COMPRESSION_LEVEL) : undefined,
    
    // Connection stability
    autoReconnect: process.env.DB_AUTO_RECONNECT ? process.env.DB_AUTO_RECONNECT === 'true' : undefined,
    reconnectTries: process.env.DB_RECONNECT_TRIES ? parseInt(process.env.DB_RECONNECT_TRIES) : undefined,
    reconnectInterval: process.env.DB_RECONNECT_INTERVAL ? parseInt(process.env.DB_RECONNECT_INTERVAL) : undefined,
    
    // Advanced settings
    maxConnecting: process.env.DB_MAX_CONNECTING ? parseInt(process.env.DB_MAX_CONNECTING) : undefined,
    loadBalanced: process.env.DB_LOAD_BALANCED ? process.env.DB_LOAD_BALANCED === 'true' : undefined,
    autoIndex: process.env.DB_AUTO_INDEX ? process.env.DB_AUTO_INDEX === 'true' : undefined,
    
    // Special settings
    inMemory: process.env.DB_USE_IN_MEMORY ? process.env.DB_USE_IN_MEMORY === 'true' : undefined,
    replicaSet: process.env.DB_REPLICA_SET || undefined
  };
  
  // Filter out undefined values
  const filteredEnvOverrides = Object.fromEntries(
    Object.entries(envOverrides).filter(([_, v]) => v !== undefined)
  );
  
  // Merge configurations with the following precedence:
  // 1. Custom config (highest priority)
  // 2. Environment variables
  // 3. High traffic config (if enabled)
  // 4. Environment-specific config
  // 5. Base config (lowest priority)
  return {
    ...baseConfig,
    ...envConfig,
    ...trafficConfig,
    ...filteredEnvOverrides,
    ...sslConfig,
    ...customConfig
  };
}

/**
 * Get a specific environment configuration
 * @param {string} environment - The environment name ('development', 'testing', 'production', 'high-traffic')
 * @returns {Object} - The configuration for the specified environment
 */
function getEnvironmentConfig(environment) {
  switch (environment) {
    case 'production':
      return { ...baseConfig, ...productionConfig };
    case 'testing':
    case 'test':
      return { ...baseConfig, ...testingConfig };
    case 'high-traffic':
      return { ...baseConfig, ...productionConfig, ...highTrafficConfig };
    case 'development':
    default:
      return { ...baseConfig, ...developmentConfig };
  }
}

/**
 * Get system resource information used for configuration
 * @returns {Object} - System resource information
 */
function getSystemInfo() {
  return {
    memoryGB: systemMemoryGB,
    cpuCount: cpuCount,
    calculatedPoolSize: calculateOptimalPoolSize(50)
  };
}

module.exports = {
  getConfig,
  getEnvironmentConfig,
  getSystemInfo,
  baseConfig,
  developmentConfig,
  testingConfig,
  productionConfig,
  highTrafficConfig
};