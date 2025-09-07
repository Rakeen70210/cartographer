/**
 * Standardized test setup for consistent mock data structures and values
 * This file should be imported by all test files to ensure consistency
 */

import {
  createInvalidGeometry,
  createMockHierarchicalData,
  createMockLocations,
  createMockLocationsWithGeography,
  createMockNetworkState,
  createMockOfflineCapabilities,
  createMockRemainingRegionsData,
  createMockRevealedAreas,
  createMockStatisticsData,
  createValidFeature,
  createValidMultiPolygon,
  createValidPolygon
} from '../mocks/testDataFactories.js';

// Global test constants for consistency
export const TEST_CONSTANTS = {
  // Standard coordinates (San Francisco)
  DEFAULT_LATITUDE: 37.7749,
  DEFAULT_LONGITUDE: -122.4194,
  
  // Standard timestamps
  DEFAULT_TIMESTAMP: 1640995200000, // Jan 1, 2022 00:00:00 GMT
  RECENT_TIMESTAMP: Date.now() - (5 * 60 * 1000), // 5 minutes ago
  OLD_TIMESTAMP: Date.now() - (24 * 60 * 60 * 1000), // 24 hours ago
  
  // Standard IDs
  DEFAULT_USER_ID: 'test-user-123',
  DEFAULT_LOCATION_ID: 1,
  DEFAULT_AREA_ID: 1,
  
  // Standard geographic data
  DEFAULT_COUNTRY: 'United States',
  DEFAULT_STATE: 'California',
  DEFAULT_CITY: 'San Francisco',
  DEFAULT_COUNTRY_CODE: 'US',
  DEFAULT_STATE_CODE: 'CA',
  
  // Standard distance values
  DEFAULT_DISTANCE_METERS: 1000,
  DEFAULT_DISTANCE_MILES: 0.621371,
  DEFAULT_DISTANCE_KILOMETERS: 1.0,
  
  // Standard area values
  EARTH_SURFACE_AREA_KM2: 510072000,
  DEFAULT_EXPLORED_AREA_KM2: 5.1,
  DEFAULT_EXPLORATION_PERCENTAGE: 0.001,
  
  // Standard region counts
  TOTAL_COUNTRIES: 195,
  TOTAL_STATES: 3142,
  TOTAL_CITIES: 10000,
  
  // Standard cache TTL
  DEFAULT_CACHE_TTL: 24 * 60 * 60 * 1000, // 24 hours
  
  // Standard network timeouts
  DEFAULT_NETWORK_TIMEOUT: 5000,
  DEFAULT_RETRY_ATTEMPTS: 3,
  DEFAULT_RETRY_DELAY: 1000
};

