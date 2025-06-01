/**
 * WebSocket Message Handlers
 *
 * Handles realtime message events using the dependency injection pattern.
 * Delegates business logic to services.
 */

const container = require('../../container');
const logger = require('../../utils/logger');

/**
 * Create message handlers with injected dependencies
 *
 * @param {Object} io - Socket.io instance
 * @param {Object} socket - Socket instance for the current connection
 * @returns {Object} Message event handlers
 */
module.exports = function createMessageHandlers(io, socket) {
  // Get services from the container
  const messageService = container.get('messageService');
  const {
    NotFoundError,
    ValidationError,
    AuthorizationError,
  } = container.get('errorUtils');

  /**
   * Handler for sending messages
   */
  const handleSendMessage = async (data, callback) => {
    try {
      const { groupId, content } = data;
      const userId = socket.user.userId;

      if (!groupId || !content) {
        return callback({
          success: false,
          message: 'Group ID and message content are required',
          error: 'INVALID_INPUT',
        });
      }

      // Check group membership before sending message
      try {
        // First get the group to check membership
        const group = await container.get('groupService').getGroupById(groupId);
        
        // Check if user is a member
        const isMember = group.members.some(member => 
          member.user.toString() === userId && 
          member.status === 'active'
        );
        
        if (!isMember) {
          return callback({
            success: false,
            message: 'You are not a member of this group',
            error: 'NOT_GROUP_MEMBER',
          });
        }
        
        // User is a member, proceed with sending the message
        const message = await messageService.sendMessage(userId, groupId, content);

        // Emit the message to the group room
        socket.to(`group:${groupId}`).emit('message:new', {
          success: true,
          data: message,
        });

        // Return success to the sender
        callback({
          success: true,
          message: 'Message sent successfully',
          data: message,
        });
      } catch (error) {
        if (error instanceof NotFoundError) {
          return callback({
            success: false,
            message: 'Group not found',
            error: 'GROUP_NOT_FOUND',
          });
        }
        throw error;
      }
    } catch (error) {
      handleError(error, 'Error sending message', callback);
    }
  };

  /**
   * Handler for typing indicators
   */
  const handleTypingStart = (data) => {
    try {
      const { groupId } = data;
      const userId = socket.user.userId;
      const userEmail = socket.user.email;

      if (!groupId) {
        return;
      }

      // Broadcast typing status to the group room (except sender)
      socket.to(`group:${groupId}`).emit('user:typing', {
        userId,
        userEmail,
        groupId,
        typing: true,
      });
    } catch (error) {
      logger.error('Error handling typing indicator:', { message: error.message, stack: error.stack });
    }
  };

  /**
   * Handler for typing stopped indicators
   */
  const handleTypingStop = (data) => {
    try {
      const { groupId } = data;
      const userId = socket.user.userId;
      const userEmail = socket.user.email;

      if (!groupId) {
        return;
      }

      // Broadcast typing stopped status to the group room (except sender)
      socket.to(`group:${groupId}`).emit('user:typing', {
        userId,
        userEmail,
        groupId,
        typing: false,
      });
    } catch (error) {
      logger.error('Error handling typing stop indicator:', { message: error.message, stack: error.stack });
    }
  };

  /**
   * Handler for message read receipts
   */
  const handleMessageRead = async (data, callback) => {
    try {
      const { messageId, groupId } = data;
      const userId = socket.user.userId;

      if (!messageId || !groupId) {
        return callback({
          success: false,
          message: 'Message ID and group ID are required',
          error: 'INVALID_INPUT',
        });
      }

      // Here you could update a read receipts collection in the database
      // For now we just broadcast that the message was read

      // Broadcast read receipt to the group room (including sender)
      io.in(`group:${groupId}`).emit('message:read', {
        messageId,
        readBy: {
          userId,
          email: socket.user.email,
          timestamp: new Date().toISOString(),
        },
      });

      callback({
        success: true,
      });
    } catch (error) {
      handleError(error, 'Error processing read receipt', callback);
    }
  };

  /**
   * Handle errors and provide appropriate response for WebSocket callbacks
   *
   * @param {Error} error - The error that occurred
   * @param {string} defaultMessage - Default error message
   * @param {Function} callback - Socket.io callback function
   */
  const handleError = (error, defaultMessage, callback) => {
    logger.error(`${defaultMessage}:`, { message: error.message, stack: error.stack });

    if (error instanceof NotFoundError) {
      return callback({
        success: false,
        message: error.message,
        error: error.code,
      });
    }

    if (error instanceof ValidationError) {
      return callback({
        success: false,
        message: error.message,
        error: error.code,
        details: error.details,
      });
    }

    if (error instanceof AuthorizationError) {
      return callback({
        success: false,
        message: error.message,
        error: error.code,
      });
    }

    callback({
      success: false,
      message: defaultMessage || 'An error occurred',
      error: 'INTERNAL_ERROR',
    });
  };

  // Return handlers
  return {
    handleSendMessage,
    handleTypingStart,
    handleTypingStop,
    handleMessageRead,
  };
};
