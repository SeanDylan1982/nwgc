/**
 * SearchService.js
 * 
 * Comprehensive search service that implements MongoDB text search and aggregation
 * for searching across users, notices, reports, and chats.
 * Provides autocomplete functionality with grouped results.
 */

const User = require('../models/User');
const Notice = require('../models/Notice');
const Report = require('../models/Report');
const ChatGroup = require('../models/ChatGroup');
const PrivateChat = require('../models/PrivateChat');
const Message = require('../models/Message');
const { executeQuery } = require('../utils/dbOperationWrapper');

class SearchService {
  /**
   * Search across all entities with grouped results
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @param {string} options.userId - Current user ID
   * @param {string} options.neighbourhoodId - User's neighbourhood ID
   * @param {number} options.limit - Maximum results per category
   * @param {boolean} options.autocomplete - Whether to return autocomplete results
   * @returns {Promise<Object>} Grouped search results
   */
  async searchAll(query, options = {}) {
    const { 
      userId, 
      neighbourhoodId, 
      limit = 5,
      autocomplete = false
    } = options;

    if (!query || query.trim().length === 0) {
      return {
        users: [],
        notices: [],
        reports: [],
        chats: [],
        messages: []
      };
    }

    // Prepare search query
    const searchQuery = this._prepareSearchQuery(query, autocomplete);
    
    // Execute searches in parallel for better performance
    const [users, notices, reports, chats, messages] = await Promise.all([
      this.searchUsers(searchQuery, { userId, neighbourhoodId, limit }),
      this.searchNotices(searchQuery, { userId, neighbourhoodId, limit }),
      this.searchReports(searchQuery, { userId, neighbourhoodId, limit }),
      this.searchChats(searchQuery, { userId, neighbourhoodId, limit }),
      this.searchMessages(searchQuery, { userId, neighbourhoodId, limit })
    ]);

    return {
      users,
      notices,
      reports,
      chats,
      messages
    };
  }

  /**
   * Search for users
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} User search results
   */
  async searchUsers(query, options = {}) {
    const { 
      userId, 
      neighbourhoodId, 
      limit = 10,
      sortBy = 'score'
    } = options;

    if (!query || query.trim().length === 0) {
      return [];
    }

    // Prepare search query
    const searchQuery = this._prepareSearchQuery(query);
    
    // Build search pipeline using regex only (no text index required)
    const pipeline = [
      // Filter by neighbourhood and user constraints first
      {
        $match: {
          neighbourhoodId,
          _id: { $ne: userId }, // Exclude current user
          isActive: true,
          status: 'active'
        }
      },
      // Then apply search filters
      {
        $match: {
          $or: [
            { firstName: { $regex: searchQuery, $options: 'i' } },
            { lastName: { $regex: searchQuery, $options: 'i' } },
            { email: { $regex: searchQuery, $options: 'i' } }
          ]
        }
      },
      // Add relevance score based on field matches
      {
        $addFields: {
          score: {
            $add: [
              { $cond: [{ $regexMatch: { input: "$firstName", regex: searchQuery, options: "i" } }, 3, 0] },
              { $cond: [{ $regexMatch: { input: "$lastName", regex: searchQuery, options: "i" } }, 3, 0] },
              { $cond: [{ $regexMatch: { input: "$email", regex: searchQuery, options: "i" } }, 1, 0] }
            ]
          }
        }
      },
      // Sort by score or other fields
      {
        $sort: sortBy === 'score' 
          ? { score: -1, firstName: 1, lastName: 1 } 
          : { firstName: 1, lastName: 1 }
      },
      // Limit results
      { $limit: limit },
      // Project only needed fields
      {
        $project: {
          _id: 1,
          firstName: 1,
          lastName: 1,
          email: 1,
          profileImageUrl: 1,
          role: 1,
          score: 1
        }
      }
    ];

    // Execute search with error handling
    return executeQuery(
      async () => {
        return User.aggregate(pipeline);
      },
      {
        operationName: 'Search users',
        timeout: 10000,
        metadata: { query, neighbourhoodId, limit }
      }
    );
  }

