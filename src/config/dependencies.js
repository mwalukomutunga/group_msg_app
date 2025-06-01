/**
 * Dependency Configuration
 *
 * Configures and registers all application dependencies in the DI container.
 * This is the central location where all services, models, and utilities
 * are wired together.
 */

const container = require('../container');
const UserModel = require('../models/User');
const GroupModel = require('../models/Group');
const MessageModel = require('../models/Message');
const jwtUtils = require('../utils/jwt');
const encryptionUtils = require('../utils/encryption');
const validationUtils = require('../utils/validation');
const passwordUtils = require('../utils/password');
const errorUtils = require('../utils/errors');
const databaseUtils = require('../utils/databaseUtils');
const database = require('./database');
const env = require('./environment');
const { asyncErrorHandler } = require('../middleware/errorHandler');

/**
 * Configure all application dependencies
 *
 * @returns {object} The configured container
 */
function configureDependencies() {
  // Register models
  container.register('userModel', UserModel);
  container.register('groupModel', GroupModel);
  container.register('messageModel', MessageModel);

  // Register utilities
  container.register('jwtUtils', jwtUtils);
  container.register('encryptionUtils', encryptionUtils);
  container.register('validationUtils', validationUtils);
  container.register('passwordUtils', passwordUtils);
  container.register('errorUtils', errorUtils);
  container.register('databaseUtils', databaseUtils);
  container.register('asyncErrorHandler', asyncErrorHandler);

  // Register configs
  container.register('database', database);
  container.register('env', env);

  // Register services (after we create them)
  registerServices();

  return container;
}

/**
 * Register all services in the container
 * Services are registered after other dependencies since they depend on them
 */
function registerServices() {
  // These will be created next
  container.register('authService', require('../services/authService')(container));
  container.register('userService', require('../services/userService')(container));
  container.register('groupService', require('../services/groupService')(container));
  container.register('messageService', require('../services/messageService')(container));
}

module.exports = configureDependencies;
