const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

/**
 * Middleware to verify admin permissions
 * This middleware should be used after the authenticateToken middleware
 */
const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin privileges required' });
    }

    // Log admin access (optional, can be enabled in production)
    if (process.env.LOG_ADMIN_ACCESS === 'true') {
      await logAdminAccess(req);
    }

    next();
  } catch (error) {
    console.error('Admin auth middleware error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Middleware to verify moderator or admin permissions
 * This middleware should be used after the authenticateToken middleware
 */
const requireModerator = async (req, res, next) => {
  try {
    console.log('=== REQUIRE MODERATOR MIDDLEWARE ===');
    console.log('req.user:', req.user);
    
    if (!req.user) {
      console.log('❌ No user in request - authentication failed');
      return res.status(401).json({ message: 'Authentication required' });
    }

    console.log('User role:', req.user.role);
    console.log('Allowed roles:', ['admin', 'moderator']);
    console.log('Role check result:', ['admin', 'moderator'].includes(req.user.role));

    if (!['admin', 'moderator'].includes(req.user.role)) {
      console.log('❌ User role not authorized for moderation');
      return res.status(403).json({ message: 'Moderator privileges required' });
    }

    console.log('✅ User authorized for moderation');
    next();
  } catch (error) {
    console.error('Moderator auth middleware error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Middleware to check if user is active (not suspended or banned)
 * This middleware should be used after the authenticateToken middleware
 */
const requireActiveUser = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const user = await User.findById(req.user.userId).select('status');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ 
        message: 'Your account has been suspended. Please contact an administrator.'
      });
    }

    if (user.status === 'banned') {
      return res.status(403).json({ 
        message: 'Your account has been banned. Access to this system is no longer permitted.'
      });
    }

    next();
  } catch (error) {
    console.error('Active user middleware error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Helper function to log admin access to the audit log
 */
const logAdminAccess = async (req) => {
  try {
    const auditLog = new AuditLog({
      adminId: req.user.userId,
      action: 'admin_login',
      targetType: 'system',
      targetId: req.user.userId, // Using admin's own ID as target
      details: {
        endpoint: req.originalUrl,
        method: req.method
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    await auditLog.save();
  } catch (error) {
    console.error('Error logging admin access:', error);
    // Don't block the request if logging fails
  }
};

module.exports = {
  requireAdmin,
  requireModerator,
  requireActiveUser,
  logAdminAccess
};