const mongoose = require('mongoose');
const ModerationService = require('../services/ModerationService');
const Notice = require('../models/Notice');
const Report = require('../models/Report');
const Message = require('../models/Message');
const AuditService = require('../services/AuditService');
const RealTimeService = require('../services/RealTimeService');

// Import vitest functions
const { describe, it, expect, beforeEach, afterEach, vi } = require('vitest');

// Mock dependencies
vi.mock('../services/AuditService', () => ({
  logAction: vi.fn().mockResolvedValue({ _id: 'mock-audit-log-id' })
}));

vi.mock('../services/RealTimeService', () => ({
  sendNotification: vi.fn()
}));

// Mock mongoose models
vi.mock('../models/Notice', () => ({
  findById: vi.fn(),
  countDocuments: vi.fn().mockResolvedValue(5),
  find: vi.fn().mockReturnValue({
    populate: vi.fn().mockReturnThis(),
    sort: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([
      {
        _id: 'notice-1',
        title: 'Test Notice',
        content: 'Test content',
        status: 'active',
        toObject: () => ({
          _id: 'notice-1',
          title: 'Test Notice',
          content: 'Test content',
          status: 'active'
        })
      }
    ])
  })
}));

vi.mock('../models/Report', () => ({
  findById: vi.fn(),
  countDocuments: vi.fn().mockResolvedValue(3),
  find: vi.fn().mockReturnValue({
    populate: vi.fn().mockReturnThis(),
    sort: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([
      {
        _id: 'report-1',
        title: 'Test Report',
        description: 'Test description',
        reportStatus: 'active',
        toObject: () => ({
          _id: 'report-1',
          title: 'Test Report',
          description: 'Test description',
          reportStatus: 'active'
        })
      }
    ])
  })
}));

vi.mock('../models/Message', () => ({
  findById: vi.fn(),
  countDocuments: vi.fn().mockResolvedValue(10),
  find: vi.fn().mockReturnValue({
    populate: vi.fn().mockReturnThis(),
    sort: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([
      {
        _id: 'message-1',
        content: 'Test message',
        moderationStatus: 'active',
        toObject: () => ({
          _id: 'message-1',
          content: 'Test message',
          moderationStatus: 'active'
        })
      }
    ])
  })
}));

