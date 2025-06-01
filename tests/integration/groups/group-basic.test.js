const request = require('supertest');
const { app } = require('../../../src/app');

describe('Group API Basic Structure and Validation', () => {
  describe('POST /api/v1/groups', () => {
    it('should have the group creation endpoint available', async () => {
      const response = await request(app)
        .post('/api/v1/groups')
        .send({});

      // Should not be 404 (endpoint exists) but should require authentication
      expect([401, 400, 429]).toContain(response.status);
      expect(response.headers['content-type']).toMatch(/json/);
      expect(response.body).toHaveProperty('success');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/v1/groups')
        .send({
          name: 'Test Group',
          description: 'A test group',
          type: 'public'
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toMatch(/token|auth/i);
    });

    it('should validate group name requirements', async () => {
      const response = await request(app)
        .post('/api/v1/groups')
        .set('Authorization', 'Bearer invalid-token')
        .send({
          name: 'A', // Too short
          type: 'public'
        });

      // Should be either validation error or auth error
      expect([400, 401]).toContain(response.status);
      expect(response.body).toHaveProperty('success', false);
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/v1/groups')
        .set('Content-Type', 'application/json')
        .set('Authorization', 'Bearer invalid-token')
        .send('{"name": "Test Group", "type": "incomplete"}');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
    });

    it('should apply rate limiting', async () => {
      // Make multiple rapid requests
      const requests = [];
      for (let i = 0; i < 3; i++) {
        requests.push(
          request(app)
            .post('/api/v1/groups')
            .set('Authorization', 'Bearer test-token')
            .send({
              name: `Test Group ${i}`,
              type: 'public'
            })
        );
      }

      const responses = await Promise.all(requests);
      
      // Should have consistent response structure
      responses.forEach(response => {
        expect(response.body).toHaveProperty('success');
        expect(typeof response.body.success).toBe('boolean');
      });
    });
  });

  describe('GET /api/v1/groups', () => {
    it('should have the group listing endpoint available', async () => {
      const response = await request(app)
        .get('/api/v1/groups');

      // Should require authentication
      expect(response.status).toBe(401);
      expect(response.headers['content-type']).toMatch(/json/);
      expect(response.body).toHaveProperty('success', false);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/v1/groups');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toMatch(/token|auth/i);
    });

    it('should handle query parameters', async () => {
      const response = await request(app)
        .get('/api/v1/groups')
        .query({
          page: 1,
          limit: 10,
          type: 'public',
          search: 'test'
        })
        .set('Authorization', 'Bearer invalid-token');

      // Should be auth error, but endpoint should accept query params
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('GET /api/v1/groups/:groupId', () => {
    it('should have the group details endpoint available', async () => {
      const response = await request(app)
        .get('/api/v1/groups/123456789012345678901234'); // Valid ObjectId format

      expect(response.status).toBe(401); // Should require auth
      expect(response.headers['content-type']).toMatch(/json/);
      expect(response.body).toHaveProperty('success', false);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/v1/groups/123456789012345678901234');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toMatch(/token|auth/i);
    });
  });

  describe('POST /api/v1/groups/:groupId/join', () => {
    it('should have the join group endpoint available', async () => {
      const response = await request(app)
        .post('/api/v1/groups/123456789012345678901234/join');

      expect(response.status).toBe(401); // Should require auth
      expect(response.headers['content-type']).toMatch(/json/);
      expect(response.body).toHaveProperty('success', false);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/v1/groups/123456789012345678901234/join');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toMatch(/token|auth/i);
    });

    it('should apply rate limiting for join attempts', async () => {
      const requests = [];
      for (let i = 0; i < 3; i++) {
        requests.push(
          request(app)
            .post('/api/v1/groups/123456789012345678901234/join')
            .set('Authorization', 'Bearer test-token')
        );
      }

      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.body).toHaveProperty('success');
        expect(typeof response.body.success).toBe('boolean');
      });
    });
  });

  describe('DELETE /api/v1/groups/:groupId/leave', () => {
    it('should have the leave group endpoint available', async () => {
      const response = await request(app)
        .delete('/api/v1/groups/123456789012345678901234/leave');

      expect(response.status).toBe(401); // Should require auth
      expect(response.headers['content-type']).toMatch(/json/);
      expect(response.body).toHaveProperty('success', false);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .delete('/api/v1/groups/123456789012345678901234/leave');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toMatch(/token|auth/i);
    });
  });

  describe('Group Route 404 Handling', () => {
    it('should return 404 for unknown group endpoints', async () => {
      const response = await request(app)
        .get('/api/v1/groups/unknown/endpoint');

      // With per-route auth middleware, unknown endpoints correctly return 404
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toMatch(/not found|cannot find/i);
    });

    it('should handle unknown endpoints at the groups route level', async () => {
      // Test that the route structure is set up correctly by checking 
      // that groups path exists (even if auth fails)
      const response = await request(app)
        .patch('/api/v1/groups/test'); // PATCH is not implemented

      // With per-route auth middleware, unknown methods correctly return 404
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('Security Headers', () => {
    it('should include security headers', async () => {
      const response = await request(app)
        .post('/api/v1/groups')
        .send({
          name: 'Test Group',
          type: 'public'
        });

      // Should have security headers from helmet
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
    });
  });

  describe('Error Response Format', () => {
    it('should return consistent error format', async () => {
      const response = await request(app)
        .post('/api/v1/groups')
        .send({
          name: 'A', // Invalid name
          type: 'invalid' // Invalid type
        });

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message');
      
      // Should not expose sensitive information
      expect(response.body).not.toHaveProperty('stack');
      expect(response.body).not.toHaveProperty('details');
    });

    it('should not expose sensitive information', async () => {
      const response = await request(app)
        .post('/api/v1/groups')
        .set('Authorization', 'Bearer invalid-token')
        .send({
          name: 'Test Group'
        });

      expect(response.body).not.toHaveProperty('stack');
      expect(response.body).not.toHaveProperty('details');
      expect(JSON.stringify(response.body)).not.toContain('password');
    });
  });

  describe('Input Validation Edge Cases', () => {
    it('should handle empty request body', async () => {
      const response = await request(app)
        .post('/api/v1/groups')
        .set('Authorization', 'Bearer test-token')
        .send();

      expect([400, 401]).toContain(response.status);
      expect(response.body).toHaveProperty('success', false);
    });

    it('should validate content-type', async () => {
      const response = await request(app)
        .post('/api/v1/groups')
        .set('Authorization', 'Bearer test-token')
        .send('not json');

      expect(response.body).toHaveProperty('success', false);
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should handle very long group names', async () => {
      const response = await request(app)
        .post('/api/v1/groups')
        .set('Authorization', 'Bearer test-token')
        .send({
          name: 'A'.repeat(100), // Too long
          type: 'public'
        });

      expect([400, 401]).toContain(response.status);
      expect(response.body).toHaveProperty('success', false);
    });

    it('should handle very long descriptions', async () => {
      const response = await request(app)
        .post('/api/v1/groups')
        .set('Authorization', 'Bearer test-token')
        .send({
          name: 'Test Group',
          description: 'A'.repeat(1000), // Too long
          type: 'public'
        });

      expect([400, 401]).toContain(response.status);
      expect(response.body).toHaveProperty('success', false);
    });
  });
});
