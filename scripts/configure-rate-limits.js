#!/usr/bin/env node

/**
 * Rate Limit Configuration Helper
 * 
 * This script helps configure appropriate rate limits based on your deployment scenario.
 */

const fs = require('fs');
const path = require('path');

const scenarios = {
  development: {
    RATE_LIMIT_MAX: 200,
    ADMIN_RATE_LIMIT_MAX: 1000,
    description: 'Development environment with relaxed limits'
  },
  production_small: {
    RATE_LIMIT_MAX: 100,
    ADMIN_RATE_LIMIT_MAX: 500,
    description: 'Small production deployment (< 100 users)'
  },
  production_medium: {
    RATE_LIMIT_MAX: 300,
    ADMIN_RATE_LIMIT_MAX: 1500,
    description: 'Medium production deployment (100-1000 users)'
  },
  production_large: {
    RATE_LIMIT_MAX: 1000,
    ADMIN_RATE_LIMIT_MAX: 5000,
    description: 'Large production deployment (> 1000 users)'
  },
  high_traffic: {
    RATE_LIMIT_MAX: 2000,
    ADMIN_RATE_LIMIT_MAX: 10000,
    description: 'High traffic deployment with monitoring dashboards'
  }
};

function showHelp() {
  console.log('Rate Limit Configuration Helper\n');
  console.log('Usage: node configure-rate-limits.js [scenario]\n');
  console.log('Available scenarios:');
  
  Object.entries(scenarios).forEach(([key, config]) => {
    console.log(`  ${key.padEnd(20)} - ${config.description}`);
    console.log(`${' '.repeat(25)}Rate Limit: ${config.RATE_LIMIT_MAX}, Admin: ${config.ADMIN_RATE_LIMIT_MAX}\n`);
  });
  
  console.log('Example: node configure-rate-limits.js production_medium');
}

function updateEnvFile(scenario) {
  const envPath = path.join(__dirname, '../.env.local');
  const config = scenarios[scenario];
  
  if (!config) {
    console.error(`Unknown scenario: ${scenario}`);
    showHelp();
    process.exit(1);
  }
  
  let envContent = '';
  
  // Read existing .env.local if it exists
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }
  
  // Update or add rate limit settings
  const updates = {
    RATE_LIMIT_MAX: config.RATE_LIMIT_MAX,
    ADMIN_RATE_LIMIT_MAX: config.ADMIN_RATE_LIMIT_MAX
  };
  
  Object.entries(updates).forEach(([key, value]) => {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    const newLine = `${key}=${value}`;
    
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, newLine);
    } else {
      envContent += `\n${newLine}`;
    }
  });
  
  // Write updated content
  fs.writeFileSync(envPath, envContent.trim() + '\n');
  
  console.log(`✅ Rate limits configured for ${scenario}:`);
  console.log(`   General rate limit: ${config.RATE_LIMIT_MAX} requests per 15 minutes`);
  console.log(`   Admin rate limit: ${config.ADMIN_RATE_LIMIT_MAX} requests per 15 minutes`);
  console.log(`   Configuration saved to: ${envPath}`);
  console.log('\n⚠️  Remember to restart your server for changes to take effect.');
}

// Main execution
const scenario = process.argv[2];

if (!scenario || scenario === '--help' || scenario === '-h') {
  showHelp();
  process.exit(0);
}

updateEnvFile(scenario);