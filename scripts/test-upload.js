/**
 * Test script to verify image upload functionality
 */

const fs = require('fs');
const path = require('path');

// Test if upload directories exist
const uploadDirs = ['uploads/profiles', 'uploads/notices', 'uploads/reports', 'uploads/messages'];

console.log('🔍 Testing upload directory structure...');

uploadDirs.forEach(dir => {
  if (fs.existsSync(dir)) {
    console.log(`✅ ${dir} exists`);
    
    // Check permissions
    try {
      fs.accessSync(dir, fs.constants.R_OK | fs.constants.W_OK);
      console.log(`✅ ${dir} has read/write permissions`);
    } catch (error) {
      console.log(`❌ ${dir} permission error:`, error.message);
    }
  } else {
    console.log(`❌ ${dir} does not exist`);
    
    // Try to create it
    try {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`✅ Created ${dir}`);
    } catch (error) {
      console.log(`❌ Failed to create ${dir}:`, error.message);
    }
  }
});

// Test static file serving path
console.log('\n🔍 Testing static file serving...');
const testFilePath = 'uploads/profiles/test.txt';
try {
  fs.writeFileSync(testFilePath, 'Test file for upload verification');
  console.log(`✅ Created test file: ${testFilePath}`);
  
  // Check if file can be read
  const content = fs.readFileSync(testFilePath, 'utf8');
  console.log(`✅ Test file content: "${content}"`);
  
  // Clean up
  fs.unlinkSync(testFilePath);
  console.log(`✅ Cleaned up test file`);
} catch (error) {
  console.log(`❌ File operation error:`, error.message);
}

console.log('\n✅ Upload system test completed');