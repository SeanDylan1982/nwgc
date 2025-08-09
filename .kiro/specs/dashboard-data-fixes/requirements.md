# Requirements Document

## Introduction

This feature addresses critical data display and functionality issues in the neighbourhood watch app where dashboard statistics, notifications, settings, and chat functionality are not working correctly. The system currently shows incorrect data (zeros instead of actual database values) and has broken core features that prevent users from effectively using the application. This comprehensive fix will ensure all data displays accurately reflect the MongoDB Atlas database state and restore full functionality to essential features.

## Requirements

### Requirement 1

**User Story:** As a user, I want to see accurate dashboard statistics that reflect real data from the database, so that I can understand the current state of my neighbourhood community.

#### Acceptance Criteria

1. WHEN a user views the dashboard THEN the "Active chats" card SHALL display the correct count of user's group and private chats from the database
2. WHEN a user views the dashboard THEN the "Total notices" card SHALL display the correct count of active notices in the neighbourhood from the database
3. WHEN a user views the dashboard THEN the "Open reports" card SHALL display the correct count of active reports in the neighbourhood from the database
4. WHEN a user views the dashboard THEN the "Neighbours" card SHALL display the correct count of registered users in the neighbourhood from the database
5. WHEN dashboard data is fetched THEN the system SHALL query the MongoDB Atlas database using the MONGO_URI connection string

### Requirement 2

**User Story:** As a user, I want to see recent notices and reports lists populated with actual data, so that I can stay informed about neighbourhood activity.

#### Acceptance Criteria

1. WHEN a user views the dashboard THEN the "Recent notices" list SHALL display the latest active notices from the database
2. WHEN a user views the dashboard THEN the "Recent reports" list SHALL display the latest active reports from the database
3. WHEN recent items are displayed THEN they SHALL include proper author information, timestamps, and engagement metrics
4. WHEN no recent items exist THEN the system SHALL display appropriate empty state messages
5. WHEN recent items are clicked THEN the system SHALL navigate to the detailed view of that item

### Requirement 3

**User Story:** As a user, I want the notification bell to accurately show unread notifications and display them when clicked, so that I can stay informed about important updates.

#### Acceptance Criteria

1. WHEN a user has unread notifications THEN the notification bell SHALL display the unread notification icon with a count badge
2. WHEN a user has no unread notifications THEN the notification bell SHALL display the regular notification icon
3. WHEN a user clicks the notification bell THEN the system SHALL display a dropdown with all unread notifications from the database
4. WHEN notifications are displayed THEN they SHALL include proper content, timestamps, and sender information
5. WHEN a notification is clicked THEN the system SHALL mark it as read and navigate to the relevant content

### Requirement 4

**User Story:** As an administrator, I want the admin panel to display all current database data with management controls, so that I can effectively moderate the community.

#### Acceptance Criteria

1. WHEN an admin accesses the admin panel THEN the system SHALL fetch and display all current user data from the database
2. WHEN an admin views the admin panel THEN the system SHALL display all current notices, reports, and chat data from the database
3. WHEN admin data is displayed THEN it SHALL include accurate counts, statuses, and timestamps from the database
4. WHEN admin controls are used THEN they SHALL properly update the database and reflect changes immediately
5. WHEN admin actions are performed THEN the system SHALL maintain audit logs and proper authorization

### Requirement 5

**User Story:** As a user, I want the settings page to properly save and load my preferences from the database, so that my customizations persist across sessions.

#### Acceptance Criteria

1. WHEN a user opens the settings page THEN the system SHALL load current settings from the user's database record
2. WHEN a user changes a setting THEN the system SHALL immediately save the change to the database
3. WHEN settings are saved THEN the system SHALL provide visual feedback confirming the save operation
4. WHEN settings fail to save THEN the system SHALL display an error message and revert the UI state
5. WHEN settings are loaded THEN they SHALL reflect the user's actual preferences stored in the database

### Requirement 6

**User Story:** As a user, I want to see all chat messages in both group and private conversations, so that I can participate in community discussions.

#### Acceptance Criteria

1. WHEN a user opens a group chat THEN the system SHALL display all messages from that chat group stored in the database
2. WHEN a user opens a private chat THEN the system SHALL display all messages from that private conversation stored in the database
3. WHEN messages are displayed THEN they SHALL include proper sender information, timestamps, and content
4. WHEN new messages are sent THEN they SHALL appear immediately in the chat interface
5. WHEN messages are loaded THEN the system SHALL handle pagination and scrolling appropriately

### Requirement 7

**User Story:** As a user, I want to create private chats with my friends without errors, so that I can have personal conversations.

#### Acceptance Criteria

1. WHEN a user attempts to create a private chat with a friend THEN the system SHALL successfully create the chat without errors
2. WHEN a private chat is created THEN the system SHALL store it properly in the database
3. WHEN private chat creation fails THEN the system SHALL display a helpful error message explaining the issue
4. WHEN a user selects a friend for private chat THEN the system SHALL verify the friendship relationship exists
5. WHEN private chat functionality is used THEN it SHALL work consistently across all user interactions

### Requirement 8

**User Story:** As a user, I want friends to be available for group chat invitations, so that I can include them in community discussions.

#### Acceptance Criteria

1. WHEN a user creates or joins a group chat THEN their friends SHALL be available as options for invitation
2. WHEN friend lists are displayed THEN they SHALL include all confirmed friendships from the database
3. WHEN a friend is invited to a group chat THEN the system SHALL properly add them to the chat membership
4. WHEN group chat membership is managed THEN the system SHALL maintain accurate participant lists
5. WHEN friendship status changes THEN it SHALL be reflected immediately in chat invitation options

### Requirement 9

**User Story:** As a developer, I want all database queries to use the correct MongoDB Atlas connection, so that the application displays accurate real-time data.

#### Acceptance Criteria

1. WHEN any database operation is performed THEN the system SHALL use the MONGO_URI from the .env.local file
2. WHEN the application starts THEN it SHALL connect to the MongoDB Atlas database specified in the environment configuration
3. WHEN database connections are established THEN they SHALL use the proper connection pooling and error handling
4. WHEN database queries fail THEN the system SHALL implement proper retry logic and fallback mechanisms
5. WHEN database operations are performed THEN they SHALL be logged appropriately for debugging and monitoring

### Requirement 10

**User Story:** As a user, I want real-time updates for all dynamic content, so that I see the most current information without manual refresh.

#### Acceptance Criteria

1. WHEN new messages are sent THEN they SHALL appear in real-time for all chat participants
2. WHEN notifications are created THEN they SHALL update the notification bell immediately
3. WHEN dashboard statistics change THEN they SHALL reflect the updates without page refresh
4. WHEN settings are modified THEN the changes SHALL be applied immediately across the application
5. WHEN database updates occur THEN the UI SHALL reflect the changes through appropriate update mechanisms