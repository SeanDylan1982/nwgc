const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  address: {
    type: String,
    trim: true
  },
  profileImageUrl: {
    type: String
  },
  role: {
    type: String,
    enum: ['admin', 'moderator', 'user'],
    default: 'user'
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  neighbourhoodId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Neighbourhood'
  },
  bio: {
    type: String,
    trim: true,
    maxlength: 500
  },
  friends: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  status: {
    type: String,
    enum: ['active', 'suspended', 'banned'],
    default: 'active'
  },
  settings: {
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      friendRequests: { type: Boolean, default: true },
      messages: { type: Boolean, default: true },
      chatNotifications: { type: Boolean, default: true },
      reportNotifications: { type: Boolean, default: true }
    },
    privacy: {
      profileVisibility: { 
        type: String, 
        enum: ['public', 'neighbours', 'friends', 'private'],
        default: 'neighbours'
      },
      messagePermissions: {
        type: String,
        enum: ['everyone', 'neighbours', 'friends', 'none'],
        default: 'friends'
      }
    },
    locationSharing: { type: Boolean, default: false },
    dismissedWelcomeMessages: {
      chat: { type: Boolean, default: false },
      noticeBoard: { type: Boolean, default: false },
      reports: { type: Boolean, default: false }
    },
    welcomeMessageStates: {
      chat: {
        dismissed: { type: Boolean, default: false },
        collapsed: { type: Boolean, default: false }
      },
      noticeBoard: {
        dismissed: { type: Boolean, default: false },
        collapsed: { type: Boolean, default: false }
      },
      reports: {
        dismissed: { type: Boolean, default: false },
        collapsed: { type: Boolean, default: false }
      }
    },
    interface: {
      sidebarExpanded: { type: Boolean, default: false },
      darkMode: { type: Boolean, default: false },
      language: { type: String, default: 'en' }
    }
  },
  legalAcceptance: {
    termsOfService: {
      accepted: { type: Boolean, default: false },
      version: { type: String },
      timestamp: { type: Date }
    },
    privacyPolicy: {
      accepted: { type: Boolean, default: false },
      version: { type: String },
      timestamp: { type: Date }
    },
    noticeBoardTerms: {
      accepted: { type: Boolean, default: false },
      timestamp: { type: Date }
    },
    reportTerms: {
      accepted: { type: Boolean, default: false },
      timestamp: { type: Date }
    }
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Transform output
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  return user;
};

// Create text index for search functionality
userSchema.index({ 
  firstName: 'text', 
  lastName: 'text', 
  email: 'text',
  bio: 'text'
}, {
  weights: {
    firstName: 10,
    lastName: 10,
    email: 5,
    bio: 1
  },
  name: 'user_search_index'
});

// Create index for neighbourhood lookup
userSchema.index({ neighbourhoodId: 1, isActive: 1 });

module.exports = mongoose.model('User', userSchema);