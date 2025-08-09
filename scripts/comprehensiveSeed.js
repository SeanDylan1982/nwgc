/**
 * Comprehensive Database Seeding Script
 * Creates extensive test data for all collections to ensure proper frontend-backend synchronization
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// Import all models
const User = require('../models/User');
const Neighbourhood = require('../models/Neighbourhood');
const ChatGroup = require('../models/ChatGroup');
const PrivateChat = require('../models/PrivateChat');
const Message = require('../models/Message');
const Notice = require('../models/Notice');
const Report = require('../models/Report');
const FriendRequest = require('../models/FriendRequest');
const Notification = require('../models/Notification');
const LegalDocument = require('../models/LegalDocument');

const connectDB = require('../config/database');

class ComprehensiveSeed {
  constructor() {
    this.users = [];
    this.neighbourhood = null;
    this.chatGroups = [];
    this.privateChats = [];
    this.notices = [];
    this.reports = [];
  }

  async run() {
    try {
      console.log('🌱 Starting comprehensive database seeding...');
      
      // Connect to MongoDB
      await connectDB();
      console.log('✅ Connected to MongoDB');
      
      // Clear existing data
      await this.clearDatabase();
      
      // Create data in order
      await this.createNeighbourhood();
      await this.createUsers();
      await this.createFriendships();
      await this.createChatGroups();
      await this.createPrivateChats();
      await this.createNotices();
      await this.createReports();
      await this.createMessages();
      await this.createNotifications();
      await this.createLegalDocuments();
      
      // Display summary
      await this.displaySummary();
      
      console.log('\n🎉 Comprehensive database seeding completed successfully!');
      
    } catch (error) {
      console.error('❌ Database seeding failed:', error);
      process.exit(1);
    } finally {
      await mongoose.disconnect();
      console.log('\n🔌 Disconnected from MongoDB');
      process.exit(0);
    }
  }

  async clearDatabase() {
    console.log('🧹 Clearing existing data...');
    
    const collections = [
      User, Neighbourhood, ChatGroup, PrivateChat, Message,
      Notice, Report, FriendRequest, Notification, LegalDocument
    ];
    
    for (const Model of collections) {
      await Model.deleteMany({});
    }
    
    console.log('✅ Database cleared');
  }

  async createNeighbourhood() {
    console.log('🏘️ Creating neighbourhood...');
    
    // Create a temporary admin user for neighbourhood creation
    const tempAdmin = new User({
      email: 'temp@admin.com',
      password: await bcrypt.hash('temp123', 12),
      firstName: 'Temp',
      lastName: 'Admin',
      role: 'admin',
      isVerified: true,
      isActive: true
    });
    await tempAdmin.save();
    
    this.neighbourhood = new Neighbourhood({
      name: 'Oakwood Heights',
      description: 'A vibrant and safe neighbourhood community where neighbours look out for each other',
      address: '1000 Oak Street',
      city: 'Springfield',
      state: 'IL',
      zipCode: '62701',
      country: 'USA',
      location: {
        type: 'Point',
        coordinates: [-89.6501, 39.7817] // Springfield, IL coordinates
      },
      radiusMeters: 2000,
      isActive: true,
      createdBy: tempAdmin._id
    });
    
    await this.neighbourhood.save();
    
    // Remove temp admin
    await User.deleteOne({ _id: tempAdmin._id });
    
    console.log('✅ Neighbourhood created: Oakwood Heights');
  }

  async createUsers() {
    console.log('👥 Creating users...');
    
    const usersData = [
      // Admin user
      {
        email: 'admin@neighbourhood.com',
        password: 'admin123',
        firstName: 'Sarah',
        lastName: 'Administrator',
        phone: '+1-555-0001',
        address: '1001 Oak Street, Springfield, IL',
        role: 'admin',
        bio: 'Community administrator dedicated to keeping our neighbourhood safe and connected.',
        isVerified: true,
        isActive: true
      },
      
      // Moderator users
      {
        email: 'moderator@neighbourhood.com',
        password: 'mod123',
        firstName: 'Michael',
        lastName: 'Johnson',
        phone: '+1-555-0002',
        address: '1002 Oak Street, Springfield, IL',
        role: 'moderator',
        bio: 'Neighbourhood watch coordinator and community moderator.',
        isVerified: true,
        isActive: true
      },
      {
        email: 'mod2@neighbourhood.com',
        password: 'mod123',
        firstName: 'Lisa',
        lastName: 'Chen',
        phone: '+1-555-0003',
        address: '1003 Oak Street, Springfield, IL',
        role: 'moderator',
        bio: 'Event organizer and community safety advocate.',
        isVerified: true,
        isActive: true
      },
      
      // Regular users
      {
        email: 'john.doe@neighbourhood.com',
        password: 'user123',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+1-555-0004',
        address: '1004 Oak Street, Springfield, IL',
        role: 'user',
        bio: 'Father of two, loves gardening and community events.',
        isVerified: true,
        isActive: true
      },
      {
        email: 'jane.smith@neighbourhood.com',
        password: 'user123',
        firstName: 'Jane',
        lastName: 'Smith',
        phone: '+1-555-0005',
        address: '1005 Oak Street, Springfield, IL',
        role: 'user',
        bio: 'Local teacher and pet owner. Always happy to help neighbours.',
        isVerified: true,
        isActive: true
      },
      {
        email: 'robert.wilson@neighbourhood.com',
        password: 'user123',
        firstName: 'Robert',
        lastName: 'Wilson',
        phone: '+1-555-0006',
        address: '1006 Oak Street, Springfield, IL',
        role: 'user',
        bio: 'Retired engineer who enjoys woodworking and helping with repairs.',
        isVerified: true,
        isActive: true
      },
      {
        email: 'emily.davis@neighbourhood.com',
        password: 'user123',
        firstName: 'Emily',
        lastName: 'Davis',
        phone: '+1-555-0007',
        address: '1007 Oak Street, Springfield, IL',
        role: 'user',
        bio: 'Nurse and mother of three. Active in school and community activities.',
        isVerified: true,
        isActive: true
      },
      {
        email: 'david.brown@neighbourhood.com',
        password: 'user123',
        firstName: 'David',
        lastName: 'Brown',
        phone: '+1-555-0008',
        address: '1008 Oak Street, Springfield, IL',
        role: 'user',
        bio: 'Small business owner and volunteer firefighter.',
        isVerified: true,
        isActive: true
      },
      {
        email: 'maria.garcia@neighbourhood.com',
        password: 'user123',
        firstName: 'Maria',
        lastName: 'Garcia',
        phone: '+1-555-0009',
        address: '1009 Oak Street, Springfield, IL',
        role: 'user',
        bio: 'Chef and food blogger. Loves organizing neighbourhood potlucks.',
        isVerified: true,
        isActive: true
      },
      {
        email: 'james.taylor@neighbourhood.com',
        password: 'user123',
        firstName: 'James',
        lastName: 'Taylor',
        phone: '+1-555-0010',
        address: '1010 Oak Street, Springfield, IL',
        role: 'user',
        bio: 'IT professional working from home. Tech support for neighbours.',
        isVerified: true,
        isActive: true
      },
      {
        email: 'susan.white@neighbourhood.com',
        password: 'user123',
        firstName: 'Susan',
        lastName: 'White',
        phone: '+1-555-0011',
        address: '1011 Oak Street, Springfield, IL',
        role: 'user',
        bio: 'Librarian and book club organizer. Loves reading and quiet activities.',
        isVerified: true,
        isActive: true
      },
      {
        email: 'thomas.anderson@neighbourhood.com',
        password: 'user123',
        firstName: 'Thomas',
        lastName: 'Anderson',
        phone: '+1-555-0012',
        address: '1012 Oak Street, Springfield, IL',
        role: 'user',
        bio: 'Fitness enthusiast and personal trainer. Organizes morning jogs.',
        isVerified: true,
        isActive: true
      }
    ];

    for (const userData of usersData) {
      // Don't hash password manually - let the User model's pre-save hook handle it
      const user = new User({
        ...userData,
        neighbourhoodId: this.neighbourhood._id,
        settings: {
          notifications: {
            email: true,
            push: true,
            friendRequests: true,
            messages: true,
            chatNotifications: true,
            reportNotifications: true
          },
          privacy: {
            profileVisibility: 'neighbours',
            messagePermissions: 'friends'
          },
          locationSharing: false,
          dismissedWelcomeMessages: {
            chat: false,
            noticeBoard: false,
            reports: false
          },
          interface: {
            sidebarExpanded: false,
            darkMode: false,
            language: 'en'
          }
        }
      });
      
      await user.save();
      this.users.push(user);
      console.log(`✅ Created user: ${userData.firstName} ${userData.lastName} (${userData.role})`);
    }
    
    // Update neighbourhood createdBy to admin user
    this.neighbourhood.createdBy = this.users[0]._id;
    await this.neighbourhood.save();
  }

  async createFriendships() {
    console.log('🤝 Creating friendships and friend requests...');
    
    // Create some friendships
    const friendships = [
      [0, 3], // Admin and John
      [1, 4], // Moderator and Jane
      [3, 4], // John and Jane
      [4, 5], // Jane and Robert
      [5, 6], // Robert and Emily
      [6, 7], // Emily and David
      [7, 8], // David and Maria
      [8, 9], // Maria and James
      [9, 10], // James and Susan
      [3, 6], // John and Emily
      [4, 7], // Jane and David
      [5, 8]  // Robert and Maria
    ];

    for (const [userIndex1, userIndex2] of friendships) {
      const user1 = this.users[userIndex1];
      const user2 = this.users[userIndex2];
      
      // Add to friends arrays
      user1.friends.push(user2._id);
      user2.friends.push(user1._id);
      
      await user1.save();
      await user2.save();
      
      console.log(`✅ Created friendship: ${user1.firstName} ↔ ${user2.firstName}`);
    }

    // Create some pending friend requests
    const pendingRequests = [
      [10, 11], // Susan to Thomas
      [2, 9],   // Lisa to James
      [11, 2]   // Thomas to Lisa
    ];

    for (const [fromIndex, toIndex] of pendingRequests) {
      const friendRequest = new FriendRequest({
        from: this.users[fromIndex]._id,
        to: this.users[toIndex]._id,
        status: 'pending',
        message: 'Hi! I\'d like to connect with you as a neighbour.'
      });
      
      await friendRequest.save();
      console.log(`✅ Created friend request: ${this.users[fromIndex].firstName} → ${this.users[toIndex].firstName}`);
    }
  }

  async createChatGroups() {
    console.log('💬 Creating chat groups...');
    
    const chatGroupsData = [
      {
        name: 'General Discussion',
        description: 'Main community chat for general neighbourhood discussions',
        type: 'public',
        members: this.users.map((user, index) => ({
          userId: user._id,
          role: index === 0 ? 'admin' : (index <= 2 ? 'moderator' : 'member')
        }))
      },
      {
        name: 'Safety Alerts',
        description: 'Important safety notifications and emergency communications',
        type: 'announcement',
        members: this.users.map((user, index) => ({
          userId: user._id,
          role: index === 0 ? 'admin' : (index <= 2 ? 'moderator' : 'member')
        }))
      },
      {
        name: 'Community Events',
        description: 'Planning and coordination for neighbourhood events',
        type: 'public',
        members: this.users.slice(0, 8).map((user, index) => ({
          userId: user._id,
          role: index === 0 ? 'admin' : (index <= 2 ? 'moderator' : 'member')
        }))
      },
      {
        name: 'Parents Group',
        description: 'Chat for parents in the neighbourhood',
        type: 'private',
        members: [3, 4, 6, 8].map(index => ({
          userId: this.users[index]._id,
          role: index === 3 ? 'admin' : 'member'
        }))
      },
      {
        name: 'Book Club',
        description: 'Monthly book discussions and recommendations',
        type: 'private',
        members: [4, 6, 8, 10].map(index => ({
          userId: this.users[index]._id,
          role: index === 10 ? 'admin' : 'member'
        }))
      }
    ];

    for (const groupData of chatGroupsData) {
      const chatGroup = new ChatGroup({
        name: groupData.name,
        description: groupData.description,
        type: groupData.type,
        neighbourhoodId: this.neighbourhood._id,
        createdBy: this.users[0]._id,
        members: groupData.members,
        isActive: true,
        lastActivity: new Date()
      });
      
      await chatGroup.save();
      this.chatGroups.push(chatGroup);
      console.log(`✅ Created chat group: ${groupData.name} (${groupData.members.length} members)`);
    }
  }

  async createPrivateChats() {
    console.log('💌 Creating private chats...');
    
    // Create private chats between friends
    const privateChatPairs = [
      [0, 3], // Admin and John
      [1, 4], // Moderator and Jane
      [3, 4], // John and Jane
      [4, 5], // Jane and Robert
      [6, 7], // Emily and David
      [8, 9]  // Maria and James
    ];

    for (const [userIndex1, userIndex2] of privateChatPairs) {
      const user1 = this.users[userIndex1];
      const user2 = this.users[userIndex2];
      
      // Sort participants to ensure consistent ordering for unique index
      const participants = [user1._id, user2._id].sort((a, b) => a.toString().localeCompare(b.toString()));
      
      try {
        // Check if private chat already exists using $all operator
        const existingChat = await PrivateChat.findOne({ 
          participants: { $all: participants, $size: 2 }
        });
        
        if (existingChat) {
          console.log(`⚠️ Private chat already exists: ${user1.firstName} ↔ ${user2.firstName}`);
          this.privateChats.push(existingChat);
          continue;
        }
        
        const privateChat = new PrivateChat({
          participants,
          lastMessage: {
            content: 'Hey! How are you doing?',
            sender: user1._id,
            timestamp: new Date(),
            messageType: 'text'
          },
          isActive: true,
          status: 'active'
        });
        
        await privateChat.save();
        this.privateChats.push(privateChat);
        console.log(`✅ Created private chat: ${user1.firstName} ↔ ${user2.firstName}`);
        
      } catch (error) {
        if (error.code === 11000) {
          console.log(`⚠️ Duplicate private chat detected, skipping: ${user1.firstName} ↔ ${user2.firstName}`);
          // Try to find the existing chat and add it to our array
          const existingChat = await PrivateChat.findOne({ 
            participants: { $all: participants, $size: 2 }
          });
          if (existingChat) {
            this.privateChats.push(existingChat);
          }
        } else {
          throw error;
        }
      }
    }
  }

  async createNotices() {
    console.log('📢 Creating notices...');
    
    const noticesData = [
      {
        title: 'Community BBQ This Weekend',
        content: 'Join us for our monthly community BBQ this Saturday at 2 PM in the park. Bring your family and friends! We\'ll have grills, games, and great company. Don\'t forget to bring a side dish to share.',
        category: 'event',
        priority: 'normal',
        authorId: this.users[8]._id, // Maria
        isPinned: true,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 1 week
      },
      {
        title: 'Suspicious Activity Alert',
        content: 'Please be aware of suspicious activity reported on Pine Street between 10 PM and 12 AM. If you see anything unusual, please contact local authorities immediately. Stay vigilant and look out for each other.',
        category: 'safety',
        priority: 'high',
        authorId: this.users[0]._id, // Admin
        isPinned: true
      },
      {
        title: 'Lost Cat - Fluffy',
        content: 'Orange tabby cat, very friendly, wearing a blue collar with bell. Last seen near Elm Street on Tuesday evening. Fluffy is microchipped. Please contact me if found - reward offered!',
        category: 'lost_found',
        priority: 'normal',
        authorId: this.users[4]._id, // Jane
        likes: [this.users[3]._id, this.users[5]._id, this.users[6]._id],
        comments: [
          {
            author: this.users[3]._id,
            content: 'I\'ll keep an eye out! Hope you find Fluffy soon.',
            createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000)
          },
          {
            author: this.users[5]._id,
            content: 'Shared with my family. We\'ll watch for orange cats.',
            createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000)
          }
        ]
      },
      {
        title: 'Street Cleaning Schedule Update',
        content: 'Street cleaning will now occur every Tuesday from 8 AM to 12 PM starting next week. Please move your vehicles to avoid tickets. Thank you for keeping our neighbourhood clean!',
        category: 'maintenance',
        priority: 'normal',
        authorId: this.users[1]._id, // Moderator
        likes: [this.users[0]._id, this.users[7]._id]
      },
      {
        title: 'New Playground Equipment',
        content: 'Great news! New playground equipment has been installed at the community park. The area is now open for children to enjoy. Please supervise young children and report any maintenance issues.',
        category: 'general',
        priority: 'low',
        authorId: this.users[6]._id, // Emily
        likes: [this.users[3]._id, this.users[4]._id, this.users[8]._id],
        comments: [
          {
            author: this.users[3]._id,
            content: 'This is fantastic! My kids will love it.',
            createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000)
          }
        ]
      },
      {
        title: 'Neighbourhood Watch Meeting',
        content: 'Monthly neighbourhood watch meeting this Thursday at 7 PM at the community center. We will discuss recent security concerns and plan patrol schedules. All residents welcome!',
        category: 'safety',
        priority: 'normal',
        authorId: this.users[1]._id, // Moderator
        isPinned: false
      },
      {
        title: 'Garage Sale Weekend',
        content: 'Annual neighbourhood garage sale weekend is coming up! Mark your calendars for the first weekend of next month. Great opportunity to declutter and find treasures.',
        category: 'event',
        priority: 'low',
        authorId: this.users[10]._id, // Susan
        likes: [this.users[4]._id, this.users[7]._id, this.users[9]._id]
      },
      {
        title: 'Winter Weather Preparation',
        content: 'With winter approaching, please remember to winterize your outdoor pipes and clear gutters. The city will begin salting roads next week. Stay safe and warm!',
        category: 'general',
        priority: 'normal',
        authorId: this.users[5]._id, // Robert
        likes: [this.users[0]._id, this.users[1]._id, this.users[6]._id]
      }
    ];

    for (const noticeData of noticesData) {
      const notice = new Notice({
        ...noticeData,
        neighbourhoodId: this.neighbourhood._id,
        isActive: true,
        viewCount: Math.floor(Math.random() * 50) + 10,
        status: 'active'
      });
      
      await notice.save();
      this.notices.push(notice);
      console.log(`✅ Created notice: ${noticeData.title}`);
    }
  }

  async createReports() {
    console.log('🚨 Creating reports...');
    
    const reportsData = [
      {
        title: 'Broken Street Light',
        description: 'The street light on the corner of Oak Street and Main Road has been out for over a week. It\'s creating a safety hazard for pedestrians and drivers, especially during evening hours.',
        category: 'maintenance',
        priority: 'high',
        location: {
          address: 'Oak Street & Main Road, Springfield, IL',
          coordinates: [-89.6505, 39.7820]
        },
        reporterId: this.users[5]._id, // Robert
        status: 'in-progress',
        assignedTo: this.users[1]._id, // Moderator
        incidentDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        likes: [this.users[3]._id, this.users[4]._id],
        comments: [
          {
            userId: this.users[1]._id,
            content: 'I\'ve contacted the city utilities department. They should fix this within 48 hours.',
            createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
          }
        ]
      },
      {
        title: 'Suspicious Vehicle Parked',
        description: 'Unknown sedan (dark blue) has been parked on Pine Street for several days. Occupants seen acting suspiciously, checking car doors and looking into windows.',
        category: 'security',
        priority: 'high',
        location: {
          address: 'Pine Street, near House #67, Springfield, IL',
          coordinates: [-89.6498, 39.7815]
        },
        reporterId: this.users[7]._id, // David
        status: 'open',
        incidentDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        likes: [this.users[0]._id, this.users[1]._id, this.users[6]._id],
        comments: [
          {
            userId: this.users[0]._id,
            content: 'I\'ve notified local police. Please continue to monitor and report any further suspicious activity.',
            createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
          },
          {
            userId: this.users[6]._id,
            content: 'I saw the same vehicle yesterday evening. Will keep watching.',
            createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000)
          }
        ]
      },
      {
        title: 'Large Pothole on Main Road',
        description: 'Dangerous pothole near the school entrance on Main Road. Several residents have reported vehicle damage. Needs immediate repair to prevent accidents.',
        category: 'traffic',
        priority: 'urgent',
        location: {
          address: 'Main Road, near Springfield Elementary, Springfield, IL',
          coordinates: [-89.6510, 39.7825]
        },
        reporterId: this.users[6]._id, // Emily
        status: 'resolved',
        assignedTo: this.users[0]._id, // Admin
        incidentDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        likes: [this.users[3]._id, this.users[4]._id, this.users[7]._id, this.users[8]._id],
        viewCount: 45
      },
      {
        title: 'Noise Complaint - Loud Parties',
        description: 'Loud music and parties every weekend from house on Elm Street. Music continues past midnight and disturbs the neighbourhood. Multiple residents affected.',
        category: 'noise',
        priority: 'medium',
        location: {
          address: 'Elm Street, House #45, Springfield, IL',
          coordinates: [-89.6502, 39.7812]
        },
        reporterId: this.users[10]._id, // Susan
        status: 'open',
        isAnonymous: true,
        incidentDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        likes: [this.users[4]._id, this.users[6]._id],
        comments: [
          {
            userId: this.users[4]._id,
            content: 'We\'ve experienced the same issue. It\'s been going on for weeks.',
            createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
          }
        ]
      },
      {
        title: 'Stray Dog in Neighbourhood',
        description: 'Large friendly dog wandering the neighbourhood without owner. Appears well-fed but has no collar. May be lost rather than stray. Dog seems approachable.',
        category: 'pets',
        priority: 'medium',
        location: {
          address: 'Oak Street area, Springfield, IL',
          coordinates: [-89.6501, 39.7817]
        },
        reporterId: this.users[4]._id, // Jane
        status: 'resolved',
        incidentDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        likes: [this.users[3]._id, this.users[8]._id],
        comments: [
          {
            userId: this.users[8]._id,
            content: 'Update: Found the owner! Dog is safely home now.',
            createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
          }
        ]
      },
      {
        title: 'Broken Street Sign',
        description: 'Stop sign at Oak Street & Maple intersection is damaged and barely visible. This creates a serious traffic hazard.',
        category: 'traffic',
        priority: 'high',
        location: {
          address: 'Oak Street & Maple Avenue, Springfield, IL',
          coordinates: [-89.6495, 39.7822]
        },
        reporterId: this.users[11]._id, // Thomas
        status: 'in-progress',
        assignedTo: this.users[1]._id, // Moderator
        incidentDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        likes: [this.users[0]._id, this.users[5]._id, this.users[7]._id]
      }
    ];

    for (const reportData of reportsData) {
      const report = new Report({
        ...reportData,
        neighbourhoodId: this.neighbourhood._id,
        reportStatus: 'active',
        viewCount: reportData.viewCount || Math.floor(Math.random() * 30) + 5
      });
      
      await report.save();
      this.reports.push(report);
      console.log(`✅ Created report: ${reportData.title} (${reportData.status})`);
    }
  }

  async createMessages() {
    console.log('💬 Creating messages...');
    
    // Create messages for chat groups
    const groupMessages = [
      // General Discussion messages
      {
        chatId: this.chatGroups[0]._id,
        chatType: 'group',
        senderId: this.users[0]._id,
        content: 'Welcome everyone to our neighbourhood chat! This is a great way to stay connected and look out for each other.',
        messageType: 'text',
        status: 'read'
      },
      {
        chatId: this.chatGroups[0]._id,
        chatType: 'group',
        senderId: this.users[3]._id,
        content: 'Thanks for setting this up! Really appreciate having a direct line of communication with everyone.',
        messageType: 'text',
        status: 'read'
      },
      {
        chatId: this.chatGroups[0]._id,
        chatType: 'group',
        senderId: this.users[4]._id,
        content: 'Has anyone seen an orange cat around? Fluffy went missing yesterday evening.',
        messageType: 'text',
        status: 'read'
      },
      {
        chatId: this.chatGroups[0]._id,
        chatType: 'group',
        senderId: this.users[5]._id,
        content: 'I haven\'t seen Fluffy, but I\'ll keep an eye out. Will check my security cameras too.',
        messageType: 'text',
        status: 'read'
      },
      {
        chatId: this.chatGroups[0]._id,
        chatType: 'group',
        senderId: this.users[8]._id,
        content: 'Don\'t forget about the community BBQ this Saturday! Looking forward to seeing everyone there.',
        messageType: 'text',
        status: 'delivered'
      },
      
      // Safety Alerts messages
      {
        chatId: this.chatGroups[1]._id,
        chatType: 'group',
        senderId: this.users[1]._id,
        content: 'SAFETY ALERT: Suspicious vehicle reported on Pine Street. Please be vigilant and report any unusual activity to authorities.',
        messageType: 'text',
        status: 'read'
      },
      {
        chatId: this.chatGroups[1]._id,
        chatType: 'group',
        senderId: this.users[0]._id,
        content: 'Police have been notified. Please avoid the area if possible and keep doors/windows locked.',
        messageType: 'text',
        status: 'read'
      },
      
      // Community Events messages
      {
        chatId: this.chatGroups[2]._id,
        chatType: 'group',
        senderId: this.users[8]._id,
        content: 'Planning committee meeting for the BBQ - who can help with setup on Saturday morning?',
        messageType: 'text',
        status: 'read'
      },
      {
        chatId: this.chatGroups[2]._id,
        chatType: 'group',
        senderId: this.users[3]._id,
        content: 'I can help with setup! What time should we start?',
        messageType: 'text',
        status: 'read'
      },
      {
        chatId: this.chatGroups[2]._id,
        chatType: 'group',
        senderId: this.users[6]._id,
        content: 'I can bring some games for the kids. My children are so excited!',
        messageType: 'text',
        status: 'delivered'
      }
    ];

    for (const messageData of groupMessages) {
      const message = new Message({
        ...messageData,
        moderationStatus: 'active',
        readBy: messageData.status === 'read' ? [
          { userId: this.users[0]._id, readAt: new Date() },
          { userId: this.users[1]._id, readAt: new Date() }
        ] : []
      });
      
      await message.save();
    }

    // Create messages for private chats
    const privateMessages = [
      // Admin and John private chat
      {
        chatId: this.privateChats[0]._id,
        chatType: 'private',
        senderId: this.users[0]._id,
        content: 'Hi John! Thanks for volunteering to help with the neighbourhood watch.',
        messageType: 'text',
        status: 'read'
      },
      {
        chatId: this.privateChats[0]._id,
        chatType: 'private',
        senderId: this.users[3]._id,
        content: 'Happy to help! When is the next patrol scheduled?',
        messageType: 'text',
        status: 'read'
      },
      
      // Jane and Robert private chat
      {
        chatId: this.privateChats[3]._id,
        chatType: 'private',
        senderId: this.users[4]._id,
        content: 'Robert, could you take a look at my fence gate? It\'s been sticking lately.',
        messageType: 'text',
        status: 'delivered'
      },
      {
        chatId: this.privateChats[3]._id,
        chatType: 'private',
        senderId: this.users[5]._id,
        content: 'Of course! I\'ll stop by this weekend with my tools.',
        messageType: 'text',
        status: 'sent'
      }
    ];

    for (const messageData of privateMessages) {
      const message = new Message({
        ...messageData,
        moderationStatus: 'active'
      });
      
      await message.save();
      
      // Update private chat last message
      const privateChat = await PrivateChat.findById(messageData.chatId);
      privateChat.lastMessage = {
        content: messageData.content,
        sender: messageData.senderId,
        timestamp: new Date(),
        messageType: messageData.messageType
      };
      await privateChat.save();
    }

    console.log(`✅ Created ${groupMessages.length + privateMessages.length} messages`);
  }

  async createNotifications() {
    console.log('🔔 Creating notifications...');
    
    const notificationsData = [
      // Friend request notifications
      {
        recipient: this.users[11]._id, // Thomas
        type: 'friendRequest',
        title: 'New Friend Request',
        content: 'Susan White sent you a friend request',
        sender: this.users[10]._id, // Susan
        reference: {
          type: 'friendRequest',
          id: new mongoose.Types.ObjectId()
        },
        read: false
      },
      {
        recipient: this.users[9]._id, // James
        type: 'friendRequest',
        title: 'New Friend Request',
        content: 'Lisa Chen sent you a friend request',
        sender: this.users[2]._id, // Lisa
        reference: {
          type: 'friendRequest',
          id: new mongoose.Types.ObjectId()
        },
        read: false
      },
      
      // Message notifications
      {
        recipient: this.users[3]._id, // John
        type: 'privateMessage',
        title: 'New Private Message',
        content: 'Sarah Administrator sent you a message',
        sender: this.users[0]._id, // Admin
        reference: {
          type: 'chat',
          id: this.privateChats[0]._id
        },
        read: true
      },
      {
        recipient: this.users[5]._id, // Robert
        type: 'privateMessage',
        title: 'New Private Message',
        content: 'Jane Smith sent you a message',
        sender: this.users[4]._id, // Jane
        reference: {
          type: 'chat',
          id: this.privateChats[3]._id
        },
        read: false
      },
      
      // Like notifications
      {
        recipient: this.users[4]._id, // Jane
        type: 'like',
        title: 'Someone liked your post',
        content: 'John Doe liked your notice "Lost Cat - Fluffy"',
        sender: this.users[3]._id, // John
        reference: {
          type: 'notice',
          id: this.notices[2]._id
        },
        read: true
      },
      {
        recipient: this.users[6]._id, // Emily
        type: 'like',
        title: 'Someone liked your report',
        content: 'David Brown liked your report "Large Pothole on Main Road"',
        sender: this.users[7]._id, // David
        reference: {
          type: 'report',
          id: this.reports[2]._id
        },
        read: false
      },
      
      // Comment notifications
      {
        recipient: this.users[4]._id, // Jane
        type: 'comment',
        title: 'New comment on your post',
        content: 'Robert Wilson commented on your notice "Lost Cat - Fluffy"',
        sender: this.users[5]._id, // Robert
        reference: {
          type: 'notice',
          id: this.notices[2]._id
        },
        read: false
      },
      
      // System notifications
      {
        recipient: this.users[7]._id, // David
        type: 'system',
        title: 'Report Status Update',
        content: 'Your report "Suspicious Vehicle Parked" has been reviewed by administrators',
        reference: {
          type: 'report',
          id: this.reports[1]._id
        },
        read: false
      },
      {
        recipient: this.users[6]._id, // Emily
        type: 'system',
        title: 'Report Resolved',
        content: 'Your report "Large Pothole on Main Road" has been marked as resolved',
        reference: {
          type: 'report',
          id: this.reports[2]._id
        },
        read: true
      }
    ];

    for (const notificationData of notificationsData) {
      const notification = new Notification(notificationData);
      await notification.save();
    }

    console.log(`✅ Created ${notificationsData.length} notifications`);
  }

  async createLegalDocuments() {
    console.log('📄 Creating legal documents...');
    
    const adminUser = this.users[0]; // Admin user
    
    const legalDocs = [
      {
        type: 'termsOfService',
        version: '1.0',
        title: 'Terms of Service',
        content: 'These Terms of Service govern your use of the Neighbourhood Watch application. By using this service, you agree to comply with all community guidelines and local laws. Users must provide accurate information and respect the privacy and safety of all community members.',
        summary: 'Community guidelines and user responsibilities for the Neighbourhood Watch app.',
        active: true,
        createdBy: adminUser._id,
        metadata: {
          language: 'en',
          jurisdiction: 'ZA',
          complianceStandards: ['POPIA'],
          changeReason: 'Initial version'
        }
      },
      {
        type: 'privacyPolicy',
        version: '1.0',
        title: 'Privacy Policy',
        content: 'This Privacy Policy describes how we collect, use, and protect your personal information in compliance with the Protection of Personal Information Act (POPIA). We collect only necessary information to provide neighbourhood safety services and never share personal data without consent.',
        summary: 'How we handle your personal information in compliance with POPIA.',
        active: true,
        createdBy: adminUser._id,
        metadata: {
          language: 'en',
          jurisdiction: 'ZA',
          complianceStandards: ['POPIA', 'GDPR'],
          changeReason: 'Initial version with POPIA compliance'
        }
      },
      {
        type: 'noticeBoardTerms',
        version: '1.0',
        title: 'Notice Board Terms',
        content: 'Notice Board Terms: All posts must be relevant to the neighbourhood community. Prohibited content includes: commercial advertising, solicitation, inappropriate material, false information, or content that violates community standards. Posts should be respectful and constructive.',
        summary: 'Guidelines for posting on the community notice board.',
        active: true,
        createdBy: adminUser._id,
        metadata: {
          language: 'en',
          jurisdiction: 'ZA',
          complianceStandards: ['POPIA'],
          changeReason: 'Initial community guidelines'
        }
      },
      {
        type: 'reportTerms',
        version: '1.0',
        title: 'Report Terms',
        content: 'Report Terms: All reports must be factual and based on actual observations. False reporting is prohibited and may result in account suspension. Reports should include accurate details, location information, and relevant evidence. Anonymous reporting is available for sensitive matters.',
        summary: 'Guidelines for submitting accurate and factual reports.',
        active: true,
        createdBy: adminUser._id,
        metadata: {
          language: 'en',
          jurisdiction: 'ZA',
          complianceStandards: ['POPIA'],
          changeReason: 'Initial reporting guidelines'
        }
      }
    ];

    for (const docData of legalDocs) {
      const doc = new LegalDocument(docData);
      await doc.save();
      console.log(`✅ Created legal document: ${docData.title}`);
    }

    console.log('✅ All legal documents created');
  }

  async displaySummary() {
    console.log('\n📊 Database Summary:');
    
    const counts = {
      users: await User.countDocuments(),
      neighbourhoods: await Neighbourhood.countDocuments(),
      chatGroups: await ChatGroup.countDocuments(),
      privateChats: await PrivateChat.countDocuments(),
      messages: await Message.countDocuments(),
      notices: await Notice.countDocuments(),
      reports: await Report.countDocuments(),
      friendRequests: await FriendRequest.countDocuments(),
      notifications: await Notification.countDocuments(),
      legalDocuments: await LegalDocument.countDocuments()
    };

    Object.entries(counts).forEach(([key, count]) => {
      console.log(`- ${key}: ${count}`);
    });

    console.log('\n👥 Test Accounts:');
    console.log('- Admin: admin@neighbourhood.com / admin123');
    console.log('- Moderator: moderator@neighbourhood.com / mod123');
    console.log('- Moderator 2: mod2@neighbourhood.com / mod123');
    console.log('- Users: john.doe@neighbourhood.com / user123');
    console.log('- Users: jane.smith@neighbourhood.com / user123');
    console.log('- Users: robert.wilson@neighbourhood.com / user123');
    console.log('- Users: emily.davis@neighbourhood.com / user123');
    console.log('- Users: david.brown@neighbourhood.com / user123');
    console.log('- Users: maria.garcia@neighbourhood.com / user123');
    console.log('- Users: james.taylor@neighbourhood.com / user123');
    console.log('- Users: susan.white@neighbourhood.com / user123');
    console.log('- Users: thomas.anderson@neighbourhood.com / user123');
  }
}

// Run the comprehensive seeding
if (require.main === module) {
  const seeder = new ComprehensiveSeed();
  seeder.run();
}

module.exports = ComprehensiveSeed;