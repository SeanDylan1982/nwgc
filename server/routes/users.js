const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Neighbourhood = require('../models/Neighbourhood');
const { requireRole } = require('../middleware/auth');
const { executeQuery, withTransaction } = require('../utils/dbOperationWrapper');
const { enhanceError } = require('../utils/errorClassification');
const { handleDatabaseError } = require('../utils/errorHandler');
const router = express.Router();  

// Get current user profile
router.get('/me', async (req, res) => {
  try {
    const userId = req.user.userId;

    const user = await executeQuery(
      async () => {
        return User.findById(userId)
          .populate('neighbourhoodId', 'name')
          .select('-password');
      },
      {
        operationName: 'Get user profile',
        timeout: 5000,
        retryOptions: {
          maxRetries: 3,
          initialDelayMs: 100,
          maxDelayMs: 3000
        },
        metadata: { userId }
      }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      address: user.address,
      profileImageUrl: user.profileImageUrl,
      role: user.role,
      isVerified: user.isVerified,
      neighbourhoodId: user.neighbourhoodId?._id,
      neighbourhoodName: user.neighbourhoodId?.name,
      createdAt: user.createdAt,
      settings: user.settings
    });
  } catch (error) {
    // Use enhanced error handling
    const enhancedErr = enhanceError(error);
    const { statusCode, errorResponse } = handleDatabaseError(enhancedErr, {
      defaultMessage: 'Failed to retrieve user profile',
      defaultStatusCode: 500
    });
    
    res.status(statusCode).json(errorResponse);
  }
});

// Update user profile (alias for /me)
router.put('/profile', [
  body('firstName').optional().trim().isLength({ min: 1 }),
  body('lastName').optional().trim().isLength({ min: 1 }),
  body('phone').optional().isMobilePhone(),
  body('address').optional().trim(),
  body('bio').optional().trim().isLength({ max: 500 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user.userId;
    const { firstName, lastName, phone, address, bio } = req.body;

    const updateData = {};
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (phone !== undefined) updateData.phone = phone;
    if (address !== undefined) updateData.address = address;
    if (bio !== undefined) updateData.bio = bio;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'No fields to update' 
      });
    }

    const user = await executeQuery(
      async () => {
        return User.findByIdAndUpdate(
          userId,
          updateData,
          { new: true, runValidators: true }
        ).select('-password');
      },
      {
        operationName: 'Update user profile',
        timeout: 10000,
        retryOptions: {
          maxRetries: 3,
          initialDelayMs: 200,
          maxDelayMs: 5000
        },
        metadata: { userId, updateFields: Object.keys(updateData) }
      }
    );

    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        address: user.address,
        bio: user.bio,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    // Use enhanced error handling
    const enhancedErr = enhanceError(error);
    const { statusCode, errorResponse } = handleDatabaseError(enhancedErr, {
      defaultMessage: 'Failed to update user profile',
      defaultStatusCode: 500,
      context: {
        operation: 'Update user profile',
        userId: req.user.userId
      }
    });
    
    res.status(statusCode).json({
      success: false,
      ...errorResponse
    });
  }
});

// Update user profile
router.put('/me', [
  body('firstName').optional().trim().isLength({ min: 1 }),
  body('lastName').optional().trim().isLength({ min: 1 }),
  body('phone').optional().isMobilePhone(),
  body('address').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user.userId;
    const { firstName, lastName, phone, address } = req.body;

    const updateData = {};
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (phone !== undefined) updateData.phone = phone;
    if (address !== undefined) updateData.address = address;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    const user = await executeQuery(
      async () => {
        return User.findByIdAndUpdate(
          userId,
          updateData,
          { new: true, runValidators: true }
        ).select('-password');
      },
      {
        operationName: 'Update user profile',
        timeout: 10000,
        retryOptions: {
          maxRetries: 3,
          initialDelayMs: 200,
          maxDelayMs: 5000
        },
        metadata: { userId, updateFields: Object.keys(updateData) }
      }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      address: user.address,
      updatedAt: user.updatedAt
    });
  } catch (error) {
    // Use enhanced error handling
    const enhancedErr = enhanceError(error);
    const { statusCode, errorResponse } = handleDatabaseError(enhancedErr, {
      defaultMessage: 'Failed to update user profile',
      defaultStatusCode: 500,
      context: {
        operation: 'Update user profile',
        userId: req.user.userId
      }
    });
    
    res.status(statusCode).json(errorResponse);
  }
});

