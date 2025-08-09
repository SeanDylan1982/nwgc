const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const ModerationService = require('../services/ModerationService');
const AuditService = require('../services/AuditService');
const { authenticateToken } = require('../middleware/auth');
const { requireAdmin, requireModerator, requireActiveUser } = require('../middleware/adminAuth');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * @route   GET /api/moderation/content
 * @desc    Get moderated content with pagination and filtering
 * @access  Admin/Moderator
 */
router.get('/content', [
  requireModerator, // Only moderators can view moderated content
  query('contentType').optional().isIn(['notice', 'report', 'message', 'all']),
  query('status').optional().isIn(['active', 'archived', 'removed', 'all']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('flagged').optional().isBoolean(),
  query('moderated').optional().isBoolean(),
  query('reportReason').optional().isIn(['inappropriate', 'spam', 'harassment', 'misinformation', 'other'])
], async (req, res) => {
  try {
    console.log('GET /api/moderation/content called');
    console.log('User:', req.user);
    console.log('Query params:', req.query);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    const { contentType, status, page, limit, flagged, moderated, reportReason } = req.query;
    
    const params = {
      contentType: contentType || 'all',
      status: status || 'all',
      page: page || 1,
      limit: limit || 20,
      flagged: flagged === 'true',
      moderated: moderated === 'true',
      reportReason
    };
    
    console.log('Calling ModerationService.getModeratedContent with params:', params);
    
    const result = await ModerationService.getModeratedContent(params);
    
    console.log('ModerationService returned result:', {
      total: result.total,
      contentLength: result.content?.length,
      page: result.page,
      totalPages: result.totalPages
    });
    
    res.json(result);
  } catch (error) {
    console.error('Error getting moderated content:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   PATCH /api/moderation/content/:type/:id/status
 * @desc    Update content status (active, archived, removed)
 * @access  Admin/Moderator
 */
router.patch('/content/:type/:id/status', [
  requireModerator, // Only moderators can update content status
  param('type').isIn(['notice', 'report', 'message']),
  param('id').isMongoId(),
  body('status').isIn(['active', 'archived', 'removed']),
  body('moderationReason').optional().trim().isLength({ min: 1, max: 500 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { type, id } = req.params;
    const { status, moderationReason } = req.body;
    const adminId = req.user.userId;
    
    const updatedContent = await ModerationService.updateContentStatus({
      contentType: type,
      contentId: id,
      status,
      moderationReason,
      adminId
    });
    
    res.json({
      message: 'Content status updated successfully',
      content: updatedContent
    });
  } catch (error) {
    console.error('Error updating content status:', error);
    if (error.message === 'Content not found') {
      return res.status(404).json({ message: 'Content not found' });
    }
    if (error.message === 'Invalid content type') {
      return res.status(400).json({ message: 'Invalid content type' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   PATCH /api/moderation/content/:type/:id/edit
 * @desc    Edit content (admin use only)
 * @access  Admin
 */
router.patch('/content/:type/:id/edit', [
  requireAdmin, // Only admins can edit content
  param('type').isIn(['notice', 'report', 'message']),
  param('id').isMongoId(),
  body('updates').isObject(),
  body('moderationReason').optional().trim().isLength({ min: 1, max: 500 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { type, id } = req.params;
    const { updates, moderationReason } = req.body;
    const adminId = req.user.userId;
    
    const updatedContent = await ModerationService.editContent({
      contentType: type,
      contentId: id,
      updates,
      moderationReason,
      adminId
    });
    
    res.json({
      message: 'Content edited successfully',
      content: updatedContent
    });
  } catch (error) {
    console.error('Error editing content:', error);
    if (error.message === 'Content not found') {
      return res.status(404).json({ message: 'Content not found' });
    }
    if (error.message === 'Invalid content type') {
      return res.status(400).json({ message: 'Invalid content type' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   PATCH /api/moderation/content/:type/:id/approve
 * @desc    Approve content and clear all reports
 * @access  Admin/Moderator
 */
router.patch('/content/:type/:id/approve', [
  requireModerator, // Only moderators can approve content
  param('type').isIn(['notice', 'report', 'message']),
  param('id').isMongoId(),
  body('moderationReason').optional().trim().isLength({ min: 1, max: 500 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { type, id } = req.params;
    const { moderationReason } = req.body;
    const adminId = req.user.userId;
    
    const updatedContent = await ModerationService.approveContent({
      contentType: type,
      contentId: id,
      moderationReason,
      adminId
    });
    
    res.json({
      message: 'Content approved successfully',
      content: updatedContent
    });
  } catch (error) {
    console.error('Error approving content:', error);
    if (error.message === 'Content not found') {
      return res.status(404).json({ message: 'Content not found' });
    }
    if (error.message === 'Invalid content type') {
      return res.status(400).json({ message: 'Invalid content type' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   POST /api/moderation/content/:type/:id/restore
 * @desc    Restore content to active status
 * @access  Admin/Moderator
 */
router.post('/content/:type/:id/restore', [
  requireModerator, // Only moderators can restore content
  param('type').isIn(['notice', 'report', 'message']),
  param('id').isMongoId(),
  body('moderationReason').optional().trim().isLength({ min: 1, max: 500 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { type, id } = req.params;
    const { moderationReason } = req.body;
    const adminId = req.user.userId;
    
    const updatedContent = await ModerationService.restoreContent({
      contentType: type,
      contentId: id,
      moderationReason,
      adminId
    });
    
    res.json({
      message: 'Content restored successfully',
      content: updatedContent
    });
  } catch (error) {
    console.error('Error restoring content:', error);
    if (error.message === 'Content not found') {
      return res.status(404).json({ message: 'Content not found' });
    }
    if (error.message === 'Invalid content type') {
      return res.status(400).json({ message: 'Invalid content type' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/moderation/audit-logs
 * @desc    Get moderation audit logs
 * @access  Admin/Moderator
 */
router.get('/audit-logs', [
  requireModerator, // Only moderators can view audit logs
  query('action').optional().isIn(['content_moderate', 'content_edit', 'content_delete']),
  query('targetType').optional().isIn(['notice', 'report', 'chat']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('days').optional().isInt({ min: 1 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { action, targetType, page, limit, days } = req.query;
    
    const auditLogs = await AuditService.getAuditLogs({
      action,
      targetType,
      page: page || 1,
      limit: limit || 20,
      days: days || 30
    });
    
    res.json(auditLogs);
  } catch (error) {
    console.error('Error getting audit logs:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/moderation/debug
 * @desc    Debug endpoint to check content in database
 * @access  Admin/Moderator
 */
router.get('/debug', [
  requireModerator
], async (req, res) => {
  try {
    const Notice = require('../models/Notice');
    const Report = require('../models/Report');
    const Message = require('../models/Message');
    
    const noticeCount = await Notice.countDocuments();
    const reportCount = await Report.countDocuments();
    const messageCount = await Message.countDocuments();
    
    const flaggedNotices = await Notice.countDocuments({ isFlagged: true });
    const flaggedReports = await Report.countDocuments({ isFlagged: true });
    const flaggedMessages = await Message.countDocuments({ isFlagged: true });
    
    // Get sample flagged content
    const sampleFlaggedNotices = await Notice.find({ isFlagged: true }).limit(2).select('title isFlagged reports flaggedAt');
    const sampleFlaggedReports = await Report.find({ isFlagged: true }).limit(2).select('title isFlagged reports flaggedAt');
    
    // Test the exact query that ModerationService would use
    const testQuery = { isFlagged: true };
    const testNoticeCount = await Notice.countDocuments(testQuery);
    const testReportCount = await Report.countDocuments(testQuery);
    const testNotices = await Notice.find(testQuery).limit(2).select('title isFlagged reports');
    const testReports = await Report.find(testQuery).limit(2).select('title isFlagged reports');
    
    res.json({
      totals: {
        notices: noticeCount,
        reports: reportCount,
        messages: messageCount
      },
      flagged: {
        notices: flaggedNotices,
        reports: flaggedReports,
        messages: flaggedMessages
      },
      samples: {
        flaggedNotices: sampleFlaggedNotices,
        flaggedReports: sampleFlaggedReports
      },
      testQuery: {
        query: testQuery,
        noticeCount: testNoticeCount,
        reportCount: testReportCount,
        notices: testNotices,
        reports: testReports
      }
    });
  } catch (error) {
    console.error('Error in debug endpoint:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   POST /api/moderation/report
 * @desc    Report content for moderation
 * @access  Authenticated users
 */
router.post('/report', [
  requireActiveUser, // Only active users can report content
  body('contentType').isIn(['notice', 'report', 'message']),
  body('contentId').isMongoId(),
  body('reason').trim().isLength({ min: 1, max: 500 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { contentType, contentId, reason } = req.body;
    const reporterId = req.user.userId;
    
    const reportedContent = await ModerationService.reportContent({
      contentType,
      contentId,
      reason,
      reporterId
    });
    
    res.json({
      message: 'Content reported successfully',
      reportId: reportedContent._id
    });
  } catch (error) {
    console.error('Error reporting content:', error);
    if (error.message === 'Content not found') {
      return res.status(404).json({ message: 'Content not found' });
    }
    if (error.message === 'Content already reported by this user') {
      return res.status(409).json({ message: 'You have already reported this content' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;