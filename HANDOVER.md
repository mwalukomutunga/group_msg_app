# Group Messaging Platform Handover Guide

This document provides a comprehensive overview of the Group Messaging Platform application architecture, core functionality, and implementation details. It's intended to help developers understand how the system works and how different components interact.

## System Architecture

The application follows a typical Node.js/Express backend architecture with MongoDB for data storage and Socket.io for real-time communication.

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  Client (Web)   │◄────┤  Express API    │◄────┤  MongoDB        │
│                 │     │                 │     │                 │
└────────┬────────┘     └────────┬────────┘     └─────────────────┘
         │                       │
         │                       │
         │               ┌───────▼──────┐
         └──────────────►│  Socket.io   │
                         │  (Real-time) │
                         └──────────────┘
```

## Core Components

### 1. Authentication System

- Located in `src/controllers/authController.js` and `src/services/authService.js`
- Implements JWT-based authentication with refresh tokens
- Provides user registration, login, and session management
- Password hashing using bcrypt
- Key endpoints: `/api/v1/auth/register`, `/api/v1/auth/login`

### 2. Group Management

- Located in `src/controllers/groupController.js` and `src/services/groupService.js`
- Allows users to create, join, and manage messaging groups
- Includes group permission system for admins/members
- Key endpoints: `/api/v1/groups`

### 3. Messaging System

- Located in `src/controllers/messageController.js` and `src/services/messageService.js`
- Handles message creation, retrieval, and encryption
- Supports message history with pagination
- Key endpoints: `/api/v1/messages`

### 4. Real-time Communication

- Located in `src/realtime/socket.js` and `src/realtime/handlers/*`
- Implements Socket.io for real-time messaging
- Handles message delivery notifications
- Manages user presence (online/offline status)
- Provides typing indicators

## Authentication Flow

1. User registers or logs in via REST API
2. Server validates credentials and issues a JWT token
3. Client stores token and includes it in subsequent requests
4. Socket.io connections are authenticated using the same token
5. Tokens expire after the period defined in `JWT_EXPIRES_IN` (env variable)

## Messaging Flow

1. User sends message via REST API or Socket.io
2. Message is encrypted on the server
3. Message is stored in the database
4. Server emits Socket.io event to group members
5. Recipients receive and decrypt the message

## Database Schema

### User Model (`src/models/User.js`)
- Username, email, password (hashed)
- Profile information
- Groups they belong to

### Group Model (`src/models/Group.js`)
- Name, description
- Members list with roles
- Creation timestamp
- Admin user references

### Message Model (`src/models/Message.js`)
- Content (encrypted)
- Sender reference
- Group reference
- Timestamp
- Read receipts

## API Endpoints

The API follows RESTful conventions and is versioned under `/api/v1`.

### Authentication
- `POST /api/v1/auth/register` - Create a new user account
- `POST /api/v1/auth/login` - Authenticate and receive token
- `POST /api/v1/auth/refresh` - Refresh access token

### Users
- `GET /api/v1/users` - List users
- `GET /api/v1/users/:id` - Get user profile
- `PATCH /api/v1/users/:id` - Update user profile

### Groups
- `GET /api/v1/groups` - List groups
- `POST /api/v1/groups` - Create new group
- `GET /api/v1/groups/:id` - Get group details
- `PATCH /api/v1/groups/:id` - Update group
- `POST /api/v1/groups/:id/members` - Add member to group

### Messages
- `GET /api/v1/messages` - List messages (with filters)
- `POST /api/v1/messages` - Send new message
- `GET /api/v1/messages/:id` - Get message details

## Socket.io Events

### Server to Client
- `message:new` - New message notification
- `user:online` - User online status change
- `user:typing` - User typing indicator

### Client to Server
- `message:send` - Send a new message
- `message:read` - Mark message as read
- `user:typing` - Signal that user is typing

## Deployment Considerations

### Vercel Configuration
- The application is configured for serverless deployment on Vercel
- The `vercel.json` file defines routing and environmental settings
- Database connections are handled differently in serverless environments
- Socket.io implementation is adapted for serverless architecture

### Environmental Variables
- All configuration is driven by environment variables (see `.env.example`)
- Production deployment requires setting these in Vercel dashboard
- Sensitive values (JWT_SECRET, ENCRYPTION_KEY) must be unique per environment

## Testing

- Jest test framework for unit and integration tests
- MongoDB Memory Server for database testing
- Socket.io client for real-time testing
- Test suites cover API endpoints, models, and real-time events

## Common Issues and Troubleshooting

### Database Connection Issues
- Check MongoDB connection string in environment variables
- Ensure network allows connections to MongoDB Atlas
- Verify credentials are correct

### Authentication Problems
- JWT_SECRET must be consistent across deployments
- Check token expiration settings
- Validate CORS settings for cross-origin requests

### Socket.io Connection Failures
- Check client-side connection parameters
- Ensure authentication token is properly provided
- Verify CORS settings allow WebSocket connections

## Future Development Considerations

- Media sharing capabilities (images, files)
- End-to-end encryption implementation
- Push notifications for mobile clients
- Advanced group features (roles, moderation tools)
- Message threading and replies
