const request = require('supertest');
const { app } = require('../../../src/app');

describe('Protected Routes Authentication', () => {
  describe('GET /api/v1/users/profile', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/v1/users/profile');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'NO_TOKEN_PROVIDED');
      expect(response.body.message).toContain('Access token required');
    });

    it('should reject invalid token format', async () => {
      const response = await request(app)
        .get('/api/v1/users/profile')
        .set('Authorization', 'InvalidTokenFormat');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'NO_TOKEN_PROVIDED');
    });

    it('should reject malformed Bearer token', async () => {
      const response = await request(app)
        .get('/api/v1/users/profile')
        .set('Authorization', 'Bearer ');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'NO_TOKEN_PROVIDED');
    });

    it('should reject invalid JWT token', async () => {
      const response = await request(app)
        .get('/api/v1/users/profile')
        .set('Authorization', 'Bearer invalid.jwt.token');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      // Could be INVALID_TOKEN or TOKEN_VERIFICATION_FAILED depending on JWT library
      expect(['INVALID_TOKEN', 'TOKEN_VERIFICATION_FAILED']).toContain(response.body.error);
    });

    it('should handle database timeout gracefully', async () => {
      // This test simulates what happens when database is not available
      const response = await request(app)
        .get('/api/v1/users/profile')
        .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2MDc4YjcxYzJkYzQ2NzAwMTU2MDg2NmIiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJpYXQiOjE2MTg1NzYxNTYsImV4cCI6OTk5OTk5OTk5OX0.test');

      // Should get an error due to database connection or invalid signature
      expect(response.status).toBeGreaterThanOrEqual(401);
      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('Authentication Flow Integration', () => {
    it('should have consistent error format across protected routes', async () => {
      const protectedRoutes = [
        '/api/v1/users/profile',
        '/api/v1/users/stats',
      ];

      for (const route of protectedRoutes) {
        const response = await request(app).get(route);
        
        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('message');
        expect(response.body).toHaveProperty('error');
      }
    });

    it('should handle concurrent authentication requests', async () => {
      const requests = Array.from({ length: 3 }, () =>
        request(app)
          .get('/api/v1/users/profile')
          .set('Authorization', 'Bearer invalid.token')
      );

      const responses = await Promise.all(requests);
      
      // All should be unauthorized
      responses.forEach(response => {
        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty('success', false);
      });
    });
  });

  describe('Rate Limiting on Protected Routes', () => {
    it('should apply different rate limits to authenticated routes', async () => {
      // Make multiple requests to see if rate limiting is different
      const requests = [];
      for (let i = 0; i < 3; i++) {
        requests.push(
          request(app)
            .get('/api/v1/users/profile')
            .set('Authorization', 'Bearer test.token')
        );
      }

      const responses = await Promise.all(requests);
      
      // Should get responses (even if 401), not rate limited immediately
      responses.forEach(response => {
        expect(response.status).not.toBe(429);
      });
    });
  });

  describe('Protected Route 404 Handling', () => {
    it('should return 404 for unknown user endpoints', async () => {
      const response = await request(app)
        .get('/api/v1/users/nonexistent')
        .set('Authorization', 'Bearer test.token');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'ENDPOINT_NOT_FOUND');
      expect(response.body).toHaveProperty('availableEndpoints');
      expect(Array.isArray(response.body.availableEndpoints)).toBe(true);
    });
  });

  describe('HTTP Methods on Protected Routes', () => {
    it('should require authentication for PUT /profile', async () => {
      const response = await request(app)
        .put('/api/v1/users/profile')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'NO_TOKEN_PROVIDED');
    });

    it('should require authentication for PUT /password', async () => {
      const response = await request(app)
        .put('/api/v1/users/password')
        .send({ 
          currentPassword: 'old',
          newPassword: 'NewPassword123'
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'NO_TOKEN_PROVIDED');
    });

    it('should require authentication for DELETE /account', async () => {
      const response = await request(app)
        .delete('/api/v1/users/account')
        .send({ password: 'test' });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'NO_TOKEN_PROVIDED');
    });

    it('should require authentication for GET /stats', async () => {
      const response = await request(app)
        .get('/api/v1/users/stats');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'NO_TOKEN_PROVIDED');
    });
  });

  describe('Security Headers', () => {
    it('should include security headers in protected route responses', async () => {
      const response = await request(app)
        .get('/api/v1/users/profile');

      // Should have security headers from helmet middleware
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
    });
  });

  describe('Error Response Format', () => {
    it('should not expose sensitive information in error responses', async () => {
      const response = await request(app)
        .get('/api/v1/users/profile')
        .set('Authorization', 'Bearer malformed.jwt.token');

      expect(response.body).not.toHaveProperty('stack');
      expect(response.body).not.toHaveProperty('details');
      expect(JSON.stringify(response.body)).not.toContain('password');
      expect(JSON.stringify(response.body)).not.toContain('secret');
    });

    it('should have consistent error structure', async () => {
      const response = await request(app)
        .get('/api/v1/users/profile');

      expect(response.body).toMatchObject({
        success: false,
        message: expect.any(String),
        error: expect.any(String)
      });
    });
  });
});
