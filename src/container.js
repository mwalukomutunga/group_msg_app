/**
 * Dependency Injection Container
 *
 * A lightweight container for managing application dependencies.
 * This provides a central registry for services, factories, and utilities,
 * making components more decoupled and testable.
 */
class Container {
  constructor() {
    this.reset();
  }

  /**
   * Reset the container, clearing all registered services and factories
   *
   * @returns {Container} - The container instance for chaining
   */
  reset() {
    this.instances = {};
    this.factories = {};
    return this;
  }

  /**
   * Register a service instance in the container
   *
   * @param {string} name - The name to register the service under
   * @param {any} instance - The service instance
   * @returns {Container} - The container instance for chaining
   */
  register(name, instance) {
    this.instances[name] = instance;
    return this;
  }

  /**
   * Register a factory function that creates a service
   *
   * @param {string} name - The name to register the factory under
   * @param {Function} factory - The factory function that creates the service
   * @returns {Container} - The container instance for chaining
   */
  registerFactory(name, factory) {
    if (typeof factory !== 'function') {
      throw new Error('Factory must be a function');
    }
    this.factories[name] = factory;
    return this;
  }

  /**
   * Get a service from the container
   *
   * @param {string} name - The name of the service to retrieve
   * @returns {any} - The requested service
   * @throws {Error} - If the service doesn't exist
   */
  get(name) {
    // Check for instance
    if (this.instances[name]) {
      return this.instances[name];
    }

    // Check for factory
    if (this.factories[name]) {
      // Create instance from factory and cache it
      const instance = this.factories[name](this);
      this.instances[name] = instance;
      return instance;
    }

    throw new Error(`Service '${name}' not found in container`);
  }

  /**
   * Check if a service exists in the container
   *
   * @param {string} name - The name of the service to check
   * @returns {boolean} - True if the service exists as instance or factory
   */
  has(name) {
    return !!(this.instances[name] || this.factories[name]);
  }
}

// Export a singleton instance
const containerInstance = new Container();
module.exports = containerInstance;
