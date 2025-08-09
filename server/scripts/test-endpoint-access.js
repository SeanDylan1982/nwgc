const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

async function testEndpointAccess() {
  try {
    // Load environment variables
    require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') });
    
    // Connect to database
    const mongoUri = process.env.MONGO_URI;
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Get a sample user and create a token
    const sampleUser = await User.findOne({ isActive: true });
    if (!sampleUser) {
      console.log('No active users found');
      return;
    }

    console.log(`Testing with user: ${sampleUser.firstName} ${sampleUser.lastName}`);

    // Create a JWT token for testing
    const token = jwt.sign(
      { userId: sampleUser._id },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '1h' }
    );

    console.log('Generated token for testing');

    // Test the endpoints using the actual Express app
    const app = require('../index'); // This should be your main app file
    
    // We can't easily test the running server from here, but we can check the routes
    console.log('\nChecking if routes are properly defined...');
    
    // Import the statistics router to check if it's properly set up
    const statisticsRouter = require('../routes/statistics');
    console.log('Statistics router imported successfully');

    // Check if the StatsService methods exist
    const StatsService = require('../services/StatsService');
    console.log('StatsService imported successfully');

    // Test the service methods directly
    console.log('\n=== Testing StatsService methods directly ===');
    
    try {
      const dashboardStats = await StatsService.getDashboardStats(sampleUser._id);
      console.log('✓ StatsService.getDashboardStats() works');
      console.log('Dashboard stats structure:', {
        hasActiveChatsCount: 'activeChatsCount' in dashboardStats,
        hasCommunity: 'community' in dashboardStats,
        hasRecentItems: 'recentItems' in dashboardStats,
        communityKeys: dashboardStats.community ? Object.keys(dashboardStats.community) : 'N/A',
        recentItemsKeys: dashboardStats.recentItems ? Object.keys(dashboardStats.recentItems) : 'N/A'
      });
    } catch (error) {
      console.log('✗ StatsService.getDashboardStats() failed:', error.message);
    }

    // Check if there's a fallback method
    try {
      const fallbackStats = await StatsService.getStatsWithFallback(sampleUser._id);
      console.log('✓ StatsService.getStatsWithFallback() works');
    } catch (error) {
      console.log('✗ StatsService.getStatsWithFallback() failed:', error.message);
    }

  } catch (error) {
    console.error('Test error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

testEndpointAccess();