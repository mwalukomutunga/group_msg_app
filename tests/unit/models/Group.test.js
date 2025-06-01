const mongoose = require('mongoose');
const Group = require('../../../src/models/Group');
const User = require('../../../src/models/User');
const { setupTest, teardownTest } = require('../../helpers/testUtils');
const { ensureTestConnection } = require('../../setup/database');

// Use shared test database setup
beforeAll(async () => {
  await ensureTestConnection();
});

beforeEach(async () => {
  await setupTest();
});

afterEach(async () => {
  await teardownTest();
});

describe('Group Model', () => {
  let testUser, testUser2;

  beforeEach(async () => {
    testUser = await User.create({
      email: 'owner@test.com',
      password: 'TestPass123'
    });

    testUser2 = await User.create({
      email: 'member@test.com',
      password: 'TestPass123'
    });
  });

  describe('Group Creation', () => {
    test('should create a group with valid data', async () => {
      const groupData = {
        name: 'Test Group',
        description: 'A test group',
        type: 'public',
        owner: testUser._id
      };

      const group = await Group.create(groupData);

      expect(group.name).toBe('Test Group');
      expect(group.description).toBe('A test group');
      expect(group.type).toBe('public');
      expect(group.owner.toString()).toBe(testUser._id.toString());
      expect(group.memberLimit).toBe(100); // default
      expect(group.settings.requireApproval).toBe(false); // public group default
    });

    test('should create a private group with correct defaults', async () => {
      const group = await Group.create({
        name: 'Private Group',
        type: 'private',
        owner: testUser._id
      });

      expect(group.type).toBe('private');
      expect(group.settings.requireApproval).toBe(true); // private group default
      expect(group.settings.cooldownPeriod).toBe(48);
    });

    test('should automatically add owner as active member', async () => {
      const group = await Group.create({
        name: 'Test Group',
        owner: testUser._id
      });

      expect(group.members).toHaveLength(1);
      expect(group.members[0].user.toString()).toBe(testUser._id.toString());
      expect(group.members[0].status).toBe('active');
    });

    test('should require name and owner', async () => {
      await expect(Group.create({})).rejects.toThrow('Group name is required');
      
      await expect(Group.create({ name: 'Test' })).rejects.toThrow('Group owner is required');
    });

    test('should enforce unique group names', async () => {
      await Group.create({
        name: 'Unique Group',
        owner: testUser._id
      });

      await expect(Group.create({
        name: 'Unique Group',
        owner: testUser2._id
      })).rejects.toThrow();
    });

    test('should validate name length', async () => {
      await expect(Group.create({
        name: 'A', // too short
        owner: testUser._id
      })).rejects.toThrow('Group name must be at least 2 characters long');

      await expect(Group.create({
        name: 'A'.repeat(51), // too long
        owner: testUser._id
      })).rejects.toThrow('Group name cannot exceed 50 characters');
    });

    test('should validate description length', async () => {
      await expect(Group.create({
        name: 'Test Group',
        description: 'A'.repeat(501), // too long
        owner: testUser._id
      })).rejects.toThrow('Group description cannot exceed 500 characters');
    });

    test('should validate member limit range', async () => {
      await expect(Group.create({
        name: 'Test Group',
        owner: testUser._id,
        memberLimit: 1 // too low
      })).rejects.toThrow('Group must allow at least 2 members');

      await expect(Group.create({
        name: 'Test Group',
        owner: testUser._id,
        memberLimit: 1001 // too high
      })).rejects.toThrow('Group cannot exceed 1000 members');
    });
  });

  describe('Virtual Properties', () => {
    let group;

    beforeEach(async () => {
      group = await Group.create({
        name: 'Test Group',
        owner: testUser._id
      });
    });

    test('should calculate memberCount correctly', async () => {
      expect(group.memberCount).toBe(1); // owner only

      await group.addMember(testUser2._id, 'active');
      expect(group.memberCount).toBe(2);

      // Remove member and add as pending
      group.members = group.members.filter(m => m.user.toString() !== testUser2._id.toString());
      await group.addMember(testUser2._id, 'pending');
      expect(group.memberCount).toBe(1); // pending doesn't count
    });

    test('should calculate pendingMemberCount correctly', async () => {
      expect(group.pendingMemberCount).toBe(0);

      await group.addMember(testUser2._id, 'pending');
      expect(group.pendingMemberCount).toBe(1);

      await group.approveMember(testUser2._id);
      expect(group.pendingMemberCount).toBe(0);
    });
  });

  describe('Instance Methods', () => {
    let group;

    beforeEach(async () => {
      group = await Group.create({
        name: 'Test Group',
        owner: testUser._id
      });
    });

    test('isOwner should work correctly', () => {
      expect(group.isOwner(testUser._id)).toBe(true);
      expect(group.isOwner(testUser2._id)).toBe(false);
    });

    test('isMember should work correctly', async () => {
      expect(group.isMember(testUser._id)).toBe(true); // owner is member
      expect(group.isMember(testUser2._id)).toBe(false);

      await group.addMember(testUser2._id, 'active');
      expect(group.isMember(testUser2._id)).toBe(true);

      await group.addMember(testUser2._id, 'pending');
      expect(group.isMember(testUser2._id)).toBe(false); // pending doesn't count
    });

    test('isBanned should work correctly', async () => {
      expect(group.isBanned(testUser2._id)).toBe(false);

      await group.addMember(testUser2._id, 'banned');
      expect(group.isBanned(testUser2._id)).toBe(true);
    });

    test('hasPendingRequest should work correctly', async () => {
      expect(group.hasPendingRequest(testUser2._id)).toBe(false);

      await group.addMember(testUser2._id, 'pending');
      expect(group.hasPendingRequest(testUser2._id)).toBe(true);

      await group.approveMember(testUser2._id);
      expect(group.hasPendingRequest(testUser2._id)).toBe(false);
    });

    test('addMember should work correctly', async () => {
      await group.addMember(testUser2._id, 'active');
      expect(group.isMember(testUser2._id)).toBe(true);

      // Adding existing member should update status
      await group.addMember(testUser2._id, 'pending');
      expect(group.isMember(testUser2._id)).toBe(false);
      expect(group.hasPendingRequest(testUser2._id)).toBe(true);
    });

    test('removeMember should work correctly', async () => {
      await group.addMember(testUser2._id, 'active');
      expect(group.isMember(testUser2._id)).toBe(true);

      await group.removeMember(testUser2._id);
      expect(group.isMember(testUser2._id)).toBe(false);
    });

    test('banMember should work correctly', async () => {
      await group.addMember(testUser2._id, 'active');
      
      await group.banMember(testUser2._id, 'Spam posting');
      expect(group.isBanned(testUser2._id)).toBe(true);
      
      const member = group.getMember(testUser2._id);
      expect(member.banReason).toBe('Spam posting');
      expect(member.lastBannedAt).toBeInstanceOf(Date);
    });

    test('approveMember should work correctly', async () => {
      await group.addMember(testUser2._id, 'pending');
      expect(group.hasPendingRequest(testUser2._id)).toBe(true);

      await group.approveMember(testUser2._id);
      expect(group.isMember(testUser2._id)).toBe(true);
      expect(group.hasPendingRequest(testUser2._id)).toBe(false);
    });

    test('isInCooldownPeriod should work correctly', async () => {
      // Ban user
      await group.addMember(testUser2._id, 'banned');
      expect(group.isInCooldownPeriod(testUser2._id)).toBe(true);

      // Simulate ban from the past (beyond cooldown)
      const member = group.getMember(testUser2._id);
      member.lastBannedAt = new Date(Date.now() - (49 * 60 * 60 * 1000)); // 49 hours ago
      await group.save();
      
      expect(group.isInCooldownPeriod(testUser2._id)).toBe(false);

      // Recent ban should still be in cooldown
      member.lastBannedAt = new Date(Date.now() - (47 * 60 * 60 * 1000)); // 47 hours ago
      await group.save();
      
      expect(group.isInCooldownPeriod(testUser2._id)).toBe(true);
    });

    test('getMember should return correct member', async () => {
      await group.addMember(testUser2._id, 'pending');
      
      const member = group.getMember(testUser2._id);
      expect(member.user.toString()).toBe(testUser2._id.toString());
      expect(member.status).toBe('pending');
    });
  });

  describe('Pre-save Middleware', () => {
    test('should ensure owner is always an active member', async () => {
      const group = new Group({
        name: 'Test Group',
        owner: testUser._id,
        members: [] // Start with empty members
      });

      await group.save();

      expect(group.members).toHaveLength(1);
      expect(group.members[0].user.toString()).toBe(testUser._id.toString());
      expect(group.members[0].status).toBe('active');
    });

    test('should update lastActivity when members change', async () => {
      const group = await Group.create({
        name: 'Test Group',
        owner: testUser._id
      });

      const originalActivity = group.stats.lastActivity;

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      await group.addMember(testUser2._id, 'active');
      
      expect(group.stats.lastActivity.getTime()).toBeGreaterThan(originalActivity.getTime());
    });
  });

  describe('Database Indexes', () => {
    test('should have proper indexes', async () => {
      const indexes = await Group.collection.getIndexes();
      
      expect(indexes).toHaveProperty('name_1');
      expect(indexes).toHaveProperty('type_1');
      expect(indexes).toHaveProperty('owner_1');
      expect(indexes['members.user_1']).toBeDefined(); // Use bracket notation for keys with dots
      expect(indexes).toHaveProperty('createdAt_-1');
    });
  });

  describe('JSON Serialization', () => {
    test('should include virtuals in JSON output', async () => {
      const group = await Group.create({
        name: 'Test Group',
        owner: testUser._id
      });

      const json = group.toJSON();
      
      expect(json).toHaveProperty('memberCount');
      expect(json).toHaveProperty('pendingMemberCount');
      expect(json).not.toHaveProperty('__v'); // Should be excluded
    });
  });
});
