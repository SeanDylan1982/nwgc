/**
 * Database optimization script to improve query performance
 * This script creates indexes and optimizes collections for better performance
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// Import models to ensure they're registered
const User = require('../models/User');
const Report = require('../models/Report');

async function optimizeDatabase() {
  try {
    console.log('Connecting to MongoDB...');
    console.log('MongoDB URI:', process.env.MONGODB_URI ? 'Found' : 'Not found');
    
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is not set');
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;

    // Create indexes for better query performance
    console.log('Creating database indexes...');

    // User collection indexes
    console.log('Optimizing User collection...');
    try {
      await db.collection('users').createIndex({ neighbourhoodId: 1, isActive: 1 });
      await db.collection('users').createIndex({ email: 1 }, { unique: true });
      await db.collection('users').createIndex({ role: 1 });
      await db.collection('users').createIndex({ status: 1 });
      await db.collection('users').createIndex({ createdAt: -1 });
      console.log('User indexes created successfully');
    } catch (error) {
      console.log('User indexes error:', error.message);
    }

    // Report collection indexes
    console.log('Optimizing Report collection...');
    try {
      await db.collection('reports').createIndex({ neighbourhoodId: 1, reportStatus: 1, createdAt: -1 });
      await db.collection('reports').createIndex({ category: 1, status: 1 });
      await db.collection('reports').createIndex({ priority: 1 });
      await db.collection('reports').createIndex({ reporterId: 1 });
      await db.collection('reports').createIndex({ createdAt: -1 });
      console.log('Report indexes created successfully');
    } catch (error) {
      console.log('Report indexes error:', error.message);
    }

    // Create compound indexes for common query patterns
    console.log('Creating compound indexes...');
    
    try {
      // Reports: neighbourhood + status + category + created date
      await db.collection('reports').createIndex({ 
        neighbourhoodId: 1, 
        reportStatus: 1, 
        category: 1, 
        createdAt: -1 
      });

      // Users: neighbourhood + active + role
      await db.collection('users').createIndex({ 
        neighbourhoodId: 1, 
        isActive: 1, 
        role: 1 
      });
      
      console.log('Compound indexes created successfully');
    } catch (error) {
      console.log('Compound indexes error:', error.message);
    }

    console.log('Database optimization completed successfully!');

    // Get collection stats
    console.log('\nCollection Statistics:');
    const collections = ['users', 'reports'];
    
    for (const collectionName of collections) {
      try {
        const stats = await db.collection(collectionName).stats();
        console.log(`${collectionName}: ${stats.count} documents, ${Math.round(stats.size / 1024)} KB`);
      } catch (error) {
        console.log(`${collectionName}: Collection not found or empty`);
      }
    }

    // List all indexes
    console.log('\nCreated Indexes:');
    for (const collectionName of collections) {
      try {
        const indexes = await db.collection(collectionName).indexes();
        console.log(`\n${collectionName} indexes:`);
        indexes.forEach(index => {
          console.log(`  - ${JSON.stringify(index.key)}`);
        });
      } catch (error) {
        console.log(`${collectionName}: Could not retrieve indexes`);
      }
    }

  } catch (error) {
    console.error('Database optimization failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
    process.exit(0);
  }
}

// Run the optimization
if (require.main === module) {
  optimizeDatabase();
}

module.exports = optimizeDatabase;