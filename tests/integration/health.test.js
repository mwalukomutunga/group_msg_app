const request = require('supertest');
const { app } = require('../../src/app');

describe('Health Endpoint', () => {
  describe('GET /health', () => {
    it('should return 200 status code', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
    });

    it('should return correct JSON structure', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          status: expect.any(String),
          version: '1.0.0',
          environment: expect.any(String),
          database: expect.any(String)
        }
      });
    });

    it('should include required fields in response', async () => {
      jest.setTimeout(60000); // Increase timeout to 60 seconds for this test
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.status).toBeDefined();
      expect(response.body.data.timestamp).toBeDefined();
      expect(response.body.data.version).toBe('1.0.0');
      expect(response.body.data.environment).toBeDefined();
      expect(response.body.data.database).toBeDefined();
    });

    it('should return valid ISO timestamp', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      const timestamp = response.body.data.timestamp;
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(new Date(timestamp).toISOString()).toBe(timestamp);
    });

    it('should return current environment', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      const environment = response.body.data.environment;
      expect(['development', 'test', 'production']).toContain(environment);
    });

    it('should include database status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      const database = response.body.data.database;
      expect(['connected', 'disconnected', 'error', 'test']).toContain(database);
    });

    it('should report test database status in test environment', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      // In test environment, database should be 'test'
      expect(response.body.data.database).toBe('test');
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/unknown-route')
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Route not found',
        errors: null
      });
    });

    it('should return 404 for unknown POST routes', async () => {
      const response = await request(app)
        .post('/unknown-route')
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Route not found',
        errors: null
      });
    });
  });
});
