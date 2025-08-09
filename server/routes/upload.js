const express = require('express');
const { uploadConfigs, handleUploadError, cleanupFiles, formatFileInfo } = require('../middleware/upload');
const { authenticateToken } = require('../middleware/auth');
const User = require('../models/User');
const router = express.Router();

// Profile image upload
router.post('/profile-image', uploadConfigs.profileImage, async (req, res) => {
  try {
    console.log('=== Profile image upload request received ===');
    console.log('Headers:', req.headers);
    console.log('User:', req.user);
    console.log('File:', req.file);
    console.log('Body:', req.body);

    if (!req.user || !req.user.userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const fileInfo = formatFileInfo(req.file);
    console.log('File info:', fileInfo);
    
    // Update user's profile image URL
    const updatedUser = await User.findByIdAndUpdate(
      req.user.userId, 
      { profileImageUrl: fileInfo.url },
      { new: true }
    );

    console.log('User updated with new profile image:', updatedUser?.profileImageUrl);

    res.json({
      success: true,
      message: 'Profile image uploaded successfully',
      file: fileInfo,
      user: {
        profileImageUrl: updatedUser.profileImageUrl
      }
    });
  } catch (error) {
    // Clean up uploaded file on error
    cleanupFiles(req.file);
    console.error('Profile image upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload profile image',
      error: error.message
    });
  }
});

// Media upload for notices/reports
router.post('/media', uploadConfigs.media, async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    const filesInfo = req.files.map(file => formatFileInfo(file));

    res.json({
      success: true,
      message: `${req.files.length} file(s) uploaded successfully`,
      files: filesInfo
    });
  } catch (error) {
    // Clean up uploaded files on error
    cleanupFiles(req.files);
    console.error('Media upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload media files'
    });
  }
});

// Single file upload for messages
router.post('/message-file', uploadConfigs.messageFile, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const fileInfo = formatFileInfo(req.file);

    res.json({
      success: true,
      message: 'File uploaded successfully',
      file: fileInfo
    });
  } catch (error) {
    // Clean up uploaded file on error
    cleanupFiles(req.file);
    console.error('Message file upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload file'
    });
  }
});

// Get uploaded file (with basic access control)
router.get('/file/*', (req, res) => {
  try {
    const filePath = req.params[0];
    const fullPath = `uploads/${filePath}`;
    
    // Basic security check - ensure path doesn't contain '..'
    if (filePath.includes('..')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if file exists
    const fs = require('fs');
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Send file
    res.sendFile(fullPath, { root: '.' });
  } catch (error) {
    console.error('File access error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to access file'
    });
  }
});

// Delete uploaded file
router.delete('/file/*', async (req, res) => {
  try {
    const filePath = req.params[0];
    const fullPath = `uploads/${filePath}`;
    
    // Basic security check
    if (filePath.includes('..')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const fs = require('fs');
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      res.json({
        success: true,
        message: 'File deleted successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }
  } catch (error) {
    console.error('File deletion error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete file'
    });
  }
});

// Apply error handling middleware
router.use(handleUploadError);

module.exports = router;