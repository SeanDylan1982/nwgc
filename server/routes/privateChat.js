const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult, query, param } = require('express-validator');
const User = require('../models/User');
const PrivateChat = require('../models/PrivateChat');
const Message = require('../models/Message');
const router = express.Router();

// Get user's private chats
router.get('/', [
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user.userId;
    const { limit = 20, offset = 0 } = req.query;

    // Find all private chats where user is a participant
    const privateChats = await PrivateChat.find({
      participants: userId,
      isActive: true
    })
    .populate('participants', 'firstName lastName profileImageUrl status')
    .populate('lastMessage.sender', 'firstName lastName')
    .sort({ updatedAt: -1 })
    .limit(parseInt(limit))
    .skip(parseInt(offset));

    // Format the response to include the other participant's info
    const formattedChats = privateChats.map(chat => {
      const otherParticipant = chat.participants.find(p => p._id.toString() !== userId);
      
      return {
        _id: chat._id,
        otherParticipant: {
          _id: otherParticipant._id,
          firstName: otherParticipant.firstName,
          lastName: otherParticipant.lastName,
          profileImageUrl: otherParticipant.profileImageUrl,
          status: otherParticipant.status
        },
        lastMessage: chat.lastMessage,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt
      };
    });

    res.json(formattedChats);
  } catch (error) {
    console.error('Get private chats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create or get existing private chat
router.post('/create', [
  body('participantId').isMongoId().withMessage('Valid participant ID required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user.userId;
    const { participantId } = req.body;

    // Check if trying to create chat with self
    if (userId === participantId) {
      return res.status(400).json({ message: 'Cannot create chat with yourself' });
    }

    // Check if participant exists and is active
    const participant = await User.findById(participantId);
    if (!participant || participant.status !== 'active') {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if users are friends (optional - you might want to allow chats between neighbors)
    const currentUser = await User.findById(userId);
    if (!currentUser.friends.includes(participantId)) {
      // Check if they're in the same neighbourhood as alternative
      if (currentUser.neighbourhoodId.toString() !== participant.neighbourhoodId.toString()) {
        return res.status(403).json({ message: 'Can only chat with friends or neighbors' });
      }
    }

    // Check if private chat already exists
    let privateChat = await PrivateChat.findOne({
      participants: { $all: [userId, participantId] }
    }).populate('participants', 'firstName lastName profileImageUrl status');

    if (!privateChat) {
      // Create new private chat
      privateChat = new PrivateChat({
        participants: [userId, participantId]
      });
      await privateChat.save();
      await privateChat.populate('participants', 'firstName lastName profileImageUrl status');
    }

    // Format response
    const otherParticipant = privateChat.participants.find(p => p._id.toString() !== userId);
    
    const formattedChat = {
      _id: privateChat._id,
      otherParticipant: {
        _id: otherParticipant._id,
        firstName: otherParticipant.firstName,
        lastName: otherParticipant.lastName,
        profileImageUrl: otherParticipant.profileImageUrl,
        status: otherParticipant.status
      },
      lastMessage: privateChat.lastMessage,
      createdAt: privateChat.createdAt,
      updatedAt: privateChat.updatedAt
    };

    res.status(201).json(formattedChat);
  } catch (error) {
    console.error('Create private chat error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get messages from a private chat
router.get('/:chatId/messages', [
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const chatId = req.params.chatId;
    const userId = req.user.userId;
    const { limit = 50, offset = 0 } = req.query;

    // Verify user is participant in this chat
    const privateChat = await PrivateChat.findOne({
      _id: chatId,
      participants: userId,
      isActive: true
    });

    if (!privateChat) {
      return res.status(404).json({ message: 'Private chat not found' });
    }

    // Get messages
    const messages = await Message.find({
      chatId: chatId,
      chatType: 'private'
    })
    .populate('senderId', 'firstName lastName profileImageUrl')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip(parseInt(offset));

    // Mark messages as read
    await Message.updateMany(
      {
        chatId: chatId,
        chatType: 'private',
        senderId: { $ne: userId },
        status: { $ne: 'read' }
      },
      { status: 'read' }
    );

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
      isForwarded: msg.isForwarded,
      forwardedFrom: msg.forwardedFrom,
      emojis: msg.emojis,
      replyToId: msg.replyToId,
      reactions: msg.reactions ? msg.reactions.map(r => ({
        type: r.type,
        count: r.count,
        users: r.users
      })) : [],
      status: msg.status,
      createdAt: msg.createdAt,
      updatedAt: msg.updatedAt,
      timestamp: msg.createdAt // Add timestamp for frontend compatibility
    })).reverse(); // Return in chronological order

    res.json(formattedMessages);
  } catch (error) {
    console.error('Get private chat messages error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Send message in private chat
router.post('/:chatId/messages', [
  body('content').trim().isLength({ min: 1, max: 1000 }).withMessage('Message content is required'),
  body('type').optional().isIn(['text', 'image', 'audio', 'video', 'document', 'location', 'contact']),
  body('emojis').optional().isArray(),
  body('replyToId').optional().isMongoId(),
  body('isForwarded').optional().isBoolean(),
  body('forwardedFrom').optional().isObject(),
  body('attachments').optional().isArray()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const chatId = req.params.chatId;
    const userId = req.user.userId;
    const { 
      content, 
      type = 'text',
      emojis = [], 
      replyToId,
      isForwarded = false,
      forwardedFrom,
      attachments = []
    } = req.body;

    // Verify user is participant in this chat
    const privateChat = await PrivateChat.findOne({
      _id: chatId,
      participants: userId,
      isActive: true
    });

    if (!privateChat) {
      return res.status(404).json({ message: 'Private chat not found' });
    }

    // Create message
    const messageData = {
      chatId: chatId,
      chatType: 'private',
      senderId: userId,
      content: content,
      messageType: type,
      emojis: emojis,
      replyToId: replyToId || null
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
    await message.populate('senderId', 'firstName lastName profileImageUrl');

    // Update private chat's last message
    privateChat.lastMessage = {
      content: content,
      sender: userId,
      timestamp: message.createdAt,
      messageType: type
    };
    privateChat.updatedAt = new Date();
    await privateChat.save();

    // Get the other participant to send them the message via socket
    const otherParticipantId = privateChat.participants.find(
      p => p.toString() !== userId.toString()
    );

    // Emit socket event for real-time updates
    const io = req.app.get('io');
    if (io) {
      // Emit to the other participant
      io.to(`user_${otherParticipantId}`).emit('new_private_message', {
        message,
        chatId
      });
    }

    // Format response
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
      isForwarded: message.isForwarded,
      forwardedFrom: message.forwardedFrom,
      emojis: message.emojis,
      replyToId: message.replyToId,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
      timestamp: message.createdAt // Add timestamp for frontend compatibility
    };

    res.status(201).json(formattedMessage);
  } catch (error) {
    console.error('Send private message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete private chat (hide for current user)
router.delete('/:chatId', async (req, res) => {
  try {
    const chatId = req.params.chatId;
    const userId = req.user.userId;

    // Verify user is participant in this chat
    const privateChat = await PrivateChat.findOne({
      _id: chatId,
      participants: userId
    });

    if (!privateChat) {
      return res.status(404).json({ message: 'Private chat not found' });
    }

    // For now, we'll just mark as inactive for the user
    // In a more complex system, you might want to track which users have "deleted" the chat
    // For simplicity, we'll just remove the user from participants
    privateChat.participants = privateChat.participants.filter(p => p.toString() !== userId);
    
    if (privateChat.participants.length === 0) {
      // If no participants left, mark as inactive
      privateChat.isActive = false;
    }
    
    await privateChat.save();

    res.json({ message: 'Private chat deleted' });
  } catch (error) {
    console.error('Delete private chat error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get unread message count for user's private chats
router.get('/unread/count', async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get all private chats for the user
    const privateChats = await PrivateChat.find({
      participants: userId,
      isActive: true
    }).select('_id');

    const chatIds = privateChats.map(chat => chat._id);

    // Count unread messages using enhanced readBy system
    const unreadCount = await Message.countDocuments({
      chatId: { $in: chatIds },
      chatType: 'private',
      senderId: { $ne: userId },
      'readBy.userId': { $ne: userId }
    });

    res.json({ unreadCount });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Enhanced unified private chat endpoints for new chat UI

// Get private chats with unified structure
router.get('/unified', [
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 }),
  query('search').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user.userId;
    const { limit = 20, offset = 0, search } = req.query;

    // Build aggregation pipeline for unified chat structure
    const pipeline = [
      {
        $match: {
          participants: new mongoose.Types.ObjectId(userId),
          isActive: true
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'participants',
          foreignField: '_id',
          as: 'participantDetails'
        }
      },
      {
        $lookup: {
          from: 'messages',
          let: { chatId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$chatId', '$$chatId'] },
                chatType: 'private'
              }
            },
            { $sort: { createdAt: -1 } },
            { $limit: 1 }
          ],
          as: 'lastMessageDetails'
        }
      },
      {
        $addFields: {
          // Get the other participant (not current user)
          otherParticipant: {
            $arrayElemAt: [
              {
                $filter: {
                  input: '$participantDetails',
                  cond: { $ne: ['$$this._id', new mongoose.Types.ObjectId(userId)] }
                }
              },
              0
            ]
          },
          // Calculate unread count
          unreadCount: {
            $size: {
              $ifNull: [
                {
                  $filter: {
                    input: '$lastMessageDetails',
                    cond: {
                      $and: [
                        { $ne: ['$$this.senderId', new mongoose.Types.ObjectId(userId)] },
                        { $not: { $in: [new mongoose.Types.ObjectId(userId), '$$this.readBy.userId'] } }
                      ]
                    }
                  }
                },
                []
              ]
            }
          },
          // Format last message
          lastMessage: {
            $let: {
              vars: { msg: { $arrayElemAt: ['$lastMessageDetails', 0] } },
              in: {
                $cond: {
                  if: { $ne: ['$$msg', null] },
                  then: {
                    id: '$$msg._id',
                    content: '$$msg.content',
                    type: '$$msg.messageType',
                    senderId: '$$msg.senderId',
                    senderName: '$$msg.senderName',
                    timestamp: '$$msg.createdAt',
                    status: '$$msg.status'
                  },
                  else: null
                }
              }
            }
          }
        }
      },
      {
        $match: search ? {
          $or: [
            { 'otherParticipant.firstName': { $regex: search, $options: 'i' } },
            { 'otherParticipant.lastName': { $regex: search, $options: 'i' } }
          ]
        } : {}
      },
      {
        $project: {
          id: '$_id',
          type: { $literal: 'private' },
          name: {
            $concat: ['$otherParticipant.firstName', ' ', '$otherParticipant.lastName']
          },
          avatar: '$otherParticipant.profileImageUrl',
          participantId: '$otherParticipant._id',
          isOnline: '$otherParticipant.isOnline',
          lastSeen: '$otherParticipant.lastSeen',
          lastMessage: 1,
          unreadCount: 1,
          createdAt: 1,
          updatedAt: 1
        }
      },
      { $sort: { updatedAt: -1 } },
      { $skip: parseInt(offset) },
      { $limit: parseInt(limit) }
    ];

    const chats = await PrivateChat.aggregate(pipeline);

    res.json({
      chats,
      totalCount: chats.length,
      hasMore: chats.length === parseInt(limit)
    });
  } catch (error) {
    console.error('Get unified private chats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Enhanced message reactions endpoint
router.post('/:chatId/messages/:messageId/reactions', [
  param('chatId').isMongoId(),
  param('messageId').isMongoId(),
  body('type').isString().isLength({ min: 1, max: 50 }),
  body('action').isIn(['add', 'remove'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { chatId, messageId } = req.params;
    const { type, action } = req.body;
    const userId = req.user.userId;

    // Verify user is participant in this chat
    const privateChat = await PrivateChat.findOne({
      _id: chatId,
      participants: userId,
      isActive: true
    });

    if (!privateChat) {
      return res.status(404).json({ message: 'Private chat not found' });
    }

    // Find the message
    const message = await Message.findOne({
      _id: messageId,
      chatId: chatId,
      chatType: 'private'
    });

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Add or remove reaction
    if (action === 'add') {
      await message.addReaction(userId, type);
    } else {
      await message.removeReaction(userId, type);
    }

    // Emit socket event for real-time updates
    const io = req.app.get('io');
    if (io) {
      const otherParticipantId = privateChat.participants.find(
        p => p.toString() !== userId.toString()
      );
      
      io.to(`user_${otherParticipantId}`).emit('reaction_updated', {
        messageId,
        chatId,
        reactions: message.reactions
      });
    }

    res.json({
      messageId,
      reactions: message.reactions
    });
  } catch (error) {
    console.error('Message reaction error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark messages as read with enhanced tracking
router.post('/:chatId/messages/read', [
  param('chatId').isMongoId(),
  body('messageIds').isArray().withMessage('Message IDs array required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { chatId } = req.params;
    const { messageIds } = req.body;
    const userId = req.user.userId;

    // Verify user is participant in this chat
    const privateChat = await PrivateChat.findOne({
      _id: chatId,
      participants: userId,
      isActive: true
    });

    if (!privateChat) {
      return res.status(404).json({ message: 'Private chat not found' });
    }

    // Mark messages as read using enhanced readBy system
    const result = await Message.updateMany(
      {
        _id: { $in: messageIds },
        chatId: chatId,
        chatType: 'private',
        senderId: { $ne: userId },
        'readBy.userId': { $ne: userId }
      },
      {
        $push: {
          readBy: {
            userId: userId,
            readAt: new Date()
          }
        }
      }
    );

    // Emit socket event for read receipts
    const io = req.app.get('io');
    if (io) {
      const otherParticipantId = privateChat.participants.find(
        p => p.toString() !== userId.toString()
      );
      
      io.to(`user_${otherParticipantId}`).emit('messages_read', {
        messageIds,
        chatId,
        userId,
        readAt: new Date()
      });
    }

    res.json({
      messagesMarked: result.modifiedCount,
      readAt: new Date()
    });
  } catch (error) {
    console.error('Mark messages as read error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Enhanced message sending with new features
router.post('/:chatId/messages/enhanced', [
  param('chatId').isMongoId(),
  body('content').optional().trim().isLength({ max: 1000 }),
  body('type').optional().isIn(['text', 'image', 'audio', 'video', 'document', 'location', 'contact']),
  body('attachments').optional().isArray(),
  body('replyTo').optional().isObject(),
  body('encryption').optional().isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { chatId } = req.params;
    const { 
      content, 
      type = 'text',
      attachments = [],
      replyTo,
      encryption
    } = req.body;
    const userId = req.user.userId;

    // Verify user is participant in this chat
    const privateChat = await PrivateChat.findOne({
      _id: chatId,
      participants: userId,
      isActive: true
    });

    if (!privateChat) {
      return res.status(404).json({ message: 'Private chat not found' });
    }

    // Get sender info
    const sender = await User.findById(userId).select('firstName lastName');
    const senderName = `${sender.firstName} ${sender.lastName}`;

    // Create enhanced message
    const messageData = {
      chatId: chatId,
      chatType: 'private',
      senderId: userId,
      senderName: senderName,
      content: content || '',
      messageType: type,
      status: 'sent'
    };

    // Add attachments if provided
    if (attachments && attachments.length > 0) {
      messageData.attachments = attachments.map(attachment => ({
        id: attachment.id,
        type: attachment.type,
        url: attachment.url,
        filename: attachment.filename,
        size: attachment.size,
        thumbnail: attachment.thumbnail,
        metadata: attachment.metadata
      }));
    }

    // Add reply information if provided
    if (replyTo) {
      messageData.replyTo = {
        messageId: replyTo.messageId,
        content: replyTo.content,
        senderName: replyTo.senderName,
        type: replyTo.type
      };
    }

    // Add encryption if provided
    if (encryption) {
      messageData.encryption = {
        isEncrypted: true,
        encryptionVersion: encryption.version || 'v1',
        keyId: encryption.keyId,
        iv: encryption.iv,
        authTag: encryption.authTag
      };
    }

    const message = new Message(messageData);
    await message.save();

    // Update private chat's last message
    privateChat.lastMessage = {
      content: content || `[${type}]`,
      sender: userId,
      timestamp: message.createdAt,
      messageType: type
    };
    privateChat.updatedAt = new Date();
    await privateChat.save();

    // Get the other participant for socket emission
    const otherParticipantId = privateChat.participants.find(
      p => p.toString() !== userId.toString()
    );

    // Emit socket event for real-time updates
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${otherParticipantId}`).emit('new_message', {
        message: {
          id: message._id,
          chatId: message.chatId,
          chatType: message.chatType,
          senderId: message.senderId,
          senderName: message.senderName,
          content: message.content,
          type: message.messageType,
          attachments: message.attachments,
          replyTo: message.replyTo,
          reactions: message.reactions,
          status: message.status,
          timestamp: message.createdAt,
          encryption: message.encryption
        },
        chatId
      });
    }

    // Format response
    const formattedMessage = {
      id: message._id,
      chatId: message.chatId,
      chatType: message.chatType,
      senderId: message.senderId,
      senderName: message.senderName,
      content: message.content,
      type: message.messageType,
      attachments: message.attachments,
      replyTo: message.replyTo,
      reactions: message.reactions,
      status: message.status,
      timestamp: message.createdAt,
      encryption: message.encryption
    };

    res.status(201).json(formattedMessage);
  } catch (error) {
    console.error('Send enhanced private message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get private chat settings
router.get('/:chatId/settings', [
  param('chatId').isMongoId()
], async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.userId;

    // Verify user is participant in this chat
    const privateChat = await PrivateChat.findOne({
      _id: chatId,
      participants: userId,
      isActive: true
    }).populate('participants', 'firstName lastName profileImageUrl isOnline lastSeen');

    if (!privateChat) {
      return res.status(404).json({ message: 'Private chat not found' });
    }

    const otherParticipant = privateChat.participants.find(
      p => p._id.toString() !== userId.toString()
    );

    res.json({
      chatId: privateChat._id,
      otherParticipant: {
        id: otherParticipant._id,
        name: `${otherParticipant.firstName} ${otherParticipant.lastName}`,
        avatar: otherParticipant.profileImageUrl,
        isOnline: otherParticipant.isOnline,
        lastSeen: otherParticipant.lastSeen
      },
      settings: {
        // Add user-specific settings here
        isMuted: false, // This would come from user preferences
        isArchived: false,
        isPinned: false
      },
      createdAt: privateChat.createdAt
    });
  } catch (error) {
    console.error('Get private chat settings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;