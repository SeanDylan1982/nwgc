/**
 * MongoDB Connection Test Script
 * Tests the MongoDB connection with enhanced error handling and diagnostics
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const mongoose = require('mongoose');

async function testConnection() {
  console.log('Testing MongoDB connection...');
  console.log('Environment:', process.env.NODE_ENV || 'development');
  
  // Mask the connection string for security
  const maskedUri = process.env.MONGO_URI?.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@') || 'Not configured';
  console.log('Connection URI:', maskedUri);
  
  try {
    // Enhanced connection options for better reliability
    const options = {
      serverSelectionTimeoutMS: 10000, // Shorter timeout for testing
      socketTimeoutMS: 30000,
      connectTimeoutMS: 10000,
      maxPoolSize: 5,
      minPoolSize: 1,
      retryWrites: true,
      retryReads: true,
      family: 4, // Use IPv4
      heartbeatFrequencyMS: 5000,
      tls: true, // Enable TLS for Atlas
      tlsAllowInvalidCertificates: false,
      tlsAllowInvalidHostnames: false
    };

    console.log('Attempting connection with options:', {
      serverSelectionTimeoutMS: options.serverSelectionTimeoutMS,
      socketTimeoutMS: options.socketTimeoutMS,
      connectTimeoutMS: options.connectTimeoutMS,
      tls: options.tls
    });

    const startTime = Date.now();
    await mongoose.connect(process.env.MONGO_URI, options);
    const connectionTime = Date.now() - startTime;
    
    console.log(`✅ MongoDB connected successfully in ${connectionTime}ms`);
    console.log('Connection state:', mongoose.connection.readyState);
    console.log('Database name:', mongoose.connection.name);
    console.log('Host:', mongoose.connection.host);
    console.log('Port:', mongoose.connection.port);
    
    // Test a simple operation
    console.log('\nTesting database operations...');
    const testStart = Date.now();
    await mongoose.connection.db.admin().ping();
    const pingTime = Date.now() - testStart;
    console.log(`✅ Database ping successful in ${pingTime}ms`);
    
    // List collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`📊 Found ${collections.length} collections:`, collections.map(c => c.name).join(', '));
    
    // Test user collection if it exists
    const userCollection = collections.find(c => c.name === 'users');
    if (userCollection) {
      const userCount = await mongoose.connection.db.collection('users').countDocuments();
      console.log(`👥 Users collection has ${userCount} documents`);
    }
    
    console.log('\n✅ All tests passed! MongoDB connection is working correctly.');
    
  } catch (error) {
    console.error('\n❌ MongoDB connection failed:');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    
    if (error.name === 'MongoServerSelectionError') {
      console.error('\n🔍 Server Selection Error Details:');
      console.error('- This usually indicates network connectivity issues');
      console.error('- Check if your IP address is whitelisted in MongoDB Atlas');
      console.error('- Verify the connection string is correct');
      console.error('- Ensure your internet connection is stable');
      
      if (error.reason) {
        console.error('Reason:', error.reason);
      }
    } else if (error.name === 'MongoNetworkError') {
      console.error('\n🔍 Network Error Details:');
      console.error('- Check your internet connection');
      console.error('- Verify firewall settings');
      console.error('- Try connecting from a different network');
    } else if (error.name === 'MongoParseError') {
      console.error('\n🔍 Parse Error Details:');
      console.error('- Check the MongoDB connection string format');
      console.error('- Verify username and password are correct');
    }
    
    console.error('\n🛠️  Troubleshooting steps:');
    console.error('1. Check MongoDB Atlas dashboard for cluster status');
    console.error('2. Verify IP whitelist includes your current IP');
    console.error('3. Test connection from MongoDB Compass');
    console.error('4. Check if credentials are correct');
    console.error('5. Try connecting from a different network');
    
    process.exit(1);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('\n🔌 Disconnected from MongoDB');
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

// Run the test
testConnection().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});