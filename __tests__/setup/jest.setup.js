/**
 * Additional Jest setup for comprehensive testing
 * Extends the main Jest setup with testing-specific configurations
 */

// Import main setup from root
import '../../jest.setup.js';

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

// Enhanced Turf.js mocks with proper edge case handling and consistent GeoJSON results
const mockTurf = {
  difference: jest.fn((minuend, subtrahend) => {
    // Handle null/undefined inputs gracefully
    if (!minuend || !subtrahend) return null;
    
    // Validate input types
    if (minuend.type !== 'Feature' || subtrahend.type !== 'Feature') return null;
    if (!minuend.geometry || !subtrahend.geometry) return null;
    
    // Handle invalid geometry types
    const validTypes = ['Polygon', 'MultiPolygon'];
    if (!validTypes.includes(minuend.geometry.type) || !validTypes.includes(subtrahend.geometry.type)) {
      return null;
    }
    
    // Return a consistent difference result for testing
    return {
      type: 'Feature',
      properties: minuend.properties || {},
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
    // Handle null/undefined inputs
    if (!featureCollection) return null;
    
    // Validate FeatureCollection structure
    if (featureCollection.type !== 'FeatureCollection') return null;
    if (!featureCollection.features || !Array.isArray(featureCollection.features)) return null;
    if (featureCollection.features.length === 0) return null;
    
    // Filter out invalid features
    const validFeatures = featureCollection.features.filter(feature => {
      return feature && 
             feature.type === 'Feature' && 
             feature.geometry && 
             ['Polygon', 'MultiPolygon'].includes(feature.geometry.type);
    });
    
    if (validFeatures.length === 0) return null;
    
    // Return the first valid feature as a simplified union for testing
    const firstFeature = validFeatures[0];
    return {
      type: 'Feature',
      properties: firstFeature.properties || {},
      geometry: firstFeature.geometry
    };
  }),
  
  buffer: jest.fn((point, distance, options = {}) => {
    // Handle null/undefined inputs
    if (!point || !distance) return null;
    
    // Validate point structure
    if (point.type !== 'Feature') return null;
    if (!point.geometry || point.geometry.type !== 'Point') return null;
    if (!Array.isArray(point.geometry.coordinates) || point.geometry.coordinates.length !== 2) return null;
    
    // Validate coordinates
    const coords = point.geometry.coordinates;
    if (typeof coords[0] !== 'number' || typeof coords[1] !== 'number') return null;
    if (!isFinite(coords[0]) || !isFinite(coords[1])) return null;
    
    // Validate distance
    if (typeof distance !== 'number' || !isFinite(distance) || distance <= 0) return null;
    
    // Validate coordinate ranges (basic validation)
    if (coords[0] < -180 || coords[0] > 180 || coords[1] < -90 || coords[1] > 90) return null;
    
    // Calculate buffer offset based on units
    const units = options.units || 'kilometers';
    let offset;
    
    switch (units) {
      case 'meters':
        offset = distance / 111320; // Rough conversion from meters to degrees
        break;
      case 'kilometers':
        offset = distance / 111.32; // Rough conversion from km to degrees
        break;
      default:
        offset = distance / 111.32; // Default to kilometers
    }
    
    // Create a simple square buffer for testing (more predictable than circle)
    return {
      type: 'Feature',
      properties: point.properties || {},
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
    // Handle null/undefined inputs
    if (!feature) return [-122.5, 37.7, -122.3, 37.8];
    
    // Validate feature structure
    if (feature.type !== 'Feature' || !feature.geometry) {
      return [-122.5, 37.7, -122.3, 37.8];
    }
    
    // Return consistent bbox based on geometry type
    switch (feature.geometry.type) {
      case 'Point':
        const coords = feature.geometry.coordinates;
        if (Array.isArray(coords) && coords.length >= 2) {
          const buffer = 0.01; // Small buffer around point
          return [coords[0] - buffer, coords[1] - buffer, coords[0] + buffer, coords[1] + buffer];
        }
        break;
      case 'Polygon':
      case 'MultiPolygon':
        // Return a consistent bbox for polygon features
        return [-122.5, 37.7, -122.3, 37.8];
      default:
        break;
    }
    
    // Default bbox
    return [-122.5, 37.7, -122.3, 37.8];
  }),
  
  bboxPolygon: jest.fn((bbox) => {
    // Handle null/undefined inputs
    if (!bbox || !Array.isArray(bbox) || bbox.length !== 4) {
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
    }
    
    // Validate bbox values
    const [minX, minY, maxX, maxY] = bbox;
    if (typeof minX !== 'number' || typeof minY !== 'number' || 
        typeof maxX !== 'number' || typeof maxY !== 'number') {
      return null;
    }
    
    if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
      return null;
    }
    
    if (minX >= maxX || minY >= maxY) {
      return null;
    }
    
    return {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [minX, minY],
          [maxX, minY],
          [maxX, maxY],
          [minX, maxY],
          [minX, minY]
        ]]
      }
    };
  }),
  
  area: jest.fn((feature) => {
    // Handle null/undefined inputs
    if (!feature) return 0;
    
    // Validate feature structure
    if (feature.type !== 'Feature' || !feature.geometry) return 0;
    
    // Return consistent area based on geometry type
    switch (feature.geometry.type) {
      case 'Polygon':
        return 1000000; // 1 km² for polygons
      case 'MultiPolygon':
        return 2000000; // 2 km² for multipolygons
      default:
        return 0;
    }
  }),
  
  point: jest.fn((coordinates) => {
    // Handle null/undefined inputs
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 2) return null;
    
    // Validate coordinates
    if (typeof coordinates[0] !== 'number' || typeof coordinates[1] !== 'number') return null;
    if (!isFinite(coordinates[0]) || !isFinite(coordinates[1])) return null;
    
    return {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Point',
        coordinates: [coordinates[0], coordinates[1]]
      }
    };
  }),
  
  polygon: jest.fn((coordinates) => {
    // Handle null/undefined inputs
    if (!coordinates || !Array.isArray(coordinates)) return null;
    
    // Validate coordinate structure
    if (coordinates.length === 0) return null;
    
    // Basic validation of first ring
    const firstRing = coordinates[0];
    if (!Array.isArray(firstRing) || firstRing.length < 4) return null;
    
    return {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: coordinates
      }
    };
  }),
  
  featureCollection: jest.fn((features) => {
    // Handle null/undefined inputs
    if (!features || !Array.isArray(features)) {
      return {
        type: 'FeatureCollection',
        features: []
      };
    }
    
    // Filter out null/undefined features
    const validFeatures = features.filter(feature => feature !== null && feature !== undefined);
    
    return {
      type: 'FeatureCollection',
      features: validFeatures
    };
  }),
  
  // Additional commonly used Turf functions
  centroid: jest.fn((feature) => {
    if (!feature || !feature.geometry) return null;
    
    // Return a consistent centroid
    return {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Point',
        coordinates: [-122.4194, 37.7749]
      }
    };
  }),
  
  intersect: jest.fn((feature1, feature2) => {
    // Handle null/undefined inputs
    if (!feature1 || !feature2) return null;
    
    // Validate features
    if (feature1.type !== 'Feature' || feature2.type !== 'Feature') return null;
    if (!feature1.geometry || !feature2.geometry) return null;
    
    // Return null for no intersection (common case in tests)
    return null;
  }),
  
  simplify: jest.fn((feature, options = {}) => {
    // Handle null/undefined inputs
    if (!feature) return null;
    
    // Return the feature as-is for simplification (simplified mock)
    return feature;
  })
};

