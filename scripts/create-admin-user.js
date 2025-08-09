const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Neighbourhood = require('../models/Neighbourhood');
const AuditLog = require('../models/AuditLog');
require('dotenv').config({ path: '../.env.local' });

const connectDB = require('../config/database');

async function createAdminUser() {
  try {
    // Connect to database
    await connectDB();
    console.log('Connected to database');

    // Check if admin user already exists
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      console.log('Admin user already exists:', existingAdmin.email);
      return;
    }

    // Get or create a default neighbourhood
    let neighbourhood = await Neighbourhood.findOne();
    if (!neighbourhood) {
      neighbourhood = new Neighbourhood({
        name: 'Default Neighbourhood',
        description: 'Default neighbourhood for admin user',
        location: {
          address: 'Default Location',
          coordinates: [0, 0]
        },
        isActive: true
      });
      await neighbourhood.save();
      console.log('Created default neighbourhood');
    }

    // Create admin user with secure password
    const password = generateSecurePassword();
    const hashedPassword = await bcrypt.hash(password, 12);
    
    const adminUser = new User({
      email: 'admin@neighborwatch.com',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      phone: '+1234567890',
      address: 'Admin Address',
      role: 'admin',
      status: 'active',
      isActive: true,
      isVerified: true,
      neighbourhoodId: neighbourhood._id,
      settings: {
        notifications: {
          email: true,
          push: true,
          friendRequests: true,
          messages: true,
          chatNotifications: true,
          reportNotifications: true
        },
        privacy: {
          profileVisibility: 'public',
          messagePermissions: 'everyone'
        },
        locationSharing: true
      }
    });

    const savedAdmin = await adminUser.save();
    console.log('Admin user created successfully!');
    console.log('Email: admin@neighborwatch.com');
    console.log('Password:', password);
    console.log('Role: admin');
    
    // Create an initial audit log entry
    const auditLog = new AuditLog({
      adminId: savedAdmin._id,
      action: 'admin_login',
      targetType: 'system',
      targetId: savedAdmin._id,
      details: {
        message: 'Initial admin user created'
      }
    });
    
    await auditLog.save();
    console.log('Initial audit log created');

  } catch (error) {
    console.error('Error creating admin user:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Generate a secure random password
function generateSecurePassword(length = 12) {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+';
  let password = '';
  
  // Ensure at least one character from each category
  password += getRandomChar('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
  password += getRandomChar('abcdefghijklmnopqrstuvwxyz');
  password += getRandomChar('0123456789');
  password += getRandomChar('!@#$%^&*()_+');
  
  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  
  // Shuffle the password
  return password.split('').sort(() => 0.5 - Math.random()).join('');
}

function getRandomChar(charset) {
  return charset.charAt(Math.floor(Math.random() * charset.length));
}

createAdminUser();