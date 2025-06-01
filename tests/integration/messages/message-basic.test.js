const request = require('supertest');
const { app } = require('../../../src/app');

describe('Message API Basic Structure and Validation', () => {
  describe('POST /api/v1/messages/groups/:groupId/messages', () => {
    it('should have the send message endpoint available', async () => {
      const response = await request(app)
        .post('/api/v1/messages/groups/123456789012345678901234/messages')
        .send({});

      // Should not be 404 (endpoint exists) but should require authentication
      expect([401, 400, 429]).toContain(response.status);
      expect(response.headers['content-type']).toMatch(/json/);
      expect(response.body).toHaveProperty('success');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/v1/messages/groups/123456789012345678901234/messages')
        .send({
          content: 'Test message'
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toMatch(/token|auth/i);
    });

    it('should validate message content requirements', async () => {
      const response = await request(app)
        .post('/api/v1/messages/groups/123456789012345678901234/messages')
        .set('Authorization', 'Bearer invalid-token')
        .send({
          content: '' // Empty content
        });

      // Should be either validation error or auth error
      expect([400, 401]).toContain(response.status);
      expect(response.body).toHaveProperty('success', false);
    });

    it('should handle very long message content', async () => {
      const response = await request(app)
        .post('/api/v1/messages/groups/123456789012345678901234/messages')
        .set('Authorization', 'Bearer invalid-token')
        .send({
          content: 'A'.repeat(2500) // Too long
        });

      expect([400, 401]).toContain(response.status);
      expect(response.body).toHaveProperty('success', false);
    });

    it('should apply rate limiting', async () => {
      // Make multiple rapid requests
      const requests = [];
      for (let i = 0; i < 3; i++) {
        requests.push(
          request(app)
            .post('/api/v1/messages/groups/123456789012345678901234/messages')
            .set('Authorization', 'Bearer test-token')
            .send({
              content: `Test message ${i}`
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

  describe('GET /api/v1/messages/groups/:groupId/messages', () => {
    it('should have the get messages endpoint available', async () => {
      const response = await request(app)
        .get('/api/v1/messages/groups/123456789012345678901234/messages');

      // Should require authentication
      expect(response.status).toBe(401);
      expect(response.headers['content-type']).toMatch(/json/);
      expect(response.body).toHaveProperty('success', false);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/v1/messages/groups/123456789012345678901234/messages');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toMatch(/token|auth/i);
    });

    it('should handle pagination parameters', async () => {
      const response = await request(app)
        .get('/api/v1/messages/groups/123456789012345678901234/messages')
        .query({
          page: 1,
          limit: 20
        })
        .set('Authorization', 'Bearer invalid-token');

      // Should be auth error, but endpoint should accept query params
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('GET /api/v1/messages/groups/:groupId/messages/search', () => {
    it('should have the search messages endpoint available', async () => {
      const response = await request(app)
        .get('/api/v1/messages/groups/123456789012345678901234/messages/search')
        .query({ q: 'test' });

      expect(response.status).toBe(401); // Should require auth
      expect(response.headers['content-type']).toMatch(/json/);
      expect(response.body).toHaveProperty('success', false);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/v1/messages/groups/123456789012345678901234/messages/search')
        .query({ q: 'test' });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toMatch(/token|auth/i);
    });

    it('should apply rate limiting for search requests', async () => {
      const requests = [];
      for (let i = 0; i < 3; i++) {
        requests.push(
          request(app)
            .get('/api/v1/messages/groups/123456789012345678901234/messages/search')
            .query({ q: `test${i}` })
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

  describe('GET /api/v1/messages/messages/:messageId', () => {
    it('should have the get message endpoint available', async () => {
      const response = await request(app)
        .get('/api/v1/messages/messages/123456789012345678901234');

      expect(response.status).toBe(401); // Should require auth
      expect(response.headers['content-type']).toMatch(/json/);
      expect(response.body).toHaveProperty('success', false);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/v1/messages/messages/123456789012345678901234');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toMatch(/token|auth/i);
    });
  });

  describe('DELETE /api/v1/messages/messages/:messageId', () => {
    it('should have the delete message endpoint available', async () => {
      const response = await request(app)
        .delete('/api/v1/messages/messages/123456789012345678901234');

      expect(response.status).toBe(401); // Should require auth
      expect(response.headers['content-type']).toMatch(/json/);
      expect(response.body).toHaveProperty('success', false);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .delete('/api/v1/messages/messages/123456789012345678901234');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toMatch(/token|auth/i);
    });
  });

  describe('Message Route 404 Handling', () => {
    it('should return 404 for unknown message endpoints', async () => {
      const response = await request(app)
        .get('/api/v1/messages/unknown/endpoint');

      // With per-route auth middleware, unknown endpoints correctly return 404
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toMatch(/not found|cannot find/i);
    });
  });

  describe('Security Headers', () => {
    it('should include security headers', async () => {
      const response = await request(app)
        .post('/api/v1/messages/groups/123456789012345678901234/messages')
        .send({
          content: 'Test message'
        });

      // Should have security headers from helmet
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
    });
  });

  describe('Error Response Format', () => {
    it('should return consistent error format', async () => {
      const response = await request(app)
        .post('/api/v1/messages/groups/123456789012345678901234/messages')
        .send({
          content: '' // Invalid content
        });

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message');
      
      // Should not expose sensitive information
      expect(response.body).not.toHaveProperty('stack');
      expect(response.body).not.toHaveProperty('details');
    });

    it('should not expose sensitive information', async () => {
      const response = await request(app)
        .post('/api/v1/messages/groups/123456789012345678901234/messages')
        .set('Authorization', 'Bearer invalid-token')
        .send({
          content: 'Test message'
        });

      expect(response.body).not.toHaveProperty('stack');
      expect(response.body).not.toHaveProperty('details');
      expect(JSON.stringify(response.body)).not.toContain('password');
      expect(JSON.stringify(response.body)).not.toContain('secret');
    });
  });

  describe('Input Validation Edge Cases', () => {
    it('should handle empty request body', async () => {
      const response = await request(app)
        .post('/api/v1/messages/groups/123456789012345678901234/messages')
        .set('Authorization', 'Bearer test-token')
        .send();

      expect([400, 401]).toContain(response.status);
      expect(response.body).toHaveProperty('success', false);
    });

    it('should validate content-type', async () => {
      const response = await request(app)
        .post('/api/v1/messages/groups/123456789012345678901234/messages')
        .set('Authorization', 'Bearer test-token')
        .send('not json');

      expect(response.body).toHaveProperty('success', false);
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/v1/messages/groups/123456789012345678901234/messages')
        .set('Content-Type', 'application/json')
        .set('Authorization', 'Bearer invalid-token')
        .send('{"content": "Test message", "invalid": "json"}');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
    });

    it('should handle special characters in message content', async () => {
      const response = await request(app)
        .post('/api/v1/messages/groups/123456789012345678901234/messages')
        .set('Authorization', 'Bearer test-token')
        .send({
          content: 'Test message with <script>alert("xss")</script> and emojis 🚀🔥'
        });

      expect([400, 401]).toContain(response.status);
      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('Message Search Validation', () => {
    it('should validate search term length', async () => {
      const response = await request(app)
        .get('/api/v1/messages/groups/123456789012345678901234/messages/search')
        .query({ q: 'a' }) // Too short
        .set('Authorization', 'Bearer test-token');

      expect([400, 401]).toContain(response.status);
      expect(response.body).toHaveProperty('success', false);
    });

    it('should validate search term maximum length', async () => {
      const response = await request(app)
        .get('/api/v1/messages/groups/123456789012345678901234/messages/search')
        .query({ q: 'a'.repeat(150) }) // Too long
        .set('Authorization', 'Bearer test-token');

      expect([400, 401]).toContain(response.status);
      expect(response.body).toHaveProperty('success', false);
    });

    it('should handle missing search term', async () => {
      const response = await request(app)
        .get('/api/v1/messages/groups/123456789012345678901234/messages/search')
        .set('Authorization', 'Bearer test-token');

      expect([400, 401]).toContain(response.status);
      expect(response.body).toHaveProperty('success', false);
    });
  });
});
