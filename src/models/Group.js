const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Group name is required'],
    trim: true,
    minlength: [2, 'Group name must be at least 2 characters long'],
    maxlength: [50, 'Group name cannot exceed 50 characters'],
    unique: true,
  },

  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Group description cannot exceed 500 characters'],
  },

  type: {
    type: String,
    enum: ['public', 'private'],
    required: [true, 'Group type is required'],
    default: 'public',
  },

  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Group owner is required'],
  },

  members: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'pending', 'banned'],
      default: 'active',
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    lastBannedAt: {
      type: Date,
    },
    banReason: {
      type: String,
      maxlength: [200, 'Ban reason cannot exceed 200 characters'],
    },
  }],

  memberLimit: {
    type: Number,
    min: [2, 'Group must allow at least 2 members'],
    max: [1000, 'Group cannot exceed 1000 members'],
    default: 100,
  },

  settings: {
    requireApproval: {
      type: Boolean,
      default: function() {
        return this.type === 'private';
      },
    },
    allowMemberInvites: {
      type: Boolean,
      default: true,
    },
    cooldownPeriod: {
      type: Number, // hours
      default: 48,
      min: [0, 'Cooldown period cannot be negative'],
    },
  },

  stats: {
    totalMessages: {
      type: Number,
      default: 0,
    },
    lastActivity: {
      type: Date,
      default: Date.now,
    },
  },
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    },
  },
  toObject: { virtuals: true },
});

// Indexes for performance
groupSchema.index({ name: 1 });
groupSchema.index({ type: 1 });
groupSchema.index({ owner: 1 });
groupSchema.index({ 'members.user': 1 });
groupSchema.index({ createdAt: -1 });

// Virtual for member count
groupSchema.virtual('memberCount').get(function() {
  return this.members.filter(member => member.status === 'active').length;
});

// Virtual for pending member count
groupSchema.virtual('pendingMemberCount').get(function() {
  return this.members.filter(member => member.status === 'pending').length;
});

// Instance method to check if user is a member
groupSchema.methods.isMember = function(userId) {
  return this.members.some(member =>
    member.user.toString() === userId.toString() &&
    member.status === 'active',
  );
};

// Instance method to check if user is owner
groupSchema.methods.isOwner = function(userId) {
  return this.owner.toString() === userId.toString();
};

// Instance method to check if user is banned
groupSchema.methods.isBanned = function(userId) {
  const member = this.members.find(member =>
    member.user.toString() === userId.toString(),
  );
  return member ? member.status === 'banned' : false;
};

// Instance method to check if user has pending request
groupSchema.methods.hasPendingRequest = function(userId) {
  return this.members.some(member =>
    member.user.toString() === userId.toString() &&
    member.status === 'pending',
  );
};

// Instance method to check cooldown period for banned user
groupSchema.methods.isInCooldownPeriod = function(userId) {
  const member = this.members.find(member =>
    member.user.toString() === userId.toString() &&
    member.status === 'banned',
  );

  if (!member || !member.lastBannedAt) {
    return false;
  }

  const cooldownMs = this.settings.cooldownPeriod * 60 * 60 * 1000; // Convert hours to milliseconds
  const timeSinceBan = Date.now() - member.lastBannedAt.getTime();

  return timeSinceBan < cooldownMs;
};

// Instance method to get member details
groupSchema.methods.getMember = function(userId) {
  return this.members.find(member =>
    member.user.toString() === userId.toString(),
  );
};

// Instance method to add member
groupSchema.methods.addMember = function(userId, status = 'active') {
  // Check if user is already a member
  const existingMember = this.members.find(member =>
    member.user.toString() === userId.toString(),
  );

  if (existingMember) {
    // Update existing member status
    existingMember.status = status;
    existingMember.joinedAt = new Date();
    if (status === 'banned') {
      existingMember.lastBannedAt = new Date();
    }
  } else {
    // Add new member
    this.members.push({
      user: userId,
      status: status,
      joinedAt: new Date(),
      lastBannedAt: status === 'banned' ? new Date() : undefined,
    });
  }

  return this.save();
};

// Instance method to remove member
groupSchema.methods.removeMember = function(userId) {
  this.members = this.members.filter(member =>
    member.user.toString() !== userId.toString(),
  );
  return this.save();
};

// Instance method to ban member
groupSchema.methods.banMember = function(userId, reason = '') {
  const member = this.members.find(member =>
    member.user.toString() === userId.toString(),
  );

  if (member) {
    member.status = 'banned';
    member.lastBannedAt = new Date();
    member.banReason = reason;
  }

  return this.save();
};

// Instance method to approve pending member
groupSchema.methods.approveMember = function(userId) {
  const member = this.members.find(member =>
    member.user.toString() === userId.toString() &&
    member.status === 'pending',
  );

  if (member) {
    member.status = 'active';
    member.joinedAt = new Date();
  }

  return this.save();
};

// Pre-save middleware to ensure owner is always an active member
groupSchema.pre('save', function(next) {
  // Ensure owner is in members array with active status
  const ownerMember = this.members.find(member =>
    member.user.toString() === this.owner.toString(),
  );

  if (!ownerMember) {
    this.members.unshift({
      user: this.owner,
      status: 'active',
      joinedAt: this.createdAt || new Date(),
    });
  } else if (ownerMember.status !== 'active') {
    ownerMember.status = 'active';
  }

  next();
});

// Pre-save middleware to update last activity
groupSchema.pre('save', function(next) {
  if (this.isModified('members') || this.isModified('stats.totalMessages')) {
    this.stats.lastActivity = new Date();
  }
  next();
});

module.exports = mongoose.model('Group', groupSchema);
