const mongoose = require('mongoose');

const friendRequestSchema = new mongoose.Schema({
  from: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  to: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined'],
    default: 'pending'
  },
  message: {
    type: String,
    trim: true,
    maxlength: 200
  }
}, {
  timestamps: true
});

// Prevent duplicate friend requests
friendRequestSchema.index({ from: 1, to: 1 }, { unique: true });

// Indexes for performance
friendRequestSchema.index({ to: 1, status: 1 });
friendRequestSchema.index({ from: 1, status: 1 });

module.exports = mongoose.model('FriendRequest', friendRequestSchema);