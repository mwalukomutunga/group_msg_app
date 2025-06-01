const express = require('express');
const rateLimit = require('express-rate-limit');
const { protect: authenticateToken } = require('../middleware/auth');
const {
  createGroup,
  getGroups,
  getGroupById: getGroup,
  addMember: joinGroup,
  removeMember: leaveGroup,
} = require('../controllers/groupController');

const router = express.Router();

// Rate limiting for group operations
const groupCreateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 groups per hour per user
  message: {
    success: false,
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many groups created. Try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const groupJoinLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 join attempts per 15 minutes
  message: {
    success: false,
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many join attempts. Try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * @swagger
 * /api/v1/groups:
 *   post:
 *     summary: Create a new group
 *     description: |
 *       Create a new messaging group. The authenticated user becomes the group creator
 *       and is automatically added as the first member.
 *
 *       **Rate Limit:** 10 groups per hour per user
 *     tags: [Groups]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateGroupRequest'
 *           examples:
 *             basicGroup:
 *               summary: Create a basic group
 *               value:
 *                 name: "Development Team"
 *                 description: "Discussion group for development team members"
 *             minimalGroup:
 *               summary: Group with name only
 *               value:
 *                 name: "Quick Chat"
 *     responses:
 *       201:
 *         description: Group created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: "Group created successfully"
 *               data:
 *                 group:
 *                   _id: "507f1f77bcf86cd799439012"
 *                   name: "Development Team"
 *                   description: "Discussion group for development team members"
 *                   creator: "507f1f77bcf86cd799439011"
 *                   members: ["507f1f77bcf86cd799439011"]
 *                   createdAt: "2024-01-01T12:00:00.000Z"
 *                   updatedAt: "2024-01-01T12:00:00.000Z"
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/', authenticateToken, groupCreateLimit, createGroup);

/**
 * @swagger
 * /api/v1/groups:
 *   get:
 *     summary: Get user's groups
 *     description: |
 *       Retrieve all groups that the authenticated user is a member of.
 *       Returns group information including member count and recent activity.
 *     tags: [Groups]
 *     security:
 *       - BearerAuth: []
 *     parameters:
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
 *           maximum: 50
 *           default: 20
 *         description: Number of groups per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search groups by name or description
 *     responses:
 *       200:
 *         description: Groups retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: "Groups retrieved successfully"
 *               data:
 *                 groups:
 *                   - _id: "507f1f77bcf86cd799439012"
 *                     name: "Development Team"
 *                     description: "Discussion group for development team members"
 *                     creator: "507f1f77bcf86cd799439011"
 *                     members: ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439013"]
 *                     memberCount: 2
 *                     createdAt: "2024-01-01T12:00:00.000Z"
 *                     updatedAt: "2024-01-01T12:00:00.000Z"
 *                 pagination:
 *                   page: 1
 *                   limit: 20
 *                   total: 5
 *                   pages: 1
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/', authenticateToken, getGroups);

/**
 * @swagger
 * /api/v1/groups/{groupId}:
 *   get:
 *     summary: Get group details
 *     description: |
 *       Retrieve detailed information about a specific group.
 *       Only accessible to group members.
 *     tags: [Groups]
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
 *     responses:
 *       200:
 *         description: Group details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: "Group details retrieved successfully"
 *               data:
 *                 group:
 *                   _id: "507f1f77bcf86cd799439012"
 *                   name: "Development Team"
 *                   description: "Discussion group for development team members"
 *                   creator: "507f1f77bcf86cd799439011"
 *                   members: ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439013"]
 *                   memberCount: 2
 *                   createdAt: "2024-01-01T12:00:00.000Z"
 *                   updatedAt: "2024-01-01T12:00:00.000Z"
 *                 userRole: "creator"
 *                 canInvite: true
 *                 canModify: true
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
router.get('/:groupId', authenticateToken, getGroup);

/**
 * @swagger
 * /api/v1/groups/{groupId}/join:
 *   post:
 *     summary: Join a group
 *     description: |
 *       Join an existing group as a member. The user must have access to the group
 *       (through invitation or if the group is public).
 *
 *       **Rate Limit:** 20 join attempts per 15 minutes per user
 *     tags: [Groups]
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
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               inviteCode:
 *                 type: string
 *                 description: Optional invite code for private groups
 *                 example: "ABC123XYZ"
 *           examples:
 *             publicGroup:
 *               summary: Join public group
 *               value: {}
 *             privateGroup:
 *               summary: Join private group with invite code
 *               value:
 *                 inviteCode: "ABC123XYZ"
 *     responses:
 *       200:
 *         description: Successfully joined the group
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: "Successfully joined the group"
 *               data:
 *                 group:
 *                   _id: "507f1f77bcf86cd799439012"
 *                   name: "Development Team"
 *                   memberCount: 3
 *                 joinedAt: "2024-01-01T12:30:00.000Z"
 *       400:
 *         description: Bad request (already a member, invalid invite code, etc.)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               alreadyMember:
 *                 summary: Already a group member
 *                 value:
 *                   success: false
 *                   message: "You are already a member of this group"
 *                   error: "ALREADY_MEMBER"
 *               invalidInvite:
 *                 summary: Invalid invite code
 *                 value:
 *                   success: false
 *                   message: "Invalid or expired invite code"
 *                   error: "INVALID_INVITE_CODE"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
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
router.post('/:groupId/join', authenticateToken, groupJoinLimit, joinGroup);

/**
 * @swagger
 * /api/v1/groups/{groupId}/leave:
 *   delete:
 *     summary: Leave a group
 *     description: |
 *       Leave a group that the user is currently a member of.
 *       Group creators cannot leave their own groups unless they transfer ownership first.
 *     tags: [Groups]
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
 *     responses:
 *       200:
 *         description: Successfully left the group
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: "Successfully left the group"
 *               data:
 *                 group:
 *                   _id: "507f1f77bcf86cd799439012"
 *                   name: "Development Team"
 *                   memberCount: 2
 *                 leftAt: "2024-01-01T12:30:00.000Z"
 *       400:
 *         description: Bad request (not a member, creator trying to leave, etc.)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               notMember:
 *                 summary: Not a group member
 *                 value:
 *                   success: false
 *                   message: "You are not a member of this group"
 *                   error: "NOT_MEMBER"
 *               creatorLeaving:
 *                 summary: Creator cannot leave
 *                 value:
 *                   success: false
 *                   message: "Group creators cannot leave. Transfer ownership first."
 *                   error: "CREATOR_CANNOT_LEAVE"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete('/:groupId/leave', authenticateToken, leaveGroup);

// Handle unknown group endpoints - this runs BEFORE auth for 404s
router.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'ENDPOINT_NOT_FOUND',
    message: `Endpoint ${req.method} ${req.originalUrl} not found`,
    availableEndpoints: [
      'POST /api/v1/groups - Create a new group',
      'GET /api/v1/groups - List groups',
      'GET /api/v1/groups/:id - Get group details',
      'POST /api/v1/groups/:id/join - Join a group',
      'DELETE /api/v1/groups/:id/leave - Leave a group',
    ],
  });
});

module.exports = router;
