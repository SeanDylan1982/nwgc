/**
 * Test data seeding script
 * Creates sample data for testing the application
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const User = require('../models/User');
const Report = require('../models/Report');
const Neighbourhood = require('../models/Neighbourhood');

async function seedTestData() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Create test neighbourhood
    console.log('Creating test neighbourhood...');
    
    // First, create an admin user to be the creator
    let adminUser = await User.findOne({ email: 'admin@neighbourhood.com' });
    if (!adminUser) {
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash('admin123', salt);
      
      adminUser = new User({
        email: 'admin@neighbourhood.com',
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin',
        phone: '+1234567890',
        address: '123 Admin Street',
        isVerified: true,
        isActive: true
      });
      await adminUser.save();
      console.log('Admin user created');
    }
    
    let neighbourhood = await Neighbourhood.findOne({ name: 'Test Neighbourhood' });
    if (!neighbourhood) {
      neighbourhood = new Neighbourhood({
        name: 'Test Neighbourhood',
        description: 'A test neighbourhood for development',
        address: '123 Test Street',
        city: 'Test City',
        state: 'Test State',
        zipCode: '12345',
        location: {
          coordinates: [-74.006, 40.7128] // New York coordinates
        },
        createdBy: adminUser._id
      });
      await neighbourhood.save();
      console.log('Test neighbourhood created');
    } else {
      console.log('Test neighbourhood already exists');
    }
    
    // Update admin user with neighbourhood
    if (!adminUser.neighbourhoodId) {
      adminUser.neighbourhoodId = neighbourhood._id;
      await adminUser.save();
    }

    // Create test users
    console.log('Creating test users...');
    const testUsers = [
      {
        email: 'admin@neighbourhood.com',
        password: 'admin123',
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin',
        phone: '+1234567890',
        address: '123 Admin Street'
      },
      {
        email: 'user1@neighbourhood.com',
        password: 'user123',
        firstName: 'John',
        lastName: 'Doe',
        role: 'user',
        phone: '+1234567891',
        address: '124 User Street'
      },
      {
        email: 'user2@neighbourhood.com',
        password: 'user123',
        firstName: 'Jane',
        lastName: 'Smith',
        role: 'user',
        phone: '+1234567892',
        address: '125 User Street'
      },
      {
        email: 'moderator@neighbourhood.com',
        password: 'mod123',
        firstName: 'Mike',
        lastName: 'Moderator',
        role: 'moderator',
        phone: '+1234567893',
        address: '126 Mod Street'
      }
    ];

    const createdUsers = [];
    for (const userData of testUsers) {
      let user = await User.findOne({ email: userData.email });
      if (!user) {
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(userData.password, salt);
        
        user = new User({
          ...userData,
          password: hashedPassword,
          neighbourhoodId: neighbourhood._id,
          isVerified: true,
          isActive: true
        });
        await user.save();
        console.log(`Created user: ${userData.email}`);
      } else {
        console.log(`User already exists: ${userData.email}`);
      }
      createdUsers.push(user);
    }

    // Create test reports
    console.log('Creating test reports...');
    const testReports = [
      {
        title: 'Broken Street Light',
        description: 'The street light on Main Street is not working. It has been dark for several days now.',
        category: 'maintenance',
        priority: 'medium',
        location: {
          address: 'Main Street, Test Neighbourhood',
          coordinates: [-74.005, 40.7130]
        },
        reporterId: createdUsers[1]._id, // John Doe
        neighbourhoodId: neighbourhood._id
      },
      {
        title: 'Suspicious Activity',
        description: 'Noticed some suspicious individuals loitering around the park late at night.',
        category: 'security',
        priority: 'high',
        location: {
          address: 'Central Park, Test Neighbourhood',
          coordinates: [-74.007, 40.7125]
        },
        reporterId: createdUsers[2]._id, // Jane Smith
        neighbourhoodId: neighbourhood._id
      },
      {
        title: 'Lost Cat',
        description: 'My orange tabby cat "Whiskers" has been missing since yesterday. Please contact me if you see him.',
        category: 'pets',
        priority: 'medium',
        location: {
          address: '125 User Street, Test Neighbourhood',
          coordinates: [-74.006, 40.7128]
        },
        reporterId: createdUsers[2]._id, // Jane Smith
        neighbourhoodId: neighbourhood._id
      },
      {
        title: 'Pothole on Oak Avenue',
        description: 'Large pothole causing damage to vehicles. Needs immediate attention.',
        category: 'traffic',
        priority: 'high',
        location: {
          address: 'Oak Avenue, Test Neighbourhood',
          coordinates: [-74.008, 40.7135]
        },
        reporterId: createdUsers[1]._id, // John Doe
        neighbourhoodId: neighbourhood._id
      },
      {
        title: 'Loud Music Complaint',
        description: 'Neighbor playing loud music past midnight. This has been ongoing for a week.',
        category: 'noise',
        priority: 'low',
        location: {
          address: '130 Party Street, Test Neighbourhood',
          coordinates: [-74.004, 40.7120]
        },
        reporterId: createdUsers[1]._id, // John Doe
        neighbourhoodId: neighbourhood._id,
        isAnonymous: true
      }
    ];

    for (const reportData of testReports) {
      const existingReport = await Report.findOne({ 
        title: reportData.title,
        neighbourhoodId: neighbourhood._id 
      });
      
      if (!existingReport) {
        const report = new Report(reportData);
        await report.save();
        console.log(`Created report: ${reportData.title}`);
      } else {
        console.log(`Report already exists: ${reportData.title}`);
      }
    }

    console.log('\nTest data seeding completed successfully!');
    
    // Display summary
    const userCount = await User.countDocuments({ neighbourhoodId: neighbourhood._id });
    const reportCount = await Report.countDocuments({ neighbourhoodId: neighbourhood._id });
    
    console.log('\nData Summary:');
    console.log(`- Neighbourhood: ${neighbourhood.name}`);
    console.log(`- Users: ${userCount}`);
    console.log(`- Reports: ${reportCount}`);
    
    console.log('\nTest Accounts:');
    console.log('- Admin: admin@neighbourhood.com / admin123');
    console.log('- User 1: user1@neighbourhood.com / user123');
    console.log('- User 2: user2@neighbourhood.com / user123');
    console.log('- Moderator: moderator@neighbourhood.com / mod123');

  } catch (error) {
    console.error('Test data seeding failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
    process.exit(0);
  }
}

// Run the seeding
if (require.main === module) {
  seedTestData();
}

module.exports = seedTestData;