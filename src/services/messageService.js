/**
 * Message Service
 *
 * Handles all business logic related to messages,
 * including sending, retrieving, and encryption/decryption.
 */

const logger = require('../utils/logger');

/**
 * Create the message service with injected dependencies
 *
 * @param {Object} container - The dependency injection container
 * @returns {Object} The message service methods
 */
module.exports = function(container) {

  const Message = container.get('messageModel');
  const Group = container.get('groupModel');
  const encryptionUtils = container.get('encryptionUtils');
  const {
    NotFoundError,
    ValidationError,
    AuthorizationError,
    InternalError,
  } = container.get('errorUtils');

  /**
   * Send a message to a group
   *
   * @param {string} userId - ID of the sender
   * @param {string} groupId - ID of the group to send to
   * @param {string} content - Message content (plain text)
   * @returns {Object} The sent message
   * @throws {NotFoundError} If group doesn't exist
   * @throws {AuthorizationError} If user is not a member of the group
   * @throws {ValidationError} If validation fails
   * @throws {InternalError} If there's a database error
   */
  async function sendMessage(userId, groupId, content) {
    try {

      const group = await Group.findById(groupId);

      if (!group) {
        throw new NotFoundError('Group not found', 'GROUP_NOT_FOUND');
      }

      if (!group.isMember(userId)) {
        throw new AuthorizationError(
          'Only group members can send messages to the group',
          'NOT_GROUP_MEMBER',
        );
      }


      if (!content || content.trim().length === 0) {
        throw new ValidationError('Message content cannot be empty', 'EMPTY_MESSAGE');
      }


      const encryptionResult = encryptionUtils.encryptMessage(content);

      // Create and save the message
      const message = new Message({
        group: groupId,
        sender: userId,
        content: content,
        encryptedContent: encryptionResult.encryptedContent,
        encryption: {
          iv: encryptionResult.iv,
          algorithm: encryptionResult.algorithm,
          keyVersion: encryptionResult.keyVersion
        },
        timestamp: new Date(),
      });

      const savedMessage = await message.save();

      // Return the message with decrypted content
      const messageObj = savedMessage.toObject();
      messageObj.content = content; // Add the decrypted content for the response

      return messageObj;
    } catch (error) {
      if (
        error instanceof NotFoundError ||
        error instanceof AuthorizationError ||
        error instanceof ValidationError
      ) {
        throw error;
      }

      // Enhanced error logging with more context
      logger.error('Error sending message:', { 
        message: error.message, 
        stack: error.stack,
        userId,
        groupId,
        errorName: error.name,
        errorCode: error.code || 'UNKNOWN'
      });
      
      // More specific error codes based on error type
      if (error.name === 'MongoError' || error.name === 'MongooseError') {
        throw new InternalError(`Database error: ${error.message}`, 'DATABASE_ERROR', { originalError: error });
      } else if (error.name === 'EncryptionError') {
        throw new InternalError(`Encryption error: ${error.message}`, 'ENCRYPTION_ERROR', { originalError: error });
      } else {
        throw new InternalError(`Message service error: ${error.message}`, 'INTERNAL_ERROR', { originalError: error });
      }
    }
  }

  /**
   * Get messages for a group (with pagination)
   *
   * @param {string} userId - ID of the requesting user
   * @param {string} groupId - ID of the group
   * @param {Object} options - Query options
   * @param {number} options.page - Page number (1-based)
   * @param {number} options.limit - Number of items per page
   * @returns {Object} Paginated messages with decrypted content
   * @throws {NotFoundError} If group doesn't exist
   * @throws {AuthorizationError} If user is not a member of the group
   * @throws {InternalError} If there's a database error
   */
  async function getGroupMessages(userId, groupId, { page = 1, limit = 50 } = {}) {
    try {
      // Check if group exists and user is a member
      const group = await Group.findById(groupId);

      if (!group) {
        throw new NotFoundError('Group not found', 'GROUP_NOT_FOUND');
      }

      if (!group.isMember(userId)) {
        throw new AuthorizationError(
          'Only group members can view messages',
          'NOT_GROUP_MEMBER',
        );
      }

      // Calculate skip for pagination
      const skip = (page - 1) * limit;

      // Fetch messages with pagination, ordered by timestamp (newest to oldest)
      const messages = await Message.find({ group: groupId })
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .populate('sender', 'email'); // Include sender info

      const total = await Message.countDocuments({ group: groupId });

      // Decrypt the messages
      const decryptedMessages = messages.map(message => {
        const messageObj = message.toObject();
        try {
          messageObj.content = encryptionUtils.decryptMessage(messageObj.encryptedContent, messageObj.encryption.iv, messageObj.encryption.algorithm);
          delete messageObj.encryptedContent; // Remove encrypted version from response
        } catch (error) {
          logger.error(`Error decrypting message ${message._id}:`, { message: error.message, messageId: message._id });
          messageObj.content = '[Encryption error: Unable to decrypt message]';
        }
        return messageObj;
      });

      return {
        messages: decryptedMessages,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      if (
        error instanceof NotFoundError ||
        error instanceof AuthorizationError
      ) {
        throw error;
      }

      // Enhanced error logging with more context
      logger.error('Error retrieving messages:', { 
        message: error.message, 
        stack: error.stack,
        userId,
        groupId,
        errorName: error.name,
        errorCode: error.code || 'UNKNOWN'
      });
      
      // More specific error codes based on error type
      if (error.name === 'MongoError' || error.name === 'MongooseError') {
        throw new InternalError(`Database error: ${error.message}`, 'DATABASE_ERROR', { originalError: error });
      } else if (error.name === 'EncryptionError') {
        throw new InternalError(`Encryption error: ${error.message}`, 'ENCRYPTION_ERROR', { originalError: error });
      } else {
        throw new InternalError(`Message service error: ${error.message}`, 'INTERNAL_ERROR', { originalError: error });
      }
    }
  }

  /**
   * Delete a message
   *
   * @param {string} userId - ID of the requesting user
   * @param {string} messageId - ID of the message to delete
   * @returns {Object} Confirmation of deletion
   * @throws {NotFoundError} If message doesn't exist
   * @throws {AuthorizationError} If user is not the sender or group owner
   * @throws {InternalError} If there's a database error
   */
  async function deleteMessage(userId, messageId) {
    try {
      // Find the message and populate group info
      const message = await Message.findById(messageId);

      if (!message) {
        throw new NotFoundError('Message not found', 'MESSAGE_NOT_FOUND');
      }

      // Check authorization (must be sender or group owner)
      const isSender = message.sender.toString() === userId;

      if (!isSender) {
        // Check if user is group owner
        const group = await Group.findById(message.group);
        if (!group || group.ownerId.toString() !== userId) {
          throw new AuthorizationError(
            'Only the message sender or group owner can delete a message',
            'DELETE_UNAUTHORIZED',
          );
        }
      }

      // Delete the message
      await Message.findByIdAndDelete(messageId);

      return { success: true, message: 'Message deleted successfully' };
    } catch (error) {
      if (
        error instanceof NotFoundError ||
        error instanceof AuthorizationError
      ) {
        throw error;
      }

      // Enhanced error logging with more context
      logger.error('Error deleting message:', { 
        message: error.message, 
        stack: error.stack,
        userId,
        messageId,
        errorName: error.name,
        errorCode: error.code || 'UNKNOWN'
      });
      
      // More specific error codes based on error type
      if (error.name === 'MongoError' || error.name === 'MongooseError') {
        throw new InternalError(`Database error: ${error.message}`, 'DATABASE_ERROR', { originalError: error });
      } else {
        throw new InternalError(`Message service error: ${error.message}`, 'INTERNAL_ERROR', { originalError: error });
      }
    }
  }

  /**
   * Update a message
   *
   * @param {string} userId - ID of the requesting user
   * @param {string} messageId - ID of the message to update
   * @param {string} content - New message content
   * @returns {Object} The updated message
   * @throws {NotFoundError} If message doesn't exist
   * @throws {AuthorizationError} If user is not the sender
   * @throws {ValidationError} If validation fails
   * @throws {InternalError} If there's a database error
   */
  async function updateMessage(userId, messageId, content) {
    try {
      // Find the message
      const message = await Message.findById(messageId);

      if (!message) {
        throw new NotFoundError('Message not found', 'MESSAGE_NOT_FOUND');
      }

      // Check authorization (must be sender)
      if (message.sender.toString() !== userId) {
        throw new AuthorizationError(
          'Only the message sender can update a message',
          'UPDATE_UNAUTHORIZED',
        );
      }

      // Validate content
      if (!content || content.trim().length === 0) {
        throw new ValidationError('Message content cannot be empty', 'EMPTY_MESSAGE');
      }

      // Encrypt the message content
      const encryptionResult = encryptionUtils.encryptMessage(content);

      // Update the message
      message.encryptedContent = encryptionResult.encryptedContent;
      message.encryption = {
        iv: encryptionResult.iv,
        algorithm: encryptionResult.algorithm,
        keyVersion: encryptionResult.keyVersion
      };
      message.updatedAt = new Date();

      const updatedMessage = await message.save();

      // Return the message with decrypted content
      const messageObj = updatedMessage.toObject();
      messageObj.content = content; // Add the decrypted content for the response

      return messageObj;
    } catch (error) {
      if (
        error instanceof NotFoundError ||
        error instanceof AuthorizationError ||
        error instanceof ValidationError
      ) {
        throw error;
      }

      // Enhanced error logging with more context
      logger.error('Error updating message:', { 
        message: error.message, 
        stack: error.stack,
        userId,
        messageId,
        errorName: error.name,
        errorCode: error.code || 'UNKNOWN'
      });
      
      // More specific error codes based on error type
      if (error.name === 'MongoError' || error.name === 'MongooseError') {
        throw new InternalError(`Database error: ${error.message}`, 'DATABASE_ERROR', { originalError: error });
      } else if (error.name === 'EncryptionError') {
        throw new InternalError(`Encryption error: ${error.message}`, 'ENCRYPTION_ERROR', { originalError: error });
      } else {
        throw new InternalError(`Message service error: ${error.message}`, 'INTERNAL_ERROR', { originalError: error });
      }
    }
  }

  /**
   * Search for messages in a group
   *
   * @param {string} userId - ID of the requesting user
   * @param {string} groupId - ID of the group
   * @param {string} searchQuery - Text to search for
   * @param {Object} options - Query options
   * @returns {Object} Matching messages with decrypted content
   */
  async function searchMessages(userId, groupId, searchQuery, { page = 1, limit = 20 } = {}) {
    try {
      // Check if group exists and user is a member
      const group = await Group.findById(groupId);

      if (!group) {
        throw new NotFoundError('Group not found', 'GROUP_NOT_FOUND');
      }

      if (!group.isMember(userId)) {
        throw new AuthorizationError(
          'Only group members can search messages',
          'NOT_GROUP_MEMBER',
        );
      }

      // Since message content is encrypted, we need to:
      // 1. Get all messages for the group
      // 2. Decrypt them
      // 3. Filter by search query
      // 4. Apply pagination manually

      // Get all messages for the group
      const allMessages = await Message.find({ group: groupId })
        .sort({ timestamp: -1 })
        .populate('sender', 'email');

      // Decrypt and filter messages
      const matchingMessages = [];

      for (const message of allMessages) {
        try {
          const decryptedContent = encryptionUtils.decryptMessage(
            message.encryptedContent, 
            message.encryption.iv,
            message.encryption.algorithm
          );
          // Check if decrypted content contains search query (case insensitive)
          if (decryptedContent.toLowerCase().includes(searchQuery.toLowerCase())) {
            const messageObj = message.toObject();
            messageObj.content = decryptedContent;
            delete messageObj.encryptedContent;
            matchingMessages.push(messageObj);
          }
        } catch (error) {
          logger.error(`Error decrypting message ${message._id} during search:`, { message: error.message, messageId: message._id });
          // Skip messages that can't be decrypted
          continue;
        }
      }

      // Apply manual pagination
      const skip = (page - 1) * limit;
      const paginatedMessages = matchingMessages.slice(skip, skip + limit);

      return {
        messages: paginatedMessages,
        pagination: {
          total: matchingMessages.length,
          page,
          limit,
          pages: Math.ceil(matchingMessages.length / limit),
        },
      };
    } catch (error) {
      if (
        error instanceof NotFoundError ||
        error instanceof AuthorizationError
      ) {
        throw error;
      }

      // Enhanced error logging with more context
      logger.error('Error searching messages:', { 
        message: error.message, 
        stack: error.stack,
        userId,
        groupId,
        searchQuery,
        errorName: error.name,
        errorCode: error.code || 'UNKNOWN'
      });
      
      // More specific error codes based on error type
      if (error.name === 'MongoError' || error.name === 'MongooseError') {
        throw new InternalError(`Database error: ${error.message}`, 'DATABASE_ERROR', { originalError: error });
      } else if (error.name === 'EncryptionError') {
        throw new InternalError(`Encryption error: ${error.message}`, 'ENCRYPTION_ERROR', { originalError: error });
      } else {
        throw new InternalError(`Search error: ${error.message}`, 'SEARCH_ERROR', { originalError: error });
      }
    }
  }

  /**
   * Get a single message by ID
   *
   * @param {string} userId - ID of the requesting user
   * @param {string} messageId - ID of the message to retrieve
   * @returns {Object} The message with decrypted content
   * @throws {NotFoundError} If message doesn't exist
   * @throws {AuthorizationError} If user is not a member of the group
   * @throws {InternalError} If there's a database error
   */
  async function getMessage(userId, messageId) {
    try {
      // Find the message
      const message = await Message.findById(messageId);

      if (!message) {
        throw new NotFoundError('Message not found', 'MESSAGE_NOT_FOUND');
      }

      // Check if user is a member of the group
      const group = await Group.findById(message.group);

      if (!group) {
        throw new NotFoundError('Group not found', 'GROUP_NOT_FOUND');
      }

      if (!group.isMember(userId)) {
        throw new AuthorizationError(
          'Only group members can view messages',
          'NOT_GROUP_MEMBER',
        );
      }

      // Decrypt the message content
      const messageObj = message.toObject();
      try {
        messageObj.content = encryptionUtils.decryptMessage(
          messageObj.encryptedContent,
          messageObj.encryption.iv,
          messageObj.encryption.algorithm
        );
        delete messageObj.encryptedContent; // Remove encrypted version from response
      } catch (error) {
        logger.error(`Error decrypting message ${message._id}:`, { message: error.message, messageId: message._id });
        messageObj.content = '[Encryption error: Unable to decrypt message]';
      }

      return messageObj;
    } catch (error) {
      if (
        error instanceof NotFoundError ||
        error instanceof AuthorizationError
      ) {
        throw error;
      }

      // Enhanced error logging with more context
      logger.error('Error retrieving message:', { 
        message: error.message, 
        stack: error.stack,
        userId,
        messageId,
        errorName: error.name,
        errorCode: error.code || 'UNKNOWN'
      });
      
      // More specific error codes based on error type
      if (error.name === 'MongoError' || error.name === 'MongooseError') {
        throw new InternalError(`Database error: ${error.message}`, 'DATABASE_ERROR', { originalError: error });
      } else if (error.name === 'EncryptionError') {
        throw new InternalError(`Encryption error: ${error.message}`, 'ENCRYPTION_ERROR', { originalError: error });
      } else {
        throw new InternalError(`Message service error: ${error.message}`, 'INTERNAL_ERROR', { originalError: error });
      }
    }
  }

  // Return the service methods
  return {
    sendMessage,
    getGroupMessages,
    deleteMessage,
    updateMessage,
    searchMessages,
    getMessage,
  };
};
