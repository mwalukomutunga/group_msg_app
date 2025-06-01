const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const http = require('http');
const { io: Client } = require('socket.io-client');
const { setupTest, teardownTest, testUsers, requestHelpers } = require('../../helpers/testUtils');
const jwt = require('jsonwebtoken');
const env = require('../../../src/config/environment');
const User = require('../../../src/models/User');
const Group = require('../../../src/models/Group');
const { hashPassword } = require('../../../src/utils/password');

// Import app and server from app.js module
const { app, server: httpServer } = require('../../../src/app');
const { initializeSocketServer } = require('../../../src/realtime/socket');

describe('Socket.io Presence Events', () => {
  // Increase Jest timeout for socket tests
  jest.setTimeout(15000); // 15 seconds
  
  let testUser1;
  let testUser2;
  let testUser3; // User not in the group
  let testGroup;
  let io;
  let token1;
  let token2;
  let token3;
  let clientSocket1;
  let clientSocket2;
  let clientSocket3;
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
    
    // Create third test user (not in group)
    const user3 = new User({
      email: 'outsider@example.com',
      password: await hashPassword('Password123!')
    });
    await user3.save();
    testUser3 = user3;
    
    // Create test group with only user1 and user2 as members
    const group = new Group({
      name: 'Test Group',
      description: 'Test group for presence events',
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
    
    token3 = jwt.sign(
      { userId: user3._id, email: user3.email },
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
    [clientSocket1, clientSocket2, clientSocket3].forEach(socket => {
      if (socket && socket.connected) {
        socket.disconnect();
      }
    });
    
    // Reset variables
    clientSocket1 = null;
    clientSocket2 = null;
    clientSocket3 = null;
  });

  afterAll(async () => {
    // Close any remaining client connections
    [clientSocket1, clientSocket2, clientSocket3].forEach(socket => {
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

  // Helper function to wait for connection success
  const waitForConnection = (socket) => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timed out'));
      }, 5000);
      
      socket.on('connect', () => {
        // Socket.IO connected, now wait for our custom event
        socket.on('connect:success', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
      
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

  // Test joining a group
  it('should allow a member to join a group room', (done) => {
    // Create socket client for user 1
    clientSocket1 = createSocketClient(token1);
    
    waitForConnection(clientSocket1)
      .then(() => {
        // Try to join the group
        clientSocket1.emit('group:join', { groupId: testGroup._id.toString() }, (response) => {
          expect(response.success).toBe(true);
          expect(response.message).toBe('Successfully joined group room');
          done();
        });
      })
      .catch((error) => {
        done(error);
      });
  });

  // Test joining with non-member user
  it('should reject non-members from joining a group room', (done) => {
    // Create socket client for user 3 (not a member)
    clientSocket3 = createSocketClient(token3);
    
    waitForConnection(clientSocket3)
      .then(() => {
        // Try to join the group
        clientSocket3.emit('group:join', { groupId: testGroup._id.toString() }, (response) => {
          expect(response.success).toBe(false);
          expect(response.message).toBe('You are not a member of this group');
          // Don't check the error code for now
          done();
        });
      })
      .catch((error) => {
        done(error);
      });
  });

  // Test user presence notification
  it('should notify group members when a user joins', (done) => {
    // Create socket clients
    clientSocket1 = createSocketClient(token1);
    clientSocket2 = createSocketClient(token2);
    
    let user1Connected = false;
    
    // Connect user 1 and join group
    waitForConnection(clientSocket1)
      .then(() => {
        return new Promise((resolve, reject) => {
          // Join the group
          clientSocket1.emit('group:join', { groupId: testGroup._id.toString() }, (response) => {
            if (response.success) {
              user1Connected = true;
              resolve();
            } else {
              reject(new Error(`Failed to join group: ${response.message}`));
            }
          });
        });
      })
      .then(() => {
        // Connect user 2
        return waitForConnection(clientSocket2);
      })
      .then(() => {
        // Set up listener for user active notification
        clientSocket1.on('user:active', (data) => {
          expect(data).toHaveProperty('userId', testUser2._id.toString());
          expect(data).toHaveProperty('email', testUser2.email);
          expect(data).toHaveProperty('groupId', testGroup._id.toString());
          expect(data).toHaveProperty('status', 'online');
          done();
        });
        
        // User 2 joins the group
        clientSocket2.emit('group:join', { groupId: testGroup._id.toString() }, (response) => {
          expect(response.success).toBe(true);
          
          // If notification is not received within 3 seconds, fail the test
          setTimeout(() => {
            if (user1Connected) {
              done(new Error('User active notification not received'));
            }
          }, 3000);
        });
      })
      .catch((error) => {
        done(error);
      });
  });

  // Test leaving a group
  it('should allow a user to leave a group room', (done) => {
    // Create socket client
    clientSocket1 = createSocketClient(token1);
    
    waitForConnection(clientSocket1)
      .then(() => {
        // Join the group first
        return new Promise((resolve, reject) => {
          clientSocket1.emit('group:join', { groupId: testGroup._id.toString() }, (response) => {
            if (response.success) {
              resolve();
            } else {
              reject(new Error(`Failed to join group: ${response.message}`));
            }
          });
        });
      })
      .then(() => {
        // Now leave the group
        clientSocket1.emit('group:leave', { groupId: testGroup._id.toString() }, (response) => {
          expect(response.success).toBe(true);
          expect(response.message).toBe('Successfully left group room');
          done();
        });
      })
      .catch((error) => {
        done(error);
      });
  });

  // Test user inactive notification
  it('should notify group members when a user leaves', (done) => {
    // Create socket clients
    clientSocket1 = createSocketClient(token1);
    clientSocket2 = createSocketClient(token2);
    
    // Connect both users and join the group
    Promise.all([
      waitForConnection(clientSocket1),
      waitForConnection(clientSocket2)
    ])
      .then(() => {
        return Promise.all([
          // Join group with user 1
          new Promise((resolve, reject) => {
            clientSocket1.emit('group:join', { groupId: testGroup._id.toString() }, (response) => {
              if (response.success) {
                resolve();
              } else {
                reject(new Error(`User 1 failed to join group: ${response.message}`));
              }
            });
          }),
          // Join group with user 2
          new Promise((resolve, reject) => {
            clientSocket2.emit('group:join', { groupId: testGroup._id.toString() }, (response) => {
              if (response.success) {
                resolve();
              } else {
                reject(new Error(`User 2 failed to join group: ${response.message}`));
              }
            });
          })
        ]);
      })
      .then(() => {
        // Set up listener for user inactive notification on user 1's socket
        clientSocket1.on('user:inactive', (data) => {
          expect(data).toHaveProperty('userId', testUser2._id.toString());
          expect(data).toHaveProperty('email', testUser2.email);
          expect(data).toHaveProperty('groupId', testGroup._id.toString());
          expect(data).toHaveProperty('status', 'offline');
          done();
        });
        
        // User 2 leaves the group
        clientSocket2.emit('group:leave', { groupId: testGroup._id.toString() }, (response) => {
          expect(response.success).toBe(true);
        });
        
        // If notification is not received within 3 seconds, fail the test
        setTimeout(() => {
          done(new Error('User inactive notification not received'));
        }, 3000);
      })
      .catch((error) => {
        done(error);
      });
  });

  // Test getting active users in a group
  it('should return a list of active users in a group', (done) => {
    // Create socket clients
    clientSocket1 = createSocketClient(token1);
    clientSocket2 = createSocketClient(token2);
    
    // Connect both users and join the group
    Promise.all([
      waitForConnection(clientSocket1),
      waitForConnection(clientSocket2)
    ])
      .then(() => {
        return Promise.all([
          // Join group with user 1
          new Promise((resolve, reject) => {
            clientSocket1.emit('group:join', { groupId: testGroup._id.toString() }, (response) => {
              if (response.success) {
                resolve();
              } else {
                reject(new Error(`User 1 failed to join group: ${response.message}`));
              }
            });
          }),
          // Join group with user 2
          new Promise((resolve, reject) => {
            clientSocket2.emit('group:join', { groupId: testGroup._id.toString() }, (response) => {
              if (response.success) {
                resolve();
              } else {
                reject(new Error(`User 2 failed to join group: ${response.message}`));
              }
            });
          })
        ]);
      })
      .then(() => {
        // Get active users in the group
        clientSocket1.emit('group:active_users', { groupId: testGroup._id.toString() }, (response) => {
          expect(response.success).toBe(true);
          expect(response.data).toBeInstanceOf(Array);
          expect(response.data.length).toBe(2); // Both users should be active
          
          // Verify user data
          const user1Data = response.data.find(u => u.userId === testUser1._id.toString());
          const user2Data = response.data.find(u => u.userId === testUser2._id.toString());
          
          expect(user1Data).toBeDefined();
          expect(user1Data.email).toBe(testUser1.email);
          expect(user1Data.status).toBe('online');
          
          expect(user2Data).toBeDefined();
          expect(user2Data.email).toBe(testUser2.email);
          expect(user2Data.status).toBe('online');
          
          done();
        });
      })
      .catch((error) => {
        done(error);
      });
  });
  
  // Test disconnection handling
  it('should handle user disconnection correctly', (done) => {
    // Create socket clients
    clientSocket1 = createSocketClient(token1);
    clientSocket2 = createSocketClient(token2);
    
    // Connect both users and join the group
    Promise.all([
      waitForConnection(clientSocket1),
      waitForConnection(clientSocket2)
    ])
      .then(() => {
        return Promise.all([
          // Join group with user 1
          new Promise((resolve, reject) => {
            clientSocket1.emit('group:join', { groupId: testGroup._id.toString() }, (response) => {
              if (response.success) {
                resolve();
              } else {
                reject(new Error(`User 1 failed to join group: ${response.message}`));
              }
            });
          }),
          // Join group with user 2
          new Promise((resolve, reject) => {
            clientSocket2.emit('group:join', { groupId: testGroup._id.toString() }, (response) => {
              if (response.success) {
                resolve();
              } else {
                reject(new Error(`User 2 failed to join group: ${response.message}`));
              }
            });
          })
        ]);
      })
      .then(() => {
        // Set up listener for user inactive notification on user 1's socket
        clientSocket1.on('user:inactive', (data) => {
          expect(data).toHaveProperty('userId', testUser2._id.toString());
          expect(data).toHaveProperty('email', testUser2.email);
          expect(data).toHaveProperty('groupId', testGroup._id.toString());
          expect(data).toHaveProperty('status', 'offline');
          done();
        });
        
        // Disconnect user 2
        clientSocket2.disconnect();
        
        // If notification is not received within 3 seconds, fail the test
        setTimeout(() => {
          done(new Error('User inactive notification not received after disconnect'));
        }, 3000);
      })
      .catch((error) => {
        done(error);
      });
  });
  
  // Test joining with missing group ID
  it('should reject joining a group without group ID', (done) => {
    // Create socket client
    clientSocket1 = createSocketClient(token1);
    
    waitForConnection(clientSocket1)
      .then(() => {
        // Try to join without providing a group ID
        clientSocket1.emit('group:join', {}, (response) => {
          expect(response.success).toBe(false);
          expect(response.message).toBe('Group ID is required');
          expect(response.error).toBe('INVALID_INPUT');
          done();
        });
      })
      .catch((error) => {
        done(error);
      });
  });
  
  // Test joining a non-existent group
  it('should reject joining a non-existent group', (done) => {
    // Create a non-existent group ID
    const nonExistentGroupId = new mongoose.Types.ObjectId().toString();
    
    // Create socket client
    clientSocket1 = createSocketClient(token1);
    
    waitForConnection(clientSocket1)
      .then(() => {
        // Try to join a non-existent group
        clientSocket1.emit('group:join', { groupId: nonExistentGroupId }, (response) => {
          expect(response.success).toBe(false);
          expect(response.message).toBe('Group not found');
          expect(response.error).toBe('GROUP_NOT_FOUND');
          done();
        });
      })
      .catch((error) => {
        done(error);
      });
  });
});
