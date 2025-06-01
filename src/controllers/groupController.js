/**
 * Group Controller
 *
 * Handles HTTP requests for group endpoints,
 * delegating business logic to the group service.
 */

const container = require('../container');
const groupService = container.get('groupService');
const asyncErrorHandler = container.get('asyncErrorHandler');

/**
 * Create a new group
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const createGroup = asyncErrorHandler(async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const group = await groupService.createGroup(userId, req.body);

    res.status(201).json({
      success: true,
      message: 'Group created successfully',
      data: group,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get a group by ID
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const getGroupById = asyncErrorHandler(async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const group = await groupService.getGroupById(groupId);

    res.status(200).json({
      success: true,
      message: 'Group retrieved successfully',
      data: group,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get all groups with pagination and filtering
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const getGroups = asyncErrorHandler(async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const type = req.query.type || null;

    const result = await groupService.getGroups({ page, limit, type });

    res.status(200).json({
      success: true,
      message: 'Groups retrieved successfully',
      data: result.groups,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Update a group
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const updateGroup = asyncErrorHandler(async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.userId;
    const updatedGroup = await groupService.updateGroup(userId, groupId, req.body);

    res.status(200).json({
      success: true,
      message: 'Group updated successfully',
      data: updatedGroup,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Delete a group
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const deleteGroup = asyncErrorHandler(async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.userId;

    const result = await groupService.deleteGroup(userId, groupId);

    res.status(200).json({
      success: true,
      message: 'Group deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Add a member to a group
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const addMember = asyncErrorHandler(async (req, res, next) => {
  try {
    const { groupId } = req.params;
    // Use the authenticated user's ID instead of expecting it in the body
    const userId = req.user.userId;

    const updatedGroup = await groupService.addMember(userId, groupId);

    res.status(200).json({
      success: true,
      message: 'Member added successfully',
      data: updatedGroup,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Remove a member from a group
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const removeMember = asyncErrorHandler(async (req, res, next) => {
  try {
    const { groupId, userId } = req.params;
    const requesterId = req.user.userId;

    const updatedGroup = await groupService.removeMember(userId, groupId, requesterId);

    res.status(200).json({
      success: true,
      message: 'Member removed successfully',
      data: updatedGroup,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Transfer group ownership to another member
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const transferOwnership = asyncErrorHandler(async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { newOwnerId } = req.body;
    const currentOwnerId = req.user.userId;

    const updatedGroup = await groupService.transferOwnership(currentOwnerId, newOwnerId, groupId);

    res.status(200).json({
      success: true,
      message: 'Group ownership transferred successfully',
      data: updatedGroup,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = {
  createGroup,
  getGroupById,
  getGroups,
  updateGroup,
  deleteGroup,
  addMember,
  removeMember,
  transferOwnership,
};
