const mongoose = require('mongoose');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const adminRoutes = require('../routes/admin');
const { authenticateToken } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/adminAuth');

// Mock dependencies
jest.mock('../models/User');
jest.mock('../models/AuditLog');
jest.mock('../models/Notice');
jest.mock('../models/Report');
jest.mock('../models/ChatGroup');
jest.mock('../models/Message');
jest.mock('jsonwebtoken');

// Create express app for testing
const app = express();
app.use(express.json());
app.use('/api/admin', authenticateToken, requireAdmin, adminRoutes);

describe('Admin Routes', () => {
  let mockAdminUser;
  let mockRegularUser;
  let mockToken;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock admin user
    mockAdminUser = {
      _id: 'admin123',
      email: 'admin@test.com',
      role: 'admin',
      status: 'active'
    };

    // Mock regular user
    mockRegularUser = {
      _id: 'user123',
      email: 'user@test.com',
      role: 'user',
      status: 'active',
      save: jest.fn().mockResolvedValue(true)
    };

    // Mock JWT verification
    jwt.verify.mockImplementation(() => ({ userId: 'admin123' }));

    // Mock User.findById for auth middleware
    User.findById.mockImplementation((id) => {
      if (id === 'admin123') {
        return {
          select: jest.fn().mockResolvedValue(mockAdminUser)
        };
      } else if (id === 'user123') {
        return {
          select: jest.fn().mockResolvedValue(mockRegularUser)
        };
      }
      return { select: jest.fn().mockResolvedValue(null) };
    });

    // Mock token
    mockToken = 'valid.admin.token';
  });

  describe('User Management', () => {
    test('Should update user status successfully', async () => {
      // Mock User.findById for the route handler
      User.findById.mockImplementationOnce(() => ({
        ...mockRegularUser,
        save: jest.fn().mockResolvedValue(true)
      }));

      // Mock AuditLog.prototype.save
      const mockSave = jest.fn().mockResolvedValue(true);
      AuditLog.prototype.save = mockSave;

      const response = await request(app)
        .patch('/api/admin/users/user123/status')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          status: 'suspended',
          reason: 'Violation of community guidelines'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('User status updated successfully');
      expect(mockSave).toHaveBeenCalled();
    });

    test('Should not allow admin to change their own status', async () => {
      const response = await request(app)
        .patch('/api/admin/users/admin123/status')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          status: 'suspended',
          reason: 'Testing'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Cannot change your own status');
    });

    test('Should update user role successfully', async () => {
      // Mock User.findById for the route handler
      User.findById.mockImplementationOnce(() => ({
        ...mockRegularUser,
        save: jest.fn().mockResolvedValue(true)
      }));

      // Mock AuditLog.prototype.save
      const mockSave = jest.fn().mockResolvedValue(true);
      AuditLog.prototype.save = mockSave;

      const response = await request(app)
        .patch('/api/admin/users/user123/role')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          role: 'moderator',
          reason: 'Trusted community member'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('User role updated successfully');
      expect(mockSave).toHaveBeenCalled();
    });

    test('Should not allow admin to demote themselves', async () => {
      const response = await request(app)
        .patch('/api/admin/users/admin123/role')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          role: 'user',
          reason: 'Testing'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Cannot change your own admin role');
    });
  });

  describe('Audit Logs', () => {
    test('Should retrieve audit logs successfully', async () => {
      // Mock AuditLog.find
      const mockLogs = [
        {
          _id: 'log1',
          adminId: 'admin123',
          action: 'user_suspend',
          targetType: 'user',
          targetId: 'user123',
          details: { reason: 'Violation' },
          createdAt: new Date()
        }
      ];

      AuditLog.countDocuments = jest.fn().mockResolvedValue(1);
      AuditLog.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockLogs)
      });

      const response = await request(app)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${mockToken}`)
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(AuditLog.find).toHaveBeenCalled();
    });
  });

  describe('Content Moderation', () => {
    test('Should moderate content successfully', async () => {
      // Mock content model
      const mockContent = {
        _id: 'notice123',
        status: 'active',
        save: jest.fn().mockResolvedValue(true)
      };

      // Mock Notice.findById
      const Notice = require('../models/Notice');
      Notice.findById.mockResolvedValue(mockContent);

      // Mock AuditLog.prototype.save
      const mockSave = jest.fn().mockResolvedValue(true);
      AuditLog.prototype.save = mockSave;

      const response = await request(app)
        .patch('/api/admin/content/notice/notice123/status')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          status: 'removed',
          moderationReason: 'Inappropriate content'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Content status updated successfully');
      expect(mockContent.save).toHaveBeenCalled();
      expect(mockSave).toHaveBeenCalled();
    });
  });
});