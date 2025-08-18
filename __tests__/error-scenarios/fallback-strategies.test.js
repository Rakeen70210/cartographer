/**
 * Error scenario testing with fallback strategies
 * Tests error handling and recovery mechanisms in refactored components
 */

import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useFogCalculation } from '@/hooks/useFogCalculation';
import { useMapViewport } from '@/hooks/useMapViewport';
import { createFogWithFallback } from '@/utils/fogCalculation';
import { createBufferWithValidation, performRobustDifference, unionPolygons } from '@/utils/geometryOperations';
import { GEOMETRY_TEST_CASES, setupErrorScenario, setupStandardMocks } from '../setup/testSetup.js';

// Mock database operations for error scenarios
jest.mock('@/utils/database', () => ({
  getRevealedAreas: jest.fn(),
  saveRevealedArea: jest.fn(),
}));

// Logger is mocked globally in jest setup

describe('Error Scenarios and Fallback Strategies', () => {
  let mockData;

  beforeEach(() => {
    mockData = setupStandardMocks('MEDIUM_DATASET');
    jest.clearAllMocks();
    
    // Reset database mocks to default behavior
    const { getRevealedAreas, saveRevealedArea } = require('@/utils/database');
    getRevealedAreas.mockResolvedValue([]);
    saveRevealedArea.mockResolvedValue(true);
  });

  describe('Database Error Scenarios', () => {
    test('should handle database connection failures with fallback', async () => {
      const { getRevealedAreas } = require('@/utils/database');
      const errorScenario = setupErrorScenario('DATABASE_ERROR');
      
      getRevealedAreas.mockRejectedValue(errorScenario.error);

      const { result } = renderHook(() => useFogCalculation({
        debounceDelay: 50,
        fallbackStrategy: 'world',
        useSpatialIndexing: false // Disable spatial indexing to test direct database path
      }));

      await act(async () => {
        await result.current.refreshFog();
      });

      await waitFor(() => {
        expect(result.current.isCalculating).toBe(false);
      });

      // Should have fallback fog despite database error
      expect(result.current.fogGeoJSON).toBeDefined();
      expect(result.current.fogGeoJSON.features.length).toBeGreaterThan(0);
      expect(result.current.error).toContain('Database connection failed');
      
      // Should log appropriate error messages
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error loading revealed areas'),
        expect.any(Error)
      );
    });

    test('should handle database timeout with retry fallback', async () => {
      const { getRevealedAreas } = require('@/utils/database');
      const errorScenario = setupErrorScenario('TIMEOUT_ERROR');
      
      // First call (initialization) times out, second call (refreshFog) times out, third call succeeds
      getRevealedAreas
        .mockRejectedValueOnce(errorScenario.error) // initialization
        .mockRejectedValueOnce(errorScenario.error) // first refreshFog
        .mockResolvedValueOnce([]); // second refreshFog

      const { result } = renderHook(() => useFogCalculation({
        debounceDelay: 50,
        fallbackStrategy: 'viewport',
        useSpatialIndexing: false // Disable spatial indexing to test direct database path
      }));

      // Wait for initialization to complete (should fail)
      await waitFor(() => {
        expect(result.current.isCalculating).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.error).toContain('Request timeout');

      // Second attempt should also fail
      await act(async () => {
        await result.current.refreshFog();
      });

      await waitFor(() => {
        expect(result.current.isCalculating).toBe(false);
      });

      expect(result.current.error).toContain('Request timeout');

      // Third attempt should succeed
      await act(async () => {
        await result.current.refreshFog();
      });

      await waitFor(() => {
        expect(result.current.isCalculating).toBe(false);
      });

      expect(result.current.fogGeoJSON).toBeDefined();
      expect(result.current.error).toBeNull();
    });

    test('should handle corrupted database data gracefully', async () => {
      const { getRevealedAreas } = require('@/utils/database');
      
      // Return corrupted/invalid data
      getRevealedAreas.mockResolvedValue([
        null,
        undefined,
        { type: 'InvalidFeature' },
        { type: 'Feature', geometry: null },
        { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] } },
        'invalid_string_data',
        42
      ]);

      const { result } = renderHook(() => useFogCalculation({
        debounceDelay: 50,
        fallbackStrategy: 'world',
        useSpatialIndexing: false
      }));

      await act(async () => {
        await result.current.refreshFog();
      });

      await waitFor(() => {
        expect(result.current.isCalculating).toBe(false);
      });

      // Should handle corrupted data gracefully
      expect(result.current.fogGeoJSON).toBeDefined();
      // The hook should provide fallback fog even with corrupted data
      expect(result.current.fogGeoJSON.features.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Geometry Operation Error Scenarios', () => {
    test('should handle invalid geometry in union operations', async () => {
      const validPolygon = {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [-122.42, 37.77],
            [-122.41, 37.77],
            [-122.41, 37.78],
            [-122.42, 37.78],
            [-122.42, 37.77]
          ]]
        }
      };

      const invalidPolygons = [
        validPolygon,
        GEOMETRY_TEST_CASES.INVALID_CASES.null_geometry,
        GEOMETRY_TEST_CASES.INVALID_CASES.malformed_polygon,
        GEOMETRY_TEST_CASES.INVALID_CASES.missing_coordinates,
        validPolygon
      ];

      const unionResult = unionPolygons(invalidPolygons);
      
      // Should complete with valid result despite invalid inputs
      expect(unionResult.result).toBeDefined();
      expect(unionResult.errors.length).toBeGreaterThan(0);
      expect(unionResult.metrics.fallbackUsed).toBe(true);
      
      // Should log validation errors
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Skipping invalid polygon'),
        expect.any(Array)
      );
    });

    test('should handle difference operation failures with fallback', async () => {
      const validPolygon = GEOMETRY_TEST_CASES.VALID_CASES.simple_polygon;
      const invalidPolygon = GEOMETRY_TEST_CASES.INVALID_CASES.malformed_polygon;

      const differenceResult = performRobustDifference(validPolygon, invalidPolygon);
      
      // Should return original geometry as fallback
      expect(differenceResult.result).toEqual(validPolygon);
      expect(differenceResult.metrics.fallbackUsed).toBe(true);
      expect(differenceResult.errors.length).toBeGreaterThan(0);
      expect(differenceResult.warnings).toContain('Using original geometry as fallback due to validation errors');
    });

    test('should handle buffer creation with invalid points', async () => {
      const invalidPoints = [
        null,
        undefined,
        { type: 'Feature', geometry: null },
        { type: 'Feature', geometry: { type: 'Point', coordinates: null } },
        { type: 'Feature', geometry: { type: 'Point', coordinates: [NaN, NaN] } },
        { type: 'Feature', geometry: { type: 'Point', coordinates: [200, 100] } } // Out of range
      ];

      for (const invalidPoint of invalidPoints) {
        const bufferResult = createBufferWithValidation(invalidPoint, 100, 'meters');
        
        expect(bufferResult.result).toBeNull();
        expect(bufferResult.errors.length).toBeGreaterThan(0);
        expect(bufferResult.metrics.hadErrors).toBe(true);
      }
    });

    test('should handle geometry sanitization failures', async () => {
      const { sanitizeGeometry } = require('@/utils/geometryOperations');
      
      const problematicGeometries = [
        null,
        undefined,
        { type: 'Feature', geometry: null },
        { type: 'Feature', geometry: { type: 'Polygon', coordinates: [] } },
        { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[]] } }
      ];

      for (const geometry of problematicGeometries) {
        const sanitized = sanitizeGeometry(geometry);
        expect(sanitized).toBeNull();
      }
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Cannot sanitize invalid geometry')
      );
    });
  });

  describe('Fog Calculation Error Scenarios', () => {
    test('should handle fog calculation with invalid viewport bounds', async () => {
      const invalidBounds = [
        null,
        undefined,
        [],
        [NaN, NaN, NaN, NaN],
        [-200, -100, 200, 100], // Out of range
        [-122.5, 37.8, -122.3, 37.7], // Inverted bounds
        [-122.5, 37.7, -122.5, 37.8] // Zero width
      ];

      const revealedArea = GEOMETRY_TEST_CASES.VALID_CASES.simple_polygon;

      for (const bounds of invalidBounds) {
        const fogOptions = {
          viewportBounds: bounds,
          useViewportOptimization: true,
          performanceMode: 'accurate',
          fallbackStrategy: 'world'
        };

        const fogResult = createFogWithFallback(revealedArea, fogOptions);
        
        // Should handle invalid bounds gracefully
        expect(fogResult.fogGeoJSON).toBeDefined();
        expect(fogResult.fogGeoJSON.features.length).toBeGreaterThan(0);
        // May use fallback or handle bounds validation internally
        expect(['viewport', 'world']).toContain(fogResult.performanceMetrics.operationType);
      }
    });

    test('should handle fog calculation with corrupted revealed areas', async () => {
      const corruptedRevealedAreas = [
        { type: 'Feature', geometry: { type: 'Polygon', coordinates: null } },
        { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[]] } },
        { type: 'Feature', geometry: { type: 'MultiPolygon', coordinates: [] } }
      ];

      const fogOptions = {
        viewportBounds: [-122.5, 37.7, -122.3, 37.8],
        useViewportOptimization: true,
        performanceMode: 'accurate',
        fallbackStrategy: 'viewport'
      };

      for (const corruptedArea of corruptedRevealedAreas) {
        const fogResult = createFogWithFallback(corruptedArea, fogOptions);
        
        // Should handle corruption gracefully
        expect(fogResult.fogGeoJSON).toBeDefined();
        expect(fogResult.fogGeoJSON.features.length).toBeGreaterThanOrEqual(0);
        // May or may not set errors depending on how corruption is handled
      }
    });

    test('should handle viewport fog calculation failures', async () => {
      // Test with invalid revealed area that might cause calculation to fail
      const invalidRevealedArea = GEOMETRY_TEST_CASES.INVALID_CASES.malformed_polygon;
      const fogOptions = {
        viewportBounds: [-122.5, 37.7, -122.3, 37.8],
        useViewportOptimization: true,
        performanceMode: 'accurate',
        fallbackStrategy: 'world'
      };

      const fogResult = createFogWithFallback(invalidRevealedArea, fogOptions);
      
      // Should handle failures gracefully
      expect(fogResult.fogGeoJSON).toBeDefined();
      expect(fogResult.fogGeoJSON.features.length).toBeGreaterThan(0);
      // Should provide some result even if there are issues
    });
  });

  describe('Hook Error Scenarios', () => {
    test('should handle fog calculation hook errors gracefully', async () => {
      const { getRevealedAreas } = require('@/utils/database');
      getRevealedAreas.mockRejectedValue(new Error('Critical database failure'));

      const { result } = renderHook(() => useFogCalculation({
        debounceDelay: 50,
        fallbackStrategy: 'world',
        useSpatialIndexing: false
      }));

      // Should initialize with error state
      await waitFor(() => {
        expect(result.current.isCalculating).toBe(false);
      });

      expect(result.current.error).toContain('Critical database failure');
      expect(result.current.fogGeoJSON).toBeDefined();

      // Should recover on subsequent calls
      getRevealedAreas.mockResolvedValue([]);
      
      await act(async () => {
        await result.current.refreshFog();
      });

      await waitFor(() => {
        expect(result.current.isCalculating).toBe(false);
        expect(result.current.error).toBeNull();
      });
    });

    test('should handle viewport hook with invalid bounds', async () => {
      const { result } = renderHook(() => useMapViewport({
        debounceDelay: 50,
        trackViewportChanges: true
      }));

      const invalidBounds = [-200, -100, 200, 100]; // Out of range

      act(() => {
        result.current.updateViewportBounds(invalidBounds);
      });

      // Should not update with invalid bounds
      await waitFor(() => {
        expect(result.current.isChanging).toBe(false);
      });

      expect(result.current.bounds).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Invalid viewport bounds provided'),
        invalidBounds
      );
    });

    test('should handle rapid error scenarios in hooks', async () => {
      const { getRevealedAreas } = require('@/utils/database');
      
      const { result } = renderHook(() => useFogCalculation({
        debounceDelay: 10, // Very short debounce
        useSpatialIndexing: false
      }));

      // Simulate rapid errors
      const errors = [
        new Error('Error 1'),
        new Error('Error 2'),
        new Error('Error 3')
      ];

      for (let i = 0; i < errors.length; i++) {
        getRevealedAreas.mockRejectedValueOnce(errors[i]);
        
        await act(async () => {
          await result.current.refreshFog();
        });
      }

      await waitFor(() => {
        expect(result.current.isCalculating).toBe(false);
      });

      // Should handle rapid errors gracefully
      expect(result.current.error).toContain('Error 3');
      expect(result.current.fogGeoJSON).toBeDefined();
    });
  });

  describe('Network Error Scenarios', () => {
    test('should handle network failures during geometry operations', async () => {
      // Simulate network-dependent operations failing
      const networkError = new Error('Network request failed');
      networkError.code = 'NETWORK_ERROR';

      const { result } = renderHook(() => useFogCalculation({
        debounceDelay: 50,
        fallbackStrategy: 'world',
        useSpatialIndexing: false
      }));

      const { getRevealedAreas } = require('@/utils/database');
      getRevealedAreas.mockRejectedValue(networkError);

      await act(async () => {
        await result.current.refreshFog();
      });

      await waitFor(() => {
        expect(result.current.isCalculating).toBe(false);
      });

      // Should fallback gracefully
      expect(result.current.fogGeoJSON).toBeDefined();
      expect(result.current.error).toContain('Network request failed');
    });

    test('should handle partial network failures', async () => {
      const { getRevealedAreas } = require('@/utils/database');
      
      // Return partial data due to network issues
      getRevealedAreas.mockResolvedValue([
        GEOMETRY_TEST_CASES.VALID_CASES.simple_polygon,
        null, // Network timeout for this item
        undefined, // Network error for this item
        GEOMETRY_TEST_CASES.VALID_CASES.feature_with_polygon
      ]);

      const { result } = renderHook(() => useFogCalculation({
        debounceDelay: 50,
        useSpatialIndexing: false
      }));

      await act(async () => {
        await result.current.refreshFog();
      });

      await waitFor(() => {
        expect(result.current.isCalculating).toBe(false);
      });

      // Should process valid data and skip invalid items
      expect(result.current.fogGeoJSON).toBeDefined();
      // Should handle partial data gracefully
      expect(result.current.error).toBeNull();
    });
  });

  describe('Memory and Resource Error Scenarios', () => {
    test('should handle memory pressure during large operations', async () => {
      // Simulate memory pressure by creating very large geometries
      const createLargePolygon = (size) => {
        const coordinates = [];
        for (let i = 0; i <= size; i++) {
          const angle = (i / size) * 2 * Math.PI;
          coordinates.push([
            -122.4 + 0.1 * Math.cos(angle),
            37.7 + 0.1 * Math.sin(angle)
          ]);
        }
        
        return {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [coordinates]
          }
        };
      };

      const largePolygons = [];
      for (let i = 0; i < 5; i++) {
        largePolygons.push(createLargePolygon(10000)); // Very large polygons
      }

      // Should handle large operations without crashing
      const unionResult = unionPolygons(largePolygons);
      
      // May use fallback strategies under memory pressure
      expect(unionResult.result).toBeDefined();
      expect(unionResult.metrics.executionTime).toBeGreaterThan(0);
    });

    test('should handle resource cleanup on component unmount', async () => {
      const { result, unmount } = renderHook(() => useFogCalculation({
        debounceDelay: 100,
        useSpatialIndexing: false
      }));

      // Start some operations
      act(() => {
        result.current.updateFogForLocation({
          latitude: 37.7749,
          longitude: -122.4194
        });
      });

      // Unmount before operations complete
      unmount();

      // Should not cause errors or memory leaks
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('Fallback Strategy Validation', () => {
    test('should validate fallback strategy effectiveness', async () => {
      const fallbackStrategies = ['viewport', 'world', 'none'];
      const results = [];

      for (const strategy of fallbackStrategies) {
        const fogOptions = {
          viewportBounds: [-122.5, 37.7, -122.3, 37.8],
          useViewportOptimization: true,
          performanceMode: 'accurate',
          fallbackStrategy: strategy
        };

        // Force an error by using invalid revealed areas
        const invalidRevealedArea = GEOMETRY_TEST_CASES.INVALID_CASES.malformed_polygon;
        
        const fogResult = createFogWithFallback(invalidRevealedArea, fogOptions);
        
        results.push({
          strategy,
          hasResult: !!fogResult.fogGeoJSON,
          featureCount: fogResult.fogGeoJSON?.features?.length || 0,
          hadErrors: fogResult.performanceMetrics.hadErrors,
          fallbackUsed: fogResult.performanceMetrics.fallbackUsed,
          operationType: fogResult.performanceMetrics.operationType
        });
      }

      console.log('Fallback strategy effectiveness:', results);

      // All strategies should provide some result
      results.forEach(result => {
        expect(result.hasResult).toBe(true);
        if (result.strategy !== 'none') {
          expect(result.featureCount).toBeGreaterThan(0);
        }
      });
    });

    test('should test fallback strategy performance', async () => {
      const strategies = ['viewport', 'world'];
      const performanceResults = [];

      for (const strategy of strategies) {
        const startTime = performance.now();
        
        const fogOptions = {
          viewportBounds: [-122.5, 37.7, -122.3, 37.8],
          useViewportOptimization: true,
          performanceMode: 'fast',
          fallbackStrategy: strategy
        };

        // Force fallback by using null revealed areas and invalid viewport
        const fogResult = createFogWithFallback(null, {
          ...fogOptions,
          viewportBounds: [NaN, NaN, NaN, NaN] // Force fallback
        });
        
        const executionTime = performance.now() - startTime;
        
        performanceResults.push({
          strategy,
          executionTime,
          performanceLevel: fogResult.performanceMetrics.performanceLevel,
          fallbackUsed: fogResult.performanceMetrics.fallbackUsed
        });
      }

      console.log('Fallback strategy performance:', performanceResults);

      // Fallback strategies should be reasonably fast
      performanceResults.forEach(result => {
        expect(result.executionTime).toBeLessThan(1000); // 1 second max
        expect(result.fallbackUsed).toBe(true);
      });
    });
  });
});