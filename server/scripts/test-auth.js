const axios = require('axios');

const API_BASE = 'http://localhost:5001';

const testAuth = async () => {
  try {
    console.log('🧪 Testing Authentication...\n');

    // Test 1: Login with existing user
    console.log('1. Testing login with existing user...');
    try {
      const loginResponse = await axios.post(`${API_BASE}/api/auth/login`, {
        email: 'admin@neighbourhood.com',
        password: 'admin123'
      });
      
      console.log('✅ Login successful!');
      console.log('Token received:', loginResponse.data.token ? 'Yes' : 'No');
      console.log('User data:', loginResponse.data.user);
      
      // Test 2: Use token to access protected route
      console.log('\n2. Testing protected route with token...');
      const token = loginResponse.data.token;
      
      const profileResponse = await axios.get(`${API_BASE}/api/users/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('✅ Protected route access successful!');
      console.log('Profile data:', profileResponse.data);
      
    } catch (error) {
      console.log('❌ Login failed:');
      console.log('Status:', error.response?.status);
      console.log('Data:', error.response?.data);
      console.log('Message:', error.message);
    }

    // Test 3: Register new user
    console.log('\n3. Testing user registration...');
    try {
      const registerResponse = await axios.post(`${API_BASE}/api/auth/register`, {
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        password: 'test123',
        phone: '15550123',
        address: '123 Test Street'
      });
      
      console.log('✅ Registration successful!');
      console.log('Token received:', registerResponse.data.token ? 'Yes' : 'No');
      console.log('User data:', registerResponse.data.user);
      
    } catch (error) {
      console.log('❌ Registration failed:');
      console.log('Status:', error.response?.status);
      console.log('Data:', error.response?.data);
      console.log('Message:', error.message);
    }

    // Test 4: Invalid login
    console.log('\n4. Testing invalid login...');
    try {
      await axios.post(`${API_BASE}/api/auth/login`, {
        email: 'invalid@example.com',
        password: 'wrongpassword'
      });
      console.log('❌ This should have failed!');
    } catch (error) {
      console.log('✅ Invalid login correctly rejected:', error.response?.data?.message);
    }

    console.log('\n🎉 Authentication tests completed!');
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
};

// Run the test
testAuth();