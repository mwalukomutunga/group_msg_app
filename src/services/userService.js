/**
 * User Service
 *
 * Handles all business logic related to user management,
 * including profile operations and user retrieval.
 */

/**
 * Create the user service with injected dependencies
 *
 * @param {Object} container - The dependency injection container
 * @returns {Object} The user service methods
 */
module.exports = function(container) {
  // Get dependencies from the container
  const User = container.get('userModel');
  const {
    NotFoundError,
    ValidationError,
    InternalError,
  } = container.get('errorUtils');

  /**
   * Get a user by ID
   *
   * @param {string} userId - The ID of the user to retrieve
   * @returns {Object} The user data
   * @throws {NotFoundError} If user doesn't exist
   * @throws {InternalError} If there's a database error
   */
  async function getUserById(userId) {
    try {
      const user = await User.findById(userId);

      if (!user) {
        throw new NotFoundError('User not found', 'USER_NOT_FOUND');
      }

      return user.toJSON();
    } catch (error) {
      if (error.name === 'CastError') {
        throw new ValidationError('Invalid user ID format', 'INVALID_ID');
      }

      if (error instanceof NotFoundError) {
        throw error;
      }

      console.error('Error retrieving user:', error);
      throw new InternalError('User service error', 'DATABASE_ERROR');
    }
  }

  /**
   * Get all users (with pagination)
   *
   * @param {Object} options - Query options
   * @param {number} options.page - Page number (1-based)
   * @param {number} options.limit - Number of items per page
   * @returns {Object} Paginated users data
   * @throws {InternalError} If there's a database error
   */
  async function getUsers({ page = 1, limit = 10 } = {}) {
    try {
      const skip = (page - 1) * limit;
      const users = await User.find()
        .select('-password') // Exclude password field
        .skip(skip)
        .limit(limit);

      const total = await User.countDocuments();

      return {
        users: users.map(user => user.toJSON()),
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.error('Error retrieving users:', error);
      throw new InternalError('User service error', 'DATABASE_ERROR');
    }
  }

  /**
   * Update a user's profile
   *
   * @param {string} userId - The ID of the user to update
   * @param {Object} updateData - The data to update
   * @returns {Object} The updated user data
   * @throws {NotFoundError} If user doesn't exist
   * @throws {ValidationError} If validation fails
   * @throws {InternalError} If there's a database error
   */
  async function updateUser(userId, updateData) {
    try {
      // Find the user first to ensure they exist
      const user = await User.findById(userId);

      if (!user) {
        throw new NotFoundError('User not found', 'USER_NOT_FOUND');
      }

      // Apply updates
      Object.keys(updateData).forEach(key => {
        // Prevent updating critical fields
        if (key !== 'password' && key !== '_id' && key !== 'email') {
          user[key] = updateData[key];
        }
      });

      // Save the updated user
      const updatedUser = await user.save();

      return updatedUser.toJSON();
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      if (error.name === 'ValidationError') {
        throw new ValidationError(
          'Validation failed',
          Object.keys(error.errors).map(field => ({
            field,
            message: error.errors[field].message,
          })),
        );
      }

      console.error('Error updating user:', error);
      throw new InternalError('User service error', 'DATABASE_ERROR');
    }
  }

  /**
   * Delete a user account
   *
   * @param {string} userId - The ID of the user to delete
   * @returns {Object} Confirmation of deletion
   * @throws {NotFoundError} If user doesn't exist
   * @throws {InternalError} If there's a database error
   */
  async function deleteUser(userId) {
    try {
      const result = await User.findByIdAndDelete(userId);

      if (!result) {
        throw new NotFoundError('User not found', 'USER_NOT_FOUND');
      }

      return { success: true, message: 'User deleted successfully' };
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      console.error('Error deleting user:', error);
      throw new InternalError('User service error', 'DATABASE_ERROR');
    }
  }

  /**
   * Get user statistics
   *
   * @param {string} userId - The ID of the user to retrieve stats for
   * @returns {Object} User statistics data
   * @throws {NotFoundError} If user doesn't exist
   * @throws {InternalError} If there's a database error
   */
  async function getUserStats(userId) {
    try {
      const user = await User.findById(userId);

      if (!user) {
        throw new NotFoundError('User not found', 'USER_NOT_FOUND');
      }

      // Calculate account age in days
      const creationDate = user.createdAt;
      const now = new Date();
      const accountAgeInDays = Math.floor((now - creationDate) / (1000 * 60 * 60 * 24));

      // Get last login timestamp, defaulting to creation date if not available
      const lastLogin = user.lastLogin || user.createdAt;

      // Calculate profile completeness (example implementation)
      let profileCompleteness = 100; // Base: has email
      if (!user.firstName || !user.lastName) profileCompleteness -= 20;
      if (!user.bio) profileCompleteness -= 10;
      if (!user.avatar) profileCompleteness -= 10;

      return {
        accountCreated: user.createdAt.toISOString(),
        accountAgeInDays,
        lastLogin: lastLogin.toISOString(),
        profileCompleteness,
      };
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      console.error('Error retrieving user stats:', error);
      throw new InternalError('User service error', 'DATABASE_ERROR');
    }
  }

  /**
   * Change user password
   *
   * @param {string} userId - The ID of the user
   * @param {string} currentPassword - The current password
   * @param {string} newPassword - The new password
   * @returns {Object} Confirmation of password change
   * @throws {NotFoundError} If user doesn't exist
   * @throws {ValidationError} If current password is incorrect
   * @throws {InternalError} If there's a database error
   */
  async function changePassword(userId, currentPassword, newPassword) {
    try {
      // Find the user first to ensure they exist
      const user = await User.findById(userId);

      if (!user) {
        throw new NotFoundError('User not found', 'USER_NOT_FOUND');
      }

      // Validate current password using the comparePassword method
      const isPasswordValid = await user.comparePassword(currentPassword);
      if (!isPasswordValid) {
        throw new ValidationError('Current password is incorrect', 'INVALID_PASSWORD');
      }

      // Update with new password
      user.password = newPassword;
      await user.save();

      return { success: true, message: 'Password changed successfully' };
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }

      console.error('Error changing password:', error);
      throw new InternalError('User service error', 'DATABASE_ERROR');
    }
  }

  // Return the service methods
  return {
    getUserById,
    getUsers,
    updateUser,
    deleteUser,
    getUserStats,
    changePassword,
  };
};
