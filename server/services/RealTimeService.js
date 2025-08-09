/**
 * RealTimeService.js
 * Service for integrating MongoDB change streams with Socket.IO for real-time updates.
 */
const ChangeStreamManager = require('./ChangeStreamManager');
const mongoose = require('mongoose');

class RealTimeService {
  /**
   * Create a new RealTimeService instance
   * @param {Object} io - Socket.IO server instance
   * @param {Object} options - Configuration options
   */
  constructor(io, options = {}) {
    this.io = io;
    this.options = {
      collections: ['messages', 'reports', 'notices', 'chatgroups', 'privatechats'],
      ...options
    };
    
    this.changeStreamManager = new ChangeStreamManager({
      collections: this.options.collections,
      maxRetries: options.maxRetries || 10,
      initialDelayMs: options.initialDelayMs || 1000,
      maxDelayMs: options.maxDelayMs || 60000
    });
    
    this.initialized = false;
  }

  /**
   * Initialize the real-time service
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) {
      return;
    }
    
    try {
      // Initialize change stream manager
      await this.changeStreamManager.initialize();
      
      // Set up event listeners for each collection
      this._setupMessageListeners();
      this._setupReportListeners();
      this._setupNoticeListeners();
      this._setupChatGroupListeners();
      this._setupPrivateChatListeners();
      
      // Set up error handling
      this.changeStreamManager.on('error', (error) => {
        console.error('Change stream error:', error);
      });
      
      this.changeStreamManager.on('reconnecting', (data) => {
        console.log(`Reconnecting to ${data.collection} change stream (attempt ${data.attempt})`);
      });
      
      this.initialized = true;
      console.log('Real-time service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize real-time service:', error);
      throw error;
    }
  }

  /**
   * Set up listeners for message changes
   * @private
   */
  _setupMessageListeners() {
    this.changeStreamManager.addListener('messages', (change) => {
      try {
        const { operationType, fullDocument, documentKey, updateDescription } = change;
        
        switch (operationType) {
          case 'insert': {
            const message = fullDocument;
            
            if (message.chatType === 'group') {
              // Emit to all users in the group chat
              this.io.to(`group_${message.chatId}`).emit('new_message_sync', {
                type: 'new',
                message
              });
            } else if (message.chatType === 'private') {
              // For private chats, emit to both participants
              // We need to query the private chat to get participants
              this._emitToPrivateChatParticipants(message.chatId, 'new_private_message_sync', {
                type: 'new',
                message
              });
            }
            break;
          }
          
          case 'update': {
            // Get the updated fields
            const updatedFields = updateDescription.updatedFields;
            const messageId = documentKey._id;
            
            // Query to get the full updated message with chatId and chatType
            this._getMessageById(messageId).then(message => {
              if (!message) return;
              
              if (message.chatType === 'group') {
                this.io.to(`group_${message.chatId}`).emit('message_updated_sync', {
                  type: 'update',
                  messageId,
                  updates: updatedFields,
                  message
                });
              } else if (message.chatType === 'private') {
                this._emitToPrivateChatParticipants(message.chatId, 'private_message_updated_sync', {
                  type: 'update',
                  messageId,
                  updates: updatedFields,
                  message
                });
              }
            });
            break;
          }
          
          case 'delete': {
            // For deletes, we only have the document key (ID)
            // We need additional logic to determine where to send the notification
            // This would require storing chat metadata or using a different approach
            console.log('Message delete detected, but cannot determine recipients without chatId');
            break;
          }
        }
      } catch (error) {
        console.error('Error processing message change:', error);
      }
    });
  }

