import {
    calculateSimplifiedFog,
    calculateViewportFog,
    createFogFeatures,
    createFogWithFallback,
    createViewportFogPolygon,
    createWorldFogCollection,
    createWorldFogPolygon,
    getDefaultFogOptions,
    getRevealedAreasInViewport
} from '../utils/fogCalculation';

// Mock the logger
jest.mock('../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    success: jest.fn()
  }
}));

// Mock geometry utilities
jest.mock('../utils/geometryValidation', () => ({
  debugGeometry: jest.fn(),
  getPolygonComplexity: jest.fn(() => ({
    totalVertices: 5,
    ringCount: 1,
    maxRingVertices: 5,
    averageRingVertices: 5,
    complexityLevel: 'LOW'
  })),
  isValidPolygonFeature: jest.fn(() => true)
}));

jest.mock('../utils/geometryOperations', () => ({
  performRobustDifference: jest.fn(() => ({
    result: {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]
      },
      properties: {}
    },
    metrics: {
      operationType: 'difference',
      executionTime: 10,
      inputComplexity: { totalVertices: 5, ringCount: 1, maxRingVertices: 5, averageRingVertices: 5, complexityLevel: 'LOW' },
      outputComplexity: { totalVertices: 5, ringCount: 1, maxRingVertices: 5, averageRingVertices: 5, complexityLevel: 'LOW' },
      hadErrors: false,
      fallbackUsed: false
    },
    errors: [],
    warnings: []
  }))
}));

