const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['friendRequest', 'message', 'like', 'comment', 'system', 'report', 'notice', 'privateMessage'],
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  read: {
    type: Boolean,
    default: false
  },
  reference: {
    type: {
      type: String,
      enum: ['user', 'message', 'notice', 'report', 'chat', 'system', 'friendRequest'],
      required: true
    },
    id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    }
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Indexes for performance
notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, type: 1 });
notificationSchema.index({ createdAt: -1 });

// Prevent duplicate notifications for the same reference
notificationSchema.index({ 
  recipient: 1, 
  'reference.type': 1, 
  'reference.id': 1, 
  type: 1 
}, { 
  unique: true,
  partialFilterExpression: { 
    type: { $in: ['friendRequest', 'like'] } 
  }
});

module.exports = mongoose.model('Notification', notificationSchema);