// Get neighbourhood members
router.get('/neighbours', async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get current user to find their neighbourhood (simplified without transaction)
    const currentUser = await User.findById(userId).select('neighbourhoodId');
    
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!currentUser.neighbourhoodId) {
      return res.status(400).json({ message: 'User not assigned to a neighbourhood' });
    }

    // Get neighbours in the same neighbourhood
    const neighbours = await User.find({
      neighbourhoodId: currentUser.neighbourhoodId,
      isActive: true,
      _id: { $ne: userId }
    })
    .select('firstName lastName email phone address role status createdAt')
    .sort({ firstName: 1, lastName: 1 });

    // Format response with privacy settings
    const formattedNeighbours = neighbours.map(user => {
      const baseInfo = {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
        joinedAt: user.createdAt
      };

      // For now, show all info since they're neighbors (can add privacy settings later)
      return {
        ...baseInfo,
        email: user.email,
        phone: user.phone,
        address: user.address
      };
    });

    res.json(formattedNeighbours);
  } catch (error) {
    console.error('Error fetching neighbours:', error);
    res.status(500).json({ message: 'Failed to retrieve neighbourhood members' });
  }
});

// Update user settings
router.put('/settings', [
  body('notificationsEnabled').optional().isBoolean(),
  body('emailNotifications').optional().isBoolean(),
  body('pushNotifications').optional().isBoolean(),
  body('chatNotifications').optional().isBoolean(),
  body('reportNotifications').optional().isBoolean(),
  body('privacyLevel').optional().isIn(['public', 'neighbours', 'contacts', 'private']),
  body('locationSharing').optional().isBoolean(),
  body('dismissedWelcomeMessages').optional().isObject(),
  body('dismissedWelcomeMessages.chat').optional().isBoolean(),
  body('dismissedWelcomeMessages.noticeBoard').optional().isBoolean(),
  body('dismissedWelcomeMessages.reports').optional().isBoolean(),
  body('welcomeMessageStates').optional().isObject(),
  body('welcomeMessageStates.chat').optional().isObject(),
  body('welcomeMessageStates.chat.dismissed').optional().isBoolean(),
  body('welcomeMessageStates.chat.collapsed').optional().isBoolean(),
  body('welcomeMessageStates.noticeBoard').optional().isObject(),
  body('welcomeMessageStates.noticeBoard.dismissed').optional().isBoolean(),
  body('welcomeMessageStates.noticeBoard.collapsed').optional().isBoolean(),
  body('welcomeMessageStates.reports').optional().isObject(),
  body('welcomeMessageStates.reports.dismissed').optional().isBoolean(),
  body('welcomeMessageStates.reports.collapsed').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user.userId;
    const settingsUpdate = req.body;

    // Build the settings update object
    const updateData = {};
    Object.keys(settingsUpdate).forEach(key => {
      if (settingsUpdate[key] !== undefined) {
        if (key === 'dismissedWelcomeMessages') {
          // Handle nested dismissedWelcomeMessages object
          Object.keys(settingsUpdate[key]).forEach(subKey => {
            if (settingsUpdate[key][subKey] !== undefined) {
              updateData[`settings.dismissedWelcomeMessages.${subKey}`] = settingsUpdate[key][subKey];
            }
          });
        } else if (key === 'welcomeMessageStates') {
          // Handle nested welcomeMessageStates object
          Object.keys(settingsUpdate[key]).forEach(messageType => {
            if (settingsUpdate[key][messageType] !== undefined) {
              Object.keys(settingsUpdate[key][messageType]).forEach(stateKey => {
                if (settingsUpdate[key][messageType][stateKey] !== undefined) {
                  updateData[`settings.welcomeMessageStates.${messageType}.${stateKey}`] = settingsUpdate[key][messageType][stateKey];
                }
              });
            }
          });
        } else {
          updateData[`settings.${key}`] = settingsUpdate[key];
        }
      }
    });

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: 'No settings to update' });
    }

    const user = await executeQuery(
      async () => {
        return User.findByIdAndUpdate(
          userId,
          { $set: updateData },
          { new: true, runValidators: true }
        ).select('settings');
      },
      {
        operationName: 'Update user settings',
        timeout: 8000,
        retryOptions: {
          maxRetries: 3,
          initialDelayMs: 200,
          maxDelayMs: 3000
        },
        metadata: { 
          userId,
          settingsUpdated: Object.keys(updateData).map(key => key.replace('settings.', ''))
        }
      }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'Settings updated successfully', settings: user.settings });
  } catch (error) {
    // Use enhanced error handling
    const enhancedErr = enhanceError(error);
    const { statusCode, errorResponse } = handleDatabaseError(enhancedErr, {
      defaultMessage: 'Failed to update user settings',
      defaultStatusCode: 500,
      context: {
        operation: 'Update user settings',
        userId: req.user.userId
      }
    });
    
    res.status(statusCode).json(errorResponse);
  }
});

