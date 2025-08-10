/**
 * Performance test timing expectations adjusted for realistic values
 * Accounts for system variability and CI environment differences
 */

// Base timing expectations (in milliseconds)
export const PERFORMANCE_EXPECTATIONS = {
  // Distance calculation performance
  DISTANCE_CALCULATION: {
    SMALL_DATASET: 100,      // < 1000 locations
    MEDIUM_DATASET: 2000,    // 1000-10000 locations  
    LARGE_DATASET: 8000,     // 10000-50000 locations
    TIMEOUT: 15000           // Maximum timeout for distance calculations
  },

  // World exploration calculation performance
  WORLD_EXPLORATION: {
    SMALL_DATASET: 500,      // < 1000 revealed areas
    MEDIUM_DATASET: 5000,    // 1000-5000 revealed areas
    LARGE_DATASET: 15000,    // 5000-10000 revealed areas
    TIMEOUT: 25000           // Maximum timeout for world exploration calculations
  },

  // Geographic hierarchy performance
  GEOGRAPHIC_HIERARCHY: {
    SIMPLE_HIERARCHY: 1000,  // < 1000 locations with geography
    COMPLEX_HIERARCHY: 8000, // 1000-25000 locations with geography
    DEEP_HIERARCHY: 12000,   // Deep nesting with many levels
    TIMEOUT: 20000           // Maximum timeout for hierarchy calculations
  },

  // Cache operation performance
  CACHE_OPERATIONS: {
    SINGLE_SET: 100,         // Single cache set operation
    SINGLE_GET: 50,          // Single cache get operation
    BATCH_SET: 2000,         // Batch cache set operations
    BATCH_GET: 1000,         // Batch cache get operations
    LARGE_DATA_SET: 2000,    // Caching large datasets
    LARGE_DATA_GET: 1000,    // Retrieving large datasets
    CACHE_WARM: 5000,        // Cache warming operations
    CONCURRENT_OPS: 5000     // Concurrent cache operations
  },

  // Background processing performance
  BACKGROUND_PROCESSING: {
    SIMPLE_TASK: 100,        // Simple background task
    COMPLEX_TASK: 1000,      // Complex background task
    CONCURRENT_TASKS: 15000, // Multiple concurrent tasks
    QUEUE_PROCESSING: 5000   // Queue processing operations
  },

  // Network operation performance
  NETWORK_OPERATIONS: {
    CONNECTIVITY_TEST: 5000, // Network connectivity test
    STATE_FETCH: 1000,       // Network state fetch
    RETRY_OPERATION: 10000,  // Network retry operations
    TIMEOUT_TEST: 6000       // Network timeout test (should be > actual timeout)
  },

  // Memory management performance
  MEMORY_OPERATIONS: {
    USAGE_CHECK: 100,        // Memory usage check
    OPTIMIZATION: 2000,      // Memory optimization
    PRESSURE_DETECTION: 50   // Memory pressure detection
  },

  // Component rendering performance
  COMPONENT_RENDERING: {
    SIMPLE_RENDER: 100,      // Simple component render
    COMPLEX_RENDER: 500,     // Complex component with data
    LARGE_LIST: 2000,        // Large list rendering
    FREQUENT_UPDATES: 1000   // Frequent prop updates
  }
};

// System variability multipliers for different environments
export const ENVIRONMENT_MULTIPLIERS = {
  CI: 2.0,           // CI environments are typically slower
  LOCAL: 1.0,        // Local development environment
  MOBILE: 1.5,       // Mobile device testing
  EMULATOR: 2.5      // Mobile emulator testing
};

// Get current environment multiplier
export const getCurrentEnvironmentMultiplier = () => {
  if (process.env.CI) return ENVIRONMENT_MULTIPLIERS.CI;
  if (process.env.NODE_ENV === 'test') return ENVIRONMENT_MULTIPLIERS.LOCAL;
  return ENVIRONMENT_MULTIPLIERS.LOCAL;
};

// Apply environment multiplier to expectations
export const getAdjustedExpectation = (baseExpectation) => {
  const multiplier = getCurrentEnvironmentMultiplier();
  return Math.ceil(baseExpectation * multiplier);
};

// Helper function to get timeout with buffer
export const getTimeoutWithBuffer = (expectation, bufferMultiplier = 2.0) => {
  return Math.ceil(expectation * bufferMultiplier);
};

