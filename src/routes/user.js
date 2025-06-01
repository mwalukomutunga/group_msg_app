const express = require('express');
const rateLimit = require('express-rate-limit');
const { protect: authenticateToken } = require('../middleware/auth');
const {
  getCurrentUser,
  updateUser,
  getUserStats,
  changePassword,
  deleteUser,
} = require('../controllers/userController');

const router = express.Router();

// Rate limiting for user operations
const userLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 requests per 15 minutes per user
  message: {
    success: false,
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests. Try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
});

/**
 * @swagger
 * /api/v1/users/profile:
 *   get:
 *     summary: Get current user profile
 *     description: |
 *       Retrieve the current authenticated user's profile information.
 *       Requires valid JWT token in Authorization header.
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: "Profile retrieved successfully"
 *               data:
 *                 user:
 *                   _id: "507f1f77bcf86cd799439011"
 *                   email: "john.doe@example.com"
 *                   createdAt: "2024-01-01T12:00:00.000Z"
 *                   updatedAt: "2024-01-01T12:00:00.000Z"
 *                 tokenInfo:
 *                   issuedAt: "2024-01-01T12:00:00.000Z"
 *                   expiresAt: "2024-01-02T12:00:00.000Z"
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
router.get('/profile', authenticateToken, userLimiter, getCurrentUser);

/**
 * @swagger
 * /api/v1/users/profile:
 *   put:
 *     summary: Update user profile
 *     description: |
 *       Update the current authenticated user's profile information.
 *       Currently supports updating email address.
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: New email address
 *                 example: "newemail@example.com"
 *           examples:
 *             updateEmail:
 *               summary: Update email address
 *               value:
 *                 email: "newemail@example.com"
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: "Profile updated successfully"
 *               data:
 *                 user:
 *                   _id: "507f1f77bcf86cd799439011"
 *                   email: "newemail@example.com"
 *                   createdAt: "2024-01-01T12:00:00.000Z"
 *                   updatedAt: "2024-01-01T12:30:00.000Z"
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       409:
 *         description: Email already in use
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Email already in use"
 *               error: "DUPLICATE_EMAIL"
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.put('/profile', authenticateToken, userLimiter, updateUser);

/**
 * @swagger
 * /api/v1/users/stats:
 *   get:
 *     summary: Get user account statistics
 *     description: |
 *       Retrieve statistics and information about the current user's account,
 *       including account age, last login, and other relevant metrics.
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: User statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: "User statistics retrieved successfully"
 *               data:
 *                 stats:
 *                   accountCreated: "2024-01-01T12:00:00.000Z"
 *                   accountAgeInDays: 30
 *                   lastLogin: "2024-01-31T12:00:00.000Z"
 *                   profileCompleteness: 100
 *                 user:
 *                   id: "507f1f77bcf86cd799439011"
 *                   email: "john.doe@example.com"
 *                   createdAt: "2024-01-01T12:00:00.000Z"
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
router.get('/stats', authenticateToken, userLimiter, getUserStats);

/**
 * @swagger
 * /api/v1/users/password:
 *   put:
 *     summary: Change user password
 *     description: |
 *       Change the current user's password by providing the current password
 *       and a new password that meets security requirements.
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 description: Current password for verification
 *                 example: "OldPassword123"
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *                 description: New password (min 8 chars, must contain uppercase, lowercase, and number)
 *                 example: "NewSecurePassword456"
 *           examples:
 *             changePassword:
 *               summary: Change password
 *               value:
 *                 currentPassword: "OldPassword123"
 *                 newPassword: "NewSecurePassword456"
 *     responses:
 *       200:
 *         description: Password changed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: "Password changed successfully"
 *               data:
 *                 changedAt: "2024-01-01T12:30:00.000Z"
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         description: Invalid current password or authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               incorrectPassword:
 *                 summary: Incorrect current password
 *                 value:
 *                   success: false
 *                   message: "Current password is incorrect"
 *                   error: "INVALID_PASSWORD"
 *               unauthorized:
 *                 summary: No authentication token
 *                 value:
 *                   success: false
 *                   message: "No token provided"
 *                   error: "NO_TOKEN_PROVIDED"
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.put('/password', authenticateToken, userLimiter, changePassword);

/**
 * @swagger
 * /api/v1/users/account:
 *   delete:
 *     summary: Delete user account
 *     description: |
 *       Permanently delete the current user's account and all associated data.
 *       This action cannot be undone. Requires password confirmation.
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               password:
 *                 type: string
 *                 description: Current password for account deletion confirmation
 *                 example: "MyPassword123"
 *           examples:
 *             deleteAccount:
 *               summary: Delete account with password confirmation
 *               value:
 *                 password: "MyPassword123"
 *     responses:
 *       200:
 *         description: Account deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: "Account deleted successfully"
 *               data:
 *                 deletedAt: "2024-01-01T12:30:00.000Z"
 *                 userId: "507f1f77bcf86cd799439011"
 *       400:
 *         description: Missing password
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Password is required for account deletion"
 *               error: "MISSING_PASSWORD"
 *       401:
 *         description: Incorrect password or authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               incorrectPassword:
 *                 summary: Incorrect password
 *                 value:
 *                   success: false
 *                   message: "Incorrect password"
 *                   error: "INVALID_PASSWORD"
 *               unauthorized:
 *                 summary: No authentication token
 *                 value:
 *                   success: false
 *                   message: "No token provided"
 *                   error: "NO_TOKEN_PROVIDED"
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete('/account', authenticateToken, userLimiter, deleteUser);

// Handle unknown user endpoints - this runs BEFORE auth for 404s
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'ENDPOINT_NOT_FOUND',
    message: `Endpoint ${req.method} ${req.originalUrl} not found`,
    availableEndpoints: [
      'GET /api/v1/users/profile - Get user profile',
      'PUT /api/v1/users/profile - Update user profile',
      'GET /api/v1/users/stats - Get user statistics',
      'PUT /api/v1/users/password - Change password',
      'DELETE /api/v1/users/account - Delete account',
    ],
  });
});

module.exports = router;
