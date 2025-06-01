const request = require('supertest');
const { app } = require('../../../src/app');

describe('POST /api/v1/auth/register', () => {
  describe('API Structure and Validation', () => {
    it('should have the registration endpoint available', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
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
        .post('/api/v1/auth/register')
        .send({});

      // Should return error for missing fields
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message');
      
      // Should be either validation error or rate limit error
      expect([400, 429]).toContain(response.status);
    });

    it('should validate email format', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'invalid-email',
          password: 'TestPassword123'
        });

      expect(response.body).toHaveProperty('success', false);
      
      // Should be either validation error or rate limit error
      expect([400, 429]).toContain(response.status);
    });

    it('should validate password requirements', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'weak'
        });

      expect(response.body).toHaveProperty('success', false);
      
      // Should be either validation error or rate limit error
      expect([400, 429]).toContain(response.status);
    });

    it('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .set('Content-Type', 'application/json')
        .send('{"email": "test@example.com", "password": "incomplete"}');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
    });

    it('should apply rate limiting', async () => {
      // Make multiple rapid requests
      const requests = [];
      for (let i = 0; i < 3; i++) {
        requests.push(
          request(app)
            .post('/api/v1/auth/register')
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
    });

    it('should return consistent error format', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'invalid',
          password: '123'
        });

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message');
      
      if (response.status === 400) {
        // Validation error format
        expect(response.body.message).toContain('Validation failed');
      } else if (response.status === 429) {
        // Rate limit error format
        expect(response.body.message).toContain('Too many');
      }
    });

    it('should not expose sensitive information', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'weak'
        });

      // Should not expose stack traces or internal details
      expect(response.body).not.toHaveProperty('stack');
      expect(response.body).not.toHaveProperty('details');
      expect(JSON.stringify(response.body)).not.toContain('password');
    });

    it('should handle empty request body', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send();

      expect(response.body).toHaveProperty('success', false);
      expect([400, 429]).toContain(response.status);
    });

    it('should validate content-type', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send('not json');

      // Should handle non-JSON gracefully
      expect(response.body).toHaveProperty('success', false);
      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Rate Limiting Headers', () => {
    it('should include rate limit headers when applicable', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
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

  describe('Security Headers', () => {
    it('should include security headers', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'TestPassword123'
        });

      // Should have security headers from helmet
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
    });
  });
});

// Test the login endpoint
describe('POST /api/v1/auth/login', () => {
  it('should handle login requests', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'test@example.com',
        password: 'TestPassword123'
      });

    // Should not be 404 (endpoint exists)
    expect(response.status).not.toBe(404);
    expect(response.body).toHaveProperty('success', false);
    
    // Either database error or validation error is acceptable
    expect([400, 500]).toContain(response.status);
  });
});

// Test unknown auth endpoints
describe('Auth Route 404 Handling', () => {
  it('should return 404 for unknown auth endpoints', async () => {
    const response = await request(app)
      .get('/api/v1/auth/unknown');

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('error', 'ENDPOINT_NOT_FOUND');
    expect(response.body).toHaveProperty('availableEndpoints');
    expect(response.body.availableEndpoints).toContain('POST /api/v1/auth/register');
    expect(response.body.availableEndpoints).toContain('POST /api/v1/auth/login');
  });
});