// Specific expectation getters with environment adjustment
export const getDistanceCalculationExpectation = (datasetSize) => {
  let base;
  if (datasetSize < 1000) base = PERFORMANCE_EXPECTATIONS.DISTANCE_CALCULATION.SMALL_DATASET;
  else if (datasetSize < 10000) base = PERFORMANCE_EXPECTATIONS.DISTANCE_CALCULATION.MEDIUM_DATASET;
  else base = PERFORMANCE_EXPECTATIONS.DISTANCE_CALCULATION.LARGE_DATASET;
  
  return getAdjustedExpectation(base);
};

export const getWorldExplorationExpectation = (datasetSize) => {
  let base;
  if (datasetSize < 1000) base = PERFORMANCE_EXPECTATIONS.WORLD_EXPLORATION.SMALL_DATASET;
  else if (datasetSize < 5000) base = PERFORMANCE_EXPECTATIONS.WORLD_EXPLORATION.MEDIUM_DATASET;
  else base = PERFORMANCE_EXPECTATIONS.WORLD_EXPLORATION.LARGE_DATASET;
  
  return getAdjustedExpectation(base);
};

export const getHierarchyExpectation = (complexity) => {
  let base;
  switch (complexity) {
    case 'simple': base = PERFORMANCE_EXPECTATIONS.GEOGRAPHIC_HIERARCHY.SIMPLE_HIERARCHY; break;
    case 'complex': base = PERFORMANCE_EXPECTATIONS.GEOGRAPHIC_HIERARCHY.COMPLEX_HIERARCHY; break;
    case 'deep': base = PERFORMANCE_EXPECTATIONS.GEOGRAPHIC_HIERARCHY.DEEP_HIERARCHY; break;
    default: base = PERFORMANCE_EXPECTATIONS.GEOGRAPHIC_HIERARCHY.SIMPLE_HIERARCHY;
  }
  
  return getAdjustedExpectation(base);
};

export const getCacheExpectation = (operation, dataSize = 'small') => {
  let base;
  switch (operation) {
    case 'set':
      base = dataSize === 'large' ? 
        PERFORMANCE_EXPECTATIONS.CACHE_OPERATIONS.LARGE_DATA_SET :
        PERFORMANCE_EXPECTATIONS.CACHE_OPERATIONS.SINGLE_SET;
      break;
    case 'get':
      base = dataSize === 'large' ? 
        PERFORMANCE_EXPECTATIONS.CACHE_OPERATIONS.LARGE_DATA_GET :
        PERFORMANCE_EXPECTATIONS.CACHE_OPERATIONS.SINGLE_GET;
      break;
    case 'batch_set':
      base = PERFORMANCE_EXPECTATIONS.CACHE_OPERATIONS.BATCH_SET;
      break;
    case 'batch_get':
      base = PERFORMANCE_EXPECTATIONS.CACHE_OPERATIONS.BATCH_GET;
      break;
    case 'warm':
      base = PERFORMANCE_EXPECTATIONS.CACHE_OPERATIONS.CACHE_WARM;
      break;
    case 'concurrent':
      base = PERFORMANCE_EXPECTATIONS.CACHE_OPERATIONS.CONCURRENT_OPS;
      break;
    default:
      base = PERFORMANCE_EXPECTATIONS.CACHE_OPERATIONS.SINGLE_SET;
  }
  
  return getAdjustedExpectation(base);
};

// Test helper to measure and validate performance
export const measurePerformance = async (operation, expectation, testName) => {
  const startTime = Date.now();
  await operation();
  const endTime = Date.now();
  const actualTime = endTime - startTime;
  
  // Log performance for debugging
  if (process.env.NODE_ENV === 'test' && process.env.DEBUG_PERFORMANCE) {
    console.log(`Performance: ${testName} took ${actualTime}ms (expected < ${expectation}ms)`);
  }
  
  return {
    actualTime,
    expectation,
    passed: actualTime < expectation,
    testName
  };
};

// Batch performance measurement
export const measureBatchPerformance = async (operations, testName) => {
  const results = [];
  
  for (const { operation, expectation, name } of operations) {
    const result = await measurePerformance(operation, expectation, `${testName} - ${name}`);
    results.push(result);
  }
  
  return results;
};