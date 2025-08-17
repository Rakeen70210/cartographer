/**
 * Additional Jest setup for comprehensive testing
 * Extends the main Jest setup with testing-specific configurations
 */

// Import main setup
import './jestSetup.js';

// Mock performance.now for consistent timing in tests
const mockPerformanceNow = jest.fn(() => Date.now());
global.performance = global.performance || {};
global.performance.now = mockPerformanceNow;

// Reset performance.now mock before each test
beforeEach(() => {
  mockPerformanceNow.mockClear();
  let currentTime = 1000; // Start at 1 second
  mockPerformanceNow.mockImplementation(() => {
    currentTime += Math.random() * 100; // Add 0-100ms each call
    return currentTime;
  });
});

// Mock logger for all tests - use the global one from main setup
const mockLogger = global.mockLogger || {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  success: jest.fn()
};

// Ensure logger is available globally
global.mockLogger = mockLogger;

jest.mock('@/utils/logger', () => ({
  logger: mockLogger
}));

// Reset logger mocks before each test
beforeEach(() => {
  Object.values(mockLogger).forEach(fn => fn.mockClear());
});

// Mock database operations consistently
const mockDatabase = {
  // Core database operations
  initDatabase: jest.fn().mockResolvedValue(true),
  database: {
    execSync: jest.fn(),
    getAllSync: jest.fn(() => []),
    getFirstSync: jest.fn(() => null),
    runSync: jest.fn(() => ({ changes: 0, lastInsertRowId: 0 })),
    prepareSync: jest.fn(() => ({
      executeSync: jest.fn(() => ({ changes: 0, lastInsertRowId: 0 })),
      getAllSync: jest.fn(() => []),
      getFirstSync: jest.fn(() => null),
      finalizeSync: jest.fn(),
    })),
    closeSync: jest.fn(),
  },
  
  // Location operations
  getLocations: jest.fn().mockResolvedValue([]),
  saveLocation: jest.fn().mockResolvedValue({ id: 1 }),
  deleteLocation: jest.fn().mockResolvedValue(),
  
  // Revealed area operations
  getRevealedAreas: jest.fn().mockResolvedValue([]),
  saveRevealedArea: jest.fn().mockResolvedValue({ id: 1 }),
  deleteRevealedArea: jest.fn().mockResolvedValue(),
  
  // Cache operations
  getStatisticsCache: jest.fn().mockResolvedValue(null),
  saveStatisticsCache: jest.fn().mockResolvedValue(),
  deleteStatisticsCache: jest.fn().mockResolvedValue(),
  clearAllStatisticsCache: jest.fn().mockResolvedValue(),
  deleteExpiredStatisticsCache: jest.fn().mockResolvedValue(),
  getAllStatisticsCache: jest.fn().mockResolvedValue([]),
  
  // Geocoding operations
  getLocationGeocoding: jest.fn().mockResolvedValue(null),
  saveLocationGeocoding: jest.fn().mockResolvedValue(),
  deleteExpiredLocationGeocodings: jest.fn().mockResolvedValue(),
  getAllLocationGeocodings: jest.fn().mockResolvedValue([])
};

jest.mock('@/utils/database', () => mockDatabase);

// Make mockDatabase available globally
global.mockDatabase = mockDatabase;

// Mock Turf.js operations to be more predictable in tests
const mockTurf = {
  difference: jest.fn((minuend, subtrahend) => {
    // Return a simplified result for testing
    if (!minuend || !subtrahend) return null;
    return {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-122.5, 37.7],
          [-122.3, 37.7],
          [-122.3, 37.8],
          [-122.5, 37.8],
          [-122.5, 37.7]
        ]]
      }
    };
  }),
  union: jest.fn((featureCollection) => {
    if (!featureCollection || !featureCollection.features || featureCollection.features.length === 0) {
      return null;
    }
    // Return the first feature as a simplified union
    return featureCollection.features[0];
  }),
  buffer: jest.fn((point, distance, options) => {
    if (!point || !point.geometry || point.geometry.type !== 'Point') {
      return null;
    }
    const coords = point.geometry.coordinates;
    const offset = distance / 111320; // Rough conversion to degrees
    return {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [coords[0] - offset, coords[1] - offset],
          [coords[0] + offset, coords[1] - offset],
          [coords[0] + offset, coords[1] + offset],
          [coords[0] - offset, coords[1] + offset],
          [coords[0] - offset, coords[1] - offset]
        ]]
      }
    };
  }),
  bbox: jest.fn((feature) => {
    if (!feature || !feature.geometry) return [-122.5, 37.7, -122.3, 37.8];
    return [-122.5, 37.7, -122.3, 37.8];
  }),
  bboxPolygon: jest.fn((bbox) => ({
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [bbox[0], bbox[1]],
        [bbox[2], bbox[1]],
        [bbox[2], bbox[3]],
        [bbox[0], bbox[3]],
        [bbox[0], bbox[1]]
      ]]
    }
  })),
  area: jest.fn(() => 1000000), // 1 km²
  point: jest.fn((coordinates) => ({
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Point',
      coordinates
    }
  })),
  polygon: jest.fn((coordinates) => ({
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates
    }
  })),
  featureCollection: jest.fn((features) => ({
    type: 'FeatureCollection',
    features
  }))
};

jest.mock('@turf/turf', () => mockTurf);
jest.mock('@turf/difference', () => ({ difference: mockTurf.difference }));
jest.mock('@turf/union', () => ({ union: mockTurf.union }));
jest.mock('@turf/buffer', () => ({ buffer: mockTurf.buffer }));
jest.mock('@turf/bbox', () => ({ bbox: mockTurf.bbox }));
jest.mock('@turf/bbox-polygon', () => ({ bboxPolygon: mockTurf.bboxPolygon }));
jest.mock('@turf/area', () => ({ area: mockTurf.area }));

// Make mockTurf available globally
global.mockTurf = mockTurf;

// Increase timeout for comprehensive tests
jest.setTimeout(60000);

// Global test utilities for comprehensive testing
global.testUtils = {
  ...global.testUtils,
  
  // Create consistent mock geometry
  createMockPolygon: (offset = 0) => ({
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [-122.42 + offset, 37.77 + offset],
        [-122.41 + offset, 37.77 + offset],
        [-122.41 + offset, 37.78 + offset],
        [-122.42 + offset, 37.78 + offset],
        [-122.42 + offset, 37.77 + offset]
      ]]
    }
  }),
  
  // Create mock point
  createMockPoint: (lng = -122.4194, lat = 37.7749) => ({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [lng, lat]
    },
    properties: {}
  }),
  
  // Wait for hook to stabilize
  waitForHookStable: async (result, timeout = 5000) => {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (!result.current.isCalculating && !result.current.isChanging) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error('Hook did not stabilize within timeout');
  }
};

// Export mock logger for use in tests
export { mockLogger };
