const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../models/User');
const FriendRequest = require('../models/FriendRequest');
const PrivateChat = require('../models/PrivateChat');
const Message = require('../models/Message');
const Notice = require('../models/Notice');
const Report = require('../models/Report');

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
  await FriendRequest.deleteMany({});
  await PrivateChat.deleteMany({});
  await Message.deleteMany({});
  await Notice.deleteMany({});
  await Report.deleteMany({});
});

describe('Enhanced User Model', () => {
  test('should create user with enhanced fields', async () => {
    const userData = {
      email: 'test@example.com',
      password: 'password123',
      firstName: 'John',
      lastName: 'Doe',
      bio: 'Test bio',
      status: 'active'
    };

    const user = new User(userData);
    await user.save();

    expect(user.bio).toBe('Test bio');
    expect(user.friends).toEqual([]);
    expect(user.status).toBe('active');
    expect(user.settings.notifications.friendRequests).toBe(true);
    expect(user.settings.privacy.profileVisibility).toBe('neighbours');
  });

  test('should validate user status enum', async () => {
    const user = new User({
      email: 'test@example.com',
      password: 'password123',
      firstName: 'John',
      lastName: 'Doe',
      status: 'invalid'
    });

    await expect(user.save()).rejects.toThrow();
  });
});

describe('FriendRequest Model', () => {
  test('should create friend request', async () => {
    const user1 = await User.create({
      email: 'user1@example.com',
      password: 'password123',
      firstName: 'User',
      lastName: 'One'
    });

    const user2 = await User.create({
      email: 'user2@example.com',
      password: 'password123',
      firstName: 'User',
      lastName: 'Two'
    });

    const friendRequest = new FriendRequest({
      from: user1._id,
      to: user2._id,
      message: 'Let\'s be friends!'
    });

    await friendRequest.save();

    expect(friendRequest.status).toBe('pending');
    expect(friendRequest.message).toBe('Let\'s be friends!');
  });

  test('should prevent duplicate friend requests', async () => {
    const user1 = await User.create({
      email: 'user1@example.com',
      password: 'password123',
      firstName: 'User',
      lastName: 'One'
    });

    const user2 = await User.create({
      email: 'user2@example.com',
      password: 'password123',
      firstName: 'User',
      lastName: 'Two'
    });

    await FriendRequest.create({
      from: user1._id,
      to: user2._id
    });

    const duplicateRequest = new FriendRequest({
      from: user1._id,
      to: user2._id
    });

    await expect(duplicateRequest.save()).rejects.toThrow();
  });
});

describe('PrivateChat Model', () => {
  test('should create private chat with exactly 2 participants', async () => {
    const user1 = await User.create({
      email: 'user1@example.com',
      password: 'password123',
      firstName: 'User',
      lastName: 'One'
    });

    const user2 = await User.create({
      email: 'user2@example.com',
      password: 'password123',
      firstName: 'User',
      lastName: 'Two'
    });

    const privateChat = new PrivateChat({
      participants: [user1._id, user2._id]
    });

    await privateChat.save();

    expect(privateChat.participants).toHaveLength(2);
    expect(privateChat.isActive).toBe(true);
  });

  test('should reject private chat with wrong number of participants', async () => {
    const user1 = await User.create({
      email: 'user1@example.com',
      password: 'password123',
      firstName: 'User',
      lastName: 'One'
    });

    const privateChat = new PrivateChat({
      participants: [user1._id] // Only 1 participant
    });

    await expect(privateChat.save()).rejects.toThrow('Private chat must have exactly 2 participants');
  });
});

describe('Enhanced Message Model', () => {
  test('should create message with enhanced fields', async () => {
    const user = await User.create({
      email: 'user@example.com',
      password: 'password123',
      firstName: 'User',
      lastName: 'Test'
    });

    const message = new Message({
      chatId: new mongoose.Types.ObjectId(),
      chatType: 'private',
      senderId: user._id,
      content: 'Hello world!',
      emojis: ['😀', '👍'],
      status: 'sent'
    });

    await message.save();

    expect(message.chatType).toBe('private');
    expect(message.emojis).toEqual(['😀', '👍']);
    expect(message.status).toBe('sent');
    expect(message.media).toEqual([]);
  });
});

describe('Enhanced Notice Model', () => {
  test('should create notice with likes and comments', async () => {
    const user = await User.create({
      email: 'user@example.com',
      password: 'password123',
      firstName: 'User',
      lastName: 'Test'
    });

    const notice = new Notice({
      title: 'Test Notice',
      content: 'This is a test notice',
      category: 'general',
      neighbourhoodId: new mongoose.Types.ObjectId(),
      authorId: user._id,
      likes: [user._id],
      comments: [{
        author: user._id,
        content: 'Great notice!'
      }]
    });

    await notice.save();

    expect(notice.likes).toHaveLength(1);
    expect(notice.comments).toHaveLength(1);
    expect(notice.status).toBe('active');
  });
});

describe('Enhanced Report Model', () => {
  test('should create report with enhanced fields', async () => {
    const user = await User.create({
      email: 'user@example.com',
      password: 'password123',
      firstName: 'User',
      lastName: 'Test'
    });

    const report = new Report({
      title: 'Test Report',
      description: 'This is a test report',
      category: 'security',
      neighbourhoodId: new mongoose.Types.ObjectId(),
      reporterId: user._id,
      likes: [user._id],
      reportStatus: 'active'
    });

    await report.save();

    expect(report.likes).toHaveLength(1);
    expect(report.reportStatus).toBe('active');
    expect(report.status).toBe('open');
  });
});