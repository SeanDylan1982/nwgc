/**
 * Tests for Legal Document System
 * Verifies document creation, retrieval, and version management
 */
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../index'); // Assuming your main app file exports the app
const User = require('../models/User');
const LegalDocument = require('../models/LegalDocument');
const LegalDocumentService = require('../services/LegalDocumentService');
const jwt = require('jsonwebtoken');

describe('Legal Document System', () => {
  let mongoServer;
  let adminUser;
  let regularUser;
  let adminToken;
  let userToken;

  beforeAll(async () => {
    // Start in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear database
    await User.deleteMany({});
    await LegalDocument.deleteMany({});

    // Create test users
    adminUser = new User({
      email: 'admin@test.com',
      password: 'password123',
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin'
    });
    await adminUser.save();

    regularUser = new User({
      email: 'user@test.com',
      password: 'password123',
      firstName: 'Regular',
      lastName: 'User',
      role: 'user'
    });
    await regularUser.save();

    // Generate tokens
    adminToken = jwt.sign(
      { id: adminUser._id, email: adminUser.email },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    userToken = jwt.sign(
      { id: regularUser._id, email: regularUser.email },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  });

  describe('LegalDocumentService', () => {
    test('should initialize default documents', async () => {
      await LegalDocumentService.initializeDefaultDocuments();

      const termsDoc = await LegalDocument.findOne({ type: 'termsOfService' });
      const privacyDoc = await LegalDocument.findOne({ type: 'privacyPolicy' });

      expect(termsDoc).toBeTruthy();
      expect(termsDoc.active).toBe(true);
      expect(termsDoc.version).toBe('1.0.0');
      expect(termsDoc.content).toContain('Terms of Service');

      expect(privacyDoc).toBeTruthy();
      expect(privacyDoc.active).toBe(true);
      expect(privacyDoc.version).toBe('1.0.0');
      expect(privacyDoc.content).toContain('Privacy Policy');
      expect(privacyDoc.content).toContain('POPIA');
    });

    test('should get active document by type', async () => {
      await LegalDocumentService.initializeDefaultDocuments();

      const termsDoc = await LegalDocumentService.getActiveDocument('termsOfService');
      
      expect(termsDoc).toBeTruthy();
      expect(termsDoc.type).toBe('termsOfService');
      expect(termsDoc.active).toBe(true);
    });

    test('should create new version when updating document', async () => {
      await LegalDocumentService.initializeDefaultDocuments();

      const newContent = '# Updated Terms of Service\n\nThis is version 2.0';
      const updatedDoc = await LegalDocumentService.createOrUpdateDocument(
        'termsOfService',
        newContent,
        { version: '2.0.0', modifiedBy: adminUser._id }
      );

      expect(updatedDoc.version).toBe('2.0.0');
      expect(updatedDoc.content).toBe(newContent);
      expect(updatedDoc.active).toBe(true);

      // Check that old version is deactivated
      const oldDoc = await LegalDocument.findOne({ 
        type: 'termsOfService', 
        version: '1.0.0' 
      });
      expect(oldDoc.active).toBe(false);
    });

    test('should check user acceptance status correctly', async () => {
      await LegalDocumentService.initializeDefaultDocuments();

      // User without acceptance
      let status = await LegalDocumentService.checkUserAcceptanceStatus(
        regularUser._id, 
        'termsOfService'
      );
      expect(status.needsAcceptance).toBe(true);
      expect(status.reason).toBe('Not accepted');

      // User with acceptance
      regularUser.legalAcceptance = {
        termsOfService: {
          accepted: true,
          version: '1.0.0',
          timestamp: new Date()
        }
      };
      await regularUser.save();

      status = await LegalDocumentService.checkUserAcceptanceStatus(
        regularUser._id, 
        'termsOfService'
      );
      expect(status.needsAcceptance).toBe(false);
    });
  });

  describe('Legal Document API Routes', () => {
    beforeEach(async () => {
      await LegalDocumentService.initializeDefaultDocuments();
    });

    test('GET /api/legal/document/:type should return document', async () => {
      const response = await request(app)
        .get('/api/legal/document/termsOfService')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.document.type).toBe('termsOfService');
      expect(response.body.document.content).toContain('Terms of Service');
    });

    test('GET /api/legal/document/:type should return 404 for non-existent document', async () => {
      await LegalDocument.deleteMany({});

      const response = await request(app)
        .get('/api/legal/document/termsOfService')
        .expect(404);

      expect(response.body.error).toBe('Document not found');
    });

    test('GET /api/legal/acceptance-status should return user acceptance status', async () => {
      const response = await request(app)
        .get('/api/legal/acceptance-status')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.acceptanceStatus).toHaveProperty('termsOfService');
      expect(response.body.acceptanceStatus).toHaveProperty('privacyPolicy');
      expect(response.body.acceptanceStatus.termsOfService.accepted).toBe(false);
    });

    test('POST /api/legal/accept-terms should accept terms', async () => {
      const response = await request(app)
        .post('/api/legal/accept-terms')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ type: 'termsOfService', version: '1.0.0' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.acceptance.accepted).toBe(true);
      expect(response.body.acceptance.type).toBe('termsOfService');

      // Verify in database
      const updatedUser = await User.findById(regularUser._id);
      expect(updatedUser.legalAcceptance.termsOfService.accepted).toBe(true);
      expect(updatedUser.legalAcceptance.termsOfService.version).toBe('1.0.0');
    });

    test('POST /api/legal/accept-terms should validate terms type', async () => {
      const response = await request(app)
        .post('/api/legal/accept-terms')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ type: 'invalidType' })
        .expect(400);

      expect(response.body.error).toBe('Invalid terms type');
    });

    test('GET /api/legal/check-acceptance/:type should check specific acceptance', async () => {
      // Accept terms first
      await request(app)
        .post('/api/legal/accept-terms')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ type: 'termsOfService', version: '1.0.0' });

      const response = await request(app)
        .get('/api/legal/check-acceptance/termsOfService')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.accepted).toBe(true);
      expect(response.body.type).toBe('termsOfService');
    });

    test('POST /api/legal/initialize-documents should require admin role', async () => {
      // Regular user should be denied
      await request(app)
        .post('/api/legal/initialize-documents')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      // Admin should succeed
      await request(app)
        .post('/api/legal/initialize-documents')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });

  describe('Registration with Terms Acceptance', () => {
    test('should require terms acceptance during registration', async () => {
      await LegalDocumentService.initializeDefaultDocuments();

      const registrationData = {
        email: 'newuser@test.com',
        password: 'password123',
        firstName: 'New',
        lastName: 'User',
        acceptedTerms: {
          termsOfService: true,
          privacyPolicy: true
        }
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(registrationData)
        .expect(201);

      expect(response.body.user).toBeTruthy();
      
      // Check that terms were recorded
      const newUser = await User.findOne({ email: 'newuser@test.com' });
      expect(newUser.legalAcceptance.termsOfService.accepted).toBe(true);
      expect(newUser.legalAcceptance.privacyPolicy.accepted).toBe(true);
    });

    test('should reject registration without terms acceptance', async () => {
      const registrationData = {
        email: 'newuser@test.com',
        password: 'password123',
        firstName: 'New',
        lastName: 'User'
        // Missing acceptedTerms
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(registrationData)
        .expect(400);

      expect(response.body.message).toContain('Terms of Service and Privacy Policy');
    });
  });
});