const mongoose = require('mongoose');

/**
 * Test database setup using MongoDB Atlas
 * Uses the same Atlas cluster but a separate test database
 */

const testDatabase = {
  /**
   * Connect to MongoDB Atlas for tests
   */
  async connect() {
    try {
      const mongoUri = process.env.MONGODB_URI;
      if (!mongoUri) {
        throw new Error('MONGODB_URI environment variable is required for tests');
      }

      // Parse the URI to modify database name for tests
      const testUri = this.getTestDatabaseUri(mongoUri);
      
      console.log('🧪 Connecting to test database on Atlas...');

      // Configure Mongoose for tests - enable buffering
      mongoose.set('bufferCommands', true);
      
      // Connect mongoose to Atlas with test database
      await mongoose.connect(testUri, {
        maxPoolSize: 10, // Increased pool size for tests
        serverSelectionTimeoutMS: 10000, // Reduced timeout to fail faster if can't connect
        socketTimeoutMS: 45000, // Increased timeout
        bufferCommands: true // Enable command buffering
      });

      console.log('✅ Test database connected to Atlas');
    } catch (error) {
      console.error('❌ Test database connection failed:', error.message);
      throw error;
    }
  },

  /**
   * Get test database URI by modifying the production URI
   * Appends '_test' to the database name
   */
  getTestDatabaseUri(mongoUri) {
    try {
      const url = new URL(mongoUri);
      const dbName = url.pathname.slice(1); // Remove leading slash
      const testDbName = dbName ? `${dbName}_test` : 'test_db';
      url.pathname = `/${testDbName}`;
      return url.toString();
    } catch (error) {
      // Fallback: just append to the URI
      const separator = mongoUri.includes('?') ? '&' : '?';
      return `${mongoUri}${separator}dbName=test_db`;
    }
  },

  /**
   * Disconnect from MongoDB Atlas
   */
  async disconnect() {
    try {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
        console.log('🔌 Test database disconnected');
      }
    } catch (error) {
      console.error('Error disconnecting from test database:', error.message);
    }
  },

  /**
   * Clear all data from the test database
   */
  async clearDatabase() {
    if (mongoose.connection.readyState !== 1) {
      return;
    }

    try {
      const collections = mongoose.connection.collections;
      
      for (const key in collections) {
        await collections[key].deleteMany({});
      }
      
      console.log('🧹 Test database cleared');
    } catch (error) {
      console.error('Error clearing test database:', error.message);
      throw error;
    }
  },

  /**
   * Get current test database connection info
   */
  getConnectionInfo() {
    if (mongoose.connection.readyState === 1) {
      return {
        connected: true,
        host: mongoose.connection.host,
        name: mongoose.connection.name,
        readyState: mongoose.connection.readyState
      };
    }
    return { connected: false };
  }
};

module.exports = {
  // Main functions
  connectTestDB: () => testDatabase.connect(),
  disconnectTestDB: () => testDatabase.disconnect(),
  clearTestDB: () => testDatabase.clearDatabase(),
  getTestDBInfo: () => testDatabase.getConnectionInfo(),

  // For individual test setup/teardown
  setupTestDB: async () => {
    await testDatabase.clearDatabase();
  },

  teardownTestDB: async () => {
    await testDatabase.clearDatabase();
  },

  // Ensure test connection (for compatibility)
  ensureTestConnection: async () => {
    if (mongoose.connection.readyState !== 1) {
      console.log('⚠️ Test database not connected, attempting connection...');
      await testDatabase.connect();
    }
    return mongoose.connection;
  },

  // Global setup/teardown functions
  globalSetup: async () => {
    console.log('🚀 Starting global test database setup with Atlas...');
    await testDatabase.connect();
    await testDatabase.clearDatabase(); // Start with clean database
    console.log('✅ Global test database setup complete');
  },

  globalTeardown: async () => {
    console.log('🏁 Starting global test database teardown...');
    await testDatabase.clearDatabase(); // Clean up after tests
    await testDatabase.disconnect();
    console.log('✅ Global test database teardown complete');
  }
};
