const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const PrivateChat = require('../models/PrivateChat');
const Message = require('../models/Message');
const ChatGroup = require('../models/ChatGroup');
const NotificationService = require('../services/NotificationService');

// Enhanced typing indicator management
const typingUsers = new Map(); // chatId -> Set of userIds
const typingTimeouts = new Map(); // userId_chatId -> timeoutId

const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication error'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    
    // Verify user
    const user = await User.findOne({ 
      _id: decoded.userId,
      status: 'active'
    }).select('_id email role neighbourhoodId firstName lastName');

    if (!user) {
      return next(new Error('User not found'));
    }

    socket.user = {
      id: user._id,
      email: user.email,
      role: user.role,
      neighbourhoodId: user.neighbourhoodId,
      name: `${user.firstName} ${user.lastName}`
    };

    next();
  } catch (error) {
    next(new Error('Authentication error'));
  }
};

const setupSocketHandlers = (io) => {
  // Authentication middleware
  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    console.log(`User ${socket.user.name} connected`);

    // Join neighbourhood room
    if (socket.user.neighbourhoodId) {
      socket.join(`neighbourhood_${socket.user.neighbourhoodId}`);
      console.log(`User joined neighbourhood room: neighbourhood_${socket.user.neighbourhoodId}`);
    }

    // Join user's private room for direct messages
    socket.join(`user_${socket.user.id}`);
    console.log(`User joined private room: user_${socket.user.id}`);

    // Handle private chat messages
    socket.on('send_private_message', async (data) => {
      try {
        const { chatId, content, emojis = [], replyToId, media = [] } = data;
        
        // Verify user is participant in this chat
        const privateChat = await PrivateChat.findOne({
          _id: chatId,
          participants: socket.user.id,
          isActive: true
        });

        if (!privateChat) {
          socket.emit('error', { message: 'Private chat not found' });
          return;
        }

        // Create message
        const message = new Message({
          chatId: chatId,
          chatType: 'private',
          senderId: socket.user.id,
          content: content,
          emojis: emojis,
          media: media,
          replyToId: replyToId || null,
          status: 'sent'
        });

        await message.save();
        await message.populate('senderId', 'firstName lastName profileImageUrl');

        // Update private chat's last message
        privateChat.lastMessage = {
          content: content,
          sender: socket.user.id,
          timestamp: message.createdAt,
          messageType: media.length > 0 ? media[0].type : 'text'
        };
        privateChat.updatedAt = new Date();
        await privateChat.save();

        // Get the other participant to send them the message
        const otherParticipantId = privateChat.participants.find(
          p => p.toString() !== socket.user.id.toString()
        );

        // Create notification for the recipient
        try {
          await NotificationService.createMessageNotification(
            socket.user.id,
            otherParticipantId,
            message._id,
            'private'
          );
          
          // Emit notification update to recipient
          socket.to(`user_${otherParticipantId}`).emit('notification_update');
        } catch (notificationError) {
          console.error('Error creating message notification:', notificationError);
        }

        // Emit to the other participant
        socket.to(`user_${otherParticipantId}`).emit('new_private_message', {
          message,
          chatId
        });

        // Emit back to sender for confirmation
        socket.emit('private_message_sent', {
          message,
          chatId
        });

      } catch (error) {
        console.error('Send private message error:', error);
        socket.emit('error', { message: 'Failed to send private message' });
      }
    });

    // Handle message status updates
    socket.on('update_message_status', async (data) => {
      try {
        const { messageId, status } = data;
        
        // Update message status
        const message = await Message.findById(messageId);
        
        if (!message) {
          socket.emit('error', { message: 'Message not found' });
          return;
        }
        
        // Verify user is participant in this chat
        const privateChat = await PrivateChat.findOne({
          _id: message.chatId,
          participants: socket.user.id,
          isActive: true
        });

        if (!privateChat) {
          socket.emit('error', { message: 'Not authorized to update this message' });
          return;
        }

        // Only update if the user is not the sender (can't mark your own messages as read)
        if (message.senderId.toString() !== socket.user.id.toString()) {
          message.status = status;
          
          if (status === 'read') {
            // Add to readBy array if not already there
            const alreadyRead = message.readBy.some(read => 
              read.userId.toString() === socket.user.id.toString()
            );
            
            if (!alreadyRead) {
              message.readBy.push({
                userId: socket.user.id,
                readAt: new Date()
              });
            }
          }
          
          await message.save();
          
          // Notify the sender that their message status has changed
          socket.to(`user_${message.senderId}`).emit('message_status_updated', {
            messageId: message._id,
            status,
            chatId: message.chatId,
            updatedBy: socket.user.id
          });
        }
      } catch (error) {
        console.error('Update message status error:', error);
        socket.emit('error', { message: 'Failed to update message status' });
      }
    });

    // Handle typing indicators for private chats
    socket.on('private_typing_start', async (chatId) => {
      try {
        // Verify user is participant in this chat
        const privateChat = await PrivateChat.findOne({
          _id: chatId,
          participants: socket.user.id,
          isActive: true
        });

        if (!privateChat) {
          socket.emit('error', { message: 'Private chat not found' });
          return;
        }

        // Get the other participant
        const otherParticipantId = privateChat.participants.find(
          p => p.toString() !== socket.user.id.toString()
        );

        // Emit typing indicator to the other participant
        socket.to(`user_${otherParticipantId}`).emit('private_user_typing', {
          userId: socket.user.id,
          userName: socket.user.name,
          chatId
        });
      } catch (error) {
        console.error('Private typing indicator error:', error);
        socket.emit('error', { message: 'Failed to send typing indicator' });
      }
    });

    socket.on('private_typing_stop', async (chatId) => {
      try {
        // Verify user is participant in this chat
        const privateChat = await PrivateChat.findOne({
          _id: chatId,
          participants: socket.user.id,
          isActive: true
        });

        if (!privateChat) {
          socket.emit('error', { message: 'Private chat not found' });
          return;
        }

        // Get the other participant
        const otherParticipantId = privateChat.participants.find(
          p => p.toString() !== socket.user.id.toString()
        );

        // Emit typing stopped to the other participant
        socket.to(`user_${otherParticipantId}`).emit('private_user_stopped_typing', {
          userId: socket.user.id,
          chatId
        });
      } catch (error) {
        console.error('Private typing indicator error:', error);
        socket.emit('error', { message: 'Failed to send typing indicator' });
      }
    });

    // Handle chat messages for group chats
    socket.on('send_message', async (data) => {
      try {
        const { groupId, content, messageType = 'text', replyToId } = data;

        // Create message using Mongoose
        const message = new Message({
          chatId: groupId,
          chatType: 'group',
          senderId: socket.user.id,
          content: content,
          messageType: messageType,
          replyToId: replyToId || null,
          status: 'sent'
        });

        await message.save();
        
        const messageData = {
          _id: message._id,
          chatId: groupId,
          chatType: 'group',
          senderId: socket.user.id,
          senderName: socket.user.name,
          content,
          messageType,
          replyToId,
          createdAt: message.createdAt,
          status: 'sent'
        };

        // Broadcast to group members
        socket.to(`group_${groupId}`).emit('new_message', messageData);
        socket.emit('message_sent', messageData);

      } catch (error) {
        console.error('Send message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle joining chat groups
    socket.on('join_group', async (groupId) => {
      try {
        // Verify user is member of the group using Mongoose
        const isMember = await ChatGroup.exists({
          _id: groupId,
          'members.userId': socket.user.id
        });

        if (isMember) {
          socket.join(`group_${groupId}`);
          socket.emit('joined_group', { groupId });
        } else {
          socket.emit('error', { message: 'Not a member of this group' });
        }
      } catch (error) {
        console.error('Join group error:', error);
        socket.emit('error', { message: 'Failed to join group' });
      }
    });

    // Handle leaving chat groups
    socket.on('leave_group', (groupId) => {
      socket.leave(`group_${groupId}`);
      socket.emit('left_group', { groupId });
    });

    // Handle new report notifications
    socket.on('new_report', (reportData) => {
      if (socket.user.neighbourhoodId) {
        socket.to(`neighbourhood_${socket.user.neighbourhoodId}`).emit('report_created', {
          ...reportData,
          reporterName: reportData.anonymous ? 'Anonymous' : socket.user.name
        });
      }
    });

    // Handle new notice notifications
    socket.on('new_notice', (noticeData) => {
      if (socket.user.neighbourhoodId) {
        socket.to(`neighbourhood_${socket.user.neighbourhoodId}`).emit('notice_created', {
          ...noticeData,
          authorName: socket.user.name
        });
      }
    });

    // Handle typing indicators for group chats
    socket.on('typing_start', (groupId) => {
      socket.to(`group_${groupId}`).emit('user_typing', {
        userId: socket.user.id,
        userName: socket.user.name,
        groupId
      });
    });

    socket.on('typing_stop', (groupId) => {
      socket.to(`group_${groupId}`).emit('user_stopped_typing', {
        userId: socket.user.id,
        groupId
      });
    });

    // Handle message reactions
    socket.on('react_to_message', async (data) => {
      try {
        const { messageId, reactionType } = data;

        // Find the message
        const message = await Message.findById(messageId);
        if (!message) {
          socket.emit('error', { message: 'Message not found' });
          return;
        }

        // Verify user has access to this message
        let hasAccess = false;
        let roomName = '';
        
        if (message.chatType === 'group') {
          const group = await ChatGroup.findOne({
            _id: message.chatId,
            'members.userId': socket.user.id,
            isActive: true
          });
          hasAccess = !!group;
          roomName = `group_${message.chatId}`;
        } else if (message.chatType === 'private') {
          const privateChat = await PrivateChat.findOne({
            _id: message.chatId,
            participants: socket.user.id,
            isActive: true
          });
          hasAccess = !!privateChat;
          
          // For private chats, we need to emit to both participants
          if (privateChat) {
            const otherParticipantId = privateChat.participants.find(
              p => p.toString() !== socket.user.id.toString()
            );
            roomName = `user_${otherParticipantId}`;
          }
        }

        if (!hasAccess) {
          socket.emit('error', { message: 'Not authorized to react to this message' });
          return;
        }

        // Find existing reaction of this type
        let reaction = message.reactions.find(r => r.type === reactionType);
        
        if (!reaction) {
          // Create new reaction
          reaction = {
            type: reactionType,
            users: [socket.user.id],
            count: 1
          };
          message.reactions.push(reaction);
        } else {
          // Check if user already reacted with this type
          const userIndex = reaction.users.indexOf(socket.user.id);
          
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
            reaction.users.push(socket.user.id);
            reaction.count += 1;
          }
        }

        await message.save();

        // Format reactions for broadcast
        const formattedReactions = message.reactions.map(r => ({
          type: r.type,
          count: r.count,
          users: r.users
        }));

        const reactionUpdate = {
          messageId: message._id,
          reactions: formattedReactions,
          updatedBy: socket.user.id,
          updatedByName: socket.user.name
        };

        // Broadcast reaction update
        if (message.chatType === 'group') {
          socket.to(roomName).emit('message_reaction_updated', reactionUpdate);
          socket.emit('message_reaction_updated', reactionUpdate);
        } else if (message.chatType === 'private') {
          socket.to(roomName).emit('message_reaction_updated', reactionUpdate);
          socket.emit('message_reaction_updated', reactionUpdate);
        }

      } catch (error) {
        console.error('React to message error:', error);
        socket.emit('error', { message: 'Failed to react to message' });
      }
    });

    // Handle emergency alerts (admin/moderator only)
    socket.on('emergency_alert', async (alertData) => {
      try {
        if (!['admin', 'moderator'].includes(socket.user.role)) {
          socket.emit('error', { message: 'Insufficient permissions' });
          return;
        }

        if (socket.user.neighbourhoodId) {
          // Broadcast emergency alert to entire neighbourhood
          io.to(`neighbourhood_${socket.user.neighbourhoodId}`).emit('emergency_alert', {
            ...alertData,
            issuedBy: socket.user.name,
            timestamp: new Date().toISOString()
          });

          // Log the emergency alert using Mongoose
          const AuditLog = require('../models/AuditLog');
          await AuditLog.create({
            userId: socket.user.id,
            action: 'emergency_alert',
            resourceType: 'notification',
            details: alertData
          });
        }
      } catch (error) {
        console.error('Emergency alert error:', error);
        socket.emit('error', { message: 'Failed to send emergency alert' });
      }
    });

    // Enhanced socket handlers for new chat UI features

    // Enhanced message sending with new features
    socket.on('send_enhanced_message', async (data) => {
      try {
        const { 
          chatId, 
          chatType,
          content, 
          messageType = 'text',
          attachments = [],
          replyTo,
          encryption
        } = data;

        // Verify user has access to this chat
        let hasAccess = false;
        let senderName = socket.user.name;
        
        if (chatType === 'group') {
          const group = await ChatGroup.findOne({
            _id: chatId,
            'members.userId': socket.user.id,
            isActive: true
          });
          hasAccess = !!group;
        } else if (chatType === 'private') {
          const privateChat = await PrivateChat.findOne({
            _id: chatId,
            participants: socket.user.id,
            isActive: true
          });
          hasAccess = !!privateChat;
        }

        if (!hasAccess) {
          socket.emit('error', { message: 'Not authorized to send message to this chat' });
          return;
        }

        // Create enhanced message
        const messageData = {
          chatId,
          chatType,
          senderId: socket.user.id,
          senderName,
          content: content || '',
          messageType,
          status: 'sent'
        };

        // Add attachments if provided
        if (attachments && attachments.length > 0) {
          messageData.attachments = attachments;
        }

        // Add reply information if provided
        if (replyTo) {
          messageData.replyTo = replyTo;
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

        // Update chat's last message
        if (chatType === 'private') {
          await PrivateChat.updateOne(
            { _id: chatId },
            {
              lastMessage: {
                content: content || `[${messageType}]`,
                sender: socket.user.id,
                timestamp: message.createdAt,
                messageType
              },
              updatedAt: new Date()
            }
          );
        } else if (chatType === 'group') {
          await ChatGroup.updateOne(
            { _id: chatId },
            {
              lastMessage: {
                content: content || `[${messageType}]`,
                sender: socket.user.id,
                timestamp: message.createdAt,
                messageType
              },
              updatedAt: new Date()
            }
          );
        }

        // Format message for broadcast
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

        // Broadcast message
        if (chatType === 'group') {
          socket.to(`group_${chatId}`).emit('new_message', formattedMessage);
          socket.emit('message_sent', formattedMessage);
        } else if (chatType === 'private') {
          const privateChat = await PrivateChat.findById(chatId);
          const otherParticipantId = privateChat.participants.find(
            p => p.toString() !== socket.user.id.toString()
          );
          
          socket.to(`user_${otherParticipantId}`).emit('new_message', formattedMessage);
          socket.emit('message_sent', formattedMessage);
        }

        // Create notification
        try {
          if (chatType === 'private') {
            const privateChat = await PrivateChat.findById(chatId);
            const otherParticipantId = privateChat.participants.find(
              p => p.toString() !== socket.user.id.toString()
            );
            
            await NotificationService.createMessageNotification(
              socket.user.id,
              otherParticipantId,
              message._id,
              'private'
            );
            
            socket.to(`user_${otherParticipantId}`).emit('notification_update');
          }
        } catch (notificationError) {
          console.error('Error creating message notification:', notificationError);
        }

      } catch (error) {
        console.error('Send enhanced message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Enhanced reaction handling
    socket.on('add_reaction', async (data) => {
      try {
        const { messageId, reactionType } = data;

        const message = await Message.findById(messageId);
        if (!message) {
          socket.emit('error', { message: 'Message not found' });
          return;
        }

        // Verify user has access to this message
        let hasAccess = false;
        let targetRoom = '';
        
        if (message.chatType === 'group') {
          const group = await ChatGroup.findOne({
            _id: message.chatId,
            'members.userId': socket.user.id,
            isActive: true
          });
          hasAccess = !!group;
          targetRoom = `group_${message.chatId}`;
        } else if (message.chatType === 'private') {
          const privateChat = await PrivateChat.findOne({
            _id: message.chatId,
            participants: socket.user.id,
            isActive: true
          });
          hasAccess = !!privateChat;
          
          if (privateChat) {
            const otherParticipantId = privateChat.participants.find(
              p => p.toString() !== socket.user.id.toString()
            );
            targetRoom = `user_${otherParticipantId}`;
          }
        }

        if (!hasAccess) {
          socket.emit('error', { message: 'Not authorized to react to this message' });
          return;
        }

        // Add reaction using the model method
        await message.addReaction(socket.user.id, reactionType);

        // Broadcast reaction update
        const reactionUpdate = {
          messageId: message._id,
          reactions: message.reactions,
          updatedBy: socket.user.id,
          updatedByName: socket.user.name
        };

        socket.to(targetRoom).emit('reaction_updated', reactionUpdate);
        socket.emit('reaction_updated', reactionUpdate);

      } catch (error) {
        console.error('Add reaction error:', error);
        socket.emit('error', { message: 'Failed to add reaction' });
      }
    });

    socket.on('remove_reaction', async (data) => {
      try {
        const { messageId, reactionType } = data;

        const message = await Message.findById(messageId);
        if (!message) {
          socket.emit('error', { message: 'Message not found' });
          return;
        }

        // Verify user has access to this message
        let hasAccess = false;
        let targetRoom = '';
        
        if (message.chatType === 'group') {
          const group = await ChatGroup.findOne({
            _id: message.chatId,
            'members.userId': socket.user.id,
            isActive: true
          });
          hasAccess = !!group;
          targetRoom = `group_${message.chatId}`;
        } else if (message.chatType === 'private') {
          const privateChat = await PrivateChat.findOne({
            _id: message.chatId,
            participants: socket.user.id,
            isActive: true
          });
          hasAccess = !!privateChat;
          
          if (privateChat) {
            const otherParticipantId = privateChat.participants.find(
              p => p.toString() !== socket.user.id.toString()
            );
            targetRoom = `user_${otherParticipantId}`;
          }
        }

        if (!hasAccess) {
          socket.emit('error', { message: 'Not authorized to react to this message' });
          return;
        }

        // Remove reaction using the model method
        await message.removeReaction(socket.user.id, reactionType);

        // Broadcast reaction update
        const reactionUpdate = {
          messageId: message._id,
          reactions: message.reactions,
          updatedBy: socket.user.id,
          updatedByName: socket.user.name
        };

        socket.to(targetRoom).emit('reaction_updated', reactionUpdate);
        socket.emit('reaction_updated', reactionUpdate);

      } catch (error) {
        console.error('Remove reaction error:', error);
        socket.emit('error', { message: 'Failed to remove reaction' });
      }
    });

    // Enhanced typing indicators with timeout management
    socket.on('typing_start', async (data) => {
      try {
        const { chatId, chatType } = data;

        // Verify user has access to this chat
        let hasAccess = false;
        let targetRoom = '';
        
        if (chatType === 'group') {
          const group = await ChatGroup.findOne({
            _id: chatId,
            'members.userId': socket.user.id,
            isActive: true
          });
          hasAccess = !!group;
          targetRoom = `group_${chatId}`;
        } else if (chatType === 'private') {
          const privateChat = await PrivateChat.findOne({
            _id: chatId,
            participants: socket.user.id,
            isActive: true
          });
          hasAccess = !!privateChat;
          
          if (privateChat) {
            const otherParticipantId = privateChat.participants.find(
              p => p.toString() !== socket.user.id.toString()
            );
            targetRoom = `user_${otherParticipantId}`;
          }
        }

        if (!hasAccess) {
          socket.emit('error', { message: 'Not authorized to access this chat' });
          return;
        }

        // Add user to typing users for this chat
        if (!typingUsers.has(chatId)) {
          typingUsers.set(chatId, new Set());
        }
        typingUsers.get(chatId).add(socket.user.id);

        // Clear existing timeout for this user in this chat
        const timeoutKey = `${socket.user.id}_${chatId}`;
        if (typingTimeouts.has(timeoutKey)) {
          clearTimeout(typingTimeouts.get(timeoutKey));
        }

        // Set new timeout to automatically stop typing after 3 seconds
        const timeout = setTimeout(() => {
          if (typingUsers.has(chatId)) {
            typingUsers.get(chatId).delete(socket.user.id);
            if (typingUsers.get(chatId).size === 0) {
              typingUsers.delete(chatId);
            }
          }
          typingTimeouts.delete(timeoutKey);
          
          // Emit typing stopped
          socket.to(targetRoom).emit('user_stopped_typing', {
            userId: socket.user.id,
            userName: socket.user.name,
            chatId,
            chatType
          });
        }, 3000);

        typingTimeouts.set(timeoutKey, timeout);

        // Broadcast typing indicator
        socket.to(targetRoom).emit('user_typing', {
          userId: socket.user.id,
          userName: socket.user.name,
          chatId,
          chatType
        });

      } catch (error) {
        console.error('Typing start error:', error);
        socket.emit('error', { message: 'Failed to send typing indicator' });
      }
    });

    socket.on('typing_stop', async (data) => {
      try {
        const { chatId, chatType } = data;

        // Clear typing state
        if (typingUsers.has(chatId)) {
          typingUsers.get(chatId).delete(socket.user.id);
          if (typingUsers.get(chatId).size === 0) {
            typingUsers.delete(chatId);
          }
        }

        // Clear timeout
        const timeoutKey = `${socket.user.id}_${chatId}`;
        if (typingTimeouts.has(timeoutKey)) {
          clearTimeout(typingTimeouts.get(timeoutKey));
          typingTimeouts.delete(timeoutKey);
        }

        // Determine target room
        let targetRoom = '';
        if (chatType === 'group') {
          targetRoom = `group_${chatId}`;
        } else if (chatType === 'private') {
          const privateChat = await PrivateChat.findOne({
            _id: chatId,
            participants: socket.user.id,
            isActive: true
          });
          
          if (privateChat) {
            const otherParticipantId = privateChat.participants.find(
              p => p.toString() !== socket.user.id.toString()
            );
            targetRoom = `user_${otherParticipantId}`;
          }
        }

        // Broadcast typing stopped
        socket.to(targetRoom).emit('user_stopped_typing', {
          userId: socket.user.id,
          userName: socket.user.name,
          chatId,
          chatType
        });

      } catch (error) {
        console.error('Typing stop error:', error);
        socket.emit('error', { message: 'Failed to stop typing indicator' });
      }
    });

    // Enhanced message status updates
    socket.on('mark_messages_read', async (data) => {
      try {
        const { chatId, messageIds } = data;

        // Update messages as read using enhanced readBy system
        const result = await Message.updateMany(
          {
            _id: { $in: messageIds },
            chatId: chatId,
            senderId: { $ne: socket.user.id },
            'readBy.userId': { $ne: socket.user.id }
          },
          {
            $push: {
              readBy: {
                userId: socket.user.id,
                readAt: new Date()
              }
            }
          }
        );

        // Determine target room and notify senders
        const messages = await Message.find({ _id: { $in: messageIds } }).distinct('senderId');
        
        messages.forEach(senderId => {
          if (senderId.toString() !== socket.user.id.toString()) {
            socket.to(`user_${senderId}`).emit('messages_read', {
              messageIds,
              chatId,
              readBy: socket.user.id,
              readByName: socket.user.name,
              readAt: new Date()
            });
          }
        });

        socket.emit('messages_marked_read', {
          chatId,
          messageIds,
          count: result.modifiedCount
        });

      } catch (error) {
        console.error('Mark messages read error:', error);
        socket.emit('error', { message: 'Failed to mark messages as read' });
      }
    });

    // Presence updates
    socket.on('update_presence', async (status) => {
      try {
        await User.updateOne(
          { _id: socket.user.id },
          { 
            isOnline: status === 'online',
            lastSeen: status === 'offline' ? new Date() : undefined
          }
        );

        // Broadcast presence update to all private chats
        const privateChats = await PrivateChat.find({
          participants: socket.user.id,
          isActive: true
        });

        privateChats.forEach(chat => {
          const otherParticipantId = chat.participants.find(
            p => p.toString() !== socket.user.id.toString()
          );
          
          socket.to(`user_${otherParticipantId}`).emit('presence_updated', {
            userId: socket.user.id,
            userName: socket.user.name,
            status,
            lastSeen: status === 'offline' ? new Date() : null
          });
        });

      } catch (error) {
        console.error('Update presence error:', error);
        socket.emit('error', { message: 'Failed to update presence' });
      }
    });

    // Join chat room (unified for both group and private)
    socket.on('join_chat', async (data) => {
      try {
        const { chatId, chatType } = data;

        let hasAccess = false;
        let roomName = '';

        if (chatType === 'group') {
          const group = await ChatGroup.findOne({
            _id: chatId,
            'members.userId': socket.user.id,
            isActive: true
          });
          hasAccess = !!group;
          roomName = `group_${chatId}`;
        } else if (chatType === 'private') {
          const privateChat = await PrivateChat.findOne({
            _id: chatId,
            participants: socket.user.id,
            isActive: true
          });
          hasAccess = !!privateChat;
          roomName = `chat_${chatId}`; // Use unified room name for private chats
        }

        if (hasAccess) {
          socket.join(roomName);
          socket.emit('joined_chat', { chatId, chatType, roomName });
        } else {
          socket.emit('error', { message: 'Not authorized to join this chat' });
        }

      } catch (error) {
        console.error('Join chat error:', error);
        socket.emit('error', { message: 'Failed to join chat' });
      }
    });

    socket.on('leave_chat', (data) => {
      const { chatId, chatType } = data;
      const roomName = chatType === 'group' ? `group_${chatId}` : `chat_${chatId}`;
      socket.leave(roomName);
      socket.emit('left_chat', { chatId, chatType });
    });

    // Handle disconnect with cleanup
    socket.on('disconnect', async () => {
      console.log(`User ${socket.user.name} disconnected`);
      
      // Clean up typing indicators
      for (const [timeoutKey, timeout] of typingTimeouts.entries()) {
        if (timeoutKey.startsWith(`${socket.user.id}_`)) {
          clearTimeout(timeout);
          typingTimeouts.delete(timeoutKey);
        }
      }
      
      // Remove from typing users
      for (const [chatId, users] of typingUsers.entries()) {
        if (users.has(socket.user.id)) {
          users.delete(socket.user.id);
          if (users.size === 0) {
            typingUsers.delete(chatId);
          }
        }
      }
      
      // Update user presence to offline
      try {
        await User.updateOne(
          { _id: socket.user.id },
          { 
            isOnline: false,
            lastSeen: new Date()
          }
        );

        // Broadcast offline status to private chat participants
        const privateChats = await PrivateChat.find({
          participants: socket.user.id,
          isActive: true
        });

        privateChats.forEach(chat => {
          const otherParticipantId = chat.participants.find(
            p => p.toString() !== socket.user.id.toString()
          );
          
          socket.to(`user_${otherParticipantId}`).emit('presence_updated', {
            userId: socket.user.id,
            userName: socket.user.name,
            status: 'offline',
            lastSeen: new Date()
          });
        });

      } catch (error) {
        console.error('Error updating user presence on disconnect:', error);
      }
    });
  });
};

module.exports = { setupSocketHandlers };