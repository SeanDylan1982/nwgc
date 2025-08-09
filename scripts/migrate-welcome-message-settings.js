/**
 * Migration script to convert old dismissedWelcomeMessages format to new welcomeMessageStates format
 * 
 * This script migrates user settings from:
 * settings.dismissedWelcomeMessages.{type} = boolean
 * 
 * To:
 * settings.welcomeMessageStates.{type} = { dismissed: boolean, collapsed: boolean }
 */

const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function migrateWelcomeMessageSettings() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Find all users with old format dismissedWelcomeMessages
    const users = await User.find({
      'settings.dismissedWelcomeMessages': { $exists: true }
    });

    console.log(`Found ${users.length} users with old format welcome message settings`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (const user of users) {
      try {
        const oldSettings = user.settings.dismissedWelcomeMessages || {};
        const existingNewSettings = user.settings.welcomeMessageStates || {};

        // Create new format settings
        const newSettings = {
          chat: {
            dismissed: oldSettings.chat || false,
            collapsed: existingNewSettings.chat?.collapsed || false
          },
          noticeBoard: {
            dismissed: oldSettings.noticeBoard || false,
            collapsed: existingNewSettings.noticeBoard?.collapsed || false
          },
          reports: {
            dismissed: oldSettings.reports || false,
            collapsed: existingNewSettings.reports?.collapsed || false
          }
        };

        // Update user with new format
        await User.findByIdAndUpdate(user._id, {
          $set: {
            'settings.welcomeMessageStates': newSettings
          },
          $unset: {
            'settings.dismissedWelcomeMessages': 1
          }
        });

        migratedCount++;
        console.log(`Migrated user ${user.email} (${user._id})`);
      } catch (error) {
        console.error(`Error migrating user ${user.email} (${user._id}):`, error);
        skippedCount++;
      }
    }

    console.log(`Migration completed:`);
    console.log(`- Migrated: ${migratedCount} users`);
    console.log(`- Skipped: ${skippedCount} users`);
    console.log(`- Total processed: ${users.length} users`);

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateWelcomeMessageSettings()
    .then(() => {
      console.log('Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = migrateWelcomeMessageSettings;