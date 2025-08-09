const express = require('express');
const mongoose = require('mongoose');
const statisticsRouter = require('../routes/statistics');
const User = require('../models/User');

async function testAPIResponseFormat() {
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

    console.log(`Testing API response format with user: ${sampleUser.firstName} ${sampleUser.lastName}`);

    // Create mock request and response objects
    const mockReq = {
      user: { userId: sampleUser._id },
      query: { limit: '3' }
    };

    // Test dashboard endpoint
    console.log('\n=== Testing /api/statistics/dashboard ===');
    const mockRes1 = {
      json: (data) => {
        console.log('Dashboard response:');
        console.log(JSON.stringify(data, null, 2));
      },
      status: (code) => ({
        json: (data) => {
          console.log(`Error response (${code}):`, data);
        }
      })
    };

    // Simulate the dashboard route
    const StatsService = require('../services/StatsService');
    try {
      const stats = await StatsService.getDashboardStats(sampleUser._id);
      const response = {
        success: true,
        data: {
          activeChats: stats.activeChatsCount || 0,
          newNotices: stats.community.totalNotices,
          openReports: stats.community.activeReports,
          neighbours: stats.community.totalMembers,
          userStats: stats.user,
          recentItems: stats.recentItems
        }
      };
      mockRes1.json(response);
    } catch (error) {
      console.error('Dashboard error:', error);
    }

    // Test recent notices endpoint
    console.log('\n=== Testing /api/statistics/recent-notices ===');
    const mockRes2 = {
      json: (data) => {
        console.log('Recent notices response:');
        console.log(JSON.stringify(data, null, 2));
      }
    };

    try {
      const stats = await StatsService.getDashboardStats(sampleUser._id);
      const limit = 3;
      
      if (!stats.recentItems.notices || stats.recentItems.notices.length === 0) {
        mockRes2.json({
          success: true,
          data: [],
          count: 0
        });
      } else {
        const formattedNotices = stats.recentItems.notices.slice(0, limit).map(notice => ({
          id: notice._id,
          title: notice.title,
          category: notice.category,
          author: notice.authorId ? `${notice.authorId.firstName} ${notice.authorId.lastName}` : 'Unknown Author',
          time: getTimeAgo(notice.createdAt),
          likes: notice.likes ? notice.likes.length : 0,
          comments: notice.comments ? notice.comments.length : 0
        }));

        mockRes2.json({
          success: true,
          data: formattedNotices,
          count: formattedNotices.length
        });
      }
    } catch (error) {
      console.error('Recent notices error:', error);
    }

    // Test recent reports endpoint
    console.log('\n=== Testing /api/statistics/recent-reports ===');
    const mockRes3 = {
      json: (data) => {
        console.log('Recent reports response:');
        console.log(JSON.stringify(data, null, 2));
      }
    };

    try {
      const stats = await StatsService.getDashboardStats(sampleUser._id);
      const limit = 3;
      
      if (!stats.recentItems.reports || stats.recentItems.reports.length === 0) {
        mockRes3.json({
          success: true,
          data: [],
          count: 0
        });
      } else {
        const formattedReports = stats.recentItems.reports.slice(0, limit).map(report => ({
          id: report._id,
          title: report.title,
          severity: report.priority,
          status: report.status,
          time: getTimeAgo(report.createdAt),
          likes: report.likes ? report.likes.length : 0
        }));

        mockRes3.json({
          success: true,
          data: formattedReports,
          count: formattedReports.length
        });
      }
    } catch (error) {
      console.error('Recent reports error:', error);
    }

  } catch (error) {
    console.error('Test error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

// Helper function to calculate time ago
function getTimeAgo(date) {
  const now = new Date();
  const diffTime = Math.abs(now - new Date(date));
  const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffHours < 1) {
    const diffMinutes = Math.floor(diffTime / (1000 * 60));
    return `${diffMinutes} minutes ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hours ago`;
  } else if (diffDays === 1) {
    return '1 day ago';
  } else {
    return `${diffDays} days ago`;
  }
}

testAPIResponseFormat();