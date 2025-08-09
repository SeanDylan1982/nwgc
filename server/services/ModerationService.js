const Notice = require('../models/Notice');
const Report = require('../models/Report');
const Message = require('../models/Message');
const PrivateChat = require('../models/PrivateChat');
const AuditService = require('./AuditService');
const RealTimeService = require('./RealTimeService');

/**
 * Service for content moderation functionality
 */
class ModerationService {
  /**
   * Update content status (active, archived, removed)
   * @param {Object} params - Parameters
   * @param {string} params.contentType - Type of content (notice, report, message)
   * @param {string} params.contentId - ID of the content
   * @param {string} params.status - New status (active, archived, removed)
   * @param {string} params.moderationReason - Reason for moderation
   * @param {string} params.adminId - ID of the admin performing the action
   * @returns {Promise<Object>} Updated content
   */
  static async updateContentStatus(params) {
    const { contentType, contentId, status, moderationReason, adminId } = params;
    
    let Model;
    let content;
    let targetType;
    
    switch (contentType) {
      case 'notice':
        Model = Notice;
        targetType = 'notice';
        break;
      case 'report':
        Model = Report;
        targetType = 'report';
        break;
      case 'message':
        Model = Message;
        targetType = 'chat';
        break;
      default:
        throw new Error('Invalid content type');
    }
    
    content = await Model.findById(contentId);
    if (!content) {
      throw new Error('Content not found');
    }
    
    // Get the current status based on content type
    let oldStatus;
    if (contentType === 'message') {
      oldStatus = content.moderationStatus || 'active';
    } else if (contentType === 'report') {
      oldStatus = content.reportStatus || 'active';
    } else {
      oldStatus = content.status || 'active';
    }
    
    // Update content status based on content type
    if (contentType === 'message') {
      content.moderationStatus = status;
    } else if (contentType === 'report') {
      content.reportStatus = status;
    } else {
      content.status = status;
    }
    
    // Add moderation metadata
    content.moderationReason = moderationReason;
    content.moderatedBy = adminId;
    content.moderatedAt = new Date();
    
    const updatedContent = await content.save();
    
    // Log the action to audit log
    await AuditService.logAction({
      adminId,
      action: 'content_moderate',
      targetType,
      targetId: contentId,
      details: {
        oldStatus,
        newStatus: status,
        reason: moderationReason || 'No reason provided'
      }
    });
    
    // Note: Real-time notifications would be handled by the change streams
    // when the content status is updated
    
    return updatedContent;
  }
  
  /**
   * Edit content (for admin use)
   * @param {Object} params - Parameters
   * @param {string} params.contentType - Type of content (notice, report, message)
   * @param {string} params.contentId - ID of the content
   * @param {Object} params.updates - Fields to update
   * @param {string} params.moderationReason - Reason for edit
   * @param {string} params.adminId - ID of the admin performing the action
   * @returns {Promise<Object>} Updated content
   */
  static async editContent(params) {
    const { contentType, contentId, updates, moderationReason, adminId } = params;
    
    let Model;
    let content;
    let targetType;
    
    switch (contentType) {
      case 'notice':
        Model = Notice;
        targetType = 'notice';
        break;
      case 'report':
        Model = Report;
        targetType = 'report';
        break;
      case 'message':
        Model = Message;
        targetType = 'chat';
        break;
      default:
        throw new Error('Invalid content type');
    }
    
    content = await Model.findById(contentId);
    if (!content) {
      throw new Error('Content not found');
    }
    
    // Store original values for audit log
    const originalValues = {};
    Object.keys(updates).forEach(key => {
      originalValues[key] = content[key];
    });
    
    // Apply updates
    Object.keys(updates).forEach(key => {
      // Prevent updating certain fields
      if (['_id', 'authorId', 'reporterId', 'senderId', 'createdAt'].includes(key)) {
        return;
      }
      content[key] = updates[key];
    });
    
    // Add moderation metadata
    content.moderationReason = moderationReason;
    content.moderatedBy = adminId;
    content.moderatedAt = new Date();
    content.isEdited = true;
    
    const updatedContent = await content.save();
    
    // Log the action to audit log
    await AuditService.logAction({
      adminId,
      action: 'content_edit',
      targetType,
      targetId: contentId,
      details: {
        originalValues,
        newValues: updates,
        reason: moderationReason || 'No reason provided'
      }
    });
    
    // Note: Real-time notifications would be handled by the change streams
    // when the content is updated
    
    return updatedContent;
  }
  
