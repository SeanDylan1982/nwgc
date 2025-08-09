const mongoose = require('mongoose');
const User = require('../models/User');
const Notice = require('../models/Notice');
const Report = require('../models/Report');
const ChatGroup = require('../models/ChatGroup');
const PrivateChat = require('../models/PrivateChat');
const Message = require('../models/Message');

async function debugDashboard() {
  try {
    // Load environment variables
    require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') });
    
    // Connect to database - ALWAYS use MongoDB Atlas
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI environment variable is required. Local MongoDB connections are not allowed.');
    }
    console.log('Connecting to MongoDB Atlas:', mongoUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')); // Hide credentials
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Get counts
    const userCount = await User.countDocuments({ isActive: true });
    const noticeCount = await Notice.countDocuments({ status: 'active' });
    const reportCount = await Report.countDocuments({ reportStatus: 'active' });
    const groupChatCount = await ChatGroup.countDocuments({ isActive: true });
    const privateChatCount = await PrivateChat.countDocuments({ isActive: true });
    const messageCount = await Message.countDocuments({ moderationStatus: 'active' });

    console.log('Database Counts:');
    console.log('- Users:', userCount);
    console.log('- Notices:', noticeCount);
    console.log('- Reports:', reportCount);
    console.log('- Group Chats:', groupChatCount);
    console.log('- Private Chats:', privateChatCount);
    console.log('- Messages:', messageCount);

    // Get sample data
    const sampleUser = await User.findOne({ isActive: true }).select('firstName lastName neighbourhoodId');
    console.log('\nSample User:', sampleUser);

    if (sampleUser && sampleUser.neighbourhoodId) {
      const neighbourhoodNotices = await Notice.countDocuments({ 
        neighbourhoodId: sampleUser.neighbourhoodId, 
        status: 'active' 
      });
      const neighbourhoodReports = await Report.countDocuments({ 
        neighbourhoodId: sampleUser.neighbourhoodId, 
        reportStatus: 'active' 
      });
      const neighbourhoodUsers = await User.countDocuments({ 
        neighbourhoodId: sampleUser.neighbourhoodId, 
        isActive: true 
      });

      console.log('\nNeighbourhood Data:');
      console.log('- Neighbourhood ID:', sampleUser.neighbourhoodId);
      console.log('- Notices in neighbourhood:', neighbourhoodNotices);
      console.log('- Reports in neighbourhood:', neighbourhoodReports);
      console.log('- Users in neighbourhood:', neighbourhoodUsers);
    }

    // Check recent notices
    const recentNotices = await Notice.find({ status: 'active' })
      .populate('authorId', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(3);

    console.log('\nRecent Notices:');
    recentNotices.forEach((notice, index) => {
      console.log(`${index + 1}. ${notice.title} by ${notice.authorId?.firstName} ${notice.authorId?.lastName}`);
    });

    // Check recent reports
    const recentReports = await Report.find({ reportStatus: 'active' })
      .populate('reporterId', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(3);

    console.log('\nRecent Reports:');
    recentReports.forEach((report, index) => {
      console.log(`${index + 1}. ${report.title} by ${report.reporterId?.firstName} ${report.reporterId?.lastName}`);
    });

    // Check messages
    const recentMessages = await Message.find({ moderationStatus: 'active' })
      .populate('senderId', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(5);

    console.log('\nRecent Messages:');
    recentMessages.forEach((message, index) => {
      console.log(`${index + 1}. "${message.content}" by ${message.senderId?.firstName} ${message.senderId?.lastName} (${message.chatType})`);
    });

  } catch (error) {
    console.error('Debug error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

debugDashboard();