  /**
   * Search for notices
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Notice search results
   */
  async searchNotices(query, options = {}) {
    const { 
      neighbourhoodId, 
      limit = 10,
      sortBy = 'score'
    } = options;

    if (!query || query.trim().length === 0) {
      return [];
    }

    // Prepare search query
    const searchQuery = this._prepareSearchQuery(query);
    
    // Build search pipeline using regex only (no text index required)
    const pipeline = [
      // Filter by neighbourhood and status first
      {
        $match: {
          neighbourhoodId,
          status: 'active',
          $or: [
            { expiresAt: null },
            { expiresAt: { $gt: new Date() } }
          ]
        }
      },
      // Then apply search filters
      {
        $match: {
          $or: [
            { title: { $regex: searchQuery, $options: 'i' } },
            { content: { $regex: searchQuery, $options: 'i' } }
          ]
        }
      },
      // Add relevance score based on field matches
      {
        $addFields: {
          score: {
            $add: [
              { $cond: [{ $regexMatch: { input: "$title", regex: searchQuery, options: "i" } }, 3, 0] },
              { $cond: [{ $regexMatch: { input: "$content", regex: searchQuery, options: "i" } }, 1, 0] }
            ]
          }
        }
      },
      // Sort by score, pinned status, or date
      {
        $sort: sortBy === 'score' 
          ? { score: -1, isPinned: -1, createdAt: -1 } 
          : { isPinned: -1, createdAt: -1 }
      },
      // Limit results
      { $limit: limit },
      // Join with author information
      {
        $lookup: {
          from: 'users',
          localField: 'authorId',
          foreignField: '_id',
          as: 'author'
        }
      },
      // Unwind author array
      {
        $unwind: {
          path: '$author',
          preserveNullAndEmptyArrays: true
        }
      },
      // Project only needed fields
      {
        $project: {
          _id: 1,
          title: 1,
          content: 1,
          category: 1,
          priority: 1,
          createdAt: 1,
          isPinned: 1,
          media: { $slice: ['$media', 1] }, // Include only first media item
          author: {
            _id: '$author._id',
            firstName: '$author.firstName',
            lastName: '$author.lastName'
          },
          commentCount: { $size: { $ifNull: ['$comments', []] } },
          likeCount: { $size: { $ifNull: ['$likes', []] } },
          score: 1
        }
      }
    ];

    // Execute search with error handling
    return executeQuery(
      async () => {
        return Notice.aggregate(pipeline);
      },
      {
        operationName: 'Search notices',
        timeout: 10000,
        metadata: { query, neighbourhoodId, limit }
      }
    );
  }