// Admin: Get all users
router.get('/', requireRole(['admin']), async (req, res) => {
  try {
    const users = await executeQuery(
      async () => {
        return User.find({})
          .populate('neighbourhoodId', 'name')
          .select('-password')
          .sort({ createdAt: -1 });
      },
      {
        operationName: 'Admin: Get all users',
        timeout: 15000, // Longer timeout for potentially large result set
        retryOptions: {
          maxRetries: 2,
          initialDelayMs: 200,
          maxDelayMs: 2000
        },
        metadata: { 
          adminId: req.user.userId,
          operation: 'list_all_users'
        }
      }
    );

    const usersData = users.map(user => ({
      _id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      address: user.address,
      role: user.role,
      status: user.status || 'active',
      isVerified: user.isVerified,
      isActive: user.isActive,
      neighbourhoodId: user.neighbourhoodId?._id,
      neighbourhoodName: user.neighbourhoodId?.name,
      createdAt: user.createdAt,
      profileImageUrl: user.profileImageUrl
    }));

    res.json(usersData);
  } catch (error) {
    // Use enhanced error handling
    const enhancedErr = enhanceError(error);
    const { statusCode, errorResponse } = handleDatabaseError(enhancedErr, {
      defaultMessage: 'Failed to retrieve users',
      defaultStatusCode: 500,
      context: {
        operation: 'Admin: Get all users',
        adminId: req.user.userId
      }
    });
    
    res.status(statusCode).json(errorResponse);
  }
});

// Admin: Update user role
router.patch('/:id/role', requireRole(['admin']), [
  body('role').isIn(['admin', 'moderator', 'user'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const targetUserId = req.params.id;
    const { role } = req.body;
    const adminUserId = req.user.userId;

    // Prevent self-demotion
    if (targetUserId === adminUserId && role !== 'admin') {
      return res.status(400).json({ message: 'Cannot change your own admin role' });
    }

    const user = await executeQuery(
      async () => {
        return User.findByIdAndUpdate(
          targetUserId,
          { role },
          { new: true, runValidators: true }
        ).select('_id role');
      },
      {
        operationName: 'Admin: Update user role',
        timeout: 8000,
        retryOptions: {
          maxRetries: 3,
          initialDelayMs: 200,
          maxDelayMs: 3000
        },
        metadata: { 
          adminId: adminUserId,
          targetUserId,
          newRole: role
        },
        criticalOperation: true // Mark as critical since it's an admin operation
      }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // TODO: Log the action in audit logs when we create that model

    res.json({ message: 'User role updated successfully' });
  } catch (error) {
    // Use enhanced error handling
    const enhancedErr = enhanceError(error);
    const { statusCode, errorResponse } = handleDatabaseError(enhancedErr, {
      defaultMessage: 'Failed to update user role',
      defaultStatusCode: 500,
      context: {
        operation: 'Admin: Update user role',
        adminId: req.user.userId,
        targetUserId: req.params.id
      }
    });
    
    res.status(statusCode).json(errorResponse);
  }
});

// Admin: Update user status
router.patch('/:id/status', requireRole(['admin']), [
  body('status').isIn(['active', 'suspended', 'banned']),
  body('reason').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const targetUserId = req.params.id;
    const { status, reason } = req.body;
    const adminUserId = req.user.userId;

    // Prevent self-action
    if (targetUserId === adminUserId) {
      return res.status(400).json({ message: 'Cannot change your own status' });
    }

    // Use transaction to ensure atomicity
    await withTransaction(async (session) => {
      // Update user status
      const user = await executeQuery(
        async () => {
          return User.findByIdAndUpdate(
            targetUserId,
            { status },
            { new: true, runValidators: true, session }
          ).select('_id status');
        },
        {
          operationName: 'Admin: Update user status',
          timeout: 8000,
          retryOptions: {
            maxRetries: 3,
            initialDelayMs: 200,
            maxDelayMs: 3000
          },
          metadata: { 
            adminId: adminUserId,
            targetUserId,
            newStatus: status,
            reason: reason || 'None'
          },
          criticalOperation: true // Mark as critical since it's an admin operation
        }
      );

      if (!user) {
        throw { 
          statusCode: 404, 
          message: 'User not found',
          isCustomError: true
        };
      }

      // Log the action (in a real app, this would go to an audit log)
      console.log(`Admin ${adminUserId} changed user ${targetUserId} status to ${status}. Reason: ${reason || 'None'}`);
      
      // In a real implementation, we would create an audit log entry here
      // await AuditLog.create({
      //   adminId: adminUserId,
      //   targetId: targetUserId,
      //   action: 'update_user_status',
      //   details: { status, reason },
      //   timestamp: new Date()
      // }, { session });
      
      return user;
    }, {
      operationName: 'Admin: Update user status transaction',
      timeout: 15000,
      metadata: { 
        adminId: adminUserId,
        targetUserId,
        operation: 'update_user_status'
      }
    });

    res.json({ message: 'User status updated successfully' });
  } catch (error) {
    // Handle custom errors
    if (error.isCustomError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    
    // Use enhanced error handling for database errors
    const enhancedErr = enhanceError(error);
    const { statusCode, errorResponse } = handleDatabaseError(enhancedErr, {
      defaultMessage: 'Failed to update user status',
      defaultStatusCode: 500,
      context: {
        operation: 'Admin: Update user status',
        adminId: req.user.userId,
        targetUserId: req.params.id
      }
    });
    
    res.status(statusCode).json(errorResponse);
  }
});

module.exports = router;