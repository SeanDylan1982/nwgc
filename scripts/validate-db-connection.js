/**
 * Script to validate MongoDB connection settings
 * This script tests the connection to MongoDB with the current settings
 * and provides recommendations for optimization.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { dbService } = require('../config/database');

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

/**
 * Format a message with color
 * @param {string} message - The message to format
 * @param {string} color - The color to use
 * @returns {string} - The formatted message
 */
const colorize = (message, color) => `${color}${message}${colors.reset}`;

/**
 * Check if a value is optimal
 * @param {any} value - The value to check
 * @param {any} optimal - The optimal value
 * @param {any} warning - The warning threshold
 * @returns {string} - Status indicator
 */
const checkOptimal = (value, optimal, warning) => {
  if (value === optimal) return colorize('✓ OPTIMAL', colors.green);
  if (value === warning) return colorize('⚠ ACCEPTABLE', colors.yellow);
  return colorize('✗ SUBOPTIMAL', colors.red);
};

/**
 * Main function to validate database connection
 */
async function validateConnection() {
  console.log(colorize('\n=== MongoDB Connection Validator ===\n', colors.bright + colors.cyan));
  
  try {
    // Extract connection options
    const uri = dbService.uri;
    const options = dbService.options;
    
    // Check connection string
    console.log(colorize('Connection String:', colors.bright));
    const maskedUri = uri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
    console.log(`  ${maskedUri}`);
    
    // Check if using SRV format (MongoDB Atlas)
    const isAtlasConnection = uri.includes('+srv');
    console.log(`  Format: ${isAtlasConnection ? 'MongoDB Atlas (SRV)' : 'Standard'}`);
    
    // Check connection parameters
    console.log(colorize('\nConnection Parameters:', colors.bright));
    
    // Check SSL/TLS settings
    const sslEnabled = options.ssl || options.tls;
    console.log(`  SSL/TLS Enabled: ${sslEnabled ? colorize('Yes', colors.green) : colorize('No', colors.red)}`);
    if (sslEnabled) {
      console.log(`  SSL Validation: ${options.sslValidate !== false ? colorize('Enabled', colors.green) : colorize('Disabled', colors.red)}`);
      console.log(`  SSL Certificates: ${options.sslCA ? colorize('Configured', colors.green) : colorize('Not Configured', colors.yellow)}`);
    } else if (process.env.NODE_ENV === 'production') {
      console.log(colorize('  WARNING: SSL/TLS is disabled in production environment!', colors.red));
    }
    
    // Check connection pool settings
    console.log(colorize('\nConnection Pool Settings:', colors.bright));
    console.log(`  Min Pool Size: ${options.minPoolSize} ${checkOptimal(options.minPoolSize, 5, 1)}`);
    console.log(`  Max Pool Size: ${options.maxPoolSize} ${checkOptimal(options.maxPoolSize >= 50, true, false)}`);
    console.log(`  Max Idle Time: ${options.maxIdleTimeMS}ms ${checkOptimal(options.maxIdleTimeMS, 60000, 30000)}`);
    
    // Check timeout settings
    console.log(colorize('\nTimeout Settings:', colors.bright));
    console.log(`  Socket Timeout: ${options.socketTimeoutMS}ms ${checkOptimal(options.socketTimeoutMS >= 30000, true, false)}`);
    console.log(`  Connect Timeout: ${options.connectTimeoutMS}ms ${checkOptimal(options.connectTimeoutMS, 30000, 10000)}`);
    console.log(`  Server Selection Timeout: ${options.serverSelectionTimeoutMS}ms ${checkOptimal(options.serverSelectionTimeoutMS, 30000, 10000)}`);
    
    // Check keepalive settings
    console.log(colorize('\nKeepalive Settings:', colors.bright));
    console.log(`  Keepalive Enabled: ${options.keepAlive ? colorize('Yes', colors.green) : colorize('No', colors.red)}`);
    if (options.keepAlive) {
      console.log(`  Keepalive Initial Delay: ${options.keepAliveInitialDelay}ms ${checkOptimal(options.keepAliveInitialDelay, 300000, 120000)}`);
    }
    
    // Check write concern settings
    console.log(colorize('\nWrite Concern Settings:', colors.bright));
    console.log(`  Write Concern: ${options.w} ${checkOptimal(options.w, 'majority', '1')}`);
    console.log(`  Write Timeout: ${options.wtimeoutMS}ms ${checkOptimal(options.wtimeoutMS >= 5000, true, false)}`);
    
    // Check read preference settings
    console.log(colorize('\nRead Preference Settings:', colors.bright));
    console.log(`  Read Preference: ${options.readPreference} ${checkOptimal(options.readPreference === 'primaryPreferred' || options.readPreference === 'nearest', true, false)}`);
    console.log(`  Read Concern Level: ${options.readConcern?.level || 'local'} ${checkOptimal(options.readConcern?.level === 'local' || options.readConcern?.level === 'majority', true, false)}`);
    
    // Test connection
    console.log(colorize('\nTesting Connection...', colors.bright));
    const startTime = Date.now();
    await dbService.connect();
    const connectionTime = Date.now() - startTime;
    
    console.log(colorize(`  Connection successful! (${connectionTime}ms)`, colors.green));
    
    // Get server info
    const admin = mongoose.connection.db.admin();
    const serverInfo = await admin.serverInfo();
    console.log(`  MongoDB Version: ${serverInfo.version}`);
    
    // Get connection stats
    const stats = dbService.getConnectionStats();
    console.log(`  Connection Pool Size: ${stats.poolSize}`);
    console.log(`  Average Query Latency: ${stats.avgQueryLatency}ms`);
    
    // Provide recommendations
    console.log(colorize('\nRecommendations:', colors.bright));
    
    if (!sslEnabled && process.env.NODE_ENV === 'production') {
      console.log(colorize('  • Enable SSL/TLS for secure connections in production', colors.red));
      console.log('    Set DB_USE_SSL=true in your .env file');
      console.log('    Run server/scripts/generate-ssl-certs.js to generate certificates');
    }
    
    if (options.maxPoolSize < 20 && process.env.NODE_ENV === 'production') {
      console.log(colorize('  • Increase max pool size for better performance in production', colors.yellow));
      console.log('    Set DB_MAX_POOL_SIZE=50 in your .env file');
    }
    
    if (options.socketTimeoutMS < 30000) {
      console.log(colorize('  • Increase socket timeout to handle longer operations', colors.yellow));
      console.log('    Set DB_SOCKET_TIMEOUT_MS=45000 in your .env file');
    }
    
    if (options.w !== 'majority' && process.env.NODE_ENV === 'production') {
      console.log(colorize('  • Use "majority" write concern in production for data durability', colors.yellow));
      console.log('    Set DB_WRITE_CONCERN=majority in your .env file');
    }
    
    if (!options.retryWrites) {
      console.log(colorize('  • Enable retryable writes for better reliability', colors.yellow));
      console.log('    Add retryWrites=true to your connection string');
    }
    
    console.log(colorize('\nConnection validation complete!', colors.bright + colors.green));
    
  } catch (error) {
    console.error(colorize('\nConnection validation failed!', colors.bright + colors.red));
    console.error(colorize(`Error: ${error.message}`, colors.red));
    console.error(error);
  } finally {
    // Disconnect from MongoDB
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      console.log('Disconnected from MongoDB');
    }
    process.exit(0);
  }
}

// Run the validation
validateConnection().catch(console.error);