/**
 * TermsService.js
 * Service for managing terms and conditions acceptance tracking
 * Implements comprehensive error handling and validation following the app's patterns
 */
const User = require('../models/User');

class TermsService {
  /**
   * Check if user has accepted specific terms
   * @param {string} userId - User ID
   * @param {string} termsType - Type of terms ('noticeBoardTerms' or 'reportTerms')
   * @returns {Promise<boolean>} - Whether user has accepted the terms
   */
  async hasAcceptedTerms(userId, termsType) {
    try {
      if (!userId || !termsType) {
        throw new Error('User ID and terms type are required');
      }

      const validTermsTypes = ['noticeBoardTerms', 'reportTerms'];
      if (!validTermsTypes.includes(termsType)) {
        throw new Error(`Invalid terms type. Must be one of: ${validTermsTypes.join(', ')}`);
      }

      const user = await User.findById(userId).select(`legalAcceptance.${termsType}`);
      if (!user) {
        throw new Error('User not found');
      }

      const termsAcceptance = user.legalAcceptance?.[termsType];
      return termsAcceptance?.accepted === true;
    } catch (error) {
      console.error(`Error checking terms acceptance for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Record terms acceptance for a user
   * @param {string} userId - User ID
   * @param {string} termsType - Type of terms ('noticeBoardTerms' or 'reportTerms')
   * @returns {Promise<Object>} - Updated user document
   */
  async acceptTerms(userId, termsType) {
    try {
      if (!userId || !termsType) {
        throw new Error('User ID and terms type are required');
      }

      const validTermsTypes = ['noticeBoardTerms', 'reportTerms'];
      if (!validTermsTypes.includes(termsType)) {
        throw new Error(`Invalid terms type. Must be one of: ${validTermsTypes.join(', ')}`);
      }

      // Check if user exists
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Check if already accepted
      const currentAcceptance = user.legalAcceptance?.[termsType];
      if (currentAcceptance?.accepted === true) {
        console.log(`User ${userId} has already accepted ${termsType}`);
        return {
          success: true,
          message: 'Terms already accepted',
          alreadyAccepted: true,
          timestamp: currentAcceptance.timestamp
        };
      }

      // Record acceptance
      const updateData = {
        [`legalAcceptance.${termsType}.accepted`]: true,
        [`legalAcceptance.${termsType}.timestamp`]: new Date()
      };

      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $set: updateData },
        { new: true, runValidators: true }
      ).select(`legalAcceptance.${termsType}`);

      if (!updatedUser) {
        throw new Error('Failed to update user terms acceptance');
      }

      console.log(`User ${userId} accepted ${termsType} at ${new Date().toISOString()}`);

      return {
        success: true,
        message: 'Terms accepted successfully',
        alreadyAccepted: false,
        timestamp: updatedUser.legalAcceptance[termsType].timestamp
      };
    } catch (error) {
      console.error(`Error accepting terms for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get all terms acceptance status for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - Terms acceptance status
   */
  async getUserTermsStatus(userId) {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }

      const user = await User.findById(userId).select('legalAcceptance');
      if (!user) {
        throw new Error('User not found');
      }

      const legalAcceptance = user.legalAcceptance || {};

      return {
        noticeBoardTerms: {
          accepted: legalAcceptance.noticeBoardTerms?.accepted === true,
          timestamp: legalAcceptance.noticeBoardTerms?.timestamp || null
        },
        reportTerms: {
          accepted: legalAcceptance.reportTerms?.accepted === true,
          timestamp: legalAcceptance.reportTerms?.timestamp || null
        }
      };
    } catch (error) {
      console.error(`Error getting terms status for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Check if user can perform an action based on terms acceptance
   * @param {string} userId - User ID
   * @param {string} action - Action type ('createNotice' or 'createReport')
   * @returns {Promise<Object>} - Permission status and required terms
   */
  async checkActionPermission(userId, action) {
    try {
      if (!userId || !action) {
        throw new Error('User ID and action are required');
      }

      const actionTermsMap = {
        createNotice: 'noticeBoardTerms',
        createReport: 'reportTerms'
      };

      const requiredTerms = actionTermsMap[action];
      if (!requiredTerms) {
        throw new Error(`Invalid action. Must be one of: ${Object.keys(actionTermsMap).join(', ')}`);
      }

      const hasAccepted = await this.hasAcceptedTerms(userId, requiredTerms);

      return {
        allowed: hasAccepted,
        requiredTerms,
        action,
        message: hasAccepted 
          ? 'Action permitted' 
          : `Must accept ${requiredTerms} before performing this action`
      };
    } catch (error) {
      console.error(`Error checking action permission for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Bulk check terms acceptance for multiple users
   * @param {Array<string>} userIds - Array of user IDs
   * @param {string} termsType - Type of terms to check
   * @returns {Promise<Object>} - Map of user IDs to acceptance status
   */
  async bulkCheckTermsAcceptance(userIds, termsType) {
    try {
      if (!Array.isArray(userIds) || userIds.length === 0) {
        throw new Error('User IDs array is required and must not be empty');
      }

      if (!termsType) {
        throw new Error('Terms type is required');
      }

      const validTermsTypes = ['noticeBoardTerms', 'reportTerms'];
      if (!validTermsTypes.includes(termsType)) {
        throw new Error(`Invalid terms type. Must be one of: ${validTermsTypes.join(', ')}`);
      }

      const users = await User.find({
        _id: { $in: userIds }
      }).select(`_id legalAcceptance.${termsType}`);

      const acceptanceMap = {};
      
      // Initialize all users as not accepted
      userIds.forEach(userId => {
        acceptanceMap[userId] = {
          accepted: false,
          timestamp: null,
          found: false
        };
      });

      // Update with actual data
      users.forEach(user => {
        const termsAcceptance = user.legalAcceptance?.[termsType];
        acceptanceMap[user._id.toString()] = {
          accepted: termsAcceptance?.accepted === true,
          timestamp: termsAcceptance?.timestamp || null,
          found: true
        };
      });

      return acceptanceMap;
    } catch (error) {
      console.error('Error in bulk terms acceptance check:', error);
      throw error;
    }
  }

  /**
   * Get terms acceptance statistics
   * @param {string} termsType - Type of terms to get stats for
   * @returns {Promise<Object>} - Terms acceptance statistics
   */
  async getTermsAcceptanceStats(termsType) {
    try {
      if (!termsType) {
        throw new Error('Terms type is required');
      }

      const validTermsTypes = ['noticeBoardTerms', 'reportTerms'];
      if (!validTermsTypes.includes(termsType)) {
        throw new Error(`Invalid terms type. Must be one of: ${validTermsTypes.join(', ')}`);
      }

      const [totalUsers, acceptedUsers] = await Promise.all([
        User.countDocuments({ isActive: true }),
        User.countDocuments({
          isActive: true,
          [`legalAcceptance.${termsType}.accepted`]: true
        })
      ]);

      const acceptanceRate = totalUsers > 0 ? (acceptedUsers / totalUsers) * 100 : 0;

      return {
        termsType,
        totalUsers,
        acceptedUsers,
        notAcceptedUsers: totalUsers - acceptedUsers,
        acceptanceRate: Math.round(acceptanceRate * 100) / 100, // Round to 2 decimal places
        timestamp: new Date()
      };
    } catch (error) {
      console.error(`Error getting terms acceptance stats for ${termsType}:`, error);
      throw error;
    }
  }

  /**
   * Reset terms acceptance for a user (admin function)
   * @param {string} userId - User ID
   * @param {string} termsType - Type of terms to reset
   * @param {string} adminId - Admin user ID performing the action
   * @returns {Promise<Object>} - Reset result
   */
  async resetTermsAcceptance(userId, termsType, adminId) {
    try {
      if (!userId || !termsType || !adminId) {
        throw new Error('User ID, terms type, and admin ID are required');
      }

      const validTermsTypes = ['noticeBoardTerms', 'reportTerms'];
      if (!validTermsTypes.includes(termsType)) {
        throw new Error(`Invalid terms type. Must be one of: ${validTermsTypes.join(', ')}`);
      }

      // Verify admin permissions
      const admin = await User.findById(adminId).select('role');
      if (!admin || !['admin', 'moderator'].includes(admin.role)) {
        throw new Error('Insufficient permissions to reset terms acceptance');
      }

      // Check if user exists
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Reset terms acceptance
      const updateData = {
        [`legalAcceptance.${termsType}.accepted`]: false,
        [`legalAcceptance.${termsType}.timestamp`]: null
      };

      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $set: updateData },
        { new: true, runValidators: true }
      ).select(`legalAcceptance.${termsType}`);

      if (!updatedUser) {
        throw new Error('Failed to reset user terms acceptance');
      }

      console.log(`Admin ${adminId} reset ${termsType} acceptance for user ${userId}`);

      return {
        success: true,
        message: 'Terms acceptance reset successfully',
        resetBy: adminId,
        timestamp: new Date()
      };
    } catch (error) {
      console.error(`Error resetting terms acceptance for user ${userId}:`, error);
      throw error;
    }
  }
}

module.exports = new TermsService();