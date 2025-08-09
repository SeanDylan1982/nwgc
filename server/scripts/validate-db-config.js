/**
 * Database Configuration Validation Script
 * 
 * This script validates the current MongoDB configuration settings and provides recommendations
 * for optimizing the configuration based on the current environment and system resources.
 * 
 * Usage:
 *   node scripts/validate-db-config.js [environment]
 * 
 * Arguments:
 *   environment - Optional environment to validate (development, testing, production, high-traffic)
 *                 If not provided, uses the current NODE_ENV
 */

require('dotenv').config();
const os = require('os');
const { getConfig, getEnvironmentConfig, getSystemInfo } = require('../config/database.config');

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',
  
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m'
};

/**
 * Format a value for display
 * @param {*} value - The value to format
 * @returns {string} - Formatted value
 */
function formatValue(value) {
  if (value === undefined || value === null) {
    return `${colors.dim}not set${colors.reset}`;
  } else if (typeof value === 'boolean') {
    return value ? `${colors.green}true${colors.reset}` : `${colors.red}false${colors.reset}`;
  } else if (typeof value === 'number') {
    return `${colors.cyan}${value}${colors.reset}`;
  } else if (typeof value === 'string') {
    return `${colors.yellow}'${value}'${colors.reset}`;
  } else {
    return `${colors.dim}${JSON.stringify(value)}${colors.reset}`;
  }
}

/**
 * Check if a configuration value is optimal
 * @param {string} key - Configuration key
 * @param {*} value - Current value
 * @param {*} recommendedValue - Recommended value
 * @returns {Object} - Result with status and message
 */
function checkOptimal(key, value, recommendedValue) {
  // Skip checks for undefined values or complex objects
  if (value === undefined || typeof value === 'object') {
    return { status: 'unknown', message: 'No recommendation available' };
  }
  
  // Special case for connection pool size
  if (key === 'maxPoolSize') {
    const systemInfo = getSystemInfo();
    const minRecommended = Math.max(10, systemInfo.cpuCount * 2);
    const maxRecommended = Math.min(200, systemInfo.cpuCount * 10);
    
    if (value < minRecommended) {
      return {
        status: 'warning',
        message: `Consider increasing to at least ${minRecommended} based on your system (${systemInfo.cpuCount} CPUs)`
      };
    } else if (value > maxRecommended) {
      return {
        status: 'warning',
        message: `Consider decreasing to at most ${maxRecommended} based on your system (${systemInfo.cpuCount} CPUs)`
      };
    } else {
      return { status: 'optimal', message: 'Value is within optimal range for your system' };
    }
  }
  
  // For boolean values
  if (typeof value === 'boolean' && value === recommendedValue) {
    return { status: 'optimal', message: 'Setting is optimal' };
  }
  
  // For numeric values, allow some flexibility
  if (typeof value === 'number' && typeof recommendedValue === 'number') {
    const tolerance = 0.2; // 20% tolerance
    const lowerBound = recommendedValue * (1 - tolerance);
    const upperBound = recommendedValue * (1 + tolerance);
    
    if (value >= lowerBound && value <= upperBound) {
      return { status: 'optimal', message: 'Value is within optimal range' };
    } else if (value < lowerBound) {
      return {
        status: 'warning',
        message: `Value may be too low, recommended around ${recommendedValue}`
      };
    } else {
      return {
        status: 'warning',
        message: `Value may be too high, recommended around ${recommendedValue}`
      };
    }
  }
  
  // For string values
  if (typeof value === 'string' && value === recommendedValue) {
    return { status: 'optimal', message: 'Setting is optimal' };
  }
  
  // Default case
  return {
    status: 'info',
    message: `Current value is ${value}, recommended is ${recommendedValue}`
  };
}

/**
 * Display configuration comparison
 * @param {Object} currentConfig - Current configuration
 * @param {Object} recommendedConfig - Recommended configuration
 */
function displayConfigComparison(currentConfig, recommendedConfig) {
  console.log(`\n${colors.bright}${colors.underscore}Configuration Comparison:${colors.reset}\n`);
  
  console.log(`${colors.bright}Legend:${colors.reset}`);
  console.log(`  ${colors.green}●${colors.reset} Optimal setting`);
  console.log(`  ${colors.yellow}●${colors.reset} Potential improvement`);
  console.log(`  ${colors.red}●${colors.reset} Recommended change`);
  console.log(`  ${colors.blue}●${colors.reset} Informational\n`);
  
  // Group settings by category
  const categories = {
    'Connection Pool': ['minPoolSize', 'maxPoolSize', 'maxIdleTimeMS', 'maxConnecting'],
    'Timeouts': ['socketTimeoutMS', 'connectTimeoutMS', 'serverSelectionTimeoutMS', 'maxTimeMS'],
    'Write Concern': ['writeConcern', 'wtimeoutMS', 'journal'],
    'Read Preference': ['readPreference', 'readConcernLevel', 'secondaryAcceptableLatencyMS'],
    'SSL/TLS': ['ssl', 'sslValidate'],
    'Retry Settings': ['maxRetries', 'initialDelayMs', 'maxDelayMs', 'retryReads', 'retryWrites'],
    'Monitoring': ['monitorCommands', 'logLevel'],
    'Performance': ['compressors', 'zlibCompressionLevel'],
    'Connection Stability': ['autoReconnect', 'reconnectTries', 'reconnectInterval'],
    'Advanced': ['autoIndex', 'loadBalanced', 'replicaSet']
  };
  
  // Display settings by category
  for (const [category, keys] of Object.entries(categories)) {
    console.log(`${colors.bright}${colors.underscore}${category}:${colors.reset}`);
    
    for (const key of keys) {
      const currentValue = currentConfig[key];
      const recommendedValue = recommendedConfig[key];
      const check = checkOptimal(key, currentValue, recommendedValue);
      
      let statusIcon;
      switch (check.status) {
        case 'optimal':
          statusIcon = `${colors.green}●${colors.reset}`;
          break;
        case 'warning':
          statusIcon = `${colors.yellow}●${colors.reset}`;
          break;
        case 'critical':
          statusIcon = `${colors.red}●${colors.reset}`;
          break;
        default:
          statusIcon = `${colors.blue}●${colors.reset}`;
      }
      
      console.log(`  ${statusIcon} ${colors.bright}${key}:${colors.reset} ${formatValue(currentValue)}`);
      
      if (check.status !== 'optimal') {
        console.log(`    ${colors.dim}Recommended: ${formatValue(recommendedValue)} - ${check.message}${colors.reset}`);
      }
    }
    
    console.log(''); // Add a blank line between categories
  }
}

