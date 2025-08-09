const mongoose = require('mongoose');
const User = require('../models/User');
const StatsService = require('../services/StatsService');

async function testDashboardEndpoints() {
  try {
    // Load environment variables
    require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') });
    
    // Connect to database - ALWAYS use MongoDB Atlas
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI environment variable is required. Local MongoDB connections are not allowed.');
    }
    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Get a sample user
    const sampleUser = await User.findOne({ isActive: true });
    if (!sampleUser) {
      console.log('No active users found');
      return;
    }

    console.log(`Testing with user: ${sampleUser.firstName} ${sampleUser.lastName}`);

    // Test dashboard stats
    console.log('\n=== Testing Dashboard Stats ===');
    const dashboardStats = await StatsService.getDashboardStats(sampleUser._id);
    console.log('Dashboard Stats:', {
      activeChatsCount: dashboardStats.activeChatsCount,
      totalNotices: dashboardStats.community.totalNotices,
      activeReports: dashboardStats.community.activeReports,
      totalMembers: dashboardStats.community.totalMembers,
      recentNoticesCount: dashboardStats.recentItems.notices.length,
      recentReportsCount: dashboardStats.recentItems.reports.length
    });

    // Test recent notices formatting
    console.log('\n=== Testing Recent Notices ===');
    const recentNotices = dashboardStats.recentItems.notices.slice(0, 3);
    console.log('Recent Notices:');
    recentNotices.forEach((notice, index) => {
      console.log(`${index + 1}. ${notice.title}`);
      console.log(`   Author: ${notice.authorId?.firstName} ${notice.authorId?.lastName}`);
      console.log(`   Category: ${notice.category}`);
      console.log(`   Created: ${notice.createdAt}`);
      console.log(`   Likes: ${notice.likes?.length || 0}`);
      console.log(`   Comments: ${notice.comments?.length || 0}`);
    });

    // Test recent reports formatting
    console.log('\n=== Testing Recent Reports ===');
    const recentReports = dashboardStats.recentItems.reports.slice(0, 3);
    console.log('Recent Reports:');
    recentReports.forEach((report, index) => {
      console.log(`${index + 1}. ${report.title}`);
      console.log(`   Reporter: ${report.reporterId?.firstName} ${report.reporterId?.lastName}`);
      console.log(`   Priority: ${report.priority}`);
      console.log(`   Status: ${report.status}`);
      console.log(`   Created: ${report.createdAt}`);
      console.log(`   Likes: ${report.likes?.length || 0}`);
    });

  } catch (error) {
    console.error('Test error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

testDashboardEndpoints();