const mongoose = require('mongoose');
const User = require('../models/User');

async function testStatsServiceOnly() {
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

    // Test the StatsService methods directly
    const StatsService = require('../services/StatsService');
    console.log('StatsService imported successfully');

    console.log('\n=== Testing Dashboard Stats ===');
    try {
      const dashboardStats = await StatsService.getDashboardStats(sampleUser._id);
      console.log('✓ StatsService.getDashboardStats() works');
      
      console.log('Dashboard stats structure:');
      console.log('- activeChatsCount:', dashboardStats.activeChatsCount);
      console.log('- community:', dashboardStats.community);
      console.log('- recentItems.notices length:', dashboardStats.recentItems?.notices?.length);
      console.log('- recentItems.reports length:', dashboardStats.recentItems?.reports?.length);
      
      // Test the exact format that the API endpoint would create
      const apiResponse = {
        success: true,
        data: {
          activeChats: dashboardStats.activeChatsCount || 0,
          newNotices: dashboardStats.community.totalNotices,
          openReports: dashboardStats.community.activeReports,
          neighbours: dashboardStats.community.totalMembers,
          userStats: dashboardStats.user,
          recentItems: dashboardStats.recentItems
        }
      };
      
      console.log('\nAPI Response format:');
      console.log(JSON.stringify(apiResponse, null, 2));
      
    } catch (error) {
      console.log('✗ StatsService.getDashboardStats() failed:', error.message);
      console.log('Error stack:', error.stack);
    }

    console.log('\n=== Testing Recent Notices Format ===');
    try {
      const stats = await StatsService.getDashboardStats(sampleUser._id);
      
      if (!stats.recentItems.notices || stats.recentItems.notices.length === 0) {
        console.log('No recent notices found');
      } else {
        const formattedNotices = stats.recentItems.notices.slice(0, 3).map(notice => ({
          id: notice._id,
          title: notice.title,
          category: notice.category,
          author: notice.authorId ? `${notice.authorId.firstName} ${notice.authorId.lastName}` : 'Unknown Author',
          time: getTimeAgo(notice.createdAt),
          likes: notice.likes ? notice.likes.length : 0,
          comments: notice.comments ? notice.comments.length : 0
        }));

        console.log('Formatted notices:');
        console.log(JSON.stringify(formattedNotices, null, 2));
      }
    } catch (error) {
      console.log('✗ Recent notices formatting failed:', error.message);
    }

    console.log('\n=== Testing Fallback Method ===');
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

testStatsServiceOnly();