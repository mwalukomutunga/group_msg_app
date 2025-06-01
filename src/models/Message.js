const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  content: {
    type: String,
    required: [true, 'Message content is required'],
    maxlength: [2000, 'Message content cannot exceed 2000 characters'],
  },

  encryptedContent: {
    type: String,
    required: true,
  },

  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Message sender is required'],
  },

  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: [true, 'Message group is required'],
  },

  messageType: {
    type: String,
    enum: ['text', 'system'],
    default: 'text',
  },

  status: {
    type: String,
    enum: ['sent', 'delivered', 'failed'],
    default: 'sent',
  },

  metadata: {
    clientId: {
      type: String,
      maxlength: [100, 'Client ID cannot exceed 100 characters'],
    },
    edited: {
      type: Boolean,
      default: false,
    },
    editedAt: {
      type: Date,
    },
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
    },
  },

  encryption: {
    iv: {
      type: String,
      required: true,
    },
    algorithm: {
      type: String,
      default: 'aes-128-cbc',
    },
    keyVersion: {
      type: Number,
      default: 1,
    },
  },
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function(doc, ret) {
      // Remove encryption details from JSON output
      delete ret.encryptedContent;
      delete ret.encryption;
      delete ret.__v;
      return ret;
    },
  },
  toObject: { virtuals: true },
});

// Indexes for performance
messageSchema.index({ group: 1, createdAt: -1 }); // For retrieving messages by group, newest first
messageSchema.index({ sender: 1, createdAt: -1 }); // For user's message history
messageSchema.index({ group: 1, sender: 1 }); // For group member message lookup
messageSchema.index({ createdAt: -1 }); // For general message sorting
messageSchema.index({ 'metadata.clientId': 1 }); // For client-side message tracking

// Virtual for message age
messageSchema.virtual('age').get(function() {
  return Date.now() - this.createdAt.getTime();
});

// Virtual for formatted timestamp
messageSchema.virtual('formattedTime').get(function() {
  return this.createdAt.toISOString();
});

// Instance method to check if user can edit this message
messageSchema.methods.canEdit = function(userId, timeLimit = 15 * 60 * 1000) { // 15 minutes default
  // Only sender can edit
  if (this.sender.toString() !== userId.toString()) {
    return false;
  }

  // Only text messages can be edited
  if (this.messageType !== 'text') {
    return false;
  }

  // Check time limit
  const timeSinceCreation = Date.now() - this.createdAt.getTime();
  return timeSinceCreation < timeLimit;
};

// Instance method to check if user can delete this message
messageSchema.methods.canDelete = function(userId, isGroupOwner = false) {
  // Sender can always delete their own messages
  if (this.sender.toString() === userId.toString()) {
    return true;
  }

  // Group owners can delete any message in their group
  return isGroupOwner;
};

// Instance method to mark message as edited
messageSchema.methods.markAsEdited = function() {
  this.metadata.edited = true;
  this.metadata.editedAt = new Date();
  return this.save();
};

// Static method to get recent messages for a group
messageSchema.statics.getRecentMessages = function(groupId, limit = 50, before = null) {
  let query = { group: groupId };

  if (before) {
    query.createdAt = { $lt: before };
  }

  return this.find(query)
    .populate('sender', 'email _id')
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Static method to get message count for a group
messageSchema.statics.getMessageCount = function(groupId) {
  return this.countDocuments({ group: groupId });
};

// Static method to get messages with pagination
messageSchema.statics.getMessagesPaginated = function(groupId, page = 1, limit = 50) {
  const skip = (page - 1) * limit;

  return Promise.all([
    this.find({ group: groupId })
      .populate('sender', 'email _id')
      .populate('metadata.replyTo', 'content sender createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    this.countDocuments({ group: groupId }),
  ]).then(([messages, total]) => ({
    messages: messages.reverse(), // Reverse to get chronological order
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: total,
      pages: Math.ceil(total / limit),
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    },
  }));
};

// Static method to search messages in a group
messageSchema.statics.searchMessages = function(groupId, searchTerm, limit = 20) {
  return this.find({
    group: groupId,
    content: { $regex: new RegExp(searchTerm, 'i') },
    messageType: 'text',
  })
    .populate('sender', 'email _id')
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Pre-save middleware to update group's last activity and message count
messageSchema.pre('save', async function(next) {
  if (this.isNew) {
    try {
      // Update group's last activity and increment message count
      const Group = mongoose.model('Group');
      await Group.findByIdAndUpdate(this.group, {
        'stats.lastActivity': new Date(),
        $inc: { 'stats.totalMessages': 1 },
      });
    } catch (error) {
      console.error('Error updating group stats:', error);
    }
  }
  next();
});

// Pre-remove middleware to decrement group message count
messageSchema.pre('remove', async function(next) {
  try {
    const Group = mongoose.model('Group');
    await Group.findByIdAndUpdate(this.group, {
      $inc: { 'stats.totalMessages': -1 },
    });
  } catch (error) {
    console.error('Error updating group stats on message removal:', error);
  }
  next();
});

module.exports = mongoose.model('Message', messageSchema);