  /**
   * Search for reports
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Report search results
   */
  async searchReports(query, options = {}) {
    const { 
      neighbourhoodId, 
      limit = 10,
      sortBy = 'score'
    } = options;

    if (!query || query.trim().length === 0) {
      return [];
    }

    // Prepare search query
    const searchQuery = this._prepareSearchQuery(query);
    
    // Build search pipeline using regex only (no text index required)
    const pipeline = [
      // Filter by neighbourhood and status first
      {
        $match: {
          neighbourhoodId,
          reportStatus: 'active'
        }
      },
      // Then apply search filters
      {
        $match: {
          $or: [
            { title: { $regex: searchQuery, $options: 'i' } },
            { description: { $regex: searchQuery, $options: 'i' } }
          ]
        }
      },
      // Add relevance score based on field matches
      {
        $addFields: {
          score: {
            $add: [
              { $cond: [{ $regexMatch: { input: "$title", regex: searchQuery, options: "i" } }, 3, 0] },
              { $cond: [{ $regexMatch: { input: "$description", regex: searchQuery, options: "i" } }, 1, 0] }
            ]
          }
        }
      },
      // Sort by score or date
      {
        $sort: sortBy === 'score' 
          ? { score: -1, createdAt: -1 } 
          : { createdAt: -1 }
      },
      // Limit results
      { $limit: limit },
      // Join with reporter information
      {
        $lookup: {
          from: 'users',
          localField: 'reporterId',
          foreignField: '_id',
          as: 'reporter'
        }
      },
      // Unwind reporter array
      {
        $unwind: {
          path: '$reporter',
          preserveNullAndEmptyArrays: true
        }
      },
      // Project only needed fields
      {
        $project: {
          _id: 1,
          title: 1,
          description: 1,
          category: 1,
          priority: 1,
          status: 1,
          createdAt: 1,
          location: 1,
          media: { $slice: ['$media', 1] }, // Include only first media item
          reporter: {
            _id: '$reporter._id',
            firstName: '$reporter.firstName',
            lastName: '$reporter.lastName'
          },
          isAnonymous: 1,
          commentCount: { $size: { $ifNull: ['$comments', []] } },
          likeCount: { $size: { $ifNull: ['$likes', []] } },
          score: 1
        }
      }
    ];

    // Execute search with error handling
    return executeQuery(
      async () => {
        return Report.aggregate(pipeline);
      },
      {
        operationName: 'Search reports',
        timeout: 10000,
        metadata: { query, neighbourhoodId, limit }
      }
    );
  }

  /**
   * Search for chat groups
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Chat search results
   */
  async searchChats(query, options = {}) {
    const { 
      userId, 
      neighbourhoodId, 
      limit = 10,
      sortBy = 'score'
    } = options;

    if (!query || query.trim().length === 0) {
      return [];
    }

    // Prepare search query
    const searchQuery = this._prepareSearchQuery(query);
    
    // Build search pipeline for chat groups using regex only
    const groupPipeline = [
      // Filter by neighbourhood and membership first
      {
        $match: {
          neighbourhoodId,
          isActive: true,
          'members.userId': userId // User is a member
        }
      },
      // Then apply search filters
      {
        $match: {
          $or: [
            { name: { $regex: searchQuery, $options: 'i' } },
            { description: { $regex: searchQuery, $options: 'i' } }
          ]
        }
      },
      // Add relevance score based on field matches
      {
        $addFields: {
          score: {
            $add: [
              { $cond: [{ $regexMatch: { input: "$name", regex: searchQuery, options: "i" } }, 3, 0] },
              { $cond: [{ $regexMatch: { input: "$description", regex: searchQuery, options: "i" } }, 1, 0] }
            ]
          },
          chatType: 'group'
        }
      },
      // Sort by score or last activity
      {
        $sort: sortBy === 'score' 
          ? { score: -1, lastActivity: -1 } 
          : { lastActivity: -1 }
      },
      // Limit results
      { $limit: limit },
      // Project only needed fields
      {
        $project: {
          _id: 1,
          name: 1,
          description: 1,
          type: 1,
          chatType: 1,
          memberCount: { $size: '$members' },
          lastActivity: 1,
          score: 1
        }
      }
    ];

    // Build search pipeline for private chats
    const privatePipeline = [
      // Match private chats where user is a participant
      {
        $match: {
          participants: userId,
          isActive: true
        }
      },
      // Lookup participant info
      {
        $lookup: {
          from: 'users',
          localField: 'participants',
          foreignField: '_id',
          as: 'participantInfo'
        }
      },
      // Filter participants to exclude current user
      {
        $addFields: {
          otherParticipants: {
            $filter: {
              input: '$participantInfo',
              as: 'participant',
              cond: { $ne: ['$$participant._id', userId] }
            }
          }
        }
      },
      // Match based on other participant's name
      {
        $match: {
          $or: [
            { 'otherParticipants.firstName': { $regex: searchQuery, $options: 'i' } },
            { 'otherParticipants.lastName': { $regex: searchQuery, $options: 'i' } }
          ]
        }
      },
      // Add fields for consistency with group chats
      {
        $addFields: {
          chatType: 'private',
          score: 1 // Default score
        }
      },
      // Sort by last message timestamp
      {
        $sort: { 'lastMessage.timestamp': -1 }
      },
      // Limit results
      { $limit: limit },
      // Project only needed fields
      {
        $project: {
          _id: 1,
          chatType: 1,
          lastMessage: 1,
          updatedAt: 1,
          otherParticipant: { $arrayElemAt: ['$otherParticipants', 0] },
          score: 1
        }
      },
      // Format the output to be consistent
      {
        $project: {
          _id: 1,
          chatType: 1,
          name: { $concat: ['$otherParticipant.firstName', ' ', '$otherParticipant.lastName'] },
          lastActivity: { $ifNull: ['$lastMessage.timestamp', '$updatedAt'] },
          otherParticipantId: '$otherParticipant._id',
          profileImageUrl: '$otherParticipant.profileImageUrl',
          score: 1
        }
      }
    ];

    // Execute both searches in parallel
    const [groupResults, privateResults] = await Promise.all([
      executeQuery(
        async () => ChatGroup.aggregate(groupPipeline),
        {
          operationName: 'Search chat groups',
          timeout: 10000,
          metadata: { query, neighbourhoodId, limit }
        }
      ),
      executeQuery(
        async () => PrivateChat.aggregate(privatePipeline),
        {
          operationName: 'Search private chats',
          timeout: 10000,
          metadata: { query, userId, limit }
        }
      )
    ]);

    // Combine and sort results
    const combinedResults = [...groupResults, ...privateResults]
      .sort((a, b) => {
        if (sortBy === 'score') {
          return b.score - a.score;
        }
        return new Date(b.lastActivity) - new Date(a.lastActivity);
      })
      .slice(0, limit);

    return combinedResults;
  }

