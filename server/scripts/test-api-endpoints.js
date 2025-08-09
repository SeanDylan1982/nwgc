/**
 * Test script to verify all key API endpoints are working
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:5001';

async function testAPIEndpoints() {
  try {
    console.log('🧪 Testing API endpoints...');
    
    // First, login to get a token
    console.log('🔐 Logging in...');
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: 'admin@neighbourhood.com',
      password: 'admin123'
    });
    
    if (!loginResponse.data.token) {
      console.log('❌ Login failed');
      return;
    }
    
    const token = loginResponse.data.token;
    console.log('✅ Login successful');
    
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    
    // Test endpoints
    const endpoints = [
      {
        name: 'User Profile',
        url: '/api/users/me',
        method: 'GET'
      },
      {
        name: 'Statistics - Dashboard',
        url: '/api/statistics/dashboard',
        method: 'GET'
      },
      {
        name: 'Statistics - Profile',
        url: '/api/statistics/profile',
        method: 'GET'
      },
      {
        name: 'Notices',
        url: '/api/notices',
        method: 'GET'
      },
      {
        name: 'Reports',
        url: '/api/reports',
        method: 'GET'
      },
      {
        name: 'Neighbours',
        url: '/api/users/neighbours',
        method: 'GET'
      },
      {
        name: 'Chat Groups',
        url: '/api/chat/groups',
        method: 'GET'
      },
      {
        name: 'Private Chats',
        url: '/api/private-chat',
        method: 'GET'
      },
      {
        name: 'Notifications',
        url: '/api/notifications',
        method: 'GET'
      },
      {
        name: 'Settings',
        url: '/api/settings',
        method: 'GET'
      }
    ];
    
    console.log('\n📡 Testing API endpoints...');
    
    for (const endpoint of endpoints) {
      try {
        console.log(`\n🔍 Testing ${endpoint.name}: ${endpoint.method} ${endpoint.url}`);
        
        const response = await axios({
          method: endpoint.method,
          url: `${BASE_URL}${endpoint.url}`,
          headers
        });
        
        console.log(`✅ ${endpoint.name}: Status ${response.status}`);
        
        if (response.data) {
          if (Array.isArray(response.data)) {
            console.log(`   📊 Returned ${response.data.length} items`);
            if (response.data.length > 0) {
              console.log(`   📝 Sample item keys:`, Object.keys(response.data[0]));
            }
          } else if (typeof response.data === 'object') {
            console.log(`   📝 Response keys:`, Object.keys(response.data));
            
            // Show some sample data for key endpoints
            if (endpoint.name === 'Statistics - Dashboard') {
              console.log(`   📊 Dashboard stats:`, JSON.stringify(response.data, null, 2));
            } else if (endpoint.name === 'User Profile') {
              console.log(`   👤 User: ${response.data.firstName} ${response.data.lastName} (${response.data.role})`);
            }
          }
        }
        
      } catch (error) {
        console.log(`❌ ${endpoint.name}: ${error.response?.status || 'Network Error'}`);
        if (error.response?.data) {
          console.log(`   Error: ${JSON.stringify(error.response.data)}`);
        }
      }
    }
    
    console.log('\n✅ API endpoint testing completed');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testAPIEndpoints();