const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const router = express.Router();

// Get user settings
router.get('/', async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const user = await User.findById(userId).select('settings');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user.settings);
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user settings
router.put('/', [
  body('notifications').optional().isObject(),
  body('privacy').optional().isObject(),
  body('preferences').optional().isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user.userId;
    const { notifications, privacy, preferences } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update settings
    if (notifications) {
      user.settings.notifications = { ...user.settings.notifications, ...notifications };
    }
    
    if (privacy) {
      user.settings.privacy = { ...user.settings.privacy, ...privacy };
    }
    
    if (preferences) {
      // Note: preferences might need to be added to the User model
      user.settings.preferences = { ...user.settings.preferences, ...preferences };
    }

    await user.save();

    res.json({
      message: 'Settings updated successfully',
      settings: user.settings
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Change password
router.put('/password', [
  body('currentPassword').isLength({ min: 6 }).withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.newPassword) {
      throw new Error('Password confirmation does not match');
    }
    return true;
  })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user.userId;
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(12);
    user.password = await bcrypt.hash(newPassword, salt);
    
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete account
router.delete('/account', [
  body('password').isLength({ min: 6 }).withMessage('Password is required for account deletion')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user.userId;
    const { password } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Password is incorrect' });
    }

    // Instead of deleting, mark as inactive (soft delete)
    user.status = 'banned'; // or create a 'deleted' status
    user.email = `deleted_${Date.now()}_${user.email}`; // Prevent email conflicts
    await user.save();

    // TODO: Clean up user data
    // - Remove from friends lists
    // - Archive messages
    // - Transfer or remove authored content

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update notification preferences
router.put('/notifications', [
  body('email').optional().isBoolean(),
  body('push').optional().isBoolean(),
  body('friendRequests').optional().isBoolean(),
  body('messages').optional().isBoolean(),
  body('chatNotifications').optional().isBoolean(),
  body('reportNotifications').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user.userId;
    const notificationSettings = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update notification settings
    Object.keys(notificationSettings).forEach(key => {
      if (user.settings.notifications.hasOwnProperty(key)) {
        user.settings.notifications[key] = notificationSettings[key];
      }
    });

    await user.save();

    res.json({
      message: 'Notification settings updated successfully',
      notifications: user.settings.notifications
    });
  } catch (error) {
    console.error('Update notification settings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update privacy preferences
router.put('/privacy', [
  body('profileVisibility').optional().isIn(['public', 'neighbours', 'friends', 'private']),
  body('messagePermissions').optional().isIn(['everyone', 'neighbours', 'friends', 'none'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user.userId;
    const privacySettings = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update privacy settings
    Object.keys(privacySettings).forEach(key => {
      if (user.settings.privacy.hasOwnProperty(key)) {
        user.settings.privacy[key] = privacySettings[key];
      }
    });

    await user.save();

    res.json({
      message: 'Privacy settings updated successfully',
      privacy: user.settings.privacy
    });
  } catch (error) {
    console.error('Update privacy settings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get interface settings (sidebar preferences, etc.)
router.get('/interface', async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const user = await User.findById(userId).select('settings.interface');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Return interface settings with defaults if not set
    const interfaceSettings = user.settings?.interface || {
      sidebarExpanded: false, // Default to collapsed
      darkMode: false,
      language: 'en'
    };

    res.json(interfaceSettings);
  } catch (error) {
    console.error('Get interface settings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update interface preferences (sidebar, theme, etc.)
router.put('/interface', [
  body('sidebarExpanded').optional().isBoolean(),
  body('darkMode').optional().isBoolean(),
  body('language').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user.userId;
    const interfaceSettings = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Initialize interface settings if they don't exist
    if (!user.settings.interface) {
      user.settings.interface = {
        sidebarExpanded: false,
        darkMode: false,
        language: 'en'
      };
    }

    // Update interface settings
    Object.keys(interfaceSettings).forEach(key => {
      if (interfaceSettings[key] !== undefined) {
        user.settings.interface[key] = interfaceSettings[key];
      }
    });

    await user.save();

    res.json({
      message: 'Interface settings updated successfully',
      interface: user.settings.interface
    });
  } catch (error) {
    console.error('Update interface settings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;