  /**
   * Set up listeners for report changes
   * @private
   */
  _setupReportListeners() {
    this.changeStreamManager.addListener('reports', (change) => {
      try {
        const { operationType, fullDocument, documentKey, updateDescription } = change;
        
        switch (operationType) {
          case 'insert': {
            const report = fullDocument;
            
            // Emit to the neighbourhood room
            this.io.to(`neighbourhood_${report.neighbourhoodId}`).emit('report_sync', {
              type: 'new',
              report
            });
            break;
          }
          
          case 'update': {
            const reportId = documentKey._id;
            const updatedFields = updateDescription.updatedFields;
            
            // We need to query to get the neighbourhoodId
            this._getReportById(reportId).then(report => {
              if (!report) return;
              
              this.io.to(`neighbourhood_${report.neighbourhoodId}`).emit('report_sync', {
                type: 'update',
                reportId,
                updates: updatedFields,
                report
              });
            });
            break;
          }
          
          case 'delete': {
            // Similar challenge as with messages for deletes
            console.log('Report delete detected, but cannot determine neighbourhood without querying');
            break;
          }
        }
      } catch (error) {
        console.error('Error processing report change:', error);
      }
    });
  }

  /**
   * Set up listeners for notice changes
   * @private
   */
  _setupNoticeListeners() {
    this.changeStreamManager.addListener('notices', (change) => {
      try {
        const { operationType, fullDocument, documentKey, updateDescription } = change;
        
        switch (operationType) {
          case 'insert': {
            const notice = fullDocument;
            
            // Emit to the neighbourhood room
            this.io.to(`neighbourhood_${notice.neighbourhoodId}`).emit('notice_sync', {
              type: 'new',
              notice
            });
            break;
          }
          
          case 'update': {
            const noticeId = documentKey._id;
            const updatedFields = updateDescription.updatedFields;
            
            // We need to query to get the neighbourhoodId
            this._getNoticeById(noticeId).then(notice => {
              if (!notice) return;
              
              this.io.to(`neighbourhood_${notice.neighbourhoodId}`).emit('notice_sync', {
                type: 'update',
                noticeId,
                updates: updatedFields,
                notice
              });
            });
            break;
          }
          
          case 'delete': {
            // Similar challenge as with other collections for deletes
            console.log('Notice delete detected, but cannot determine neighbourhood without querying');
            break;
          }
        }
      } catch (error) {
        console.error('Error processing notice change:', error);
      }
    });
  }

  /**
   * Set up listeners for chat group changes
   * @private
   */
  _setupChatGroupListeners() {
    this.changeStreamManager.addListener('chatgroups', (change) => {
      try {
        const { operationType, fullDocument, documentKey, updateDescription } = change;
        
        switch (operationType) {
          case 'insert': {
            const chatGroup = fullDocument;
            
            // Notify all members of the new group
            if (chatGroup.members && Array.isArray(chatGroup.members)) {
              chatGroup.members.forEach(member => {
                this.io.to(`user_${member.userId}`).emit('chat_group_sync', {
                  type: 'new',
                  chatGroup
                });
              });
            }
            break;
          }
          
          case 'update': {
            const chatGroupId = documentKey._id;
            const updatedFields = updateDescription.updatedFields;
            
            // Get the full chat group to determine members
            this._getChatGroupById(chatGroupId).then(chatGroup => {
              if (!chatGroup) return;
              
              // Notify all members of the update
              if (chatGroup.members && Array.isArray(chatGroup.members)) {
                chatGroup.members.forEach(member => {
                  this.io.to(`user_${member.userId}`).emit('chat_group_sync', {
                    type: 'update',
                    chatGroupId,
                    updates: updatedFields,
                    chatGroup
                  });
                });
              }
              
              // If members were updated, handle join/leave notifications
              if (updatedFields.members) {
                // Complex logic would be needed here to determine who joined/left
                // This is a simplified approach
                this.io.to(`group_${chatGroupId}`).emit('chat_group_members_sync', {
                  type: 'members_updated',
                  chatGroupId,
                  members: chatGroup.members
                });
              }
            });
            break;
          }
        }
      } catch (error) {
        console.error('Error processing chat group change:', error);
      }
    });
  }

