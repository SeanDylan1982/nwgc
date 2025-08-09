const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const debugConnection = async () => {
  try {
    console.log('🔍 Debugging MongoDB Connection...\n');
    
    // Show the connection string (without password)
    const mongoURI = process.env.MONGO_URI;
    console.log('🔍 Environment check:');
    console.log('   MONGO_URI exists:', !!mongoURI);
    
    if (!mongoURI) {
      console.log('❌ MONGO_URI not found in environment variables');
      console.log('📋 Available environment variables:');
      Object.keys(process.env).filter(key => key.includes('MONGO')).forEach(key => {
        console.log(`   ${key}: ${process.env[key] ? 'SET' : 'NOT SET'}`);
      });
      process.exit(1);
    }
    
    const safeURI = mongoURI.replace(/:[^:@]*@/, ':****@');
    console.log('📡 Connection URI:', safeURI);
    
    // Connect to MongoDB
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB successfully\n');
    
    // Get connection details
    const connection = mongoose.connection;
    console.log('🏢 Database Name:', connection.name);
    console.log('🌐 Host:', connection.host);
    console.log('🔌 Port:', connection.port);
    console.log('📊 Ready State:', connection.readyState); // 1 = connected
    
    // List all databases
    console.log('\n📚 All Databases:');
    const admin = connection.db.admin();
    const databases = await admin.listDatabases();
    databases.databases.forEach(db => {
      console.log(`   - ${db.name} (${(db.sizeOnDisk / 1024 / 1024).toFixed(2)} MB)`);
    });
    
    // List collections in current database
    console.log(`\n📁 Collections in '${connection.name}' database:`);
    const collections = await connection.db.listCollections().toArray();
    
    if (collections.length === 0) {
      console.log('   ❌ No collections found!');
    } else {
      for (const collection of collections) {
        const count = await connection.db.collection(collection.name).countDocuments();
        console.log(`   - ${collection.name}: ${count} documents`);
      }
    }
    
    // Test creating a simple document
    console.log('\n🧪 Testing document creation...');
    const testCollection = connection.db.collection('connection_test');
    const testDoc = {
      message: 'Connection test successful',
      timestamp: new Date(),
      connectionDetails: {
        database: connection.name,
        host: connection.host
      }
    };
    
    const result = await testCollection.insertOne(testDoc);
    console.log('✅ Test document created with ID:', result.insertedId);
    
    // Verify the test document
    const foundDoc = await testCollection.findOne({ _id: result.insertedId });
    console.log('✅ Test document retrieved:', foundDoc ? 'Success' : 'Failed');
    
    // Clean up test document
    await testCollection.deleteOne({ _id: result.insertedId });
    console.log('🧹 Test document cleaned up');
    
    console.log('\n🎯 Summary:');
    console.log(`   Database: ${connection.name}`);
    console.log(`   Collections: ${collections.length}`);
    console.log(`   Connection: Working`);
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Connection error:', error);
    process.exit(1);
  }
};

// Run the debug
debugConnection();