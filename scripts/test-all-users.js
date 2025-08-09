const https = require('https');
const http = require('http');

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    const req = client.request(url, {
      method: options.method || 'GET',
      headers: options.headers || {}
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode, data: jsonData });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

async function testAllUsers() {
  const users = [
    { email: 'admin@neighbourhood.com', password: 'admin123', role: 'admin' },
    { email: 'moderator@neighbourhood.com', password: 'mod123', role: 'moderator' },
    { email: 'mod2@neighbourhood.com', password: 'mod123', role: 'moderator' },
    { email: 'john.doe@neighbourhood.com', password: 'user123', role: 'user' },
    { email: 'jane.smith@neighbourhood.com', password: 'user123', role: 'user' },
    { email: 'robert.wilson@neighbourhood.com', password: 'user123', role: 'user' },
    { email: 'emily.davis@neighbourhood.com', password: 'user123', role: 'user' },
    { email: 'david.brown@neighbourhood.com', password: 'user123', role: 'user' },
    { email: 'maria.garcia@neighbourhood.com', password: 'user123', role: 'user' },
    { email: 'james.taylor@neighbourhood.com', password: 'user123', role: 'user' },
    { email: 'susan.white@neighbourhood.com', password: 'user123', role: 'user' },
    { email: 'thomas.anderson@neighbourhood.com', password: 'user123', role: 'user' }
  ];

  console.log('🔍 Testing all user credentials...\n');

  for (const user of users) {
    try {
      const loginResponse = await makeRequest('http://localhost:5001/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          password: user.password
        })
      });

      if (loginResponse.status === 200) {
        console.log(`✅ ${user.email} (${user.role}) - LOGIN SUCCESS`);
      } else {
        console.log(`❌ ${user.email} (${user.role}) - LOGIN FAILED: ${loginResponse.data.message}`);
      }
    } catch (error) {
      console.log(`❌ ${user.email} (${user.role}) - ERROR: ${error.message}`);
    }
  }

  console.log('\n📋 WORKING CREDENTIALS FOR FRONTEND:');
  console.log('Email: admin@neighbourhood.com');
  console.log('Password: admin123');
  console.log('\nOR any of these user accounts:');
  console.log('Email: john.doe@neighbourhood.com');
  console.log('Password: user123');
}

testAllUsers();