const mongoose = require('mongoose');

const chatGroupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 255
  },
  description: {
    type: String,
    trim: true
  },
  type: {
    type: String,
    enum: ['public', 'private', 'announcement'],
    default: 'public'
  },
  neighbourhoodId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Neighbourhood',
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  members: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['admin', 'moderator', 'member'],
      default: 'member'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  lastActivity: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes
chatGroupSchema.index({ neighbourhoodId: 1, isActive: 1 });
chatGroupSchema.index({ 'members.userId': 1 });

// Create text index for search functionality
chatGroupSchema.index({ 
  name: 'text', 
  description: 'text',
  type: 'text'
}, {
  weights: {
    name: 10,
    description: 5,
    type: 2
  },
  name: 'chat_group_search_index'
});

module.exports = mongoose.model('ChatGroup', chatGroupSchema);