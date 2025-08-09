const axios = require('axios');

// Load environment variables
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });

async function testFullChatFlow() {
  try {
    console.log('🧪 Testing full chat flow...');
    
    const baseURL = 'http://localhost:5001';
    
    // Step 1: Login
    console.log('\n1️⃣ Logging in as admin user...');
    const loginResponse = await axios.post(`${baseURL}/api/auth/login`, {
      email: 'admin@neighbourhood.com',
      password: 'admin123'
    });
    
    const token = loginResponse.data.token;
    const user = loginResponse.data.user;
    console.log('✅ Login successful');
    console.log('User:', user.firstName, user.lastName, '(ID:', user._id, ')');
    
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    
    // Step 2: Get chat groups
    console.log('\n2️⃣ Fetching chat groups...');
    const groupsResponse = await axios.get(`${baseURL}/api/chat/groups`, { headers });
    const groups = groupsResponse.data;
    
    console.log(`✅ Found ${groups.length} chat groups:`);
    groups.forEach((group, index) => {
      console.log(`${index + 1}. ${group.name} (ID: ${group.id})`);
      console.log(`   - Members: ${group.memberCount}`);
      console.log(`   - Last message: ${group.lastMessage?.content || 'None'}`);
    });
    
    if (groups.length === 0) {
      console.log('❌ No chat groups found! This might be the issue.');
      return;
    }
    
    // Step 3: Get messages for each group
    console.log('\n3️⃣ Testing messages for each group...');
    for (const group of groups) {
      console.log(`\n📨 Fetching messages for: ${group.name}`);
      
      try {
        const messagesResponse = await axios.get(`${baseURL}/api/chat/groups/${group.id}/messages`, { headers });
        const messages = messagesResponse.data;
        
        console.log(`✅ Found ${messages.length} messages:`);
        messages.forEach((msg, index) => {
          console.log(`   ${index + 1}. ${msg.senderName}: "${msg.content}"`);
          console.log(`      - ID: ${msg.id}`);
          console.log(`      - Time: ${msg.createdAt}`);
          console.log(`      - Sender ID: ${msg.senderId}`);
          console.log(`      - Is own message: ${msg.senderId === user._id}`);
        });
        
        if (messages.length === 0) {
          console.log('   ⚠️ No messages in this group');
        }
      } catch (error) {
        console.error(`❌ Error fetching messages for ${group.name}:`, error.response?.data || error.message);
      }
    }
    
    // Step 4: Test sending a message
    console.log('\n4️⃣ Testing message sending...');
    const testGroup = groups[0];
    const testMessage = `Test message from API at ${new Date().toISOString()}`;
    
    try {
      const sendResponse = await axios.post(`${baseURL}/api/chat/groups/${testGroup.id}/messages`, {
        content: testMessage
      }, { headers });
      
      console.log('✅ Message sent successfully:', sendResponse.data);
      
      // Verify the message was saved
      const verifyResponse = await axios.get(`${baseURL}/api/chat/groups/${testGroup.id}/messages`, { headers });
      const updatedMessages = verifyResponse.data;
      const lastMessage = updatedMessages[updatedMessages.length - 1];
      
      if (lastMessage.content === testMessage) {
        console.log('✅ Message verified in database');
      } else {
        console.log('❌ Message not found in database');
      }
      
    } catch (error) {
      console.error('❌ Error sending message:', error.response?.data || error.message);
    }
    
    console.log('\n🎉 Chat flow test completed!');
    
  } catch (error) {
    console.error('❌ Error in chat flow test:', error.response?.data || error.message);
  }
}

testFullChatFlow();