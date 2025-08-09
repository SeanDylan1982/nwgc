const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

// Import models
const User = require('../models/User');
const Notice = require('../models/Notice');
const Report = require('../models/Report');
const Message = require('../models/Message');

async function migrateDatabase() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to database');

    // Migrate Users - add new fields
    console.log('Migrating User documents...');
    await User.updateMany(
      { bio: { $exists: false } },
      { 
        $set: { 
          bio: '',
          friends: [],
          status: 'active'
        }
      }
    );

    // Update user settings structure
    await User.updateMany(
      { 'settings.notifications': { $exists: false } },
      {
        $set: {
          'settings.notifications': {
            email: true,
            push: true,
            friendRequests: true,
            messages: true,
            chatNotifications: true,
            reportNotifications: true
          },
          'settings.privacy': {
            profileVisibility: 'neighbours',
            messagePermissions: 'friends'
          }
        },
        $unset: {
          'settings.notificationsEnabled': '',
          'settings.emailNotifications': '',
          'settings.pushNotifications': '',
          'settings.chatNotifications': '',
          'settings.reportNotifications': '',
          'settings.privacyLevel': ''
        }
      }
    );

    // Migrate Notices - rename attachments to media and add new fields
    console.log('Migrating Notice documents...');
    await Notice.updateMany(
      { media: { $exists: false } },
      [
        {
          $set: {
            media: {
              $map: {
                input: { $ifNull: ['$attachments', []] },
                as: 'attachment',
                in: {
                  type: {
                    $switch: {
                      branches: [
                        { case: { $regexMatch: { input: '$$attachment.fileType', regex: /^image/ } }, then: 'image' },
                        { case: { $regexMatch: { input: '$$attachment.fileType', regex: /^video/ } }, then: 'video' }
                      ],
                      default: 'file'
                    }
                  },
                  url: '$$attachment.fileUrl',
                  filename: '$$attachment.fileName',
                  size: '$$attachment.fileSize',
                  uploadedAt: '$$attachment.uploadedAt'
                }
              }
            },
            likes: [],
            comments: [],
            status: 'active'
          }
        }
      ]
    );

    // Remove old attachments field
    await Notice.updateMany({}, { $unset: { attachments: '' } });

    // Migrate Reports - similar to notices
    console.log('Migrating Report documents...');
    await Report.updateMany(
      { media: { $exists: false } },
      [
        {
          $set: {
            media: {
              $map: {
                input: { $ifNull: ['$attachments', []] },
                as: 'attachment',
                in: {
                  type: {
                    $switch: {
                      branches: [
                        { case: { $regexMatch: { input: '$$attachment.fileType', regex: /^image/ } }, then: 'image' },
                        { case: { $regexMatch: { input: '$$attachment.fileType', regex: /^video/ } }, then: 'video' }
                      ],
                      default: 'file'
                    }
                  },
                  url: '$$attachment.fileUrl',
                  filename: '$$attachment.fileName',
                  size: '$$attachment.fileSize',
                  uploadedAt: '$$attachment.uploadedAt'
                }
              }
            },
            likes: [],
            reportStatus: 'active'
          }
        }
      ]
    );

    // Remove old attachments field
    await Report.updateMany({}, { $unset: { attachments: '' } });

    // Migrate Messages - update structure for private chat support
    console.log('Migrating Message documents...');
    await Message.updateMany(
      { chatId: { $exists: false } },
      [
        {
          $set: {
            chatId: '$groupId',
            chatType: 'group',
            emojis: [],
            media: [],
            status: 'sent'
          }
        }
      ]
    );

    // Remove old groupId field
    await Message.updateMany({}, { $unset: { groupId: '', mediaUrl: '' } });

    console.log('Database migration completed successfully!');
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from database');
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateDatabase();
}

module.exports = migrateDatabase;