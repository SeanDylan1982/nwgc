const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const friendRoutes = require('../routes/friends');
const User = require('../models/User');
const FriendRequest = require('../models/FriendRequest');

let mongoServer;
let app;

// Mock auth middleware
const mockAuth = (userId) => (req, res, next) => {
  req.user = { userId };
  next();
};

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);

  // Create test app
  app = express();
  app.use(express.json());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await FriendRequest.deleteMany({});
});

describe('Friend System Routes', () => {
  let user1, user2, user3;
  let neighbourhoodId;

  beforeEach(async () => {
    neighbourhoodId = new mongoose.Types.ObjectId();

    // Create test users
    user1 = await User.create({
      email: 'user1@example.com',
      password: 'password123',
      firstName: 'User',
      lastName: 'One',
      neighbourhoodId: neighbourhoodId,
      friends: []
    });

    user2 = await User.create({
      email: 'user2@example.com',
      password: 'password123',
      firstName: 'User',
      lastName: 'Two',
      neighbourhoodId: neighbourhoodId,
      friends: []
    });

    user3 = await User.create({
      email: 'user3@example.com',
      password: 'password123',
      firstName: 'User',
      lastName: 'Three',
      neighbourhoodId: neighbourhoodId,
      friends: []
    });

    // Set up app with auth middleware for user1
    app.use('/api/friends', mockAuth(user1._id.toString()), friendRoutes);
  });

  describe('GET /api/friends', () => {
    test('should return empty friends list initially', async () => {
      const response = await request(app)
        .get('/api/friends');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    test('should return user friends', async () => {
      // Add user2 as friend to user1
      user1.friends.push(user2._id);
      await user1.save();

      const response = await request(app)
        .get('/api/friends');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].firstName).toBe('User');
      expect(response.body[0].lastName).toBe('Two');
    });
  });

  describe('POST /api/friends/request', () => {
    test('should send friend request successfully', async () => {
      const response = await request(app)
        .post('/api/friends/request')
        .send({
          userId: user2._id.toString(),
          message: 'Let\'s be friends!'
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Friend request sent successfully');

      // Verify friend request was created
      const friendRequest = await FriendRequest.findOne({
        from: user1._id,
        to: user2._id
      });
      expect(friendRequest).toBeTruthy();
      expect(friendRequest.message).toBe('Let\'s be friends!');
    });

    test('should not allow sending request to self', async () => {
      const response = await request(app)
        .post('/api/friends/request')
        .send({
          userId: user1._id.toString()
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Cannot send friend request to yourself');
    });

    test('should not allow duplicate friend requests', async () => {
      // Create existing friend request
      await FriendRequest.create({
        from: user1._id,
        to: user2._id,
        status: 'pending'
      });

      const response = await request(app)
        .post('/api/friends/request')
        .send({
          userId: user2._id.toString()
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Friend request already exists');
    });

    test('should not allow request to already friends', async () => {
      // Make users friends
      user1.friends.push(user2._id);
      user2.friends.push(user1._id);
      await user1.save();
      await user2.save();

      const response = await request(app)
        .post('/api/friends/request')
        .send({
          userId: user2._id.toString()
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Already friends with this user');
    });
  });

  describe('GET /api/friends/requests', () => {
    test('should return received friend requests', async () => {
      // Create friend request to user1
      await FriendRequest.create({
        from: user2._id,
        to: user1._id,
        status: 'pending',
        message: 'Hi there!'
      });

      const response = await request(app)
        .get('/api/friends/requests?type=received');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].from.firstName).toBe('User');
      expect(response.body[0].from.lastName).toBe('Two');
      expect(response.body[0].message).toBe('Hi there!');
    });

    test('should return sent friend requests', async () => {
      // Create friend request from user1
      await FriendRequest.create({
        from: user1._id,
        to: user2._id,
        status: 'pending'
      });

      const response = await request(app)
        .get('/api/friends/requests?type=sent');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].to.firstName).toBe('User');
      expect(response.body[0].to.lastName).toBe('Two');
    });
  });

  describe('POST /api/friends/request/:requestId/accept', () => {
    test('should accept friend request successfully', async () => {
      // Create friend request to user1
      const friendRequest = await FriendRequest.create({
        from: user2._id,
        to: user1._id,
        status: 'pending'
      });

      const response = await request(app)
        .post(`/api/friends/request/${friendRequest._id}/accept`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Friend request accepted successfully');

      // Verify friend request status updated
      const updatedRequest = await FriendRequest.findById(friendRequest._id);
      expect(updatedRequest.status).toBe('accepted');

      // Verify users are now friends
      const updatedUser1 = await User.findById(user1._id);
      const updatedUser2 = await User.findById(user2._id);
      expect(updatedUser1.friends).toContain(user2._id);
      expect(updatedUser2.friends).toContain(user1._id);
    });

    test('should not accept non-existent request', async () => {
      const fakeRequestId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .post(`/api/friends/request/${fakeRequestId}/accept`);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Friend request not found');
    });
  });

  describe('POST /api/friends/request/:requestId/decline', () => {
    test('should decline friend request successfully', async () => {
      // Create friend request to user1
      const friendRequest = await FriendRequest.create({
        from: user2._id,
        to: user1._id,
        status: 'pending'
      });

      const response = await request(app)
        .post(`/api/friends/request/${friendRequest._id}/decline`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Friend request declined');

      // Verify friend request status updated
      const updatedRequest = await FriendRequest.findById(friendRequest._id);
      expect(updatedRequest.status).toBe('declined');

      // Verify users are not friends
      const updatedUser1 = await User.findById(user1._id);
      const updatedUser2 = await User.findById(user2._id);
      expect(updatedUser1.friends).not.toContain(user2._id);
      expect(updatedUser2.friends).not.toContain(user1._id);
    });
  });

  describe('DELETE /api/friends/request/:requestId', () => {
    test('should cancel sent friend request', async () => {
      // Create friend request from user1
      const friendRequest = await FriendRequest.create({
        from: user1._id,
        to: user2._id,
        status: 'pending'
      });

      const response = await request(app)
        .delete(`/api/friends/request/${friendRequest._id}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Friend request cancelled');

      // Verify friend request was deleted
      const deletedRequest = await FriendRequest.findById(friendRequest._id);
      expect(deletedRequest).toBeNull();
    });
  });

  describe('DELETE /api/friends/:friendId', () => {
    test('should remove friend successfully', async () => {
      // Make users friends
      user1.friends.push(user2._id);
      user2.friends.push(user1._id);
      await user1.save();
      await user2.save();

      const response = await request(app)
        .delete(`/api/friends/${user2._id}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Friend removed successfully');

      // Verify friendship was removed
      const updatedUser1 = await User.findById(user1._id);
      const updatedUser2 = await User.findById(user2._id);
      expect(updatedUser1.friends).not.toContain(user2._id);
      expect(updatedUser2.friends).not.toContain(user1._id);
    });

    test('should not remove non-friend', async () => {
      const response = await request(app)
        .delete(`/api/friends/${user2._id}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Not friends with this user');
    });
  });

  describe('GET /api/friends/status/:userId', () => {
    test('should return friend status', async () => {
      // Make users friends
      user1.friends.push(user2._id);
      await user1.save();

      const response = await request(app)
        .get(`/api/friends/status/${user2._id}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('friends');
    });

    test('should return request_sent status', async () => {
      // Create friend request from user1
      const friendRequest = await FriendRequest.create({
        from: user1._id,
        to: user2._id,
        status: 'pending'
      });

      const response = await request(app)
        .get(`/api/friends/status/${user2._id}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('request_sent');
      expect(response.body.requestId).toBe(friendRequest._id.toString());
    });

    test('should return request_received status', async () => {
      // Create friend request to user1
      const friendRequest = await FriendRequest.create({
        from: user2._id,
        to: user1._id,
        status: 'pending'
      });

      const response = await request(app)
        .get(`/api/friends/status/${user2._id}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('request_received');
      expect(response.body.requestId).toBe(friendRequest._id.toString());
    });

    test('should return none status', async () => {
      const response = await request(app)
        .get(`/api/friends/status/${user2._id}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('none');
    });

    test('should return self status', async () => {
      const response = await request(app)
        .get(`/api/friends/status/${user1._id}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('self');
    });
  });

  describe('GET /api/friends/search', () => {
    test('should search for users in same neighbourhood', async () => {
      const response = await request(app)
        .get('/api/friends/search?q=User');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2); // user2 and user3
      expect(response.body[0].friendStatus).toBe('none');
    });

    test('should include friend status in search results', async () => {
      // Make user1 and user2 friends
      user1.friends.push(user2._id);
      await user1.save();

      const response = await request(app)
        .get('/api/friends/search?q=User');

      expect(response.status).toBe(200);
      const user2Result = response.body.find(u => u._id.toString() === user2._id.toString());
      expect(user2Result.friendStatus).toBe('friends');
    });

    test('should require minimum search length', async () => {
      const response = await request(app)
        .get('/api/friends/search?q=U');

      expect(response.status).toBe(400);
      expect(response.body.errors[0].msg).toContain('at least 2 characters');
    });
  });
});