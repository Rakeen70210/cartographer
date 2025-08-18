/**
 * Integration tests for refactored map component functionality
 * Tests the interaction between all refactored components and utilities
 */

import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useFogCalculation } from '@/hooks/useFogCalculation';
import { useMapViewport } from '@/hooks/useMapViewport';
import { createFogWithFallback } from '@/utils/fogCalculation';
import { createBufferWithValidation, performRobustDifference, unionPolygons } from '@/utils/geometryOperations';
import { validateGeometry } from '@/utils/geometryValidation';
import { setupStandardMocks, TEST_CONSTANTS } from '../setup/testSetup.js';

// Mock database operations
jest.mock('@/utils/database', () => ({
  getRevealedAreas: jest.fn().mockResolvedValue([]),
  saveRevealedArea: jest.fn().mockResolvedValue(true),
}));

describe('Map Component Refactor Integration Tests', () => {
  let mockData;

  beforeEach(() => {
    mockData = setupStandardMocks('MEDIUM_DATASET');
    jest.clearAllMocks();
    
    // Reset database mocks to default behavior
    const { getRevealedAreas, saveRevealedArea } = require('@/utils/database');
    getRevealedAreas.mockResolvedValue([]);
    saveRevealedArea.mockResolvedValue(true);
  });

  describe('Fog Calculation Integration', () => {
    test('should integrate fog calculation hook with geometry operations', async () => {
      const { result } = renderHook(() => useFogCalculation({
        debounceDelay: 50,
        useViewportOptimization: true,
        performanceMode: 'accurate'
      }));

      // Wait for initial fog calculation
      await waitFor(() => {
        expect(result.current.isCalculating).toBe(false);
      }, { timeout: 5000 });

      // Test location-based fog update
      await act(async () => {
        await result.current.updateFogForLocation({
          latitude: TEST_CONSTANTS.DEFAULT_LATITUDE,
          longitude: TEST_CONSTANTS.DEFAULT_LONGITUDE
        });
      });

      expect(result.current.fogGeoJSON).toBeDefined();
      expect(result.current.fogGeoJSON.type).toBe('FeatureCollection');
      expect(result.current.error).toBeNull();
    });

    test('should handle viewport-based fog calculation with bounds', async () => {
      const { result: fogResult } = renderHook(() => useFogCalculation({
        useViewportOptimization: true
      }));

      const { result: viewportResult } = renderHook(() => useMapViewport({
        debounceDelay: 50
      }));

      const testBounds = [-122.5, 37.7, -122.3, 37.8];

      await act(async () => {
        viewportResult.current.updateViewportBounds(testBounds, 12);
      });

      await waitFor(() => {
        expect(viewportResult.current.bounds).toEqual(testBounds);
      });

      await act(async () => {
        await fogResult.current.updateFogForViewport(testBounds);
      });

      await waitFor(() => {
        expect(fogResult.current.isCalculating).toBe(false);
      });

      expect(fogResult.current.fogGeoJSON.features.length).toBeGreaterThanOrEqual(0);
    });

    test('should integrate geometry validation with fog calculation', async () => {
      // Create test revealed area
      const testRevealedArea = {
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

      // Validate geometry
      const validation = validateGeometry(testRevealedArea);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);

      // Test fog calculation with validated geometry
      const fogOptions = {
        viewportBounds: [-122.5, 37.7, -122.3, 37.8],
        useViewportOptimization: true,
        performanceMode: 'accurate',
        fallbackStrategy: 'viewport'
      };

      const fogResult = createFogWithFallback(testRevealedArea, fogOptions);
      expect(fogResult.fogGeoJSON).toBeDefined();
      expect(fogResult.performanceMetrics.hadErrors).toBe(false);
    });
  });

  describe('Geometry Operations Integration', () => {
    test('should integrate buffer creation with union operations', async () => {
      const testPoint = {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [TEST_CONSTANTS.DEFAULT_LONGITUDE, TEST_CONSTANTS.DEFAULT_LATITUDE]
        },
        properties: {}
      };

      // Create buffer
      const bufferResult = createBufferWithValidation(testPoint, 100, 'meters');
      expect(bufferResult.result).toBeDefined();
      expect(bufferResult.errors).toHaveLength(0);

      // Create second buffer
      const testPoint2 = {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [TEST_CONSTANTS.DEFAULT_LONGITUDE + 0.001, TEST_CONSTANTS.DEFAULT_LATITUDE + 0.001]
        },
        properties: {}
      };

      const bufferResult2 = createBufferWithValidation(testPoint2, 100, 'meters');
      expect(bufferResult2.result).toBeDefined();

      // Union the buffers
      const unionResult = unionPolygons([bufferResult.result, bufferResult2.result]);
      expect(unionResult.result).toBeDefined();
      expect(unionResult.errors).toHaveLength(0);
      expect(unionResult.metrics.operationType).toBe('union');
    });

    test('should integrate difference operations with fog calculation', async () => {
      const viewportPolygon = {
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

      const revealedArea = {
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

      const differenceResult = performRobustDifference(viewportPolygon, revealedArea);
      expect(differenceResult.result).toBeDefined();
      expect(differenceResult.metrics.operationType).toBe('difference');
      expect(differenceResult.metrics.executionTime).toBeGreaterThan(0);
    });
  });

  describe('Hook Integration', () => {
    test('should integrate fog calculation and viewport hooks', async () => {
      const { result: fogHook } = renderHook(() => useFogCalculation({
        debounceDelay: 50,
        useViewportOptimization: true
      }));

      const { result: viewportHook } = renderHook(() => useMapViewport({
        debounceDelay: 50,
        trackViewportChanges: true
      }));

      const testBounds = [-122.5, 37.7, -122.3, 37.8];

      // Update viewport
      await act(async () => {
        viewportHook.current.updateViewportBounds(testBounds, 12, [-122.4, 37.75]);
      });

      // Wait for viewport to stabilize
      await waitFor(() => {
        expect(viewportHook.current.isChanging).toBe(false);
        expect(viewportHook.current.bounds).toEqual(testBounds);
      });

      // Update fog for viewport
      await act(async () => {
        await fogHook.current.updateFogForViewport(testBounds);
      });

      await waitFor(() => {
        expect(fogHook.current.isCalculating).toBe(false);
      });

      expect(fogHook.current.fogGeoJSON).toBeDefined();
      expect(viewportHook.current.bounds).toEqual(testBounds);
      expect(viewportHook.current.zoom).toBe(12);
      expect(viewportHook.current.center).toEqual([-122.4, 37.75]);
    });

    test('should handle viewport changes during fog calculation', async () => {
      const { result: fogHook } = renderHook(() => useFogCalculation({
        debounceDelay: 100
      }));

      const { result: viewportHook } = renderHook(() => useMapViewport({
        debounceDelay: 50,
        trackViewportChanges: true
      }));

      const bounds1 = [-122.5, 37.7, -122.3, 37.8];
      const bounds2 = [-122.6, 37.6, -122.2, 37.9];

      // Start first viewport update
      act(() => {
        viewportHook.current.updateViewportBounds(bounds1);
      });

      // Immediately start second viewport update
      act(() => {
        viewportHook.current.updateViewportBounds(bounds2);
      });

      // Wait for final state
      await waitFor(() => {
        expect(viewportHook.current.isChanging).toBe(false);
        expect(viewportHook.current.bounds).toEqual(bounds2);
      });

      // Fog should handle the viewport changes gracefully
      await act(async () => {
        await fogHook.current.updateFogForViewport(bounds2);
      });

      expect(fogHook.current.error).toBeNull();
    });
  });

  describe('Error Handling Integration', () => {
    test('should handle database errors gracefully', async () => {
      const { getRevealedAreas } = require('@/utils/database');
      getRevealedAreas.mockRejectedValue(new Error('Database connection failed'));

      const { result } = renderHook(() => useFogCalculation({
        debounceDelay: 50,
        fallbackStrategy: 'world',
        useSpatialIndexing: false // Disable spatial indexing to test direct database path
      }));

      // Wait for initial load to complete (which should fail)
      await waitFor(() => {
        expect(result.current.isCalculating).toBe(false);
      });

      // Should have fallback fog even with database error
      expect(result.current.fogGeoJSON).toBeDefined();
      expect(result.current.fogGeoJSON.features.length).toBeGreaterThan(0);
      expect(result.current.error).toBeTruthy();
      expect(result.current.error).toContain('Database connection failed');
    });

    test('should handle invalid geometry data from database', async () => {
      const { getRevealedAreas } = require('@/utils/database');
      getRevealedAreas.mockResolvedValueOnce([
        { type: 'InvalidFeature', geometry: null },
        { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] } }
      ]);

      const { result } = renderHook(() => useFogCalculation({
        debounceDelay: 50
      }));

      await act(async () => {
        await result.current.refreshFog();
      });

      await waitFor(() => {
        expect(result.current.isCalculating).toBe(false);
      });

      // Should handle invalid data gracefully
      expect(result.current.fogGeoJSON).toBeDefined();
      // The hook filters out invalid data, so it should work without errors
      expect(result.current.error).toBeNull();
    });
  });

  describe('Performance Integration', () => {
    test('should maintain performance with large datasets', async () => {
      const largeDataset = setupStandardMocks('LARGE_DATASET');
      
      const { result } = renderHook(() => useFogCalculation({
        debounceDelay: 50,
        performanceMode: 'fast',
        useViewportOptimization: true
      }));

      const startTime = performance.now();

      await act(async () => {
        await result.current.updateFogForLocation({
          latitude: TEST_CONSTANTS.DEFAULT_LATITUDE,
          longitude: TEST_CONSTANTS.DEFAULT_LONGITUDE
        });
      });

      await waitFor(() => {
        expect(result.current.isCalculating).toBe(false);
      });

      const executionTime = performance.now() - startTime;
      
      // Should complete within reasonable time even with large dataset
      expect(executionTime).toBeLessThan(5000); // 5 seconds max
      expect(result.current.lastCalculationTime).toBeGreaterThan(0);
      expect(result.current.fogGeoJSON).toBeDefined();
    });

    test('should optimize viewport-based calculations', async () => {
      const { result } = renderHook(() => useFogCalculation({
        debounceDelay: 50,
        useViewportOptimization: true,
        performanceMode: 'fast'
      }));

      const smallViewport = [-122.42, 37.77, -122.41, 37.78];
      const largeViewport = [-125, 35, -120, 40];

      // Test small viewport (should be faster)
      const smallViewportStart = performance.now();
      await act(async () => {
        await result.current.updateFogForViewport(smallViewport);
      });
      await waitFor(() => expect(result.current.isCalculating).toBe(false));
      const smallViewportTime = performance.now() - smallViewportStart;

      // Test large viewport
      const largeViewportStart = performance.now();
      await act(async () => {
        await result.current.updateFogForViewport(largeViewport);
      });
      await waitFor(() => expect(result.current.isCalculating).toBe(false));
      const largeViewportTime = performance.now() - largeViewportStart;

      // Both should complete successfully
      expect(result.current.error).toBeNull();
      expect(result.current.fogGeoJSON).toBeDefined();
      
      // Performance should be reasonable for both
      expect(smallViewportTime).toBeLessThan(2000);
      expect(largeViewportTime).toBeLessThan(5000);
    });
  });

  describe('Memory Management Integration', () => {
    test('should clean up resources properly', async () => {
      const { result, unmount } = renderHook(() => useFogCalculation({
        debounceDelay: 50
      }));

      // Perform some operations
      await act(async () => {
        await result.current.updateFogForLocation({
          latitude: TEST_CONSTANTS.DEFAULT_LATITUDE,
          longitude: TEST_CONSTANTS.DEFAULT_LONGITUDE
        });
      });

      await waitFor(() => {
        expect(result.current.isCalculating).toBe(false);
      });

      // Unmount should not cause errors
      expect(() => unmount()).not.toThrow();
    });

    test('should handle rapid successive updates without memory leaks', async () => {
      const { result } = renderHook(() => useFogCalculation({
        debounceDelay: 10 // Very short debounce for rapid updates
      }));

      // Perform rapid successive updates
      const updates = [];
      for (let i = 0; i < 10; i++) {
        updates.push(
          act(async () => {
            await result.current.updateFogForLocation({
              latitude: TEST_CONSTANTS.DEFAULT_LATITUDE + (i * 0.001),
              longitude: TEST_CONSTANTS.DEFAULT_LONGITUDE + (i * 0.001)
            });
          })
        );
      }

      // Wait for all updates to complete
      await Promise.all(updates);
      
      await waitFor(() => {
        expect(result.current.isCalculating).toBe(false);
      });

      // Should handle rapid updates gracefully
      expect(result.current.fogGeoJSON).toBeDefined();
      expect(result.current.error).toBeNull();
    });
  });
});