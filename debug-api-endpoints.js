// Debug API endpoints - Check what's actually being returned
// Copy and paste this into your browser console

console.log('=== API ENDPOINT DIAGNOSTICS ===');

async function checkEndpoint(url, description) {
  console.log(`\n🔍 Testing: ${description}`);
  console.log(`   URL: ${url}`);
  
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': 'Bearer ' + localStorage.getItem('token'),
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Content-Type: ${response.headers.get('content-type')}`);
    
    const text = await response.text();
    console.log(`   Response length: ${text.length} characters`);
    
    if (text.startsWith('<!DOCTYPE') || text.startsWith('<html')) {
      console.log('   ❌ Response is HTML (likely 404 or error page)');
      console.log('   First 200 chars:', text.substring(0, 200));
    } else {
      try {
        const json = JSON.parse(text);
        console.log('   ✅ Valid JSON response');
        console.log('   Data:', json);
      } catch (e) {
        console.log('   ❌ Invalid JSON response');
        console.log('   Raw text:', text.substring(0, 500));
      }
    }
  } catch (error) {
    console.log(`   ❌ Network error: ${error.message}`);
  }
}

async function runDiagnostics() {
  // Test basic endpoints first
  await checkEndpoint('/api/auth/me', 'Current User Info');
  
  // Test statistics endpoints
  await checkEndpoint('/api/statistics/dashboard', 'Dashboard Statistics');
  
  // Test admin endpoints
  await checkEndpoint('/api/admin/stats', 'Admin Stats');
  await checkEndpoint('/api/admin/users', 'Admin Users List');
  
  console.log('\n=== DIAGNOSTICS COMPLETE ===');
  console.log('📋 Analysis:');
  console.log('- If endpoints return HTML, they might not exist or have routing issues');
  console.log('- If endpoints return 401/403, there are permission issues');
  console.log('- If endpoints return valid JSON, the issue is in the frontend code');
}

// Auto-run diagnostics
runDiagnostics();