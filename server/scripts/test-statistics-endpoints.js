const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const request = require('supertest');

// Import the main app
const app = require('../index');

async function testStatisticsEndpoints() {
  try {
    // Load environment variables
    require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') });
    
    // Connect to database
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
    console.log('User status:', sampleUser.status);

    // Create a JWT token for testing
    const token = jwt.sign(
      { userId: sampleUser._id },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '1h' }
    );

    console.log('\n=== Testing Statistics Endpoints ===');

    // Test dashboard endpoint
    console.log('\n1. Testing /api/statistics/dashboard');
    try {
      const response = await request(app)
        .get('/api/statistics/dashboard')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      console.log('✓ Dashboard endpoint works');
      console.log('Response:', JSON.stringify(response.body, null, 2));
    } catch (error) {
      console.log('✗ Dashboard endpoint failed');
      console.log('Error:', error.message);
      if (error.response) {
        console.log('Status:', error.response.status);
        console.log('Body:', error.response.body);
      }
    }

    // Test recent notices endpoint
    console.log('\n2. Testing /api/statistics/recent-notices');
    try {
      const response = await request(app)
        .get('/api/statistics/recent-notices?limit=3')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      console.log('✓ Recent notices endpoint works');
      console.log('Response:', JSON.stringify(response.body, null, 2));
    } catch (error) {
      console.log('✗ Recent notices endpoint failed');
      console.log('Error:', error.message);
      if (error.response) {
        console.log('Status:', error.response.status);
        console.log('Body:', error.response.body);
      }
    }

    // Test recent reports endpoint
    console.log('\n3. Testing /api/statistics/recent-reports');
    try {
      const response = await request(app)
        .get('/api/statistics/recent-reports?limit=3')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      console.log('✓ Recent reports endpoint works');
      console.log('Response:', JSON.stringify(response.body, null, 2));
    } catch (error) {
      console.log('✗ Recent reports endpoint failed');
      console.log('Error:', error.message);
      if (error.response) {
        console.log('Status:', error.response.status);
        console.log('Body:', error.response.body);
      }
    }

  } catch (error) {
    console.error('Test error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  testStatisticsEndpoints();
}

module.exports = testStatisticsEndpoints;