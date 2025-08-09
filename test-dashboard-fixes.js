// Test script for dashboard and admin fixes
// Copy and paste this into your browser console while logged into the app

console.log('=== TESTING DASHBOARD AND ADMIN FIXES ===');

// Test 1: Check current user count in database
async function testUserCount() {
  console.log('\n1. Testing user count API...');
  
  try {
    const response = await fetch('/api/admin/users', {
      headers: {
        'Authorization': 'Bearer ' + localStorage.getItem('token'),
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    console.log('Admin users API response:', data);
    
    if (data.users) {
      console.log('✅ Total users in admin API:', data.users.length);
    } else if (Array.isArray(data)) {
      console.log('✅ Total users in admin API:', data.length);
    } else {
      console.log('❌ Unexpected response format');
    }
  } catch (error) {
    console.error('❌ Error fetching admin users:', error);
  }
}

// Test 2: Check dashboard statistics
async function testDashboardStats() {
  console.log('\n2. Testing dashboard statistics...');
  
  try {
    const timestamp = Date.now();
    const response = await fetch(`/api/statistics/dashboard?_t=${timestamp}`, {
      headers: {
        'Authorization': 'Bearer ' + localStorage.getItem('token'),
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    console.log('Dashboard stats response:', data);
    
    if (data.success && data.data) {
      console.log('✅ Dashboard stats:');
      console.log('  - Neighbours:', data.data.neighbours);
      console.log('  - Active Chats:', data.data.activeChats);
      console.log('  - New Notices:', data.data.newNotices);
      console.log('  - Open Reports:', data.data.openReports);
    } else {
      console.log('❌ Unexpected dashboard response format');
    }
  } catch (error) {
    console.error('❌ Error fetching dashboard stats:', error);
  }
}

// Test 3: Test admin role update (if you have a test user)
async function testRoleUpdate() {
  console.log('\n3. Testing role update functionality...');
  console.log('ℹ️  This test requires a user ID to update');
  console.log('   You can get user IDs from the admin dashboard user list');
  console.log('   Then call: testRoleUpdateForUser("USER_ID_HERE")');
}

async function testRoleUpdateForUser(userId) {
  if (!userId || userId === 'USER_ID_HERE') {
    console.log('❌ Please provide a valid user ID');
    return;
  }
  
  console.log(`\n3. Testing role update for user: ${userId}`);
  
  try {
    // First get current user info
    const getUserResponse = await fetch(`/api/admin/users`, {
      headers: {
        'Authorization': 'Bearer ' + localStorage.getItem('token'),
        'Content-Type': 'application/json'
      }
    });
    
    const usersData = await getUserResponse.json();
    const users = usersData.users || usersData;
    const targetUser = users.find(u => u._id === userId);
    
    if (!targetUser) {
      console.log('❌ User not found');
      return;
    }
    
    console.log('Current user:', targetUser.firstName, targetUser.lastName, 'Role:', targetUser.role);
    
    // Test role update (change to moderator if user, or to user if moderator)
    const newRole = targetUser.role === 'user' ? 'moderator' : 'user';
    
    console.log(`Attempting to change role from ${targetUser.role} to ${newRole}...`);
    
    const updateResponse = await fetch(`/api/admin/users/${userId}/role`, {
      method: 'PATCH',
      headers: {
        'Authorization': 'Bearer ' + localStorage.getItem('token'),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        role: newRole,
        reason: 'Test role update from browser console'
      })
    });
    
    if (updateResponse.ok) {
      console.log('✅ Role update successful!');
      const result = await updateResponse.json();
      console.log('Update response:', result);
    } else {
      console.log('❌ Role update failed');
      const error = await updateResponse.json();
      console.log('Error response:', error);
    }
  } catch (error) {
    console.error('❌ Error testing role update:', error);
  }
}

// Run all tests
async function runAllTests() {
  await testUserCount();
  await testDashboardStats();
  await testRoleUpdate();
  
  console.log('\n=== TESTS COMPLETE ===');
  console.log('📋 Next steps:');
  console.log('1. Check if the neighbours count matches the admin user count');
  console.log('2. Try the refresh button on the dashboard');
  console.log('3. Test role updates in the admin dashboard');
  console.log('4. If you want to test role updates, call: testRoleUpdateForUser("USER_ID")');
}

// Make functions available globally
window.testUserCount = testUserCount;
window.testDashboardStats = testDashboardStats;
window.testRoleUpdate = testRoleUpdate;
window.testRoleUpdateForUser = testRoleUpdateForUser;
window.runAllTests = runAllTests;

// Auto-run tests
runAllTests();