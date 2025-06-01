/**
 * Group Service
 *
 * Handles all business logic related to group management,
 * including creation, updating, membership, and retrieval.
 */

const logger = require('../utils/logger');

/**
 * Create the group service with injected dependencies
 *
 * @param {Object} container - The dependency injection container
 * @returns {Object} The group service methods
 */
module.exports = function(container) {
  // Get dependencies from the container
  const Group = container.get('groupModel');
  const User = container.get('userModel');
  const {
    NotFoundError,
    ValidationError,
    AuthorizationError,
    ConflictError,
    InternalError,
  } = container.get('errorUtils');

  /**
   * Create a new group
   *
   * @param {string} userId - ID of the user creating the group (will be set as owner)
   * @param {Object} groupData - The group data
   * @returns {Object} The created group
   * @throws {ValidationError} If validation fails
   * @throws {InternalError} If there's a database error
   */
  async function createGroup(userId, groupData) {
    try {
      // Create group with the user as owner
      const group = new Group({
        ...groupData,
        owner: userId,
        members: [{ user: userId }], // Owner is automatically a member with default status 'active'
      });

      const savedGroup = await group.save();
      return savedGroup.toJSON();
    } catch (error) {
      if (error.name === 'ValidationError') {
        throw new ValidationError(
          'Validation failed',
          Object.keys(error.errors).map(field => ({
            field,
            message: error.errors[field].message,
          })),
        );
      }

      logger.error('Error creating group:', { message: error.message, stack: error.stack });
      throw new InternalError('Group service error', 'DATABASE_ERROR');
    }
  }

  /**
   * Get a group by ID
   *
   * @param {string} groupId - The ID of the group to retrieve
   * @returns {Object} The group data
   * @throws {NotFoundError} If group doesn't exist
   * @throws {InternalError} If there's a database error
   */
  async function getGroupById(groupId) {
    try {
      const group = await Group.findById(groupId).populate('owner', 'email');

      if (!group) {
        throw new NotFoundError('Group not found', 'GROUP_NOT_FOUND');
      }

      return group.toJSON();
    } catch (error) {
      if (error.name === 'CastError') {
        throw new ValidationError('Invalid group ID format', 'INVALID_ID');
      }

      if (error instanceof NotFoundError) {
        throw error;
      }

      logger.error('Error retrieving group:', { message: error.message, stack: error.stack });
      throw new InternalError('Group service error', 'DATABASE_ERROR');
    }
  }

  /**
   * Get all groups (with pagination)
   *
   * @param {Object} options - Query options
   * @param {number} options.page - Page number (1-based)
   * @param {number} options.limit - Number of items per page
   * @param {string} options.type - Filter by group type (public, private)
   * @returns {Object} Paginated groups data
   */
  async function getGroups({ page = 1, limit = 10, type = null } = {}) {
    try {
      const skip = (page - 1) * limit;

      // Build query object
      const query = {};
      if (type) {
        query.type = type;
      }

      const groups = await Group.find(query)
        .populate('owner', 'email')
        .skip(skip)
        .limit(limit);

      const total = await Group.countDocuments(query);

      return {
        groups: groups.map(group => group.toJSON()),
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error('Error retrieving groups:', { message: error.message, stack: error.stack });
      throw new InternalError('Group service error', 'DATABASE_ERROR');
    }
  }

  /**
   * Update a group
   *
   * @param {string} userId - ID of the user requesting the update (must be owner)
   * @param {string} groupId - The ID of the group to update
   * @param {Object} updateData - The data to update
   * @returns {Object} The updated group data
   * @throws {NotFoundError} If group doesn't exist
   * @throws {AuthorizationError} If user is not the owner
   * @throws {ValidationError} If validation fails
   * @throws {InternalError} If there's a database error
   */
  async function updateGroup(userId, groupId, updateData) {
    try {
      // Find the group first
      const group = await Group.findById(groupId);

      if (!group) {
        throw new NotFoundError('Group not found', 'GROUP_NOT_FOUND');
      }

      // Check if user is the owner
      if (group.owner.toString() !== userId) {
        throw new AuthorizationError(
          'Only the group owner can update the group',
          'NOT_GROUP_OWNER',
        );
      }

      // Apply updates (prevent updating critical fields)
      const allowedUpdates = ['name', 'description', 'maxMembers'];
      allowedUpdates.forEach(field => {
        if (updateData[field] !== undefined) {
          group[field] = updateData[field];
        }
      });

      // Save the updated group
      const updatedGroup = await group.save();

      return updatedGroup.toJSON();
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof AuthorizationError) {
        throw error;
      }

      if (error.name === 'ValidationError') {
        throw new ValidationError(
          'Validation failed',
          Object.keys(error.errors).map(field => ({
            field,
            message: error.errors[field].message,
          })),
        );
      }

      logger.error('Error updating group:', { message: error.message, stack: error.stack });
      throw new InternalError('Group service error', 'DATABASE_ERROR');
    }
  }

  /**
   * Delete a group
   *
   * @param {string} userId - ID of the user requesting deletion (must be owner)
   * @param {string} groupId - The ID of the group to delete
   * @returns {Object} Confirmation of deletion
   * @throws {NotFoundError} If group doesn't exist
   * @throws {AuthorizationError} If user is not the owner
   * @throws {ValidationError} If group still has members
   * @throws {InternalError} If there's a database error
   */
  async function deleteGroup(userId, groupId) {
    try {
      // Find the group first
      const group = await Group.findById(groupId);

      if (!group) {
        throw new NotFoundError('Group not found', 'GROUP_NOT_FOUND');
      }

      // Check if user is the owner
      if (group.owner.toString() !== userId) {
        throw new AuthorizationError(
          'Only the group owner can delete the group',
          'NOT_GROUP_OWNER',
        );
      }

      // Check if group has members other than the owner
      const memberCount = group.members.length;
      if (memberCount > 1) {
        throw new ValidationError(
          'Group still has members and cannot be deleted',
          'GROUP_HAS_MEMBERS',
        );
      }

      // Delete the group
      await Group.findByIdAndDelete(groupId);

      return { success: true, message: 'Group deleted successfully' };
    } catch (error) {
      if (
        error instanceof NotFoundError ||
        error instanceof AuthorizationError ||
        error instanceof ValidationError
      ) {
        throw error;
      }

      logger.error('Error deleting group:', { message: error.message, stack: error.stack });
      throw new InternalError('Group service error', 'DATABASE_ERROR');
    }
  }

  /**
   * Add a member to a group
   *
   * @param {string} userId - ID of the user to be added
   * @param {string} groupId - The ID of the group
   * @returns {Object} Updated group data
   * @throws {NotFoundError} If group or user doesn't exist
   * @throws {ValidationError} If validation fails
   * @throws {ConflictError} If user is already a member
   * @throws {InternalError} If there's a database error
   */
  async function addMember(userId, groupId) {
    try {
      // Check if user exists
      const user = await User.findById(userId);
      if (!user) {
        throw new NotFoundError('User not found', 'USER_NOT_FOUND');
      }

      // Find the group
      const group = await Group.findById(groupId);
      if (!group) {
        throw new NotFoundError('Group not found', 'GROUP_NOT_FOUND');
      }

      // Check if user is already a member
      const isMember = group.members.some(member => member.user.toString() === userId);
      if (isMember) {
        throw new ConflictError('User is already a member of this group', 'ALREADY_MEMBER');
      }

      // Check if group is at max capacity
      if (group.memberLimit && group.members.length >= group.memberLimit) {
        throw new ValidationError('Group has reached maximum member capacity', 'GROUP_FULL');
      }

      // Add user to the group
      group.members.push({ user: userId });
      const updatedGroup = await group.save();

      return updatedGroup.toJSON();
    } catch (error) {
      if (
        error instanceof NotFoundError ||
        error instanceof ValidationError ||
        error instanceof ConflictError
      ) {
        throw error;
      }

      logger.error('Error adding member to group:', { message: error.message, stack: error.stack });
      throw new InternalError('Group service error', 'DATABASE_ERROR');
    }
  }

  /**
   * Remove a member from a group
   *
   * @param {string} userId - ID of the user to be removed
   * @param {string} groupId - The ID of the group
   * @param {string} requesterId - ID of the user requesting the removal
   * @returns {Object} Updated group data
   * @throws {NotFoundError} If group doesn't exist
   * @throws {ValidationError} If validation fails
   * @throws {AuthorizationError} If requester doesn't have permission
   * @throws {InternalError} If there's a database error
   */
  async function removeMember(userId, groupId, requesterId) {
    try {
      // Find the group
      const group = await Group.findById(groupId);
      if (!group) {
        throw new NotFoundError('Group not found', 'GROUP_NOT_FOUND');
      }

      // Check authorization: user can remove self or owner can remove anyone
      const isOwner = group.owner.toString() === requesterId;
      const isSelfRemoval = userId === requesterId;

      if (!isOwner && !isSelfRemoval) {
        throw new AuthorizationError(
          'You do not have permission to remove this member',
          'REMOVE_MEMBER_UNAUTHORIZED',
        );
      }

      // Cannot remove the owner
      if (userId === group.owner.toString() && group.members.length > 1) {
        throw new ValidationError(
          'Group owner cannot leave while other members exist. Transfer ownership first.',
          'OWNER_CANNOT_LEAVE',
        );
      }

      // Check if user is a member
      const memberIndex = group.members.findIndex(member =>
        member.user.toString() === userId
      );
      
      if (memberIndex === -1) {
        throw new NotFoundError('User is not a member of this group', 'NOT_A_MEMBER');
      }

      // Remove the member
      group.members = group.members.filter(member =>
        member.user.toString() !== userId,
      );

      const updatedGroup = await group.save();
      return updatedGroup.toJSON();
    } catch (error) {
      if (
        error instanceof NotFoundError ||
        error instanceof ValidationError ||
        error instanceof AuthorizationError
      ) {
        throw error;
      }

      logger.error('Error removing member from group:', { message: error.message, stack: error.stack });
      throw new InternalError('Group service error', 'DATABASE_ERROR');
    }
  }

  /**
   * Transfer group ownership to another member
   *
   * @param {string} currentOwnerId - ID of the current owner
   * @param {string} newOwnerId - ID of the new owner
   * @param {string} groupId - The ID of the group
   * @returns {Object} Updated group data
   */
  async function transferOwnership(currentOwnerId, newOwnerId, groupId) {
    try {
      // Find the group
      const group = await Group.findById(groupId);
      if (!group) {
        throw new NotFoundError('Group not found', 'GROUP_NOT_FOUND');
      }

      // Check if requester is the current owner
      if (group.owner.toString() !== currentOwnerId) {
        throw new AuthorizationError(
          'Only the current owner can transfer ownership',
          'NOT_GROUP_OWNER',
        );
      }

      // Check if new owner is a member
      const isNewOwnerMember = group.members.some(member => 
        member.user.toString() === newOwnerId && member.status === 'active'
      );
      
      if (!isNewOwnerMember) {
        throw new ValidationError(
          'New owner must be a current active member of the group',
          'NEW_OWNER_NOT_MEMBER',
        );
      }

      // Transfer ownership
      group.owner = newOwnerId;
      const updatedGroup = await group.save();

      return updatedGroup.toJSON();
    } catch (error) {
      if (
        error instanceof NotFoundError ||
        error instanceof ValidationError ||
        error instanceof AuthorizationError
      ) {
        throw error;
      }

      logger.error('Error transferring group ownership:', { message: error.message, stack: error.stack });
      throw new InternalError('Group service error', 'DATABASE_ERROR');
    }
  }

  // Return the service methods
  return {
    createGroup,
    getGroupById,
    getGroups,
    updateGroup,
    deleteGroup,
    addMember,
    removeMember,
    transferOwnership,
  };
};
