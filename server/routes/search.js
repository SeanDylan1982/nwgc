/**
 * search.js
 * 
 * API routes for search functionality across users, notices, reports, and chats.
 * Implements autocomplete search with grouped results.
 */

const express = require('express');
const { query, validationResult } = require('express-validator');
const SearchService = require('../services/SearchService');
const { enhanceError } = require('../utils/errorClassification');
const { handleDatabaseError } = require('../utils/errorHandler');
const router = express.Router();

// Initialize search service
const searchService = new SearchService();

/**
 * @route   GET /api/search
 * @desc    Search across all entities (users, notices, reports, chats)
 * @access  Private
 */
router.get('/', [
  query('q').trim().notEmpty().withMessage('Search query is required'),
  query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
  query('type').optional().isIn(['all', 'users', 'notices', 'reports', 'chats', 'messages'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { q, limit = 10, type = 'all' } = req.query;
    const userId = req.user.userId;
    const neighbourhoodId = req.user.neighbourhoodId;

    if (!neighbourhoodId) {
      return res.status(400).json({ message: 'User not assigned to a neighbourhood' });
    }

    let results;

    // Handle different search types
    switch (type) {
      case 'users':
        results = { users: await searchService.searchUsers(q, { userId, neighbourhoodId, limit }) };
        break;
      case 'notices':
        results = { notices: await searchService.searchNotices(q, { userId, neighbourhoodId, limit }) };
        break;
      case 'reports':
        results = { reports: await searchService.searchReports(q, { userId, neighbourhoodId, limit }) };
        break;
      case 'chats':
        results = { chats: await searchService.searchChats(q, { userId, neighbourhoodId, limit }) };
        break;
      case 'messages':
        results = { messages: await searchService.searchMessages(q, { userId, neighbourhoodId, limit }) };
        break;
      case 'all':
      default:
        results = await searchService.searchAll(q, { userId, neighbourhoodId, limit });
        break;
    }

    res.json(results);
  } catch (error) {
    // Use enhanced error handling
    const enhancedErr = enhanceError(error);
    const { statusCode, errorResponse } = handleDatabaseError(enhancedErr, {
      defaultMessage: 'Failed to perform search',
      defaultStatusCode: 500,
      context: {
        operation: 'Search',
        query: req.query.q,
        userId: req.user.userId
      }
    });
    
    res.status(statusCode).json(errorResponse);
  }
});

/**
 * @route   GET /api/search/autocomplete
 * @desc    Get autocomplete suggestions with grouped results
 * @access  Private
 */
router.get('/autocomplete', [
  query('q').trim().notEmpty().withMessage('Search query is required'),
  query('limit').optional().isInt({ min: 1, max: 10 }).toInt()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { q, limit = 3 } = req.query;
    const userId = req.user.userId;
    const neighbourhoodId = req.user.neighbourhoodId;

    if (!neighbourhoodId) {
      return res.status(400).json({ message: 'User not assigned to a neighbourhood' });
    }

    const results = await searchService.getAutocompleteResults(q, {
      userId,
      neighbourhoodId,
      limit
    });

    res.json(results);
  } catch (error) {
    // Use enhanced error handling
    const enhancedErr = enhanceError(error);
    const { statusCode, errorResponse } = handleDatabaseError(enhancedErr, {
      defaultMessage: 'Failed to get autocomplete suggestions',
      defaultStatusCode: 500,
      context: {
        operation: 'Autocomplete search',
        query: req.query.q,
        userId: req.user.userId
      }
    });
    
    res.status(statusCode).json(errorResponse);
  }
});

/**
 * @route   GET /api/search/users
 * @desc    Search for users
 * @access  Private
 */