  /**
   * Search for messages
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Message search results
   */
  async searchMessages(query, options = {}) {
    const { 
      userId, 
      limit = 10,
      sortBy = 'score'
    } = options;

    if (!query || query.trim().length === 0) {
      return [];
    }

    // Prepare search query
    const searchQuery = this._prepareSearchQuery(query);
    
    // Get user's chat groups and private chats
    const userChatGroups = await executeQuery(
      async () => {
        return ChatGroup.find(
          { 'members.userId': userId, isActive: true },
          { _id: 1 }
        );
      },
      {
        operationName: 'Get user chat groups',
        timeout: 5000,
        metadata: { userId }
      }
    );
    
    const userPrivateChats = await executeQuery(
      async () => {
        return PrivateChat.find(
          { participants: userId, isActive: true },
          { _id: 1 }
        );
      },
      {
        operationName: 'Get user private chats',
        timeout: 5000,
        metadata: { userId }
      }
    );
    
    const groupIds = userChatGroups.map(group => group._id);
    const privateChatIds = userPrivateChats.map(chat => chat._id);
    
    // Build search pipeline using regex only (no text index required)
    const pipeline = [
      // Filter by user's chats and deletion status first
      {
        $match: {
          $or: [
            { chatId: { $in: groupIds }, chatType: 'group' },
            { chatId: { $in: privateChatIds }, chatType: 'private' }
          ],
          isDeleted: false
        }
      },
      // Then apply search filters
      {
        $match: {
          content: { $regex: searchQuery, $options: 'i' }
        }
      },
      // Add relevance score based on content match
      {
        $addFields: {
          score: {
            $cond: [{ $regexMatch: { input: "$content", regex: searchQuery, options: "i" } }, 1, 0]
          }
        }
      },
      // Sort by score or date
      {
        $sort: sortBy === 'score' 
          ? { score: -1, createdAt: -1 } 
          : { createdAt: -1 }
      },
      // Limit results
      { $limit: limit },
      // Join with sender information
      {
        $lookup: {
          from: 'users',
          localField: 'senderId',
          foreignField: '_id',
          as: 'sender'
        }
      },
      // Unwind sender array
      {
        $unwind: {
          path: '$sender',
          preserveNullAndEmptyArrays: true
        }
      },
      // Join with chat information (group or private)
      {
        $lookup: {
          from: 'chatgroups',
          localField: 'chatId',
          foreignField: '_id',
          as: 'chatGroup'
        }
      },
      {
        $lookup: {
          from: 'privatechats',
          localField: 'chatId',
          foreignField: '_id',
          as: 'privateChat'
        }
      },
      // Project only needed fields
      {
        $project: {
          _id: 1,
          content: 1,
          chatId: 1,
          chatType: 1,
          createdAt: 1,
          sender: {
            _id: '$sender._id',
            firstName: '$sender.firstName',
            lastName: '$sender.lastName'
          },
          chatName: {
            $cond: {
              if: { $eq: ['$chatType', 'group'] },
              then: { $arrayElemAt: ['$chatGroup.name', 0] },
              else: 'Private Chat' // This will be replaced with participant name in a separate step
            }
          },
          score: 1
        }
      }
    ];

    // Execute search with error handling
    const messages = await executeQuery(
      async () => {
        return Message.aggregate(pipeline);
      },
      {
        operationName: 'Search messages',
        timeout: 15000,
        metadata: { query, userId, limit }
      }
    );

    // For private chats, get the other participant's name
    const privateMessages = messages.filter(msg => msg.chatType === 'private');
    if (privateMessages.length > 0) {
      const privateChatDetails = await executeQuery(
        async () => {
          return PrivateChat.find(
            { _id: { $in: privateMessages.map(msg => msg.chatId) } }
          ).populate('participants', 'firstName lastName');
        },
        {
          operationName: 'Get private chat details',
          timeout: 5000
        }
      );

      // Create a map of chat ID to other participant name
      const chatNameMap = {};
      privateChatDetails.forEach(chat => {
        const otherParticipant = chat.participants.find(p => p._id.toString() !== userId);
        if (otherParticipant) {
          chatNameMap[chat._id.toString()] = `${otherParticipant.firstName} ${otherParticipant.lastName}`;
        }
      });

      // Update private message chat names
      messages.forEach(msg => {
        if (msg.chatType === 'private') {
          const chatId = msg.chatId.toString();
          if (chatNameMap[chatId]) {
            msg.chatName = chatNameMap[chatId];
          }
        }
      });
    }

    return messages;
  }

