const mongoose = require('mongoose');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');
const express = require('express');
const privateChatRoutes = require('../routes/privateChat');
const User = require('../models/User');
const PrivateChat = require('../models/PrivateChat');
const Message = require('../models/Message');

let mongoServer;
const app = express();
app.use(express.json());

// Mock authentication middleware
app.use((req, res, next) => {
  req.user = { userId: '507f1f77bcf86cd799439011' };
  next();
});

// Mock socket.io
app.set('io', {
  to: jest.fn().mockReturnValue({
    emit: jest.fn()
  })
});

app.use('/api/private-chat', privateChatRoutes);

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await PrivateChat.deleteMany({});
  await Message.deleteMany({});
});

describe('Private Chat API', () => {
  let user1, user2, privateChat;

  beforeEach(async () => {
    // Create test users
    user1 = new User({
      _id: '507f1f77bcf86cd799439011',
      email: 'user1@test.com',
      firstName: 'Test',
      lastName: 'User1',
      password: 'password123',
      status: 'active',
      neighbourhoodId: '507f1f77bcf86cd799439020'
    });
    
    user2 = new User({
      _id: '507f1f77bcf86cd799439012',
      email: 'user2@test.com',
      firstName: 'Test',
      lastName: 'User2',
      password: 'password123',
      status: 'active',
      neighbourhoodId: '507f1f77bcf86cd799439020'
    });

    await user1.save();
    await user2.save();

    // Create a private chat between the users
    privateChat = new PrivateChat({
      participants: [user1._id, user2._id]
    });
    
    await privateChat.save();
  });

  test('GET /api/private-chat - should get user private chats', async () => {
    const response = await request(app).get('/api/private-chat');
    
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBe(1);
    expect(response.body[0]._id).toBe(privateChat._id.toString());
  });

  test('POST /api/private-chat/create - should create a new private chat', async () => {
    // Create a new user
    const user3 = new User({
      _id: '507f1f77bcf86cd799439013',
      email: 'user3@test.com',
      firstName: 'Test',
      lastName: 'User3',
      password: 'password123',
      status: 'active',
      neighbourhoodId: '507f1f77bcf86cd799439020'
    });
    await user3.save();

    const response = await request(app)
      .post('/api/private-chat/create')
      .send({ participantId: user3._id.toString() });
    
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('_id');
    expect(response.body.otherParticipant._id).toBe(user3._id.toString());
  });

  test('POST /api/private-chat/:chatId/messages - should send a message', async () => {
    const response = await request(app)
      .post(`/api/private-chat/${privateChat._id}/messages`)
      .send({ content: 'Hello, this is a test message' });
    
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('_id');
    expect(response.body.content).toBe('Hello, this is a test message');
    expect(response.body.chatId).toBe(privateChat._id.toString());
    expect(response.body.chatType).toBe('private');
    expect(response.body.senderId).toBe(user1._id.toString());
  });

  test('GET /api/private-chat/:chatId/messages - should get chat messages', async () => {
    // Create some test messages
    const message1 = new Message({
      chatId: privateChat._id,
      chatType: 'private',
      senderId: user1._id,
      content: 'Message 1',
      status: 'sent'
    });
    
    const message2 = new Message({
      chatId: privateChat._id,
      chatType: 'private',
      senderId: user2._id,
      content: 'Message 2',
      status: 'sent'
    });
    
    await message1.save();
    await message2.save();

    const response = await request(app).get(`/api/private-chat/${privateChat._id}/messages`);
    
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBe(2);
    expect(response.body[0].content).toBe('Message 1');
    expect(response.body[1].content).toBe('Message 2');
  });

  test('GET /api/private-chat/unread/count - should get unread message count', async () => {
    // Create some test messages with unread status
    const message1 = new Message({
      chatId: privateChat._id,
      chatType: 'private',
      senderId: user2._id,
      content: 'Unread message 1',
      status: 'delivered'
    });
    
    const message2 = new Message({
      chatId: privateChat._id,
      chatType: 'private',
      senderId: user2._id,
      content: 'Unread message 2',
      status: 'delivered'
    });
    
    await message1.save();
    await message2.save();

    const response = await request(app).get('/api/private-chat/unread/count');
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('unreadCount');
    expect(response.body.unreadCount).toBe(2);
  });

  test('DELETE /api/private-chat/:chatId - should delete a private chat', async () => {
    const response = await request(app).delete(`/api/private-chat/${privateChat._id}`);
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Private chat deleted');
    
    // Verify chat is no longer accessible
    const updatedChat = await PrivateChat.findById(privateChat._id);
    expect(updatedChat.participants.length).toBe(1);
    expect(updatedChat.participants[0].toString()).not.toBe(user1._id.toString());
  });
});