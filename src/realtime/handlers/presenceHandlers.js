/**
 * WebSocket Presence Handlers
 *
 * Handles realtime user presence events using the dependency injection pattern.
 * Manages online status tracking and user activity in groups.
 */

const container = require('../../container');
const logger = require('../../utils/logger');

// Shared store for active users across all instances
// Key: userId, Value: Set of groupIds the user is active in
const globalActiveUsers = new Map();

/**
 * Create presence handlers with injected dependencies
 *
 * @param {Object} io - Socket.io instance
 * @param {Object} socket - Socket instance for the current connection
 * @returns {Object} Presence event handlers
 */
module.exports = function createPresenceHandlers(io, socket) {
  // Get services from the container
  const groupService = container.get('groupService');
  const {
    NotFoundError,
    AuthorizationError,
  } = container.get('errorUtils');

  // Get user ID from socket
  const userId = socket.user?.userId;

  /**
   * Handler for user joining a group room
   */
  const handleJoinGroup = async (data, callback) => {
    try {
      const { groupId } = data;
      const userId = socket.user.userId;

      if (!groupId) {
        return callback({
          success: false,
          message: 'Group ID is required',
          error: 'INVALID_INPUT',
        });
      }

        // Check if user is a member of the group
        try {
          const group = await groupService.getGroupById(groupId);

          // Check if user is a member by checking the members array that contains objects with user field
          const isMember = group.members.some(member => 
            member.user.toString() === userId && 
            member.status === 'active'
          );

          if (!isMember) {
            throw new AuthorizationError(
              'You are not a member of this group',
              'NOT_GROUP_MEMBER',
            );
          }

        // Join the group's socket.io room
        socket.join(`group:${groupId}`);

        // Track user's active groups
        if (!globalActiveUsers.has(userId)) {
          globalActiveUsers.set(userId, new Set());
        }
        globalActiveUsers.get(userId).add(groupId);

        // Broadcast user joined message to the group
        socket.to(`group:${groupId}`).emit('user:active', {
          userId: userId,
          email: socket.user.email,
          groupId: groupId,
          status: 'online',
        });

        // Return success
        callback({
          success: true,
          message: 'Successfully joined group room',
        });
      } catch (error) {
        if (error instanceof NotFoundError) {
          return callback({
            success: false,
            message: 'Group not found',
            error: 'GROUP_NOT_FOUND',
          });
        }

        if (error instanceof AuthorizationError) {
          return callback({
            success: false,
            message: error.message,
            error: error.code,
          });
        }

        throw error;
      }
    } catch (error) {
      logger.error('Error joining group:', { message: error.message, stack: error.stack });
      callback({
        success: false,
        message: 'Failed to join group room',
        error: 'INTERNAL_ERROR',
      });
    }
  };

  /**
   * Handler for user leaving a group room
   */
  const handleLeaveGroup = async (data, callback) => {
    try {
      const { groupId } = data;
      const userId = socket.user.userId;

      if (!groupId) {
        return callback({
          success: false,
          message: 'Group ID is required',
          error: 'INVALID_INPUT',
        });
      }

      // Leave the socket.io room
      socket.leave(`group:${groupId}`);

      // Update tracking of user's active groups
      if (globalActiveUsers.has(userId)) {
        globalActiveUsers.get(userId).delete(groupId);
        if (globalActiveUsers.get(userId).size === 0) {
          globalActiveUsers.delete(userId);
        }
      }

      // Broadcast user left message to the group
      socket.to(`group:${groupId}`).emit('user:inactive', {
        userId: userId,
        email: socket.user.email,
        groupId: groupId,
        status: 'offline',
      });

      // Return success
      callback({
        success: true,
        message: 'Successfully left group room',
      });
    } catch (error) {
      logger.error('Error leaving group:', { message: error.message, stack: error.stack });
      callback({
        success: false,
        message: 'Failed to leave group room',
        error: 'INTERNAL_ERROR',
      });
    }
  };

  /**
   * Handler for getting active users in a group
   */
  const handleGetActiveUsers = async (data, callback) => {
    try {
      const { groupId } = data;
      const userId = socket.user.userId;

      if (!groupId) {
        return callback({
          success: false,
          message: 'Group ID is required',
          error: 'INVALID_INPUT',
        });
      }

      // Check if user is a member of the group
      try {
        const group = await groupService.getGroupById(groupId);

        // Check if user is a member by checking the members array that contains objects with user field
        const isMember = group.members.some(member => 
          member.user.toString() === userId && 
          member.status === 'active'
        );

        if (!isMember) {
          throw new AuthorizationError(
            'You are not a member of this group',
            'NOT_GROUP_MEMBER',
          );
        }

        // Get all sockets in the group room
        const sockets = await io.in(`group:${groupId}`).fetchSockets();

        // Extract user info from each socket
        const activeUsers = sockets.map(s => ({
          userId: s.user.userId,
          email: s.user.email,
          status: 'online',
        }));

        // Return the list of active users
        callback({
          success: true,
          data: activeUsers,
        });
      } catch (error) {
        if (error instanceof NotFoundError) {
          return callback({
            success: false,
            message: 'Group not found',
            error: 'GROUP_NOT_FOUND',
          });
        }

        if (error instanceof AuthorizationError) {
          return callback({
            success: false,
            message: error.message,
            error: error.code,
          });
        }

        throw error;
      }
    } catch (error) {
      logger.error('Error getting active users:', { message: error.message, stack: error.stack });
      callback({
        success: false,
        message: 'Failed to get active users',
        error: 'INTERNAL_ERROR',
      });
    }
  };

  /**
   * Handler for disconnection
   */
  const handleDisconnect = () => {
    const userId = socket.user?.userId;

    if (userId && globalActiveUsers.has(userId)) {
      // Get all groups the user was active in
      const groups = Array.from(globalActiveUsers.get(userId));

      // Notify each group that the user is offline
      groups.forEach(groupId => {
        socket.to(`group:${groupId}`).emit('user:inactive', {
          userId: userId,
          email: socket.user.email,
          groupId: groupId,
          status: 'offline',
        });
      });

      // Clean up tracking
      globalActiveUsers.delete(userId);
    }
  };

  // Return handlers
  return {
    handleJoinGroup,
    handleLeaveGroup,
    handleGetActiveUsers,
    handleDisconnect,
  };
};
