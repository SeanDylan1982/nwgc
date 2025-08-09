/**
 * Simple test script to check basic API endpoints
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:5001';

async function testSimpleEndpoints() {
  try {
    console.log('🧪 Testing simple API endpoints...');
    
    // Test if server is running
    try {
      const healthResponse = await axios.get(`${BASE_URL}/api/health`);
      console.log('✅ Server is running, health check:', healthResponse.status);
    } catch (error) {
      console.log('❌ Server not responding:', error.message);
      return;
    }
    
    // Test login
    console.log('🔐 Testing login...');
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: 'admin@neighbourhood.com',
      password: 'admin123'
    });
    
    if (!loginResponse.data.token) {
      console.log('❌ Login failed');
      return;
    }
    
    const token = loginResponse.data.token;
    console.log('✅ Login successful');
    
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    
    // Test basic endpoints that we know work
    const workingEndpoints = [
      '/api/users/me',
      '/api/statistics/dashboard',
      '/api/notices',
      '/api/reports'
    ];
    
    for (const endpoint of workingEndpoints) {
      try {
        const response = await axios.get(`${BASE_URL}${endpoint}`, { headers });
        console.log(`✅ ${endpoint}: Status ${response.status}`);
      } catch (error) {
        console.log(`❌ ${endpoint}: ${error.response?.status || 'Network Error'}`);
      }
    }
    
    // Test the updated chat endpoint
    try {
      const chatResponse = await axios.get(`${BASE_URL}/api/chat/groups`, { headers });
      console.log(`✅ /api/chat/groups: Status ${chatResponse.status}, Groups: ${chatResponse.data.length}`);
    } catch (error) {
      console.log(`❌ /api/chat/groups: ${error.response?.status || 'Network Error'}`);
      if (error.response?.data) {
        console.log('   Error details:', error.response.data);
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testSimpleEndpoints();