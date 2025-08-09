const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 255
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: ['security', 'traffic', 'maintenance', 'pets', 'noise', 'other']
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  location: {
    address: String,
    coordinates: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [0, 0]
      }
    }
  },
  neighbourhoodId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Neighbourhood',
    required: true
  },
  reporterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['open', 'in-progress', 'resolved', 'closed', 'removed'],
    default: 'open'
  },
  reportStatus: {
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
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isAnonymous: {
    type: Boolean,
    default: false
  },
  incidentDate: {
    type: Date
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
  viewCount: {
    type: Number,
    default: 0
  },
  comments: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    content: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
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
  },
  isPinned: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Create geospatial index for location
reportSchema.index({ 'location.coordinates': '2dsphere' });
reportSchema.index({ neighbourhoodId: 1, status: 1 });
reportSchema.index({ createdAt: -1 });

// Create text index for search functionality
reportSchema.index({ 
  title: 'text', 
  description: 'text',
  category: 'text',
  'location.address': 'text'
}, {
  weights: {
    title: 10,
    description: 5,
    category: 3,
    'location.address': 2
  },
  name: 'report_search_index'
});

module.exports = mongoose.model('Report', reportSchema);