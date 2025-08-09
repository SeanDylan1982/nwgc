// Script to create test data for moderation
// Run this from the server directory: node create-moderation-test-data.js

require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');
const Notice = require('./models/Notice');
const Report = require('./models/Report');
const Message = require('./models/Message');
const User = require('./models/User');

async function createModerationTestData() {
  try {
    console.log('=== CREATING MODERATION TEST DATA ===');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/neighbourhood-watch');
    console.log('✅ Connected to MongoDB');
    
    // Get a user to use as author (or create one)
    let testUser = await User.findOne({ email: 'admin@neighbourhood.com' });
    if (!testUser) {
      console.log('Creating test user...');
      testUser = new User({
        email: 'testuser@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
        role: 'user',
        neighbourhoodId: new mongoose.Types.ObjectId()
      });
      await testUser.save();
    }
    
    console.log('Using user:', testUser.email);
    
    // Create test notices with different statuses
    const testNotices = [
      {
        title: 'Community BBQ This Weekend',
        content: 'Join us for a fun community barbecue this Saturday at the park!',
        category: 'event',
        priority: 'normal',
        status: 'active',
        authorId: testUser._id,
        neighbourhoodId: testUser.neighbourhoodId,
        isFlagged: false,
        likes: [],
        comments: []
      },
      {
        title: 'Suspicious Activity Reported',
        content: 'Someone was seen looking into car windows on Main Street last night.',
        category: 'safety',
        priority: 'high',
        status: 'active',
        authorId: testUser._id,
        neighbourhoodId: testUser.neighbourhoodId,
        isFlagged: true,
        flaggedBy: [testUser._id],
        flaggedAt: new Date(),
        flagReason: 'inappropriate',
        likes: [],
        comments: []
      },
      {
        title: 'Lost Cat - Please Help',
        content: 'My orange tabby cat "Whiskers" has been missing since yesterday. Please call if you see him!',
        category: 'lost_found',
        priority: 'normal',
        status: 'archived',
        authorId: testUser._id,
        neighbourhoodId: testUser.neighbourhoodId,
        isFlagged: false,
        moderatedBy: testUser._id,
        moderatedAt: new Date(),
        moderationReason: 'Resolved - cat found',
        likes: [],
        comments: []
      },
      {
        title: 'Inappropriate Content Example',
        content: 'This is an example of content that has been flagged and removed.',
        category: 'general',
        priority: 'normal',
        status: 'removed',
        authorId: testUser._id,
        neighbourhoodId: testUser.neighbourhoodId,
        isFlagged: true,
        flaggedBy: [testUser._id],
        flaggedAt: new Date(),
        flagReason: 'spam',
        moderatedBy: testUser._id,
        moderatedAt: new Date(),
        moderationReason: 'Content removed for violating community guidelines',
        likes: [],
        comments: []
      }
    ];
    
    // Create test reports
    const testReports = [
      {
        title: 'Broken Streetlight on Oak Avenue',
        description: 'The streetlight at the corner of Oak Avenue and 2nd Street has been out for a week.',
        category: 'infrastructure',
        priority: 'medium',
        status: 'open',
        reporterId: testUser._id,
        neighbourhoodId: testUser.neighbourhoodId,
        location: 'Oak Avenue & 2nd Street',
        isFlagged: false,
        likes: []
      },
      {
        title: 'Noise Complaint - Loud Music',
        description: 'Neighbors playing extremely loud music past midnight on weekdays.',
        category: 'noise',
        priority: 'high',
        status: 'in-progress',
        reporterId: testUser._id,
        neighbourhoodId: testUser.neighbourhoodId,
        location: '123 Main Street',
        isFlagged: true,
        flaggedBy: [testUser._id],
        flaggedAt: new Date(),
        flagReason: 'duplicate',
        likes: []
      },
      {
        title: 'Pothole on Elm Street',
        description: 'Large pothole causing damage to vehicles.',
        category: 'infrastructure',
        priority: 'high',
        status: 'resolved',
        reporterId: testUser._id,
        neighbourhoodId: testUser.neighbourhoodId,
        location: 'Elm Street near the school',
        isFlagged: false,
        moderatedBy: testUser._id,
        moderatedAt: new Date(),
        moderationReason: 'Report resolved - pothole fixed',
        likes: []
      }
    ];
    
    // Clear existing test data
    console.log('🧹 Clearing existing test data...');
    await Notice.deleteMany({ authorId: testUser._id });
    await Report.deleteMany({ reporterId: testUser._id });
    
    // Insert test notices
    console.log('📝 Creating test notices...');
    const createdNotices = await Notice.insertMany(testNotices);
    console.log(`✅ Created ${createdNotices.length} test notices`);
    
    // Insert test reports
    console.log('📋 Creating test reports...');
    const createdReports = await Report.insertMany(testReports);
    console.log(`✅ Created ${createdReports.length} test reports`);
    
    // Summary
    console.log('\n🎉 TEST DATA CREATED SUCCESSFULLY!');
    console.log('Summary:');
    console.log(`- ${createdNotices.length} notices created`);
    console.log(`- ${createdReports.length} reports created`);
    console.log('- Mix of active, flagged, archived, and removed content');
    console.log('- Ready for moderation testing!');
    
    console.log('\n📋 Content breakdown:');
    console.log('Notices:');
    createdNotices.forEach((notice, i) => {
      console.log(`  ${i+1}. "${notice.title}" - Status: ${notice.status}, Flagged: ${notice.isFlagged}`);
    });
    
    console.log('Reports:');
    createdReports.forEach((report, i) => {
      console.log(`  ${i+1}. "${report.title}" - Status: ${report.status}, Flagged: ${report.isFlagged}`);
    });
    
  } catch (error) {
    console.error('❌ Error creating test data:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📤 Disconnected from MongoDB');
  }
}

// Run the script
createModerationTestData();