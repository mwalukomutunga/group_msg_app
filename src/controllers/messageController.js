/**
 * Message Controller
 *
 * Handles HTTP requests for message endpoints,
 * delegating business logic to the message service.
 */

const container = require('../container');
const messageService = container.get('messageService');
const asyncErrorHandler = container.get('asyncErrorHandler');

/**
 * Send a message to a group
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const sendMessage = asyncErrorHandler(async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.userId;
    const { content } = req.body;

    const message = await messageService.sendMessage(userId, groupId, content);

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: message,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get messages for a group
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const getGroupMessages = asyncErrorHandler(async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;

    const result = await messageService.getGroupMessages(userId, groupId, { page, limit });

    res.status(200).json({
      success: true,
      message: 'Messages retrieved successfully',
      data: result.messages,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Delete a message
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const deleteMessage = asyncErrorHandler(async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.userId;

    await messageService.deleteMessage(userId, messageId);

    res.status(200).json({
      success: true,
      message: 'Message deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Update a message
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const updateMessage = asyncErrorHandler(async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.userId;
    const { content } = req.body;

    const updatedMessage = await messageService.updateMessage(userId, messageId, content);

    res.status(200).json({
      success: true,
      message: 'Message updated successfully',
      data: updatedMessage,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Search messages in a group
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const searchMessages = asyncErrorHandler(async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.userId;
    const { query } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required',
        error: 'INVALID_SEARCH',
      });
    }

    const result = await messageService.searchMessages(userId, groupId, query, { page, limit });

    res.status(200).json({
      success: true,
      message: 'Search completed successfully',
      data: result.messages,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get a single message by ID
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const getMessage = asyncErrorHandler(async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.userId;

    const message = await messageService.getMessage(userId, messageId);

    res.status(200).json({
      success: true,
      message: 'Message retrieved successfully',
      data: message,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = {
  sendMessage,
  getGroupMessages,
  deleteMessage,
  updateMessage,
  searchMessages,
  getMessage,
};
