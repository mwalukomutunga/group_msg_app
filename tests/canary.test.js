// Canary test to verify Jest is working
describe('Project Setup', () => {
  test('Jest is working correctly', () => {
    expect(true).toBe(true);
  });

  test('Basic math operations work', () => {
    expect(2 + 2).toBe(4);
    expect(5 * 3).toBe(15);
  });

  test('Project structure exists', () => {
    const fs = require('fs');
    const path = require('path');

    // Check that key directories exist
    expect(fs.existsSync(path.join(__dirname, '../src'))).toBe(true);
    expect(fs.existsSync(path.join(__dirname, '../src/controllers'))).toBe(true);
    expect(fs.existsSync(path.join(__dirname, '../src/models'))).toBe(true);
    expect(fs.existsSync(path.join(__dirname, '../src/routes'))).toBe(true);
    expect(fs.existsSync(path.join(__dirname, '../src/middleware'))).toBe(true);
    expect(fs.existsSync(path.join(__dirname, '../src/utils'))).toBe(true);
    expect(fs.existsSync(path.join(__dirname, '../src/config'))).toBe(true);
  });

  test('Package.json has correct configuration', () => {
    const packageJson = require('../package.json');
    
    expect(packageJson.name).toBe('group-messaging-backend');
    expect(packageJson.version).toBe('1.0.0');
    expect(packageJson.description).toBe('Secure group messaging platform backend with authentication');
    expect(packageJson.main).toBe('src/app.js');
    
    // Check scripts
    expect(packageJson.scripts.start).toBe('node src/app.js');
    expect(packageJson.scripts.dev).toBe('nodemon src/app.js');
    expect(packageJson.scripts.test).toBe('jest');
    
    // Check dependencies exist
    expect(packageJson.dependencies.express).toBeDefined();
    expect(packageJson.dependencies.mongoose).toBeDefined();
    expect(packageJson.dependencies.bcrypt).toBeDefined();
    expect(packageJson.dependencies.jsonwebtoken).toBeDefined();
    
    // Check dev dependencies
    expect(packageJson.devDependencies.jest).toBeDefined();
    expect(packageJson.devDependencies.nodemon).toBeDefined();
    expect(packageJson.devDependencies.eslint).toBeDefined();
  });
});
