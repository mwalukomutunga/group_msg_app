/**
 * Container Unit Test
 * 
 * Tests the dependency injection container's functionality.
 */

const container = require('../../src/container');

describe('Dependency Injection Container', () => {
  beforeEach(() => {
    // Reset container before each test
    container.reset();
  });

  describe('register', () => {
    it('should register a service', () => {
      // Arrange
      const serviceName = 'testService';
      const serviceInstance = { test: true };
      
      // Act
      const result = container.register(serviceName, serviceInstance);
      
      // Assert
      expect(container.get(serviceName)).toBe(serviceInstance);
      expect(result).toBe(container); // Should return itself for chaining
    });
    
    it('should allow chaining of register calls', () => {
      // Arrange
      const service1 = { name: 'service1' };
      const service2 = { name: 'service2' };
      
      // Act
      container
        .register('service1', service1)
        .register('service2', service2);
      
      // Assert
      expect(container.get('service1')).toBe(service1);
      expect(container.get('service2')).toBe(service2);
    });
  });
  
  describe('registerFactory', () => {
    it('should register a factory function', () => {
      // Arrange
      const factoryName = 'factoryService';
      const factory = () => ({ created: true });
      
      // Act
      container.registerFactory(factoryName, factory);
      
      // Assert
      expect(container.has(factoryName)).toBe(true);
    });
    
    it('should throw an error if factory is not a function', () => {
      // Arrange
      const factoryName = 'invalidFactory';
      const notAFunction = { someObj: true };
      
      // Act & Assert
      expect(() => {
        container.registerFactory(factoryName, notAFunction);
      }).toThrow('Factory must be a function');
    });
    
    it('should create and cache instance when accessed', () => {
      // Arrange
      const factoryName = 'lazyService';
      let factoryCallCount = 0;
      const factory = () => {
        factoryCallCount++;
        return { id: factoryCallCount };
      };
      
      container.registerFactory(factoryName, factory);
      
      // Act - Get service twice
      const instance1 = container.get(factoryName);
      const instance2 = container.get(factoryName);
      
      // Assert
      expect(factoryCallCount).toBe(1); // Factory should be called only once
      expect(instance1).toBe(instance2); // Same instance should be returned
      expect(instance1.id).toBe(1);
    });
    
    it('should pass container to factory function', () => {
      // Arrange
      container.register('dependency', { name: 'dep' });
      
      const factoryName = 'serviceWithDependency';
      const factory = (c) => ({
        dependency: c.get('dependency')
      });
      
      // Act
      container.registerFactory(factoryName, factory);
      const instance = container.get(factoryName);
      
      // Assert
      expect(instance.dependency.name).toBe('dep');
    });
  });
  
  describe('get', () => {
    it('should return a registered service', () => {
      // Arrange
      const serviceName = 'testService';
      const serviceInstance = { test: true };
      container.register(serviceName, serviceInstance);
      
      // Act
      const result = container.get(serviceName);
      
      // Assert
      expect(result).toBe(serviceInstance);
    });
    
    it('should throw an error when service is not found', () => {
      // Arrange
      const nonExistentService = 'nonExistentService';
      
      // Act & Assert
      expect(() => {
        container.get(nonExistentService);
      }).toThrow(`Service '${nonExistentService}' not found in container`);
    });
  });
  
  describe('has', () => {
    it('should return true for registered services', () => {
      // Arrange
      container.register('existingService', { test: true });
      
      // Act
      const result = container.has('existingService');
      
      // Assert
      expect(result).toBe(true);
    });
    
    it('should return true for registered factories', () => {
      // Arrange
      container.registerFactory('factoryService', () => ({ test: true }));
      
      // Act
      const result = container.has('factoryService');
      
      // Assert
      expect(result).toBe(true);
    });
    
    it('should return false for non-registered services', () => {
      // Act
      const result = container.has('nonExistingService');
      
      // Assert
      expect(result).toBe(false);
    });
  });
  
  describe('reset', () => {
    it('should clear all registered services and factories', () => {
      // Arrange
      container.register('service', { name: 'service' });
      container.registerFactory('factory', () => ({ name: 'factory' }));
      
      // Act
      container.reset();
      
      // Assert
      expect(container.has('service')).toBe(false);
      expect(container.has('factory')).toBe(false);
    });
    
    it('should return container instance for chaining', () => {
      // Act
      const result = container.reset();
      
      // Assert
      expect(result).toBe(container);
    });
  });
});
