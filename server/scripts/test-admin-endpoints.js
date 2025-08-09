const mongoose = require('mongoose');
const User = require('../models/User');
const Notice = require('../models/Notice');
const Report = require('../models/Report');
const ChatGroup = require('../models/ChatGroup');
const Message = require('../models/Message');
require('dotenv').config({ path: '../.env.local' });

const connectDB = require('../config/database');

async function testAdminEndpoints() {
  try {
    // Connect to database
    await connectDB();
    console.log('Connected to database');

    // Test admin stats endpoint logic
    console.log('\n=== Testing Admin Stats Logic ===');
    
    const [
      totalUsers,
      activeUsers,
      suspendedUsers,
      totalNotices,
      totalReports,
      totalChatGroups,
      totalMessages
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ status: 'active' }),
      User.countDocuments({ status: 'suspended' }),
      Notice.countDocuments(),
      Report.countDocuments(),
      ChatGroup.countDocuments(),
      Message.countDocuments()
    ]);

    console.log('Database counts:');
    console.log(`- Total Users: ${totalUsers}`);
    console.log(`- Active Users: ${activeUsers}`);
    console.log(`- Suspended Users: ${suspendedUsers}`);
    console.log(`- Total Notices: ${totalNotices}`);
    console.log(`- Total Reports: ${totalReports}`);
    console.log(`- Total Chat Groups: ${totalChatGroups}`);
    console.log(`- Total Messages: ${totalMessages}`);

    // Test flagged content calculation
    const flaggedNotices = await Notice.countDocuments({ status: 'archived' });
    const flaggedReports = await Report.countDocuments({ status: 'flagged' });
    const flaggedContent = flaggedNotices + flaggedReports;
    
    console.log(`- Flagged Content: ${flaggedContent} (${flaggedNotices} notices + ${flaggedReports} reports)`);

    // Test users endpoint
    console.log('\n=== Testing Users Endpoint Logic ===');
    const users = await User.find({})
      .populate('neighbourhoodId', 'name')
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(5);

    console.log(`Found ${users.length} users (showing first 5):`);
    users.forEach(user => {
      console.log(`- ${user.firstName} ${user.lastName} (${user.email}) - Role: ${user.role}, Status: ${user.status || 'active'}`);
    });

    // Test if there are any admin users
    const adminUsers = await User.find({ role: 'admin' });
    console.log(`\nAdmin users found: ${adminUsers.length}`);
    adminUsers.forEach(admin => {
      console.log(`- Admin: ${admin.firstName} ${admin.lastName} (${admin.email})`);
    });

    if (adminUsers.length === 0) {
      console.log('\n⚠️  WARNING: No admin users found in the database!');
      console.log('You may need to create an admin user or promote an existing user to admin.');
    }

  } catch (error) {
    console.error('Error testing admin endpoints:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
}

testAdminEndpoints();