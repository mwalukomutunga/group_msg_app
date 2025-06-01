/**
 * Database Utilities
 *
 * Provides helper functions for database operations,
 * including handling timeouts and error management.
 */

/**
 * Execute a database operation with a timeout
 *
 * @param {Promise} operation - The database operation to execute
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {string} operationName - Name of operation for error reporting
 * @returns {Promise} Result of the database operation
 * @throws {Error} If operation times out or fails
 */
const withTimeout = async (operation, timeoutMs = 5000, operationName = 'Database operation') => {
  try {
    // Execute operation with timeout
    const result = await Promise.race([
      operation,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`${operationName} timed out after ${timeoutMs}ms`)), timeoutMs),
      ),
    ]);

    return result;
  } catch (error) {
    // Add context to the error
    error.operationName = operationName;
    error.timeoutMs = timeoutMs;

    // Re-throw with enhanced context
    throw error;
  }
};

/**
 * Execute a database query with retry logic
 *
 * @param {Function} queryFn - Function that returns a promise for the query
 * @param {Object} options - Options for retry behavior
 * @param {number} options.maxRetries - Maximum number of retry attempts
 * @param {number} options.initialDelayMs - Initial delay in milliseconds
 * @param {number} options.timeoutMs - Timeout for each attempt
 * @param {string} options.operationName - Name of operation for error reporting
 * @returns {Promise} Result of the database operation
 * @throws {Error} If all retries fail
 */
const withRetry = async (queryFn, options = {}) => {
  const {
    maxRetries = 3,
    initialDelayMs = 200,
    timeoutMs = 5000,
    operationName = 'Database operation',
  } = options;

  let lastError = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Execute the query with timeout
      return await withTimeout(queryFn(), timeoutMs, operationName);
    } catch (error) {
      lastError = error;

      // Don't retry if this isn't a transient error
      if (error.name === 'ValidationError' || error.name === 'CastError') {
        throw error;
      }

      // Log retry attempt
      console.warn(`Attempt ${attempt + 1} failed for ${operationName}:`, error.message);

      // If this was the last attempt, don't delay
      if (attempt === maxRetries - 1) {
        break;
      }

      // Exponential backoff delay
      const delay = initialDelayMs * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // All retries failed
  const error = lastError || new Error(`${operationName} failed after ${maxRetries} attempts`);
  error.isRetryFailure = true;
  error.attempts = maxRetries;
  throw error;
};

/**
 * Safe database find operation with timeout and error handling
 *
 * @param {Object} model - Mongoose model
 * @param {Object|string} query - Query object or ID
 * @param {Object} options - Options for the operation
 * @param {number} options.timeoutMs - Timeout in milliseconds
 * @param {string} options.operationName - Name of operation for error reporting
 * @returns {Promise} Query result
 * @throws {Error} If operation fails
 */
const safeFind = async (model, query, options = {}) => {
  const {
    timeoutMs = 5000,
    operationName = `Find ${model.modelName}`,
    select = null,
    populate = null,
    lean = false,
  } = options;

  // Convert ID string to ObjectId query
  const queryObj = typeof query === 'string' ? { _id: query } : query;

  // Build the query with optional select and populate
  let queryOperation = model.find(queryObj);

  if (select) {
    queryOperation = queryOperation.select(select);
  }

  if (populate) {
    queryOperation = queryOperation.populate(populate);
  }

  if (lean) {
    queryOperation = queryOperation.lean();
  }

  return withTimeout(queryOperation.exec(), timeoutMs, operationName);
};

/**
 * Safe database findOne operation with timeout and error handling
 *
 * @param {Object} model - Mongoose model
 * @param {Object|string} query - Query object or ID
 * @param {Object} options - Options for the operation
 * @returns {Promise} Query result
 */
const safeFindOne = async (model, query, options = {}) => {
  const {
    timeoutMs = 5000,
    operationName = `FindOne ${model.modelName}`,
    select = null,
    populate = null,
    lean = false,
  } = options;

  // Convert ID string to ObjectId query
  const queryObj = typeof query === 'string' ? { _id: query } : query;

  // Build the query with optional select and populate
  let queryOperation = model.findOne(queryObj);

  if (select) {
    queryOperation = queryOperation.select(select);
  }

  if (populate) {
    queryOperation = queryOperation.populate(populate);
  }

  if (lean) {
    queryOperation = queryOperation.lean();
  }

  return withTimeout(queryOperation.exec(), timeoutMs, operationName);
};

/**
 * Safe database save operation with timeout and error handling
 *
 * @param {Object} document - Mongoose document to save
 * @param {Object} options - Options for the operation
 * @returns {Promise} Saved document
 */
const safeSave = async (document, options = {}) => {
  const {
    timeoutMs = 8000,
    operationName = `Save ${document.constructor.modelName}`,
  } = options;

  return withTimeout(document.save(), timeoutMs, operationName);
};

module.exports = {
  withTimeout,
  withRetry,
  safeFind,
  safeFindOne,
  safeSave,
};