describe('fogCalculation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createWorldFogPolygon', () => {
    it('should create a world-wide fog polygon', () => {
      const worldFog = createWorldFogPolygon();
      
      expect(worldFog.type).toBe('Feature');
      expect(worldFog.geometry.type).toBe('Polygon');
      expect(worldFog.geometry.coordinates[0]).toEqual([
        [-180, -90],
        [-180, 90],
        [180, 90],
        [180, -90],
        [-180, -90]
      ]);
    });
  });

  describe('createWorldFogCollection', () => {
    it('should create a world fog feature collection', () => {
      const collection = createWorldFogCollection();
      
      expect(collection.type).toBe('FeatureCollection');
      expect(collection.features).toHaveLength(1);
      expect(collection.features[0].geometry.type).toBe('Polygon');
    });
  });

  describe('createViewportFogPolygon', () => {
    it('should create a viewport fog polygon with valid bounds', () => {
      const bounds = [-1, -1, 1, 1];
      const viewportFog = createViewportFogPolygon(bounds);
      
      expect(viewportFog.type).toBe('Feature');
      expect(viewportFog.geometry.type).toBe('Polygon');
      expect(viewportFog.geometry.coordinates[0]).toHaveLength(5); // Closed polygon
    });

    it('should throw error for invalid bounds (minLng >= maxLng)', () => {
      const invalidBounds = [1, -1, -1, 1]; // minLng > maxLng
      
      expect(() => createViewportFogPolygon(invalidBounds)).toThrow('Invalid viewport bounds');
    });

    it('should throw error for invalid bounds (minLat >= maxLat)', () => {
      const invalidBounds = [-1, 1, 1, -1]; // minLat > maxLat
      
      expect(() => createViewportFogPolygon(invalidBounds)).toThrow('Invalid viewport bounds');
    });

    it('should throw error for out-of-range bounds', () => {
      const outOfRangeBounds = [-200, -100, 200, 100]; // Longitude out of range
      
      expect(() => createViewportFogPolygon(outOfRangeBounds)).toThrow('out of valid range');
    });
  });

  describe('getRevealedAreasInViewport', () => {
    const mockRevealedArea = {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]
      },
      properties: {}
    };

    it('should return null for null revealed areas', () => {
      const result = getRevealedAreasInViewport(null, [-2, -2, 2, 2]);
      expect(result).toBeNull();
    });

    it('should return revealed areas when they intersect viewport', () => {
      const viewportBounds = [-0.5, -0.5, 1.5, 1.5]; // Overlaps with mock area
      const result = getRevealedAreasInViewport(mockRevealedArea, viewportBounds);
      
      expect(result).toBe(mockRevealedArea);
    });

    it('should return null when revealed areas do not intersect viewport', () => {
      const viewportBounds = [2, 2, 3, 3]; // No overlap with mock area
      const result = getRevealedAreasInViewport(mockRevealedArea, viewportBounds);
      
      expect(result).toBeNull();
    });

    it('should handle MultiPolygon revealed areas', () => {
      const multiPolygonArea = {
        type: 'Feature',
        geometry: {
          type: 'MultiPolygon',
          coordinates: [[[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]]
        },
        properties: {}
      };
      
      const viewportBounds = [-0.5, -0.5, 1.5, 1.5];
      const result = getRevealedAreasInViewport(multiPolygonArea, viewportBounds);
      
      expect(result).toBe(multiPolygonArea);
    });

    it('should handle errors gracefully and return original areas', () => {
      const invalidArea = {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: null // Invalid coordinates
        },
        properties: {}
      };
      
      const result = getRevealedAreasInViewport(invalidArea, [-1, -1, 1, 1]);
      expect(result).toBe(invalidArea); // Should return original as fallback
    });
  });

  describe('calculateViewportFog', () => {
    const validOptions = {
      viewportBounds: [-1, -1, 1, 1],
      useViewportOptimization: true,
      performanceMode: 'accurate',
      fallbackStrategy: 'viewport'
    };

    it('should calculate viewport fog without revealed areas', () => {
      const result = calculateViewportFog(null, validOptions);
      
      expect(result.fogGeoJSON.type).toBe('FeatureCollection');
      expect(result.fogGeoJSON.features).toHaveLength(1);
      expect(result.performanceMetrics.operationType).toBe('viewport');
      expect(result.performanceMetrics.hadErrors).toBe(false);
      expect(result.errors).toHaveLength(0);
    });

    it('should return error for missing viewport bounds', () => {
      const optionsWithoutBounds = { ...validOptions, viewportBounds: undefined };
      const result = calculateViewportFog(null, optionsWithoutBounds);
      
      expect(result.performanceMetrics.hadErrors).toBe(true);
      expect(result.errors).toContain('No viewport bounds provided for viewport fog calculation');
    });

    it('should calculate fog with revealed areas', () => {
      const mockRevealedArea = {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [[[0, 0], [0.5, 0], [0.5, 0.5], [0, 0.5], [0, 0]]]
        },
        properties: {}
      };

      const result = calculateViewportFog(mockRevealedArea, validOptions);
      
      expect(result.fogGeoJSON.type).toBe('FeatureCollection');
      expect(result.performanceMetrics.operationType).toBe('viewport');
      expect(result.calculationTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle viewport optimization filtering', () => {
      const mockRevealedArea = {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [[[5, 5], [6, 5], [6, 6], [5, 6], [5, 5]]] // Outside viewport
        },
        properties: {}
      };

      const result = calculateViewportFog(mockRevealedArea, validOptions);
      
      expect(result.fogGeoJSON.features).toHaveLength(1); // Should return full fog
      expect(result.warnings).toContain('No revealed areas in viewport');
    });

    it('should return fog when difference operation succeeds', () => {
      // This test verifies the normal case where performRobustDifference
      // returns a valid result (the default mock behavior)
      
      const mockRevealedArea = {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]
        },
        properties: {}
      };

      const result = calculateViewportFog(mockRevealedArea, validOptions);
      
      expect(result.fogGeoJSON.features).toHaveLength(1); // Should have fog
      expect(result.performanceMetrics.hadErrors).toBe(false); // Should not have errors with proper mock
      expect(result.errors).toHaveLength(0); // No errors expected
      expect(result.calculationTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('calculateSimplifiedFog', () => {
    it('should create simplified viewport fog with bounds', () => {
      const bounds = [-1, -1, 1, 1];
      const result = calculateSimplifiedFog(bounds);
      
      expect(result.fogGeoJSON.type).toBe('FeatureCollection');
      expect(result.fogGeoJSON.features).toHaveLength(1);
      expect(result.performanceMetrics.operationType).toBe('viewport');
      expect(result.performanceMetrics.fallbackUsed).toBe(true);
      expect(result.warnings).toContain('Using simplified fog calculation');
    });

    it('should create simplified world fog without bounds', () => {
      const result = calculateSimplifiedFog();
      
      expect(result.fogGeoJSON.type).toBe('FeatureCollection');
      expect(result.fogGeoJSON.features).toHaveLength(1);
      expect(result.performanceMetrics.operationType).toBe('world');
      expect(result.performanceMetrics.fallbackUsed).toBe(true);
    });

    it('should handle errors and fallback to world fog', () => {
      // Test the error handling by passing invalid bounds that will cause an error
      const result = calculateSimplifiedFog([1, 1, -1, -1]); // Invalid bounds
      
      expect(result.performanceMetrics.hadErrors).toBe(true);
      expect(result.performanceMetrics.operationType).toBe('world');
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('createFogWithFallback', () => {
    const validOptions = {
      viewportBounds: [-1, -1, 1, 1],
      useViewportOptimization: true,
      performanceMode: 'accurate',
      fallbackStrategy: 'viewport'
    };

    it('should succeed with primary viewport calculation', () => {
      const result = createFogWithFallback(null, validOptions);
      
      expect(result.fogGeoJSON.type).toBe('FeatureCollection');
      expect(result.performanceMetrics.operationType).toBe('viewport');
      expect(result.performanceMetrics.hadErrors).toBe(false);
    });

    it('should fallback to simplified viewport when primary fails', () => {
      const optionsWithoutBounds = { ...validOptions, viewportBounds: undefined };
      const result = createFogWithFallback(null, optionsWithoutBounds);
      
      expect(result.fogGeoJSON.type).toBe('FeatureCollection');
      expect(result.performanceMetrics.fallbackUsed).toBe(true);
    });

    it('should fallback to world fog when viewport fails', () => {
      const optionsWithWorldFallback = { ...validOptions, fallbackStrategy: 'world', viewportBounds: undefined };
      const result = createFogWithFallback(null, optionsWithWorldFallback);
      
      expect(result.fogGeoJSON.type).toBe('FeatureCollection');
      expect(result.performanceMetrics.operationType).toBe('world');
      expect(result.performanceMetrics.fallbackUsed).toBe(true);
    });

    it('should handle no fallback strategy', () => {
      const optionsWithNoFallback = { ...validOptions, fallbackStrategy: 'none', viewportBounds: undefined };
      
      // The function should still return a result (emergency fallback) rather than throw
      const result = createFogWithFallback(null, optionsWithNoFallback);
      expect(result.performanceMetrics.hadErrors).toBe(true);
      expect(result.performanceMetrics.fallbackUsed).toBe(true);
    });

    it('should provide emergency fallback on critical errors', () => {
      // Test with invalid options that will cause errors in the calculation
      const invalidOptions = { 
        ...validOptions, 
        viewportBounds: [1, 1, -1, -1], // Invalid bounds
        fallbackStrategy: 'world'
      };
      
      const result = createFogWithFallback(null, invalidOptions);
      
      expect(result.fogGeoJSON.type).toBe('FeatureCollection');
      expect(result.performanceMetrics.hadErrors).toBe(true);
      expect(result.performanceMetrics.fallbackUsed).toBe(true);
    });
  });

  describe('createFogFeatures', () => {
    const validOptions = {
      viewportBounds: [-1, -1, 1, 1],
      useViewportOptimization: true,
      performanceMode: 'accurate',
      fallbackStrategy: 'viewport'
    };

    it('should create fog features normally', () => {
      const features = createFogFeatures(null, validOptions, false);
      
      expect(Array.isArray(features)).toBe(true);
      expect(features.length).toBeGreaterThan(0);
      expect(features[0].type).toBe('Feature');
    });

    it('should return stable fog during viewport changes', () => {
      const features = createFogFeatures(null, validOptions, true);
      
      expect(Array.isArray(features)).toBe(true);
      expect(features.length).toBe(1);
      expect(features[0].geometry.type).toBe('Polygon');
    });

    it('should fallback to world fog during viewport changes without bounds', () => {
      const optionsWithoutBounds = { ...validOptions, viewportBounds: undefined };
      const features = createFogFeatures(null, optionsWithoutBounds, true);
      
      expect(features).toHaveLength(1);
      expect(features[0].geometry.coordinates[0]).toEqual([
        [-180, -90],
        [-180, 90],
        [180, 90],
        [180, -90],
        [-180, -90]
      ]);
    });

    it('should handle errors during viewport change fallback', () => {
      // Test with invalid bounds that will cause createViewportFogPolygon to throw
      const invalidOptions = { ...validOptions, viewportBounds: [1, 1, -1, -1] };
      const features = createFogFeatures(null, invalidOptions, true);
      
      expect(features).toHaveLength(1);
      expect(features[0].geometry.type).toBe('Polygon'); // Should fallback to world fog
    });
  });

  describe('getDefaultFogOptions', () => {
    it('should return default options without viewport bounds', () => {
      const options = getDefaultFogOptions();
      
      expect(options.useViewportOptimization).toBe(false);
      expect(options.performanceMode).toBe('accurate');
      expect(options.fallbackStrategy).toBe('viewport');
      expect(options.viewportBounds).toBeUndefined();
    });

    it('should return default options with viewport bounds', () => {
      const bounds = [-1, -1, 1, 1];
      const options = getDefaultFogOptions(bounds);
      
      expect(options.useViewportOptimization).toBe(true);
      expect(options.performanceMode).toBe('accurate');
      expect(options.fallbackStrategy).toBe('viewport');
      expect(options.viewportBounds).toBe(bounds);
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle very large viewport bounds', () => {
      const largeBounds = [-179, -89, 179, 89];
      const options = getDefaultFogOptions(largeBounds);
      const result = calculateViewportFog(null, options);
      
      expect(result.performanceMetrics.performanceLevel).toBeDefined();
      expect(['FAST', 'MODERATE', 'SLOW']).toContain(result.performanceMetrics.performanceLevel);
    });

    it('should handle complex revealed areas', () => {
      const complexRevealedArea = {
        type: 'Feature',
        geometry: {
          type: 'MultiPolygon',
          coordinates: [
            [[[0, 0], [0.5, 0], [0.5, 0.5], [0, 0.5], [0, 0]]],
            [[[1, 1], [1.5, 1], [1.5, 1.5], [1, 1.5], [1, 1]]]
          ]
        },
        properties: {}
      };

      const options = getDefaultFogOptions([-1, -1, 2, 2]);
      const result = calculateViewportFog(complexRevealedArea, options);
      
      expect(result.fogGeoJSON.type).toBe('FeatureCollection');
      expect(result.performanceMetrics.geometryComplexity).toBeDefined();
    });

    it('should measure performance correctly', () => {
      const options = getDefaultFogOptions([-1, -1, 1, 1]);
      const result = calculateViewportFog(null, options);
      
      expect(result.calculationTime).toBeGreaterThanOrEqual(0);
      expect(result.performanceMetrics.executionTime).toBe(result.calculationTime);
      expect(result.performanceMetrics.performanceLevel).toBeDefined();
    });

    it('should handle boundary coordinates correctly', () => {
      const boundaryBounds = [-180, -90, 180, 90]; // World boundaries
      const polygon = createViewportFogPolygon(boundaryBounds);
      
      expect(polygon.type).toBe('Feature');
      expect(polygon.geometry.type).toBe('Polygon');
      expect(polygon.geometry.coordinates[0]).toHaveLength(5); // Closed polygon
      
      // Check that all coordinates are within valid ranges
      const coords = polygon.geometry.coordinates[0];
      coords.forEach(coord => {
        expect(coord[0]).toBeGreaterThanOrEqual(-180);
        expect(coord[0]).toBeLessThanOrEqual(180);
        expect(coord[1]).toBeGreaterThanOrEqual(-90);
        expect(coord[1]).toBeLessThanOrEqual(90);
      });
      
      // Check that polygon is closed
      expect(coords[0]).toEqual(coords[coords.length - 1]);
    });
  });
});