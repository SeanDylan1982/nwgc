const axios = require('axios');

async function testApiCall() {
  try {
    // Test the API endpoints directly
    const baseURL = 'http://localhost:5001';
    
    // You'll need to get a valid token first
    console.log('Testing API endpoints...');
    
    // For now, let's just test if the server is running
    try {
      const response = await axios.get(`${baseURL}/api/health`);
      console.log('Server health check:', response.status);
    } catch (error) {
      console.log('Server might not be running or health endpoint not available');
      console.log('Error:', error.message);
    }
    
    console.log('To properly test the API endpoints, you need to:');
    console.log('1. Start the server (npm run dev)');
    console.log('2. Login to get a valid JWT token');
    console.log('3. Use that token to test the /api/statistics/recent-notices endpoint');
    
  } catch (error) {
    console.error('Test error:', error.message);
  }
}

testApiCall();