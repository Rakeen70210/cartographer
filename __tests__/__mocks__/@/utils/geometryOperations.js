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
    
    // Handle non-Feature geometries by wrapping them
    if (geometry.type !== 'Feature') {
      // If it's a raw geometry, wrap it in a Feature
      const validGeometryTypes = ['Polygon', 'MultiPolygon', 'Point', 'LineString'];
      if (validGeometryTypes.includes(geometry.type)) {
        return {
          type: 'Feature',
          properties: {},
          geometry: geometry
        };
      }
      return null;
    }
    
    if (!geometry.geometry) return null;
    
    // Validate geometry types and coordinates
    const validTypes = ['Polygon', 'MultiPolygon', 'Point', 'LineString'];
    if (!validTypes.includes(geometry.geometry.type)) return null;
    
    // Validate coordinates exist and are arrays
    if (!geometry.geometry.coordinates || !Array.isArray(geometry.geometry.coordinates)) {
      return null;
    }
    
    // Additional validation for specific geometry types
    if (geometry.geometry.type === 'Polygon') {
      if (!Array.isArray(geometry.geometry.coordinates[0]) || 
          geometry.geometry.coordinates[0].length < 4) {
        return null;
      }
    } else if (geometry.geometry.type === 'MultiPolygon') {
      if (!geometry.geometry.coordinates.every(polygon => 
          Array.isArray(polygon) && 
          Array.isArray(polygon[0]) && 
          polygon[0].length >= 4)) {
        return null;
      }
    } else if (geometry.geometry.type === 'Point') {
      if (geometry.geometry.coordinates.length !== 2 ||
          typeof geometry.geometry.coordinates[0] !== 'number' ||
          typeof geometry.geometry.coordinates[1] !== 'number') {
        return null;
      }
    }
    
    // Return sanitized geometry with proper structure
    return {
      type: 'Feature',
      properties: geometry.properties || {},
      geometry: {
        type: geometry.geometry.type,
        coordinates: geometry.geometry.coordinates
      }
    };
  }),
  
  validateGeometry: jest.fn((geometry) => {
    const errors = [];
    const warnings = [];
    
    // Handle null/undefined inputs
    if (!geometry) {
      return { isValid: false, errors: ['Geometry is null or undefined'], warnings: [] };
    }
    
    if (typeof geometry !== 'object') {
      return { isValid: false, errors: ['Geometry must be an object'], warnings: [] };
    }
    
    // Validate Feature structure
    if (geometry.type !== 'Feature') {
      // Allow raw geometries with warning
      const validGeometryTypes = ['Polygon', 'MultiPolygon', 'Point', 'LineString'];
      if (validGeometryTypes.includes(geometry.type)) {
        warnings.push('Raw geometry provided, should be wrapped in Feature');
        // Validate raw geometry
        if (!geometry.coordinates || !Array.isArray(geometry.coordinates)) {
          errors.push('Missing or invalid coordinates');
        }
      } else {
        errors.push('Not a valid Feature or geometry type');
      }
    } else {
      // Validate Feature properties
      if (!geometry.geometry) {
        errors.push('Missing geometry property in Feature');
      } else {
        // Validate geometry types
        const validTypes = ['Polygon', 'MultiPolygon', 'Point', 'LineString'];
        if (!validTypes.includes(geometry.geometry.type)) {
          errors.push(`Invalid geometry type: ${geometry.geometry.type}`);
        }
        
        // Validate coordinates
        if (!geometry.geometry.coordinates || !Array.isArray(geometry.geometry.coordinates)) {
          errors.push('Missing or invalid coordinates in geometry');
        } else {
          // Type-specific validation
          if (geometry.geometry.type === 'Point') {
            if (geometry.geometry.coordinates.length !== 2) {
              errors.push('Point coordinates must have exactly 2 elements');
            } else if (typeof geometry.geometry.coordinates[0] !== 'number' || 
                      typeof geometry.geometry.coordinates[1] !== 'number') {
              errors.push('Point coordinates must be numbers');
            } else if (!isFinite(geometry.geometry.coordinates[0]) || 
                      !isFinite(geometry.geometry.coordinates[1])) {
              errors.push('Point coordinates must be finite numbers');
            }
          } else if (geometry.geometry.type === 'Polygon') {
            if (!Array.isArray(geometry.geometry.coordinates[0])) {
              errors.push('Polygon coordinates must be array of rings');
            } else if (geometry.geometry.coordinates[0].length < 4) {
              errors.push('Polygon ring must have at least 4 coordinates');
            } else {
              // Check if ring is closed
              const ring = geometry.geometry.coordinates[0];
              const first = ring[0];
              const last = ring[ring.length - 1];
              if (first[0] !== last[0] || first[1] !== last[1]) {
                warnings.push('Polygon ring is not closed');
              }
            }
          } else if (geometry.geometry.type === 'MultiPolygon') {
            if (!geometry.geometry.coordinates.every(polygon => 
                Array.isArray(polygon) && Array.isArray(polygon[0]))) {
              errors.push('MultiPolygon coordinates structure is invalid');
            }
          }
        }
      }
      
      // Validate properties exist (can be empty object)
      if (geometry.properties === undefined) {
        warnings.push('Missing properties object, using empty object');
      }
    }
    
    return { 
      isValid: errors.length === 0, 
      errors, 
      warnings 
    };
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
  
  // Error handling with enhanced logging and recovery
  handleGeometryError: jest.fn((error, operation, fallback) => {
    const errorInfo = {
      operation,
      error: error.message,
      timestamp: Date.now(),
      fallbackUsed: !!fallback
    };
    
    // Log error details for debugging
    console.warn(`Geometry error in ${operation}:`, errorInfo);
    
    // Return fallback or null
    return fallback || null;
  }),
  
  // Enhanced error recovery strategies
  recoverFromGeometryError: jest.fn((error, geometry, operation) => {
    // Attempt different recovery strategies based on error type
    if (error.message.includes('coordinates')) {
      // Try to fix coordinate issues
      if (geometry && geometry.geometry && geometry.geometry.coordinates) {
        return mockGeometryOperations.sanitizeGeometry(geometry);
      }
    }
    
    if (error.message.includes('topology')) {
      // Try to simplify geometry for topology errors
      return mockGeometryOperations.simplifyGeometry(geometry);
    }
    
    // Default fallback - return a simple valid geometry
    return {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]
        ]]
      }
    };
  }),
  
  // Batch operation with error handling
  batchGeometryOperation: jest.fn((geometries, operation) => {
    const results = [];
    const errors = [];
    
    geometries.forEach((geometry, index) => {
      try {
        let result;
        switch (operation) {
          case 'sanitize':
            result = mockGeometryOperations.sanitizeGeometry(geometry);
            break;
          case 'validate':
            result = mockGeometryOperations.validateGeometry(geometry);
            break;
          case 'simplify':
            result = mockGeometryOperations.simplifyGeometry(geometry);
            break;
          default:
            result = geometry;
        }
        
        results.push({ index, result, success: true });
      } catch (error) {
        errors.push({ index, error: error.message, success: false });
        results.push({ index, result: null, success: false });
      }
    });
    
    return {
      results,
      errors,
      successCount: results.filter(r => r.success).length,
      errorCount: errors.length
    };
  }),
  
  // Performance monitoring with detailed metrics
  measureGeometryPerformance: jest.fn().mockImplementation(async (operation, ...args) => {
    const startTime = Date.now();
    const startMemory = process.memoryUsage ? process.memoryUsage().heapUsed : 0;
    
    let result;
    let error = null;
    
    try {
      result = await operation(...args);
    } catch (e) {
      error = e;
      result = null;
    }
    
    const endTime = Date.now();
    const endMemory = process.memoryUsage ? process.memoryUsage().heapUsed : 0;
    
    return {
      result,
      error,
      metrics: {
        executionTime: endTime - startTime,
        memoryDelta: endMemory - startMemory,
        timestamp: startTime,
        success: !error
      }
    };
  }),
  
  // Error class with enhanced debugging info
  GeometryOperationError: class GeometryOperationError extends Error {
    constructor(message, operation, originalError, geometry = null) {
      super(message);
      this.name = 'GeometryOperationError';
      this.operation = operation;
      this.originalError = originalError;
      this.geometry = geometry;
      this.timestamp = Date.now();
      
      // Add stack trace from original error if available
      if (originalError && originalError.stack) {
        this.stack = `${this.stack}\nCaused by: ${originalError.stack}`;
      }
    }
    
    toJSON() {
      return {
        name: this.name,
        message: this.message,
        operation: this.operation,
        timestamp: this.timestamp,
        originalError: this.originalError ? this.originalError.message : null
      };
    }
  },
  
  // Test utilities for controlling mock behavior
  _setValidationMode: (mode) => {
    // Modes: 'strict', 'lenient', 'permissive'
    mockGeometryOperations._validationMode = mode;
  },
  
  _simulateError: (operation, errorType = 'generic') => {
    const errors = {
      generic: new Error('Geometry operation failed'),
      topology: new Error('Topology error in geometry'),
      coordinates: new Error('Invalid coordinates'),
      memory: new Error('Out of memory during geometry operation'),
      timeout: new Error('Geometry operation timeout')
    };
    
    const error = errors[errorType] || errors.generic;
    
    // Override the specified operation to throw error
    const originalMethod = mockGeometryOperations[operation];
    mockGeometryOperations[operation] = jest.fn().mockImplementation(() => {
      throw error;
    });
    
    // Return cleanup function
    return () => {
      mockGeometryOperations[operation] = originalMethod;
    };
  },
  
  _reset: () => {
    // Reset all mocks to default behavior
    Object.keys(mockGeometryOperations).forEach(key => {
      if (typeof mockGeometryOperations[key] === 'function' && 
          mockGeometryOperations[key].mockClear) {
        mockGeometryOperations[key].mockClear();
      }
    });
    
    delete mockGeometryOperations._validationMode;
  }
};

module.exports = mockGeometryOperations;