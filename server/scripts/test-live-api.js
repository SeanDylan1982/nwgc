const axios = require('axios');
const mongoose = require('mongoose');
const User = require('../models/User');

async function testLiveAPI() {
  try {
    // Load environment variables
    require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') });
    
    // Connect to database to get a user token
    const mongoUri = process.env.MONGO_URI;
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Get a sample user
    const sampleUser = await User.findOne({ isActive: true });
    if (!sampleUser) {
      console.log('No active users found');
      return;
    }

    console.log(`Testing with user: ${sampleUser.firstName} ${sampleUser.lastName}`);

    // For testing, we'll simulate what the frontend would do
    // In a real scenario, you'd need a valid JWT token
    const baseURL = 'http://localhost:5001';
    
    // Test if server is running
    try {
      const healthCheck = await axios.get(`${baseURL}/api/health`).catch(() => null);
      if (!healthCheck) {
        console.log('Server is not running on port 5001. Please start the server first.');
        return;
      }
    } catch (error) {
      console.log('Server is not running on port 5001. Please start the server first.');
      return;
    }

    console.log('Server is running. Testing API endpoints...\n');

    // Note: These requests will fail without proper authentication
    // But we can see the response structure
    const endpoints = [
      '/api/statistics/dashboard',
      '/api/statistics/recent-notices?limit=3',
      '/api/statistics/recent-reports?limit=3'
    ];

    for (const endpoint of endpoints) {
      try {
        console.log(`Testing ${endpoint}:`);
        const response = await axios.get(`${baseURL}${endpoint}`);
        console.log('Success:', JSON.stringify(response.data, null, 2));
      } catch (error) {
        console.log('Error:', error.response?.status, error.response?.data || error.message);
      }
      console.log('---\n');
    }

  } catch (error) {
    console.error('Test error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

testLiveAPI();