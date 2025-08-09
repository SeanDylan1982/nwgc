const express = require('express');
const StatsService = require('../services/StatsService');
const router = express.Router();

// Get dashboard statistics
router.get('/dashboard', async (req, res) => {
  try {
    console.log('Dashboard endpoint called for user:', req.user.userId);
    const userId = req.user.userId;
    const stats = await StatsService.getDashboardStats(userId);
    console.log('Dashboard stats retrieved successfully');
    
    // Format for consistent API response
    const response = {
      success: true,
      data: {
        activeChats: stats.activeChatsCount || 0,
        newNotices: stats.community.totalNotices, // Use total notices count
        openReports: stats.community.activeReports,
        neighbours: stats.community.totalMembers,
        userStats: stats.user,
        recentItems: stats.recentItems
      }
    };

    console.log('Sending dashboard response:', JSON.stringify(response, null, 2));
    res.json(response);
  } catch (error) {
    console.error('Get dashboard statistics error:', error);
    console.error('Dashboard error stack:', error.stack);
    try {
      const fallbackStats = await StatsService.getStatsWithFallback(req.user.userId);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch statistics',
        message: 'Using fallback data',
        data: {
          activeChats: fallbackStats.activeChatsCount || 0,
          newNotices: fallbackStats.community?.totalNotices || 0,
          openReports: fallbackStats.community?.activeReports || 0,
          neighbours: fallbackStats.community?.totalMembers || 0,
          userStats: fallbackStats.user,
          recentItems: fallbackStats.recentItems
        }
      });
    } catch (fallbackError) {
      console.error('Fallback statistics error:', fallbackError);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch statistics',
        message: 'All statistics services unavailable',
        data: {
          activeChats: 0,
          newNotices: 0,
          openReports: 0,
          neighbours: 0,
          userStats: {},
          recentItems: { notices: [], reports: [] }
        }
      });
    }
  }
});

// Get user profile statistics
router.get('/profile/:userId?', async (req, res) => {
  try {
    const targetUserId = req.params.userId || req.user.userId;
    const userStats = await StatsService.getUserStats(targetUserId);

    res.json({
      reportsFiled: userStats.reportsCount,
      messagesSent: userStats.messagesCount,
      noticesPosted: userStats.noticesCount,
      memberSince: userStats.memberSince,
      friendsCount: userStats.friendsCount
    });
  } catch (error) {
    console.error('Get profile statistics error:', error);
    res.status(500).json({ 
      message: 'Server error',
      reportsFiled: 0,
      messagesSent: 0,
      noticesPosted: 0,
      memberSince: 'Unknown',
      friendsCount: 0
    });
  }
});

// Get recent notices for dashboard
router.get('/recent-notices', async (req, res) => {
  try {
    console.log('Recent notices endpoint called for user:', req.user.userId);
    const userId = req.user.userId;
    const limit = parseInt(req.query.limit) || 3;
    
    console.log('Fetching recent notices for user:', userId);
    const stats = await StatsService.getDashboardStats(userId);
    
    console.log('Recent notices from stats:', stats.recentItems.notices.length);
    
    if (!stats.recentItems.notices || stats.recentItems.notices.length === 0) {
      console.log('No recent notices found');
      return res.json({
        success: true,
        data: [],
        count: 0
      });
    }

    const formattedNotices = stats.recentItems.notices.slice(0, limit).map(notice => {
      console.log('Formatting notice:', notice.title, 'by', notice.authorId);
      return {
        id: notice._id,
        title: notice.title,
        category: notice.category,
        author: notice.authorId ? `${notice.authorId.firstName} ${notice.authorId.lastName}` : 'Unknown Author',
        time: getTimeAgo(notice.createdAt),
        likes: notice.likes ? notice.likes.length : 0,
        comments: notice.comments ? notice.comments.length : 0
      };
    });

    console.log('Formatted notices:', formattedNotices.length);
    const noticesResponse = {
      success: true,
      data: formattedNotices,
      count: formattedNotices.length
    };
    console.log('Sending notices response:', JSON.stringify(noticesResponse, null, 2));
    res.json(noticesResponse);
  } catch (error) {
    console.error('Get recent notices error:', error);
    console.error('Recent notices error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recent notices',
      message: error.message,
      data: [],
      count: 0
    });
  }
});

// Get recent reports for dashboard
router.get('/recent-reports', async (req, res) => {
  try {
    const userId = req.user.userId;
    const limit = parseInt(req.query.limit) || 3;
    
    console.log('Fetching recent reports for user:', userId);
    const stats = await StatsService.getDashboardStats(userId);
    
    console.log('Recent reports from stats:', stats.recentItems.reports.length);
    
    if (!stats.recentItems.reports || stats.recentItems.reports.length === 0) {
      console.log('No recent reports found');
      return res.json({
        success: true,
        data: [],
        count: 0
      });
    }

    const formattedReports = stats.recentItems.reports.slice(0, limit).map(report => {
      console.log('Formatting report:', report.title, 'by', report.reporterId);
      return {
        id: report._id,
        title: report.title,
        severity: report.priority,
        status: report.status,
        time: getTimeAgo(report.createdAt),
        likes: report.likes ? report.likes.length : 0
      };
    });

    console.log('Formatted reports:', formattedReports.length);
    const reportsResponse = {
      success: true,
      data: formattedReports,
      count: formattedReports.length
    };
    console.log('Sending reports response:', JSON.stringify(reportsResponse, null, 2));
    res.json(reportsResponse);
  } catch (error) {
    console.error('Get recent reports error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recent reports',
      message: error.message,
      data: [],
      count: 0
    });
  }
});

// Get engagement metrics for content
router.get('/engagement/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;
    const metrics = await StatsService.getEngagementMetrics(type, id);
    res.json(metrics);
  } catch (error) {
    console.error('Get engagement metrics error:', error);
    res.status(500).json({ 
      message: 'Server error',
      likes: 0,
      comments: 0,
      views: 0
    });
  }
});

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

module.exports = router;