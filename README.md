# neibrly

Connect with your neighbors - A comprehensive community-focused platform for neighborhood safety, communication, and local engagement. Built with React, Node.js, PostgreSQL, and Socket.io for real-time features.

## 🏘️ Features

### Core Functionality
- **User Authentication & Authorization** - Secure login/register with JWT tokens
- **Role-Based Access Control** - Admin, Moderator, and User roles
- **Real-time Chat System** - Group messaging with Socket.io
- **Community Reports** - Safety incident reporting with categories and priorities
- **Notice Board** - Community announcements and information sharing
- **Contact Directory** - Neighbour contacts and emergency services
- **User Profiles** - Customizable profiles with privacy settings
- **Settings & Preferences** - Notification controls and privacy options

### Advanced Features
- **Neighbourhood Management** - Geographic community boundaries
- **Emergency Alerts** - Real-time emergency notifications
- **File Attachments** - Images and documents for reports/notices
- **Search & Filtering** - Advanced filtering for all content types
- **Mobile-First Design** - Responsive Material-UI interface
- **Real-time Notifications** - Live updates via WebSocket connections
- **Privacy Controls** - Granular privacy settings for user information
- **Audit Logging** - Complete activity tracking for administrators

## 🛠️ Technology Stack

### Frontend
- **React 18** - Modern React with hooks and context
- **Material-UI (MUI)** - Beautiful, accessible component library
- **React Router** - Client-side routing
- **Socket.io Client** - Real-time communication
- **Axios** - HTTP client for API calls

### Backend
- **Node.js & Express** - RESTful API server
- **PostgreSQL** - Robust relational database
- **Socket.io** - Real-time WebSocket communication
- **JWT** - Secure authentication tokens
- **bcryptjs** - Password hashing
- **Express Validator** - Input validation and sanitization

### Security & Performance
- **Helmet** - Security headers
- **CORS** - Cross-origin resource sharing
- **Rate Limiting** - API abuse prevention
- **Compression** - Response compression
- **Input Validation** - Comprehensive data validation

## 📱 User Interface

### Mobile-First Design
- **Bottom Navigation** - Easy thumb navigation
- **Responsive Layout** - Works on all screen sizes
- **Touch-Friendly** - Large touch targets and gestures
- **Material Design** - Consistent, intuitive interface
- **Dark/Light Theme** - User preference support

### Key Screens
1. **Dashboard** - Community overview and quick actions
2. **Chat** - Real-time group messaging
3. **Reports** - Safety incident management
4. **Notice Board** - Community announcements
5. **Contacts** - Neighbour and emergency contacts
6. **Profile** - User information and statistics
7. **Settings** - Privacy and notification preferences

## 🗄️ Database Schema

### Core Tables
- **users** - User accounts with roles and neighbourhood assignment
- **neighbourhoods** - Geographic community boundaries
- **reports** - Safety incidents and community issues
- **notices** - Community announcements and information
- **chat_groups** - Group chat channels
- **messages** - Chat messages with real-time delivery
- **user_contacts** - Neighbour connections
- **emergency_contacts** - Emergency service information
- **user_settings** - Privacy and notification preferences
- **notifications** - System notifications
- **audit_logs** - Administrative action tracking

### Advanced Features
- **UUID Primary Keys** - Secure, non-sequential identifiers
- **Soft Deletes** - Data preservation with logical deletion
- **Timestamps** - Automatic created/updated tracking
- **Indexes** - Optimized query performance
- **Triggers** - Automatic timestamp updates
- **Constraints** - Data integrity enforcement

## 🚀 Getting Started

### Prerequisites
- Node.js 16+ and npm
- PostgreSQL 12+
- Git

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd neibrly
```

2. **Install dependencies**
```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

3. **Database Setup**
```bash
# Create PostgreSQL database
createdb neibrly

# Run database schema
psql neibrly < database/schema.sql
```

