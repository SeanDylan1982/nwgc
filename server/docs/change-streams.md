# MongoDB Change Streams Implementation

This document describes the implementation of MongoDB Change Streams for real-time data synchronization in the Neighborhood Watch application.

## Overview

The change streams implementation provides real-time updates to clients when data changes in the MongoDB database. This is achieved using MongoDB's Change Streams feature, which allows applications to subscribe to changes in collections and receive notifications when documents are inserted, updated, or deleted.

## Components

### 1. ChangeStreamManager

The `ChangeStreamManager` class is responsible for:

- Creating and managing change streams for multiple collections
- Handling errors and reconnections with exponential backoff
- Storing resume tokens for reliable resumption after disconnections
- Emitting events when changes occur

### 2. RealTimeService

The `RealTimeService` class integrates the `ChangeStreamManager` with Socket.IO to:

- Initialize change streams for critical collections
- Process change events and transform them into appropriate socket events
- Route notifications to the correct clients based on the data context
- Handle reconnection and error scenarios

## Monitored Collections

The following collections are monitored for changes:

1. `messages` - Chat messages in both group and private chats
2. `reports` - Neighborhood incident reports
3. `notices` - Community notices and announcements
4. `chatgroups` - Group chat metadata
5. `privatechats` - Private chat metadata

## Event Flow

1. A change occurs in the MongoDB database (insert, update, delete)
2. The change stream for that collection emits a change event
3. The `ChangeStreamManager` processes the event and emits a collection-specific event
4. The `RealTimeService` receives the event and determines which clients should be notified
5. Socket.IO emits events to the appropriate client rooms
6. Clients receive the events and update their UI accordingly

## Error Handling

The implementation includes robust error handling:

- **Automatic Reconnection**: If a change stream disconnects, it will automatically attempt to reconnect with exponential backoff
- **Resume Tokens**: Change streams store resume tokens to continue from where they left off after a disconnection
- **Jitter**: Reconnection attempts include jitter to prevent thundering herd problems
- **Maximum Retries**: A configurable maximum number of retry attempts prevents infinite reconnection loops

## Health Monitoring

The implementation includes health monitoring endpoints:

- `GET /api/health/change-streams` - Returns the current status of all change streams
- `POST /api/health/change-streams/restart` - Restarts all change streams

## Configuration

The change streams can be configured through environment variables:

- `CHANGE_STREAM_MAX_RETRIES` - Maximum number of reconnection attempts (default: 10)
- `CHANGE_STREAM_INITIAL_DELAY_MS` - Initial delay for reconnection attempts (default: 1000ms)
- `CHANGE_STREAM_MAX_DELAY_MS` - Maximum delay for reconnection attempts (default: 60000ms)

## Client Integration

Clients should listen for the following socket events to receive real-time updates:

### Messages
- `new_message_sync` - New message in a group chat
- `new_private_message_sync` - New message in a private chat
- `message_updated_sync` - Message updated in a group chat
- `private_message_updated_sync` - Message updated in a private chat

### Reports
- `report_sync` - Report created or updated

### Notices
- `notice_sync` - Notice created or updated

### Chat Groups
- `chat_group_sync` - Chat group created or updated
- `chat_group_members_sync` - Chat group members updated

### Private Chats
- `private_chat_sync` - Private chat created or updated

## Limitations

- Delete operations have limited context and may require additional queries to determine routing
- High-volume collections may require additional optimization
- The implementation assumes MongoDB 3.6+ with replica sets enabled

## Future Improvements

- Add collection-specific pipelines to filter changes
- Implement sharded collection support
- Add metrics collection for change stream performance
- Implement dead letter queues for failed event processing