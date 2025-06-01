require('dotenv').config();
const winston = require('winston');

/**
 * Environment configuration and validation
 */
class EnvironmentConfig {
  constructor() {
    this.config = this.loadConfig();
    this.validateRequired();
  }

  /**
   * Load configuration from environment variables with defaults
   */
  loadConfig() {
    const nodeEnv = process.env.NODE_ENV || 'development';
    const isProduction = nodeEnv === 'production';

    return {
      // Server configuration
      NODE_ENV: nodeEnv,
      PORT: parseInt(process.env.PORT) || 3000,

      // Database configuration
      MONGODB_URI: process.env.MONGODB_URI || this.getDefaultMongoUri(isProduction),

      // JWT configuration
      JWT_SECRET: process.env.JWT_SECRET || this.generateDefaultJwtSecret(isProduction),
      JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',

      // Encryption configuration
      ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || this.generateDefaultEncryptionKey(isProduction),

      // Security configuration
      BCRYPT_SALT_ROUNDS: parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12,

      // Rate limiting configuration
      RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
      RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,

      // CORS configuration
      CORS_ORIGIN: process.env.CORS_ORIGIN || '*',

      // Logging level
      LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    };
  }

  /**
   * Generate default MongoDB URI for development using MongoDB Atlas
   */
  getDefaultMongoUri(isProduction = false) {
    if (isProduction) {
      throw new Error('MONGODB_URI must be provided in production environment');
    }
    // Use MongoDB Atlas for development
    return 'mongodb+srv://mwalukm254:AfBmSwGT710q31mY@cluster0.xjgjhai.mongodb.net/groupmessaging-dev?retryWrites=true&w=majority&appName=Cluster0';
  }

  /**
   * Generate default JWT secret for development (insecure for production)
   */
  generateDefaultJwtSecret(isProduction = false) {
    if (isProduction) {
      throw new Error('JWT_SECRET must be provided in production environment');
    }

    // Generate a random secret for development
    const crypto = require('crypto');
    return crypto.randomBytes(64).toString('hex');
  }

  /**
   * Generate default encryption key for development (insecure for production)
   */
  generateDefaultEncryptionKey(isProduction = false) {
    if (isProduction) {
      throw new Error('ENCRYPTION_KEY must be provided in production environment');
    }

    // Generate a random 32-character hex string for development
    const crypto = require('crypto');
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Validate required environment variables
   */
  validateRequired() {
    const errors = [];

    // Production environment requires all variables to be explicitly set
    if (this.config.NODE_ENV === 'production') {
      if (!process.env.JWT_SECRET) {
        errors.push('JWT_SECRET must be provided in production environment');
      }
      if (!process.env.ENCRYPTION_KEY) {
        errors.push('ENCRYPTION_KEY must be provided in production environment');
      }
      if (!process.env.MONGODB_URI) {
        errors.push('MONGODB_URI must be provided in production environment');
      }
    }

    // JWT Secret validation (always validate if provided)
    if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
      errors.push('JWT_SECRET must be at least 32 characters long');
    }

    // Encryption key validation (always validate if provided)
    if (process.env.ENCRYPTION_KEY && process.env.ENCRYPTION_KEY.length !== 32) {
      errors.push('ENCRYPTION_KEY must be exactly 32 characters');
    }

    // Port validation (always validate)
    if (this.config.PORT < 1 || this.config.PORT > 65535) {
      errors.push('PORT must be between 1 and 65535');
    }

    // Environment validation (always validate)
    const validEnvironments = ['development', 'test', 'production'];
    if (!validEnvironments.includes(this.config.NODE_ENV)) {
      errors.push(`NODE_ENV must be one of: ${validEnvironments.join(', ')}`);
    }

    if (errors.length > 0) {
      throw new Error(`Environment configuration errors:\n${errors.map(err => `- ${err}`).join('\n')}`);
    }
  }

  /**
   * Check if running in production
   */
  isProduction() {
    return this.config.NODE_ENV === 'production';
  }

  /**
   * Check if running in development
   */
  isDevelopment() {
    return this.config.NODE_ENV === 'development';
  }

  /**
   * Check if running in test
   */
  isTest() {
    return this.config.NODE_ENV === 'test';
  }

  /**
   * Get configuration object
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Get specific configuration value
   */
  get(key) {
    return this.config[key];
  }

  /**
   * Print configuration summary (excluding sensitive data)
   */
  printSummary() {
    const summary = {
      NODE_ENV: this.config.NODE_ENV,
      PORT: this.config.PORT,
      MONGODB_URI: this.maskConnectionString(this.config.MONGODB_URI),
      JWT_EXPIRES_IN: this.config.JWT_EXPIRES_IN,
      BCRYPT_SALT_ROUNDS: this.config.BCRYPT_SALT_ROUNDS,
      CORS_ORIGIN: this.config.CORS_ORIGIN,
      LOG_LEVEL: this.config.LOG_LEVEL,
    };

    // Use simple console logging since logger might not be initialized yet
    const tempLogger = winston.createLogger({
      level: 'info',
      format: winston.format.simple(),
      transports: [new winston.transports.Console()],
    });

    tempLogger.info('📋 Environment Configuration:');
    Object.entries(summary).forEach(([key, value]) => {
      tempLogger.info(`   ${key}: ${value}`);
    });
  }

  /**
   * Mask sensitive parts of connection string for logging
   */
  maskConnectionString(uri) {
    if (!uri) return 'Not configured';

    try {
      const url = new URL(uri);
      if (url.password) {
        url.password = '***';
      }
      return url.toString();
    } catch {
      // If it's not a valid URL, just mask after the first part
      return uri.replace(/:\/\/[^@]+@/, '://***:***@');
    }
  }
}

// Create singleton instance that can be reinitialized for testing
let envConfig = new EnvironmentConfig();

// Allow re-initialization for testing
function reinitialize() {
  envConfig = new EnvironmentConfig();
  return envConfig;
}

module.exports = {
  config: envConfig.getConfig(),
  get: (key) => envConfig.get(key),
  isProduction: () => envConfig.isProduction(),
  isDevelopment: () => envConfig.isDevelopment(),
  isTest: () => envConfig.isTest(),
  printSummary: () => envConfig.printSummary(),
  reinitialize: reinitialize,
};
