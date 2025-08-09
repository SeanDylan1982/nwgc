const User = require('../models/User');
const Notice = require('../models/Notice');
const Report = require('../models/Report');
const Message = require('../models/Message');
const ChatGroup = require('../models/ChatGroup');

class StatsService {
  /**
   * Get comprehensive user statistics
   */
  async getUserStats(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const [
        reportsCount,
        noticesCount,
        messagesCount,
        friendsCount
      ] = await Promise.all([
        Report.countDocuments({ reporterId: userId, reportStatus: 'active' }),
        Notice.countDocuments({ authorId: userId, status: 'active' }),
        Message.countDocuments({ senderId: userId }),
        User.findById(userId).select('friends').then(u => u?.friends?.length || 0)
      ]);

      const memberSince = this.calculateTimeSince(user.createdAt);

      return {
        reportsCount,
        noticesCount,
        messagesCount,
        friendsCount,
        memberSince,
        joinDate: user.createdAt,
        status: user.status
      };
    } catch (error) {
      console.error('Error getting user stats:', error);
      throw error;
    }
  }

  /**
   * Get community statistics for a neighbourhood
   */
  async getCommunityStats(neighbourhoodId) {
    try {
      const [
        totalMembers,
        activeReports,
        totalNotices,
        totalMessages,
        recentActivity
      ] = await Promise.all([
        User.countDocuments({ neighbourhoodId, isActive: true }),
        Report.countDocuments({ neighbourhoodId, status: { $in: ['open', 'in-progress'] }, reportStatus: 'active' }),
        Notice.countDocuments({ neighbourhoodId, status: 'active' }),
        this.getMessageCountForNeighbourhood(neighbourhoodId),
        this.getRecentActivityForNeighbourhood(neighbourhoodId)
      ]);

      console.log('Community stats debug:', {
        neighbourhoodId,
        totalMembers,
        activeReports,
        totalNotices,
        totalMessages
      });

      return {
        totalMembers,
        activeReports,
        totalNotices,
        totalMessages,
        recentActivity
      };
    } catch (error) {
      console.error('Error getting community stats:', error);
      throw error;
    }
  }

  /**
   * Get engagement metrics for content
   */
  async getEngagementMetrics(contentType, contentId) {
    try {
      let Model;
      switch (contentType) {
        case 'notice':
          Model = Notice;
          break;
        case 'report':
          Model = Report;
          break;
        default:
          throw new Error('Invalid content type');
      }

      const content = await Model.findById(contentId);
      if (!content) {
        throw new Error('Content not found');
      }

      return {
        likes: content.likes ? content.likes.length : 0,
        comments: content.comments ? content.comments.length : 0,
        views: content.viewCount || 0
      };
    } catch (error) {
      console.error('Error getting engagement metrics:', error);
      throw error;
    }
  }

  /**
   * Calculate time since a given date
   */
  calculateTimeSince(date) {
    const now = new Date();
    const diffTime = Math.abs(now - new Date(date));
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 30) {
      return `${diffDays} days`;
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return `${months} month${months > 1 ? 's' : ''}`;
    } else {
      const years = Math.floor(diffDays / 365);
      return `${years} year${years > 1 ? 's' : ''}`;
    }
  }

  /**
   * Get message count for a neighbourhood (from group chats)
   */
  async getMessageCountForNeighbourhood(neighbourhoodId) {
    try {
      // Get all chat groups for the neighbourhood
      const chatGroups = await ChatGroup.find({ neighbourhoodId }).select('_id');
      const chatGroupIds = chatGroups.map(group => group._id);

      // Count messages in these groups
      const messageCount = await Message.countDocuments({
        chatId: { $in: chatGroupIds },
        chatType: 'group'
      });

      return messageCount;
    } catch (error) {
      console.error('Error getting message count for neighbourhood:', error);
      return 0;
    }
  }

  /**
   * Get recent activity for a neighbourhood
   */
  async getRecentActivityForNeighbourhood(neighbourhoodId, limit = 10) {
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const [recentNotices, recentReports] = await Promise.all([
        Notice.find({
          neighbourhoodId,
          status: 'active',
          createdAt: { $gte: oneDayAgo }
        }).countDocuments(),
        Report.find({
          neighbourhoodId,
          reportStatus: 'active',
          createdAt: { $gte: oneDayAgo }
        }).countDocuments()
      ]);

      return {
        last24Hours: {
          notices: recentNotices,
          reports: recentReports
        }
      };
    } catch (error) {
      console.error('Error getting recent activity:', error);
      return { last24Hours: { notices: 0, reports: 0 } };
    }
  }

  /**
   * Get active chats count for a user (both group and private chats)
   */
  async getActiveChatsCount(userId) {
    try {
      const PrivateChat = require('../models/PrivateChat');
      
      const [groupChatsCount, privateChatsCount] = await Promise.all([
        ChatGroup.countDocuments({
          'members.userId': userId,
          isActive: true
        }),
        PrivateChat.countDocuments({
          participants: userId,
          isActive: true
        })
      ]);

      return groupChatsCount + privateChatsCount;
    } catch (error) {
      console.error('Error getting active chats count:', error);
      return 0;
    }
  }

  /**
   * Get dashboard statistics for a user
   */
  async getDashboardStats(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const [userStats, communityStats, activeChatsCount] = await Promise.all([
        this.getUserStats(userId),
        this.getCommunityStats(user.neighbourhoodId),
        this.getActiveChatsCount(userId)
      ]);

      // Get recent items for dashboard
      const recentNotices = await Notice.find({
        neighbourhoodId: user.neighbourhoodId,
        status: 'active'
      })
      .populate('authorId', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(5);

      const recentReports = await Report.find({
        neighbourhoodId: user.neighbourhoodId,
        reportStatus: 'active'
      })
      .populate('reporterId', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(5);

      // Get total counts for dashboard cards
      const totalNoticesCount = await Notice.countDocuments({
        neighbourhoodId: user.neighbourhoodId,
        status: 'active'
      });

      return {
        user: userStats,
        community: {
          ...communityStats,
          totalNotices: totalNoticesCount // Override with correct count
        },
        activeChatsCount,
        recentItems: {
          notices: recentNotices,
          reports: recentReports
        }
      };
    } catch (error) {
      console.error('Error getting dashboard stats:', error);
      throw error;
    }
  }

  /**
   * Get statistics with error handling and fallbacks
   */
  async getStatsWithFallback(userId) {
    try {
      return await this.getDashboardStats(userId);
    } catch (error) {
      console.error('Stats service error, returning fallback:', error);
      
      // Return fallback stats
      return {
        user: {
          reportsCount: 0,
          noticesCount: 0,
          messagesCount: 0,
          friendsCount: 0,
          memberSince: 'Unknown',
          joinDate: new Date(),
          status: 'active'
        },
        community: {
          totalMembers: 0,
          activeReports: 0,
          totalNotices: 0,
          totalMessages: 0,
          recentActivity: { last24Hours: { notices: 0, reports: 0 } }
        },
        recentItems: {
          notices: [],
          reports: []
        }
      };
    }
  }
}

module.exports = new StatsService();