const { setupTestDB, teardownTestDB, clearTestDB, ensureTestConnection } = require('../setup/database');

/**
 * Test utilities and data factories
 */

/**
 * Test data factories
 */
const testUsers = {
  validUser: {
    email: 'testuser@example.com',
    password: 'TestPassword123'
  },
  adminUser: {
    email: 'admin@example.com', 
    password: 'AdminPassword123'
  },
  secondUser: {
    email: 'user2@example.com',
    password: 'SecondPassword123'
  }
};

const testGroups = {
  publicGroup: {
    name: 'Test Public Group',
    description: 'A test public group',
    type: 'public',
    maxMembers: 50
  },
  privateGroup: {
    name: 'Test Private Group',
    description: 'A test private group',
    type: 'private',
    maxMembers: 20
  }
};

const testMessages = {
  basicMessage: {
    content: 'This is a test message'
  },
  longMessage: {
    content: 'This is a much longer test message that contains more content to test the message handling capabilities of the system.'
  }
};

/**
 * Database test helpers
 */
const dbHelpers = {
  /**
   * Setup clean database for each test
   */
  async setupEach() {
    // Ensure connection with retry logic
    let retries = 3;
    while (retries > 0) {
      try {
        await ensureTestConnection();
        break;
      } catch (error) {
        retries--;
        if (retries === 0) {
          throw new Error(`Failed to establish database connection: ${error.message}`);
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    await clearTestDB();
  },

  /**
   * Cleanup after each test
   */
  async teardownEach() {
    await clearTestDB();
  },

  /**
   * Setup database for entire test suite
   */
  async setupSuite() {
    await setupTestDB();
  },

  /**
   * Teardown database for entire test suite
   */
  async teardownSuite() {
    await teardownTestDB();
  }
};

/**
 * Request helpers for API testing
 */
const requestHelpers = {
  /**
   * Create valid registration request body
   */
  createRegisterRequest(overrides = {}) {
    return {
      ...testUsers.validUser,
      ...overrides
    };
  },

  /**
   * Create valid login request body
   */
  createLoginRequest(overrides = {}) {
    return {
      ...testUsers.validUser,
      ...overrides
    };
  },

  /**
   * Create valid group request body
   */
  createGroupRequest(overrides = {}) {
    return {
      ...testGroups.publicGroup,
      ...overrides
    };
  },

  /**
   * Create valid message request body
   */
  createMessageRequest(overrides = {}) {
    return {
      ...testMessages.basicMessage,
      ...overrides
    };
  },

  /**
   * Create authorization header
   */
  createAuthHeader(token) {
    return {
      'Authorization': `Bearer ${token}`
    };
  }
};

/**
 * Common test patterns
 */
const testPatterns = {
  /**
   * Test for successful response structure
   */
  expectSuccessResponse(response, statusCode = 200) {
    expect(response.status).toBe(statusCode);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('data');
  },

  /**
   * Test for error response structure
   */
  expectErrorResponse(response, statusCode = 400) {
    expect(response.status).toBe(statusCode);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('message');
  },

  /**
   * Test for validation error response
   */
  expectValidationError(response) {
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body.message).toContain('Validation failed');
  },

  /**
   * Test for authentication error response
   */
  expectAuthError(response) {
    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('error', 'AUTHENTICATION_FAILED');
  },

  /**
   * Test for rate limit error response
   */
  expectRateLimitError(response) {
    expect(response.status).toBe(429);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('error', 'RATE_LIMIT_EXCEEDED');
  }
};

/**
 * Wait utilities for async operations
 */
const waitUtils = {
  /**
   * Wait for a specific amount of time
   */
  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * Wait for a condition to be true
   */
  async waitFor(condition, timeout = 5000, interval = 100) {
    const start = Date.now();
    
    while (Date.now() - start < timeout) {
      if (await condition()) {
        return true;
      }
      await this.wait(interval);
    }
    
    throw new Error(`Condition not met within ${timeout}ms`);
  }
};

module.exports = {
  // Test data
  testUsers,
  testGroups,
  testMessages,
  
  // Database helpers
  dbHelpers,
  
  // Request helpers
  requestHelpers,
  
  // Test patterns
  testPatterns,
  
  // Wait utilities
  waitUtils,
  
  // Common test setup functions
  setupTest: dbHelpers.setupEach,
  teardownTest: dbHelpers.teardownEach,
  
  // Timeout constants
  timeouts: {
    short: 5000,    // 5 seconds
    medium: 10000,  // 10 seconds
    long: 15000     // 15 seconds
  }
};
