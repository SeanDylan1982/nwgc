const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  chatId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  chatType: {
    type: String,
    enum: ['group', 'private'],
    required: true
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  senderName: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    trim: true
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'audio', 'video', 'document', 'location', 'contact', 'system'],
    default: 'text'
  },
  // Enhanced attachment system
  attachments: [{
    id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    type: {
      type: String,
      enum: ['image', 'video', 'audio', 'document', 'location', 'contact'],
      required: true
    },
    url: String,
    filename: String,
    size: Number,
    thumbnail: String,
    metadata: {
      // For images/videos
      width: Number,
      height: Number,
      duration: Number, // For audio/video
      format: String,
      
      // For location
      coordinates: {
        latitude: Number,
        longitude: Number
      },
      address: String,
      
      // For contacts
      contactInfo: {
        name: String,
        phone: String,
        email: String
      }
    }
  }],
  // Enhanced reply system
  replyTo: {
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message'
    },
    content: {
      type: String,
      trim: true
    },
    senderName: {
      type: String,
      trim: true
    },
    type: {
      type: String,
      enum: ['text', 'image', 'audio', 'video', 'document', 'location', 'contact']
    }
  },
  isEdited: {
    type: Boolean,
    default: false
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedFor: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  deletedAt: Date,
  // Forwarding support
  isForwarded: {
    type: Boolean,
    default: false
  },
  forwardedFrom: {
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message'
    },
    originalSenderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    originalSenderName: {
      type: String,
      trim: true
    },
    originalChatId: {
      type: mongoose.Schema.Types.ObjectId
    },
    originalChatName: {
      type: String,
      trim: true
    },
    forwardedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    forwardedByName: {
      type: String,
      trim: true
    },
    forwardedAt: {
      type: Date,
      default: Date.now
    }
  },
  // Enhanced message status tracking
  status: {
    type: String,
    enum: ['sending', 'sent', 'delivered', 'read', 'failed'],
    default: 'sending'
  },
  
  // Enhanced delivery tracking
  deliveredTo: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    deliveredAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Enhanced read status tracking
  readBy: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Enhanced reactions system with emoji support
  reactions: [{
    type: {
      type: String,
      required: true // Support any emoji or reaction identifier
    },
    users: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    count: {
      type: Number,
      default: 0
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Message encryption fields
  encryption: {
    isEncrypted: {
      type: Boolean,
      default: false
    },
    encryptionVersion: {
      type: String,
      default: 'v1'
    },
    keyId: String, // Reference to encryption key
    iv: String, // Initialization vector for encryption
    authTag: String // Authentication tag for verification
  },
  
  // Message starring/pinning
  isStarred: {
    type: Boolean,
    default: false
  },
  starredBy: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    starredAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Auto-delete functionality
  autoDelete: {
    enabled: {
      type: Boolean,
      default: false
    },
    expiresAt: Date,
    period: {
      type: Number, // in milliseconds
      default: null
    }
  },
  
  moderationStatus: {
    type: String,
    enum: ['active', 'pending', 'removed', 'archived'],
    default: 'active'
  },
  moderationReason: {
    type: String,
    trim: true
  },
  moderatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  moderatedAt: {
    type: Date
  },
  
  // Reporting system
  isReported: {
    type: Boolean,
    default: false
  },
  reportedBy: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: String,
    reportedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Indexes for performance
messageSchema.index({ chatId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1, createdAt: -1 });
messageSchema.index({ chatType: 1, chatId: 1 });
messageSchema.index({ isForwarded: 1 });
messageSchema.index({ 'forwardedFrom.originalSenderId': 1 });

// Enhanced indexes for new features
messageSchema.index({ 'readBy.userId': 1, chatId: 1 }); // For unread message queries
messageSchema.index({ 'deliveredTo.userId': 1, chatId: 1 }); // For delivery status
messageSchema.index({ 'replyTo.messageId': 1 }); // For message threads
messageSchema.index({ isStarred: 1, 'starredBy.userId': 1 }); // For starred messages
messageSchema.index({ 'autoDelete.expiresAt': 1 }, { expireAfterSeconds: 0 }); // TTL index for auto-delete
messageSchema.index({ moderationStatus: 1, isReported: 1 }); // For moderation queue
messageSchema.index({ 'encryption.isEncrypted': 1 }); // For encryption queries
messageSchema.index({ status: 1, senderId: 1 }); // For message status tracking

// Create text index for search functionality
messageSchema.index({ 
  content: 'text',
  senderName: 'text'
}, {
  weights: {
    content: 10,
    senderName: 5
  },
  name: 'message_search_index'
});

// Add pre-save middleware for auto-delete
messageSchema.pre('save', function(next) {
  if (this.autoDelete.enabled && this.autoDelete.period && !this.autoDelete.expiresAt) {
    this.autoDelete.expiresAt = new Date(Date.now() + this.autoDelete.period);
  }
  next();
});

// Add methods for common operations
messageSchema.methods.addReaction = function(userId, reactionType) {
  const existingReaction = this.reactions.find(r => r.type === reactionType);
  
  if (existingReaction) {
    if (!existingReaction.users.includes(userId)) {
      existingReaction.users.push(userId);
      existingReaction.count += 1;
    }
  } else {
    this.reactions.push({
      type: reactionType,
      users: [userId],
      count: 1
    });
  }
  
  return this.save();
};

messageSchema.methods.removeReaction = function(userId, reactionType) {
  const reactionIndex = this.reactions.findIndex(r => r.type === reactionType);
  
  if (reactionIndex !== -1) {
    const reaction = this.reactions[reactionIndex];
    reaction.users = reaction.users.filter(id => !id.equals(userId));
    reaction.count = Math.max(0, reaction.count - 1);
    
    if (reaction.count === 0) {
      this.reactions.splice(reactionIndex, 1);
    }
  }
  
  return this.save();
};

messageSchema.methods.markAsRead = function(userId) {
  if (!this.readBy.some(r => r.userId.equals(userId))) {
    this.readBy.push({
      userId,
      readAt: new Date()
    });
  }
  return this.save();
};

messageSchema.methods.markAsDelivered = function(userId) {
  if (!this.deliveredTo.some(d => d.userId.equals(userId))) {
    this.deliveredTo.push({
      userId,
      deliveredAt: new Date()
    });
  }
  return this.save();
};

module.exports = mongoose.model('Message', messageSchema);