const mongoose = require('mongoose');

const noticeSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 255
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: ['safety', 'event', 'lost_found', 'general', 'emergency', 'maintenance'],
    default: 'general'
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  neighbourhoodId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Neighbourhood',
    required: true
  },
  authorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  expiresAt: {
    type: Date
  },
  isPinned: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  viewCount: {
    type: Number,
    default: 0
  },
  media: [{
    type: {
      type: String,
      enum: ['image', 'video', 'file']
    },
    url: String,
    filename: String,
    size: Number,
    uploadedAt: { type: Date, default: Date.now }
  }],
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  comments: [{
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    content: {
      type: String,
      required: true,
      trim: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
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
  },
  reports: [{
    reporterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    reason: {
      type: String,
      required: true,
      trim: true
    },
    reportedAt: {
      type: Date,
      default: Date.now
    }
  }],
  isFlagged: {
    type: Boolean,
    default: false
  },
  flaggedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes for performance
noticeSchema.index({ neighbourhoodId: 1, isActive: 1 });
noticeSchema.index({ isPinned: -1, createdAt: -1 });
noticeSchema.index({ expiresAt: 1 });

// Create text index for search functionality
noticeSchema.index({ 
  title: 'text', 
  content: 'text',
  category: 'text'
}, {
  weights: {
    title: 10,
    content: 5,
    category: 3
  },
  name: 'notice_search_index'
});

module.exports = mongoose.model('Notice', noticeSchema);