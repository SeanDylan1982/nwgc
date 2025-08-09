// Test script to check user role and permissions
const jwt = require('jsonwebtoken');

// Function to decode JWT token and check user role
function checkUserRole() {
  console.log('=== USER ROLE CHECKER ===');
  
  // Instructions for manual testing
  console.log('\nTo test user role:');
  console.log('1. Open browser developer tools');
  console.log('2. Go to Application/Storage > Local Storage');
  console.log('3. Find the "token" key and copy its value');
  console.log('4. Replace TOKEN_HERE below with the actual token');
  console.log('5. Run: node test-user-role.js');
  
  // Example token check (replace with actual token)
  const exampleToken = 'TOKEN_HERE';
  
  if (exampleToken === 'TOKEN_HERE') {
    console.log('\n❌ Please replace TOKEN_HERE with your actual JWT token');
    return;
  }
  
  try {
    // Decode without verification (for testing only)
    const decoded = jwt.decode(exampleToken);
    console.log('\n📋 Decoded token payload:');
    console.log(JSON.stringify(decoded, null, 2));
    
    // Check if we can get user info
    if (decoded && decoded.userId) {
      console.log('\n✅ Token contains user ID:', decoded.userId);
    } else {
      console.log('\n❌ Token missing user ID');
    }
    
  } catch (error) {
    console.error('\n❌ Error decoding token:', error.message);
  }
}

// Alternative: Check what's in localStorage via browser console
console.log('\n=== BROWSER CONSOLE COMMANDS ===');
console.log('Run these commands in your browser console:');
console.log('');
console.log('// Check if token exists');
console.log('console.log("Token:", localStorage.getItem("token"));');
console.log('');
console.log('// Decode token payload');
console.log('const token = localStorage.getItem("token");');
console.log('if (token) {');
console.log('  const payload = JSON.parse(atob(token.split(".")[1]));');
console.log('  console.log("User payload:", payload);');
console.log('} else {');
console.log('  console.log("No token found - user not logged in");');
console.log('}');
console.log('');
console.log('// Check current user API call');
console.log('fetch("/api/auth/me", {');
console.log('  headers: {');
console.log('    "Authorization": `Bearer ${localStorage.getItem("token")}`');
console.log('  }');
console.log('}).then(r => r.json()).then(console.log);');

checkUserRole();