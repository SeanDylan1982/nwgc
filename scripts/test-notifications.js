const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const User = require('../models/User');

async function testNotifications() {
  try {
    // Load environment variables
    require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') });
    
    // Connect to database - ALWAYS use MongoDB Atlas
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI environment variable is required. Local MongoDB connections are not allowed.');
    }
    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Check notification count
    const notificationCount = await Notification.countDocuments();
    console.log('Total notifications:', notificationCount);

    // Get sample notifications
    const sampleNotifications = await Notification.find()
      .populate('recipient', 'firstName lastName')
      .populate('sender', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(5);

    console.log('\nSample Notifications:');
    sampleNotifications.forEach((notification, index) => {
      console.log(`${index + 1}. ${notification.title} - ${notification.type} - Read: ${notification.read}`);
      console.log(`   To: ${notification.recipient?.firstName} ${notification.recipient?.lastName}`);
      console.log(`   From: ${notification.sender?.firstName} ${notification.sender?.lastName}`);
    });

    // Check unread count for first user
    if (sampleNotifications.length > 0) {
      const firstUserId = sampleNotifications[0].recipient._id;
      const unreadCount = await Notification.countDocuments({
        recipient: firstUserId,
        read: false
      });
      console.log(`\nUnread notifications for ${sampleNotifications[0].recipient.firstName}: ${unreadCount}`);
    }

  } catch (error) {
    console.error('Test error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

testNotifications();