// Simple script to create test data for moderation
// This should be run from the server directory with proper environment

const testData = {
  notices: [
    {
      title: "Test Notice 1",
      content: "This is a test notice for moderation testing",
      category: "general",
      priority: "normal",
      status: "active",
      isFlagged: false
    },
    {
      title: "Flagged Notice",
      content: "This notice has been reported by users",
      category: "general", 
      priority: "normal",
      status: "active",
      isFlagged: true,
      reports: [
        {
          reason: "inappropriate",
          reportedAt: new Date()
        }
      ]
    },
    {
      title: "Moderated Notice",
      content: "This notice has been moderated by admin",
      category: "general",
      priority: "normal", 
      status: "archived",
      moderationReason: "Content archived for review",
      moderatedAt: new Date()
    }
  ]
};

console.log('Test data structure for moderation:');
console.log(JSON.stringify(testData, null, 2));
console.log('\nTo create this data, you would need to:');
console.log('1. Have proper user authentication');
console.log('2. Have a neighbourhood ID');
console.log('3. Use the proper API endpoints or database insertion');