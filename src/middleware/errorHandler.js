const env = require('../config/environment');
const { AppError } = require('../utils/errors');
const logger = require('../utils/logger');

function globalErrorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  logger.error('Global Error Handler:', {
    error: err.message,
    stack: env.isDevelopment() ? err.stack : undefined,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    requestId: req.id || 'unknown',
    timestamp: new Date().toISOString(),
  });

  // Default error values
  let statusCode = 500;
  let errorResponse = {
    success: false,
    message: 'Internal server error',
    error: 'INTERNAL_SERVER_ERROR',
  };

  // Handle custom AppError instances
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    errorResponse = {
      success: false,
      message: err.message,
      error: err.errorCode,
    };

    // Add specific fields for certain error types
    if (err.errors) {
      errorResponse.errors = err.errors;
    }
    if (err.field) {
      errorResponse.field = err.field;
    }
    if (err.retryAfter) {
      errorResponse.retryAfter = err.retryAfter;
    }
  }
  // Handle Mongoose validation errors
  else if (err.name === 'ValidationError') {
    statusCode = 400;
    errorResponse = {
      success: false,
      message: 'Validation failed',
      error: 'VALIDATION_ERROR',
      errors: Object.values(err.errors).map(error => ({
        field: error.path,
        message: error.message,
        value: error.value,
      })),
    };
  }
  // Handle MongoDB duplicate key errors
  else if (err.name === 'MongoServerError' && err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue)[0];
    errorResponse = {
      success: false,
      message: `${field} already exists`,
      error: 'DUPLICATE_KEY_ERROR',
      field: field,
    };
  }
  // Handle Mongoose cast errors
  else if (err.name === 'CastError') {
    statusCode = 400;
    errorResponse = {
      success: false,
      message: 'Invalid data format',
      error: 'INVALID_DATA_FORMAT',
      field: err.path,
    };
  }
  // Handle JWT errors
  else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    errorResponse = {
      success: false,
      message: 'Invalid authentication token',
      error: 'INVALID_TOKEN',
    };
  }
  else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    errorResponse = {
      success: false,
      message: 'Authentication token has expired',
      error: 'TOKEN_EXPIRED',
    };
  }
  // Handle body parser errors
  else if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    errorResponse = {
      success: false,
      message: 'Invalid JSON format in request body',
      error: 'INVALID_JSON_FORMAT',
    };
  }
  else if (err.type === 'entity.too.large') {
    statusCode = 413;
    errorResponse = {
      success: false,
      message: 'Request payload too large',
      error: 'PAYLOAD_TOO_LARGE',
    };
  }
  // Handle HTTP errors
  else if (err.status && err.status >= 400 && err.status < 600) {
    statusCode = err.status;
    errorResponse = {
      success: false,
      message: err.message || 'Request failed',
      error: err.code || 'HTTP_ERROR',
    };
  }
  // Handle Joi validation errors
  else if (err.isJoi || (err.details && Array.isArray(err.details))) {
    statusCode = 400;
    errorResponse = {
      success: false,
      message: 'Validation failed',
      error: 'VALIDATION_ERROR',
      errors: err.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
      })),
    };
  }

  // Add debug information in development
  if (env.isDevelopment()) {
    errorResponse.debug = {
      stack: err.stack,
      timestamp: new Date().toISOString(),
      requestId: req.id || 'unknown',
    };
  }

  // Standardize response formats for authentication errors
  // Always return 401 for auth errors instead of 500, even for unexpected ones
  if (req.path.includes('/api/') &&
      (err.toString().includes('token') ||
       err.toString().includes('Token') ||
       err.toString().includes('auth') ||
       err.toString().includes('Auth'))) {

    statusCode = 401;
    errorResponse = {
      success: false,
      message: 'Authentication failed',
      error: 'AUTHENTICATION_ERROR',
    };
  }

  // Sanitize error message in production for 500 errors
  if (!env.isDevelopment() && statusCode === 500) {
    errorResponse.message = 'An internal error occurred';
  }

  res.status(statusCode).json(errorResponse);
}

function notFoundHandler(req, res) {
  const errorResponse = {
    success: false,
    message: 'Route not found',
    error: 'ROUTE_NOT_FOUND',
    errors: null,
    availableRoutes: {
      health: 'GET /health',
      auth: [
        'POST /api/v1/auth/register',
        'POST /api/v1/auth/login',
      ],
      users: [
        'GET /api/v1/users/profile',
        'PUT /api/v1/users/profile',
        'GET /api/v1/users/stats',
        'PUT /api/v1/users/password',
        'DELETE /api/v1/users/account',
      ],
      groups: [
        'POST /api/v1/groups',
        'GET /api/v1/groups',
        'GET /api/v1/groups/:groupId',
        'POST /api/v1/groups/:groupId/join',
        'POST /api/v1/groups/:groupId/leave',
      ],
      messages: [
        'POST /api/v1/groups/:groupId/messages',
        'GET /api/v1/groups/:groupId/messages',
        'GET /api/v1/messages/:messageId',
        'DELETE /api/v1/messages/:messageId',
      ],
    },
  };

  res.status(404).json(errorResponse);
}

function securityErrorHandler(err, req, res) {
  logger.warn('Security Event:', {
    type: err.type || 'SECURITY_ERROR',
    message: err.message,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    url: req.url,
    method: req.method,
    requestId: req.id || 'unknown',
    timestamp: new Date().toISOString(),
  });

  const errorResponse = {
    success: false,
    message: 'Access denied',
    error: 'SECURITY_ERROR',
  };

  res.status(403).json(errorResponse);
}

function asyncErrorHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function rateLimitHandler(req, res) {
  const errorResponse = {
    success: false,
    message: 'Too many requests. Please try again later.',
    error: 'RATE_LIMIT_EXCEEDED',
    retryAfter: res.get('Retry-After') || '15 minutes',
  };

  res.status(429).json(errorResponse);
}

function requestId(req, res, next) {
  req.id = Math.random().toString(36).substring(2, 15) +
           Math.random().toString(36).substring(2, 15);
  res.set('X-Request-ID', req.id);
  next();
}

module.exports = {
  globalErrorHandler,
  notFoundHandler,
  securityErrorHandler,
  asyncErrorHandler,
  rateLimitHandler,
  requestId,
};
