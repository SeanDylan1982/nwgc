const express = require('express');
const router = express.Router();
const NotificationService = require('../services/NotificationService');
const { authenticateToken } = require('../middleware/auth');

/**
 * Get notifications for the authenticated user
 * GET /api/notifications
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly = false, type } = req.query;
    
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      unreadOnly: unreadOnly === 'true',
      type: type || null
    };

    const result = await NotificationService.getNotifications(req.user.userId, options);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get notifications',
      error: error.message
    });
  }
});

/**
 * Get unread notification count
 * GET /api/notifications/unread-count
 */
router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const count = await NotificationService.getUnreadCount(req.user.userId);
    
    res.json({
      success: true,
      data: { count }
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get unread count',
      error: error.message
    });
  }
});

/**
 * Mark notification as read
 * PUT /api/notifications/:id/read
 */
router.put('/:id/read', authenticateToken, async (req, res) => {
  try {
    const notification = await NotificationService.markAsRead(req.params.id, req.user.userId);
    
    res.json({
      success: true,
      data: notification,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(404).json({
      success: false,
      message: error.message === 'Notification not found' ? 'Notification not found' : 'Failed to mark notification as read',
      error: error.message
    });
  }
});

/**
 * Mark all notifications as read
 * PUT /api/notifications/mark-all-read
 */
router.put('/mark-all-read', authenticateToken, async (req, res) => {
  try {
    const result = await NotificationService.markAllAsRead(req.user.userId);
    
    res.json({
      success: true,
      data: result,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read',
      error: error.message
    });
  }
});

/**
 * Delete a notification
 * DELETE /api/notifications/:id
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    await NotificationService.deleteNotification(req.params.id, req.user.userId);
    
    res.json({
      success: true,
      message: 'Notification deleted'
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(404).json({
      success: false,
      message: error.message === 'Notification not found' ? 'Notification not found' : 'Failed to delete notification',
      error: error.message
    });
  }
});

/**
 * Subscribe to push notifications
 * POST /api/notifications/push/subscribe
 */
router.post('/push/subscribe', authenticateToken, async (req, res) => {
  try {
    const { subscription, userAgent } = req.body;
    const userId = req.user.userId;

    // Store subscription in database
    const PushSubscription = require('../models/PushSubscription');
    
    // Remove any existing subscriptions for this user and endpoint
    await PushSubscription.deleteMany({
      userId,
      endpoint: subscription.endpoint
    });

    // Create new subscription
    const newSubscription = new PushSubscription({
      userId,
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      userAgent,
      isActive: true
    });

    await newSubscription.save();

    res.json({
      success: true,
      message: 'Push subscription saved'
    });
  } catch (error) {
    console.error('Push subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save push subscription',
      error: error.message
    });
  }
});

/**
 * Unsubscribe from push notifications
 * POST /api/notifications/push/unsubscribe
 */
router.post('/push/unsubscribe', authenticateToken, async (req, res) => {
  try {
    const { subscription } = req.body;
    const userId = req.user.userId;

    const PushSubscription = require('../models/PushSubscription');
    
    await PushSubscription.deleteMany({
      userId,
      endpoint: subscription.endpoint
    });

    res.json({
      success: true,
      message: 'Push subscription removed'
    });
  } catch (error) {
    console.error('Push unsubscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove push subscription',
      error: error.message
    });
  }
});

/**
 * Subscribe to Huawei push notifications
 * POST /api/notifications/push/huawei-subscribe
 */
router.post('/push/huawei-subscribe', authenticateToken, async (req, res) => {
  try {
    const { token, userAgent } = req.body;
    const userId = req.user.userId;

    const HuaweiPushToken = require('../models/HuaweiPushToken');
    
    // Remove any existing tokens for this user
    await HuaweiPushToken.deleteMany({ userId });

    // Create new token
    const newToken = new HuaweiPushToken({
      userId,
      token,
      userAgent,
      isActive: true
    });

    await newToken.save();

    res.json({
      success: true,
      message: 'Huawei push token saved'
    });
  } catch (error) {
    console.error('Huawei push token error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save Huawei push token',
      error: error.message
    });
  }
});

module.exports = router;