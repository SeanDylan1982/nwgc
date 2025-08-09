/**
 * Test setup file for Vitest
 * 
 * This file is executed before running tests to set up the test environment.
 */

// Load environment variables
require('dotenv').config({ path: '.env.test' });

// Set NODE_ENV to test
process.env.NODE_ENV = 'test';

// Silence console output during tests
if (process.env.VERBOSE_TESTS !== 'true') {
  const originalConsoleLog = console.log;
  const originalConsoleInfo = console.info;
  const originalConsoleWarn = console.warn;
  const originalConsoleError = console.error;
  
  // Replace console methods with no-op functions
  console.log = () => {};
  console.info = () => {};
  console.warn = () => {};
  console.error = () => {};
  
  // Restore console methods after tests
  afterAll(() => {
    console.log = originalConsoleLog;
    console.info = originalConsoleInfo;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
  });
}

// Create a mock .env.test file if it doesn't exist
const fs = require('fs');
const path = require('path');

const envTestPath = path.join(__dirname, '..', '.env.test');
if (!fs.existsSync(envTestPath)) {
  fs.writeFileSync(envTestPath, `
# Test environment variables
NODE_ENV=test
MONGO_URI=mongodb://localhost:27017/test
JWT_SECRET=test_secret
PORT=5001
`);
}