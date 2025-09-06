/**
 * Mock implementation for geometry operations utilities
 * Provides consistent mock behavior for all geometry operations
 */

const mockGeometryOperations = {
  sanitizeGeometry: jest.fn((geometry) => {
    // Handle null/undefined inputs gracefully
    if (!geometry || typeof geometry !== 'object') return null;
    
    // Handle invalid geometry types
    if (geometry.type === 'invalid' || geometry.type === 'NotFeature') return null;
    
    // Validate Feature structure
    if (geometry.type !== 'Feature') return null;
    if (!geometry.geometry) return null;
    
    // Validate geometry types
    const validTypes = ['Polygon', 'MultiPolygon'];
    if (!validTypes.includes(geometry.geometry.type)) return null;
    
    // Return sanitized geometry with proper structure
    return {
      type: 'Feature',
      properties: geometry.properties || {},
      geometry: geometry.geometry
    };
  }),
  
  validateGeometry: jest.fn((geometry) => {
    // Handle null/undefined inputs
    if (!geometry) return { isValid: false, errors: ['Geometry is null or undefined'], warnings: [] };
    
    // Validate Feature structure
    if (geometry.type !== 'Feature') {
      return { isValid: false, errors: ['Not a valid Feature'], warnings: [] };
    }
    
    if (!geometry.geometry) {
      return { isValid: false, errors: ['Missing geometry'], warnings: [] };
    }
    
    // Validate geometry types
    const validTypes = ['Polygon', 'MultiPolygon', 'Point'];
    if (!validTypes.includes(geometry.geometry.type)) {
      return { isValid: false, errors: [`Invalid geometry type: ${geometry.geometry.type}`], warnings: [] };
    }
    
    return { isValid: true, errors: [], warnings: [] };
  }),
  
  simplifyGeometry: jest.fn((geometry) => geometry),
  calculateGeometryArea: jest.fn(() => 1000000), // 1 km²
  unionGeometries: jest.fn((geometries) => geometries[0] || null),
  
  unionPolygons: jest.fn((polygons) => {
    // Handle null/undefined inputs
    if (!polygons || !Array.isArray(polygons)) {
      return {
        result: null,
        metrics: {
          operationType: 'union',
          executionTime: 1,
          inputComplexity: { totalVertices: 0, ringCount: 0, maxRingVertices: 0, averageRingVertices: 0, complexityLevel: 'LOW' },
          hadErrors: true,
          fallbackUsed: false
        },
        errors: ['Invalid input: not an array'],
        warnings: []
      };
    }
    
    if (polygons.length === 0) {
      return {
        result: null,
        metrics: {
          operationType: 'union',
          executionTime: 1,
          inputComplexity: { totalVertices: 0, ringCount: 0, maxRingVertices: 0, averageRingVertices: 0, complexityLevel: 'LOW' },
          hadErrors: false,
          fallbackUsed: false
        },
        errors: ['No polygons provided for union operation'],
        warnings: []
      };
    }
    
    // Filter valid polygons
    const validPolygons = polygons.filter(p => p && p.type === 'Feature' && p.geometry);
    
    return {
      result: validPolygons[0] || null,
      metrics: {
        operationType: 'union',
        executionTime: 50,
        inputComplexity: { totalVertices: 100, ringCount: 1, maxRingVertices: 100, averageRingVertices: 100, complexityLevel: 'MEDIUM' },
        outputComplexity: { totalVertices: 100, ringCount: 1, maxRingVertices: 100, averageRingVertices: 100, complexityLevel: 'MEDIUM' },
        hadErrors: validPolygons.length !== polygons.length,
        fallbackUsed: false
      },
      errors: validPolygons.length !== polygons.length ? ['Some invalid polygons were skipped'] : [],
      warnings: []
    };
  }),
  
  differenceGeometry: jest.fn((minuend, subtrahend) => minuend),
  
  performRobustDifference: jest.fn((minuend, subtrahend) => {
    // Handle null/undefined inputs
    if (!minuend || !subtrahend) {
      return {
        result: minuend || null,
        metrics: {
          operationType: 'difference',
          executionTime: 1,
          inputComplexity: { totalVertices: 0, ringCount: 0, maxRingVertices: 0, averageRingVertices: 0, complexityLevel: 'LOW' },
          hadErrors: true,
          fallbackUsed: true
        },
        errors: ['Invalid input geometries'],
        warnings: ['Using original geometry as fallback due to validation errors']
      };
    }
    
    // Validate input types
    if (minuend.type !== 'Feature' || subtrahend.type !== 'Feature') {
      return {
        result: minuend,
        metrics: {
          operationType: 'difference',
          executionTime: 1,
          inputComplexity: { totalVertices: 100, ringCount: 1, maxRingVertices: 100, averageRingVertices: 100, complexityLevel: 'MEDIUM' },
          outputComplexity: { totalVertices: 100, ringCount: 1, maxRingVertices: 100, averageRingVertices: 100, complexityLevel: 'MEDIUM' },
          hadErrors: true,
          fallbackUsed: true
        },
        errors: ['Invalid Feature types'],
        warnings: ['Using original geometry as fallback due to validation errors']
      };
    }
    
    return {
      result: minuend,
      metrics: {
        operationType: 'difference',
        executionTime: 25,
        inputComplexity: { totalVertices: 100, ringCount: 1, maxRingVertices: 100, averageRingVertices: 100, complexityLevel: 'MEDIUM' },
        outputComplexity: { totalVertices: 100, ringCount: 1, maxRingVertices: 100, averageRingVertices: 100, complexityLevel: 'MEDIUM' },
        hadErrors: false,
        fallbackUsed: false
      },
      errors: [],
      warnings: []
    };
  }),
  
  bufferGeometry: jest.fn((geometry, distance) => geometry),
  
  createBufferWithValidation: jest.fn((point, distance, units) => {
    // Handle null/undefined inputs
    if (!point || !distance) {
      return {
        result: null,
        metrics: {
          operationType: 'buffer',
          executionTime: 1,
          inputComplexity: { totalVertices: 1, ringCount: 0, maxRingVertices: 0, averageRingVertices: 0, complexityLevel: 'LOW' },
          hadErrors: true,
          fallbackUsed: false
        },
        errors: ['Invalid input parameters'],
        warnings: []
      };
    }
    
    // Validate point structure
    if (point.type !== 'Feature' || !point.geometry || point.geometry.type !== 'Point') {
      return {
        result: null,
        metrics: {
          operationType: 'buffer',
          executionTime: 1,
          inputComplexity: { totalVertices: 1, ringCount: 0, maxRingVertices: 0, averageRingVertices: 0, complexityLevel: 'LOW' },
          hadErrors: true,
          fallbackUsed: false
        },
        errors: ['Invalid point geometry'],
        warnings: []
      };
    }
    
    // Validate coordinates
    const coords = point.geometry.coordinates;
    if (!Array.isArray(coords) || coords.length !== 2 || 
        typeof coords[0] !== 'number' || typeof coords[1] !== 'number' ||
        !isFinite(coords[0]) || !isFinite(coords[1])) {
      return {
        result: null,
        metrics: {
          operationType: 'buffer',
          executionTime: 1,
          inputComplexity: { totalVertices: 1, ringCount: 0, maxRingVertices: 0, averageRingVertices: 0, complexityLevel: 'LOW' },
          hadErrors: true,
          fallbackUsed: false
        },
        errors: ['Invalid point coordinates'],
        warnings: []
      };
    }
    
    // Validate distance
    if (typeof distance !== 'number' || !isFinite(distance) || distance <= 0) {
      return {
        result: null,
        metrics: {
          operationType: 'buffer',
          executionTime: 1,
          inputComplexity: { totalVertices: 1, ringCount: 0, maxRingVertices: 0, averageRingVertices: 0, complexityLevel: 'LOW' },
          hadErrors: true,
          fallbackUsed: false
        },
        errors: [`Invalid buffer distance: ${distance}`],
        warnings: []
      };
    }
    
    // Calculate buffer offset
    const offset = units === 'meters' ? distance / 111320 : distance / 111.32;
    
    return {
      result: {
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
      },
      metrics: {
        operationType: 'buffer',
        executionTime: 15,
        inputComplexity: { totalVertices: 1, ringCount: 0, maxRingVertices: 0, averageRingVertices: 0, complexityLevel: 'LOW' },
        outputComplexity: { totalVertices: 5, ringCount: 1, maxRingVertices: 5, averageRingVertices: 5, complexityLevel: 'LOW' },
        hadErrors: false,
        fallbackUsed: false
      },
      errors: [],
      warnings: []
    };
  }),
  
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