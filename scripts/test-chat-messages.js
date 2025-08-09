const mongoose = require('mongoose');
const ChatGroup = require('../models/ChatGroup');
const Message = require('../models/Message');
const User = require('../models/User');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/neighbourhood-app', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function testChatMessages() {
  try {
    console.log('Testing chat messages...');
    
    // Find all chat groups
    const groups = await ChatGroup.find({ isActive: true })
      .populate('createdBy', 'firstName lastName')
      .populate('members.userId', 'firstName lastName');
    
    console.log(`Found ${groups.length} chat groups:`);
    groups.forEach(group => {
      console.log(`- ${group.name} (${group.members.length} members)`);
    });
    
    if (groups.length > 0) {
      const firstGroup = groups[0];
      console.log(`\nTesting messages for group: ${firstGroup.name}`);
      
      // Get messages for the first group
      const messages = await Message.find({
        chatId: firstGroup._id,
        chatType: 'group',
        moderationStatus: 'active'
      })
      .populate('senderId', 'firstName lastName profileImageUrl')
      .sort({ createdAt: -1 })
      .limit(10);
      
      console.log(`Found ${messages.length} messages:`);
      messages.forEach(msg => {
        console.log(`- ${msg.senderId.firstName} ${msg.senderId.lastName}: ${msg.content}`);
      });
      
      // Format messages like the API does
      const formattedMessages = messages.map(msg => ({
        id: msg._id,
        content: msg.content,
        messageType: msg.messageType,
        senderId: msg.senderId._id,
        senderName: `${msg.senderId.firstName} ${msg.senderId.lastName}`,
        senderAvatar: msg.senderId.profileImageUrl,
        status: msg.status,
        createdAt: msg.createdAt,
        updatedAt: msg.updatedAt
      })).reverse();
      
      console.log('\nFormatted messages (as API returns):');
      console.log(JSON.stringify(formattedMessages, null, 2));
    }
    
  } catch (error) {
    console.error('Error testing chat messages:', error);
  } finally {
    mongoose.connection.close();
  }
}

testChatMessages();