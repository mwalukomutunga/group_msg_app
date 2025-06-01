/**
 * Database Configuration
 *
 * Manages MongoDB connection setup and lifecycle.
 * Uses dependency injection pattern for better testability.
 */

const mongoose = require('mongoose');
const env = require('./environment');
const logger = require('../utils/logger');

// Connection state constants
const CONNECTION_STATES = {
  DISCONNECTED: 0,
  CONNECTED: 1,
  CONNECTING: 2,
  DISCONNECTING: 3,
};

// Default connection options for better performance and reliability
const DEFAULT_CONNECTION_OPTIONS = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 10000,
  family: 4, // Force IPv4
};

/**
 * Connect to MongoDB
 *
 * @param {string} [uri] - Optional URI override (for tests)
 * @param {Object} [options] - Optional connection options
 * @returns {Promise} Connection result
 */
async function connect(uri, options = {}) {
  const connectionUri = uri || env.get('MONGODB_URI');

  if (!connectionUri) {
    throw new Error('MongoDB connection URI not provided');
  }

  const connectionOptions = {
    ...DEFAULT_CONNECTION_OPTIONS,
    ...options,
  };

  try {
    // Set mongoose configuration
    mongoose.set('strictQuery', false);

    // Add connection event listeners
    mongoose.connection.on('connected', () => {
      logger.info('✅ MongoDB connected successfully');
    });

    mongoose.connection.on('error', (err) => {
      logger.error('❌ MongoDB connection error:', { message: err.message });
    });

    mongoose.connection.on('disconnected', () => {
      logger.info('📴 MongoDB disconnected');
    });

    // Connect to MongoDB with exponential backoff on initial failure
    let retries = 0;
    const maxRetries = 3;

    while (retries <= maxRetries) {
      try {
        await mongoose.connect(connectionUri, connectionOptions);
        return mongoose.connection;
      } catch (error) {
        if (retries === maxRetries) {
          throw error;
        }

        // Calculate backoff delay
        const delay = Math.pow(2, retries) * 1000;
        logger.warn(`MongoDB connection attempt ${retries + 1} failed. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        retries++;
      }
    }
  } catch (error) {
    logger.error('❌ Failed to connect to MongoDB:', { message: error.message });
    throw error;
  }
}

/**
 * Disconnect from MongoDB
 *
 * @returns {Promise} Disconnection result
 */
async function disconnect() {
  try {
    if (isConnected()) {
      await mongoose.disconnect();
      logger.info('📴 MongoDB disconnected successfully');
    }
    return true;
  } catch (error) {
    logger.error('❌ Error disconnecting from MongoDB:', { message: error.message });
    throw error;
  }
}

/**
 * Check if the database is connected
 *
 * @returns {boolean} Connection status
 */
function isConnected() {
  return mongoose.connection &&
    mongoose.connection.readyState === CONNECTION_STATES.CONNECTED;
}

/**
 * Get the current connection
 *
 * @returns {Object} Mongoose connection object
 */
function getConnection() {
  return mongoose.connection;
}

/**
 * Get the connection state
 *
 * @returns {number} Connection state
 */
function getConnectionState() {
  return mongoose.connection ? mongoose.connection.readyState : CONNECTION_STATES.DISCONNECTED;
}

/**
 * Get connection state name
 *
 * @returns {string} Connection state name
 */
function getConnectionStateName() {
  const state = getConnectionState();
  const stateNames = {
    [CONNECTION_STATES.DISCONNECTED]: 'disconnected',
    [CONNECTION_STATES.CONNECTED]: 'connected',
    [CONNECTION_STATES.CONNECTING]: 'connecting',
    [CONNECTION_STATES.DISCONNECTING]: 'disconnecting',
  };
  return stateNames[state] || 'unknown';
}

module.exports = {
  connect,
  disconnect,
  isConnected,
  getConnection,
  getConnectionState,
  getConnectionStateName,
  CONNECTION_STATES,
};