  /**
   * Approve content and clear all reports
   * @param {Object} params - Parameters
   * @param {string} params.contentType - Type of content (notice, report, message)
   * @param {string} params.contentId - ID of the content
   * @param {string} params.moderationReason - Reason for approval
   * @param {string} params.adminId - ID of the admin performing the action
   * @returns {Promise<Object>} Updated content
   */
  static async approveContent(params) {
    const { contentType, contentId, moderationReason, adminId } = params;
    
    let Model;
    let content;
    let targetType;
    
    switch (contentType) {
      case 'notice':
        Model = Notice;
        targetType = 'notice';
        break;
      case 'report':
        Model = Report;
        targetType = 'report';
        break;
      case 'message':
        Model = Message;
        targetType = 'chat';
        break;
      default:
        throw new Error('Invalid content type');
    }
    
    content = await Model.findById(contentId);
    if (!content) {
      throw new Error('Content not found');
    }
    
    // Clear all reports and flagged status
    content.reports = [];
    content.isFlagged = false;
    content.flaggedAt = null;
    
    // Set status to active if it's not already
    if (contentType === 'message') {
      content.moderationStatus = 'active';
    } else if (contentType === 'report') {
      content.reportStatus = 'active';
    } else {
      content.status = 'active';
    }
    
    // Add moderation metadata
    content.moderationReason = moderationReason || 'Content approved by administrator';
    content.moderatedBy = adminId;
    content.moderatedAt = new Date();
    
    const updatedContent = await content.save();
    
    // Log the action to audit log
    await AuditService.logAction({
      adminId,
      action: 'content_approve',
      targetType,
      targetId: contentId,
      details: {
        reason: moderationReason || 'Content approved by administrator',
        reportsCleared: true
      }
    });
    
    // Note: Real-time notifications would be handled by the change streams
    // when the content is updated
    
    return updatedContent;
  }

  /**
   * Restore content to active status
   * @param {Object} params - Parameters
   * @param {string} params.contentType - Type of content (notice, report, message)
   * @param {string} params.contentId - ID of the content
   * @param {string} params.moderationReason - Reason for restoration
   * @param {string} params.adminId - ID of the admin performing the action
   * @returns {Promise<Object>} Updated content
   */
  static async restoreContent(params) {
    const { contentType, contentId, moderationReason, adminId } = params;
    
    // Use updateContentStatus with 'active' status
    return this.updateContentStatus({
      contentType,
      contentId,
      status: 'active',
      moderationReason: moderationReason || 'Content restored by administrator',
      adminId
    });
  }
  