4. **Environment Configuration**
```bash
# Copy environment template
cd server
cp .env.example .env

# Edit .env with your configuration
# - Database credentials
# - JWT secret key
# - Other settings
```

5. **Start the application**
```bash
# Start server (from server directory)
npm run dev

# Start client (from client directory)
npm start
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5001

## 🔧 Configuration

### Environment Variables
```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=neibrly
DB_USER=postgres
DB_PASSWORD=your_password

# Security
JWT_SECRET=your_jwt_secret_key

# Server
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000
```

## 📊 API Documentation

### Authentication Endpoints
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Token refresh

### Core Endpoints
- `GET /api/users/me` - Current user profile
- `GET /api/reports` - Community reports
- `POST /api/reports` - Create new report
- `GET /api/notices` - Community notices
- `POST /api/notices` - Create new notice
- `GET /api/chat/groups` - User's chat groups
- `POST /api/chat/groups/:id/messages` - Send message

### Admin Endpoints
- `GET /api/users` - All users (admin only)
- `PATCH /api/users/:id/role` - Update user role
- `GET /api/neighbourhoods` - All neighbourhoods
- `POST /api/neighbourhoods` - Create neighbourhood

## 🔐 Security Features

### Authentication & Authorization
- JWT-based authentication
- Role-based access control (Admin/Moderator/User)
- Secure password hashing with bcrypt
- Token expiration and refresh

### Data Protection
- Input validation and sanitization
- SQL injection prevention
- XSS protection
- CSRF protection
- Rate limiting

### Privacy Controls
- Granular privacy settings
- Anonymous reporting options
- Data encryption in transit
- Audit logging for sensitive operations

## 🌟 Key Features Explained

### Real-time Chat System
- WebSocket-based messaging
- Group chat support
- Typing indicators
- Message history
- File sharing capabilities

### Community Reports
- Categorized incident reporting
- Priority levels (Low/Medium/High/Urgent)
- Anonymous reporting option
- Status tracking (Open/In Progress/Resolved)
- Geographic location support

### Notice Board
- Community announcements
- Event notifications
- Pinned important notices
- Expiration dates
- Category filtering

### Contact Management
- Neighbour directory
- Emergency contacts
- Privacy-respecting contact sharing
- Quick communication options

## 🎯 User Roles & Permissions

### Admin
- Full system access
- User management
- Neighbourhood management
- Content moderation
- System configuration

### Moderator
- Content moderation
- Report management
- Emergency alerts
- Community oversight

### User
- Basic app features
- Create reports/notices
- Participate in chats
- Manage own profile

## 📱 Mobile Experience

### Responsive Design
- Mobile-first approach
- Touch-friendly interface
- Optimized for small screens
- Fast loading times

### Progressive Web App Features
- Offline capability
- Push notifications
- App-like experience
- Home screen installation

## 🔄 Real-time Features

### Live Updates
- New messages appear instantly
- Report status changes
- Emergency alerts
- User online status

### WebSocket Events
- Message delivery
- Typing indicators
- User presence
- System notifications

## 🛡️ Privacy & Safety

### User Privacy
- Configurable privacy levels
- Anonymous options
- Data minimization
- Secure data handling

### Community Safety
- Report verification
- Content moderation
- Emergency response
- Incident tracking

## 📈 Performance Optimization

### Database
- Proper indexing
- Query optimization
- Connection pooling
- Efficient pagination
- MongoDB reliability optimization with retry mechanisms

### Frontend
- Component optimization
- Lazy loading
- Caching strategies
- Bundle optimization

### Backend
- Response compression
- Rate limiting
- Error handling
- Monitoring
- Exponential backoff retry logic for database operations

## 🤝 Contributing

neibrly provides a solid foundation for community safety and engagement. The codebase is well-structured, secure, and scalable for growing communities.

## 📄 License

MIT License - Feel free to use and modify for your community needs.