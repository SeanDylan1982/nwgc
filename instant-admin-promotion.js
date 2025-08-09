// Instant Admin Promotion - Browser Console Script
// Copy and paste this into your browser console while logged into the app

console.log('=== INSTANT ADMIN PROMOTION ===');
console.log('🚀 Promoting current user to admin...');

fetch('/api/auth/dev-promote-admin', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + localStorage.getItem('token'),
    'Content-Type': 'application/json'
  }
})
.then(response => {
  console.log('Promotion status:', response.status);
  return response.json();
})
.then(data => {
  console.log('Promotion response:', data);
  
  if (data.message && data.message.includes('successfully')) {
    console.log('🎉 SUCCESS! You are now an admin!');
    console.log('📋 Next steps:');
    console.log('1. Refresh the page');
    console.log('2. Go to Content Moderation page');
    console.log('3. You should now see moderated content');
    
    // Automatically refresh the page
    setTimeout(() => {
      console.log('🔄 Refreshing page...');
      window.location.reload();
    }, 2000);
  } else if (data.message && data.message.includes('already')) {
    console.log('✅ You are already an admin!');
    console.log('Try refreshing the Content Moderation page');
  } else {
    console.log('❌ Promotion failed:', data.message);
  }
})
.catch(error => {
  console.error('❌ Error promoting user:', error);
});