/**
 * Display system information
 */
function displaySystemInfo() {
  const systemInfo = getSystemInfo();
  const totalMemoryGB = systemInfo.memoryGB.toFixed(2);
  const freeMemoryGB = (os.freemem() / (1024 * 1024 * 1024)).toFixed(2);
  
  console.log(`\n${colors.bright}${colors.underscore}System Information:${colors.reset}\n`);
  console.log(`  ${colors.bright}CPU Cores:${colors.reset} ${colors.cyan}${systemInfo.cpuCount}${colors.reset}`);
  console.log(`  ${colors.bright}Total Memory:${colors.reset} ${colors.cyan}${totalMemoryGB} GB${colors.reset}`);
  console.log(`  ${colors.bright}Free Memory:${colors.reset} ${colors.cyan}${freeMemoryGB} GB${colors.reset}`);
  console.log(`  ${colors.bright}Calculated Optimal Pool Size:${colors.reset} ${colors.cyan}${systemInfo.calculatedPoolSize}${colors.reset}`);
  console.log(`  ${colors.bright}Platform:${colors.reset} ${colors.yellow}${os.platform()}${colors.reset}`);
  console.log(`  ${colors.bright}Architecture:${colors.reset} ${colors.yellow}${os.arch()}${colors.reset}`);
  console.log(`  ${colors.bright}Node.js Version:${colors.reset} ${colors.yellow}${process.version}${colors.reset}`);
}

/**
 * Display environment information
 * @param {string} environment - Current environment
 * @param {boolean} isHighTraffic - Whether high traffic mode is enabled
 */
function displayEnvironmentInfo(environment, isHighTraffic) {
  console.log(`\n${colors.bright}${colors.underscore}Environment Information:${colors.reset}\n`);
  console.log(`  ${colors.bright}Current Environment:${colors.reset} ${colors.yellow}${environment}${colors.reset}`);
  console.log(`  ${colors.bright}High Traffic Mode:${colors.reset} ${isHighTraffic ? colors.green + 'Enabled' : colors.red + 'Disabled'}${colors.reset}`);
  
  if (environment === 'production' && !process.env.DB_USE_SSL) {
    console.log(`\n  ${colors.bgRed}${colors.white}WARNING: SSL is not enabled in production environment!${colors.reset}`);
    console.log(`  ${colors.red}It is strongly recommended to enable SSL for production deployments.${colors.reset}`);
    console.log(`  ${colors.red}Set DB_USE_SSL=true in your environment variables.${colors.reset}`);
  }
}

/**
 * Main function
 */
async function main() {
  // Get the environment from command line arguments or NODE_ENV
  const requestedEnv = process.argv[2] || process.env.NODE_ENV || 'development';
  const validEnvs = ['development', 'testing', 'test', 'production', 'high-traffic'];
  
  const environment = validEnvs.includes(requestedEnv) ? requestedEnv : 'development';
  const isHighTraffic = process.env.DB_HIGH_TRAFFIC_MODE === 'true' || environment === 'high-traffic';
  
  // Get current configuration
  const currentConfig = getConfig();
  
  // Get recommended configuration for the environment
  let recommendedConfig;
  if (isHighTraffic && environment === 'production') {
    recommendedConfig = getEnvironmentConfig('high-traffic');
  } else {
    recommendedConfig = getEnvironmentConfig(environment);
  }
  
  // Display information
  console.log(`\n${colors.bgBlue}${colors.white} MongoDB Configuration Validator ${colors.reset}`);
  displayEnvironmentInfo(environment, isHighTraffic);
  displaySystemInfo();
  displayConfigComparison(currentConfig, recommendedConfig);
  
  // Display summary
  console.log(`\n${colors.bright}${colors.underscore}Summary:${colors.reset}\n`);
  console.log(`  Run this script with different environments to compare configurations:`);
  console.log(`  ${colors.cyan}node scripts/validate-db-config.js development${colors.reset}`);
  console.log(`  ${colors.cyan}node scripts/validate-db-config.js testing${colors.reset}`);
  console.log(`  ${colors.cyan}node scripts/validate-db-config.js production${colors.reset}`);
  console.log(`  ${colors.cyan}node scripts/validate-db-config.js high-traffic${colors.reset}\n`);
}

// Run the main function
main().catch(err => {
  console.error(`${colors.bgRed}${colors.white} ERROR ${colors.reset} ${colors.red}${err.message}${colors.reset}`);
  process.exit(1);
});