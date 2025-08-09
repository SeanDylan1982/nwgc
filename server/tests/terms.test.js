/**
 * Terms and Conditions Integration Tests
 * Tests the complete terms acceptance flow including API endpoints and middleware
 */
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../index');
const User = require('../models/User');
const TermsService = require('../services/TermsService');

describe('Terms and Conditions', () => {
  let testUser;
  let authToken;
  let adminUser;
  let adminToken;

  beforeAll(async () => {
    // Connect to test database - use Atlas test database
    if (mongoose.connection.readyState === 0) {
      const mongoUri = process.env.MONGO_URI_TEST || process.env.MONGO_URI;
      if (!mongoUri) {
        throw new Error('MONGO_URI or MONGO_URI_TEST environment variable is required for testing.');
      }
      await mongoose.connect(mongoUri);
    }
  });

  beforeEach(async () => {
    // Clean up database
    await User.deleteMany({});

    // Create test user
    testUser = new User({
      email: 'test@example.com',
      password: 'password123',
      firstName: 'Test',
      lastName: 'User',
      role: 'user'
    });
    await testUser.save();

    // Create admin user
    adminUser = new User({
      email: 'admin@example.com',
      password: 'password123',
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin'
    });
    await adminUser.save();

    // Get auth tokens
    const userResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123'
      });
    authToken = userResponse.body.token;

    const adminResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@example.com',
        password: 'password123'
      });
    adminToken = adminResponse.body.token;
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('TermsService', () => {
    describe('hasAcceptedTerms', () => {
      it('should return false for new user', async () => {
        const hasAccepted = await TermsService.hasAcceptedTerms(testUser._id, 'noticeBoardTerms');
        expect(hasAccepted).toBe(false);
      });

      it('should return true after accepting terms', async () => {
        await TermsService.acceptTerms(testUser._id, 'noticeBoardTerms');
        const hasAccepted = await TermsService.hasAcceptedTerms(testUser._id, 'noticeBoardTerms');
        expect(hasAccepted).toBe(true);
      });

      it('should throw error for invalid terms type', async () => {
        await expect(
          TermsService.hasAcceptedTerms(testUser._id, 'invalidTerms')
        ).rejects.toThrow('Invalid terms type');
      });

      it('should throw error for missing user ID', async () => {
        await expect(
          TermsService.hasAcceptedTerms(null, 'noticeBoardTerms')
        ).rejects.toThrow('User ID and terms type are required');
      });
    });

    describe('acceptTerms', () => {
      it('should successfully accept terms', async () => {
        const result = await TermsService.acceptTerms(testUser._id, 'reportTerms');
        
        expect(result.success).toBe(true);
        expect(result.alreadyAccepted).toBe(false);
        expect(result.timestamp).toBeDefined();
      });

      it('should handle already accepted terms', async () => {
        // Accept terms first time
        await TermsService.acceptTerms(testUser._id, 'reportTerms');
        
        // Try to accept again
        const result = await TermsService.acceptTerms(testUser._id, 'reportTerms');
        
        expect(result.success).toBe(true);
        expect(result.alreadyAccepted).toBe(true);
      });

      it('should throw error for non-existent user', async () => {
        const fakeUserId = new mongoose.Types.ObjectId();
        await expect(
          TermsService.acceptTerms(fakeUserId, 'noticeBoardTerms')
        ).rejects.toThrow('User not found');
      });
    });

    describe('checkActionPermission', () => {
      it('should deny action when terms not accepted', async () => {
        const permission = await TermsService.checkActionPermission(testUser._id, 'createNotice');
        
        expect(permission.allowed).toBe(false);
        expect(permission.requiredTerms).toBe('noticeBoardTerms');
        expect(permission.action).toBe('createNotice');
      });

      it('should allow action when terms accepted', async () => {
        await TermsService.acceptTerms(testUser._id, 'noticeBoardTerms');
        
        const permission = await TermsService.checkActionPermission(testUser._id, 'createNotice');
        
        expect(permission.allowed).toBe(true);
      });

      it('should throw error for invalid action', async () => {
        await expect(
          TermsService.checkActionPermission(testUser._id, 'invalidAction')
        ).rejects.toThrow('Invalid action');
      });
    });

    describe('getUserTermsStatus', () => {
      it('should return all terms status', async () => {
        const status = await TermsService.getUserTermsStatus(testUser._id);
        
        expect(status).toHaveProperty('noticeBoardTerms');
        expect(status).toHaveProperty('reportTerms');
        expect(status.noticeBoardTerms.accepted).toBe(false);
        expect(status.reportTerms.accepted).toBe(false);
      });

      it('should reflect accepted terms', async () => {
        await TermsService.acceptTerms(testUser._id, 'noticeBoardTerms');
        
        const status = await TermsService.getUserTermsStatus(testUser._id);
        
        expect(status.noticeBoardTerms.accepted).toBe(true);
        expect(status.noticeBoardTerms.timestamp).toBeDefined();
        expect(status.reportTerms.accepted).toBe(false);
      });
    });
  });

  describe('API Endpoints', () => {
    describe('GET /api/terms/status', () => {
      it('should return user terms status', async () => {
        const response = await request(app)
          .get('/api/terms/status')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('noticeBoardTerms');
        expect(response.body.data).toHaveProperty('reportTerms');
      });

      it('should require authentication', async () => {
        const response = await request(app)
          .get('/api/terms/status');

        expect(response.status).toBe(401);
      });
    });

    describe('POST /api/terms/accept', () => {
      it('should accept terms successfully', async () => {
        const response = await request(app)
          .post('/api/terms/accept')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ termsType: 'noticeBoardTerms' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.accepted).toBe(true);
        expect(response.body.data.alreadyAccepted).toBe(false);
      });

      it('should handle already accepted terms', async () => {
        // Accept terms first
        await request(app)
          .post('/api/terms/accept')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ termsType: 'reportTerms' });

        // Try to accept again
        const response = await request(app)
          .post('/api/terms/accept')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ termsType: 'reportTerms' });

        expect(response.status).toBe(200);
        expect(response.body.data.alreadyAccepted).toBe(true);
      });

      it('should validate terms type', async () => {
        const response = await request(app)
          .post('/api/terms/accept')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ termsType: 'invalidTerms' });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });

      it('should require terms type', async () => {
        const response = await request(app)
          .post('/api/terms/accept')
          .set('Authorization', `Bearer ${authToken}`)
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('required');
      });
    });

    describe('GET /api/terms/check/:termsType', () => {
      it('should check terms acceptance', async () => {
        const response = await request(app)
          .get('/api/terms/check/noticeBoardTerms')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.accepted).toBe(false);
      });

      it('should validate terms type', async () => {
        const response = await request(app)
          .get('/api/terms/check/invalidTerms')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(400);
      });
    });

    describe('GET /api/terms/permission/:action', () => {
      it('should check action permission', async () => {
        const response = await request(app)
          .get('/api/terms/permission/createNotice')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.allowed).toBe(false);
        expect(response.body.data.requiredTerms).toBe('noticeBoardTerms');
      });

      it('should validate action type', async () => {
        const response = await request(app)
          .get('/api/terms/permission/invalidAction')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(400);
      });
    });

    describe('Admin endpoints', () => {
      describe('GET /api/terms/stats/:termsType', () => {
        it('should return terms statistics for admin', async () => {
          const response = await request(app)
            .get('/api/terms/stats/noticeBoardTerms')
            .set('Authorization', `Bearer ${adminToken}`);

          expect(response.status).toBe(200);
          expect(response.body.success).toBe(true);
          expect(response.body.data).toHaveProperty('totalUsers');
          expect(response.body.data).toHaveProperty('acceptedUsers');
          expect(response.body.data).toHaveProperty('acceptanceRate');
        });

        it('should deny access to regular users', async () => {
          const response = await request(app)
            .get('/api/terms/stats/noticeBoardTerms')
            .set('Authorization', `Bearer ${authToken}`);

          expect(response.status).toBe(403);
        });
      });

      describe('POST /api/terms/reset', () => {
        it('should reset terms acceptance for admin', async () => {
          // First accept terms
          await TermsService.acceptTerms(testUser._id, 'noticeBoardTerms');

          // Reset as admin
          const response = await request(app)
            .post('/api/terms/reset')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
              userId: testUser._id.toString(),
              termsType: 'noticeBoardTerms'
            });

          expect(response.status).toBe(200);
          expect(response.body.success).toBe(true);

          // Verify terms were reset
          const hasAccepted = await TermsService.hasAcceptedTerms(testUser._id, 'noticeBoardTerms');
          expect(hasAccepted).toBe(false);
        });

        it('should deny access to regular users', async () => {
          const response = await request(app)
            .post('/api/terms/reset')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              userId: testUser._id.toString(),
              termsType: 'noticeBoardTerms'
            });

          expect(response.status).toBe(403);
        });
      });
    });
  });

  describe('Terms Middleware Integration', () => {
    it('should block notice creation without terms acceptance', async () => {
      const response = await request(app)
        .post('/api/notices')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Notice',
          content: 'Test content',
          category: 'general'
        });

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('TERMS_NOT_ACCEPTED');
      expect(response.body.requiredTerms).toBe('noticeBoardTerms');
    });

    it('should allow notice creation after terms acceptance', async () => {
      // Accept terms first
      await TermsService.acceptTerms(testUser._id, 'noticeBoardTerms');

      const response = await request(app)
        .post('/api/notices')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Notice',
          content: 'Test content',
          category: 'general'
        });

      expect(response.status).not.toBe(403);
    });

    it('should allow admin to bypass terms', async () => {
      const response = await request(app)
        .post('/api/notices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Admin Notice',
          content: 'Admin content',
          category: 'general'
        });

      expect(response.status).not.toBe(403);
    });

    it('should block report creation without terms acceptance', async () => {
      const response = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Report',
          description: 'Test description',
          category: 'security'
        });

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('TERMS_NOT_ACCEPTED');
      expect(response.body.requiredTerms).toBe('reportTerms');
    });

    it('should allow report creation after terms acceptance', async () => {
      // Accept terms first
      await TermsService.acceptTerms(testUser._id, 'reportTerms');

      const response = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Report',
          description: 'Test description',
          category: 'security'
        });

      expect(response.status).not.toBe(403);
    });
  });
});