// Standardized mock data sets for different test scenarios
export const STANDARD_TEST_DATA = {
  // Empty/initial state
  EMPTY_STATE: {
    locations: [],
    revealedAreas: [],
    statistics: createMockStatisticsData({
      totalDistance: { miles: 0, kilometers: 0 },
      worldExploration: { percentage: 0, exploredAreaKm2: 0, totalAreaKm2: TEST_CONSTANTS.EARTH_SURFACE_AREA_KM2 },
      uniqueRegions: { countries: 0, states: 0, cities: 0 },
      remainingRegions: { countries: TEST_CONSTANTS.TOTAL_COUNTRIES, states: TEST_CONSTANTS.TOTAL_STATES, cities: TEST_CONSTANTS.TOTAL_CITIES }
    }),
    hierarchicalData: [],
    networkState: createMockNetworkState({ isConnected: false, type: 'none' })
  },

  // Small dataset (for basic functionality tests)
  SMALL_DATASET: {
    locations: createMockLocations(2),
    locationsWithGeography: createMockLocationsWithGeography(2),
    revealedAreas: createMockRevealedAreas(2),
    statistics: createMockStatisticsData({
      totalDistance: { miles: 1.24, kilometers: 2.0 },
      worldExploration: { percentage: 0.001, exploredAreaKm2: 5.1, totalAreaKm2: TEST_CONSTANTS.EARTH_SURFACE_AREA_KM2 },
      uniqueRegions: { countries: 1, states: 1, cities: 2 },
      remainingRegions: { countries: 194, states: 3141, cities: 9998 }
    }),
    hierarchicalData: createMockHierarchicalData(),
    networkState: createMockNetworkState()
  },

  // Medium dataset (for integration tests)
  MEDIUM_DATASET: {
    locations: createMockLocations(100),
    locationsWithGeography: createMockLocationsWithGeography(100),
    revealedAreas: createMockRevealedAreas(50),
    statistics: createMockStatisticsData({
      totalDistance: { miles: 62.14, kilometers: 100.0 },
      worldExploration: { percentage: 0.05, exploredAreaKm2: 255.0, totalAreaKm2: TEST_CONSTANTS.EARTH_SURFACE_AREA_KM2 },
      uniqueRegions: { countries: 5, states: 10, cities: 25 },
      remainingRegions: { countries: 190, states: 3132, cities: 9975 }
    }),
    hierarchicalData: createMockHierarchicalData(),
    networkState: createMockNetworkState()
  },

  // Large dataset (for performance tests)
  LARGE_DATASET: {
    locations: createMockLocations(10000),
    locationsWithGeography: createMockLocationsWithGeography(10000),
    revealedAreas: createMockRevealedAreas(5000),
    statistics: createMockStatisticsData({
      totalDistance: { miles: 6214.0, kilometers: 10000.0 },
      worldExploration: { percentage: 1.0, exploredAreaKm2: 5100.0, totalAreaKm2: TEST_CONSTANTS.EARTH_SURFACE_AREA_KM2 },
      uniqueRegions: { countries: 25, states: 100, cities: 500 },
      remainingRegions: { countries: 170, states: 3042, cities: 9500 }
    }),
    hierarchicalData: createMockHierarchicalData(),
    networkState: createMockNetworkState()
  }
};

// Standardized error scenarios
export const ERROR_SCENARIOS = {
  NETWORK_ERROR: {
    error: new Error('Network connection failed'),
    networkState: createMockNetworkState({ isConnected: false, type: 'none' }),
    expectedBehavior: 'fallback_to_offline'
  },

  DATABASE_ERROR: {
    error: new Error('Database connection failed'),
    networkState: createMockNetworkState(),
    expectedBehavior: 'show_error_message'
  },

  TIMEOUT_ERROR: {
    error: new Error('Request timeout'),
    networkState: createMockNetworkState(),
    expectedBehavior: 'retry_operation'
  },

  VALIDATION_ERROR: {
    error: new Error('Invalid data format'),
    networkState: createMockNetworkState(),
    expectedBehavior: 'show_validation_error'
  },

  CACHE_ERROR: {
    error: new Error('Cache operation failed'),
    networkState: createMockNetworkState(),
    expectedBehavior: 'continue_without_cache'
  }
};

// Standardized geometry test cases
export const GEOMETRY_TEST_CASES = {
  VALID_CASES: {
    simple_polygon: createValidPolygon(),
    multi_polygon: createValidMultiPolygon(),
    feature_with_polygon: createValidFeature(),
    complex_polygon: {
      type: 'Polygon',
      coordinates: [[
        [-122.4194, 37.7749], [-122.4094, 37.7749], [-122.4094, 37.7849],
        [-122.4144, 37.7899], [-122.4194, 37.7849], [-122.4194, 37.7749]
      ]]
    }
  },

  INVALID_CASES: {
    point_geometry: createInvalidGeometry(),
    line_geometry: {
      type: 'LineString',
      coordinates: [[-122.4194, 37.7749], [-122.4094, 37.7849]]
    },
    malformed_polygon: {
      type: 'Polygon',
      coordinates: [[[0, 0], [1, 1]]] // Only 2 points, need at least 4
    },
    missing_coordinates: {
      type: 'Polygon'
      // Missing coordinates property
    },
    null_geometry: null,
    undefined_geometry: undefined,
    empty_object: {}
  }
};