describe('ModerationService', () => {
  const mockNotice = {
    _id: 'notice-1',
    title: 'Test Notice',
    content: 'Test content',
    status: 'active',
    save: vi.fn().mockResolvedValue({
      _id: 'notice-1',
      title: 'Test Notice',
      content: 'Test content',
      status: 'archived',
      moderationReason: 'Test reason',
      moderatedBy: 'admin-1',
      moderatedAt: new Date()
    })
  };

  const mockReport = {
    _id: 'report-1',
    title: 'Test Report',
    description: 'Test description',
    reportStatus: 'active',
    reporterId: 'user-1',
    save: vi.fn().mockResolvedValue({
      _id: 'report-1',
      title: 'Test Report',
      description: 'Test description',
      reportStatus: 'removed',
      moderationReason: 'Test reason',
      moderatedBy: 'admin-1',
      moderatedAt: new Date()
    })
  };

  const mockMessage = {
    _id: 'message-1',
    content: 'Test message',
    moderationStatus: 'active',
    senderId: 'user-2',
    save: vi.fn().mockResolvedValue({
      _id: 'message-1',
      content: 'Test message',
      moderationStatus: 'removed',
      moderationReason: 'Test reason',
      moderatedBy: 'admin-1',
      moderatedAt: new Date()
    })
  };

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
  });

  describe('updateContentStatus', () => {
    it('should update notice status and log action', async () => {
      Notice.findById.mockResolvedValue(mockNotice);

      const result = await ModerationService.updateContentStatus({
        contentType: 'notice',
        contentId: 'notice-1',
        status: 'archived',
        moderationReason: 'Test reason',
        adminId: 'admin-1'
      });

      expect(Notice.findById).toHaveBeenCalledWith('notice-1');
      expect(mockNotice.save).toHaveBeenCalled();
      expect(mockNotice.status).toBe('archived');
      expect(mockNotice.moderationReason).toBe('Test reason');
      expect(mockNotice.moderatedBy).toBe('admin-1');
      expect(mockNotice.moderatedAt).toBeInstanceOf(Date);
      
      expect(AuditService.logAction).toHaveBeenCalledWith({
        adminId: 'admin-1',
        action: 'content_moderate',
        targetType: 'notice',
        targetId: 'notice-1',
        details: {
          oldStatus: 'active',
          newStatus: 'archived',
          reason: 'Test reason'
        }
      });
      
      expect(RealTimeService.sendNotification).toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({
        _id: 'notice-1',
        status: 'archived'
      }));
    });

    it('should update report status and log action', async () => {
      Report.findById.mockResolvedValue(mockReport);

      const result = await ModerationService.updateContentStatus({
        contentType: 'report',
        contentId: 'report-1',
        status: 'removed',
        moderationReason: 'Test reason',
        adminId: 'admin-1'
      });

      expect(Report.findById).toHaveBeenCalledWith('report-1');
      expect(mockReport.save).toHaveBeenCalled();
      expect(mockReport.reportStatus).toBe('removed');
      expect(mockReport.moderationReason).toBe('Test reason');
      expect(mockReport.moderatedBy).toBe('admin-1');
      expect(mockReport.moderatedAt).toBeInstanceOf(Date);
      
      expect(AuditService.logAction).toHaveBeenCalledWith({
        adminId: 'admin-1',
        action: 'content_moderate',
        targetType: 'report',
        targetId: 'report-1',
        details: {
          oldStatus: 'active',
          newStatus: 'removed',
          reason: 'Test reason'
        }
      });
      
      expect(RealTimeService.sendNotification).toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({
        _id: 'report-1',
        reportStatus: 'removed'
      }));
    });

    it('should update message status and log action', async () => {
      Message.findById.mockResolvedValue(mockMessage);

      const result = await ModerationService.updateContentStatus({
        contentType: 'message',
        contentId: 'message-1',
        status: 'removed',
        moderationReason: 'Test reason',
        adminId: 'admin-1'
      });

      expect(Message.findById).toHaveBeenCalledWith('message-1');
      expect(mockMessage.save).toHaveBeenCalled();
      expect(mockMessage.moderationStatus).toBe('removed');
      expect(mockMessage.moderationReason).toBe('Test reason');
      expect(mockMessage.moderatedBy).toBe('admin-1');
      expect(mockMessage.moderatedAt).toBeInstanceOf(Date);
      
      expect(AuditService.logAction).toHaveBeenCalledWith({
        adminId: 'admin-1',
        action: 'content_moderate',
        targetType: 'chat',
        targetId: 'message-1',
        details: {
          oldStatus: 'active',
          newStatus: 'removed',
          reason: 'Test reason'
        }
      });
      
      expect(result).toEqual(expect.objectContaining({
        _id: 'message-1',
        moderationStatus: 'removed'
      }));
    });

    it('should throw error for invalid content type', async () => {
      await expect(ModerationService.updateContentStatus({
        contentType: 'invalid',
        contentId: 'content-1',
        status: 'archived',
        moderationReason: 'Test reason',
        adminId: 'admin-1'
      })).rejects.toThrow('Invalid content type');
    });

    it('should throw error when content not found', async () => {
      Notice.findById.mockResolvedValue(null);

      await expect(ModerationService.updateContentStatus({
        contentType: 'notice',
        contentId: 'notice-1',
        status: 'archived',
        moderationReason: 'Test reason',
        adminId: 'admin-1'
      })).rejects.toThrow('Content not found');
    });
  });

  describe('editContent', () => {
    it('should edit notice content and log action', async () => {
      Notice.findById.mockResolvedValue({
        ...mockNotice,
        title: 'Original Title',
        content: 'Original content'
      });

      const updates = {
        title: 'Updated Title',
        content: 'Updated content'
      };

      const result = await ModerationService.editContent({
        contentType: 'notice',
        contentId: 'notice-1',
        updates,
        moderationReason: 'Content edited',
        adminId: 'admin-1'
      });

      expect(Notice.findById).toHaveBeenCalledWith('notice-1');
      expect(mockNotice.save).toHaveBeenCalled();
      expect(mockNotice.title).toBe('Updated Title');
      expect(mockNotice.content).toBe('Updated content');
      expect(mockNotice.moderationReason).toBe('Content edited');
      expect(mockNotice.moderatedBy).toBe('admin-1');
      expect(mockNotice.moderatedAt).toBeInstanceOf(Date);
      expect(mockNotice.isEdited).toBe(true);
      
      expect(AuditService.logAction).toHaveBeenCalledWith({
        adminId: 'admin-1',
        action: 'content_edit',
        targetType: 'notice',
        targetId: 'notice-1',
        details: expect.objectContaining({
          originalValues: {
            title: 'Original Title',
            content: 'Original content'
          },
          newValues: updates,
          reason: 'Content edited'
        })
      });
      
      expect(RealTimeService.sendNotification).toHaveBeenCalled();
    });
  });

  describe('restoreContent', () => {
    it('should restore content to active status', async () => {
      // Setup spy on updateContentStatus
      const updateContentStatusSpy = vi.spyOn(ModerationService, 'updateContentStatus');
      updateContentStatusSpy.mockResolvedValue({
        _id: 'notice-1',
        title: 'Test Notice',
        content: 'Test content',
        status: 'active'
      });

      const result = await ModerationService.restoreContent({
        contentType: 'notice',
        contentId: 'notice-1',
        moderationReason: 'Content restored',
        adminId: 'admin-1'
      });

      expect(updateContentStatusSpy).toHaveBeenCalledWith({
        contentType: 'notice',
        contentId: 'notice-1',
        status: 'active',
        moderationReason: 'Content restored',
        adminId: 'admin-1'
      });

      expect(result).toEqual(expect.objectContaining({
        _id: 'notice-1',
        status: 'active'
      }));
    });
  });

  describe('getModeratedContent', () => {
    it('should get moderated notices', async () => {
      const result = await ModerationService.getModeratedContent({
        contentType: 'notice',
        status: 'all',
        page: 1,
        limit: 10
      });

      expect(Notice.countDocuments).toHaveBeenCalled();
      expect(Notice.find).toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({
        total: 5,
        page: 1,
        limit: 10
      }));
      expect(result.content.length).toBeGreaterThan(0);
    });

    it('should get moderated reports', async () => {
      const result = await ModerationService.getModeratedContent({
        contentType: 'report',
        status: 'all',
        page: 1,
        limit: 10
      });

      expect(Report.countDocuments).toHaveBeenCalled();
      expect(Report.find).toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({
        total: 3,
        page: 1,
        limit: 10
      }));
      expect(result.content.length).toBeGreaterThan(0);
    });

    it('should get moderated messages', async () => {
      const result = await ModerationService.getModeratedContent({
        contentType: 'message',
        status: 'all',
        page: 1,
        limit: 10
      });

      expect(Message.countDocuments).toHaveBeenCalled();
      expect(Message.find).toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({
        total: 10,
        page: 1,
        limit: 10
      }));
      expect(result.content.length).toBeGreaterThan(0);
    });

    it('should get all moderated content types', async () => {
      const result = await ModerationService.getModeratedContent({
        contentType: 'all',
        status: 'all',
        page: 1,
        limit: 10
      });

      expect(Notice.countDocuments).toHaveBeenCalled();
      expect(Report.countDocuments).toHaveBeenCalled();
      expect(Message.countDocuments).toHaveBeenCalled();
      expect(Notice.find).toHaveBeenCalled();
      expect(Report.find).toHaveBeenCalled();
      expect(Message.find).toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({
        total: 18, // 5 + 3 + 10
        page: 1,
        limit: 10
      }));
      expect(result.content.length).toBeGreaterThan(0);
    });
  });
});