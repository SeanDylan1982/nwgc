/**
 * Rate limit status endpoint
 * Provides information about current rate limit status
 */
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/adminAuth');

// Store for tracking rate limit info (in production, use Redis or similar)
const rateLimitStore = new Map();

// Middleware to track rate limit usage
const trackRateLimit = (req, res, next) => {
  const key = req.user?.id || req.ip;
  const now = Date.now();
  
  if (!rateLimitStore.has(key)) {
    rateLimitStore.set(key, {
      requests: 0,
      windowStart: now,
      lastRequest: now
    });
  }
  
  const userStats = rateLimitStore.get(key);
  userStats.requests++;
  userStats.lastRequest = now;
  
  // Reset window if needed (15 minutes)
  if (now - userStats.windowStart > 15 * 60 * 1000) {
    userStats.requests = 1;
    userStats.windowStart = now;
  }
  
  next();
};

// Apply authentication to all routes
router.use(authenticateToken);
router.use(requireAdmin);

// Get rate limit status for current user
router.get('/status', trackRateLimit, (req, res) => {
  const key = req.user?.id || req.ip;
  const userStats = rateLimitStore.get(key) || { requests: 0, windowStart: Date.now(), lastRequest: Date.now() };
  
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const generalLimit = parseInt(process.env.RATE_LIMIT_MAX || 100);
  const adminLimit = parseInt(process.env.ADMIN_RATE_LIMIT_MAX || 1000);
  
  const timeRemaining = windowMs - (Date.now() - userStats.windowStart);
  
  res.json({
    user: {
      id: req.user?.id,
      ip: req.ip,
      requests: userStats.requests,
      lastRequest: new Date(userStats.lastRequest).toISOString()
    },
    limits: {
      general: {
        max: generalLimit,
        remaining: Math.max(0, generalLimit - userStats.requests),
        resetTime: new Date(userStats.windowStart + windowMs).toISOString()
      },
      admin: {
        max: adminLimit,
        remaining: Math.max(0, adminLimit - userStats.requests),
        resetTime: new Date(userStats.windowStart + windowMs).toISOString()
      }
    },
    window: {
      durationMs: windowMs,
      timeRemainingMs: Math.max(0, timeRemaining),
      resetIn: Math.ceil(Math.max(0, timeRemaining) / 1000) + ' seconds'
    },
    recommendations: {
      generalStatus: userStats.requests < generalLimit * 0.8 ? 'healthy' : 
                    userStats.requests < generalLimit ? 'warning' : 'exceeded',
      adminStatus: userStats.requests < adminLimit * 0.8 ? 'healthy' : 
                   userStats.requests < adminLimit ? 'warning' : 'exceeded',
      message: userStats.requests > adminLimit ? 
               'Rate limit exceeded. Please wait before making more requests.' :
               userStats.requests > adminLimit * 0.8 ?
               'Approaching rate limit. Consider reducing request frequency.' :
               'Rate limit usage is healthy.'
    }
  });
});

// Get overall rate limit statistics (admin only)
router.get('/stats', (req, res) => {
  const stats = {
    totalUsers: rateLimitStore.size,
    configuration: {
      windowMs: 15 * 60 * 1000,
      generalLimit: parseInt(process.env.RATE_LIMIT_MAX || 100),
      adminLimit: parseInt(process.env.ADMIN_RATE_LIMIT_MAX || 1000)
    },
    topUsers: Array.from(rateLimitStore.entries())
      .map(([key, data]) => ({
        identifier: key,
        requests: data.requests,
        lastRequest: new Date(data.lastRequest).toISOString()
      }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 10)
  };
  
  res.json(stats);
});

module.exports = router;