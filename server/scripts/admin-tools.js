const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const readline = require('readline');
const User = require('../models/User');
const Neighbourhood = require('../models/Neighbourhood');
require('dotenv').config({ path: '../.env.local' });

const connectDB = require('../config/database');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper function to prompt for input
const prompt = (question) => {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
};

// Main menu
async function showMenu() {
  console.log('\n===== Admin Tools =====');
  console.log('1. Create admin user');
  console.log('2. List all users');
  console.log('3. Promote user to admin');
  console.log('4. Reset user password');
  console.log('5. Exit');
  
  const choice = await prompt('\nEnter your choice (1-5): ');
  
  switch (choice) {
    case '1':
      await createAdminUser();
      break;
    case '2':
      await listUsers();
      break;
    case '3':
      await promoteUser();
      break;
    case '4':
      await resetPassword();
      break;
    case '5':
      console.log('Exiting...');
      rl.close();
      await mongoose.connection.close();
      process.exit(0);
      break;
    default:
      console.log('Invalid choice. Please try again.');
      await showMenu();
  }
}

// Create admin user
async function createAdminUser() {
  try {
    console.log('\n=== Create Admin User ===');
    
    // Check if admin user already exists
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      console.log('Admin user already exists:', existingAdmin.email);
      console.log('You can create another admin user if needed.');
    }

    // Get user input
    const email = await prompt('Enter email: ');
    const firstName = await prompt('Enter first name: ');
    const lastName = await prompt('Enter last name: ');
    const password = await prompt('Enter password: ');
    
    // Get or create a default neighbourhood
    let neighbourhood = await Neighbourhood.findOne();
    if (!neighbourhood) {
      const neighbourhoodName = await prompt('No neighbourhoods found. Enter name for default neighbourhood: ');
      
      neighbourhood = new Neighbourhood({
        name: neighbourhoodName || 'Default Neighbourhood',
        description: 'Default neighbourhood for admin user',
        location: {
          address: 'Default Location',
          coordinates: [0, 0]
        },
        isActive: true
      });
      await neighbourhood.save();
      console.log('Created default neighbourhood:', neighbourhood.name);
    }

    // Create admin user
    const hashedPassword = await bcrypt.hash(password, 12);
    
    const adminUser = new User({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      phone: '+1234567890', // Default phone
      address: 'Admin Address', // Default address
      role: 'admin',
      status: 'active',
      isActive: true,
      isVerified: true,
      neighbourhoodId: neighbourhood._id,
      settings: {
        notificationsEnabled: true,
        emailNotifications: true,
        pushNotifications: true,
        chatNotifications: true,
        reportNotifications: true,
        privacyLevel: 'public',
        locationSharing: true
      }
    });

    await adminUser.save();
    console.log('\nAdmin user created successfully!');
    console.log('Email:', email);
    console.log('Role: admin');
    
    await showMenu();
  } catch (error) {
    console.error('Error creating admin user:', error);
    await showMenu();
  }
}

// List all users
async function listUsers() {
  try {
    console.log('\n=== User List ===');
    
    const users = await User.find().select('email firstName lastName role status createdAt');
    
    if (users.length === 0) {
      console.log('No users found.');
    } else {
      console.log('Total users:', users.length);
      console.log('\nID | Email | Name | Role | Status | Created');
      console.log('--------------------------------------------------');
      
      users.forEach(user => {
        console.log(
          `${user._id.toString().slice(-6)} | ${user.email} | ${user.firstName} ${user.lastName} | ${user.role} | ${user.status || 'active'} | ${new Date(user.createdAt).toLocaleDateString()}`
        );
      });
    }
    
    await showMenu();
  } catch (error) {
    console.error('Error listing users:', error);
    await showMenu();
  }
}

// Promote user to admin
async function promoteUser() {
  try {
    console.log('\n=== Promote User to Admin ===');
    
    const email = await prompt('Enter user email to promote: ');
    
    const user = await User.findOne({ email });
    if (!user) {
      console.log('User not found.');
      await showMenu();
      return;
    }
    
    if (user.role === 'admin') {
      console.log('User is already an admin.');
      await showMenu();
      return;
    }
    
    user.role = 'admin';
    await user.save();
    
    console.log(`User ${user.email} promoted to admin successfully!`);
    await showMenu();
  } catch (error) {
    console.error('Error promoting user:', error);
    await showMenu();
  }
}

// Reset user password
async function resetPassword() {
  try {
    console.log('\n=== Reset User Password ===');
    
    const email = await prompt('Enter user email: ');
    
    const user = await User.findOne({ email });
    if (!user) {
      console.log('User not found.');
      await showMenu();
      return;
    }
    
    const newPassword = await prompt('Enter new password: ');
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    user.password = hashedPassword;
    await user.save();
    
    console.log(`Password reset successfully for ${user.email}!`);
    await showMenu();
  } catch (error) {
    console.error('Error resetting password:', error);
    await showMenu();
  }
}

// Main function
async function main() {
  try {
    // Connect to database
    await connectDB();
    console.log('Connected to database');
    
    await showMenu();
  } catch (error) {
    console.error('Error:', error);
    rl.close();
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Start the script
main();