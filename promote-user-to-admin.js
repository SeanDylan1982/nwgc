// Script to promote current user to admin role
// Run this from the server directory: node promote-user-to-admin.js

require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');
const User = require('./models/User');

async function promoteUserToAdmin() {
  try {
    console.log('=== USER ROLE PROMOTION SCRIPT ===');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/neighbourhood-watch');
    console.log('✅ Connected to MongoDB');
    
    // Instructions for getting user ID
    console.log('\n📋 INSTRUCTIONS:');
    console.log('1. Get your user ID from the browser console test results');
    console.log('2. Replace USER_ID_HERE below with your actual user ID');
    console.log('3. Uncomment the promotion code');
    console.log('4. Run: node promote-user-to-admin.js');
    
    // Example: Replace USER_ID_HERE with actual user ID
    const userId = 'USER_ID_HERE';
    
    if (userId === 'USER_ID_HERE') {
      console.log('\n❌ Please replace USER_ID_HERE with your actual user ID');
      console.log('   You can get this from the browser console test results');
      return;
    }
    
    /*
    // Uncomment this section after replacing USER_ID_HERE
    console.log(`\n🔄 Promoting user ${userId} to admin...`);
    
    const user = await User.findById(userId);
    if (!user) {
      console.log('❌ User not found');
      return;
    }
    
    console.log('Current user:', {
      id: user._id,
      email: user.email,
      role: user.role
    });
    
    // Update user role to admin
    user.role = 'admin';
    await user.save();
    
    console.log('✅ User promoted to admin successfully!');
    console.log('Updated user:', {
      id: user._id,
      email: user.email,
      role: user.role
    });
    
    console.log('\n🎉 You can now access the Content Moderation page!');
    console.log('   Refresh the page and try again.');
    */
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📤 Disconnected from MongoDB');
  }
}

// Alternative: Promote all users to admin (for development only)
async function promoteAllUsersToAdmin() {
  try {
    console.log('=== PROMOTE ALL USERS TO ADMIN (DEV ONLY) ===');
    
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/neighbourhood-watch');
    console.log('✅ Connected to MongoDB');
    
    const result = await User.updateMany(
      { role: 'user' },
      { $set: { role: 'admin' } }
    );
    
    console.log(`✅ Promoted ${result.modifiedCount} users to admin`);
    
    const adminUsers = await User.find({ role: 'admin' }).select('email role');
    console.log('Admin users:', adminUsers);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

// Run the promotion
promoteUserToAdmin();

// Uncomment this line to promote ALL users to admin (development only)
// promoteAllUsersToAdmin();