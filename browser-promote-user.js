// Browser-based user promotion script
// Copy and paste this into your browser console while logged into the app

console.log('=== BROWSER USER PROMOTION ===');

// First, get current user info to get the user ID
fetch('/api/auth/me', {
  headers: {
    'Authorization': 'Bearer ' + localStorage.getItem('token'),
    'Content-Type': 'application/json'
  }
})
.then(response => response.json())
.then(user => {
  console.log('Current user:', user);
  
  if (user.role === 'admin' || user.role === 'moderator') {
    console.log('✅ User already has admin/moderator privileges!');
    return;
  }
  
  console.log('🔄 User needs to be promoted to admin...');
  console.log('📋 MANUAL STEPS REQUIRED:');
  console.log('');
  console.log('1. Copy this user ID:', user.id);
  console.log('2. Open promote-user-to-admin.js');
  console.log('3. Replace USER_ID_HERE with:', user.id);
  console.log('4. Uncomment the promotion code');
  console.log('5. Run: node promote-user-to-admin.js');
  console.log('');
  console.log('OR ask a developer to run this MongoDB command:');
  console.log(`db.users.updateOne({_id: ObjectId("${user.id}")}, {$set: {role: "admin"}})`);
})
.catch(error => {
  console.error('Error getting user info:', error);
});