/**
 * WebSocket Server Configuration
 *
 * Initializes and configures the Socket.io server
 * with authentication and event handlers using dependency injection.
 */

const { Server } = require('socket.io');
const createAuthMiddleware = require('./middleware/authMiddleware');
const createMessageHandlers = require('./handlers/messageHandlers');
const createPresenceHandlers = require('./handlers/presenceHandlers');
const logger = require('../utils/logger');

/**
 * Initialize Socket.io server and attach to HTTP server
 *
 * @param {Object} httpServer - HTTP server instance to attach to
 * @returns {Object} Configured Socket.io server instance
 */
function initializeSocketServer(httpServer) {
  // Create Socket.io server with CORS configuration and custom path
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    path: '/ws', // Set WebSocket endpoint to /ws
  });

  // Apply authentication middleware
  io.use(createAuthMiddleware());

  // Connection event
  io.on('connection', (socket) => {
    logger.info(`🔌 Socket connected: ${socket.id} (User: ${socket.user.email})`);

    // Emit connect success event with user data
    socket.emit('connect:success', {
      userId: socket.user.userId,
      userEmail: socket.user.email,
      socketId: socket.id,
      timestamp: new Date().toISOString(),
    });

    // Initialize handlers with dependency injection
    const messageHandlers = createMessageHandlers(io, socket);
    const presenceHandlers = createPresenceHandlers(io, socket);

    // Set up message event handlers
    socket.on('message:send', messageHandlers.handleSendMessage);
    socket.on('user:typing:start', messageHandlers.handleTypingStart);
    socket.on('user:typing:stop', messageHandlers.handleTypingStop);
    socket.on('message:read', messageHandlers.handleMessageRead);

    // Set up presence event handlers
    socket.on('group:join', presenceHandlers.handleJoinGroup);
    socket.on('group:leave', presenceHandlers.handleLeaveGroup);
    socket.on('group:active_users', presenceHandlers.handleGetActiveUsers);

    // Handle disconnection
    socket.on('disconnect', () => {
      logger.info(`🔌 Socket disconnected: ${socket.id}`);
      presenceHandlers.handleDisconnect();
    });
  });

  // Socket.io server error handling
  io.engine.on('connection_error', (err) => {
    logger.error('Socket.io connection error:', { error: err.toString(), stack: err.stack });
  });

  return io;
}

module.exports = {
  initializeSocketServer,
};
