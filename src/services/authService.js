/**
 * Authentication Service
 *
 * Handles all business logic related to user authentication,
 * including registration, login, and token management.
 */

const logger = require('../utils/logger');

/**
 * Create the authentication service with injected dependencies
 *
 * @param {Object} container - The dependency injection container
 * @returns {Object} The auth service methods
 */
module.exports = function(container) {

  const User = container.get('userModel');
  const { generateToken } = container.get('jwtUtils');
  const { validateRegistration, validateLogin } = container.get('validationUtils');
  const {
    ValidationError,
    ConflictError,
    AuthenticationError,
    InternalError,
  } = container.get('errorUtils');

  /**
   * Register a new user
   *
   * @param {Object} userData - The user registration data
   * @returns {Object} Object containing user data and authentication token
   * @throws {ValidationError} If validation fails
   * @throws {ConflictError} If email is already registered
   * @throws {InternalError} If there's a database error
   */
  async function register(userData) {

    const { error, value, isValid } = validateRegistration(userData);

    if (!isValid) {
      throw new ValidationError(
        'Validation failed',
        error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
        })),
      );
    }

    const { email, password } = value;

    // Check for existing user with timeout protection
    let existingUser;
    try {
      existingUser = await User.findByEmail(email);
    } catch (dbError) {
      logger.error('Database error during registration check:', { message: dbError.message, stack: dbError.stack });
      throw new InternalError('Registration service temporarily unavailable', 'DATABASE_ERROR');
    }

    if (existingUser) {
      throw new ConflictError('Email address is already registered', 'DUPLICATE_EMAIL', 'email');
    }

    // Create and save user with timeout protection
    const user = new User({ email, password });
    let savedUser;
    try {
      savedUser = await Promise.race([
        user.save(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('User save operation timed out')), 15000),
        ),
      ]);
    } catch (saveError) {
      logger.error('Error saving user during registration:', { message: saveError.message, stack: saveError.stack });

      if (saveError.name === 'MongoServerError' && saveError.code === 11000) {
        // Handle race condition where duplicate may have been created between findByEmail and save
        throw new ConflictError('Email address is already registered', 'DUPLICATE_EMAIL', 'email');
      } else {
        throw new InternalError('Error creating user account', 'DATABASE_ERROR');
      }
    }


    const tokenPayload = {
      userId: savedUser._id.toString(),
      email: savedUser.email,
    };

    const token = generateToken(tokenPayload);

    return {
      user: savedUser.toJSON(),
      token,
      tokenExpiry: '24h',
    };
  }

  /**
   * Log in an existing user
   *
   * @param {Object} credentials - The login credentials
   * @returns {Object} Object containing user data and authentication token
   * @throws {ValidationError} If validation fails
   * @throws {AuthenticationError} If credentials are invalid
   * @throws {InternalError} If there's a database error
   */
  async function login(credentials) {

    const { error, value, isValid } = validateLogin(credentials);

    if (!isValid) {
      throw new ValidationError(
        'Validation failed',
        error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
        })),
      );
    }

    const { email, password } = value;


    let user;
    try {
      user = await User.findByEmail(email);
    } catch (dbError) {
      logger.error('Database error during login:', { message: dbError.message, stack: dbError.stack });
      throw new InternalError('Authentication service temporarily unavailable', 'DATABASE_ERROR');
    }

    if (!user) {
      throw new AuthenticationError('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    // Attempt to compare password with timeout protection
    let isPasswordValid = false;
    try {
      isPasswordValid = await Promise.race([
        user.comparePassword(password),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Password comparison timed out')), 5000),
        ),
      ]);
    } catch (passwordError) {
      logger.error('Password comparison error:', { message: passwordError.message, stack: passwordError.stack });
      throw new AuthenticationError('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    if (!isPasswordValid) {
      throw new AuthenticationError('Invalid email or password', 'INVALID_CREDENTIALS');
    }


    const tokenPayload = {
      userId: user._id.toString(),
      email: user.email,
    };

    const token = generateToken(tokenPayload);

    return {
      user: user.toJSON(),
      token,
      tokenExpiry: '24h',
    };
  }

  /**
   * Logout a user (placeholder for future implementation)
   */
  async function logout() {
    // To be implemented (token invalidation strategy)
    throw new Error('Not implemented');
  }

  /**
   * Refresh an authentication token (placeholder for future implementation)
   */
  async function refreshToken() {
    // To be implemented (refresh token strategy)
    throw new Error('Not implemented');
  }

  /**
   * Get the currently authenticated user (placeholder for future implementation)
   */
  async function getCurrentUser(userId) {
    // To be implemented
    throw new Error('Not implemented');
  }

  /**
   * Initiate forgot password flow (placeholder for future implementation)
   */
  async function forgotPassword(email) {
    // To be implemented
    throw new Error('Not implemented');
  }

  /**
   * Reset a password with token (placeholder for future implementation)
   */
  async function resetPassword(token, newPassword) {
    // To be implemented
    throw new Error('Not implemented');
  }


  return {
    register,
    login,
    logout,
    refreshToken,
    getCurrentUser,
    forgotPassword,
    resetPassword,
  };
};