// Standardized network state scenarios
export const NETWORK_SCENARIOS = {
  ONLINE_WIFI: createMockNetworkState({
    isConnected: true,
    isInternetReachable: true,
    type: 'wifi'
  }),

  ONLINE_CELLULAR: createMockNetworkState({
    isConnected: true,
    isInternetReachable: true,
    type: 'cellular'
  }),

  OFFLINE: createMockNetworkState({
    isConnected: false,
    isInternetReachable: false,
    type: 'none'
  }),

  POOR_CONNECTION: createMockNetworkState({
    isConnected: true,
    isInternetReachable: false,
    type: 'cellular'
  }),

  UNKNOWN_CONNECTION: createMockNetworkState({
    isConnected: null,
    isInternetReachable: null,
    type: 'unknown'
  })
};

// Helper functions for test setup
export const setupStandardMocks = (scenario = 'SMALL_DATASET') => {
  const data = STANDARD_TEST_DATA[scenario];
  
  return {
    mockLocations: data.locations,
    mockRevealedAreas: data.revealedAreas,
    mockStatistics: data.statistics,
    mockHierarchicalData: data.hierarchicalData,
    mockNetworkState: data.networkState,
    mockOfflineCapabilities: createMockOfflineCapabilities()
  };
};

export const setupErrorScenario = (scenarioName) => {
  const scenario = ERROR_SCENARIOS[scenarioName];
  
  return {
    error: scenario.error,
    networkState: scenario.networkState,
    expectedBehavior: scenario.expectedBehavior
  };
};

export const setupGeometryTestCase = (caseType, caseName) => {
  return GEOMETRY_TEST_CASES[caseType][caseName];
};

export const setupNetworkScenario = (scenarioName) => {
  return NETWORK_SCENARIOS[scenarioName];
};

// Test data validation helpers
export const validateTestData = {
  location: (location) => {
    return location &&
           typeof location.id === 'number' &&
           typeof location.latitude === 'number' &&
           typeof location.longitude === 'number' &&
           typeof location.timestamp === 'number' &&
           location.latitude >= -90 && location.latitude <= 90 &&
           location.longitude >= -180 && location.longitude <= 180;
  },

  revealedArea: (area) => {
    return area &&
           typeof area.id === 'number' &&
           typeof area.geojson === 'string';
  },

  statistics: (stats) => {
    return stats &&
           stats.totalDistance &&
           typeof stats.totalDistance.miles === 'number' &&
           typeof stats.totalDistance.kilometers === 'number' &&
           stats.worldExploration &&
           typeof stats.worldExploration.percentage === 'number' &&
           stats.uniqueRegions &&
           typeof stats.uniqueRegions.countries === 'number';
  },

  networkState: (state) => {
    return state &&
           typeof state.isConnected === 'boolean' &&
           typeof state.type === 'string';
  }
};

