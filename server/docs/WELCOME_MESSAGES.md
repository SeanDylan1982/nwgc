# Welcome Message System

This document explains the welcome message system that provides contextual guidance to users when they first access different sections of the application.

## Overview

The welcome message system helps new users understand how to use different features by showing informative messages that can be dismissed or collapsed. User preferences for these messages are saved to their profile.

## Features

- **Contextual Messages**: Different welcome messages for chat, notice board, and reports sections
- **Dismissible**: Users can permanently dismiss messages they don't want to see
- **Collapsible**: Users can collapse/expand messages while keeping them visible
- **Persistent**: All preferences are saved to the user's profile
- **Backward Compatible**: Supports migration from old dismissal format

## Message Types

### Chat Welcome Message (`type="chat"`)
- **Location**: Community Chat and Private Chat pages
- **Purpose**: Explains group chats vs private messages
- **Actions**: Join group chat, start private chat

### Notice Board Welcome Message (`type="noticeBoard"`)
- **Location**: Notice Board page
- **Purpose**: Explains how to create and interact with community notices
- **Actions**: Create notice, browse categories

### Reports Welcome Message (`type="reports"`)
- **Location**: Reports page
- **Purpose**: Explains community reporting system
- **Actions**: Create report, view report types

## User Settings Structure

### New Format (Current)
```javascript
settings: {
  welcomeMessageStates: {
    chat: {
      dismissed: false,    // true = permanently hidden
      collapsed: false     // true = collapsed but visible
    },
    noticeBoard: {
      dismissed: false,
      collapsed: false
    },
    reports: {
      dismissed: false,
      collapsed: false
    }
  }
}
```

### Old Format (Deprecated)
```javascript
settings: {
  dismissedWelcomeMessages: {
    chat: false,
    noticeBoard: false,
    reports: false
  }
}
```

## API Endpoints

### Update Welcome Message Settings
```http
PUT /api/users/settings
Content-Type: application/json

{
  "welcomeMessageStates": {
    "chat": {
      "dismissed": true,
      "collapsed": false
    }
  }
}
```

### Get User Settings
```http
GET /api/users/me
```

Returns user object including `settings.welcomeMessageStates`.

## Component Usage

### Basic Usage
```jsx
import WelcomeMessage from '../components/Common/WelcomeMessage';

<WelcomeMessage
  type="chat"
  title="Welcome to Community Chat!"
  severity="info"
  collapsible={true}
  showDismiss={true}
>
  <p>Your welcome message content here.</p>
</WelcomeMessage>
```

### With Actions
```jsx
<WelcomeMessage
  type="noticeBoard"
  title="Welcome to Notice Board!"
  severity="info"
  actions={[
    {
      label: 'Create Notice',
      icon: <AddIcon />,
      onClick: handleCreateNotice,
      variant: 'contained'
    }
  ]}
>
  <p>Welcome message with action buttons.</p>
</WelcomeMessage>
```

## Component Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `type` | string | required | Message type: 'chat', 'noticeBoard', 'reports' |
| `title` | string | required | Message title |
| `children` | ReactNode | required | Message content |
| `severity` | string | 'info' | Alert severity: 'info', 'success', 'warning', 'error' |
| `collapsible` | boolean | true | Whether message can be collapsed |
| `showDismiss` | boolean | true | Whether to show dismiss (X) button |
| `icon` | ReactNode | auto | Custom icon (auto-selected based on type) |
| `actions` | array | [] | Action buttons to display |

## Migration

### Running Migration
To migrate existing users from old format to new format:

```bash
npm run migrate-welcome-settings
```

### Migration Process
1. Finds all users with old `dismissedWelcomeMessages` format
2. Converts to new `welcomeMessageStates` format
3. Preserves existing dismissed states
4. Sets collapsed state to false for all messages
5. Removes old format fields

## Backward Compatibility

The system supports both old and new formats:

- **Loading**: Checks both formats, new format takes precedence
- **Saving**: Always uses new format
- **Migration**: Automatic conversion available

## Testing

### Running Tests
```bash
npm test welcome-message-dismissal.test.js
```

### Test Coverage
- Message rendering based on dismissed state
- Dismissal functionality
- Collapsed state functionality
- Backward compatibility
- Error handling
- Different message types

## Troubleshooting

### Common Issues

1. **Messages not saving state**
   - Check user authentication
   - Verify API endpoint is working
   - Check browser console for errors

2. **Old format still showing**
   - Run migration script
   - Clear browser cache
   - Check user settings in database

3. **Messages not appearing**
   - Check user settings for dismissed state
   - Verify component type matches database field
   - Check component props

### Debug Information

Enable debug logging:
```javascript
// In WelcomeMessage component
console.log('User settings:', user.settings);
console.log('Message type:', type);
console.log('Is dismissed:', isDismissed);
console.log('Is expanded:', isExpanded);
```

## Best Practices

1. **Message Content**
   - Keep messages concise and actionable
   - Include clear next steps
   - Use friendly, welcoming tone

2. **Actions**
   - Limit to 2-3 primary actions
   - Use clear, action-oriented labels
   - Provide visual hierarchy with button variants

3. **Timing**
   - Show messages when users first access features
   - Don't overwhelm with too many messages at once
   - Consider user's experience level

4. **Accessibility**
   - Use proper ARIA labels
   - Ensure keyboard navigation works
   - Provide clear visual feedback

## Future Enhancements

Potential improvements:
- Analytics on message effectiveness
- A/B testing for message content
- Conditional messages based on user behavior
- Rich media support (images, videos)
- Localization support