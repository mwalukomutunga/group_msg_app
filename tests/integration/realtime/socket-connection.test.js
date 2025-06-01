const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const http = require('http');
const { io: Client } = require('socket.io-client');
const { setupTest, teardownTest, testUsers, requestHelpers } = require('../../helpers/testUtils');
const jwt = require('jsonwebtoken');
const env = require('../../../src/config/environment');
const User = require('../../../src/models/User');
const { hashPassword } = require('../../../src/utils/password');

// Import app and server from updated app.js module
const { app, server: httpServer } = require('../../../src/app');
const { initializeSocketServer } = require('../../../src/realtime/socket');

describe('Socket.io Connection', () => {
  // Increase Jest timeout for socket tests
  jest.setTimeout(15000); // 15 seconds to allow for slower CI environments
  
  let testUser;
  let io;
  let testToken;
  let clientSocket;
  let port;
  
  // Create test user and generate token for socket auth
  const createTestUserAndToken = async () => {
    const userData = testUsers.validUser;
    const user = new User({
      email: userData.email,
      password: await hashPassword(userData.password)
    });
    
    await user.save();
    testUser = user;
    
    // Generate token for socket connection
    return jwt.sign(
      { userId: user._id, email: user.email },
      env.get('JWT_SECRET'),
      { expiresIn: '1h' }
    );
  };

  beforeAll(async () => {
    // Setup test database
    await setupTest();
    
    // Create local Socket.io server for testing and wait for it to be ready
    await new Promise((resolve) => {
      // Only start server if not already listening
      if (!httpServer.listening) {
        httpServer.listen(0); // Use random available port
        httpServer.once('listening', resolve);
      } else {
        resolve();
      }
    });
    
    // Initialize socket server
    io = initializeSocketServer(httpServer);
    
    // Get the port for client connections
    port = httpServer.address().port;
    
    // Create auth token for test user
    testToken = await createTestUserAndToken();
  });

  // Clean up after each test to prevent connection leaks
  afterEach(() => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
  });

  afterAll(async () => {
    // Close any remaining client connections
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
    
    // Close server with proper error handling
    if (httpServer && httpServer.listening) {
      await new Promise((resolve, reject) => {
        httpServer.close((err) => {
          if (err) {
            console.error('Error closing server:', err);
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }
    
    // Clean up test database
    await teardownTest();
  });

  // Helper function to create socket client
  const createSocketClient = (token = null) => {
    const url = `http://localhost:${port}`;
    const options = {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
      timeout: 5000,
      path: '/ws'
    };
    
    // Add auth token if provided
    if (token) {
      options.auth = { token };
    }
    
    return Client(url, options);
  };

  // Test socket connection and authentication
  it('should authenticate and connect with valid token', (done) => {
    clientSocket = createSocketClient(testToken);

    // Set timeout for connection failure
    const connectionTimeout = setTimeout(() => {
      done(new Error('Connection timed out'));
    }, 5000);

    // Listen for successful connection
    clientSocket.on('connect:success', (data) => {
      clearTimeout(connectionTimeout);
      
      expect(data).toHaveProperty('userId');
      expect(data).toHaveProperty('userEmail', testUsers.validUser.email);
      expect(data).toHaveProperty('socketId');
      expect(data).toHaveProperty('timestamp');
      done();
    });
    
    // Handle errors
    clientSocket.on('connect_error', (err) => {
      clearTimeout(connectionTimeout);
      done(new Error(`Connection failed: ${err.message}`));
    });
  });

  // Test connection without token
  it('should reject connection without token', (done) => {
    const socketWithoutAuth = createSocketClient();

    // Set timeout for unexpected success
    const connectionTimeout = setTimeout(() => {
      socketWithoutAuth.disconnect();
      done(new Error('Test timed out without proper rejection'));
    }, 5000);

    socketWithoutAuth.on('connect_error', (err) => {
      clearTimeout(connectionTimeout);
      expect(err.message).toContain('Authentication error');
      socketWithoutAuth.disconnect();
      done();
    });

    socketWithoutAuth.on('connect', () => {
      clearTimeout(connectionTimeout);
      socketWithoutAuth.disconnect();
      done(new Error('Socket connected without token'));
    });
  });
  
  // Test connection with invalid token
  it('should reject connection with invalid token', (done) => {
    const invalidToken = 'invalid.token.format';
    const socketWithInvalidAuth = createSocketClient(invalidToken);

    socketWithInvalidAuth.on('connect_error', (err) => {
      expect(err.message).toContain('Invalid or expired token');
      socketWithInvalidAuth.disconnect();
      done();
    });

    socketWithInvalidAuth.on('connect', () => {
      socketWithInvalidAuth.disconnect();
      done(new Error('Socket connected with invalid token'));
    });
  });
  
  // Test connection with expired token
  it('should reject connection with expired token', (done) => {
    // Generate an expired token (already expired by setting -1h)
    const expiredToken = jwt.sign(
      { userId: testUser._id, email: testUser.email },
      env.get('JWT_SECRET'),
      { expiresIn: '-1h' }
    );
    
    const socketWithExpiredAuth = createSocketClient(expiredToken);

    socketWithExpiredAuth.on('connect_error', (err) => {
      expect(err.message).toContain('Invalid or expired token');
      socketWithExpiredAuth.disconnect();
      done();
    });

    socketWithExpiredAuth.on('connect', () => {
      socketWithExpiredAuth.disconnect();
      done(new Error('Socket connected with expired token'));
    });
  });
});
