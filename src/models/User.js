const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const validator = require('validator');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: function(email) {
        return validator.isEmail(email);
      },
      message: 'Please provide a valid email address',
    },
    index: true,
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters long'],
    validate: {
      validator: function(password) {
        return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password);
      },
      message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
    },
  },
}, {
  timestamps: true,
  collection: 'users',
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }

  try {
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(this.password, saltRounds);
    this.password = hashedPassword;
    next();
  } catch (error) {
    next(error);
  }
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    if (!candidatePassword) {
      return false;
    }

    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Password comparison failed');
  }
};

userSchema.methods.toJSON = function() {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.__v;
  return userObject;
};

userSchema.statics.findByEmail = async function(email) {
  try {

    return await this.findOne(
      { email: email.toLowerCase() },
      {},
      { maxTimeMS: 15000 }, // 15-second timeout
    ).exec();
  } catch (error) {
    if (error.name === 'MongooseError' && error.message.includes('buffering timed out')) {

      console.warn('Database operation timed out in findByEmail:', error.message);
      return null;
    }
    throw error;
  }
};

userSchema.post('save', function(error, doc, next) {
  if (error.name === 'MongoServerError' && error.code === 11000) {
    if (error.keyPattern && error.keyPattern.email) {
      next(new Error('Email address is already registered'));
    } else {
      next(new Error('Duplicate key error'));
    }
  } else {
    next(error);
  }
});

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ createdAt: 1 });

const User = mongoose.model('User', userSchema);

module.exports = User;
