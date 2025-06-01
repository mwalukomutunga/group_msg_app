const jwt = require('jsonwebtoken');
const env = require('../config/environment');

// In-memory token blacklist (would be replaced with Redis or database in production)
const tokenBlacklist = new Set();

function generateToken(payload) {
  if (!payload || !payload.userId || !payload.email) {
    throw new Error('Token payload must include userId and email');
  }

  try {
    const secret = env.get('JWT_SECRET');
    const expiresIn = env.get('JWT_EXPIRES_IN');

    const tokenPayload = {
      userId: payload.userId,
      email: payload.email,
      iat: Math.floor(Date.now() / 1000),
    };

    return jwt.sign(tokenPayload, secret, {
      expiresIn: expiresIn,
      algorithm: 'HS256',
    });
  } catch (error) {
    throw new Error(`Token generation failed: ${error.message}`);
  }
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') {
    throw new Error('Token must be a non-empty string');
  }

  try {
    const secret = env.get('JWT_SECRET');
    return jwt.verify(token, secret, { algorithms: ['HS256'] });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token has expired');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token');
    } else if (error.name === 'NotBeforeError') {
      throw new Error('Token not active yet');
    } else {
      throw new Error(`Token verification failed: ${error.message}`);
    }
  }
}

function extractTokenFromHeader(authHeader) {
  if (!authHeader || typeof authHeader !== 'string') {
    return null;
  }

  const bearerPrefix = 'Bearer ';
  if (!authHeader.startsWith(bearerPrefix)) {
    return null;
  }

  const token = authHeader.substring(bearerPrefix.length).trim();
  return token.length > 0 ? token : null;
}

/**
 * Check if a token has been blacklisted
 * @param {string} token - The JWT token to check
 * @returns {boolean} - true if token is blacklisted, false otherwise
 */
function isTokenBlacklisted(token) {
  return tokenBlacklist.has(token);
}

/**
 * Add a token to the blacklist (used for logout functionality)
 * @param {string} token - The JWT token to blacklist
 */
function blacklistToken(token) {
  if (token && typeof token === 'string') {
    tokenBlacklist.add(token);
    return true;
  }
  return false;
}

module.exports = {
  generateToken,
  verifyToken,
  extractTokenFromHeader,
  isTokenBlacklisted,
  blacklistToken,
};
