const mongoose = require('mongoose');
require('dotenv').config();
const { globalSetup } = require('./database');

/**
 * Jest global setup - runs once before all tests
 */
module.exports = async () => {
  console.log('🌟 Jest Global Setup Starting...');
  
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret-key-at-least-32-characters-long-for-testing-purposes';
  process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef';
  process.env.RATE_LIMIT_WINDOW_MS = '60000';
  process.env.RATE_LIMIT_MAX_REQUESTS = '100';
  
  // Ensure MONGODB_URI is available for tests (should be loaded from .env)
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is required for tests. Make sure .env file exists with Atlas connection string.');
  }
  
  // Configure Mongoose globally for tests
  mongoose.set('bufferCommands', false);
  
  // Initialize test database
  try {
    await globalSetup();
    console.log('✅ Jest Global Setup Completed Successfully');
  } catch (error) {
    console.error('❌ Jest Global Setup Failed:', error.message);
    throw error;
  }
};
