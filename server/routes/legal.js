/**
 * Legal Documents API Routes
 * Handles legal document management and user acceptance tracking
 */
const express = require('express');
const router = express.Router();
const LegalDocumentService = require('../services/LegalDocumentService');
const { authenticateToken } = require('../middleware/auth');
const { requireActiveUser } = require('../middleware/adminAuth');

/**
 * Get active legal document by type
 * GET /api/legal/:type
 */
router.get('/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const document = await LegalDocumentService.getActiveDocument(type);
    
    res.json({
      success: true,
      data: document
    });
  } catch (error) {
    console.error('Error getting legal document:', error);
    
    if (error.message.includes('Invalid document type')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to get legal document',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * Get specific document version
 * GET /api/legal/:type/:version
 */
router.get('/:type/:version', async (req, res) => {
  try {
    const { type, version } = req.params;
    const document = await LegalDocumentService.getDocument(type, version);
    
    res.json({
      success: true,
      data: document
    });
  } catch (error) {
    console.error('Error getting document version:', error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to get document version',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * Get document history
 * GET /api/legal/:type/history
 */
router.get('/:type/history', authenticateToken, requireActiveUser, async (req, res) => {
  try {
    // Check if user is admin or moderator
    if (!['admin', 'moderator'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions to view document history'
      });
    }
    
    const { type } = req.params;
    const { limit } = req.query;
    
    const history = await LegalDocumentService.getDocumentHistory(type, limit ? parseInt(limit) : undefined);
    
    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Error getting document history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get document history',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * Create new legal document (admin only)
 * POST /api/legal/documents
 */
router.post('/documents', authenticateToken, requireActiveUser, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can create legal documents'
      });
    }
    
    const documentData = req.body;
    const createdBy = req.user.id;
    
    const document = await LegalDocumentService.createDocument(documentData, createdBy);
    
    res.status(201).json({
      success: true,
      message: 'Legal document created successfully',
      data: document
    });
  } catch (error) {
    console.error('Error creating legal document:', error);
    
    if (error.message.includes('required') || 
        error.message.includes('Invalid document type') ||
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
      message: 'Failed to create legal document',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * Update legal document (creates new version) (admin only)
 * PUT /api/legal/documents/:id
 */
router.put('/documents/:id', authenticateToken, requireActiveUser, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can update legal documents'
      });
    }
    
    const { id } = req.params;
    const updateData = req.body;
    const updatedBy = req.user.id;
    
    const document = await LegalDocumentService.updateDocument(id, updateData, updatedBy);
    
    res.json({
      success: true,
      message: 'Legal document updated successfully (new version created)',
      data: document
    });
  } catch (error) {
    console.error('Error updating legal document:', error);
    
    if (error.message.includes('required') || 
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
      message: 'Failed to update legal document',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * Activate document version (admin only)
 * POST /api/legal/documents/:id/activate
 */
router.post('/documents/:id/activate', authenticateToken, requireActiveUser, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can activate legal documents'
      });
    }
    
    const { id } = req.params;
    const activatedBy = req.user.id;
    
    const document = await LegalDocumentService.activateDocument(id, activatedBy);
    
    res.json({
      success: true,
      message: 'Legal document activated successfully',
      data: document
    });
  } catch (error) {
    console.error('Error activating legal document:', error);
    
    if (error.message.includes('required') || 
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
      message: 'Failed to activate legal document',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * Record user acceptance of legal document
 * POST /api/legal/accept
 */
router.post('/accept', authenticateToken, requireActiveUser, async (req, res) => {
  try {
    const { documentType, version } = req.body;
    const userId = req.user.id;
    
    if (!documentType) {
      return res.status(400).json({
        success: false,
        message: 'Document type is required'
      });
    }
    
    const acceptance = await LegalDocumentService.recordAcceptance(userId, documentType, version);
    
    res.json({
      success: true,
      message: 'Document acceptance recorded successfully',
      data: acceptance
    });
  } catch (error) {
    console.error('Error recording document acceptance:', error);
    
    if (error.message.includes('required')) {
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
      message: 'Failed to record document acceptance',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * Check user acceptance status
 * GET /api/legal/acceptance/:type
 */
router.get('/acceptance/:type', authenticateToken, requireActiveUser, async (req, res) => {
  try {
    const { type } = req.params;
    const userId = req.user.id;
    
    const acceptance = await LegalDocumentService.checkAcceptance(userId, type);
    
    res.json({
      success: true,
      data: acceptance
    });
  } catch (error) {
    console.error('Error checking document acceptance:', error);
    
    if (error.message.includes('required')) {
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
      message: 'Failed to check document acceptance',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * Get latest version of document type
 * GET /api/legal/:type/latest-version
 */
router.get('/:type/latest-version', async (req, res) => {
  try {
    const { type } = req.params;
    const version = await LegalDocumentService.getLatestVersion(type);
    
    res.json({
      success: true,
      data: {
        type,
        version
      }
    });
  } catch (error) {
    console.error('Error getting latest version:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get latest version',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * Search legal documents (admin only)
 * GET /api/legal/search
 */
router.get('/search', authenticateToken, requireActiveUser, async (req, res) => {
  try {
    // Check if user is admin or moderator
    if (!['admin', 'moderator'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions to search legal documents'
      });
    }
    
    const { q, type, active, dateFrom, dateTo, limit } = req.query;
    
    const filters = {
      type,
      active: active !== undefined ? active === 'true' : undefined,
      dateFrom,
      dateTo,
      limit: limit ? parseInt(limit) : undefined
    };
    
    const results = await LegalDocumentService.searchDocuments(q, filters);
    
    res.json({
      success: true,
      data: {
        query: q,
        filters,
        results,
        count: results.length
      }
    });
  } catch (error) {
    console.error('Error searching legal documents:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search legal documents',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;