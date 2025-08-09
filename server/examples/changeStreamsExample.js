/**
 * Example demonstrating how to use the ChangeStreamManager and RealTimeService
 * 
 * This example shows:
 * 1. How to initialize the change stream manager
 * 2. How to listen for change events
 * 3. How to handle reconnections
 * 4. How to integrate with Socket.IO
 */

// Import required modules
const mongoose = require('mongoose');
require('dotenv').config();
const ChangeStreamManager = require('../services/ChangeStreamManager');
const RealTimeService = require('../services/RealTimeService');
const { createServer } = require('http');
const { Server } = require('socket.io');
const express = require('express');

// Create Express app and HTTP server
const app = express();
const server = createServer(app);
const io = new Server(server);

// Connect to MongoDB
async function connectToMongoDB() {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI environment variable is required. Local MongoDB connections are not allowed.');
    }
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');
    return true;
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    return false;
  }
}

// Example 1: Basic usage of ChangeStreamManager
async function basicChangeStreamExample() {
  console.log('\n--- Example 1: Basic Change Stream Usage ---');
  
  // Create change stream manager
  const changeStreamManager = new ChangeStreamManager({
    collections: ['messages', 'reports'],
    maxRetries: 5,
    initialDelayMs: 1000,
    maxDelayMs: 10000
  });
  
  // Listen for change events
  changeStreamManager.on('change', (data) => {
    console.log(`Change detected in ${data.collection}:`, data.change.operationType);
  });
  
  // Listen for collection-specific events
  changeStreamManager.on('messages_change', (change) => {
    console.log('Message change:', change.operationType);
    
    if (change.operationType === 'insert') {
      console.log('New message:', change.fullDocument.content);
    }
  });
  
  // Listen for errors
  changeStreamManager.on('error', (error) => {
    console.error('Change stream error:', error);
  });
  
  // Initialize change streams
  await changeStreamManager.initialize();
  
  console.log('Change streams initialized. Listening for changes...');
  console.log('Try inserting a document into the messages collection to see events.');
  
  // Keep the example running for a while
  await new Promise(resolve => setTimeout(resolve, 30000));
  
  // Close change streams
  await changeStreamManager.close();
  console.log('Change streams closed');
}

// Example 2: Integration with Socket.IO
async function socketIntegrationExample() {
  console.log('\n--- Example 2: Socket.IO Integration ---');
  
  // Set up Socket.IO
  io.on('connection', (socket) => {
    console.log('Client connected');
    
    // Join rooms based on user data
    socket.join('user_123'); // Example user ID
    socket.join('neighbourhood_456'); // Example neighbourhood ID
    
    socket.on('disconnect', () => {
      console.log('Client disconnected');
    });
  });
  
  // Create real-time service
  const realTimeService = new RealTimeService(io, {
    collections: ['messages', 'reports', 'notices'],
    maxRetries: 5
  });
  
  // Initialize real-time service
  await realTimeService.initialize();
  console.log('Real-time service initialized');
  
  // Start the server
  const PORT = 3001;
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('Connect a Socket.IO client to see real-time updates');
    console.log('Try inserting documents into the monitored collections');
  });
  
  // Keep the example running for a while
  await new Promise(resolve => setTimeout(resolve, 60000));
  
  // Close real-time service
  await realTimeService.close();
  console.log('Real-time service closed');
  
  // Close server
  server.close(() => {
    console.log('Server closed');
  });
}

// Example 3: Manual testing of change stream reconnection
async function reconnectionExample() {
  console.log('\n--- Example 3: Reconnection Testing ---');
  
  // Create change stream manager with short retry settings for demonstration
  const changeStreamManager = new ChangeStreamManager({
    collections: ['messages'],
    maxRetries: 10,
    initialDelayMs: 500,
    maxDelayMs: 5000
  });
  
  // Listen for events
  changeStreamManager.on('change', (data) => {
    console.log(`Change detected in ${data.collection}:`, data.change.operationType);
  });
  
  changeStreamManager.on('reconnecting', (data) => {
    console.log(`Reconnecting to ${data.collection} (attempt ${data.attempt})`);
  });
  
  changeStreamManager.on('stream_error', (data) => {
    console.error(`Stream error in ${data.collection}:`, data.error.message);
  });
  
  changeStreamManager.on('stream_closed', (data) => {
    console.log(`Stream closed for ${data.collection}`);
  });
  
  // Initialize change streams
  await changeStreamManager.initialize();
  console.log('Change streams initialized');
  
  // Simulate stream disconnection
  console.log('Simulating stream disconnection in 5 seconds...');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Get the messages stream and force close it
  const messagesStream = changeStreamManager.streams.get('messages');
  if (messagesStream) {
    console.log('Forcing stream closure to test reconnection...');
    messagesStream.close();
  }
  
  // Wait to observe reconnection
  console.log('Observing reconnection behavior...');
  await new Promise(resolve => setTimeout(resolve, 20000));
  
  // Check status
  const status = changeStreamManager.getStatus();
  console.log('Change stream status:', status);
  
  // Close change streams
  await changeStreamManager.close();
  console.log('Change streams closed');
}

// Run the examples
async function runExamples() {
  // Connect to MongoDB
  const connected = await connectToMongoDB();
  if (!connected) {
    console.error('Cannot run examples without MongoDB connection');
    process.exit(1);
  }
  
  // Run examples
  try {
    // Choose which example to run
    const example = process.argv[2] || '1';
    
    switch (example) {
      case '1':
        await basicChangeStreamExample();
        break;
      case '2':
        await socketIntegrationExample();
        break;
      case '3':
        await reconnectionExample();
        break;
      default:
        console.log('Invalid example number. Choose 1, 2, or 3.');
    }
  } catch (error) {
    console.error('Error running examples:', error);
  } finally {
    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the examples if this file is executed directly
if (require.main === module) {
  runExamples();
}

module.exports = {
  basicChangeStreamExample,
  socketIntegrationExample,
  reconnectionExample
};