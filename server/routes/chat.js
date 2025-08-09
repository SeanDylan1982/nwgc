const express = require('express');
const { body, validationResult, query } = require('express-validator');
const ChatGroup = require('../models/ChatGroup');
const Message = require('../models/Message');
const User = require('../models/User');
const { requireRole } = require('../middleware/auth');
const router = express.Router();

// Get user's chat groups
router.get('/groups', async (req, res) => {
  try {
    const userId = req.user.userId;

    // Find chat groups where the user is a member
    const groups = await ChatGroup.find({
      'members.userId': userId,
      isActive: true
    })
    .populate('createdBy', 'firstName lastName')
    .populate('members.userId', 'firstName lastName')
    .sort({ lastActivity: -1, createdAt: -1 });

    // Get additional data for each group
    const groupsWithData = await Promise.all(groups.map(async (group) => {
      // Find user's role in this group
      const userMember = group.members.find(member => member.userId._id.toString() === userId);
      
      // Get message count
      const messageCount = await Message.countDocuments({
        chatId: group._id,
        chatType: 'group',
        moderationStatus: 'active'
      });

      // Get last message
      const lastMessage = await Message.findOne({
        chatId: group._id,
        chatType: 'group',
        moderationStatus: 'active'
      })
      .sort({ createdAt: -1 })
      .populate('senderId', 'firstName lastName');

      return {
        id: group._id,
        name: group.name,
        description: group.description,
        type: group.type,
        memberRole: userMember?.role || 'member',
        memberCount: group.members.length,
        messageCount,
        lastMessage: lastMessage ? {
          content: lastMessage.content,
          sender: lastMessage.senderId,
          createdAt: lastMessage.createdAt
        } : null,
        lastActivity: group.lastActivity,
        createdAt: group.createdAt
      };
    }));

    res.json(groupsWithData);
  } catch (error) {
    console.error('Get chat groups error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get messages for a group
router.get('/groups/:groupId/messages', [
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 }),
  query('before').optional().isISO8601()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const groupId = req.params.groupId;
    const { limit = 50, offset = 0, before } = req.query;
    const userId = req.user.userId;

    // Verify user is member of the group
    const group = await ChatGroup.findOne({
      _id: groupId,
      'members.userId': userId,
      isActive: true
    });

    if (!group) {
      return res.status(403).json({ message: 'Not a member of this group or group not found' });
    }

    // Build query
    const query = {
      chatId: groupId,
      chatType: 'group',
      moderationStatus: 'active'
    };

    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await Message.find(query)
      .populate('senderId', 'firstName lastName profileImageUrl')
      .populate('replyToId', 'content senderId')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));

    // Format messages
    const formattedMessages = messages.map(msg => ({
      id: msg._id,
      content: msg.content,
      type: msg.messageType,
      messageType: msg.messageType, // Legacy support
      media: msg.media,
      attachments: msg.media, // Map media to attachments for frontend compatibility
      senderId: msg.senderId._id,
      senderName: `${msg.senderId.firstName} ${msg.senderId.lastName}`,
      senderAvatar: msg.senderId.profileImageUrl,
      replyTo: msg.replyToId ? {
        id: msg.replyToId._id,
        content: msg.replyToId.content,
        senderId: msg.replyToId.senderId
      } : null,
      reactions: msg.reactions.map(r => ({
        type: r.type,
        count: r.count,
        users: r.users
      })),
      isEdited: msg.isEdited,
      isForwarded: msg.isForwarded,
      forwardedFrom: msg.forwardedFrom,
      status: msg.status,
      createdAt: msg.createdAt,
      updatedAt: msg.updatedAt,
      timestamp: msg.createdAt // Add timestamp for frontend compatibility
    })).reverse(); // Reverse to show oldest first

    res.json(formattedMessages);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Send message
router.post('/groups/:groupId/messages', [
  body('content').trim().isLength({ min: 1 }),
  body('type').optional().isIn(['text', 'image', 'audio', 'video', 'document', 'location', 'contact']),
  body('messageType').optional().isIn(['text', 'image', 'video', 'file']), // Legacy support
  body('replyToId').optional().isMongoId(),
  body('isForwarded').optional().isBoolean(),
  body('forwardedFrom').optional().isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const groupId = req.params.groupId;
    const { 
      content, 
      type, 
      messageType = 'text', 
      replyToId, 
      isForwarded = false, 
      forwardedFrom,
      attachments = []
    } = req.body;
    const userId = req.user.userId;

    // Verify user is member of the group
    const group = await ChatGroup.findOne({
      _id: groupId,
      'members.userId': userId,
      isActive: true
    });

    if (!group) {
      return res.status(403).json({ message: 'Not a member of this group or group not found' });
    }

    // Create message
    const messageData = {
      chatId: groupId,
      chatType: 'group',
      senderId: userId,
      content,
      messageType: type || messageType, // Use new 'type' field or fallback to legacy 'messageType'
      replyToId: replyToId || null,
      status: 'sent',
      moderationStatus: 'active'
    };

    // Add forwarding data if message is forwarded
    if (isForwarded && forwardedFrom) {
      messageData.isForwarded = true;
      messageData.forwardedFrom = {
        messageId: forwardedFrom.messageId,
        originalSenderId: forwardedFrom.originalSenderId,
        originalSenderName: forwardedFrom.originalSenderName,
        originalChatId: forwardedFrom.originalChatId,
        originalChatName: forwardedFrom.originalChatName,
        forwardedBy: forwardedFrom.forwardedBy,
        forwardedByName: forwardedFrom.forwardedByName,
        forwardedAt: forwardedFrom.forwardedAt || new Date()
      };
    }

    // Add attachments if provided
    if (attachments && attachments.length > 0) {
      messageData.media = attachments.map(attachment => ({
        type: attachment.type,
        url: attachment.url,
        filename: attachment.filename,
        size: attachment.size
      }));
    }

    const message = new Message(messageData);

    await message.save();

    // Update group's last activity
    group.lastActivity = new Date();
    await group.save();

    // Populate sender info for response
    await message.populate('senderId', 'firstName lastName profileImageUrl');

    const formattedMessage = {
      id: message._id,
      content: message.content,
      type: message.messageType,
      messageType: message.messageType, // Legacy support
      media: message.media,
      attachments: message.media, // Map media to attachments for frontend compatibility
      senderId: message.senderId._id,
      senderName: `${message.senderId.firstName} ${message.senderId.lastName}`,
      senderAvatar: message.senderId.profileImageUrl,
      replyTo: null, // Would need to populate if replyToId exists
      isEdited: message.isEdited,
      isForwarded: message.isForwarded,
      forwardedFrom: message.forwardedFrom,
      status: message.status,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
      timestamp: message.createdAt // Add timestamp for frontend compatibility
    };

    res.status(201).json(formattedMessage);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new chat group
router.post('/groups', [
  body('name').trim().isLength({ min: 1, max: 255 }),
  body('description').optional().trim(),
  body('type').optional().isIn(['public', 'private', 'announcement'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, type = 'public' } = req.body;
    const userId = req.user.userId;

    // Get user's neighbourhood
    const user = await User.findById(userId).select('neighbourhoodId');
    if (!user || !user.neighbourhoodId) {
      return res.status(400).json({ message: 'User must be assigned to a neighbourhood' });
    }

    // Create chat group
    const chatGroup = new ChatGroup({
      name,
      description,
      type,
      neighbourhoodId: user.neighbourhoodId,
      createdBy: userId,
      members: [{
        userId: userId,
        role: 'admin',
        joinedAt: new Date()
      }],
      isActive: true,
      lastActivity: new Date()
    });

    await chatGroup.save();
    await chatGroup.populate('createdBy', 'firstName lastName');
    await chatGroup.populate('members.userId', 'firstName lastName');

    res.status(201).json({
      id: chatGroup._id,
      name: chatGroup.name,
      description: chatGroup.description,
      type: chatGroup.type,
      memberRole: 'admin',
      memberCount: chatGroup.members.length,
      messageCount: 0,
      lastMessage: null,
      lastActivity: chatGroup.lastActivity,
      createdAt: chatGroup.createdAt
    });
  } catch (error) {
    console.error('Create chat group error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Join a chat group
router.post('/groups/:groupId/join', async (req, res) => {
  try {
    const groupId = req.params.groupId;
    const userId = req.user.userId;

    const group = await ChatGroup.findOne({
      _id: groupId,
      isActive: true,
      type: { $in: ['public'] } // Only allow joining public groups
    });

    if (!group) {
      return res.status(404).json({ message: 'Group not found or not joinable' });
    }

    // Check if user is already a member
    const existingMember = group.members.find(member => member.userId.toString() === userId);
    if (existingMember) {
      return res.status(400).json({ message: 'Already a member of this group' });
    }

    // Add user to group
    group.members.push({
      userId: userId,
      role: 'member',
      joinedAt: new Date()
    });

    await group.save();

    res.json({ message: 'Successfully joined the group' });
  } catch (error) {
    console.error('Join group error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Leave a chat group
router.post('/groups/:groupId/leave', async (req, res) => {
  try {
    const groupId = req.params.groupId;
    const userId = req.user.userId;

    const group = await ChatGroup.findOne({
      _id: groupId,
      isActive: true
    });

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Remove user from group
    group.members = group.members.filter(member => member.userId.toString() !== userId);

    // If no members left, deactivate the group
    if (group.members.length === 0) {
      group.isActive = false;
    }

    await group.save();

    res.json({ message: 'Successfully left the group' });
  } catch (error) {
    console.error('Leave group error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add or remove reaction to a message
router.post('/messages/:messageId/react', [
  body('reactionType').isIn(['thumbs_up', 'heart', 'smile', 'laugh', 'sad', 'angry'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const messageId = req.params.messageId;
    const { reactionType } = req.body;
    const userId = req.user.userId;

    // Find the message
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Verify user has access to this message (either group member or private chat participant)
    let hasAccess = false;
    
    if (message.chatType === 'group') {
      const group = await ChatGroup.findOne({
        _id: message.chatId,
        'members.userId': userId,
        isActive: true
      });
      hasAccess = !!group;
    } else if (message.chatType === 'private') {
      const PrivateChat = require('../models/PrivateChat');
      const privateChat = await PrivateChat.findOne({
        _id: message.chatId,
        participants: userId,
        isActive: true
      });
      hasAccess = !!privateChat;
    }

    if (!hasAccess) {
      return res.status(403).json({ message: 'Not authorized to react to this message' });
    }

    // Find existing reaction of this type
    let reaction = message.reactions.find(r => r.type === reactionType);
    
    if (!reaction) {
      // Create new reaction
      reaction = {
        type: reactionType,
        users: [userId],
        count: 1
      };
      message.reactions.push(reaction);
    } else {
      // Check if user already reacted with this type
      const userIndex = reaction.users.indexOf(userId);
      
      if (userIndex > -1) {
        // Remove user's reaction
        reaction.users.splice(userIndex, 1);
        reaction.count = Math.max(0, reaction.count - 1);
        
        // Remove reaction if no users left
        if (reaction.count === 0) {
          message.reactions = message.reactions.filter(r => r.type !== reactionType);
        }
      } else {
        // Add user's reaction
        reaction.users.push(userId);
        reaction.count += 1;
      }
    }

    await message.save();

    // Format reactions for response
    const formattedReactions = message.reactions.map(r => ({
      type: r.type,
      count: r.count,
      users: r.users
    }));

    res.json({
      messageId: message._id,
      reactions: formattedReactions
    });
  } catch (error) {
    console.error('React to message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get group members
router.get('/groups/:groupId/members', async (req, res) => {
  try {
    const groupId = req.params.groupId;
    const userId = req.user.userId;

    // Verify user is member of the group
    const group = await ChatGroup.findOne({
      _id: groupId,
      'members.userId': userId,
      isActive: true
    }).populate('members.userId', 'firstName lastName profileImageUrl');

    if (!group) {
      return res.status(403).json({ message: 'Not a member of this group or group not found' });
    }

    const members = group.members.map(member => ({
      _id: member.userId._id,
      firstName: member.userId.firstName,
      lastName: member.userId.lastName,
      profileImageUrl: member.userId.profileImageUrl,
      role: member.role,
      joinedAt: member.joinedAt
    }));

    res.json(members);
  } catch (error) {
    console.error('Get group members error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;