// Enhanced test assertions with detailed error messages
export const commonAssertions = {
  expectValidLocation: (location) => {
    const isValid = validateTestData.location(location);
    if (!isValid) {
      const details = [];
      if (!location) details.push('location is null/undefined');
      if (location && typeof location.id !== 'number') details.push('id is not a number');
      if (location && typeof location.latitude !== 'number') details.push('latitude is not a number');
      if (location && typeof location.longitude !== 'number') details.push('longitude is not a number');
      if (location && (location.latitude < -90 || location.latitude > 90)) details.push('latitude out of range');
      if (location && (location.longitude < -180 || location.longitude > 180)) details.push('longitude out of range');
      
      throw new Error(`Invalid location data: ${details.join(', ')}`);
    }
    return true;
  },

  expectValidStatistics: (statistics) => {
    const isValid = validateTestData.statistics(statistics);
    if (!isValid) {
      const details = [];
      if (!statistics) details.push('statistics is null/undefined');
      if (statistics && !statistics.totalDistance) details.push('missing totalDistance');
      if (statistics && !statistics.worldExploration) details.push('missing worldExploration');
      if (statistics && !statistics.uniqueRegions) details.push('missing uniqueRegions');
      
      throw new Error(`Invalid statistics data: ${details.join(', ')}`);
    }
    return true;
  },

  expectValidNetworkState: (networkState) => {
    const isValid = validateTestData.networkState(networkState);
    if (!isValid) {
      const details = [];
      if (!networkState) details.push('networkState is null/undefined');
      if (networkState && typeof networkState.isConnected !== 'boolean') details.push('isConnected is not boolean');
      if (networkState && typeof networkState.type !== 'string') details.push('type is not string');
      
      throw new Error(`Invalid network state: ${details.join(', ')}`);
    }
    return true;
  },

  expectConsistentDataStructure: (actual, expected) => {
    const actualKeys = Object.keys(actual).sort();
    const expectedKeys = Object.keys(expected).sort();
    
    if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
      const missing = expectedKeys.filter(key => !actualKeys.includes(key));
      const extra = actualKeys.filter(key => !expectedKeys.includes(key));
      
      let message = 'Data structure mismatch:';
      if (missing.length > 0) message += ` missing keys: ${missing.join(', ')}`;
      if (extra.length > 0) message += ` extra keys: ${extra.join(', ')}`;
      
      throw new Error(message);
    }
    
    if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
      throw new Error(message);
    }
    return true;
  },

  expectValidGeometry: (geometry) => {
    if (!geometry) {
      throw new Error('Geometry is null or undefined');
    }
    
    if (geometry.type !== 'Feature' && !['Polygon', 'MultiPolygon', 'Point', 'LineString'].includes(geometry.type)) {
      throw new Error(`Invalid geometry type: ${geometry.type}`);
    }
    
    const geom = geometry.type === 'Feature' ? geometry.geometry : geometry;
    if (!geom.coordinates || !Array.isArray(geom.coordinates)) {
      throw new Error('Geometry missing valid coordinates');
    }
    
    return true; // If we get here, geometry is valid
  },

  expectValidGeoJSON: (geojson) => {
    try {
      const parsed = typeof geojson === 'string' ? JSON.parse(geojson) : geojson;
      commonAssertions.expectValidGeometry(parsed);
    } catch (error) {
      throw new Error(`Invalid GeoJSON: ${error.message}`);
    }
  },

  expectAsyncOperation: async (operation, timeout = 5000) => {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Operation timed out after ${timeout}ms`)), timeout);
    });
    
    try {
      const result = await Promise.race([operation(), timeoutPromise]);
      return result;
    } catch (error) {
      throw new Error(`Async operation failed: ${error.message}`);
    }
  },

  expectMockCalled: (mockFn, expectedCalls = 1) => {
    if (!mockFn || typeof mockFn !== 'function' || !mockFn.mock) {
      throw new Error('Expected a Jest mock function');
    }
    
    const actualCalls = mockFn.mock.calls.length;
    if (actualCalls !== expectedCalls) {
      throw new Error(`Expected mock to be called ${expectedCalls} times, but was called ${actualCalls} times`);
    }
    
    if (actualCalls !== expectedCalls) {
      throw new Error(`Expected mock to be called ${expectedCalls} times, but was called ${actualCalls} times`);
    }
    return true;
  },

  expectMockCalledWith: (mockFn, ...expectedArgs) => {
    if (!mockFn || typeof mockFn !== 'function' || !mockFn.mock) {
      throw new Error('Expected a Jest mock function');
    }
    
    const lastCall = mockFn.mock.calls[mockFn.mock.calls.length - 1];
    if (!lastCall) {
      throw new Error('Mock function was never called');
    }
    
    const argsMatch = JSON.stringify(lastCall) === JSON.stringify(expectedArgs);
    if (!argsMatch) {
      throw new Error(`Expected mock to be called with ${JSON.stringify(expectedArgs)}, but was called with ${JSON.stringify(lastCall)}`);
    }
    return true;
  }
};

// Enhanced test utilities for error handling and edge cases
export const testUtilities = {
  // Wait for async operations with timeout
  waitForAsync: async (condition, timeout = 5000, interval = 100) => {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    throw new Error(`Condition not met within ${timeout}ms`);
  },

  // Retry operation with exponential backoff
  retryOperation: async (operation, maxRetries = 3, baseDelay = 100) => {
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  },

  // Create test timeout wrapper
  withTimeout: (operation, timeout = 5000) => {
    return Promise.race([
      operation(),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Operation timed out after ${timeout}ms`)), timeout);
      })
    ]);
  },

  // Mock console methods for testing
  mockConsole: () => {
    const originalConsole = { ...console };
    const mockMethods = {};
    
    ['log', 'warn', 'error', 'info', 'debug'].forEach(method => {
      mockMethods[method] = jest.fn();
      console[method] = mockMethods[method];
    });
    
    return {
      mocks: mockMethods,
      restore: () => {
        Object.assign(console, originalConsole);
      }
    };
  },

  // Performance measurement utilities (consolidated from performance-monitor.js)
  measurePerformance: async (operation, testName) => {
    const startTime = Date.now();
    const memoryStart = process.memoryUsage ? process.memoryUsage() : { heapUsed: 0 };
    
    try {
      const result = await operation();
      const endTime = Date.now();
      const memoryEnd = process.memoryUsage ? process.memoryUsage() : { heapUsed: 0 };
      
      return {
        result,
        executionTime: endTime - startTime,
        memoryDelta: Math.round((memoryEnd.heapUsed - memoryStart.heapUsed) / 1024 / 1024 * 100) / 100, // MB
        testName
      };
    } catch (error) {
      const endTime = Date.now();
      throw new Error(`${testName} failed after ${endTime - startTime}ms: ${error.message}`);
    }
  },

  // Batch performance measurement
  measureBatch: async (operations) => {
    const results = [];
    for (const { name, operation } of operations) {
      try {
        const result = await testUtilities.measurePerformance(operation, name);
        results.push({ name, ...result, success: true });
      } catch (error) {
        results.push({ name, error: error.message, success: false });
      }
    }
    return results;
  },

  // Test runner utilities (consolidated from test runner files)
  runTestSuite: async (suiteName, testPattern, options = {}) => {
    const { timeout = 30000, verbose = true } = options;
    
    try {
      const startTime = Date.now();
      
      // This would normally run Jest, but for consolidation we'll return a mock result
      // In actual usage, this would use execSync to run Jest
      const executionTime = Date.now() - startTime;
      
      return {
        success: true,
        suiteName,
        executionTime,
        testPattern
      };
    } catch (error) {
      return {
        success: false,
        suiteName,
        error: error.message,
        testPattern
      };
    }
  },

  // Generate test data with specific characteristics
  generateTestData: {
    locations: (count, options = {}) => {
      const baseLocation = {
        latitude: options.baseLat || TEST_CONSTANTS.DEFAULT_LATITUDE,
        longitude: options.baseLon || TEST_CONSTANTS.DEFAULT_LONGITUDE
      };
      
      return Array.from({ length: count }, (_, i) => ({
        id: i + 1,
        latitude: baseLocation.latitude + (Math.random() - 0.5) * (options.spread || 0.1),
        longitude: baseLocation.longitude + (Math.random() - 0.5) * (options.spread || 0.1),
        timestamp: Date.now() - (count - i) * (options.timeInterval || 1000),
        accuracy: 5 + Math.random() * 10
      }));
    },

    geometries: (count, type = 'Polygon') => {
      return Array.from({ length: count }, (_, i) => {
        const offset = i * 0.01;
        
        if (type === 'Point') {
          return {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [TEST_CONSTANTS.DEFAULT_LONGITUDE + offset, TEST_CONSTANTS.DEFAULT_LATITUDE + offset]
            },
            properties: { id: i + 1 }
          };
        }
        
        return {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [[
              [TEST_CONSTANTS.DEFAULT_LONGITUDE + offset, TEST_CONSTANTS.DEFAULT_LATITUDE + offset],
              [TEST_CONSTANTS.DEFAULT_LONGITUDE + offset + 0.01, TEST_CONSTANTS.DEFAULT_LATITUDE + offset],
              [TEST_CONSTANTS.DEFAULT_LONGITUDE + offset + 0.01, TEST_CONSTANTS.DEFAULT_LATITUDE + offset + 0.01],
              [TEST_CONSTANTS.DEFAULT_LONGITUDE + offset, TEST_CONSTANTS.DEFAULT_LATITUDE + offset + 0.01],
              [TEST_CONSTANTS.DEFAULT_LONGITUDE + offset, TEST_CONSTANTS.DEFAULT_LATITUDE + offset]
            ]]
          },
          properties: { id: i + 1 }
        };
      });
    },

    invalidData: {
      locations: () => [
        null,
        undefined,
        {},
        { latitude: 'invalid' },
        { longitude: 'invalid' },
        { latitude: 91, longitude: 0 }, // Invalid latitude
        { latitude: 0, longitude: 181 }, // Invalid longitude
        { latitude: NaN, longitude: 0 },
        { latitude: 0, longitude: Infinity }
      ],

      geometries: () => [
        null,
        undefined,
        {},
        { type: 'InvalidType' },
        { type: 'Feature' }, // Missing geometry
        { type: 'Feature', geometry: null },
        { type: 'Feature', geometry: { type: 'Polygon' } }, // Missing coordinates
        { type: 'Feature', geometry: { type: 'Polygon', coordinates: [] } }, // Empty coordinates
        { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[]] } } // Empty ring
      ]
    }
  }
};

