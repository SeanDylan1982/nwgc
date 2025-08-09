const webpush = require('web-push');
const PushSubscription = require('../models/PushSubscription');
const HuaweiPushToken = require('../models/HuaweiPushToken');

class PushNotificationService {
  constructor() {
    // Configure web-push with VAPID keys
    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
    const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@neighborhood-app.com';

    if (vapidPublicKey && vapidPrivateKey) {
      webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    } else {
      console.warn('VAPID keys not configured. Push notifications will not work.');
    }
  }

  /**
   * Send push notification to a specific user
   */
  async sendToUser(userId, payload) {
    try {
      const subscriptions = await PushSubscription.find({
        userId,
        isActive: true
      });

      const promises = subscriptions.map(subscription => 
        this.sendToSubscription(subscription, payload)
      );

      const results = await Promise.allSettled(promises);
      
      // Log failed sends and deactivate invalid subscriptions
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`Failed to send push notification to subscription ${subscriptions[index]._id}:`, result.reason);
          
          // Deactivate subscription if it's invalid
          if (result.reason.statusCode === 410 || result.reason.statusCode === 404) {
            this.deactivateSubscription(subscriptions[index]._id);
          }
        }
      });

      return results.filter(result => result.status === 'fulfilled').length;
    } catch (error) {
      console.error('Error sending push notifications to user:', error);
      return 0;
    }
  }

  /**
   * Send push notification to multiple users
   */
  async sendToUsers(userIds, payload) {
    const promises = userIds.map(userId => this.sendToUser(userId, payload));
    const results = await Promise.allSettled(promises);
    
    return results.reduce((total, result) => {
      return total + (result.status === 'fulfilled' ? result.value : 0);
    }, 0);
  }

  /**
   * Send push notification to a specific subscription
   */
  async sendToSubscription(subscription, payload) {
    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: subscription.keys
    };

    const options = {
      TTL: 24 * 60 * 60, // 24 hours
      urgency: 'normal',
      headers: {}
    };

    // Update last used timestamp
    subscription.lastUsed = new Date();
    await subscription.save();

    return webpush.sendNotification(pushSubscription, JSON.stringify(payload), options);
  }

  /**
   * Deactivate invalid subscription
   */
  async deactivateSubscription(subscriptionId) {
    try {
      await PushSubscription.findByIdAndUpdate(subscriptionId, {
        isActive: false
      });
    } catch (error) {
      console.error('Error deactivating subscription:', error);
    }
  }

  /**
   * Send notification based on notification type
   */
  async sendNotificationPush(notification) {
    const payload = this.createPayloadFromNotification(notification);
    return this.sendToUser(notification.recipient, payload);
  }

  /**
   * Create push payload from notification object
   */
  createPayloadFromNotification(notification) {
    const basePayload = {
      title: notification.title,
      body: notification.content,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      tag: notification.type,
      requireInteraction: false,
      vibrate: [200, 100, 200],
      data: {
        type: notification.type,
        referenceId: notification.reference?.id,
        referenceType: notification.reference?.type,
        notificationId: notification._id,
        timestamp: notification.createdAt
      }
    };

    // Customize based on notification type
    switch (notification.type) {
      case 'friendRequest':
        return {
          ...basePayload,
          actions: [
            { action: 'view', title: 'View Request' },
            { action: 'dismiss', title: 'Dismiss' }
          ]
        };

      case 'message':
      case 'privateMessage':
        return {
          ...basePayload,
          requireInteraction: true,
          actions: [
            { action: 'reply', title: 'Reply' },
            { action: 'view', title: 'View Chat' },
            { action: 'dismiss', title: 'Dismiss' }
          ],
          data: {
            ...basePayload.data,
            chatId: notification.reference?.id
          }
        };

      case 'like':
        return {
          ...basePayload,
          icon: '/icons/like-icon.png',
          actions: [
            { action: 'view', title: 'View Post' },
            { action: 'dismiss', title: 'Dismiss' }
          ]
        };

      case 'comment':
        return {
          ...basePayload,
          requireInteraction: true,
          actions: [
            { action: 'reply', title: 'Reply' },
            { action: 'view', title: 'View Post' },
            { action: 'dismiss', title: 'Dismiss' }
          ]
        };

      case 'system':
        return {
          ...basePayload,
          requireInteraction: true,
          urgency: 'high',
          actions: [
            { action: 'view', title: 'View Details' },
            { action: 'dismiss', title: 'Dismiss' }
          ]
        };

      default:
        return basePayload;
    }
  }

  /**
   * Send Huawei push notification
   */
  async sendHuaweiNotification(userId, payload) {
    try {
      const tokens = await HuaweiPushToken.find({
        userId,
        isActive: true
      });

      if (tokens.length === 0) {
        return 0;
      }

      // Huawei HMS Push implementation would go here
      // This is a placeholder for the actual HMS Push API calls
      console.log('Huawei push notification would be sent to:', tokens.length, 'devices');
      
      return tokens.length;
    } catch (error) {
      console.error('Error sending Huawei push notification:', error);
      return 0;
    }
  }

  /**
   * Clean up expired subscriptions
   */
  async cleanupExpiredSubscriptions() {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      const result = await PushSubscription.deleteMany({
        isActive: false,
        updatedAt: { $lt: thirtyDaysAgo }
      });

      console.log(`Cleaned up ${result.deletedCount} expired push subscriptions`);
      return result.deletedCount;
    } catch (error) {
      console.error('Error cleaning up expired subscriptions:', error);
      return 0;
    }
  }

  /**
   * Get subscription statistics
   */
  async getSubscriptionStats() {
    try {
      const [totalSubscriptions, activeSubscriptions, huaweiTokens] = await Promise.all([
        PushSubscription.countDocuments(),
        PushSubscription.countDocuments({ isActive: true }),
        HuaweiPushToken.countDocuments({ isActive: true })
      ]);

      return {
        total: totalSubscriptions,
        active: activeSubscriptions,
        inactive: totalSubscriptions - activeSubscriptions,
        huawei: huaweiTokens
      };
    } catch (error) {
      console.error('Error getting subscription stats:', error);
      return {
        total: 0,
        active: 0,
        inactive: 0,
        huawei: 0
      };
    }
  }
}

module.exports = new PushNotificationService();