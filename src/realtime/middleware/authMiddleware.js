/**
 * WebSocket Authentication Middleware
 *
 * Verifies JWT tokens in socket.io connections using the dependency
 * injection pattern. Adds user data to socket for authenticated requests.
 */

const container = require('../../container');
const logger = require('../../utils/logger');

/**
 * Create WebSocket authentication middleware using dependency injection
 *
 * @returns {Function} Socket.io middleware function
 */
module.exports = function createAuthMiddleware() {
  const jwtUtils = container.get('jwtUtils');
  const { AuthenticationError } = container.get('errorUtils');

  /**
   * Socket.io authentication middleware
   * Validates the JWT token and sets user data on the socket object
   *
   * @param {Object} socket - Socket.io socket
   * @param {Function} next - Next middleware function
   */
  return (socket, next) => {
    try {
      // Get token from query parameters or auth header
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new AuthenticationError('Authentication error', 'NO_AUTH_TOKEN'));
      }

      try {
        // Verify the token
        const decoded = jwtUtils.verifyToken(token);

        // Attach user data to socket
        socket.user = {
          userId: decoded.userId,
          email: decoded.email,
        };

        // Continue to next middleware
        next();
      } catch (error) {
        // Invalid token
        logger.error('WebSocket auth error:', { message: error.message, stack: error.stack });
        next(new AuthenticationError('Invalid or expired token', 'INVALID_TOKEN'));
      }
    } catch (error) {
      // Unexpected error
      logger.error('WebSocket middleware error:', { message: error.message, stack: error.stack });
      next(new Error('Authentication system error'));
    }
  };
};
