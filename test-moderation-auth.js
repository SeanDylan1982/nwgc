// Test script to check moderation endpoint authentication
const fetch = require('node-fetch');

async function testModerationAuth() {
  console.log('=== MODERATION AUTH TESTER ===');
  
  // Test without token
  console.log('\n1. Testing without authentication token...');
  try {
    const response = await fetch('http://localhost:5001/api/moderation/content');
    const result = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', result);
  } catch (error) {
    console.log('Error:', error.message);
  }
  
  // Instructions for testing with token
  console.log('\n2. To test with authentication:');
  console.log('   a) Get your JWT token from browser localStorage');
  console.log('   b) Replace TOKEN_HERE in the code below');
  console.log('   c) Uncomment and run the authenticated test');
  
  /*
  // Uncomment this section and replace TOKEN_HERE with actual token
  console.log('\n2. Testing with authentication token...');
  const token = 'TOKEN_HERE';
  
  try {
    const response = await fetch('http://localhost:5001/api/moderation/content', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    const result = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', result);
  } catch (error) {
    console.log('Error:', error.message);
  }
  */
}

// Alternative: Browser-based test
console.log('\n=== BROWSER CONSOLE TEST ===');
console.log('Copy and paste this into your browser console while on the app:');
console.log('');
console.log(`
// First, check current user info
console.log('=== CHECKING CURRENT USER ===');
fetch('/api/auth/me', {
  headers: {
    'Authorization': 'Bearer ' + localStorage.getItem('token'),
    'Content-Type': 'application/json'
  }
})
.then(response => {
  console.log('User info status:', response.status);
  return response.json();
})
.then(data => {
  console.log('Current user:', data);
  console.log('User role:', data.role);
  console.log('Is admin/moderator?', ['admin', 'moderator'].includes(data.role));
})
.catch(error => {
  console.error('User info error:', error);
});

// Then test moderation endpoint
console.log('=== TESTING MODERATION ENDPOINT ===');
fetch('/api/moderation/content', {
  headers: {
    'Authorization': 'Bearer ' + localStorage.getItem('token'),
    'Content-Type': 'application/json'
  }
})
.then(response => {
  console.log('Moderation status:', response.status);
  return response.json();
})
.then(data => {
  console.log('Moderation response:', data);
})
.catch(error => {
  console.error('Moderation error:', error);
});
`);

testModerationAuth();