router.get('/users', [
  query('q').trim().notEmpty().withMessage('Search query is required'),
  query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
  query('sortBy').optional().isIn(['score', 'name'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { q, limit = 10, sortBy = 'score' } = req.query;
    const userId = req.user.userId;
    const neighbourhoodId = req.user.neighbourhoodId;

    if (!neighbourhoodId) {
      return res.status(400).json({ message: 'User not assigned to a neighbourhood' });
    }

    const results = await searchService.searchUsers(q, {
      userId,
      neighbourhoodId,
      limit,
      sortBy
    });

    res.json(results);
  } catch (error) {
    // Use enhanced error handling
    const enhancedErr = enhanceError(error);
    const { statusCode, errorResponse } = handleDatabaseError(enhancedErr, {
      defaultMessage: 'Failed to search users',
      defaultStatusCode: 500,
      context: {
        operation: 'Search users',
        query: req.query.q,
        userId: req.user.userId
      }
    });
    
    res.status(statusCode).json(errorResponse);
  }
});

/**
 * @route   GET /api/search/notices
 * @desc    Search for notices
 * @access  Private
 */
router.get('/notices', [
  query('q').trim().notEmpty().withMessage('Search query is required'),
  query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
  query('sortBy').optional().isIn(['score', 'date'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { q, limit = 10, sortBy = 'score' } = req.query;
    const userId = req.user.userId;
    const neighbourhoodId = req.user.neighbourhoodId;

    if (!neighbourhoodId) {
      return res.status(400).json({ message: 'User not assigned to a neighbourhood' });
    }

    const results = await searchService.searchNotices(q, {
      userId,
      neighbourhoodId,
      limit,
      sortBy
    });

    res.json(results);
  } catch (error) {
    // Use enhanced error handling
    const enhancedErr = enhanceError(error);
    const { statusCode, errorResponse } = handleDatabaseError(enhancedErr, {
      defaultMessage: 'Failed to search notices',
      defaultStatusCode: 500,
      context: {
        operation: 'Search notices',
        query: req.query.q,
        userId: req.user.userId
      }
    });
    
    res.status(statusCode).json(errorResponse);
  }
});

/**
 * @route   GET /api/search/reports
 * @desc    Search for reports
 * @access  Private
 */
router.get('/reports', [
  query('q').trim().notEmpty().withMessage('Search query is required'),
  query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
  query('sortBy').optional().isIn(['score', 'date'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { q, limit = 10, sortBy = 'score' } = req.query;
    const userId = req.user.userId;
    const neighbourhoodId = req.user.neighbourhoodId;

    if (!neighbourhoodId) {
      return res.status(400).json({ message: 'User not assigned to a neighbourhood' });
    }

    const results = await searchService.searchReports(q, {
      userId,
      neighbourhoodId,
      limit,
      sortBy
    });

    res.json(results);
  } catch (error) {
    // Use enhanced error handling
    const enhancedErr = enhanceError(error);
    const { statusCode, errorResponse } = handleDatabaseError(enhancedErr, {
      defaultMessage: 'Failed to search reports',
      defaultStatusCode: 500,
      context: {
        operation: 'Search reports',
        query: req.query.q,
        userId: req.user.userId
      }
    });
    
    res.status(statusCode).json(errorResponse);
  }
});

/**
 * @route   GET /api/search/chats
 * @desc    Search for chats (groups and private)
 * @access  Private
 */
router.get('/chats', [
  query('q').trim().notEmpty().withMessage('Search query is required'),
  query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
  query('sortBy').optional().isIn(['score', 'activity'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { q, limit = 10, sortBy = 'score' } = req.query;
    const userId = req.user.userId;
    const neighbourhoodId = req.user.neighbourhoodId;

    if (!neighbourhoodId) {
      return res.status(400).json({ message: 'User not assigned to a neighbourhood' });
    }

    const results = await searchService.searchChats(q, {
      userId,
      neighbourhoodId,
      limit,
      sortBy
    });

    res.json(results);
  } catch (error) {
    // Use enhanced error handling
    const enhancedErr = enhanceError(error);
    const { statusCode, errorResponse } = handleDatabaseError(enhancedErr, {
      defaultMessage: 'Failed to search chats',
      defaultStatusCode: 500,
      context: {
        operation: 'Search chats',
        query: req.query.q,
        userId: req.user.userId
      }
    });
    
    res.status(statusCode).json(errorResponse);
  }
});

/**
 * @route   GET /api/search/messages
 * @desc    Search for messages
 * @access  Private
 */
router.get('/messages', [
  query('q').trim().notEmpty().withMessage('Search query is required'),
  query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
  query('sortBy').optional().isIn(['score', 'date'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { q, limit = 10, sortBy = 'score' } = req.query;
    const userId = req.user.userId;
    const neighbourhoodId = req.user.neighbourhoodId;

    if (!neighbourhoodId) {
      return res.status(400).json({ message: 'User not assigned to a neighbourhood' });
    }

    const results = await searchService.searchMessages(q, {
      userId,
      neighbourhoodId,
      limit,
      sortBy
    });

    res.json(results);
  } catch (error) {
    // Use enhanced error handling
    const enhancedErr = enhanceError(error);
    const { statusCode, errorResponse } = handleDatabaseError(enhancedErr, {
      defaultMessage: 'Failed to search messages',
      defaultStatusCode: 500,
      context: {
        operation: 'Search messages',
        query: req.query.q,
        userId: req.user.userId
      }
    });
    
    res.status(statusCode).json(errorResponse);
  }
});

module.exports = router;