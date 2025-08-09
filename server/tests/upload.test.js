const request = require('supertest');
const express = require('express');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const uploadRoutes = require('../routes/upload');
const User = require('../models/User');
const auth = require('../middleware/auth');

let mongoServer;
let app;

// Mock auth middleware for testing
const mockAuth = (req, res, next) => {
  req.user = { userId: 'testUserId' };
  next();
};

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);

  // Create test app
  app = express();
  app.use(express.json());
  app.use('/api/upload', mockAuth, uploadRoutes);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
  
  // Clean up test uploads
  const uploadDirs = ['uploads/profiles', 'uploads/notices', 'uploads/reports', 'uploads/messages'];
  uploadDirs.forEach(dir => {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

beforeEach(async () => {
  await User.deleteMany({});
  
  // Create test user
  await User.create({
    _id: 'testUserId',
    email: 'test@example.com',
    password: 'password123',
    firstName: 'Test',
    lastName: 'User'
  });
});

describe('File Upload Routes', () => {
  describe('POST /api/upload/profile-image', () => {
    test('should upload profile image successfully', async () => {
      // Create a test image file
      const testImagePath = path.join(__dirname, 'test-image.jpg');
      fs.writeFileSync(testImagePath, 'fake image data');

      const response = await request(app)
        .post('/api/upload/profile-image')
        .attach('profileImage', testImagePath);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Profile image uploaded successfully');
      expect(response.body.file).toHaveProperty('url');
      expect(response.body.file).toHaveProperty('filename');
      expect(response.body.file).toHaveProperty('size');

      // Check if user's profile image URL was updated
      const user = await User.findById('testUserId');
      expect(user.profileImageUrl).toBe(response.body.file.url);

      // Clean up
      fs.unlinkSync(testImagePath);
    });

    test('should return error when no file uploaded', async () => {
      const response = await request(app)
        .post('/api/upload/profile-image');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('No file uploaded');
    });

    test('should reject invalid file types', async () => {
      // Create a test text file
      const testFilePath = path.join(__dirname, 'test-file.txt');
      fs.writeFileSync(testFilePath, 'This is not an image');

      const response = await request(app)
        .post('/api/upload/profile-image')
        .attach('profileImage', testFilePath);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid file type');

      // Clean up
      fs.unlinkSync(testFilePath);
    });
  });

  describe('POST /api/upload/media', () => {
    test('should upload multiple media files successfully', async () => {
      // Create test files
      const testImage = path.join(__dirname, 'test-image.jpg');
      const testVideo = path.join(__dirname, 'test-video.mp4');
      fs.writeFileSync(testImage, 'fake image data');
      fs.writeFileSync(testVideo, 'fake video data');

      const response = await request(app)
        .post('/api/upload/media')
        .attach('media', testImage)
        .attach('media', testVideo);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.files).toHaveLength(2);
      expect(response.body.message).toBe('2 file(s) uploaded successfully');

      // Check file info
      response.body.files.forEach(file => {
        expect(file).toHaveProperty('url');
        expect(file).toHaveProperty('filename');
        expect(file).toHaveProperty('size');
        expect(file).toHaveProperty('type');
      });

      // Clean up
      fs.unlinkSync(testImage);
      fs.unlinkSync(testVideo);
    });

    test('should return error when no files uploaded', async () => {
      const response = await request(app)
        .post('/api/upload/media');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('No files uploaded');
    });
  });

  describe('POST /api/upload/message-file', () => {
    test('should upload single file for message successfully', async () => {
      // Create a test document
      const testDoc = path.join(__dirname, 'test-document.pdf');
      fs.writeFileSync(testDoc, 'fake pdf data');

      const response = await request(app)
        .post('/api/upload/message-file')
        .attach('file', testDoc);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('File uploaded successfully');
      expect(response.body.file).toHaveProperty('url');
      expect(response.body.file.type).toBe('file');

      // Clean up
      fs.unlinkSync(testDoc);
    });
  });

  describe('File access and deletion', () => {
    test('should serve uploaded files', async () => {
      // First upload a file
      const testImage = path.join(__dirname, 'test-image.jpg');
      fs.writeFileSync(testImage, 'fake image data');

      const uploadResponse = await request(app)
        .post('/api/upload/profile-image')
        .attach('profileImage', testImage);

      expect(uploadResponse.status).toBe(200);

      // Extract file path from URL
      const fileUrl = uploadResponse.body.file.url;
      const filePath = fileUrl.replace('/uploads/', '');

      // Try to access the file
      const accessResponse = await request(app)
        .get(`/api/upload/file/${filePath}`);

      expect(accessResponse.status).toBe(200);

      // Clean up
      fs.unlinkSync(testImage);
    });

    test('should delete uploaded files', async () => {
      // First upload a file
      const testImage = path.join(__dirname, 'test-image.jpg');
      fs.writeFileSync(testImage, 'fake image data');

      const uploadResponse = await request(app)
        .post('/api/upload/profile-image')
        .attach('profileImage', testImage);

      expect(uploadResponse.status).toBe(200);

      // Extract file path from URL
      const fileUrl = uploadResponse.body.file.url;
      const filePath = fileUrl.replace('/uploads/', '');

      // Delete the file
      const deleteResponse = await request(app)
        .delete(`/api/upload/file/${filePath}`);

      expect(deleteResponse.status).toBe(200);
      expect(deleteResponse.body.success).toBe(true);
      expect(deleteResponse.body.message).toBe('File deleted successfully');

      // Clean up
      fs.unlinkSync(testImage);
    });

    test('should prevent directory traversal attacks', async () => {
      const response = await request(app)
        .get('/api/upload/file/../../../etc/passwd');

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access denied');
    });
  });

  describe('File size and count limits', () => {
    test('should reject files that are too large', async () => {
      // Create a large file (simulate by setting a very small limit in test)
      const testFile = path.join(__dirname, 'large-file.jpg');
      const largeData = Buffer.alloc(15 * 1024 * 1024); // 15MB
      fs.writeFileSync(testFile, largeData);

      const response = await request(app)
        .post('/api/upload/profile-image')
        .attach('profileImage', testFile);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('File too large');

      // Clean up
      fs.unlinkSync(testFile);
    });

    test('should reject too many files', async () => {
      // Create 6 test files (limit is 5)
      const testFiles = [];
      for (let i = 0; i < 6; i++) {
        const testFile = path.join(__dirname, `test-file-${i}.jpg`);
        fs.writeFileSync(testFile, `fake image data ${i}`);
        testFiles.push(testFile);
      }

      let request_builder = request(app).post('/api/upload/media');
      
      testFiles.forEach(file => {
        request_builder = request_builder.attach('media', file);
      });

      const response = await request_builder;

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Too many files');

      // Clean up
      testFiles.forEach(file => {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      });
    });
  });
});

describe('Upload Utility Functions', () => {
  const { getFileType, formatFileInfo } = require('../middleware/upload');

  test('should correctly identify file types', () => {
    expect(getFileType('image/jpeg')).toBe('image');
    expect(getFileType('video/mp4')).toBe('video');
    expect(getFileType('application/pdf')).toBe('file');
    expect(getFileType('text/plain')).toBe('file');
  });

  test('should format file info correctly', () => {
    const mockFile = {
      originalname: 'test-image.jpg',
      mimetype: 'image/jpeg',
      size: 1024,
      path: 'uploads/profiles/test-image-123.jpg'
    };

    const fileInfo = formatFileInfo(mockFile);

    expect(fileInfo.type).toBe('image');
    expect(fileInfo.filename).toBe('test-image.jpg');
    expect(fileInfo.size).toBe(1024);
    expect(fileInfo.url).toContain('/uploads/');
  });
});