/**
 * Test script to verify image upload functionality
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Create a simple test image file
const testImagePath = path.join(__dirname, 'test-image.png');
const testImageContent = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU77yQAAAABJRU5ErkJggg==', 'base64');

async function testImageUpload() {
  try {
    console.log('🧪 Testing image upload functionality...');
    
    // Create test image file
    fs.writeFileSync(testImagePath, testImageContent);
    console.log('✅ Created test image file');
    
    // First, let's test login to get a token
    console.log('🔐 Testing login...');
    
    // Try different user credentials from our seeded data
    const credentials = [
      { email: 'admin@neighbourhood.com', password: 'admin123' },
      { email: 'john.doe@neighbourhood.com', password: 'user123' },
      { email: 'jane.smith@neighbourhood.com', password: 'user123' }
    ];
    
    let loginResponse = null;
    let token = null;
    
    for (const cred of credentials) {
      try {
        console.log(`Trying login with ${cred.email}...`);
        loginResponse = await axios.post('http://localhost:5001/api/auth/login', cred);
        if (loginResponse.data.token) {
          token = loginResponse.data.token;
          console.log(`✅ Login successful with ${cred.email}`);
          break;
        }
      } catch (error) {
        console.log(`❌ Login failed for ${cred.email}:`, error.response?.data?.message);
      }
    }
    
    if (token) {
      console.log('✅ Login successful, got token');
      
      // Now test the image upload
      console.log('📤 Testing image upload...');
      
      const formData = new FormData();
      formData.append('profileImage', fs.createReadStream(testImagePath), {
        filename: 'test-image.png',
        contentType: 'image/png'
      });
      
      const uploadResponse = await axios.post('http://localhost:5001/api/upload/profile-image', formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          ...formData.getHeaders()
        }
      });
      
      console.log('✅ Upload successful:', uploadResponse.data);
      
      // Test if the uploaded file can be accessed
      if (uploadResponse.data.file && uploadResponse.data.file.url) {
        const imageUrl = `http://localhost:5001${uploadResponse.data.file.url}`;
        console.log('🔍 Testing image access:', imageUrl);
        
        const imageResponse = await axios.get(imageUrl);
        console.log('✅ Image accessible, status:', imageResponse.status);
      }
      
    } else {
      console.log('❌ All login attempts failed');
      return;
    }
    
  } catch (error) {
    console.log('❌ Test failed:', error.response?.data || error.message);
    if (error.response) {
      console.log('Response status:', error.response.status);
      console.log('Response headers:', error.response.headers);
    }
  } finally {
    // Clean up test file
    if (fs.existsSync(testImagePath)) {
      fs.unlinkSync(testImagePath);
      console.log('🧹 Cleaned up test image file');
    }
  }
}

// Run the test
testImageUpload();