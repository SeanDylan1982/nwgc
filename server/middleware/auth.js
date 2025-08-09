const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authenticateToken = async (req, res, next) => {
  try {
    console.log('=== AUTHENTICATE TOKEN MIDDLEWARE ===');
    const authHeader = req.headers['authorization'];
    console.log('Auth header:', authHeader ? 'Present' : 'Missing');
    
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      console.log('❌ No token provided');
      return res.status(401).json({ message: 'Access token required' });
    }

    console.log('Token present, verifying...');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    console.log('Token decoded successfully, userId:', decoded.userId);
    
    // Verify user still exists and is active
    const user = await User.findById(decoded.userId).select('email role isActive neighbourhoodId');
    console.log('User found in database:', user ? { id: user._id, email: user.email, role: user.role, isActive: user.isActive } : 'Not found');

    if (!user) {
      console.log('❌ User not found in database');
      return res.status(401).json({ message: 'User not found' });
    }
    
    if (!user.isActive) {
      console.log('❌ User account is deactivated');
      return res.status(401).json({ message: 'Account is deactivated' });
    }

    req.user = {
      userId: user._id,
      email: user.email,
      role: user.role,
      neighbourhoodId: user.neighbourhoodId
    };

    console.log('✅ User authenticated successfully:', { userId: req.user.userId, role: req.user.role });
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      console.log('❌ Invalid JWT token');
      return res.status(401).json({ message: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      console.log('❌ JWT token expired');
      return res.status(401).json({ message: 'Token expired' });
    }
    
    console.error('Auth middleware error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    next();
  };
};

const requireNeighbourhood = async (req, res, next) => {
  try {
    if (!req.user.neighbourhoodId) {
      return res.status(400).json({ message: 'User must be assigned to a neighbourhood' });
    }

    // Verify neighbourhood exists and is active
    const Neighbourhood = require('../models/Neighbourhood');
    const neighbourhood = await Neighbourhood.findById(req.user.neighbourhoodId).select('isActive');

    if (!neighbourhood || !neighbourhood.isActive) {
      return res.status(400).json({ message: 'Invalid or inactive neighbourhood' });
    }

    next();
  } catch (error) {
    console.error('Neighbourhood middleware error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  authenticateToken,
  requireRole,
  requireNeighbourhood
};