/**
 * Check what users exist in the database
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });

const User = require('../models/User');
const connectDB = require('../config/database');

async function checkUsers() {
  try {
    console.log('🔍 Checking users in database...');
    
    // Connect to MongoDB
    await connectDB();
    console.log('✅ Connected to MongoDB');
    
    // Get all users
    const users = await User.find({}).select('email firstName lastName role createdAt');
    
    console.log(`\n📊 Found ${users.length} users:`);
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email} - ${user.firstName} ${user.lastName} (${user.role}) - Created: ${user.createdAt}`);
    });
    
    if (users.length === 0) {
      console.log('\n⚠️ No users found in database. Run the seeding script first:');
      console.log('node scripts/comprehensiveSeed.js');
    }
    
  } catch (error) {
    console.error('❌ Error checking users:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

checkUsers();