const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const StatsService = require('../services/StatsService');
const User = require('../models/User');
const Notice = require('../models/Notice');
const Report = require('../models/Report');
const Message = require('../models/Message');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await Notice.deleteMany({});
  await Report.deleteMany({});
  await Message.deleteMany({});
});

describe('StatsService', () => {
  let testUser;
  let neighborhoodId;

  beforeEach(async () => {
    neighborhoodId = new mongoose.Types.ObjectId();
    testUser = await User.create({
      email: 'test@example.com',
      password: 'password123',
      firstName: 'Test',
      lastName: 'User',
      neighbourhoodId: neighborhoodId,
      friends: []
    });
  });

  describe('getUserStats', () => {
    test('should return correct user statistics', async () => {
      // Create test data
      await Notice.create({
        title: 'Test Notice',
        content: 'Test content',
        category: 'general',
        neighbourhoodId: neighborhoodId,
        authorId: testUser._id
      });

      await Report.create({
        title: 'Test Report',
        description: 'Test description',
        category: 'security',
        neighbourhoodId: neighborhoodId,
        reporterId: testUser._id
      });

      await Message.create({
        chatId: new mongoose.Types.ObjectId(),
        chatType: 'group',
        senderId: testUser._id,
        content: 'Test message'
      });

      const stats = await StatsService.getUserStats(testUser._id);

      expect(stats.reportsCount).toBe(1);
      expect(stats.noticesCount).toBe(1);
      expect(stats.messagesCount).toBe(1);
      expect(stats.friendsCount).toBe(0);
      expect(stats.status).toBe('active');
      expect(stats.memberSince).toBeDefined();
    });

    test('should handle user not found', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      
      await expect(StatsService.getUserStats(nonExistentId))
        .rejects.toThrow('User not found');
    });
  });

  describe('getCommunityStats', () => {
    test('should return correct community statistics', async () => {
      // Create another user in the same neighborhood
      await User.create({
        email: 'user2@example.com',
        password: 'password123',
        firstName: 'User',
        lastName: 'Two',
        neighbourhoodId: neighborhoodId
      });

      // Create test content
      await Notice.create({
        title: 'Community Notice',
        content: 'Community content',
        category: 'general',
        neighbourhoodId: neighborhoodId,
        authorId: testUser._id
      });

      await Report.create({
        title: 'Community Report',
        description: 'Community description',
        category: 'security',
        neighbourhoodId: neighborhoodId,
        reporterId: testUser._id,
        status: 'open'
      });

      const stats = await StatsService.getCommunityStats(neighborhoodId);

      expect(stats.totalMembers).toBe(2);
      expect(stats.activeReports).toBe(1);
      expect(stats.totalNotices).toBe(1);
      expect(stats.recentActivity).toBeDefined();
    });
  });

  describe('getEngagementMetrics', () => {
    test('should return engagement metrics for notice', async () => {
      const notice = await Notice.create({
        title: 'Test Notice',
        content: 'Test content',
        category: 'general',
        neighbourhoodId: neighborhoodId,
        authorId: testUser._id,
        likes: [testUser._id],
        comments: [{
          author: testUser._id,
          content: 'Great notice!'
        }],
        viewCount: 10
      });

      const metrics = await StatsService.getEngagementMetrics('notice', notice._id);

      expect(metrics.likes).toBe(1);
      expect(metrics.comments).toBe(1);
      expect(metrics.views).toBe(10);
    });

    test('should handle invalid content type', async () => {
      await expect(StatsService.getEngagementMetrics('invalid', testUser._id))
        .rejects.toThrow('Invalid content type');
    });
  });

  describe('calculateTimeSince', () => {
    test('should calculate days correctly', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const result = StatsService.calculateTimeSince(threeDaysAgo);
      expect(result).toBe('3 days');
    });

    test('should calculate months correctly', () => {
      const twoMonthsAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      const result = StatsService.calculateTimeSince(twoMonthsAgo);
      expect(result).toBe('2 months');
    });

    test('should calculate years correctly', () => {
      const twoYearsAgo = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000);
      const result = StatsService.calculateTimeSince(twoYearsAgo);
      expect(result).toBe('2 years');
    });
  });

  describe('getDashboardStats', () => {
    test('should return comprehensive dashboard statistics', async () => {
      // Create test data
      await Notice.create({
        title: 'Dashboard Notice',
        content: 'Dashboard content',
        category: 'general',
        neighbourhoodId: neighborhoodId,
        authorId: testUser._id
      });

      const stats = await StatsService.getDashboardStats(testUser._id);

      expect(stats.user).toBeDefined();
      expect(stats.community).toBeDefined();
      expect(stats.recentItems).toBeDefined();
      expect(stats.recentItems.notices).toHaveLength(1);
      expect(stats.recentItems.reports).toHaveLength(0);
    });
  });

  describe('getStatsWithFallback', () => {
    test('should return fallback stats on error', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const stats = await StatsService.getStatsWithFallback(nonExistentId);

      expect(stats.user.reportsCount).toBe(0);
      expect(stats.user.noticesCount).toBe(0);
      expect(stats.user.messagesCount).toBe(0);
      expect(stats.user.friendsCount).toBe(0);
      expect(stats.community.totalMembers).toBe(0);
      expect(stats.recentItems.notices).toEqual([]);
      expect(stats.recentItems.reports).toEqual([]);
    });
  });
});