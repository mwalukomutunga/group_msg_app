const bcrypt = require('bcrypt');

async function hashPassword(plainPassword) {
  if (!plainPassword || typeof plainPassword !== 'string') {
    throw new Error('Password must be a non-empty string');
  }

  try {
    const saltRounds = 12;
    return await bcrypt.hash(plainPassword, saltRounds);
  } catch (error) {
    throw new Error(`Password hashing failed: ${error.message}`);
  }
}

async function comparePasswords(plainPassword, hashedPassword) {
  if (!plainPassword || !hashedPassword) {
    return false;
  }

  try {
    return await bcrypt.compare(plainPassword, hashedPassword);
  } catch (error) {
    throw new Error(`Password comparison failed: ${error.message}`);
  }
}

function validatePasswordStrength(password) {
  if (!password || typeof password !== 'string') {
    return false;
  }

  return password.length >= 8 &&
         /[A-Z]/.test(password) &&
         /[a-z]/.test(password) &&
         /\d/.test(password);
}

module.exports = {
  hashPassword,
  comparePasswords,
  validatePasswordStrength,
};
