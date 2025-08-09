/**
 * Test password verification
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });

const User = require('../models/User');
const connectDB = require('../config/database');

async function testPassword() {
  try {
    console.log('🔍 Testing password verification...');
    
    // Connect to MongoDB
    await connectDB();
    console.log('✅ Connected to MongoDB');
    
    // Get admin user
    const adminUser = await User.findOne({ email: 'admin@neighbourhood.com' });
    
    if (!adminUser) {
      console.log('❌ Admin user not found');
      return;
    }
    
    console.log('✅ Found admin user:', adminUser.email);
    console.log('Stored password hash:', adminUser.password);
    
    // Test password comparison
    const testPassword = 'admin123';
    console.log('Testing password:', testPassword);
    
    const isMatch = await bcrypt.compare(testPassword, adminUser.password);
    console.log('Password match:', isMatch);
    
    // Also test the user's comparePassword method
    const isMatchMethod = await adminUser.comparePassword(testPassword);
    console.log('Password match (method):', isMatchMethod);
    
    // Test with wrong password
    const wrongPassword = 'wrongpassword';
    const isWrongMatch = await bcrypt.compare(wrongPassword, adminUser.password);
    console.log('Wrong password match:', isWrongMatch);
    
  } catch (error) {
    console.error('❌ Error testing password:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

testPassword();