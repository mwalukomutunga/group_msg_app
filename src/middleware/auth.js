/**
 * Authentication Middleware
 *
 * Verifies JWT tokens and adds user data to request.
 */

const container = require('../container');
const jwtUtils = container.get('jwtUtils');
const { AuthenticationError } = container.get('errorUtils');
const logger = require('../utils/logger');

/**
 * Protect routes that require authentication
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {void}
 */
const protect = async (req, res, next) => {
  try {
    // Get token from headers
    const authHeader = req.header('Authorization');
    
    // Check if Authorization header exists
    if (!authHeader) {
      throw new AuthenticationError('Access token required', 'NO_TOKEN_PROVIDED');
    }
    
    // Check if it's a valid Bearer token format
    if (!authHeader.startsWith('Bearer ') || authHeader === 'Bearer ') {
      throw new AuthenticationError('Invalid token format', 'NO_TOKEN_PROVIDED');
    }
    
    // Extract token
    const token = authHeader.replace('Bearer ', '');
    
    if (!token || token.trim() === '') {
      throw new AuthenticationError('Empty token provided', 'NO_TOKEN_PROVIDED');
    }

    try {
      // Verify token
      const decoded = jwtUtils.verifyToken(token);

      // Add user data to request
      req.user = {
        userId: decoded.userId,
        email: decoded.email,
      };

      next();
    } catch (error) {
      throw new AuthenticationError('Invalid or expired token', 'INVALID_TOKEN');
    }
  } catch (error) {
    // Handle authentication errors
    if (error instanceof AuthenticationError) {
      return res.status(401).json({
        success: false,
        message: error.message,
        error: error.code || error.errorCode || 'AUTHENTICATION_ERROR',
      });
    }

    // Handle unexpected errors
    logger.error('Auth middleware error:', { message: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      message: 'Authentication system error',
      error: 'AUTH_ERROR',
    });
  }
};

/**
 * Optional authentication middleware
 * Verifies JWT token if present but doesn't require it
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {void}
 */
const optional = async (req, res, next) => {
  try {
    // Get token from headers
    const token = req.header('Authorization')?.replace('Bearer ', '');

    // Skip if no token
    if (!token) {
      return next();
    }

    try {
      // Verify token
      const decoded = jwtUtils.verifyToken(token);

      // Add user data to request
      req.user = {
        userId: decoded.userId,
        email: decoded.email,
      };
    } catch (error) {
      // Invalid token - just continue without setting user
      logger.warn('Invalid token provided for optional auth');
    }

    next();
  } catch (error) {
    // Handle unexpected errors
    logger.error('Optional auth middleware error:', { message: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      message: 'Authentication system error',
      error: 'AUTH_ERROR',
    });
  }
};

module.exports = {
  protect,
  optional,
};
