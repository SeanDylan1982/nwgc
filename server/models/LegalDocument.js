/**
 * LegalDocument Model
 * Manages versioned legal documents like Terms of Service and Privacy Policy
 */
const mongoose = require('mongoose');

const legalDocumentSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['termsOfService', 'privacyPolicy', 'noticeBoardTerms', 'reportTerms'],
    index: true
  },
  version: {
    type: String,
    required: true,
    trim: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: true
  },
  summary: {
    type: String,
    trim: true,
    maxlength: 500
  },
  active: {
    type: Boolean,
    default: false,
    index: true
  },
  effectiveDate: {
    type: Date,
    default: Date.now
  },
  expiryDate: {
    type: Date
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  },
  metadata: {
    language: {
      type: String,
      default: 'en',
      enum: ['en', 'af', 'zu', 'xh'] // English, Afrikaans, Zulu, Xhosa for South Africa
    },
    jurisdiction: {
      type: String,
      default: 'ZA' // South Africa
    },
    complianceStandards: [{
      type: String,
      enum: ['POPIA', 'GDPR', 'CCPA'] // POPIA for South Africa
    }],
    lastReviewDate: {
      type: Date
    },
    nextReviewDate: {
      type: Date
    },
    changeReason: {
      type: String,
      trim: true
    }
  },
  sections: [{
    title: {
      type: String,
      required: true,
      trim: true
    },
    content: {
      type: String,
      required: true
    },
    order: {
      type: Number,
      required: true
    }
  }],
  acceptanceStats: {
    totalAcceptances: {
      type: Number,
      default: 0
    },
    lastAcceptanceDate: {
      type: Date
    },
    acceptanceRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    }
  }
}, {
  timestamps: true
});

// Compound index for type and version uniqueness
legalDocumentSchema.index({ type: 1, version: 1 }, { unique: true });

// Index for finding active documents
legalDocumentSchema.index({ type: 1, active: 1 });

// Index for effective date queries
legalDocumentSchema.index({ effectiveDate: 1, active: 1 });

// Text search index for content
legalDocumentSchema.index({
  title: 'text',
  content: 'text',
  summary: 'text'
}, {
  weights: {
    title: 10,
    summary: 5,
    content: 1
  },
  name: 'legal_document_search_index'
});

/**
 * Pre-save middleware to handle version management
 */
legalDocumentSchema.pre('save', async function(next) {
  try {
    // If this document is being set as active, deactivate others of the same type
    if (this.active && this.isModified('active')) {
      await this.constructor.updateMany(
        { 
          type: this.type, 
          _id: { $ne: this._id } 
        },
        { active: false }
      );
    }

    // Auto-generate version if not provided
    if (this.isNew && !this.version) {
      const latestDoc = await this.constructor
        .findOne({ type: this.type })
        .sort({ createdAt: -1 });
      
      if (latestDoc) {
        const latestVersion = parseFloat(latestDoc.version) || 1.0;
        this.version = (latestVersion + 0.1).toFixed(1);
      } else {
        this.version = '1.0';
      }
    }

    // Set next review date if not provided (1 year from now)
    if (this.isNew && !this.metadata.nextReviewDate) {
      const nextYear = new Date();
      nextYear.setFullYear(nextYear.getFullYear() + 1);
      this.metadata.nextReviewDate = nextYear;
    }

    next();
  } catch (error) {
    next(error);
  }
});

/**
 * Static method to get the active document of a specific type
 */
legalDocumentSchema.statics.getActiveDocument = function(type) {
  return this.findOne({ 
    type, 
    active: true,
    effectiveDate: { $lte: new Date() },
    $or: [
      { expiryDate: null },
      { expiryDate: { $gt: new Date() } }
    ]
  }).populate('createdBy approvedBy', 'firstName lastName email');
};

/**
 * Static method to get document history for a type
 */
legalDocumentSchema.statics.getDocumentHistory = function(type, limit = 10) {
  return this.find({ type })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('createdBy approvedBy', 'firstName lastName email')
    .select('-content'); // Exclude content for performance
};

/**
 * Instance method to activate this document
 */
legalDocumentSchema.methods.activate = async function() {
  // Deactivate other documents of the same type
  await this.constructor.updateMany(
    { 
      type: this.type, 
      _id: { $ne: this._id } 
    },
    { active: false }
  );

  // Activate this document
  this.active = true;
  this.effectiveDate = new Date();
  
  return this.save();
};

/**
 * Instance method to approve this document
 */
legalDocumentSchema.methods.approve = function(approvedBy) {
  this.approvedBy = approvedBy;
  this.approvedAt = new Date();
  
  return this.save();
};

/**
 * Instance method to get formatted content for display
 */
legalDocumentSchema.methods.getFormattedContent = function() {
  return {
    id: this._id,
    type: this.type,
    version: this.version,
    title: this.title,
    content: this.content,
    summary: this.summary,
    effectiveDate: this.effectiveDate,
    sections: this.sections.sort((a, b) => a.order - b.order),
    metadata: this.metadata
  };
};

/**
 * Instance method to update acceptance statistics
 */
legalDocumentSchema.methods.updateAcceptanceStats = async function() {
  try {
    const User = mongoose.model('User');
    
    // Count total active users
    const totalUsers = await User.countDocuments({ isActive: true });
    
    // Count users who have accepted this document type
    const acceptanceField = `legalAcceptance.${this.type}.accepted`;
    const acceptedUsers = await User.countDocuments({
      isActive: true,
      [acceptanceField]: true
    });

    // Get last acceptance date
    const lastAcceptanceField = `legalAcceptance.${this.type}.timestamp`;
    const lastAcceptance = await User.findOne({
      [acceptanceField]: true
    }).sort({ [lastAcceptanceField]: -1 });

    // Update stats
    this.acceptanceStats.totalAcceptances = acceptedUsers;
    this.acceptanceStats.acceptanceRate = totalUsers > 0 ? (acceptedUsers / totalUsers) * 100 : 0;
    
    if (lastAcceptance && lastAcceptance.legalAcceptance[this.type]) {
      this.acceptanceStats.lastAcceptanceDate = lastAcceptance.legalAcceptance[this.type].timestamp;
    }

    return this.save();
  } catch (error) {
    console.error('Error updating acceptance stats:', error);
    throw error;
  }
};

/**
 * Virtual for formatted version display
 */
legalDocumentSchema.virtual('displayVersion').get(function() {
  return `v${this.version}`;
});

/**
 * Virtual for document age
 */
legalDocumentSchema.virtual('age').get(function() {
  const now = new Date();
  const created = this.createdAt;
  const diffTime = Math.abs(now - created);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 30) {
    return `${diffDays} days`;
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months} month${months > 1 ? 's' : ''}`;
  } else {
    const years = Math.floor(diffDays / 365);
    return `${years} year${years > 1 ? 's' : ''}`;
  }
});

/**
 * Transform output to exclude sensitive information
 */
legalDocumentSchema.methods.toJSON = function() {
  const document = this.toObject({ virtuals: true });
  
  // Include virtuals
  document.displayVersion = this.displayVersion;
  document.age = this.age;
  
  return document;
};

module.exports = mongoose.model('LegalDocument', legalDocumentSchema);