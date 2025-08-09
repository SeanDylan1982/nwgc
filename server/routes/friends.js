const express = require('express');
const { body, validationResult, query } = require('express-validator');
const User = require('../models/User');
const FriendRequest = require('../models/FriendRequest');
const NotificationService = require('../services/NotificationService');
const router = express.Router();

// Get user's friends
router.get('/', async (req, res) => {
  try {
    const userId = req.user.userId;

    const user = await User.findById(userId)
      .populate('friends', 'firstName lastName email profileImageUrl status')
      .select('friends');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Filter out inactive users
    const activeFriends = user.friends.filter(friend => friend.status === 'active');

    res.json(activeFriends);
  } catch (error) {
    console.error('Get friends error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get friend requests (received)
router.get('/requests', [
  query('type').optional().isIn(['sent', 'received'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user.userId;
    const { type = 'received' } = req.query;

    let query = {};
    if (type === 'received') {
      query = { to: userId, status: 'pending' };
    } else if (type === 'sent') {
      query = { from: userId, status: 'pending' };
    }

    const requests = await FriendRequest.find(query)
      .populate('from', 'firstName lastName email profileImageUrl')
      .populate('to', 'firstName lastName email profileImageUrl')
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (error) {
    console.error('Get friend requests error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Send friend request
router.post('/request', [
  body('userId').isMongoId().withMessage('Valid user ID required'),
  body('message').optional().trim().isLength({ max: 200 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const fromUserId = req.user.userId;
    const { userId: toUserId, message } = req.body;

    // Check if trying to send request to self
    if (fromUserId === toUserId) {
      return res.status(400).json({ message: 'Cannot send friend request to yourself' });
    }

    // Check if target user exists and is active
    const targetUser = await User.findById(toUserId);
    if (!targetUser || targetUser.status !== 'active') {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if users are already friends
    const currentUser = await User.findById(fromUserId);
    if (currentUser.friends.includes(toUserId)) {
      return res.status(400).json({ message: 'Already friends with this user' });
    }

    // Check if friend request already exists
    const existingRequest = await FriendRequest.findOne({
      $or: [
        { from: fromUserId, to: toUserId },
        { from: toUserId, to: fromUserId }
      ],
      status: 'pending'
    });

    if (existingRequest) {
      return res.status(400).json({ message: 'Friend request already exists' });
    }

    // Create friend request
    const friendRequest = new FriendRequest({
      from: fromUserId,
      to: toUserId,
      message: message || ''
    });

    await friendRequest.save();
    await friendRequest.populate('from', 'firstName lastName email profileImageUrl');

    // Send notification to target user
    try {
      await NotificationService.createFriendRequestNotification(
        fromUserId,
        toUserId,
        friendRequest._id
      );
      
      // Emit real-time notification update
      const io = req.app.get('io');
      if (io) {
        io.to(`user_${toUserId}`).emit('notification_update');
      }
    } catch (notificationError) {
      console.error('Error creating friend request notification:', notificationError);
    }

    res.status(201).json({
      message: 'Friend request sent successfully',
      request: friendRequest
    });
  } catch (error) {
    console.error('Send friend request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Accept friend request
router.post('/request/:requestId/accept', async (req, res) => {
  try {
    const requestId = req.params.requestId;
    const userId = req.user.userId;

    // Find the friend request
    const friendRequest = await FriendRequest.findOne({
      _id: requestId,
      to: userId,
      status: 'pending'
    });

    if (!friendRequest) {
      return res.status(404).json({ message: 'Friend request not found' });
    }

    // Update friend request status
    friendRequest.status = 'accepted';
    await friendRequest.save();

    // Add each user to the other's friends list
    await User.findByIdAndUpdate(friendRequest.from, {
      $addToSet: { friends: friendRequest.to }
    });

    await User.findByIdAndUpdate(friendRequest.to, {
      $addToSet: { friends: friendRequest.from }
    });

    // TODO: Send notification to requester

    res.json({ message: 'Friend request accepted successfully' });
  } catch (error) {
    console.error('Accept friend request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Decline friend request
router.post('/request/:requestId/decline', async (req, res) => {
  try {
    const requestId = req.params.requestId;
    const userId = req.user.userId;

    // Find the friend request
    const friendRequest = await FriendRequest.findOne({
      _id: requestId,
      to: userId,
      status: 'pending'
    });

    if (!friendRequest) {
      return res.status(404).json({ message: 'Friend request not found' });
    }

    // Update friend request status
    friendRequest.status = 'declined';
    await friendRequest.save();

    res.json({ message: 'Friend request declined' });
  } catch (error) {
    console.error('Decline friend request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Cancel sent friend request
router.delete('/request/:requestId', async (req, res) => {
  try {
    const requestId = req.params.requestId;
    const userId = req.user.userId;

    // Find the friend request
    const friendRequest = await FriendRequest.findOne({
      _id: requestId,
      from: userId,
      status: 'pending'
    });

    if (!friendRequest) {
      return res.status(404).json({ message: 'Friend request not found' });
    }

    // Delete the friend request
    await FriendRequest.findByIdAndDelete(requestId);

    res.json({ message: 'Friend request cancelled' });
  } catch (error) {
    console.error('Cancel friend request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Remove friend
router.delete('/:friendId', async (req, res) => {
  try {
    const friendId = req.params.friendId;
    const userId = req.user.userId;

    // Check if they are actually friends
    const user = await User.findById(userId);
    if (!user.friends.includes(friendId)) {
      return res.status(400).json({ message: 'Not friends with this user' });
    }

    // Remove each user from the other's friends list
    await User.findByIdAndUpdate(userId, {
      $pull: { friends: friendId }
    });

    await User.findByIdAndUpdate(friendId, {
      $pull: { friends: userId }
    });

    res.json({ message: 'Friend removed successfully' });
  } catch (error) {
    console.error('Remove friend error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get friend status with another user
router.get('/status/:userId', async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    const currentUserId = req.user.userId;

    if (currentUserId === targetUserId) {
      return res.json({ status: 'self' });
    }

    // Check if they are friends
    const currentUser = await User.findById(currentUserId);
    if (currentUser.friends.includes(targetUserId)) {
      return res.json({ status: 'friends' });
    }

    // Check for pending friend requests
    const pendingRequest = await FriendRequest.findOne({
      $or: [
        { from: currentUserId, to: targetUserId, status: 'pending' },
        { from: targetUserId, to: currentUserId, status: 'pending' }
      ]
    });

    if (pendingRequest) {
      if (pendingRequest.from.toString() === currentUserId) {
        return res.json({ status: 'request_sent', requestId: pendingRequest._id });
      } else {
        return res.json({ status: 'request_received', requestId: pendingRequest._id });
      }
    }

    res.json({ status: 'none' });
  } catch (error) {
    console.error('Get friend status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Search for users to add as friends
router.get('/search', [
  query('q').trim().isLength({ min: 2 }).withMessage('Search query must be at least 2 characters'),
  query('limit').optional().isInt({ min: 1, max: 50 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { q: searchQuery, limit = 20 } = req.query;
    const userId = req.user.userId;

    // Get current user to access their neighbourhood and friends
    const currentUser = await User.findById(userId);
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Search for users in the same neighbourhood
    const searchRegex = new RegExp(searchQuery, 'i');
    const users = await User.find({
      _id: { $ne: userId }, // Exclude current user
      neighbourhoodId: currentUser.neighbourhoodId, // Same neighbourhood
      status: 'active',
      $or: [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex }
      ]
    })
    .select('firstName lastName email profileImageUrl')
    .limit(parseInt(limit));

    // Add friend status for each user
    const usersWithStatus = await Promise.all(
      users.map(async (user) => {
        let friendStatus = 'none';
        
        // Check if already friends
        if (currentUser.friends.includes(user._id)) {
          friendStatus = 'friends';
        } else {
          // Check for pending requests
          const pendingRequest = await FriendRequest.findOne({
            $or: [
              { from: userId, to: user._id, status: 'pending' },
              { from: user._id, to: userId, status: 'pending' }
            ]
          });

          if (pendingRequest) {
            friendStatus = pendingRequest.from.toString() === userId ? 'request_sent' : 'request_received';
          }
        }

        return {
          ...user.toObject(),
          friendStatus
        };
      })
    );

    res.json(usersWithStatus);
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;