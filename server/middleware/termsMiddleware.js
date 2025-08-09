/**
 * Terms and Conditions Middleware
 * Validates that users have accepted required terms before performing certain actions
 */
const TermsService = require('../services/TermsService');

/**
 * Middleware to check if user has accepted terms for notice board posts
 */
const requireNoticeBoardTerms = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const hasAccepted = await TermsService.hasAcceptedTerms(userId, 'noticeBoardTerms');
    
    if (!hasAccepted) {
      return res.status(403).json({
        success: false,
        message: 'You must accept the Notice Board Terms and Conditions before posting',
        code: 'TERMS_NOT_ACCEPTED',
        requiredTerms: 'noticeBoardTerms'
      });
    }

    next();
  } catch (error) {
    console.error('Error checking notice board terms:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify terms acceptance',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Middleware to check if user has accepted terms for reports
 */
const requireReportTerms = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const hasAccepted = await TermsService.hasAcceptedTerms(userId, 'reportTerms');
    
    if (!hasAccepted) {
      return res.status(403).json({
        success: false,
        message: 'You must accept the Community Reports Terms and Conditions before submitting a report',
        code: 'TERMS_NOT_ACCEPTED',
        requiredTerms: 'reportTerms'
      });
    }

    next();
  } catch (error) {
    console.error('Error checking report terms:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify terms acceptance',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Generic middleware factory to check terms for any action
 */
const requireTermsForAction = (action) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const permission = await TermsService.checkActionPermission(userId, action);
      
      if (!permission.allowed) {
        return res.status(403).json({
          success: false,
          message: permission.message,
          code: 'TERMS_NOT_ACCEPTED',
          requiredTerms: permission.requiredTerms,
          action: permission.action
        });
      }

      next();
    } catch (error) {
      console.error(`Error checking terms for action ${action}:`, error);
      res.status(500).json({
        success: false,
        message: 'Failed to verify terms acceptance',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  };
};

/**
 * Middleware to add terms acceptance status to request
 * This doesn't block the request but adds terms info for conditional logic
 */
const addTermsStatus = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    
    if (userId) {
      const termsStatus = await TermsService.getUserTermsStatus(userId);
      req.termsStatus = termsStatus;
    }

    next();
  } catch (error) {
    console.error('Error adding terms status to request:', error);
    // Don't fail the request, just continue without terms status
    next();
  }
};

/**
 * Middleware to validate terms acceptance in request body
 * Useful for endpoints that handle terms acceptance
 */
const validateTermsType = (req, res, next) => {
  const { termsType } = req.body || req.params;
  
  if (!termsType) {
    return res.status(400).json({
      success: false,
      message: 'Terms type is required'
    });
  }

  const validTermsTypes = ['noticeBoardTerms', 'reportTerms'];
  if (!validTermsTypes.includes(termsType)) {
    return res.status(400).json({
      success: false,
      message: `Invalid terms type. Must be one of: ${validTermsTypes.join(', ')}`
    });
  }

  next();
};

/**
 * Middleware to check if user can bypass terms (admin/moderator)
 * This should be used sparingly and only for administrative functions
 */
const canBypassTerms = (req, res, next) => {
  const userRole = req.user?.role;
  
  if (['admin', 'moderator'].includes(userRole)) {
    // Add flag to indicate terms can be bypassed
    req.canBypassTerms = true;
  }
  
  next();
};

/**
 * Combined middleware that checks terms but allows bypass for admins
 */
const requireTermsWithBypass = (termsType) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // Allow admins and moderators to bypass terms
      if (['admin', 'moderator'].includes(userRole)) {
        console.log(`User ${userId} (${userRole}) bypassing terms check for ${termsType}`);
        return next();
      }

      const hasAccepted = await TermsService.hasAcceptedTerms(userId, termsType);
      
      if (!hasAccepted) {
        const termsMessages = {
          noticeBoardTerms: 'You must accept the Notice Board Terms and Conditions before posting',
          reportTerms: 'You must accept the Community Reports Terms and Conditions before submitting a report'
        };

        return res.status(403).json({
          success: false,
          message: termsMessages[termsType] || 'You must accept the required terms and conditions',
          code: 'TERMS_NOT_ACCEPTED',
          requiredTerms: termsType
        });
      }

      next();
    } catch (error) {
      console.error(`Error checking terms ${termsType} with bypass:`, error);
      res.status(500).json({
        success: false,
        message: 'Failed to verify terms acceptance',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  };
};

module.exports = {
  requireNoticeBoardTerms,
  requireReportTerms,
  requireTermsForAction,
  addTermsStatus,
  validateTermsType,
  canBypassTerms,
  requireTermsWithBypass
};