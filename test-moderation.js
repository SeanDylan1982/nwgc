const mongoose = require('mongoose');
const Notice = require('./server/models/Notice');
const Report = require('./server/models/Report');
const Message = require('./server/models/Message');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/neighbourhood-app', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function testModerationData() {
  try {
    console.log('Testing moderation data...');
    
    // Check if we have any notices
    const noticeCount = await Notice.countDocuments();
    console.log(`Total notices: ${noticeCount}`);
    
    // Check if we have any reports
    const reportCount = await Report.countDocuments();
    console.log(`Total reports: ${reportCount}`);
    
    // Check if we have any messages
    const messageCount = await Message.countDocuments();
    console.log(`Total messages: ${messageCount}`);
    
    // Check for flagged content
    const flaggedNotices = await Notice.countDocuments({ isFlagged: true });
    console.log(`Flagged notices: ${flaggedNotices}`);
    
    // Check for moderated content
    const moderatedNotices = await Notice.countDocuments({ moderatedBy: { $exists: true } });
    console.log(`Moderated notices: ${moderatedNotices}`);
    
    // Get a sample of notices
    const sampleNotices = await Notice.find().limit(3).populate('authorId', 'firstName lastName');
    console.log('Sample notices:');
    sampleNotices.forEach((notice, index) => {
      console.log(`${index + 1}. ${notice.title} - Status: ${notice.status} - Flagged: ${notice.isFlagged}`);
    });
    
    // Test the moderation service query
    const ModerationService = require('./server/services/ModerationService');
    const testResult = await ModerationService.getModeratedContent({
      contentType: 'all',
      status: 'all',
      page: 1,
      limit: 10,
      flagged: false,
      moderated: false
    });
    
    console.log('Moderation service test result:');
    console.log(`Total: ${testResult.total}`);
    console.log(`Content items: ${testResult.content.length}`);
    console.log(`Pages: ${testResult.totalPages}`);
    
    if (testResult.content.length > 0) {
      console.log('First item:', {
        contentType: testResult.content[0].contentType,
        title: testResult.content[0].title,
        status: testResult.content[0].status,
        isFlagged: testResult.content[0].isFlagged
      });
    }
    
  } catch (error) {
    console.error('Error testing moderation data:', error);
  } finally {
    mongoose.connection.close();
  }
}

testModerationData();