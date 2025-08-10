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

// Common test assertions
export const commonAssertions = {
  expectValidLocation: (location) => {
    expect(validateTestData.location(location)).toBe(true);
  },

  expectValidStatistics: (statistics) => {
    expect(validateTestData.statistics(statistics)).toBe(true);
  },

  expectValidNetworkState: (networkState) => {
    expect(validateTestData.networkState(networkState)).toBe(true);
  },

  expectConsistentDataStructure: (actual, expected) => {
    expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort());
  }
};

// Export everything for easy importing in test files
export {
    createMockHierarchicalData, createMockLocations,
    createMockLocationsWithGeography, createMockNetworkState, createMockOfflineCapabilities, createMockRemainingRegionsData, createMockRevealedAreas, createMockStatisticsData
};
