# Group Messaging Platform Demo Guide

This document simulates a recording of how to use the Group Messaging Platform API. It provides step-by-step instructions with example requests and expected responses.

## API Overview

The application is deployed at: https://group-msg-app.vercel.app

Based on the API structure, this is a RESTful backend service with the following main resources:
- Authentication
- Users
- Groups
- Messages

## API Documentation

The API documentation is available at: https://group-msg-app.vercel.app/api-docs

You can use this interactive Swagger documentation to:
- Explore available endpoints
- Test API calls directly
- View request/response schemas

## Step-by-Step Demo

### 1. Authentication

#### 1.1 Register a new user

```bash
curl -X POST https://group-msg-app.vercel.app/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "demo_user",
    "email": "demo@example.com",
    "password": "SecurePassword123!"
  }'
```

Expected response:
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "user_id_here",
      "username": "demo_user",
      "email": "demo@example.com",
      "createdAt": "2025-06-01T21:30:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### 1.2 Login

```bash
curl -X POST https://group-msg-app.vercel.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo@example.com",
    "password": "SecurePassword123!"
  }'
```

Expected response:
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "user_id_here",
      "username": "demo_user",
      "email": "demo@example.com"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

Save this token for use in subsequent requests.

### 2. Group Management

#### 2.1 Create a new group

```bash
curl -X POST https://group-msg-app.vercel.app/api/v1/groups \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "name": "Demo Group",
    "description": "A group for demonstration purposes"
  }'
```

Expected response:
```json
{
  "success": true,
  "data": {
    "group": {
      "_id": "group_id_here",
      "name": "Demo Group",
      "description": "A group for demonstration purposes",
      "createdBy": "user_id_here",
      "members": ["user_id_here"],
      "createdAt": "2025-06-01T21:35:00.000Z"
    }
  }
}
```

#### 2.2 List all groups

```bash
curl -X GET https://group-msg-app.vercel.app/api/v1/groups \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

Expected response:
```json
{
  "success": true,
  "data": {
    "groups": [
      {
        "_id": "group_id_here",
        "name": "Demo Group",
        "description": "A group for demonstration purposes",
        "createdBy": "user_id_here",
        "members": ["user_id_here"],
        "createdAt": "2025-06-01T21:35:00.000Z"
      }
    ],
    "count": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  }
}
```

#### 2.3 Add another user to the group

First, the other user needs to register:

```bash
curl -X POST https://group-msg-app.vercel.app/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "second_user",
    "email": "second@example.com",
    "password": "AnotherSecurePassword123!"
  }'
```

Then, invite them to the group:

```bash
curl -X POST https://group-msg-app.vercel.app/api/v1/groups/group_id_here/members \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "userId": "second_user_id_here"
  }'
```

Expected response:
```json
{
  "success": true,
  "data": {
    "group": {
      "_id": "group_id_here",
      "name": "Demo Group",
      "members": ["user_id_here", "second_user_id_here"]
    }
  }
}
```

### 3. Messaging

#### 3.1 Send a message to the group

```bash
curl -X POST https://group-msg-app.vercel.app/api/v1/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "groupId": "group_id_here",
    "content": "Hello, this is a test message!"
  }'
```

Expected response:
```json
{
  "success": true,
  "data": {
    "message": {
      "_id": "message_id_here",
      "content": "Hello, this is a test message!",
      "sender": "user_id_here",
      "group": "group_id_here",
      "createdAt": "2025-06-01T21:40:00.000Z",
      "readBy": ["user_id_here"]
    }
  }
}
```

#### 3.2 Get messages from the group

```bash
curl -X GET https://group-msg-app.vercel.app/api/v1/messages?groupId=group_id_here \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

Expected response:
```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "_id": "message_id_here",
        "content": "Hello, this is a test message!",
        "sender": {
          "_id": "user_id_here",
          "username": "demo_user"
        },
        "group": "group_id_here",
        "createdAt": "2025-06-01T21:40:00.000Z",
        "readBy": ["user_id_here"]
      }
    ],
    "count": 1,
    "page": 1,
    "limit": 50,
    "totalPages": 1
  }
}
```

### 4. Real-time Communication

For real-time messaging, the application uses Socket.io. Here's how to connect and communicate:

#### 4.1 Connect to Socket.io server

```javascript
// Client-side JavaScript code
const socket = io('https://group-msg-app.vercel.app', {
  extraHeaders: {
    Authorization: 'Bearer YOUR_TOKEN_HERE'
  }
});

socket.on('connect', () => {
  console.log('Connected to socket server!');
});

socket.on('error', (error) => {
  console.error('Socket connection error:', error);
});
```

#### 4.2 Listen for incoming messages

```javascript
socket.on('message:new', (message) => {
  console.log('New message received:', message);
  // Update UI with the new message
});
```

#### 4.3 Send a message via Socket.io

```javascript
socket.emit('message:send', {
  groupId: 'group_id_here',
  content: 'This is a real-time message sent via Socket.io!'
});
```

#### 4.4 User presence

```javascript
// Listen for user presence updates
socket.on('user:online', (data) => {
  console.log(`User ${data.userId} is now ${data.status}`);
  // Update UI to show user status
});

// Listen for typing indicators
socket.on('user:typing', (data) => {
  console.log(`User ${data.userId} is typing in group ${data.groupId}...`);
  // Show typing indicator in UI
});

// Send typing indicator
socket.emit('user:typing', {
  groupId: 'group_id_here'
});
```

## Test User Accounts

For testing purposes, you can use these pre-configured accounts:

| Username | Email | Password |
|----------|-------|----------|
| test_user1 | test1@example.com | TestPassword123! |
| test_user2 | test2@example.com | TestPassword123! |

## Sample Test Flow

1. Log in as test_user1
2. Create a new group called "Test Group"
3. Add test_user2 to the group
4. Send a message to the group
5. Log in as test_user2 in another browser
6. View messages in the Test Group
7. Send a reply
8. Observe real-time updates in both browsers

## Vercel Deployment Specifics

Note that on Vercel:
- The real-time Socket.io functionality uses a serverless WebSockets implementation
- Database connections are handled lazily on first request
- The API uses a cold-start approach typical of serverless environments

## Common Testing Issues

- If receiving authentication errors, ensure your JWT token hasn't expired
- For database-related errors, check that the MongoDB Atlas instance is accessible
- Socket.io connection issues might be related to CORS settings or authentication token problems

## Testing with Postman

You can import the following Postman collection to test the API:

[Download Postman Collection](https://example.com/group-messaging-platform-postman.json)

This collection includes pre-configured requests for all major API endpoints with environment variable support for the authentication token.
