const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const http = require('http');
const { io: Client } = require('socket.io-client');
const { setupTest, teardownTest, testUsers, requestHelpers } = require('../../helpers/testUtils');
const jwt = require('jsonwebtoken');
const env = require('../../../src/config/environment');
const User = require('../../../src/models/User');
const Group = require('../../../src/models/Group');
const Message = require('../../../src/models/Message');
const { hashPassword } = require('../../../src/utils/password');

// Import app and server from app.js module
const { app, server: httpServer } = require('../../../src/app');
const { initializeSocketServer } = require('../../../src/realtime/socket');

describe('Socket.io Message Events', () => {
  // Increase Jest timeout for socket tests
  jest.setTimeout(15000); // 15 seconds
  
  let testUser1;
  let testUser2;
  let testGroup;
  let io;
  let token1;
  let token2;
  let clientSocket1;
  let clientSocket2;
  let port;
  
  // Create test users and group
  const setupTestData = async () => {
    // Create first test user
    const user1 = new User({
      email: testUsers.validUser.email,
      password: await hashPassword(testUsers.validUser.password)
    });
    await user1.save();
    testUser1 = user1;
    
    // Create second test user
    const user2 = new User({
      email: testUsers.secondUser.email,
      password: await hashPassword(testUsers.secondUser.password)
    });
    await user2.save();
    testUser2 = user2;
    
    // Create test group with both users as members
    const group = new Group({
      name: 'Test Group',
      description: 'Test group for socket events',
      owner: user1._id,
      members: [
        { user: user1._id },
        { user: user2._id }
      ],
      type: 'public'
    });
    await group.save();
    testGroup = group;
    
    // Generate tokens for socket connection
    token1 = jwt.sign(
      { userId: user1._id, email: user1.email },
      env.get('JWT_SECRET'),
      { expiresIn: '1h' }
    );
    
    token2 = jwt.sign(
      { userId: user2._id, email: user2.email },
      env.get('JWT_SECRET'),
      { expiresIn: '1h' }
    );
  };

  beforeAll(async () => {
    // Setup test database
    await setupTest();
    
    // Setup test users and group
    await setupTestData();
    
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
  });

  // Clean up after each test to prevent connection leaks
  afterEach(() => {
    [clientSocket1, clientSocket2].forEach(socket => {
      if (socket && socket.connected) {
        socket.disconnect();
      }
    });
  });

  afterAll(async () => {
    // Close any remaining client connections
    [clientSocket1, clientSocket2].forEach(socket => {
      if (socket && socket.connected) {
        socket.disconnect();
      }
    });
    
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
  const createSocketClient = (token) => {
    const url = `http://localhost:${port}`;
    const options = {
      auth: { token },
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
      timeout: 5000,
      path: '/ws'
    };
    
    return Client(url, options);
  };

  // Helper function to connect and join a group
  const connectAndJoinGroup = (socket, groupId) => {
    return new Promise((resolve, reject) => {
      // Set timeout for connection
      const timeout = setTimeout(() => {
        reject(new Error('Connection timed out'));
      }, 10000); // Increase timeout to 10 seconds
      
      // Wait for connection success - first to Socket.IO's built-in connect event
      socket.on('connect', () => {
        // Now wait for our custom event that indicates auth success
        socket.on('connect:success', () => {
          clearTimeout(timeout);
          
          // Join the group
          socket.emit('group:join', { groupId }, (response) => {
            if (response.success) {
              resolve();
            } else {
              reject(new Error(`Failed to join group: ${response.message}`));
            }
          });
        });
      });
      
      // Handle connection errors
      socket.on('connect_error', (err) => {
        clearTimeout(timeout);
        reject(new Error(`Connection error: ${err.message}`));
      });
      
      socket.on('error', (err) => {
        clearTimeout(timeout);
        reject(new Error(`Socket error: ${err.message || err}`));
      });
    });
  };

  // Test sending and receiving messages between users
  it('should send and receive messages between users', (done) => {
    // Test message data
    const messageData = {
      groupId: testGroup._id.toString(),
      content: 'Hello, this is a test message!'
    };
    
    // Create socket clients
    clientSocket1 = createSocketClient(token1);
    clientSocket2 = createSocketClient(token2);
    
    // Connect first user and join group
    connectAndJoinGroup(clientSocket1, testGroup._id.toString())
      .then(() => {
        // Connect second user and join group
        return connectAndJoinGroup(clientSocket2, testGroup._id.toString());
      })
      .then(() => {
        // Set up message listener for second client
        clientSocket2.on('message:new', (data) => {
          // Verify message data
          expect(data.success).toBe(true);
          expect(data.data).toHaveProperty('content', messageData.content);
          expect(data.data).toHaveProperty('sender');
          expect(data.data.sender.toString()).toBe(testUser1._id.toString());
          expect(data.data).toHaveProperty('group');
          expect(data.data.group.toString()).toBe(testGroup._id.toString());
          
          done();
        });
        
        // Send message from first client
        clientSocket1.emit('message:send', messageData, (response) => {
          expect(response.success).toBe(true);
          expect(response.message).toBe('Message sent successfully');
          expect(response.data).toHaveProperty('content', messageData.content);
          
          // If second client doesn't receive the message within 3 seconds, fail the test
          setTimeout(() => {
            done(new Error('Message not received by second client'));
          }, 3000);
        });
      })
      .catch((error) => {
        done(error);
      });
  });
  
  // Test typing indicators
  it('should send typing indicators to group members', (done) => {
    // Create socket clients
    clientSocket1 = createSocketClient(token1);
    clientSocket2 = createSocketClient(token2);
    
    // Connect first user and join group
    connectAndJoinGroup(clientSocket1, testGroup._id.toString())
      .then(() => {
        // Connect second user and join group
        return connectAndJoinGroup(clientSocket2, testGroup._id.toString());
      })
      .then(() => {
        // Set up typing listener for second client
        clientSocket2.on('user:typing', (data) => {
          expect(data).toHaveProperty('userId');
          expect(data.userId).toBe(testUser1._id.toString());
          expect(data).toHaveProperty('userEmail');
          expect(data.userEmail).toBe(testUser1.email);
          expect(data).toHaveProperty('groupId');
          expect(data.groupId).toBe(testGroup._id.toString());
          expect(data).toHaveProperty('typing', true);
          done();
        });
        
        // Send typing indicator from first client
        clientSocket1.emit('user:typing:start', { 
          groupId: testGroup._id.toString() 
        });
        
        // If second client doesn't receive typing indicator within 3 seconds, fail the test
        setTimeout(() => {
          done(new Error('Typing indicator not received'));
        }, 3000);
      })
      .catch((error) => {
        done(error);
      });
  });
  
  // Test typing stop indicators
  it('should send typing stop indicators to group members', (done) => {
    // Create socket clients
    clientSocket1 = createSocketClient(token1);
    clientSocket2 = createSocketClient(token2);
    
    // Connect first user and join group
    connectAndJoinGroup(clientSocket1, testGroup._id.toString())
      .then(() => {
        // Connect second user and join group
        return connectAndJoinGroup(clientSocket2, testGroup._id.toString());
      })
      .then(() => {
        // Set up typing listener for second client
        clientSocket2.on('user:typing', (data) => {
          expect(data).toHaveProperty('userId');
          expect(data.userId).toBe(testUser1._id.toString());
          expect(data).toHaveProperty('userEmail');
          expect(data.userEmail).toBe(testUser1.email);
          expect(data).toHaveProperty('groupId');
          expect(data.groupId).toBe(testGroup._id.toString());
          expect(data).toHaveProperty('typing', false);
          done();
        });
        
        // Send typing stop indicator from first client
        clientSocket1.emit('user:typing:stop', { 
          groupId: testGroup._id.toString() 
        });
        
        // If second client doesn't receive typing stop indicator within 3 seconds, fail the test
        setTimeout(() => {
          done(new Error('Typing stop indicator not received'));
        }, 3000);
      })
      .catch((error) => {
        done(error);
      });
  });
  
  // Test message read receipts
  it('should send read receipts to group members', (done) => {
    // Create a test message ID
    const testMessageId = new mongoose.Types.ObjectId().toString();
    
    // Create socket clients
    clientSocket1 = createSocketClient(token1);
    clientSocket2 = createSocketClient(token2);
    
    // Connect first user and join group
    connectAndJoinGroup(clientSocket1, testGroup._id.toString())
      .then(() => {
        // Connect second user and join group
        return connectAndJoinGroup(clientSocket2, testGroup._id.toString());
      })
      .then(() => {
        // Set up message read listener for first client
        clientSocket1.on('message:read', (data) => {
          expect(data).toHaveProperty('messageId', testMessageId);
          expect(data).toHaveProperty('readBy');
          expect(data.readBy).toHaveProperty('userId', testUser2._id.toString());
          expect(data.readBy).toHaveProperty('email', testUser2.email);
          expect(data.readBy).toHaveProperty('timestamp');
          done();
        });
        
        // Send read receipt from second client
        clientSocket2.emit('message:read', { 
          messageId: testMessageId,
          groupId: testGroup._id.toString()
        }, (response) => {
          expect(response.success).toBe(true);
        });
        
        // If first client doesn't receive read receipt within 3 seconds, fail the test
        setTimeout(() => {
          done(new Error('Read receipt not received'));
        }, 3000);
      })
      .catch((error) => {
        done(error);
      });
  });
  
  // Test sending message with missing required fields
  it('should reject messages with missing data', (done) => {
    // Create socket client
    clientSocket1 = createSocketClient(token1);
    
    // Connect and join group
    connectAndJoinGroup(clientSocket1, testGroup._id.toString())
      .then(() => {
        // Try sending message without content
        clientSocket1.emit('message:send', { 
          groupId: testGroup._id.toString(),
          // Missing content field
        }, (response) => {
          expect(response.success).toBe(false);
          expect(response.message).toBe('Group ID and message content are required');
          expect(response.error).toBe('INVALID_INPUT');
          done();
        });
      })
      .catch((error) => {
        done(error);
      });
  });
});