  /**
   * Get autocomplete suggestions with grouped results
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Grouped autocomplete results
   */
  async getAutocompleteResults(query, options = {}) {
    const { 
      userId, 
      neighbourhoodId, 
      limit = 3 // Limit per category for autocomplete
    } = options;

    if (!query || query.trim().length === 0) {
      return {
        users: [],
        notices: [],
        reports: [],
        chats: []
      };
    }

    // Use searchAll with autocomplete flag
    return this.searchAll(query, {
      userId,
      neighbourhoodId,
      limit,
      autocomplete: true
    });
  }

  /**
   * Prepare search query for MongoDB text search
   * @param {string} query - Raw search query
   * @param {boolean} autocomplete - Whether to optimize for autocomplete
   * @returns {string} Prepared search query
   */
  _prepareSearchQuery(query, autocomplete = false) {
    if (!query) return '';
    
    // Trim and sanitize query
    let searchQuery = query.trim();
    
    // For autocomplete, we want to match partial words
    if (autocomplete) {
      return searchQuery;
    }
    
    // For full search, we want to match whole words and phrases
    // Split into words and wrap each in quotes for exact matching
    const words = searchQuery.split(/\s+/).filter(word => word.length > 0);
    
    if (words.length > 1) {
      // For multi-word queries, also search for the exact phrase
      return `"${searchQuery}" ${words.map(word => `"${word}"`).join(' ')}`;
    }
    
    return searchQuery;
  }
}

module.exports = SearchService;