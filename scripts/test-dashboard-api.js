const axios = require('axios');

async function testDashboardAPI() {
  try {
    // You'll need to replace this with a valid token from your app
    const token = 'your-auth-token-here';
    const baseURL = 'http://localhost:5001';
    
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    console.log('Testing dashboard API endpoints...\n');

    // Test dashboard stats
    try {
      const statsResponse = await axios.get(`${baseURL}/api/statistics/dashboard`, { headers });
      console.log('Dashboard stats response:');
      console.log(JSON.stringify(statsResponse.data, null, 2));
    } catch (error) {
      console.log('Dashboard stats error:', error.response?.data || error.message);
    }

    console.log('\n---\n');

    // Test recent notices
    try {
      const noticesResponse = await axios.get(`${baseURL}/api/statistics/recent-notices?limit=3`, { headers });
      console.log('Recent notices response:');
      console.log(JSON.stringify(noticesResponse.data, null, 2));
    } catch (error) {
      console.log('Recent notices error:', error.response?.data || error.message);
    }

    console.log('\n---\n');

    // Test recent reports
    try {
      const reportsResponse = await axios.get(`${baseURL}/api/statistics/recent-reports?limit=3`, { headers });
      console.log('Recent reports response:');
      console.log(JSON.stringify(reportsResponse.data, null, 2));
    } catch (error) {
      console.log('Recent reports error:', error.response?.data || error.message);
    }

  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testDashboardAPI();