jest.mock('@turf/turf', () => mockTurf);
jest.mock('@turf/difference', () => ({ difference: mockTurf.difference }));
jest.mock('@turf/union', () => ({ union: mockTurf.union }));
jest.mock('@turf/buffer', () => ({ buffer: mockTurf.buffer }));
jest.mock('@turf/bbox', () => ({ bbox: mockTurf.bbox }));
jest.mock('@turf/bbox-polygon', () => ({ bboxPolygon: mockTurf.bboxPolygon }));
jest.mock('@turf/area', () => ({ area: mockTurf.area }));
jest.mock('@turf/centroid', () => ({ centroid: mockTurf.centroid }));
jest.mock('@turf/intersect', () => ({ intersect: mockTurf.intersect }));
jest.mock('@turf/simplify', () => ({ simplify: mockTurf.simplify }));

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
  
  // Enhanced hook testing utilities
  renderHookSafely: (hookCallback, options = {}) => {
    return global.renderHookUtils.safeRenderHook(hookCallback, options);
  },
  
  waitForHookStable: async (result, timeout = 5000) => {
    return global.renderHookUtils.waitForHookStable(result, timeout);
  },
  
  actSafely: async (callback) => {
    return global.renderHookUtils.safeAct(callback);
  },
  
  // Cleanup helper for tests
  cleanupTest: () => {
    global.cleanup();
  }
};

// Export mock logger for use in tests
export { mockLogger };
