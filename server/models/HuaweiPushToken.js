const mongoose = require('mongoose');

const huaweiPushTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  token: {
    type: String,
    required: true
  },
  userAgent: {
    type: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastUsed: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes
huaweiPushTokenSchema.index({ userId: 1, isActive: 1 });
huaweiPushTokenSchema.index({ token: 1 }, { unique: true });

module.exports = mongoose.model('HuaweiPushToken', huaweiPushTokenSchema);