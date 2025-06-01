const express = require('express');
const rateLimit = require('express-rate-limit');
const { protect: authenticateToken } = require('../middleware/auth');
const {
  sendMessage,
  getGroupMessages: getMessages, // Alias for compatibility
  searchMessages,
  deleteMessage,
  getMessage,
} = require('../controllers/messageController');

const router = express.Router();

// Rate limiting for message operations
const sendMessageLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 messages per minute per user
  message: {
    success: false,
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many messages sent. Please wait before sending another message.',
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
});

const searchMessageLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // 20 searches per 5 minutes per user
  message: {
    success: false,
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many search requests. Please wait before searching again.',
    retryAfter: 300,
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
});

/**
 * @swagger
 * /api/v1/messages/groups/{groupId}/messages:
 *   post:
 *     summary: Send a message to a group
 *     description: |
 *       Send a new message to a specific group. The user must be a member of the group.
 *       Messages are encrypted before storage for security.
 *
 *       **Rate Limit:** 30 messages per minute per user
 *     tags: [Messages]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique group identifier
 *         example: "507f1f77bcf86cd799439012"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SendMessageRequest'
 *           examples:
 *             textMessage:
 *               summary: Send a text message
 *               value:
 *                 content: "Hello everyone! How is the project going?"
 *             shortMessage:
 *               summary: Send a quick message
 *               value:
 *                 content: "👍"
 *     responses:
 *       201:
 *         description: Message sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: "Message sent successfully"
 *               data:
 *                 message:
 *                   _id: "507f1f77bcf86cd799439014"
 *                   content: "Hello everyone! How is the project going?"
 *                   sender: "507f1f77bcf86cd799439011"
 *                   group: "507f1f77bcf86cd799439012"
 *                   timestamp: "2024-01-01T12:00:00.000Z"
 *                   edited: false
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Not a group member
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "You are not a member of this group"
 *               error: "NOT_GROUP_MEMBER"
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/groups/:groupId/messages', authenticateToken, sendMessageLimiter, sendMessage);

/**
 * @swagger
 * /api/v1/messages/groups/{groupId}/messages:
 *   get:
 *     summary: Get messages from a group
 *     description: |
 *       Retrieve messages from a specific group with pagination support.
 *       Messages are decrypted and returned in chronological order.
 *       Only group members can access messages.
 *     tags: [Messages]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique group identifier
 *         example: "507f1f77bcf86cd799439012"
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Number of messages per page
 *       - in: query
 *         name: before
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Get messages before this timestamp
 *         example: "2024-01-01T12:00:00.000Z"
 *       - in: query
 *         name: after
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Get messages after this timestamp
 *         example: "2024-01-01T10:00:00.000Z"
 *     responses:
 *       200:
 *         description: Messages retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: "Messages retrieved successfully"
 *               data:
 *                 messages:
 *                   - _id: "507f1f77bcf86cd799439014"
 *                     content: "Hello everyone!"
 *                     sender: "507f1f77bcf86cd799439011"
 *                     group: "507f1f77bcf86cd799439012"
 *                     timestamp: "2024-01-01T12:00:00.000Z"
 *                     edited: false
 *                   - _id: "507f1f77bcf86cd799439015"
 *                     content: "How is the project going?"
 *                     sender: "507f1f77bcf86cd799439013"
 *                     group: "507f1f77bcf86cd799439012"
 *                     timestamp: "2024-01-01T12:05:00.000Z"
 *                     edited: false
 *                 pagination:
 *                   page: 1
 *                   limit: 50
 *                   total: 25
 *                   pages: 1
 *                   hasNext: false
 *                   hasPrev: false
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/groups/:groupId/messages', authenticateToken, getMessages);

/**
 * @swagger
 * /api/v1/messages/groups/{groupId}/messages/search:
 *   get:
 *     summary: Search messages in a group
 *     description: |
 *       Search for messages within a specific group using text search.
 *       Supports full-text search across message content.
 *
 *       **Rate Limit:** 20 searches per 5 minutes per user
 *     tags: [Messages]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique group identifier
 *         example: "507f1f77bcf86cd799439012"
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 1
 *         description: Search query text
 *         example: "project status"
 *       - in: query
 *         name: sender
 *         schema:
 *           type: string
 *         description: Filter by sender user ID
 *         example: "507f1f77bcf86cd799439011"
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Search messages from this date
 *         example: "2024-01-01T00:00:00.000Z"
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Search messages until this date
 *         example: "2024-01-31T23:59:59.000Z"
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Maximum number of search results
 *     responses:
 *       200:
 *         description: Search completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: "Search completed successfully"
 *               data:
 *                 query: "project status"
 *                 results:
 *                   - _id: "507f1f77bcf86cd799439014"
 *                     content: "What's the current project status?"
 *                     sender: "507f1f77bcf86cd799439011"
 *                     group: "507f1f77bcf86cd799439012"
 *                     timestamp: "2024-01-01T12:00:00.000Z"
 *                     relevanceScore: 0.95
 *                 totalResults: 3
 *                 searchTime: "12ms"
 *       400:
 *         description: Invalid search parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Search query is required"
 *               error: "MISSING_SEARCH_QUERY"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/groups/:groupId/messages/search', authenticateToken, searchMessageLimiter, searchMessages);

/**
 * @swagger
 * /api/v1/messages/messages/{messageId}:
 *   get:
 *     summary: Get a specific message
 *     description: |
 *       Retrieve details of a specific message by its ID.
 *       User must be a member of the group containing the message.
 *     tags: [Messages]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique message identifier
 *         example: "507f1f77bcf86cd799439014"
 *     responses:
 *       200:
 *         description: Message retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: "Message retrieved successfully"
 *               data:
 *                 message:
 *                   _id: "507f1f77bcf86cd799439014"
 *                   content: "Hello everyone! How is the project going?"
 *                   sender: "507f1f77bcf86cd799439011"
 *                   group: "507f1f77bcf86cd799439012"
 *                   timestamp: "2024-01-01T12:00:00.000Z"
 *                   edited: false
 *                   editedAt: null
 *                 context:
 *                   groupName: "Development Team"
 *                   senderEmail: "john.doe@example.com"
 *                   canEdit: true
 *                   canDelete: true
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/messages/:messageId', authenticateToken, getMessage);

/**
 * @swagger
 * /api/v1/messages/messages/{messageId}:
 *   delete:
 *     summary: Delete a message
 *     description: |
 *       Delete a message from a group. Only the message sender or group creator
 *       can delete messages. Deleted messages cannot be recovered.
 *     tags: [Messages]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique message identifier
 *         example: "507f1f77bcf86cd799439014"
 *     responses:
 *       200:
 *         description: Message deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: "Message deleted successfully"
 *               data:
 *                 messageId: "507f1f77bcf86cd799439014"
 *                 deletedAt: "2024-01-01T12:30:00.000Z"
 *                 deletedBy: "507f1f77bcf86cd799439011"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Permission denied (not message sender or group creator)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "You can only delete your own messages or be a group creator"
 *               error: "INSUFFICIENT_PERMISSIONS"
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete('/messages/:messageId', authenticateToken, deleteMessage);

// 404 handler for message routes - this runs BEFORE auth for 404s
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'ENDPOINT_NOT_FOUND',
    message: 'The requested message endpoint was not found',
    availableEndpoints: [
      'POST /api/v1/messages/groups/:groupId/messages - Send a message to a group',
      'GET /api/v1/messages/groups/:groupId/messages - Get messages from a group',
      'GET /api/v1/messages/groups/:groupId/messages/search - Search messages in a group',
      'GET /api/v1/messages/messages/:messageId - Get a specific message',
      'DELETE /api/v1/messages/messages/:messageId - Delete a message',
    ],
  });
});

module.exports = router;
