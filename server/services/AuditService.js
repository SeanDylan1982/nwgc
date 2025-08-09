const AuditLog = require('../models/AuditLog');

/**
 * Service for handling audit logging
 */
class AuditService {
  /**
   * Log an admin action
   * @param {Object} logData - The log data
   * @param {string} logData.adminId - The ID of the admin performing the action
   * @param {string} logData.action - The action being performed
   * @param {string} logData.targetType - The type of target (user, notice, etc.)
   * @param {string} logData.targetId - The ID of the target
   * @param {Object} logData.details - Additional details about the action
   * @param {string} logData.ipAddress - The IP address of the admin
   * @param {string} logData.userAgent - The user agent of the admin
   * @returns {Promise<Object>} The created audit log
   */
  static async logAction(logData) {
    try {
      const auditLog = new AuditLog({
        adminId: logData.adminId,
        action: logData.action,
        targetType: logData.targetType,
        targetId: logData.targetId,
        details: logData.details || {},
        ipAddress: logData.ipAddress,
        userAgent: logData.userAgent
      });

      return await auditLog.save();
    } catch (error) {
      console.error('Error creating audit log:', error);
      // Don't throw, just return null - audit logging should not break functionality
      return null;
    }
  }

  /**
   * Get audit logs with filtering and pagination
   * @param {Object} options - Query options
   * @param {number} options.page - Page number (1-based)
   * @param {number} options.limit - Number of items per page
   * @param {string} options.action - Filter by action type
   * @param {string} options.targetType - Filter by target type
   * @param {string} options.adminId - Filter by admin ID
   * @param {string} options.targetId - Filter by target ID
   * @param {number} options.days - Number of days to look back
   * @returns {Promise<Object>} Paginated audit logs
   */
  static async getAuditLogs(options) {
    try {
      const {
        page = 1,
        limit = 10,
        action,
        targetType,
        adminId,
        targetId,
        days
      } = options;

      const query = {};

      // Apply filters if provided
      if (action) query.action = action;
      if (targetType) query.targetType = targetType;
      if (adminId) query.adminId = adminId;
      if (targetId) query.targetId = targetId;
      
      // Apply date filter if days provided
      if (days) {
        const dateFilter = new Date();
        dateFilter.setDate(dateFilter.getDate() - parseInt(days));
        query.createdAt = { $gte: dateFilter };
      }

      // Count total matching documents
      const total = await AuditLog.countDocuments(query);
      
      // Calculate pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const totalPages = Math.ceil(total / parseInt(limit));

      // Get paginated results
      const logs = await AuditLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('adminId', 'firstName lastName email')
        .lean();

      return {
        logs,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages
      };
    } catch (error) {
      console.error('Error getting audit logs:', error);
      throw error;
    }
  }
}

module.exports = AuditService;