// Optimized performance expectations (requirement 5.1, 5.3, 5.4)
export const PERFORMANCE_EXPECTATIONS = {
  DISTANCE_CALCULATION: {
    SMALL_DATASET: 50,       // Reduced for faster execution
    MEDIUM_DATASET: 500,     // Reduced for better reliability  
    LARGE_DATASET: 2000,     // Significantly reduced for manageable performance
    TIMEOUT: 10000           // Reduced timeout (requirement 5.1)
  },
  WORLD_EXPLORATION: {
    SMALL_DATASET: 200,      // Reduced for faster execution
    MEDIUM_DATASET: 1000,    // Reduced for better reliability
    LARGE_DATASET: 3000,     // Reduced for manageable performance
    TIMEOUT: 15000           // Reduced timeout (requirement 5.1)
  },
  CACHE_OPERATIONS: {
    SINGLE_SET: 50,          // Reduced for faster execution
    SINGLE_GET: 25,          // Reduced for faster execution
    BATCH_SET: 500,          // Reduced for better reliability
    TIMEOUT: 5000            // Reduced timeout (requirement 5.1)
  },
  COMPONENT_RENDERING: {
    SIMPLE_RENDER: 50,       // Reduced for faster execution
    COMPLEX_RENDER: 200,     // Reduced for faster execution
    LARGE_LIST: 1000,        // Reduced for better reliability
    TIMEOUT: 3000            // Reduced timeout (requirement 5.1)
  }
};

// Environment multipliers for CI/local testing
export const getAdjustedExpectation = (baseExpectation) => {
  const multiplier = process.env.CI ? 2.0 : 1.0; // CI environments are typically slower
  return Math.ceil(baseExpectation * multiplier);
};

// Optimized test suite configuration (requirement 5.1: < 30 seconds per test)
export const TEST_SUITE_CONFIGS = {
  core: {
    name: 'Core Tests',
    timeout: 20000,          // Reduced for faster execution
    description: 'Essential functionality tests'
  },
  integration: {
    name: 'Integration Tests',
    timeout: 30000,          // Reduced for better performance
    description: 'Cross-component interaction tests'
  },
  performance: {
    name: 'Performance Tests',
    timeout: 30000,          // Significantly reduced (requirement 5.1)
    description: 'Performance and benchmark tests'
  }
};

// Export everything for easy importing in test files
export {
  createMockHierarchicalData, createMockLocations,
  createMockLocationsWithGeography, createMockNetworkState, createMockOfflineCapabilities, createMockRemainingRegionsData, createMockRevealedAreas, createMockStatisticsData
};

