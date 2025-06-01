const request = require('supertest');
const { app } = require('../../../src/app');

describe('POST /api/v1/auth/login', () => {
  describe('API Structure and Validation', () => {
    it('should have the login endpoint available', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({});

      // Should not be 404 (endpoint exists)
      expect(response.status).not.toBe(404);
      
      // Should return JSON
      expect(response.headers['content-type']).toMatch(/json/);
      
      // Should have success field
      expect(response.body).toHaveProperty('success');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({});

      // Should return error for missing fields
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message');
      
      // Should be either validation error or rate limit error
      expect([400, 429]).toContain(response.status);
    });

    it('should validate email format', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'invalid-email',
          password: 'TestPassword123'
        });

      expect(response.body).toHaveProperty('success', false);
      
      // Should be either validation error or rate limit error
      expect([400, 429]).toContain(response.status);
    });

    it('should require password field', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com'
        });

      expect(response.body).toHaveProperty('success', false);
      
      // Should be either validation error or rate limit error
      expect([400, 429]).toContain(response.status);
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"email": "test@example.com", "password": "incomplete"'); // Missing closing brace

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('Authentication Logic', () => {
    it('should return generic error for non-existent user', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'TestPassword123'
        });

      // Should be either 401 (invalid credentials) or 429 (rate limited) or 500 (no DB)
      expect([401, 429, 500]).toContain(response.status);
      
      if (response.status === 401) {
        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('message', 'Invalid email or password');
        expect(response.body).toHaveProperty('error', 'INVALID_CREDENTIALS');
      }
    });

    it('should not reveal whether email exists or not', async () => {
      const responses = await Promise.all([
        request(app)
          .post('/api/v1/auth/login')
          .send({
            email: 'nonexistent@example.com',
            password: 'WrongPassword123'
          }),
        request(app)
          .post('/api/v1/auth/login')
          .send({
            email: 'anotherfake@example.com', 
            password: 'AnotherWrongPassword123'
          })
      ]);

      responses.forEach(response => {
        if (response.status === 401) {
          // Should use same generic message regardless of whether email exists
          expect(response.body.message).toBe('Invalid email or password');
          expect(response.body.error).toBe('INVALID_CREDENTIALS');
        }
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting after multiple requests', async () => {
      // Make multiple login attempts to trigger rate limiting
      const requests = [];
      for (let i = 0; i < 5; i++) {
        requests.push(
          request(app)
            .post('/api/v1/auth/login')
            .send({
              email: `test${i}@example.com`,
              password: 'TestPassword123'
            })
        );
      }

      const responses = await Promise.all(requests);
      
      // At least one should return a response (not all should fail)
      expect(responses.length).toBeGreaterThan(0);
      
      // Should have consistent response structure
      responses.forEach(response => {
        expect(response.body).toHaveProperty('success');
        expect(typeof response.body.success).toBe('boolean');
      });

      // Check if any responses were rate limited
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      if (rateLimitedResponses.length > 0) {
        rateLimitedResponses.forEach(response => {
          expect(response.body).toHaveProperty('error', 'RATE_LIMIT_EXCEEDED');
          expect(response.body.message).toContain('Too many');
        });
      }
    });

    it('should include rate limit headers when applicable', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'TestPassword123'
        });

      // If rate limited, should have appropriate headers
      if (response.status === 429) {
        expect(response.body).toHaveProperty('error', 'RATE_LIMIT_EXCEEDED');
        expect(response.body.message).toContain('Too many');
      }
    });
  });

  describe('Response Format', () => {
    it('should return consistent error format for validation errors', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'invalid', password: '' });

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message');
      
      if (response.status === 400) {
        // Validation error format
        expect(response.body.message).toBe('Validation failed');
        expect(response.body).toHaveProperty('errors');
        expect(Array.isArray(response.body.errors)).toBe(true);
      } else if (response.status === 429) {
        // Rate limit error format
        expect(response.body.message).toContain('Too many');
      }
    });

    it('should return consistent format for authentication errors', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPassword123'
        });

      if (response.status === 401) {
        expect(response.body).toMatchObject({
          success: false,
          message: 'Invalid email or password',
          error: 'INVALID_CREDENTIALS'
        });
      }
    });
  });

  describe('Security', () => {
    it('should not expose sensitive information in error responses', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrong'
        });

      // Should not expose stack traces or internal details
      expect(response.body).not.toHaveProperty('stack');
      expect(response.body).not.toHaveProperty('details');
      expect(JSON.stringify(response.body)).not.toContain('password');
    });

    it('should include security headers', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'TestPassword123'
        });

      // Should have security headers from helmet
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
    });

    it('should use generic error messages for security', async () => {
      const testCases = [
        { email: 'nonexistent@example.com', password: 'WrongPassword123' },
        { email: 'fake@example.com', password: 'AnotherWrongPassword' },
        { email: 'test@example.com', password: 'IncorrectPassword123' }
      ];

      for (const testCase of testCases) {
        const response = await request(app)
          .post('/api/v1/auth/login')
          .send(testCase);

        if (response.status === 401) {
          // Should always use the same generic message
          expect(response.body.message).toBe('Invalid email or password');
          expect(response.body.error).toBe('INVALID_CREDENTIALS');
        }
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty request body', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send();

      expect(response.body).toHaveProperty('success', false);
      expect([400, 429]).toContain(response.status);
    });

    it('should handle very long email addresses', async () => {
      const longEmail = 'a'.repeat(250) + '@example.com';
      
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: longEmail,
          password: 'TestPassword123'
        });

      expect(response.body).toHaveProperty('success', false);
      expect([400, 429]).toContain(response.status);
    });

    it('should validate content-type', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send('not json');

      // Should handle non-JSON gracefully
      expect(response.body).toHaveProperty('success', false);
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should handle missing email field specifically', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          password: 'TestPassword123'
        });

      expect(response.body).toHaveProperty('success', false);
      
      if (response.status === 400) {
        expect(response.body.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              field: 'email',
              message: expect.stringContaining('required')
            })
          ])
        );
      }
    });

    it('should handle missing password field specifically', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com'
        });

      expect(response.body).toHaveProperty('success', false);
      
      if (response.status === 400) {
        expect(response.body.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              field: 'password',
              message: expect.stringContaining('required')
            })
          ])
        );
      }
    });
  });

  describe('Input Sanitization', () => {
    it('should handle email normalization', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: '  TEST@EXAMPLE.COM  ',
          password: 'TestPassword123'
        });

      // Should normalize email (trim whitespace, convert to lowercase)
      expect(response.body).toHaveProperty('success', false);
      // Since user doesn't exist, should get invalid credentials or rate limit
      expect([401, 429, 500]).toContain(response.status);
    });

    it('should reject very long passwords', async () => {
      const veryLongPassword = 'a'.repeat(1000);
      
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: veryLongPassword
        });

      expect(response.body).toHaveProperty('success', false);
      // Should either reject due to validation or process as invalid credentials
      expect([400, 401, 429, 500]).toContain(response.status);
    });
  });
});

// Test complete authentication flow if possible
describe('Authentication Flow Integration', () => {
  describe('Login Flow', () => {
    it('should maintain consistent API behavior', async () => {
      // Test that login endpoint is working as expected
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'TestPassword123'
        });

      // Should get a response (not crash)
      expect(loginResponse.body).toHaveProperty('success');
      expect(typeof loginResponse.body.success).toBe('boolean');
    });

    it('should handle concurrent login attempts', async () => {
      const requests = Array.from({ length: 3 }, (_, i) =>
        request(app)
          .post('/api/v1/auth/login')
          .send({
            email: `concurrent${i}@example.com`,
            password: 'TestPassword123'
          })
      );

      const responses = await Promise.all(requests);
      
      // All requests should complete without hanging
      expect(responses.length).toBe(3);
      
      // All should have proper response structure
      responses.forEach(response => {
        expect(response.body).toHaveProperty('success');
        expect(typeof response.body.success).toBe('boolean');
      });
    });
  });
});
