/**
 * Terms and Conditions API Routes
 * Handles terms acceptance tracking and validation
 */
const express = require('express');
const router = express.Router();
const TermsService = require('../services/TermsService');
const { authenticateToken } = require('../middleware/auth');
const { requireActiveUser } = require('../middleware/adminAuth');

/**
 * Get user's terms acceptance status
 * GET /api/terms/status
 */
router.get('/status', authenticateToken, requireActiveUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const termsStatus = await TermsService.getUserTermsStatus(userId);
    
    res.json({
      success: true,
      data: termsStatus
    });
  } catch (error) {
    console.error('Error getting terms status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get terms status',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * Check if user has accepted specific terms
 * GET /api/terms/check/:termsType
 */
router.get('/check/:termsType', authenticateToken, requireActiveUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const { termsType } = req.params;
    
    const hasAccepted = await TermsService.hasAcceptedTerms(userId, termsType);
    
    res.json({
      success: true,
      data: {
        termsType,
        accepted: hasAccepted
      }
    });
  } catch (error) {
    console.error('Error checking terms acceptance:', error);
    
    if (error.message.includes('Invalid terms type')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to check terms acceptance',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * Accept terms and conditions
 * POST /api/terms/accept
 */
router.post('/accept', authenticateToken, requireActiveUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const { termsType } = req.body;
    
    if (!termsType) {
      return res.status(400).json({
        success: false,
        message: 'Terms type is required'
      });
    }
    
    const result = await TermsService.acceptTerms(userId, termsType);
    
    res.json({
      success: true,
      message: result.message,
      data: {
        termsType,
        accepted: true,
        alreadyAccepted: result.alreadyAccepted,
        timestamp: result.timestamp
      }
    });
  } catch (error) {
    console.error('Error accepting terms:', error);
    
    if (error.message.includes('Invalid terms type') || error.message.includes('required')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to accept terms',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * Check permission for specific action
 * GET /api/terms/permission/:action
 */
router.get('/permission/:action', authenticateToken, requireActiveUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const { action } = req.params;
    
    const permission = await TermsService.checkActionPermission(userId, action);
    
    res.json({
      success: true,
      data: permission
    });
  } catch (error) {
    console.error('Error checking action permission:', error);
    
    if (error.message.includes('Invalid action')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to check action permission',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * Get terms acceptance statistics (admin only)
 * GET /api/terms/stats/:termsType
 */
router.get('/stats/:termsType', authenticateToken, requireActiveUser, async (req, res) => {
  try {
    // Check if user is admin or moderator
    if (!['admin', 'moderator'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions to view terms statistics'
      });
    }
    
    const { termsType } = req.params;
    const stats = await TermsService.getTermsAcceptanceStats(termsType);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting terms stats:', error);
    
    if (error.message.includes('Invalid terms type')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to get terms statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * Reset terms acceptance for a user (admin only)
 * POST /api/terms/reset
 */
router.post('/reset', authenticateToken, requireActiveUser, async (req, res) => {
  try {
    // Check if user is admin or moderator
    if (!['admin', 'moderator'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions to reset terms acceptance'
      });
    }
    
    const adminId = req.user.id;
    const { userId, termsType } = req.body;
    
    if (!userId || !termsType) {
      return res.status(400).json({
        success: false,
        message: 'User ID and terms type are required'
      });
    }
    
    const result = await TermsService.resetTermsAcceptance(userId, termsType, adminId);
    
    res.json({
      success: true,
      message: result.message,
      data: {
        userId,
        termsType,
        resetBy: adminId,
        timestamp: result.timestamp
      }
    });
  } catch (error) {
    console.error('Error resetting terms acceptance:', error);
    
    if (error.message.includes('Invalid terms type') || 
        error.message.includes('required') ||
        error.message.includes('Insufficient permissions')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to reset terms acceptance',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * Bulk check terms acceptance (admin only)
 * POST /api/terms/bulk-check
 */
router.post('/bulk-check', authenticateToken, requireActiveUser, async (req, res) => {
  try {
    // Check if user is admin or moderator
    if (!['admin', 'moderator'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions to perform bulk check'
      });
    }
    
    const { userIds, termsType } = req.body;
    
    if (!Array.isArray(userIds) || !termsType) {
      return res.status(400).json({
        success: false,
        message: 'User IDs array and terms type are required'
      });
    }
    
    const acceptanceMap = await TermsService.bulkCheckTermsAcceptance(userIds, termsType);
    
    res.json({
      success: true,
      data: {
        termsType,
        acceptanceMap,
        totalChecked: userIds.length
      }
    });
  } catch (error) {
    console.error('Error in bulk terms check:', error);
    
    if (error.message.includes('Invalid terms type') || 
        error.message.includes('required')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to perform bulk terms check',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;