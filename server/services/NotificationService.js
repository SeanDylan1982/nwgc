const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const User = require('../models/User');
const PushNotificationService = require('./PushNotificationService');

class NotificationService {
  /**
   * Create a new notification
   */
  async createNotification(data) {
    try {
      const { recipient, type, title, content, reference, sender, metadata = {} } = data;

      // Validate recipient exists
      const recipientUser = await User.findById(recipient);
      if (!recipientUser) {
        throw new Error('Recipient not found');
      }

      // Check if user has notifications enabled for this type
      const notificationSettings = recipientUser.settings?.notifications || {};
      if (!this.shouldSendNotification(type, notificationSettings)) {
        console.log(`Notification skipped for user ${recipient} - type ${type} disabled`);
        return null;
      }

      // Create notification
      const notification = new Notification({
        recipient,
        type,
        title,
        content,
        reference,
        sender,
        metadata
      });

      await notification.save();
      
      // Populate sender information
      await notification.populate('sender', 'firstName lastName profileImageUrl');
      
      // Send push notification if user has push notifications enabled
      if (this.shouldSendPushNotification(type, recipientUser.settings?.notifications || {})) {
        try {
          await PushNotificationService.sendNotificationPush(notification);
        } catch (error) {
          console.error('Error sending push notification:', error);
          // Don't fail the entire notification creation if push fails
        }
      }
      
      return notification;
    } catch (error) {
      // Handle duplicate key errors gracefully
      if (error.code === 11000) {
        console.log('Duplicate notification prevented:', error.message);
        return null;
      }
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Get notifications for a user
   */
  async getNotifications(userId, options = {}) {
    try {
      const { 
        page = 1, 
        limit = 20, 
        unreadOnly = false,
        type = null 
      } = options;

      const query = { recipient: userId };
      
      if (unreadOnly) {
        query.read = false;
      }
      
      if (type) {
        query.type = type;
      }

      const notifications = await Notification.find(query)
        .populate('sender', 'firstName lastName profileImageUrl')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await Notification.countDocuments(query);

      return {
        notifications,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('Error getting notifications:', error);
      throw error;
    }
  }

  /**
   * Get unread notification count for a user
   */
  async getUnreadCount(userId) {
    try {
      const count = await Notification.countDocuments({
        recipient: userId,
        read: false
      });
      
      return count;
    } catch (error) {
      console.error('Error getting unread count:', error);
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId, userId) {
    try {
      const notification = await Notification.findOneAndUpdate(
        { _id: notificationId, recipient: userId },
        { read: true },
        { new: true }
      );

      if (!notification) {
        throw new Error('Notification not found');
      }

      return notification;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId) {
    try {
      const result = await Notification.updateMany(
        { recipient: userId, read: false },
        { read: true }
      );

      return {
        modifiedCount: result.modifiedCount,
        success: true
      };
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId, userId) {
    try {
      const notification = await Notification.findOneAndDelete({
        _id: notificationId,
        recipient: userId
      });

      if (!notification) {
        throw new Error('Notification not found');
      }

      return { success: true };
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  }

  /**
   * Create friend request notification
   */
  async createFriendRequestNotification(fromUserId, toUserId, friendRequestId) {
    try {
      const fromUser = await User.findById(fromUserId).select('firstName lastName');
      
      return await this.createNotification({
        recipient: toUserId,
        type: 'friendRequest',
        title: 'New Friend Request',
        content: `${fromUser.firstName} ${fromUser.lastName} sent you a friend request`,
        reference: {
          type: 'friendRequest',
          id: friendRequestId
        },
        sender: fromUserId
      });
    } catch (error) {
      console.error('Error creating friend request notification:', error);
      throw error;
    }
  }

  /**
   * Create message notification
   */
  async createMessageNotification(senderId, recipientId, messageId, chatType = 'private') {
    try {
      const sender = await User.findById(senderId).select('firstName lastName');
      
      const title = chatType === 'private' ? 'New Private Message' : 'New Group Message';
      const content = `${sender.firstName} ${sender.lastName} sent you a message`;

      return await this.createNotification({
        recipient: recipientId,
        type: chatType === 'private' ? 'privateMessage' : 'message',
        title,
        content,
        reference: {
          type: 'message',
          id: messageId
        },
        sender: senderId,
        metadata: { chatType }
      });
    } catch (error) {
      console.error('Error creating message notification:', error);
      throw error;
    }
  }

  /**
   * Create like notification
   */
  async createLikeNotification(likerId, contentOwnerId, contentId, contentType) {
    try {
      // Don't notify if user likes their own content
      if (likerId.toString() === contentOwnerId.toString()) {
        return null;
      }

      const liker = await User.findById(likerId).select('firstName lastName');
      
      return await this.createNotification({
        recipient: contentOwnerId,
        type: 'like',
        title: 'New Like',
        content: `${liker.firstName} ${liker.lastName} liked your ${contentType}`,
        reference: {
          type: contentType,
          id: contentId
        },
        sender: likerId
      });
    } catch (error) {
      console.error('Error creating like notification:', error);
      throw error;
    }
  }

  /**
   * Create comment notification
   */
  async createCommentNotification(commenterId, contentOwnerId, contentId, contentType) {
    try {
      // Don't notify if user comments on their own content
      if (commenterId.toString() === contentOwnerId.toString()) {
        return null;
      }

      const commenter = await User.findById(commenterId).select('firstName lastName');
      
      return await this.createNotification({
        recipient: contentOwnerId,
        type: 'comment',
        title: 'New Comment',
        content: `${commenter.firstName} ${commenter.lastName} commented on your ${contentType}`,
        reference: {
          type: contentType,
          id: contentId
        },
        sender: commenterId
      });
    } catch (error) {
      console.error('Error creating comment notification:', error);
      throw error;
    }
  }

  /**
   * Create system notification
   */
  async createSystemNotification(userId, title, content, metadata = {}) {
    try {
      return await this.createNotification({
        recipient: userId,
        type: 'system',
        title,
        content,
        reference: {
          type: 'system',
          id: new mongoose.Types.ObjectId() // Use proper ObjectId for system notifications
        },
        metadata
      });
    } catch (error) {
      console.error('Error creating system notification:', error);
      throw error;
    }
  }

  /**
   * Check if notification should be sent based on user settings
   */
  shouldSendNotification(type, notificationSettings) {
    const typeMapping = {
      friendRequest: 'friendRequests',
      message: 'messages',
      privateMessage: 'messages',
      like: 'push', // General push notifications
      comment: 'push',
      system: 'push',
      report: 'reportNotifications',
      notice: 'push'
    };

    const settingKey = typeMapping[type];
    if (!settingKey) {
      return true; // Default to sending if no specific setting
    }

    return notificationSettings[settingKey] !== false;
  }

  /**
   * Check if push notification should be sent based on user settings
   */
  shouldSendPushNotification(type, notificationSettings) {
    // Check if push notifications are enabled globally
    if (notificationSettings.push === false) {
      return false;
    }

    // Use the same logic as regular notifications
    return this.shouldSendNotification(type, notificationSettings);
  }

  /**
   * Clean up old notifications (older than 30 days)
   */
  async cleanupOldNotifications() {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      const result = await Notification.deleteMany({
        createdAt: { $lt: thirtyDaysAgo },
        read: true
      });

      console.log(`Cleaned up ${result.deletedCount} old notifications`);
      return result.deletedCount;
    } catch (error) {
      console.error('Error cleaning up old notifications:', error);
      throw error;
    }
  }
}

module.exports = new NotificationService();