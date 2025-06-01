const winston = require('winston');
const path = require('path');
const env = require('../config/environment');
const fs = require('fs');

// Define log levels with corresponding colors and priority
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each log level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Add colors to Winston
winston.addColors(colors);

// Check if running on Vercel
const isVercel = process.env.VERCEL === '1';

// Define format based on environment
const getFormat = () => {
  // Use simple format for test environment
  if (env.isTest()) {
    return winston.format.simple();
  }

  // For production, use JSON format
  if (env.isProduction()) {
    return winston.format.combine(
      winston.format.timestamp(),
      winston.format.json(),
    );
  }

  // For development, use colorized format with timestamp
  return winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.colorize({ all: true }),
    winston.format.printf(
      (info) => `${info.timestamp} ${info.level}: ${info.message}`,
    ),
  );
};

// Define which transports to use based on environment
const getTransports = () => {
  const transports = [
    new winston.transports.Console(),
  ];

  // Add file transports in production, but only if not on Vercel
  if (env.isProduction() && !isVercel) {
    // Ensure logs directory exists
    try {
      if (!fs.existsSync('logs')) {
        fs.mkdirSync('logs');
      }
      
      transports.push(
        new winston.transports.File({
          filename: path.join('logs', 'error.log'),
          level: 'error',
        }),
        new winston.transports.File({
          filename: path.join('logs', 'combined.log'),
        }),
      );
    } catch (error) {
      console.error('Failed to set up file logging:', error.message);
      // Continue with console logging only
    }
  }

  return transports;
};

// Create the Winston logger
const logger = winston.createLogger({
  level: env.get('LOG_LEVEL') || 'info',
  levels,
  format: getFormat(),
  transports: getTransports(),
});

// Add request context to enhance logs with request IDs when available
const enhanceWithRequestContext = (originalMessage, context = {}) => {
  if (typeof originalMessage === 'object') {
    return { ...originalMessage, ...context };
  }

  // If it's a string and we have context, add context as metadata
  if (Object.keys(context).length > 0) {
    return { message: originalMessage, ...context };
  }

  return originalMessage;
};

// Export a wrapper that allows adding context
module.exports = {
  error: (message, context) => {
    logger.error(enhanceWithRequestContext(message, context));
  },
  warn: (message, context) => {
    logger.warn(enhanceWithRequestContext(message, context));
  },
  info: (message, context) => {
    logger.info(enhanceWithRequestContext(message, context));
  },
  http: (message, context) => {
    logger.http(enhanceWithRequestContext(message, context));
  },
  debug: (message, context) => {
    logger.debug(enhanceWithRequestContext(message, context));
  },

  // Special method for creating child loggers with specific context
  child: (context) => {
    return {
      error: (message, additionalContext) => {
        logger.error(enhanceWithRequestContext(message, { ...context, ...additionalContext }));
      },
      warn: (message, additionalContext) => {
        logger.warn(enhanceWithRequestContext(message, { ...context, ...additionalContext }));
      },
      info: (message, additionalContext) => {
        logger.info(enhanceWithRequestContext(message, { ...context, ...additionalContext }));
      },
      http: (message, additionalContext) => {
        logger.http(enhanceWithRequestContext(message, { ...context, ...additionalContext }));
      },
      debug: (message, additionalContext) => {
        logger.debug(enhanceWithRequestContext(message, { ...context, ...additionalContext }));
      },
    };
  },

  // Export the raw winston logger for advanced use cases
  raw: logger,
};
