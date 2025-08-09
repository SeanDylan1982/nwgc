const axios = require('axios');

async function testDashboardEndpoints() {
  const baseURL = 'http://localhost:5001';
  
  // First login to get auth token
  try {
    console.log('Logging in...');
    const loginResponse = await axios.post(`${baseURL}/api/auth/login`, {
      email: 'admin@neighbourhood.com',
      password: 'admin123'
    });
    
    const token = loginResponse.data.token;
    console.log('Login successful, token received');
    
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    
    // Test dashboard endpoint
    console.log('\n=== Testing Dashboard Endpoint ===');
    try {
      const dashboardResponse = await axios.get(`${baseURL}/api/statistics/dashboard`, { headers });
      console.log('Dashboard Response Status:', dashboardResponse.status);
      console.log('Dashboard Response Headers:', dashboardResponse.headers);
      console.log('Dashboard Response Data:', JSON.stringify(dashboardResponse.data, null, 2));
    } catch (error) {
      console.error('Dashboard endpoint error:', error.response?.status, error.response?.data);
    }
    
    // Test recent notices endpoint
    console.log('\n=== Testing Recent Notices Endpoint ===');
    try {
      const noticesResponse = await axios.get(`${baseURL}/api/statistics/recent-notices?limit=3`, { headers });
      console.log('Notices Response Status:', noticesResponse.status);
      console.log('Notices Response Headers:', noticesResponse.headers);
      console.log('Notices Response Data:', JSON.stringify(noticesResponse.data, null, 2));
    } catch (error) {
      console.error('Notices endpoint error:', error.response?.status, error.response?.data);
    }
    
    // Test recent reports endpoint
    console.log('\n=== Testing Recent Reports Endpoint ===');
    try {
      const reportsResponse = await axios.get(`${baseURL}/api/statistics/recent-reports?limit=3`, { headers });
      console.log('Reports Response Status:', reportsResponse.status);
      console.log('Reports Response Headers:', reportsResponse.headers);
      console.log('Reports Response Data:', JSON.stringify(reportsResponse.data, null, 2));
    } catch (error) {
      console.error('Reports endpoint error:', error.response?.status, error.response?.data);
    }
    
  } catch (error) {
    console.error('Login failed:', error.response?.data || error.message);
  }
}

testDashboardEndpoints();