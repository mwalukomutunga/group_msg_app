/**
 * User Controller
 *
 * Handles HTTP requests for user endpoints,
 * delegating business logic to the user service.
 */

const container = require('../container');
const userService = container.get('userService');
const asyncErrorHandler = container.get('asyncErrorHandler');

/**
 * Get current authenticated user's profile
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const getCurrentUser = asyncErrorHandler(async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const user = await userService.getUserById(userId);

    res.status(200).json({
      success: true,
      message: 'User profile retrieved successfully',
      data: {
        user,
        tokenInfo: {
          issuedAt: req.user.iat ? new Date(req.user.iat * 1000).toISOString() : null,
          expiresAt: req.user.exp ? new Date(req.user.exp * 1000).toISOString() : null,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get a user by ID
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const getUserById = asyncErrorHandler(async (req, res, next) => {
  try {
    const { userId } = req.params;
    const user = await userService.getUserById(userId);

    res.status(200).json({
      success: true,
      message: 'User retrieved successfully',
      data: user,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get all users with pagination
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const getUsers = asyncErrorHandler(async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const result = await userService.getUsers({ page, limit });

    res.status(200).json({
      success: true,
      message: 'Users retrieved successfully',
      data: result.users,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get user statistics
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const getUserStats = asyncErrorHandler(async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const user = await userService.getUserById(userId);
    const stats = await userService.getUserStats(userId);

    res.status(200).json({
      success: true,
      message: 'User statistics retrieved successfully',
      data: {
        stats,
        user: {
          id: user._id,
          email: user.email,
          createdAt: user.createdAt,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Update user profile
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const updateUser = asyncErrorHandler(async (req, res, next) => {
  try {
    const userId = req.params.userId || req.user.userId;

    // Check if user is updating their own profile
    if (req.params.userId && req.params.userId !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own profile',
        error: 'FORBIDDEN',
      });
    }

    const updatedUser = await userService.updateUser(userId, req.body);

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Change user password
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const changePassword = asyncErrorHandler(async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required',
        error: 'MISSING_FIELDS',
      });
    }

    const result = await userService.changePassword(userId, currentPassword, newPassword);

    res.status(200).json({
      success: true,
      message: 'Password changed successfully',
      data: {
        changedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Delete user account
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const deleteUser = asyncErrorHandler(async (req, res, next) => {
  try {
    const userId = req.params.userId || req.user.userId;

    // Check if user is deleting their own account
    if (req.params.userId && req.params.userId !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own account',
        error: 'FORBIDDEN',
      });
    }

    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required for account deletion',
        error: 'MISSING_PASSWORD',
      });
    }

    await userService.deleteUser(userId, password);

    res.status(200).json({
      success: true,
      message: 'User deleted successfully',
      data: {
        deletedAt: new Date().toISOString(),
        userId,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = {
  getCurrentUser,
  getUserById,
  getUsers,
  getUserStats,
  updateUser,
  changePassword,
  deleteUser,
};
