const crypto = require('crypto');
const env = require('../config/environment');
const logger = require('./logger');

/**
 * Message encryption utilities using AES-128-CBC
 * Provides secure encryption and decryption for message content
 */

// Encryption configuration
const ALGORITHM = 'aes-128-cbc';
const KEY_LENGTH = 16; // 128 bits / 8 = 16 bytes
const IV_LENGTH = 16; // 128 bits / 8 = 16 bytes

/**
 * Get encryption key from environment
 * @returns {Buffer} - 16-byte encryption key
 */
function getEncryptionKey() {
  const keyHex = env.get('ENCRYPTION_KEY');

  if (!keyHex) {
    throw new Error('ENCRYPTION_KEY environment variable is required');
  }

  if (keyHex.length !== 32) { // 32 hex characters = 16 bytes
    throw new Error('ENCRYPTION_KEY must be exactly 32 hexadecimal characters (16 bytes)');
  }

  try {
    return Buffer.from(keyHex, 'hex');
  } catch (error) {
    throw new Error('ENCRYPTION_KEY must be valid hexadecimal');
  }
}

/**
 * Generate a random initialization vector
 * @returns {Buffer} - 16-byte random IV
 */
function generateIV() {
  return crypto.randomBytes(IV_LENGTH);
}

/**
 * Encrypt message content using AES-128-CBC
 * @param {string} plaintext - The message content to encrypt
 * @returns {Object} - Object containing encrypted content and IV
 */
function encryptMessage(plaintext) {
  try {
    if (!plaintext || typeof plaintext !== 'string') {
      throw new Error('Plaintext must be a non-empty string');
    }

    // Validate plaintext length (prevent extremely large messages)
    if (plaintext.length > 10000) {
      throw new Error('Message content too large for encryption');
    }

    const key = getEncryptionKey();
    const iv = generateIV();

    // Create cipher
    const cipher = crypto.createCipher ?
      crypto.createCipheriv(ALGORITHM, key, iv) :
      crypto.createCipheriv(ALGORITHM, key, iv);

    // Encrypt the message
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    return {
      encryptedContent: encrypted,
      iv: iv.toString('hex'),
      algorithm: ALGORITHM,
      keyVersion: 1,
    };

  } catch (error) {
    logger.error('Encryption error:', { message: error.message, stack: error.stack });
    throw new Error('Failed to encrypt message content');
  }
}

/**
 * Decrypt message content using AES-128-CBC
 * @param {string} encryptedContent - Base64 encoded encrypted content
 * @param {string} ivHex - Hexadecimal encoded initialization vector
 * @param {string} algorithm - Encryption algorithm used (default: aes-128-cbc)
 * @returns {string} - Decrypted plaintext message
 */
function decryptMessage(encryptedContent, ivHex, algorithm = ALGORITHM) {
  try {
    if (!encryptedContent || !ivHex) {
      throw new Error('Encrypted content and IV are required for decryption');
    }

    if (algorithm !== ALGORITHM) {
      throw new Error(`Unsupported encryption algorithm: ${algorithm}`);
    }

    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');

    // Validate IV length
    if (iv.length !== IV_LENGTH) {
      throw new Error('Invalid initialization vector length');
    }

    // Create decipher
    const decipher = crypto.createDecipheriv(algorithm, key, iv);

    // Decrypt the message
    let decrypted = decipher.update(encryptedContent, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;

  } catch (error) {
    logger.error('Decryption error:', { message: error.message, stack: error.stack });
    throw new Error('Failed to decrypt message content');
  }
}

/**
 * Generate a new encryption key (for development/setup purposes)
 * @returns {string} - 32-character hexadecimal key
 */
function generateEncryptionKey() {
  const key = crypto.randomBytes(KEY_LENGTH);
  return key.toString('hex');
}

/**
 * Validate encryption key format
 * @param {string} keyHex - Hexadecimal key string
 * @returns {boolean} - True if key is valid format
 */
function validateEncryptionKey(keyHex) {
  if (!keyHex || typeof keyHex !== 'string') {
    return false;
  }

  if (keyHex.length !== 32) {
    return false;
  }

  // Check if it's valid hexadecimal
  return /^[0-9a-fA-F]{32}$/.test(keyHex);
}

/**
 * Encrypt and prepare message for database storage
 * @param {string} plaintext - Message content
 * @returns {Object} - Database-ready encrypted message object
 */
function prepareMessageForStorage(plaintext) {
  const encryptionResult = encryptMessage(plaintext);

  return {
    content: plaintext, // Keep plaintext for model validation
    encryptedContent: encryptionResult.encryptedContent,
    encryption: {
      iv: encryptionResult.iv,
      algorithm: encryptionResult.algorithm,
      keyVersion: encryptionResult.keyVersion,
    },
  };
}

/**
 * Decrypt message from database storage
 * @param {Object} messageDoc - Message document from database
 * @returns {string} - Decrypted message content
 */
function decryptMessageFromStorage(messageDoc) {
  if (!messageDoc.encryptedContent || !messageDoc.encryption) {
    throw new Error('Message document missing encryption data');
  }

  return decryptMessage(
    messageDoc.encryptedContent,
    messageDoc.encryption.iv,
    messageDoc.encryption.algorithm,
  );
}

/**
 * Test encryption/decryption functionality
 * @param {string} testMessage - Test message (optional)
 * @returns {Object} - Test results
 */
function testEncryption(testMessage = 'Test message for encryption validation') {
  try {
    const encrypted = encryptMessage(testMessage);
    const decrypted = decryptMessage(encrypted.encryptedContent, encrypted.iv);

    return {
      success: decrypted === testMessage,
      original: testMessage,
      encrypted: encrypted.encryptedContent,
      decrypted: decrypted,
      keyValid: validateEncryptionKey(env.get('ENCRYPTION_KEY')),
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      keyValid: validateEncryptionKey(env.get('ENCRYPTION_KEY')),
    };
  }
}

/**
 * Secure key rotation utilities (for future implementation)
 */
const keyRotation = {
  /**
   * Check if a message uses the current key version
   * @param {Object} messageDoc - Message document
   * @returns {boolean} - True if using current key version
   */
  isCurrentKeyVersion(messageDoc) {
    const currentVersion = 1; // This would come from environment/config
    return messageDoc.encryption && messageDoc.encryption.keyVersion === currentVersion;
  },

  /**
   * Re-encrypt message with new key (placeholder for future implementation)
   * @param {Object} _messageDoc - Message document to re-encrypt
   * @returns {Object} - Re-encrypted message data
   */
  reencryptMessage(_messageDoc) {
    // This would be implemented when key rotation is needed
    throw new Error('Key rotation not yet implemented');
  },
};

module.exports = {
  // Core encryption functions
  encryptMessage,
  decryptMessage,

  // Utility functions
  generateEncryptionKey,
  validateEncryptionKey,
  testEncryption,

  // Database integration helpers
  prepareMessageForStorage,
  decryptMessageFromStorage,

  // Key rotation utilities (future)
  keyRotation,

  // Constants
  ALGORITHM,
  KEY_LENGTH,
  IV_LENGTH,
};
