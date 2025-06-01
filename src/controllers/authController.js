/**
 * Authentication Controller
 *
 * Handles HTTP requests for authentication endpoints,
 * delegating business logic to the auth service.
 */

const container = require('../container');
const authService = container.get('authService');
const asyncErrorHandler = container.get('asyncErrorHandler');

/**
 * Register a new user
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const register = asyncErrorHandler(async (req, res, next) => {
  try {
    const result = await authService.register(req.body);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: result,
    });
  } catch (error) {
    // Handle any uncaught errors
    next(error);
  }
});

/**
 * Login an existing user
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const login = asyncErrorHandler(async (req, res, next) => {
  try {
    const result = await authService.login(req.body);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: result,
    });
  } catch (error) {
    // Handle any uncaught errors
    next(error);
  }
});

/**
 * Logout a user (placeholder for future implementation)
 */
async function logout(req, res, next) {
  res.status(501).json({
    success: false,
    message: 'Logout endpoint not yet implemented',
    error: 'NOT_IMPLEMENTED',
  });
}

/**
 * Refresh an authentication token (placeholder for future implementation)
 */
async function refreshToken(req, res, next) {
  res.status(501).json({
    success: false,
    message: 'Token refresh endpoint not yet implemented',
    error: 'NOT_IMPLEMENTED',
  });
}

/**
 * Get the currently authenticated user (placeholder for future implementation)
 */
async function getCurrentUser(req, res, next) {
  res.status(501).json({
    success: false,
    message: 'Get current user endpoint not yet implemented',
    error: 'NOT_IMPLEMENTED',
  });
}

/**
 * Initiate forgot password flow (placeholder for future implementation)
 */
async function forgotPassword(req, res, next) {
  res.status(501).json({
    success: false,
    message: 'Forgot password endpoint not yet implemented',
    error: 'NOT_IMPLEMENTED',
  });
}

/**
 * Reset a password with token (placeholder for future implementation)
 */
async function resetPassword(req, res, next) {
  res.status(501).json({
    success: false,
    message: 'Reset password endpoint not yet implemented',
    error: 'NOT_IMPLEMENTED',
  });
}

module.exports = {
  register,
  login,
  logout,
  refreshToken,
  getCurrentUser,
  forgotPassword,
  resetPassword,
};
