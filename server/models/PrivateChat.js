const mongoose = require('mongoose');

const privateChatSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  lastMessage: {
    content: String,
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    timestamp: Date,
    messageType: {
      type: String,
      enum: ['text', 'image', 'video', 'file'],
      default: 'text'
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  status: {
    type: String,
    enum: ['active', 'archived', 'removed'],
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
  }
}, {
  timestamps: true
});

// Ensure exactly 2 participants
privateChatSchema.pre('save', function(next) {
  if (this.participants.length !== 2) {
    return next(new Error('Private chat must have exactly 2 participants'));
  }
  next();
});

// Prevent duplicate chats between same users
privateChatSchema.index({ participants: 1 }, { unique: true });

module.exports = mongoose.model('PrivateChat', privateChatSchema);