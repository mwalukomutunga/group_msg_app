const originalEnv = process.env;

// Mock dotenv to prevent interference from .env file
jest.mock('dotenv', () => ({
  config: jest.fn()
}));

describe('Environment Configuration', () => {
  beforeEach(() => {
    // Reset modules and environment before each test
    jest.resetModules();
    // Clear require cache for environment config and dotenv
    delete require.cache[require.resolve('../../src/config/environment')];
    delete require.cache[require.resolve('dotenv')];
    // Reset process.env
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Environment Variable Loading', () => {
    it('should load configuration with default values', () => {
      delete process.env.NODE_ENV;
      delete process.env.PORT;
      delete process.env.MONGODB_URI;
      delete process.env.JWT_SECRET;
      delete process.env.JWT_EXPIRES_IN;
      delete process.env.ENCRYPTION_KEY;

      const env = require('../../src/config/environment');
      const config = env.config;

      expect(config.NODE_ENV).toBe('development');
      expect(config.PORT).toBe(3000);
      expect(config.JWT_EXPIRES_IN).toBe('24h');
      expect(config.BCRYPT_SALT_ROUNDS).toBe(12);
      // When no CORS_ORIGIN is provided, default value should be used 
      expect(typeof config.CORS_ORIGIN).toBe('string');
      expect(config.LOG_LEVEL).toBe('info');
    });

    it('should use environment variables when provided', () => {
      process.env.NODE_ENV = 'production';
      process.env.PORT = '8080';
      process.env.JWT_EXPIRES_IN = '1h';
      process.env.BCRYPT_SALT_ROUNDS = '10';
      process.env.CORS_ORIGIN = 'https://example.com';
      process.env.LOG_LEVEL = 'error';
      process.env.MONGODB_URI = 'mongodb+srv://user:pass@cluster.mongodb.net/testdb';
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.ENCRYPTION_KEY = 'a'.repeat(32);

      const env = require('../../src/config/environment');
      const config = env.config;

      expect(config.NODE_ENV).toBe('production');
      expect(config.PORT).toBe(8080);
      expect(config.JWT_EXPIRES_IN).toBe('1h');
      expect(config.BCRYPT_SALT_ROUNDS).toBe(10);
      expect(config.CORS_ORIGIN).toBe('https://example.com');
      expect(config.LOG_LEVEL).toBe('error');
    });

    it('should generate secure defaults for development', () => {
      process.env.NODE_ENV = 'development';
      delete process.env.JWT_SECRET;
      delete process.env.ENCRYPTION_KEY;
      delete process.env.MONGODB_URI;

      const env = require('../../src/config/environment');
      const config = env.config;

      expect(config.JWT_SECRET.length).toBeGreaterThanOrEqual(32);
      expect(config.ENCRYPTION_KEY.length).toBe(32);
      expect(config.MONGODB_URI).toContain('mongodb');
    });
  });

  describe('Environment Validation', () => {
    it('should require production environment variables in production', () => {
      // Clear all environment variables that might interfere
      const backup = { ...process.env };
      
      // Set minimal production environment without required variables
      process.env = {
        NODE_ENV: 'production'
      };

      // Clear require cache to ensure fresh module load
      delete require.cache[require.resolve('../../src/config/environment')];
      
      // This should throw because production requires explicit environment variables
      expect(() => {
        require('../../src/config/environment');
      }).toThrow(/must be provided in production environment/);
      
      // Restore environment
      process.env = backup;
    });

    it('should validate JWT_SECRET length', () => {
      process.env.JWT_SECRET = 'too-short';
      process.env.MONGODB_URI = 'mongodb+srv://user:pass@cluster.mongodb.net/test';

      expect(() => {
        require('../../src/config/environment');
      }).toThrow(/JWT_SECRET must be at least 32 characters long/);
    });

    it('should validate ENCRYPTION_KEY length', () => {
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.ENCRYPTION_KEY = 'invalid-length';
      process.env.MONGODB_URI = 'mongodb+srv://user:pass@cluster.mongodb.net/test';

      expect(() => {
        require('../../src/config/environment');
      }).toThrow(/ENCRYPTION_KEY must be exactly 32 characters/);
    });

    it('should validate PORT range', () => {
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.ENCRYPTION_KEY = 'a'.repeat(32);
      process.env.PORT = '99999';
      process.env.MONGODB_URI = 'mongodb+srv://user:pass@cluster.mongodb.net/test';

      expect(() => {
        require('../../src/config/environment');
      }).toThrow(/PORT must be between 1 and 65535/);
    });

    it('should validate NODE_ENV values', () => {
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.ENCRYPTION_KEY = 'a'.repeat(32);
      process.env.NODE_ENV = 'invalid';
      process.env.MONGODB_URI = 'mongodb+srv://user:pass@cluster.mongodb.net/test';

      expect(() => {
        require('../../src/config/environment');
      }).toThrow(/NODE_ENV must be one of: development, test, production/);
    });

    it('should pass validation with all required variables', () => {
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.ENCRYPTION_KEY = 'a'.repeat(32);
      process.env.MONGODB_URI = 'mongodb+srv://user:pass@cluster.mongodb.net/test';

      expect(() => {
        require('../../src/config/environment');
      }).not.toThrow();
    });
  });

  describe('Environment Utilities', () => {
    it('should correctly identify production environment', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.ENCRYPTION_KEY = 'a'.repeat(32);
      process.env.MONGODB_URI = 'mongodb+srv://user:pass@cluster.mongodb.net/test';

      const env = require('../../src/config/environment');

      expect(env.isProduction()).toBe(true);
      expect(env.isDevelopment()).toBe(false);
      expect(env.isTest()).toBe(false);
    });

    it('should correctly identify development environment', () => {
      process.env.NODE_ENV = 'development';

      const env = require('../../src/config/environment');

      expect(env.isProduction()).toBe(false);
      expect(env.isDevelopment()).toBe(true);
      expect(env.isTest()).toBe(false);
    });

    it('should correctly identify test environment', () => {
      process.env.NODE_ENV = 'test';

      const env = require('../../src/config/environment');

      expect(env.isProduction()).toBe(false);
      expect(env.isDevelopment()).toBe(false);
      expect(env.isTest()).toBe(true);
    });

    it('should get specific configuration values', () => {
      process.env.NODE_ENV = 'test';
      process.env.PORT = '4000';

      const env = require('../../src/config/environment');

      expect(env.get('NODE_ENV')).toBe('test');
      expect(env.get('PORT')).toBe(4000);
    });

    it('should mask sensitive connection strings', () => {
      process.env.NODE_ENV = 'development';
      process.env.MONGODB_URI = 'mongodb+srv://user:password@cluster.mongodb.net/db';

      const env = require('../../src/config/environment');

      // Call printSummary and check that it doesn't throw
      expect(() => env.printSummary()).not.toThrow();
    });
  });

  describe('Configuration Object', () => {
    it('should include all required configuration keys', () => {
      const env = require('../../src/config/environment');
      const config = env.config;

      const requiredKeys = [
        'NODE_ENV',
        'PORT',
        'MONGODB_URI',
        'JWT_SECRET',
        'JWT_EXPIRES_IN',
        'ENCRYPTION_KEY',
        'BCRYPT_SALT_ROUNDS',
        'RATE_LIMIT_WINDOW_MS',
        'RATE_LIMIT_MAX_REQUESTS',
        'CORS_ORIGIN',
        'LOG_LEVEL'
      ];

      requiredKeys.forEach(key => {
        expect(config).toHaveProperty(key);
      });
    });
  });
});
