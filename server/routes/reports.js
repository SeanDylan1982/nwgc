const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Report = require('../models/Report');
const User = require('../models/User');
const { requireRole } = require('../middleware/auth');
const { uploadConfigs, handleUploadError, cleanupFiles, formatFileInfo } = require('../middleware/upload');
const { requireTermsWithBypass } = require('../middleware/termsMiddleware');
const router = express.Router();

// Get all reports for user's neighbourhood
router.get('/', [
  query('category').optional().isIn(['security', 'traffic', 'maintenance', 'pets', 'noise', 'other']),
  query('status').optional().isIn(['open', 'in-progress', 'resolved', 'closed']),
  query('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { category, status, priority, limit = 50, offset = 0 } = req.query;
    const userId = req.user.userId;

    // Get user's neighbourhood with timeout and error handling
    const user = await User.findById(userId).select('neighbourhoodId').lean().maxTimeMS(5000);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const neighbourhoodId = user.neighbourhoodId;
    if (!neighbourhoodId) {
      return res.status(400).json({ message: 'User not assigned to a neighbourhood' });
    }

    // Build optimized query
    let queryFilter = {
      neighbourhoodId,
      reportStatus: 'active'
    };

    if (category) {
      queryFilter.category = category;
    }

    if (status) {
      queryFilter.status = status;
    }

    if (priority) {
      queryFilter.priority = priority;
    }

    // Use lean() for better performance and add timeout
    const reports = await Report.find(queryFilter)
      .populate('reporterId', 'firstName lastName', null, { lean: true })
      .select('-__v') // Exclude version field
      .sort({ isPinned: -1, createdAt: -1 }) // Sort by pinned first, then by creation date
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .lean()
      .maxTimeMS(8000); // 8 second timeout

    // Transform the data to ensure consistent structure
    const transformedReports = reports.map(report => ({
      _id: report._id,
      title: report.title,
      description: report.description,
      category: report.category,
      priority: report.priority || 'medium',
      status: report.status || 'open',
      location: report.location,
      neighbourhoodId: report.neighbourhoodId,
      reporterId: report.reporterId,
      isAnonymous: report.isAnonymous || false,
      media: report.media || [],
      likes: report.likes || [],
      comments: report.comments || [],
      viewCount: report.viewCount || 0,
      reportStatus: report.reportStatus,
      isPinned: report.isPinned || false,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt
    }));

    res.json(transformedReports);
  } catch (error) {
    console.error('Get reports error:', error);
    
    // Handle timeout errors specifically
    if (error.name === 'MongooseError' && error.message.includes('timeout')) {
      return res.status(504).json({ 
        message: 'Request timed out. Please try again.',
        error: 'timeout'
      });
    }
    
    res.status(500).json({ 
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get single report
router.get('/:id', async (req, res) => {
  try {
    const reportId = req.params.id;
    const userId = req.user.userId;

    // Get user's neighbourhood
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const neighbourhoodId = user.neighbourhoodId;

    // Get report
    const report = await Report.findOne({
      _id: reportId,
      neighbourhoodId,
      reportStatus: 'active'
    }).populate('reporterId', 'firstName lastName');

    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    // Increment view count
    await Report.findByIdAndUpdate(reportId, { $inc: { viewCount: 1 } });

    res.json({
      ...report.toObject(),
      viewCount: report.viewCount + 1
    });
  } catch (error) {
    console.error('Get report error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new report with media upload
router.post('/', uploadConfigs.media, [
  body('title').trim().isLength({ min: 1, max: 255 }),
  body('description').trim().isLength({ min: 1 }),
  body('category').isIn(['security', 'traffic', 'maintenance', 'pets', 'noise', 'other']),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
  body('location').optional().trim(),
  body('latitude').optional().isFloat({ min: -90, max: 90 }),
  body('longitude').optional().isFloat({ min: -180, max: 180 }),
  body('isAnonymous').optional().isBoolean(),
  body('incidentDate').optional().isISO8601()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      cleanupFiles(req.files);
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      title,
      description,
      category,
      priority = 'medium',
      location,
      latitude,
      longitude,
      isAnonymous = false,
      incidentDate
    } = req.body;

    const userId = req.user.userId;

    // Get user's neighbourhood
    const user = await User.findById(userId);
    if (!user) {
      cleanupFiles(req.files);
      return res.status(404).json({ message: 'User not found' });
    }

    const neighbourhoodId = user.neighbourhoodId;
    if (!neighbourhoodId) {
      cleanupFiles(req.files);
      return res.status(400).json({ message: 'User not assigned to a neighbourhood' });
    }

    // Process uploaded files
    const media = req.files ? req.files.map(file => formatFileInfo(file)) : [];

    // Create report
    const report = new Report({
      title,
      description,
      category,
      priority,
      location: location ? { address: location, coordinates: [longitude || 0, latitude || 0] } : undefined,
      neighbourhoodId,
      reporterId: userId,
      isAnonymous,
      incidentDate: incidentDate ? new Date(incidentDate) : null,
      media
    });

    await report.save();
    await report.populate('reporterId', 'firstName lastName');

    res.status(201).json(report);
  } catch (error) {
    cleanupFiles(req.files);
    console.error('Create report error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update report status (moderators/admins only)
router.patch('/:id/status', requireRole(['admin', 'moderator']), [
  body('status').isIn(['open', 'in-progress', 'resolved', 'closed']),
  body('assignedTo').optional().isMongoId()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const reportId = req.params.id;
    const { status, assignedTo } = req.body;
    const userId = req.user.userId;

    // Get user's neighbourhood
    const user = await User.findById(userId);
    const neighbourhoodId = user.neighbourhoodId;

    // Update report
    const report = await Report.findOneAndUpdate(
      { _id: reportId, neighbourhoodId },
      { status, assignedTo },
      { new: true }
    );

    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    res.json({ message: 'Report status updated successfully' });
  } catch (error) {
    console.error('Update report status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Pin report (admin only)
router.patch('/:id/pin', requireRole(['admin']), async (req, res) => {
  try {
    const reportId = req.params.id;
    const userId = req.user.userId;

    // Get user's neighbourhood
    const user = await User.findById(userId);
    const neighbourhoodId = user.neighbourhoodId;

    // Check if there are already 2 pinned reports
    const pinnedCount = await Report.countDocuments({
      neighbourhoodId,
      isPinned: true,
      reportStatus: 'active'
    });

    if (pinnedCount >= 2) {
      return res.status(400).json({ 
        message: 'Maximum of 2 reports can be pinned at once. Please unpin another report first.' 
      });
    }

    // Update report
    const report = await Report.findOneAndUpdate(
      { _id: reportId, neighbourhoodId, reportStatus: 'active' },
      { isPinned: true },
      { new: true }
    );

    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    res.json({ message: 'Report pinned successfully', isPinned: true });
  } catch (error) {
    console.error('Pin report error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Unpin report (admin only)
router.patch('/:id/unpin', requireRole(['admin']), async (req, res) => {
  try {
    const reportId = req.params.id;
    const userId = req.user.userId;

    // Get user's neighbourhood
    const user = await User.findById(userId);
    const neighbourhoodId = user.neighbourhoodId;

    // Update report
    const report = await Report.findOneAndUpdate(
      { _id: reportId, neighbourhoodId, reportStatus: 'active' },
      { isPinned: false },
      { new: true }
    );

    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    res.json({ message: 'Report unpinned successfully', isPinned: false });
  } catch (error) {
    console.error('Unpin report error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete report (admin only or report owner)
router.delete('/:id', async (req, res) => {
  try {
    const reportId = req.params.id;
    const userId = req.user.userId;

    // Get user info and report
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const report = await Report.findOne({
      _id: reportId,
      neighbourhoodId: user.neighbourhoodId
    });

    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    // Check permissions
    if (user.role !== 'admin' && report.reporterId.toString() !== userId) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    // Soft delete report
    report.reportStatus = 'removed';
    await report.save();

    res.json({ message: 'Report deleted successfully' });
  } catch (error) {
    console.error('Delete report error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Like/Unlike report
router.post('/:id/like', async (req, res) => {
  try {
    const reportId = req.params.id;
    const userId = req.user.userId;

    const report = await Report.findById(reportId);
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    const isLiked = report.likes.includes(userId);
    
    if (isLiked) {
      // Unlike
      report.likes = report.likes.filter(id => id.toString() !== userId);
    } else {
      // Like
      report.likes.push(userId);
    }

    await report.save();

    res.json({
      message: isLiked ? 'Report unliked' : 'Report liked',
      likes: report.likes.length,
      isLiked: !isLiked
    });
  } catch (error) {
    console.error('Like report error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add comment to report
router.post('/:id/comments', [
  body('content').trim().isLength({ min: 1, max: 500 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const reportId = req.params.id;
    const { content } = req.body;
    const userId = req.user.userId;

    const report = await Report.findById(reportId);
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    const comment = {
      userId,
      content,
      createdAt: new Date()
    };

    report.comments.push(comment);
    await report.save();

    await report.populate('comments.userId', 'firstName lastName');

    res.status(201).json({
      message: 'Comment added successfully',
      comment: report.comments[report.comments.length - 1]
    });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Apply error handling middleware
router.use(handleUploadError);

module.exports = router;