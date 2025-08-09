const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Notice = require('../models/Notice');
const User = require('../models/User');
const { requireRole } = require('../middleware/auth');
const { uploadConfigs, handleUploadError, cleanupFiles, formatFileInfo } = require('../middleware/upload');
const { requireTermsWithBypass } = require('../middleware/termsMiddleware');
const router = express.Router();

// Get all notices for user's neighbourhood
router.get('/', [
  query('category').optional().isIn(['safety', 'event', 'lost_found', 'general', 'emergency', 'maintenance']),
  query('priority').optional().isIn(['low', 'normal', 'high', 'urgent']),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { category, priority, limit = 20, offset = 0 } = req.query;
    const userId = req.user.userId;

    // Get user's neighbourhood
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const neighbourhoodId = user.neighbourhoodId;
    if (!neighbourhoodId) {
      return res.status(400).json({ message: 'User not assigned to a neighbourhood' });
    }

    // Build query
    let query = {
      neighbourhoodId,
      status: 'active',
      $or: [
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } }
      ]
    };

    if (category) {
      query.category = category;
    }

    if (priority) {
      query.priority = priority;
    }

    const notices = await Notice.find(query)
      .populate('authorId', 'firstName lastName')
      .sort({ isPinned: -1, createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));

    res.json(notices);
  } catch (error) {
    console.error('Get notices error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single notice
router.get('/:id', async (req, res) => {
  try {
    const noticeId = req.params.id;
    const userId = req.user.userId;

    // Get user's neighbourhood
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const neighbourhoodId = user.neighbourhoodId;

    // Get notice
    const notice = await Notice.findOne({
      _id: noticeId,
      neighbourhoodId,
      status: 'active'
    }).populate('authorId', 'firstName lastName');

    if (!notice) {
      return res.status(404).json({ message: 'Notice not found' });
    }

    // Increment view count
    await Notice.findByIdAndUpdate(noticeId, { $inc: { viewCount: 1 } });

    res.json({
      ...notice.toObject(),
      viewCount: notice.viewCount + 1
    });
  } catch (error) {
    console.error('Get notice error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new notice with media upload
router.post('/', uploadConfigs.media, [
  body('title').trim().isLength({ min: 1, max: 255 }),
  body('content').trim().isLength({ min: 1 }),
  body('category').isIn(['safety', 'event', 'lost_found', 'general', 'emergency', 'maintenance']),
  body('priority').optional().isIn(['low', 'normal', 'high', 'urgent']),
  body('expiresAt').optional().isISO8601(),
  body('isPinned').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // Clean up uploaded files on validation error
      cleanupFiles(req.files);
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      title,
      content,
      category,
      priority = 'normal',
      expiresAt,
      isPinned = false
    } = req.body;

    const userId = req.user.userId;

    // Get user's neighbourhood and role
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

    // Check permissions for pinned notices and emergency category
    if (isPinned && !['admin', 'moderator'].includes(user.role)) {
      cleanupFiles(req.files);
      return res.status(403).json({ message: 'Only admins and moderators can pin notices' });
    }

    if (category === 'emergency' && !['admin', 'moderator'].includes(user.role)) {
      cleanupFiles(req.files);
      return res.status(403).json({ message: 'Only admins and moderators can create emergency notices' });
    }

    // Process uploaded files
    const media = req.files ? req.files.map(file => formatFileInfo(file)) : [];

    // Create notice
    const notice = new Notice({
      title,
      content,
      category,
      priority,
      neighbourhoodId,
      authorId: userId,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      isPinned,
      media
    });

    await notice.save();
    await notice.populate('authorId', 'firstName lastName');

    res.status(201).json(notice);
  } catch (error) {
    // Clean up uploaded files on error
    cleanupFiles(req.files);
    console.error('Create notice error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update notice (author or moderator/admin)
router.put('/:id', uploadConfigs.media, [
  body('title').optional().trim().isLength({ min: 1, max: 255 }),
  body('content').optional().trim().isLength({ min: 1 }),
  body('category').optional().isIn(['safety', 'event', 'lost_found', 'general', 'emergency', 'maintenance']),
  body('priority').optional().isIn(['low', 'normal', 'high', 'urgent']),
  body('expiresAt').optional().isISO8601(),
  body('isPinned').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      cleanupFiles(req.files);
      return res.status(400).json({ errors: errors.array() });
    }

    const noticeId = req.params.id;
    const updateData = req.body;
    const userId = req.user.userId;

    // Get user info and notice
    const user = await User.findById(userId);
    if (!user) {
      cleanupFiles(req.files);
      return res.status(404).json({ message: 'User not found' });
    }

    const notice = await Notice.findOne({
      _id: noticeId,
      neighbourhoodId: user.neighbourhoodId
    });

    if (!notice) {
      cleanupFiles(req.files);
      return res.status(404).json({ message: 'Notice not found' });
    }

    // Check permissions
    const isAuthor = notice.authorId.toString() === userId;
    const isModerator = ['admin', 'moderator'].includes(user.role);

    if (!isAuthor && !isModerator) {
      cleanupFiles(req.files);
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    // Check specific permissions
    if (updateData.isPinned !== undefined && !isModerator) {
      cleanupFiles(req.files);
      return res.status(403).json({ message: 'Only moderators can pin/unpin notices' });
    }

    if (updateData.category === 'emergency' && !isModerator) {
      cleanupFiles(req.files);
      return res.status(403).json({ message: 'Only moderators can create emergency notices' });
    }

    // Process new uploaded files
    if (req.files && req.files.length > 0) {
      const newMedia = req.files.map(file => formatFileInfo(file));
      updateData.media = [...(notice.media || []), ...newMedia];
    }

    // Update notice
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        notice[key] = updateData[key];
      }
    });

    await notice.save();

    res.json({ message: 'Notice updated successfully' });
  } catch (error) {
    cleanupFiles(req.files);
    console.error('Update notice error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete notice (author or admin)
router.delete('/:id', async (req, res) => {
  try {
    const noticeId = req.params.id;
    const userId = req.user.userId;

    // Get user info and notice
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const notice = await Notice.findOne({
      _id: noticeId,
      neighbourhoodId: user.neighbourhoodId
    });

    if (!notice) {
      return res.status(404).json({ message: 'Notice not found' });
    }

    // Check permissions
    if (notice.authorId.toString() !== userId && user.role !== 'admin') {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    // Soft delete notice
    notice.status = 'removed';
    await notice.save();

    res.json({ message: 'Notice deleted successfully' });
  } catch (error) {
    console.error('Delete notice error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Pin notice (admin only)
router.patch('/:id/pin', requireRole(['admin']), async (req, res) => {
  try {
    const noticeId = req.params.id;
    const userId = req.user.userId;

    // Get user's neighbourhood
    const user = await User.findById(userId);
    const neighbourhoodId = user.neighbourhoodId;

    // Check if there are already 2 pinned notices
    const pinnedCount = await Notice.countDocuments({
      neighbourhoodId,
      isPinned: true,
      status: 'active'
    });

    if (pinnedCount >= 2) {
      return res.status(400).json({ 
        message: 'Maximum of 2 notices can be pinned at once. Please unpin another notice first.' 
      });
    }

    // Update notice
    const notice = await Notice.findOneAndUpdate(
      { _id: noticeId, neighbourhoodId, status: 'active' },
      { isPinned: true },
      { new: true }
    );

    if (!notice) {
      return res.status(404).json({ message: 'Notice not found' });
    }

    res.json({ message: 'Notice pinned successfully', isPinned: true });
  } catch (error) {
    console.error('Pin notice error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Unpin notice (admin only)
router.patch('/:id/unpin', requireRole(['admin']), async (req, res) => {
  try {
    const noticeId = req.params.id;
    const userId = req.user.userId;

    // Get user's neighbourhood
    const user = await User.findById(userId);
    const neighbourhoodId = user.neighbourhoodId;

    // Update notice
    const notice = await Notice.findOneAndUpdate(
      { _id: noticeId, neighbourhoodId, status: 'active' },
      { isPinned: false },
      { new: true }
    );

    if (!notice) {
      return res.status(404).json({ message: 'Notice not found' });
    }

    res.json({ message: 'Notice unpinned successfully', isPinned: false });
  } catch (error) {
    console.error('Unpin notice error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Like/Unlike notice
router.post('/:id/like', async (req, res) => {
  try {
    const noticeId = req.params.id;
    const userId = req.user.userId;

    const notice = await Notice.findById(noticeId);
    if (!notice) {
      return res.status(404).json({ message: 'Notice not found' });
    }

    const isLiked = notice.likes.includes(userId);
    
    if (isLiked) {
      // Unlike
      notice.likes = notice.likes.filter(id => id.toString() !== userId);
    } else {
      // Like
      notice.likes.push(userId);
    }

    await notice.save();

    res.json({
      message: isLiked ? 'Notice unliked' : 'Notice liked',
      likes: notice.likes.length,
      isLiked: !isLiked
    });
  } catch (error) {
    console.error('Like notice error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add comment to notice
router.post('/:id/comments', [
  body('content').trim().isLength({ min: 1, max: 500 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const noticeId = req.params.id;
    const { content } = req.body;
    const userId = req.user.userId;

    const notice = await Notice.findById(noticeId);
    if (!notice) {
      return res.status(404).json({ message: 'Notice not found' });
    }

    const comment = {
      author: userId,
      content,
      createdAt: new Date()
    };

    notice.comments.push(comment);
    await notice.save();

    await notice.populate('comments.author', 'firstName lastName');

    res.status(201).json({
      message: 'Comment added successfully',
      comment: notice.comments[notice.comments.length - 1]
    });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Apply error handling middleware
router.use(handleUploadError);

module.exports = router;