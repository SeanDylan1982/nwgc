/**
 * Simple script to check if server is running
 */

const http = require('http');

function checkServer(port = 5001) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: port,
      path: '/api/health',
      method: 'GET',
      timeout: 5000
    }, (res) => {
      console.log(`✅ Server is running on port ${port}`);
      console.log(`Status: ${res.statusCode}`);
      resolve(true);
    });

    req.on('error', (err) => {
      console.log(`❌ Server not running on port ${port}`);
      console.log(`Error: ${err.message}`);
      resolve(false);
    });

    req.on('timeout', () => {
      console.log(`❌ Server timeout on port ${port}`);
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

async function main() {
  console.log('🔍 Checking if server is running...');
  
  const ports = [5001, 5000, 3001, 8000];
  
  for (const port of ports) {
    const isRunning = await checkServer(port);
    if (isRunning) {
      break;
    }
  }
}

main();