  /**
   * Get moderated content with pagination and filtering
   * @param {Object} params - Parameters
   * @param {string} params.contentType - Type of content (notice, report, message, all)
   * @param {string} params.status - Filter by status (active, archived, removed, all)
   * @param {number} params.page - Page number
   * @param {number} params.limit - Items per page
   * @param {boolean} params.flagged - Show only flagged content
   * @param {boolean} params.moderated - Show only moderated content
   * @param {string} params.reportReason - Filter by report reason
   * @returns {Promise<Object>} Paginated moderated content
   */
  static async getModeratedContent(params) {
    try {
      console.log('=== MODERATIONSERVICE.GETMODERATEDCONTENT START ===');
      console.log('Raw params received:', params);
      
      const { contentType = 'all', status, page = 1, limit = 20, flagged = false, moderated = false, reportReason } = params;
      
      console.log('Parsed params:', { contentType, status, page, limit, flagged, moderated, reportReason });
      
      // We'll build the query inside getPaginatedContent for each model type
      // to avoid conflicts between different status field names
      
      let results = { total: 0, content: [], page, limit, totalPages: 0 };
      
      // Calculate pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);
      
      // Function to get paginated content from a model
      const getPaginatedContent = async (Model, type) => {
        try {
          console.log(`=== GETPAGINATEDCONTENT START for ${type} ===`);
          console.log('Input params:', { flagged, moderated, status, reportReason });
          
          let modelQuery = {};
          
          // Add flagged filter if specified
          if (flagged) {
            console.log(`Adding flagged filter for ${type}`);
            modelQuery.isFlagged = true;
            
            // Filter by report reason if specified
            if (reportReason) {
              console.log(`Adding report reason filter: ${reportReason}`);
              modelQuery['reports.reason'] = reportReason;
            }
          } else if (moderated) {
            console.log(`Adding moderated filter for ${type}`);
            // Show only moderated content
            modelQuery.moderatedBy = { $exists: true };
          } else {
            console.log(`No special filters - showing all ${type} content`);
          }
          
          // Add status filter if specified and not 'all'
          if (status && status !== 'all') {
            console.log(`Adding status filter: ${status} for ${type}`);
            if (type === 'message') {
              modelQuery.moderationStatus = status;
            } else if (type === 'report') {
              modelQuery.reportStatus = status;
            } else {
              modelQuery.status = status;
            }
          }
          
          console.log(`Querying ${type} with query:`, JSON.stringify(modelQuery, null, 2));
          
          const total = await Model.countDocuments(modelQuery);
          console.log(`Found ${total} ${type} documents matching query`);
          
          // Also check total documents without query for debugging
          const totalAll = await Model.countDocuments({});
          console.log(`Total ${type} documents in collection: ${totalAll}`);
          
          // Check specifically for flagged content
          if (flagged) {
            const flaggedCount = await Model.countDocuments({ isFlagged: true });
            console.log(`Total flagged ${type} documents: ${flaggedCount}`);
            
            // Get a sample of flagged documents to inspect
            const sampleFlagged = await Model.find({ isFlagged: true }).limit(2).select('title isFlagged reports');
            console.log(`Sample flagged ${type} documents:`, JSON.stringify(sampleFlagged, null, 2));
          }
          
          const content = await Model.find(modelQuery)
            .populate('moderatedBy', 'firstName lastName email')
            .populate('reports.reportedBy', 'firstName lastName email')
            .populate('authorId', 'firstName lastName email')
            .populate('reporterId', 'firstName lastName email')
            .populate('senderId', 'firstName lastName email')
            .sort({ 
              // Sort flagged content by most recent report, others by moderation date
              ...(flagged ? { flaggedAt: -1 } : { moderatedAt: -1, createdAt: -1 })
            })
            .skip(skip)
            .limit(parseInt(limit));
          
          console.log(`Retrieved ${content.length} ${type} documents`);
          
          return {
            total,
            content: content.map(item => ({
              ...item.toObject(),
              contentType: type,
              // Add author/creator info for easier display
              author: item.authorId || item.reporterId || item.senderId,
              createdBy: item.authorId || item.reporterId || item.senderId
            }))
          };
        } catch (error) {
          console.error(`Error getting ${type} content:`, error);
          return { total: 0, content: [] };
        }
      };
      
      // Get content based on type
      console.log(`Content type filter: ${contentType}`);
      
      if (contentType === 'all' || contentType === 'notice') {
        console.log('Querying notices...');
        const noticeResults = await getPaginatedContent(Notice, 'notice');
        console.log(`Notice results: ${noticeResults.total} total, ${noticeResults.content.length} items`);
        results.total += noticeResults.total;
        results.content = [...results.content, ...noticeResults.content];
      }
      
      if (contentType === 'all' || contentType === 'report') {
        console.log('Querying reports...');
        const reportResults = await getPaginatedContent(Report, 'report');
        console.log(`Report results: ${reportResults.total} total, ${reportResults.content.length} items`);
        results.total += reportResults.total;
        results.content = [...results.content, ...reportResults.content];
      }
      
      if (contentType === 'all' || contentType === 'message') {
        console.log('Querying messages...');
        const messageResults = await getPaginatedContent(Message, 'message');
        console.log(`Message results: ${messageResults.total} total, ${messageResults.content.length} items`);
        results.total += messageResults.total;
        results.content = [...results.content, ...messageResults.content];
      }
      
      // Sort combined results by appropriate date
      if (flagged) {
        results.content.sort((a, b) => 
          new Date(b.flaggedAt || b.createdAt) - new Date(a.flaggedAt || a.createdAt)
        );
      } else {
        results.content.sort((a, b) => 
          new Date(b.moderatedAt || b.createdAt) - new Date(a.moderatedAt || a.createdAt)
        );
      }
      
      // Adjust for pagination if getting all content types
      if (contentType === 'all') {
        results.content = results.content.slice(0, parseInt(limit));
      }
      
      results.totalPages = Math.ceil(results.total / parseInt(limit));
      
      console.log('=== FINAL RESULTS ===');
      console.log('ModerationService.getModeratedContent returning:', {
        total: results.total,
        contentLength: results.content.length,
        page: results.page,
        totalPages: results.totalPages
      });
      console.log('=== MODERATIONSERVICE.GETMODERATEDCONTENT END ===');
      
      return results;
    } catch (error) {
      console.error('Error in ModerationService.getModeratedContent:', error);
      throw error;
    }
  }

  /**
   * Report content for moderation
   * @param {Object} params - Parameters
   * @param {string} params.contentType - Type of content (notice, report, message)
   * @param {string} params.contentId - ID of the content
   * @param {string} params.reason - Reason for reporting
   * @param {string} params.reporterId - ID of the user reporting the content
   * @returns {Promise<Object>} Report record
   */
  static async reportContent(params) {
    const { contentType, contentId, reason, reporterId } = params;
    
    let Model;
    let content;
    
    switch (contentType) {
      case 'notice':
        Model = Notice;
        break;
      case 'report':
        Model = Report;
        break;
      case 'message':
        Model = Message;
        break;
      default:
        throw new Error('Invalid content type');
    }
    
    // Check if content exists
    content = await Model.findById(contentId);
    if (!content) {
      throw new Error('Content not found');
    }
    
    // Check if user has already reported this content
    // First ensure the content has a reports array
    if (!content.reports) {
      content.reports = [];
    }
    
    // Check if this user has already reported this content
    const hasAlreadyReported = content.reports.some(
      report => report.reporterId && report.reporterId.toString() === reporterId.toString()
    );
    
    if (hasAlreadyReported) {
      throw new Error('Content already reported by this user');
    }
    
    // Add report to the content
    const reportData = {
      reporterId,
      reason,
      reportedAt: new Date()
    };
    
    const updatedContent = await Model.findByIdAndUpdate(
      contentId,
      { 
        $push: { reports: reportData },
        $set: { 
          isFlagged: true,
          flaggedAt: new Date()
        }
      },
      { new: true }
    );
    
    // Log the report action (skip audit logging for user reports since it's designed for admin actions)
    // User reports are tracked in the content's reports array instead
    
    // Note: Real-time notifications for flagged content would be handled by the change streams
    // when the content is updated with the new report
    
    return updatedContent;
  }
}

module.exports = ModerationService;