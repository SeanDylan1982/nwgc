// Simple test to verify search functionality
const axios = require('axios');

async function testSearch() {
  try {
    // Test the autocomplete endpoint
    const response = await axios.get('http://localhost:5001/api/search/autocomplete', {
      params: { q: 'test' },
      headers: { 
        Authorization: 'Bearer your-test-token-here' // You'll need a valid token
      }
    });
    
    console.log('Search autocomplete response:', response.data);
  } catch (error) {
    console.error('Search test error:', error.response?.data || error.message);
  }
}

testSearch();