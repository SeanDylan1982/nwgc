const axios = require('axios');
require('dotenv').config({ path: '.env.local' });

// Configuration
const API_URL = process.env.API_URL || 'http://localhost:5001';
let authToken = '';

// Test admin credentials
const adminCredentials = {
  email: 'admin@neighborwatch.com',
  password: process.argv[2] || 'admin123' // Pass password as command line argument
};

// Helper function to make authenticated requests
async function apiRequest(method, endpoint, data = null) {
  try {
    const url = `${API_URL}${endpoint}`;
    const headers = authToken ? { Authorization: `Bearer ${authToken}` } : {};
    
    const response = await axios({
      method,
      url,
      data,
      headers
    });
    
    return response.data;
  } catch (error) {
    console.error(`Error with ${method} ${endpoint}:`, error.response?.data || error.message);
    return null;
  }
}

// Login as admin
async function login() {
  try {
    console.log('Logging in as admin...');
    const response = await apiRequest('post', '/api/auth/login', adminCredentials);
    
    if (response && response.token) {
      authToken = response.token;
      console.log('Login successful!');
      return true;
    } else {
      console.error('Login failed. Check credentials.');
      return false;
    }
  } catch (error) {
    console.error('Login error:', error);
    return false;
  }
}

// Test admin stats endpoint
async function testAdminStats() {
  console.log('\nTesting admin stats endpoint...');
  const stats = await apiRequest('get', '/api/admin/stats');
  
  if (stats) {
    console.log('Admin stats retrieved successfully:');
    console.log('- Total users:', stats.totalUsers);
    console.log('- Active users:', stats.activeUsers);
    console.log('- Suspended users:', stats.suspendedUsers);
    return true;
  }
  
  return false;
}

// Test audit logs endpoint
async function testAuditLogs() {
  console.log('\nTesting audit logs endpoint...');
  const logs = await apiRequest('get', '/api/admin/audit-logs');
  
  if (logs) {
    console.log('Audit logs retrieved successfully:');
    console.log(`- Total logs: ${logs.total}`);
    if (logs.logs && logs.logs.length > 0) {
      console.log('- Most recent log:', logs.logs[0].action);
    }
    return true;
  }
  
  return false;
}

// Test user management endpoints
async function testUserManagement() {
  console.log('\nTesting user management endpoints...');
  
  // Get all users
  const usersResponse = await apiRequest('get', '/api/admin/users');
  
  if (!usersResponse || !usersResponse.users || usersResponse.users.length === 0) {
    console.error('Failed to retrieve users or no users found');
    return false;
  }
  
  console.log(`Retrieved ${usersResponse.users.length} users`);
  
  // Find a non-admin user to test with
  const testUser = usersResponse.users.find(user => user.role !== 'admin');
  
  if (!testUser) {
    console.log('No non-admin users found for testing role changes');
    return true;
  }
  
  console.log(`Selected test user: ${testUser.firstName} ${testUser.lastName} (${testUser.email})`);
  
  // Test role change
  console.log('\nTesting role change...');
  const newRole = testUser.role === 'user' ? 'moderator' : 'user';
  const roleChangeResponse = await apiRequest('patch', `/api/admin/users/${testUser._id}/role`, {
    role: newRole,
    reason: 'Testing admin endpoints'
  });
  
  if (roleChangeResponse && roleChangeResponse.message) {
    console.log(`Role change successful: ${roleChangeResponse.message}`);
  } else {
    console.error('Role change failed');
  }
  
  // Test status change
  console.log('\nTesting status change...');
  const newStatus = testUser.status === 'active' ? 'suspended' : 'active';
  const statusChangeResponse = await apiRequest('patch', `/api/admin/users/${testUser._id}/status`, {
    status: newStatus,
    reason: 'Testing admin endpoints'
  });
  
  if (statusChangeResponse && statusChangeResponse.message) {
    console.log(`Status change successful: ${statusChangeResponse.message}`);
  } else {
    console.error('Status change failed');
  }
  
  // Revert changes
  console.log('\nReverting changes...');
  await apiRequest('patch', `/api/admin/users/${testUser._id}/role`, {
    role: testUser.role,
    reason: 'Reverting test changes'
  });
  
  await apiRequest('patch', `/api/admin/users/${testUser._id}/status`, {
    status: testUser.status,
    reason: 'Reverting test changes'
  });
  
  console.log('Changes reverted');
  
  return true;
}

// Main function to run all tests
async function runTests() {
  console.log('=== Admin Endpoints Verification ===');
  
  // Login first
  const loggedIn = await login();
  if (!loggedIn) {
    console.error('Cannot proceed without authentication');
    return;
  }
  
  // Run all tests
  await testAdminStats();
  await testAuditLogs();
  await testUserManagement();
  
  console.log('\n=== Verification Complete ===');
}

// Run the tests
runTests().catch(error => {
  console.error('Error running tests:', error);
});