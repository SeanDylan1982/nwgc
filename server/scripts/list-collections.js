const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

// Import models
const User = require('../models/User');
const Neighbourhood = require('../models/Neighbourhood');
const ChatGroup = require('../models/ChatGroup');
const Message = require('../models/Message');
const Report = require('../models/Report');
const Notice = require('../models/Notice');

const listCollections = async () => {
  try {
    console.log('🔍 Connecting to MongoDB and listing collections...\n');
    
    // Connect to MongoDB
    const mongoURI = process.env.MONGO_URI;
    console.log('Using connection string:', mongoURI.replace(/:[^:@]*@/, ':****@'));
    
    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB database');
    console.log('Connected to database:', mongoose.connection.name);
    
    // Get all collections in the database
    const collections = await mongoose.connection.db.listCollections().toArray();
    
    console.log('📊 Database Collections:');
    console.log('========================');
    
    for (const collection of collections) {
      const collectionName = collection.name;
      console.log(`\n📁 Collection: ${collectionName}`);
      
      // Get document count
      const count = await mongoose.connection.db.collection(collectionName).countDocuments();
      console.log(`   Documents: ${count}`);
      
      if (count > 0) {
        // Get sample documents (limit to 2 for readability)
        const sampleDocs = await mongoose.connection.db.collection(collectionName)
          .find({})
          .limit(2)
          .toArray();
        
        console.log('   Sample documents:');
        sampleDocs.forEach((doc, index) => {
          // Print a simplified version of the document
          const simplifiedDoc = { 
            _id: doc._id.toString(),
            ...Object.keys(doc)
              .filter(key => key !== '_id')
              .reduce((obj, key) => {
                if (typeof doc[key] === 'object' && doc[key] !== null) {
                  obj[key] = '[Object]';
                } else {
                  obj[key] = doc[key];
                }
                return obj;
              }, {})
          };
          console.log(`   ${index + 1}. ${JSON.stringify(simplifiedDoc, null, 2)}`);
        });
      }
    }
    
    // Also show specific model data using Mongoose
    console.log('\n\n🏠 Neighbourhoods:');
    const neighbourhoods = await Neighbourhood.find({});
    if (neighbourhoods.length === 0) {
      console.log('   No neighbourhoods found');
    } else {
      neighbourhoods.forEach(n => {
        console.log(`   - ${n.name} (${n.city}, ${n.state}) - Active: ${n.isActive}`);
      });
    }
    
    console.log('\n👥 Users:');
    const users = await User.find({});
    if (users.length === 0) {
      console.log('   No users found');
    } else {
      users.forEach(u => {
        console.log(`   - ${u.firstName} ${u.lastName} (${u.email}) - Role: ${u.role}`);
      });
    }
    
    console.log('\n💬 Chat Groups:');
    const chatGroups = await ChatGroup.find({});
    if (chatGroups.length === 0) {
      console.log('   No chat groups found');
    } else {
      chatGroups.forEach(g => {
        console.log(`   - ${g.name} (${g.type}) - Members: ${g.members?.length || 0}`);
      });
    }
    
    console.log('\n📊 Collection Summary:');
    console.log('=====================');
    console.log(`Total Collections: ${collections.length}`);
    console.log(`Users: ${await User.countDocuments()}`);
    console.log(`Neighbourhoods: ${await Neighbourhood.countDocuments()}`);
    console.log(`Chat Groups: ${await ChatGroup.countDocuments()}`);
    console.log(`Messages: ${await Message.countDocuments()}`);
    console.log(`Reports: ${await Report.countDocuments()}`);
    console.log(`Notices: ${await Notice.countDocuments()}`);
    
    console.log('\n✅ Database query completed successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error querying database:', error);
    process.exit(1);
  }
};

// Run the query
listCollections();