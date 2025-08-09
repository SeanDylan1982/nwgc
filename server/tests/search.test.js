/**
 * search.test.js
 * 
 * Unit tests for the SearchService and search functionality
 */

const { describe, it, expect, beforeEach, afterEach, vi } = require('vitest');
const mongoose = require('mongoose');
const SearchService = require('../services/SearchService');
const User = require('../models/User');
const Notice = require('../models/Notice');
const Report = require('../models/Report');
const ChatGroup = require('../models/ChatGroup');
const PrivateChat = require('../models/PrivateChat');
const Message = require('../models/Message');

// Mock the database wrapper
vi.mock('../utils/dbOperationWrapper', () => ({
  executeQuery: vi.fn((fn) => fn())
}));

describe('SearchService', () => {
  let searchService;
  let mockUserId;
  let mockNeighbourhoodId;

  beforeEach(() => {
    searchService = new SearchService();
    mockUserId = new mongoose.Types.ObjectId().toString();
    mockNeighbourhoodId = new mongoose.Types.ObjectId().toString();
    
    // Mock the mongoose models
    User.aggregate = vi.fn().mockResolvedValue([]);
    Notice.aggregate = vi.fn().mockResolvedValue([]);
    Report.aggregate = vi.fn().mockResolvedValue([]);
    ChatGroup.aggregate = vi.fn().mockResolvedValue([]);
    ChatGroup.find = vi.fn().mockResolvedValue([]);
    PrivateChat.aggregate = vi.fn().mockResolvedValue([]);
    PrivateChat.find = vi.fn().mockResolvedValue([]);
    Message.aggregate = vi.fn().mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('searchUsers', () => {
    it('should return empty array for empty query', async () => {
      const result = await searchService.searchUsers('', { userId: mockUserId, neighbourhoodId: mockNeighbourhoodId });
      expect(result).toEqual([]);
      expect(User.aggregate).not.toHaveBeenCalled();
    });

    it('should call User.aggregate with correct pipeline', async () => {
      const mockQuery = 'john';
      await searchService.searchUsers(mockQuery, { userId: mockUserId, neighbourhoodId: mockNeighbourhoodId });
      
      expect(User.aggregate).toHaveBeenCalled();
      const pipeline = User.aggregate.mock.calls[0][0];
      
      // Check pipeline structure
      expect(pipeline).toBeInstanceOf(Array);
      expect(pipeline.length).toBeGreaterThan(0);
      
      // Check match conditions
      const matchStage = pipeline.find(stage => stage.$match && stage.$match.neighbourhoodId);
      expect(matchStage).toBeDefined();
      expect(matchStage.$match.neighbourhoodId).toBe(mockNeighbourhoodId);
      expect(matchStage.$match._id.$ne).toBe(mockUserId);
      
      // Check text search
      const textSearchStage = pipeline.find(stage => stage.$match && stage.$match.$or);
      expect(textSearchStage).toBeDefined();
      expect(textSearchStage.$match.$or).toBeInstanceOf(Array);
      
      // Check projection
      const projectStage = pipeline.find(stage => stage.$project);
      expect(projectStage).toBeDefined();
      expect(projectStage.$project).toHaveProperty('firstName');
      expect(projectStage.$project).toHaveProperty('lastName');
    });
  });

  describe('searchNotices', () => {
    it('should return empty array for empty query', async () => {
      const result = await searchService.searchNotices('', { neighbourhoodId: mockNeighbourhoodId });
      expect(result).toEqual([]);
      expect(Notice.aggregate).not.toHaveBeenCalled();
    });

    it('should call Notice.aggregate with correct pipeline', async () => {
      const mockQuery = 'safety';
      await searchService.searchNotices(mockQuery, { neighbourhoodId: mockNeighbourhoodId });
      
      expect(Notice.aggregate).toHaveBeenCalled();
      const pipeline = Notice.aggregate.mock.calls[0][0];
      
      // Check pipeline structure
      expect(pipeline).toBeInstanceOf(Array);
      expect(pipeline.length).toBeGreaterThan(0);
      
      // Check match conditions
      const matchStage = pipeline.find(stage => stage.$match && stage.$match.neighbourhoodId);
      expect(matchStage).toBeDefined();
      expect(matchStage.$match.neighbourhoodId).toBe(mockNeighbourhoodId);
      expect(matchStage.$match.status).toBe('active');
      
      // Check text search
      const textSearchStage = pipeline.find(stage => stage.$match && stage.$match.$or);
      expect(textSearchStage).toBeDefined();
      expect(textSearchStage.$match.$or).toBeInstanceOf(Array);
      
      // Check lookup for author
      const lookupStage = pipeline.find(stage => stage.$lookup && stage.$lookup.from === 'users');
      expect(lookupStage).toBeDefined();
    });
  });

  describe('searchAll', () => {
    it('should return empty results for empty query', async () => {
      const result = await searchService.searchAll('', { userId: mockUserId, neighbourhoodId: mockNeighbourhoodId });
      
      expect(result).toEqual({
        users: [],
        notices: [],
        reports: [],
        chats: [],
        messages: []
      });
      
      expect(User.aggregate).not.toHaveBeenCalled();
      expect(Notice.aggregate).not.toHaveBeenCalled();
      expect(Report.aggregate).not.toHaveBeenCalled();
    });

    it('should call all search methods with the same query', async () => {
      // Spy on the individual search methods
      const searchUsersSpy = vi.spyOn(searchService, 'searchUsers').mockResolvedValue([]);
      const searchNoticesSpy = vi.spyOn(searchService, 'searchNotices').mockResolvedValue([]);
      const searchReportsSpy = vi.spyOn(searchService, 'searchReports').mockResolvedValue([]);
      const searchChatsSpy = vi.spyOn(searchService, 'searchChats').mockResolvedValue([]);
      const searchMessagesSpy = vi.spyOn(searchService, 'searchMessages').mockResolvedValue([]);
      
      const mockQuery = 'test query';
      await searchService.searchAll(mockQuery, { 
        userId: mockUserId, 
        neighbourhoodId: mockNeighbourhoodId,
        limit: 5
      });
      
      expect(searchUsersSpy).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
        userId: mockUserId,
        neighbourhoodId: mockNeighbourhoodId,
        limit: 5
      }));
      
      expect(searchNoticesSpy).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
        userId: mockUserId,
        neighbourhoodId: mockNeighbourhoodId,
        limit: 5
      }));
      
      expect(searchReportsSpy).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
        userId: mockUserId,
        neighbourhoodId: mockNeighbourhoodId,
        limit: 5
      }));
      
      expect(searchChatsSpy).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
        userId: mockUserId,
        neighbourhoodId: mockNeighbourhoodId,
        limit: 5
      }));
      
      expect(searchMessagesSpy).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
        userId: mockUserId,
        neighbourhoodId: mockNeighbourhoodId,
        limit: 5
      }));
    });
  });

  describe('getAutocompleteResults', () => {
    it('should call searchAll with autocomplete flag', async () => {
      const searchAllSpy = vi.spyOn(searchService, 'searchAll').mockResolvedValue({});
      
      const mockQuery = 'test';
      await searchService.getAutocompleteResults(mockQuery, { 
        userId: mockUserId, 
        neighbourhoodId: mockNeighbourhoodId 
      });
      
      expect(searchAllSpy).toHaveBeenCalledWith(mockQuery, expect.objectContaining({
        userId: mockUserId,
        neighbourhoodId: mockNeighbourhoodId,
        autocomplete: true
      }));
    });
  });

  describe('_prepareSearchQuery', () => {
    it('should return empty string for null or undefined input', () => {
      expect(searchService._prepareSearchQuery(null)).toBe('');
      expect(searchService._prepareSearchQuery(undefined)).toBe('');
    });

    it('should trim input', () => {
      expect(searchService._prepareSearchQuery('  test  ')).toBe('test');
    });

    it('should return original query for autocomplete mode', () => {
      expect(searchService._prepareSearchQuery('test query', true)).toBe('test query');
    });

    it('should wrap multi-word queries for exact matching', () => {
      const result = searchService._prepareSearchQuery('test query');
      expect(result).toBe('"test query" "test" "query"');
    });

    it('should handle single word queries', () => {
      expect(searchService._prepareSearchQuery('test')).toBe('test');
    });
  });
});