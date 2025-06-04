const winston = require('winston');
const path = require('path');
const env = require('../config/environment');
const fs = require('fs');


const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};


const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};


winston.addColors(colors);


const getFormat = () => {

  if (env.isTest()) {
    return winston.format.simple();
  }


  if (env.isProduction()) {
    return winston.format.combine(
      winston.format.timestamp(),
      winston.format.json(),
    );
  }


  return winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.colorize({ all: true }),
    winston.format.printf(
      (info) => `${info.timestamp} ${info.level}: ${info.message}`,
    ),
  );
};


const getTransports = () => {
  const transports = [
    new winston.transports.Console(),
  ];


  if (env.isProduction()) {
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
