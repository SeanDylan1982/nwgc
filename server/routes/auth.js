const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Load environment variables
require('dotenv').config({ path: '.env.local' });

// Register
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('firstName').trim().isLength({ min: 1 }),
  body('lastName').trim().isLength({ min: 1 }),
  body('phone').optional().isMobilePhone(),
  body('address').optional().trim(),
  body('neighbourhoodId').optional().isMongoId()
], async (req, res) => {
  try {
    console.log('Registration attempt:', req.body);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Registration validation errors:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, firstName, lastName, phone, address, neighbourhoodId, acceptedTerms } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Validate terms acceptance
    if (!acceptedTerms || !acceptedTerms.termsOfService || !acceptedTerms.privacyPolicy) {
      return res.status(400).json({ 
        message: 'You must accept the Terms of Service and Privacy Policy to create an account' 
      });
    }

    // Create user with terms acceptance
    const user = new User({
      email,
      password,
      firstName,
      lastName,
      phone,
      address,
      neighbourhoodId,
      legalAcceptance: {
        termsOfService: {
          accepted: true,
          version: '1.0.0', // Default version
          timestamp: new Date()
        },
        privacyPolicy: {
          accepted: true,
          version: '1.0.0', // Default version
          timestamp: new Date()
        }
      }
    });

    await user.save();

    // Generate JWT
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        address: user.address,
        role: user.role,
        isVerified: user.isVerified,
        neighbourhoodId: user.neighbourhoodId,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// Login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').exists()
], async (req, res) => {
  try {
    console.log('Login attempt:', req.body);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(401).json({ message: 'Account is deactivated' });
    }

    // Check password
    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '7d' }
    );

    // Update last login (optional)
    user.updatedAt = new Date();
    await user.save();

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        address: user.address,
        role: user.role,
        isVerified: user.isVerified,
        neighbourhoodId: user.neighbourhoodId,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// Refresh token
router.post('/refresh', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(401).json({ message: 'Token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    
    // Generate new token
    const newToken = jwt.sign(
      { userId: decoded.userId, email: decoded.email },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '7d' }
    );

    res.json({ token: newToken });
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
});

// Get current user info
router.get('/me', authenticateToken, async (req, res) => {
  try {
    console.log('=== GET CURRENT USER ===');
    console.log('req.user:', req.user);
    
    const user = await User.findById(req.user.userId).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    console.log('Current user details:', {
      id: user._id,
      email: user.email,
      role: user.role,
      isActive: user.isActive
    });

    res.json({
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      address: user.address,
      role: user.role,
      isVerified: user.isVerified,
      isActive: user.isActive,
      neighbourhoodId: user.neighbourhoodId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Forgot password
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email } = req.body;

    // Check if user exists
    const user = await User.findOne({ email });

    // Always return success to prevent email enumeration
    res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });

    if (user) {
      // TODO: Implement email sending logic
      console.log(`Password reset requested for: ${email}`);
    }
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// TEMPORARY: Self-promote to admin (DEVELOPMENT ONLY)
// This endpoint allows any authenticated user to promote themselves to admin
// Remove this in production!
router.post('/dev-promote-admin', authenticateToken, async (req, res) => {
  try {
    console.log('=== DEV PROMOTE ADMIN ENDPOINT ===');
    console.log('User requesting promotion:', req.user);
    
    // Check if we're in development mode
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ message: 'This endpoint is disabled in production' });
    }
    
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    console.log('Current user role:', user.role);
    
    if (user.role === 'admin') {
      return res.json({ message: 'User is already an admin', role: user.role });
    }
    
    // Promote user to admin
    const oldRole = user.role;
    user.role = 'admin';
    await user.save();
    
    console.log('✅ User promoted from', oldRole, 'to admin');
    
    res.json({ 
      message: 'User promoted to admin successfully!',
      oldRole,
      newRole: user.role,
      note: 'You can now access the Content Moderation page'
    });
  } catch (error) {
    console.error('Dev promote admin error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;