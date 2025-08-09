const mongoose = require('mongoose');
const ChatGroup = require('../models/ChatGroup');
const Message = require('../models/Message');
const User = require('../models/User');

// Load environment variables the same way as the server
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });

// Connect to MongoDB
const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/neighbourhood-app';
console.log('Connecting to:', mongoUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'));

mongoose.connect(mongoUri);

async function testAllChatData() {
  try {
    console.log('Testing all chat data...');
    
    // Count all documents
    const groupCount = await ChatGroup.countDocuments();
    const messageCount = await Message.countDocuments();
    const userCount = await User.countDocuments();
    
    console.log(`Total chat groups: ${groupCount}`);
    console.log(`Total messages: ${messageCount}`);
    console.log(`Total users: ${userCount}`);
    
    // Find all chat groups (including inactive)
    const allGroups = await ChatGroup.find({})
      .populate('createdBy', 'firstName lastName')
      .populate('members.userId', 'firstName lastName');
    
    console.log(`\nAll chat groups (${allGroups.length}):`);
    allGroups.forEach(group => {
      console.log(`- ${group.name} (active: ${group.isActive}, members: ${group.members.length})`);
    });
    
    // Find all messages
    const allMessages = await Message.find({})
      .populate('senderId', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(10);
    
    console.log(`\nRecent messages (${allMessages.length}):`);
    allMessages.forEach(msg => {
      const senderName = msg.senderId ? `${msg.senderId.firstName} ${msg.senderId.lastName}` : 'Unknown';
      console.log(`- ${senderName}: ${msg.content} (${msg.chatType})`);
    });
    
    // Check if there are any users
    const sampleUsers = await User.find({}).limit(3).select('firstName lastName email');
    console.log(`\nSample users (${sampleUsers.length}):`);
    sampleUsers.forEach(user => {
      console.log(`- ${user.firstName} ${user.lastName} (${user.email})`);
    });
    
  } catch (error) {
    console.error('Error testing chat data:', error);
  } finally {
    mongoose.connection.close();
  }
}

testAllChatData();