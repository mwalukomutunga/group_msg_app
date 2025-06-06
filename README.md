# Group Messaging Platform

A secure real-time group messaging application with user authentication, message encryption, and real-time notifications.

**Handover video:** https://www.loom.com/share/eb274733e6eb4cd2a889d8ed2f7afbb6?sid=0899e606-da13-4475-b7e9-7e921ef68f48

## Features

- **User Authentication**: Secure signup and login with JWT authentication
- **Group Management**: Create, join, and manage messaging groups
- **Real-time Messaging**: Instant message delivery using Socket.io
- **Message Encryption**: End-to-end encryption for secure communications
- **API Documentation**: Interactive Swagger documentation
- **Responsive Design**: Works on desktop and mobile devices

## Technology Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB
- **Real-time Communication**: Socket.io
- **Authentication**: JWT, bcrypt
- **Documentation**: Swagger/OpenAPI

## Prerequisites

- Node.js (v14+)
- npm or yarn
- MongoDB (local instance or MongoDB Atlas)

## Local Development Setup

### 1. Clone the repository

```bash
git clone <repository-url>
cd group-messaging-platform
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy the example environment file and update it with your values:

```bash
cp .env.example .env
```

Key variables to configure:
- `MONGODB_URI`: Your MongoDB connection string
- `JWT_SECRET`: Secret key for JWT token generation
- `ENCRYPTION_KEY`: Key for message encryption

### 4. Start the development server

```bash
npm run dev
```

The server will start at http://localhost:3000 with:
- API at http://localhost:3000/api/v1
- API documentation at http://localhost:3000/api-docs
- Health check at http://localhost:3000/health

## Testing

Run the test suite with:

```bash
# Run all tests
npm test

# Run tests in watch mode during development
npm run test:watch
```

The project uses Jest for testing, with test suites covering:
- Unit tests for models and utilities
- Integration tests for API endpoints
- End-to-end tests for complete user flows
- Socket.io event testing

## Deployment

This application can be deployed to any Node.js hosting platform. Key considerations:

1. **Environment Variables**: Configure all required environment variables in your hosting platform's settings.

2. **Database Connection**: Ensure your MongoDB instance is accessible from your deployment environment.

3. **Socket.io**: The application uses Socket.io for real-time functionality, so ensure your hosting platform supports WebSocket connections.

### General Deployment Steps

1. Choose your hosting platform (Heroku, DigitalOcean, AWS, etc.)
2. Fork or clone the repository
3. Connect your repository to your hosting platform
4. Configure environment variables
5. Deploy

## Project Structure

```
├── src/                  # Source code
│   ├── config/           # Configuration files
│   ├── controllers/      # Request handlers
│   ├── middleware/       # Express middleware
│   ├── models/           # Mongoose models
│   ├── realtime/         # Socket.io implementation
│   ├── routes/           # API routes
│   ├── services/         # Business logic
│   ├── utils/            # Utility functions
│   ├── app.js            # Express application setup
│   └── container.js      # Dependency injection
├── tests/                # Test suites
│   ├── integration/      # API and flow tests
│   ├── setup/            # Test configuration
│   └── unit/             # Unit tests
├── .env.example          # Example environment variables
├── package.json          # Dependencies and scripts