  /**
   * Set up listeners for private chat changes
   * @private
   */
  _setupPrivateChatListeners() {
    this.changeStreamManager.addListener('privatechats', (change) => {
      try {
        const { operationType, fullDocument, documentKey, updateDescription } = change;
        
        switch (operationType) {
          case 'insert': {
            const privateChat = fullDocument;
            
            // Notify both participants
            if (privateChat.participants && Array.isArray(privateChat.participants)) {
              privateChat.participants.forEach(participantId => {
                this.io.to(`user_${participantId}`).emit('private_chat_sync', {
                  type: 'new',
                  privateChat
                });
              });
            }
            break;
          }
          
          case 'update': {
            const privateChatId = documentKey._id;
            const updatedFields = updateDescription.updatedFields;
            
            // Get the full private chat to determine participants
            this._getPrivateChatById(privateChatId).then(privateChat => {
              if (!privateChat) return;
              
              // Notify both participants of the update
              if (privateChat.participants && Array.isArray(privateChat.participants)) {
                privateChat.participants.forEach(participantId => {
                  this.io.to(`user_${participantId}`).emit('private_chat_sync', {
                    type: 'update',
                    privateChatId,
                    updates: updatedFields,
                    privateChat
                  });
                });
              }
            });
            break;
          }
        }
      } catch (error) {
        console.error('Error processing private chat change:', error);
      }
    });
  }

  /**
   * Get a message by ID
   * @param {string|ObjectId} messageId - Message ID
   * @returns {Promise<Object|null>} Message object or null
   * @private
   */
  async _getMessageById(messageId) {
    try {
      const Message = mongoose.model('Message');
      return await Message.findById(messageId);
    } catch (error) {
      console.error('Error getting message by ID:', error);
      return null;
    }
  }

  /**
   * Get a report by ID
   * @param {string|ObjectId} reportId - Report ID
   * @returns {Promise<Object|null>} Report object or null
   * @private
   */
  async _getReportById(reportId) {
    try {
      const Report = mongoose.model('Report');
      return await Report.findById(reportId);
    } catch (error) {
      console.error('Error getting report by ID:', error);
      return null;
    }
  }

  /**
   * Get a notice by ID
   * @param {string|ObjectId} noticeId - Notice ID
   * @returns {Promise<Object|null>} Notice object or null
   * @private
   */
  async _getNoticeById(noticeId) {
    try {
      const Notice = mongoose.model('Notice');
      return await Notice.findById(noticeId);
    } catch (error) {
      console.error('Error getting notice by ID:', error);
      return null;
    }
  }

  /**
   * Get a chat group by ID
   * @param {string|ObjectId} chatGroupId - Chat group ID
   * @returns {Promise<Object|null>} Chat group object or null
   * @private
   */
  async _getChatGroupById(chatGroupId) {
    try {
      const ChatGroup = mongoose.model('ChatGroup');
      return await ChatGroup.findById(chatGroupId);
    } catch (error) {
      console.error('Error getting chat group by ID:', error);
      return null;
    }
  }

  /**
   * Get a private chat by ID
   * @param {string|ObjectId} privateChatId - Private chat ID
   * @returns {Promise<Object|null>} Private chat object or null
   * @private
   */
  async _getPrivateChatById(privateChatId) {
    try {
      const PrivateChat = mongoose.model('PrivateChat');
      return await PrivateChat.findById(privateChatId);
    } catch (error) {
      console.error('Error getting private chat by ID:', error);
      return null;
    }
  }

  /**
   * Emit an event to all participants in a private chat
   * @param {string|ObjectId} chatId - Private chat ID
   * @param {string} event - Event name
   * @param {Object} data - Event data
   * @private
   */
  async _emitToPrivateChatParticipants(chatId, event, data) {
    try {
      const PrivateChat = mongoose.model('PrivateChat');
      const privateChat = await PrivateChat.findById(chatId);
      
      if (!privateChat || !privateChat.participants) {
        return;
      }
      
      // Emit to each participant
      privateChat.participants.forEach(participantId => {
        this.io.to(`user_${participantId}`).emit(event, data);
      });
    } catch (error) {
      console.error('Error emitting to private chat participants:', error);
    }
  }

  /**
   * Get status information about the real-time service
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      initialized: this.initialized,
      changeStreams: this.changeStreamManager.getStatus()
    };
  }

  /**
   * Close the real-time service and clean up resources
   * @returns {Promise<void>}
   */
  async close() {
    if (!this.initialized) {
      return;
    }
    
    try {
      await this.changeStreamManager.close();
      this.initialized = false;
      console.log('Real-time service closed');
    } catch (error) {
      console.error('Error closing real-time service:', error);
      throw error;
    }
  }
}

module.exports = RealTimeService;