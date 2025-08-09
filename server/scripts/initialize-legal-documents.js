/**
 * Script to initialize default legal documents
 * Run this script to create the default Terms of Service and Privacy Policy
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const mongoose = require('mongoose');
const LegalDocumentService = require('../services/LegalDocumentService');

async function initializeLegalDocuments() {
  try {
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
    
    console.log('Connected to MongoDB successfully');
    
    // Initialize legal documents
    console.log('Initializing legal documents...');
    await LegalDocumentService.initializeDefaultDocuments();
    
    console.log('✅ Legal documents initialized successfully!');
    
  } catch (error) {
    console.error('❌ Error initializing legal documents:', error);
    process.exit(1);
  } finally {
    // Close MongoDB connection
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('Disconnected from MongoDB');
    }
  }
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

// Run the initialization
initializeLegalDocuments().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});