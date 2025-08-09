/**
 * Test the neighbours endpoint specifically
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:5001';

async function testNeighbours() {
  try {
    console.log('🧪 Testing neighbours endpoint...');
    
    // Login first
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: 'admin@neighbourhood.com',
      password: 'admin123'
    });
    
    const token = loginResponse.data.token;
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    
    // Test neighbours endpoint
    console.log('🔍 Testing /api/users/neighbours...');
    const response = await axios.get(`${BASE_URL}/api/users/neighbours`, { headers });
    
    console.log('✅ Success:', response.status);
    console.log('📊 Data:', response.data.length, 'neighbours');
    console.log('📝 Sample:', response.data[0]);
    
  } catch (error) {
    console.log('❌ Error:', error.response?.status || 'Network Error');
    console.log('📝 Error details:', error.response?.data || error.message);
    console.log('📝 Error stack:', error.stack);
  }
}

testNeighbours();