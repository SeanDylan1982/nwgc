/**
 * Database Optimization Script
 * Adds indexes and optimizes database performance for the neighbourhood watch app
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const mongoose = require('mongoose');

// Import models to ensure indexes are created
const User = require('../models/User');
const LegalDocument = require('../models/LegalDocument');
const Notification = require('../models/Notification');

async function optimizeDatabase() {
  try {
    console.log('🚀 Starting database optimization...');
    console.log('Connecting to MongoDB...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 30000,
      connectTimeoutMS: 10000,
      maxPoolSize: 5,
      minPoolSize: 1,
      retryWrites: true,
      retryReads: true,
      family: 4,
      heartbeatFrequencyMS: 5000,
      tls: true,
      tlsAllowInvalidCertificates: false,
      tlsAllowInvalidHostnames: false
    });
    
    console.log('✅ Connected to MongoDB successfully');
    
    // Get database instance
    const db = mongoose.connection.db;
    
    console.log('\n📊 Analyzing current database state...');
    
    // Get collection stats
    const collections = await db.listCollections().toArray();
    console.log(`Found ${collections.length} collections:`, collections.map(c => c.name).join(', '));
    
    // Optimize each collection
    await optimizeUsersCollection(db);
    await optimizeNotificationsCollection(db);
    await optimizeLegalDocumentsCollection(db);
    await optimizeMessagesCollection(db);
    await optimizeNoticesCollection(db);
    await optimizeReportsCollection(db);
    
    console.log('\n🔍 Creating additional performance indexes...');
    
    // Create compound indexes for common queries
    await createCompoundIndexes(db);
    
    console.log('\n📈 Running database statistics update...');
    
    // Update collection statistics
    await updateCollectionStats(db);
    
    console.log('\n✅ Database optimization completed successfully!');
    
    // Display optimization summary
    await displayOptimizationSummary(db);
    
  } catch (error) {
    console.error('❌ Error optimizing database:', error);
    process.exit(1);
  } finally {
    // Close MongoDB connection
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('\n🔌 Disconnected from MongoDB');
    }
  }
}

async function optimizeUsersCollection(db) {
  console.log('\n👥 Optimizing users collection...');
  
  const usersCollection = db.collection('users');
  
  // Create indexes for common user queries
  const userIndexes = [
    { email: 1 }, // Login queries
    { neighbourhoodId: 1, isActive: 1 }, // Neighbourhood member queries
    { role: 1, status: 1 }, // Admin queries
    { 'friends': 1 }, // Friend relationship queries
    { firstName: 'text', lastName: 'text', email: 'text', bio: 'text' }, // Search queries
    { createdAt: -1 }, // Recent users
    { 'legalAcceptance.termsOfService.accepted': 1 }, // Terms compliance queries
    { 'legalAcceptance.privacyPolicy.accepted': 1 } // Privacy compliance queries
  ];
  
  for (const index of userIndexes) {
    try {
      await usersCollection.createIndex(index);
      console.log(`  ✅ Created index:`, Object.keys(index).join(', '));
    } catch (error) {
      if (error.code !== 85) { // Index already exists
        console.log(`  ⚠️  Index creation warning:`, error.message);
      }
    }
  }
  
  // Get collection stats
  try {
    const stats = await db.command({ collStats: 'users' });
    console.log(`  📊 Users collection: ${stats.count} documents, ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  } catch (error) {
    console.log(`  📊 Users collection: Stats unavailable`);
  }
}

async function optimizeNotificationsCollection(db) {
  console.log('\n🔔 Optimizing notifications collection...');
  
  const notificationsCollection = db.collection('notifications');
  
  // Create indexes for notification queries
  const notificationIndexes = [
    { recipient: 1, read: 1, createdAt: -1 }, // User notifications with read status
    { recipient: 1, type: 1 }, // Notifications by type
    { createdAt: -1 }, // Recent notifications
    { 'reference.type': 1, 'reference.id': 1 }, // Reference lookups
    { sender: 1, createdAt: -1 } // Sender notifications
  ];
  
  for (const index of notificationIndexes) {
    try {
      await notificationsCollection.createIndex(index);
      console.log(`  ✅ Created index:`, Object.keys(index).join(', '));
    } catch (error) {
      if (error.code !== 85) {
        console.log(`  ⚠️  Index creation warning:`, error.message);
      }
    }
  }
  
  // Create TTL index for old read notifications (cleanup after 30 days)
  try {
    await notificationsCollection.createIndex(
      { createdAt: 1 }, 
      { 
        expireAfterSeconds: 30 * 24 * 60 * 60, // 30 days
        partialFilterExpression: { read: true }
      }
    );
    console.log(`  ✅ Created TTL index for notification cleanup`);
  } catch (error) {
    if (error.code !== 85) {
      console.log(`  ⚠️  TTL index warning:`, error.message);
    }
  }
  
  try {
    const stats = await db.command({ collStats: 'notifications' });
    console.log(`  📊 Notifications collection: ${stats.count} documents, ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  } catch (error) {
    console.log(`  📊 Notifications collection: Stats unavailable`);
  }
}

async function optimizeLegalDocumentsCollection(db) {
  console.log('\n📄 Optimizing legal documents collection...');
  
  const legalDocsCollection = db.collection('legaldocuments');
  
  // Create indexes for legal document queries
  const legalDocIndexes = [
    { type: 1, active: 1 }, // Active document queries
    { version: 1 }, // Version queries
    { effectiveDate: -1 }, // Date-based queries
    { type: 1, version: -1 } // Type and version queries
  ];
  
  for (const index of legalDocIndexes) {
    try {
      await legalDocsCollection.createIndex(index);
      console.log(`  ✅ Created index:`, Object.keys(index).join(', '));
    } catch (error) {
      if (error.code !== 85) {
        console.log(`  ⚠️  Index creation warning:`, error.message);
      }
    }
  }
  
  try {
    const stats = await db.command({ collStats: 'legaldocuments' });
    console.log(`  📊 Legal documents collection: ${stats.count} documents, ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  } catch (error) {
    console.log(`  📊 Legal documents collection: Stats unavailable`);
  }
}

async function optimizeMessagesCollection(db) {
  console.log('\n💬 Optimizing messages collection...');
  
  const messagesCollection = db.collection('messages');
  
  // Create indexes for message queries
  const messageIndexes = [
    { chatId: 1, createdAt: -1 }, // Chat message history
    { sender: 1, createdAt: -1 }, // User's messages
    { chatType: 1, createdAt: -1 }, // Messages by chat type
    { status: 1 }, // Message status queries
    { createdAt: -1 } // Recent messages
  ];
  
  for (const index of messageIndexes) {
    try {
      await messagesCollection.createIndex(index);
      console.log(`  ✅ Created index:`, Object.keys(index).join(', '));
    } catch (error) {
      if (error.code !== 85) {
        console.log(`  ⚠️  Index creation warning:`, error.message);
      }
    }
  }
  
  try {
    const stats = await db.command({ collStats: 'messages' });
    console.log(`  📊 Messages collection: ${stats.count} documents, ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  } catch (error) {
    console.log(`  📊 Messages collection: Stats unavailable`);
  }
}

async function optimizeNoticesCollection(db) {
  console.log('\n📢 Optimizing notices collection...');
  
  const noticesCollection = db.collection('notices');
  
  // Create indexes for notice queries
  const noticeIndexes = [
    { neighbourhoodId: 1, status: 1, createdAt: -1 }, // Active notices by neighbourhood
    { author: 1, createdAt: -1 }, // User's notices
    { category: 1, priority: 1 }, // Category and priority queries
    { isPinned: 1, createdAt: -1 }, // Pinned notices
    { title: 'text', content: 'text' }, // Search queries
    { 'likes': 1 }, // Like queries
    { status: 1, createdAt: -1 } // Status-based queries
  ];
  
  for (const index of noticeIndexes) {
    try {
      await noticesCollection.createIndex(index);
      console.log(`  ✅ Created index:`, Object.keys(index).join(', '));
    } catch (error) {
      if (error.code !== 85) {
        console.log(`  ⚠️  Index creation warning:`, error.message);
      }
    }
  }
  
  try {
    const stats = await db.command({ collStats: 'notices' });
    console.log(`  📊 Notices collection: ${stats.count} documents, ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  } catch (error) {
    console.log(`  📊 Notices collection: Stats unavailable`);
  }
}

async function optimizeReportsCollection(db) {
  console.log('\n📋 Optimizing reports collection...');
  
  const reportsCollection = db.collection('reports');
  
  // Create indexes for report queries
  const reportIndexes = [
    { neighbourhoodId: 1, status: 1, createdAt: -1 }, // Active reports by neighbourhood
    { reportedBy: 1, createdAt: -1 }, // User's reports
    { category: 1, priority: 1 }, // Category and priority queries
    { status: 1, createdAt: -1 }, // Status-based queries
    { title: 'text', description: 'text' }, // Search queries
    { 'location.coordinates': '2dsphere' }, // Geospatial queries
    { isAnonymous: 1 } // Anonymous report queries
  ];
  
  for (const index of reportIndexes) {
    try {
      await reportsCollection.createIndex(index);
      console.log(`  ✅ Created index:`, Object.keys(index).join(', '));
    } catch (error) {
      if (error.code !== 85) {
        console.log(`  ⚠️  Index creation warning:`, error.message);
      }
    }
  }
  
  try {
    const stats = await db.command({ collStats: 'reports' });
    console.log(`  📊 Reports collection: ${stats.count} documents, ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  } catch (error) {
    console.log(`  📊 Reports collection: Stats unavailable`);
  }
}

async function createCompoundIndexes(db) {
  // Create compound indexes for complex queries
  const compoundIndexes = [
    {
      collection: 'users',
      index: { neighbourhoodId: 1, role: 1, status: 1 },
      description: 'Neighbourhood admin queries'
    },
    {
      collection: 'notifications',
      index: { recipient: 1, type: 1, read: 1, createdAt: -1 },
      description: 'User notification dashboard'
    },
    {
      collection: 'messages',
      index: { chatId: 1, chatType: 1, createdAt: -1 },
      description: 'Chat message retrieval'
    }
  ];
  
  for (const { collection, index, description } of compoundIndexes) {
    try {
      await db.collection(collection).createIndex(index);
      console.log(`  ✅ Created compound index for ${collection}: ${description}`);
    } catch (error) {
      if (error.code !== 85) {
        console.log(`  ⚠️  Compound index warning for ${collection}:`, error.message);
      }
    }
  }
}

async function updateCollectionStats(db) {
  // Update collection statistics for query optimization
  const collections = ['users', 'notifications', 'legaldocuments', 'messages', 'notices', 'reports'];
  
  for (const collectionName of collections) {
    try {
      await db.command({ reIndex: collectionName });
      console.log(`  ✅ Updated statistics for ${collectionName}`);
    } catch (error) {
      console.log(`  ⚠️  Statistics update warning for ${collectionName}:`, error.message);
    }
  }
}

async function displayOptimizationSummary(db) {
  console.log('\n📋 Optimization Summary:');
  console.log('=' .repeat(50));
  
  const collections = await db.listCollections().toArray();
  let totalSize = 0;
  let totalDocuments = 0;
  
  for (const collection of collections) {
    try {
      const stats = await db.command({ collStats: collection.name });
      const sizeInMB = (stats.size / 1024 / 1024).toFixed(2);
      totalSize += stats.size;
      totalDocuments += stats.count;
      
      console.log(`📊 ${collection.name}: ${stats.count} docs, ${sizeInMB} MB`);
      
      // Show indexes
      const indexes = await db.collection(collection.name).indexes();
      console.log(`   Indexes: ${indexes.length} (${indexes.map(i => i.name).join(', ')})`);
    } catch (error) {
      console.log(`   ⚠️  Could not get stats for ${collection.name}`);
    }
  }
  
  console.log('=' .repeat(50));
  console.log(`📈 Total: ${totalDocuments} documents, ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log('✅ Database optimization completed successfully!');
}

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\n⚠️  Received SIGINT, closing connection...');
  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n⚠️  Received SIGTERM, closing connection...');
  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
  }
  process.exit(0);
});

// Run the optimization
optimizeDatabase().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});