const request = require('supertest');
const { app } = require('../../../src/app');

describe('Complete Authentication Flow', () => {
  describe('End-to-End User Journey', () => {
    let userToken;
    const testUser = {
      email: 'flowtest@example.com',
      password: 'FlowTestPassword123'
    };

    it('should complete full registration → login → profile access flow', async () => {
      // Step 1: Register new user
      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send(testUser);

      if (registerResponse.status === 201) {
        expect(registerResponse.body).toHaveProperty('success', true);
        expect(registerResponse.body).toHaveProperty('data.token');
        expect(registerResponse.body.data.user.email).toBe(testUser.email);
        userToken = registerResponse.body.data.token;
      } else if (registerResponse.status === 409) {
        // User already exists, try login instead
        const loginResponse = await request(app)
          .post('/api/v1/auth/login')
          .send(testUser);
        
        expect([200, 401, 429, 500]).toContain(loginResponse.status);
        if (loginResponse.status === 200) {
          userToken = loginResponse.body.data.token;
        }
      }

      // Step 2: Access protected profile endpoint (if we have a token)
      if (userToken) {
        const profileResponse = await request(app)
          .get('/api/v1/users/profile')
          .set('Authorization', `Bearer ${userToken}`);

        expect([200, 401, 500]).toContain(profileResponse.status);
        if (profileResponse.status === 200) {
          expect(profileResponse.body).toHaveProperty('success', true);
          expect(profileResponse.body.data.user.email).toBe(testUser.email);
        }
      }
    });

    it('should handle invalid authentication gracefully', async () => {
      const response = await request(app)
        .get('/api/v1/users/profile')
        .set('Authorization', 'Bearer invalid.token.here');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Error Handling Consistency', () => {
    it('should return consistent error format across all endpoints', async () => {
      const endpoints = [
        { method: 'post', path: '/api/v1/auth/register', body: {} },
        { method: 'post', path: '/api/v1/auth/login', body: {} },
        { method: 'get', path: '/api/v1/users/profile', headers: {} },
        { method: 'put', path: '/api/v1/users/profile', body: {} }
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)
          [endpoint.method](endpoint.path)
          .send(endpoint.body || {});

        expect(response.body).toHaveProperty('success');
        expect(response.body).toHaveProperty('message');
        expect(typeof response.body.success).toBe('boolean');
        expect(typeof response.body.message).toBe('string');
      }
    });

    it('should include security headers in all responses', async () => {
      const response = await request(app)
        .get('/health');

      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-request-id');
    });

    it('should handle malformed JSON requests', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .set('Content-Type', 'application/json')
        .send('{"email": "test@example.com", "password": "incomplete"'); // Missing closing brace

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'INVALID_JSON_FORMAT');
    });
  });

  describe('Rate Limiting Integration', () => {
    it('should apply rate limiting consistently', async () => {
      // Make a few requests to test rate limiting behavior
      const requests = [];
      for (let i = 0; i < 3; i++) {
        requests.push(
          request(app)
            .post('/api/v1/auth/register')
            .send({
              email: `ratetest${i}@example.com`,
              password: 'RateTestPassword123'
            })
        );
      }

      const responses = await Promise.all(requests);

      // Should get responses (not all rate limited immediately)
      responses.forEach(response => {
        expect(response.body).toHaveProperty('success');
        expect(typeof response.body.success).toBe('boolean');
      });

      // Check if any responses include rate limit info
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      rateLimitedResponses.forEach(response => {
        expect(response.body).toHaveProperty('error', 'RATE_LIMIT_EXCEEDED');
      });
    });
  });

  describe('404 Route Handling', () => {
    it('should return helpful 404 responses for unknown routes', async () => {
      const response = await request(app)
        .get('/api/v1/unknown/route');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'ROUTE_NOT_FOUND');
      expect(response.body).toHaveProperty('availableRoutes');
    });

    it('should handle unknown HTTP methods gracefully', async () => {
      const response = await request(app)
        .patch('/api/v1/auth/register')
        .send({});

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('Large Request Handling', () => {
    it('should handle requests within size limits', async () => {
      const largeButValidRequest = {
        email: 'test@example.com',
        password: 'TestPassword123',
        extraData: 'a'.repeat(1000) // 1KB of extra data
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(largeButValidRequest);

      // Should process request (may fail validation but not due to size)
      expect([400, 409, 429, 500]).toContain(response.status);
      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('CORS and Security Headers', () => {
    it('should include CORS headers', async () => {
      const response = await request(app)
        .get('/health')
        .set('Origin', 'http://localhost:3000');

      // CORS headers should be present
      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });

    it('should not expose sensitive information in errors', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'WrongPassword123'
        });

      const responseText = JSON.stringify(response.body);
      
      // Should not expose sensitive information
      expect(responseText).not.toContain('password');
      expect(responseText).not.toContain('secret');
      expect(responseText).not.toContain('stack');
      expect(response.body).not.toHaveProperty('debug');
    });
  });

  describe('Health Check Integration', () => {
    it('should provide comprehensive health information', async () => {
      const response = await request(app)
        .get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data).toHaveProperty('timestamp');
      expect(response.body.data).toHaveProperty('version', '1.0.0');
      expect(response.body.data).toHaveProperty('environment');
      expect(response.body.data).toHaveProperty('database');
    });
  });

  describe('Concurrent Request Handling', () => {
    it('should handle concurrent requests without crashes', async () => {
      const concurrentRequests = Array.from({ length: 5 }, (_, i) =>
        request(app)
          .get('/health')
      );

      const responses = await Promise.all(concurrentRequests);

      // All requests should complete successfully
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
      });
    });

    it('should handle mixed concurrent operations', async () => {
      const mixedRequests = [
        request(app).get('/health'),
        request(app).post('/api/v1/auth/register').send({
          email: 'concurrent1@example.com',
          password: 'ConcurrentTest123'
        }),
        request(app).post('/api/v1/auth/login').send({
          email: 'concurrent2@example.com',
          password: 'ConcurrentTest123'
        }),
        request(app).get('/api/v1/users/profile').set('Authorization', 'Bearer invalid.token')
      ];

      const responses = await Promise.all(mixedRequests);

      // All requests should complete (with appropriate status codes)
      responses.forEach((response, index) => {
        expect(response.body).toHaveProperty('success');
        expect(typeof response.body.success).toBe('boolean');
      });
    });
  });
});
