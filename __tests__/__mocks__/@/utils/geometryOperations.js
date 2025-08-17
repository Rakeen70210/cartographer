/**
 * Mock implementation for geometry operations utilities
 * Provides consistent mock behavior for all geometry operations
 */

const mockGeometryOperations = {
  sanitizeGeometry: jest.fn((geometry) => {
    // Return null for invalid geometry, otherwise return the geometry
    if (!geometry || typeof geometry !== 'object') return null;
    if (geometry.type === 'invalid') return null;
    return geometry;
  }),
  validateGeometry: jest.fn(() => true),
  simplifyGeometry: jest.fn((geometry) => geometry),
  calculateGeometryArea: jest.fn(() => 1000000), // 1 km²
  unionGeometries: jest.fn((geometries) => geometries[0] || null),
  unionPolygons: jest.fn((polygons) => ({
    result: polygons[0] || null,
    metrics: {
      inputCount: polygons.length,
      outputComplexity: 'medium',
      hadErrors: false,
      executionTime: 50
    }
  })),
  differenceGeometry: jest.fn((minuend, subtrahend) => minuend),
  performRobustDifference: jest.fn((minuend, subtrahend) => ({
    result: minuend,
    metrics: {
      hadErrors: false,
      executionTime: 25,
      fallbackUsed: false
    }
  })),
  bufferGeometry: jest.fn((geometry, distance) => geometry),
  createBufferWithValidation: jest.fn((point, distance, units) => ({
    result: {
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
    },
    metrics: {
      hadErrors: false,
      executionTime: 15
    }
  })),
  intersectGeometries: jest.fn((geom1, geom2) => geom1),
  
  // Performance monitoring
  measurePerformance: jest.fn().mockImplementation(async (operation) => {
    const start = Date.now();
    const result = await operation();
    const end = Date.now();
    return {
      result,
      duration: end - start,
      memoryUsed: 1024 * 1024 // 1MB mock
    };
  }),
  
  // Geometry validation
  isValidPolygon: jest.fn(() => true),
  isValidMultiPolygon: jest.fn(() => true),
  hasValidCoordinates: jest.fn(() => true),
  
  // Geometry transformation
  transformGeometry: jest.fn((geometry, transform) => geometry),
  normalizeGeometry: jest.fn((geometry) => geometry),
  optimizeGeometry: jest.fn((geometry) => geometry),
  
  // Error handling
  handleGeometryError: jest.fn((error, operation, fallback) => {
    console.warn(`Geometry error in ${operation}:`, error);
    return fallback;
  }),
  
  // Error class
  GeometryOperationError: class GeometryOperationError extends Error {
    constructor(message, operation, originalError) {
      super(message);
      this.name = 'GeometryOperationError';
      this.operation = operation;
      this.originalError = originalError;
    }
  }
};

module.exports = mockGeometryOperations;