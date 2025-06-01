const express = require('express');
const rateLimit = require('express-rate-limit');
const { register, login } = require('../controllers/authController');
const { createValidationMiddleware, registerSchema, loginSchema } = require('../utils/validation');

const router = express.Router();

/**
 * Authentication Routes
 * Handles user registration, login, and related authentication endpoints
 */

/**
 * Rate limiting configurations for authentication endpoints
 * More restrictive limits for security-sensitive operations
 */

// Registration rate limiting: 5 attempts per hour per IP
const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Maximum 5 registration attempts per hour per IP
  message: {
    success: false,
    message: 'Too many registration attempts. Please try again later.',
    error: 'RATE_LIMIT_EXCEEDED',
    retryAfter: '1 hour',
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many registration attempts from this IP. Please try again later.',
      error: 'RATE_LIMIT_EXCEEDED',
      retryAfter: '1 hour',
    });
  },
});

// Login rate limiting: 10 attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Maximum 10 login attempts per 15 minutes per IP
  message: {
    success: false,
    message: 'Too many login attempts. Please try again later.',
    error: 'RATE_LIMIT_EXCEEDED',
    retryAfter: '15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many login attempts from this IP. Please try again later.',
      error: 'RATE_LIMIT_EXCEEDED',
      retryAfter: '15 minutes',
    });
  },
});

// General authentication rate limiting: 20 requests per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Maximum 20 requests per 15 minutes per IP
  message: {
    success: false,
    message: 'Too many authentication requests. Please try again later.',
    error: 'RATE_LIMIT_EXCEEDED',
    retryAfter: '15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many authentication requests from this IP. Please try again later.',
      error: 'RATE_LIMIT_EXCEEDED',
      retryAfter: '15 minutes',
    });
  },
});

/**
 * Validation middleware instances
 */
const validateRegistration = createValidationMiddleware(registerSchema);
const validateLogin = createValidationMiddleware(loginSchema);

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     summary: Register a new user account
 *     description: |
 *       Create a new user account with email and password.
 *       Returns user information and JWT token upon successful registration.
 *
 *       **Rate Limit:** 5 attempts per hour per IP address
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *           examples:
 *             validRegistration:
 *               summary: Valid registration
 *               value:
 *                 email: "john.doe@example.com"
 *                 password: "SecurePassword123"
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *             example:
 *               success: true
 *               message: "User registered successfully"
 *               data:
 *                 user:
 *                   _id: "507f1f77bcf86cd799439011"
 *                   email: "john.doe@example.com"
 *                   createdAt: "2024-01-01T12:00:00.000Z"
 *                   updatedAt: "2024-01-01T12:00:00.000Z"
 *                 token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                 tokenExpiry: "24h"
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       409:
 *         description: Email already registered
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Email already registered"
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
router.post('/register',
  registrationLimiter,    // Apply registration-specific rate limiting
  validateRegistration,   // Validate request body
  register,               // Handle registration logic
);

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: User login
 *     description: |
 *       Authenticate user with email and password.
 *       Returns user information and JWT token upon successful login.
 *
 *       **Rate Limit:** 10 attempts per 15 minutes per IP address
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *           examples:
 *             validLogin:
 *               summary: Valid login credentials
 *               value:
 *                 email: "john.doe@example.com"
 *                 password: "SecurePassword123"
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *             example:
 *               success: true
 *               message: "Login successful"
 *               data:
 *                 user:
 *                   _id: "507f1f77bcf86cd799439011"
 *                   email: "john.doe@example.com"
 *                   createdAt: "2024-01-01T12:00:00.000Z"
 *                   updatedAt: "2024-01-01T12:00:00.000Z"
 *                 token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                 tokenExpiry: "24h"
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Invalid email or password"
 *               error: "INVALID_CREDENTIALS"
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/login',
  loginLimiter,          // Apply login-specific rate limiting
  validateLogin,         // Validate request body
  login,                 // Handle login logic
);

/**
 * Error handling middleware for auth routes
 * Catches any errors that weren't handled by individual route handlers
 */
router.use((error, req, res, next) => {
  console.error('Auth route error:', error);

  // Don't send error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';

  res.status(500).json({
    success: false,
    message: 'Authentication service error',
    error: 'INTERNAL_SERVER_ERROR',
    ...(isDevelopment && { details: error.message }),
  });
});

/**
 * 404 handler for auth routes
 * Handles requests to non-existent auth endpoints
 */
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Authentication endpoint not found',
    error: 'ENDPOINT_NOT_FOUND',
    availableEndpoints: [
      'POST /api/v1/auth/register',
      'POST /api/v1/auth/login',
    ],
  });
});

module.exports = router;
