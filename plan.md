# Neighbourhood Watch App - Full Stack Cleanup & Enhancement Plan

## 🎯 OBJECTIVE
Clean up and standardize the app's backend and frontend data handling, enforce proper dynamic rendering from the database, and enable missing features and user interactivity.

## 📋 EXECUTION PLAN

### ✅ Step 1: Remove Hardcoded/Mock Data
- [ ] Scan entire codebase for mock data
- [ ] Remove all hardcoded mock data from components
- [ ] Insert equivalent data into database
- [ ] Update components to fetch live data from API
- [ ] Test all pages render with real data

**Files to check:**
- Dashboard.js (stats, recent items)
- Profile.js (user stats)
- Contacts.js (mock contacts)
- Reports.js (mock reports)
- NoticeBoard.js (mock notices)
- Chat.js (mock messages)

### ✅ Step 2: Adjust All Stat Counters to Reflect Live Data
- [ ] Identify all stat counters in the app
- [ ] Create API endpoints for real-time stats
- [ ] Replace hardcoded numbers with database queries
- [ ] Implement dynamic time calculations

**Counters to fix:**
- Reports Filed → Count from reports collection
- Messages Sent → Count from messages collection
- Notices Posted → Count from notices collection
- Member Since → Calculate from user.createdAt

### ✅ Step 3: Enable Image and Video Uploads
- [ ] Add multer middleware for file uploads
- [ ] Create file upload endpoints
- [ ] Update User model for profile images
- [ ] Update Report/Notice models for media attachments
- [ ] Implement frontend file upload components
- [ ] Add image/video display components

### ✅ Step 4: Make Settings Page Functional
- [ ] Review all settings in Settings.js
- [ ] Wire up toggle switches to database
- [ ] Implement setting update API calls
- [ ] Test all settings save properly
- [ ] Add success/error feedback

### ✅ Step 5: Clickable Dashboard Cards → Detail Pages
- [ ] Make dashboard cards clickable
- [ ] Create detail pages for each card type
- [ ] Add navigation routing
- [ ] Implement like/comment functionality
- [ ] Add media display for posts

### ✅ Step 6: Floating Add Button
- [ ] Add FAB to main layout
- [ ] Create expandable action menu
- [ ] Link to creation forms:
  - New Notice
  - New Report
  - New Chat
- [ ] Style and animate FAB

### ✅ Step 7: Manually Add Admin User
- [ ] Add Sean Patterson admin user to database
- [ ] Verify admin permissions work
- [ ] Test admin functionality

### ✅ Step 8: Admin Controls to Promote Users
- [ ] Add user promotion endpoints
- [ ] Create admin user management UI
- [ ] Implement role change functionality
- [ ] Add permission validation
- [ ] Test role elevation

## 🔧 TECHNICAL REQUIREMENTS

### Backend Updates Needed:
- File upload middleware (multer)
- Statistics aggregation endpoints
- User promotion endpoints
- Settings update endpoints
- Media storage handling

### Frontend Updates Needed:
- Remove all mock data
- Add file upload components
- Create detail pages
- Implement FAB component
- Wire up settings functionality
- Add admin user management

### Database Updates Needed:
- Add media fields to models
- Insert realistic seed data
- Add admin user
- Update user settings schema

## 📝 PROGRESS TRACKING

### Current Status: EXECUTING
- [x] Plan created
- [x] Execution started
- [ ] Step 1: Remove Mock Data - IN PROGRESS
- [ ] Step 2: Live Stat Counters
- [ ] Step 3: Image/Video Uploads
- [ ] Step 4: Functional Settings
- [ ] Step 5: Clickable Dashboard Cards
- [ ] Step 6: Floating Add Button
- [ ] Step 7: Add Admin User
- [ ] Step 8: Admin User Promotion

### Completion Criteria:
- All mock data replaced with database queries
- All stat counters show real-time data
- Image/video uploads working
- Settings page fully functional
- Dashboard cards clickable with detail pages
- FAB with quick actions implemented
- Admin user added and functional
- User promotion system working
- All features tested and verified

---

**Next Action:** Begin Step 1 - Remove Hardcoded/Mock Data