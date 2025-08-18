/**
 * End-to-End Fog Functionality Validation Tests
 * 
 * This test suite validates the complete fog of war workflow from GPS location
 * to visual rendering, including persistence, performance, and advanced features.
 * 
 * Requirements tested:
 * - 1.1, 1.2, 1.3, 1.4: Core fog functionality and visual rendering
 * - 2.1, 2.2, 2.3, 2.4: Persistence across app restarts
 * - 3.1, 3.2, 3.3: Visual contrast and advanced fog features
 */

import { jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';

// Mock all dependencies
jest.mock('@/utils/database', () => ({
  initDatabase: jest.fn(() => Promise.resolve()),
  getRevealedAreas: jest.fn(() => Promise.resolve([])),
  getRevealedAreasInViewport: jest.fn(() => Promise.resolve([])),
  saveRevealedArea: jest.fn(() => Promise.resolve()),
  clearRevealedAreas: jest.fn(() => Promise.resolve()),
  database: {
    runAsync: jest.fn(() => Promise.resolve()),
    getAllAsync: jest.fn(() => Promise.resolve([])),
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    debugThrottled: jest.fn(),
    debugOnce: jest.fn(),
    debugViewport: jest.fn(),
    info: jest.fn(),
    infoOnce: jest.fn(),
    infoThrottled: jest.fn(),
    warn: jest.fn(),
    warnThrottled: jest.fn(),
    warnOnce: jest.fn(),
    error: jest.fn(),
    success: jest.fn(),
  },
}));

jest.mock('@/utils/circuitBreaker', () => ({
  CircuitBreaker: jest.fn(() => ({
    canExecute: jest.fn(() => true),
    execute: jest.fn((fn) => fn()),
    recordSuccess: jest.fn(),
    recordFailure: jest.fn(),
    getState: jest.fn(() => 'CLOSED'),
    getStats: jest.fn(() => ({
      successCount: 10,
      failureCount: 0,
      timeoutCount: 0,
      state: 'CLOSED',
    })),
  })),
  FOG_CALCULATION_CIRCUIT_OPTIONS: {},
}));

jest.mock('@/utils/fogCacheManager', () => ({
  getGlobalFogCacheManager: jest.fn(() => ({
    getCachedFog: jest.fn(() => null),
    cacheFogResult: jest.fn(),
    invalidateCache: jest.fn(),
    clearCache: jest.fn(),
    getCacheStats: jest.fn(() => ({
      totalEntries: 0,
      cacheHits: 0,
      cacheMisses: 0,
      hitRatio: 0,
      memoryUsage: 0,
    })),
  })),
  resetGlobalFogCacheManager: jest.fn(),
}));

jest.mock('@/utils/spatialIndex', () => ({
  SpatialIndex: jest.fn(() => ({
    clear: jest.fn(() => Promise.resolve()),
    addFeatures: jest.fn(() => Promise.resolve()),
    queryViewport: jest.fn(() => ({
      features: [],
      totalFeatures: 0,
      returnedFeatures: 0,
      queryTime: 5,
      levelOfDetailApplied: false,
      queryBounds: [-1, -1, 1, 1],
    })),
    isEmpty: jest.fn(() => true),
    getFeatureCount: jest.fn(() => 0),
    getMemoryStats: jest.fn(() => ({
      estimatedMemoryUsage: 0,
      featureCount: 0,
      averageComplexity: 0,
      memoryPerFeature: 0,
      recommendation: 'optimal',
    })),
  })),
  getGlobalSpatialIndex: jest.fn(),
  resetGlobalSpatialIndex: jest.fn(),
}));

// Mock Turf.js operations
jest.mock('@turf/turf', () => ({
  buffer: jest.fn((point, radius) => ({
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
    },
  })),
  union: jest.fn((features) => ({
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]],
    },
  })),
  difference: jest.fn((viewport, revealed) => ({
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
    },
  })),
  bboxPolygon: jest.fn((bounds) => ({
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [[[bounds[0], bounds[1]], [bounds[2], bounds[1]], [bounds[2], bounds[3]], [bounds[0], bounds[3]], [bounds[0], bounds[1]]]],
    },
  })),
  bbox: jest.fn(() => [-1, -1, 1, 1]),
}));

// Import hooks and utilities after mocking
import { useAdvancedFogVisualization } from '@/hooks/useAdvancedFogVisualization';
import { useFogCalculation } from '@/hooks/useFogCalculation';
import { getRevealedAreas, initDatabase, saveRevealedArea } from '@/utils/database';
import { processNewLocation } from '@/utils/locationProcessing';
import { logger } from '@/utils/logger';

describe('End-to-End Fog Functionality Validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Complete Fog Workflow: GPS to Visual Rendering', () => {
    it('should complete full workflow from GPS location to fog rendering', async () => {
      // Mock database initialization
      initDatabase.mockResolvedValue();
      getRevealedAreas.mockResolvedValue([]);
      saveRevealedArea.mockResolvedValue();

      // Initialize fog calculation hook
      const { result } = renderHook(() => useFogCalculation({
        useSpatialIndexing: true,
        maxSpatialResults: 500,
      }));

      // Wait for initialization
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.fogGeoJSON).toBeTruthy();

      // Step 1: Simulate GPS location update
      const testLocation = {
        coords: {
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 5,
          altitude: 0,
          heading: 0,
          speed: 0,
        },
        timestamp: Date.now(),
      };

      // Step 2: Process location and create revealed area
      await act(async () => {
        await processNewLocation(testLocation);
      });

      expect(saveRevealedArea).toHaveBeenCalled();

      // Step 3: Update fog for new location
      await act(async () => {
        await result.current.updateFogForLocation({
          latitude: testLocation.coords.latitude,
          longitude: testLocation.coords.longitude,
        });
      });

      // Wait for debounced calculation
      await act(async () => {
        jest.advanceTimersByTime(400);
      });

      // Step 4: Verify fog calculation completed
      expect(result.current.isCalculating).toBe(false);
      expect(result.current.fogGeoJSON).toBeTruthy();
      expect(result.current.fogGeoJSON.type).toBe('FeatureCollection');
      expect(result.current.lastCalculationTime).toBeGreaterThan(0);

      // Step 5: Test viewport-based fog update
      const viewportBounds = [-122.5, 37.7, -122.3, 37.8];
      
      await act(async () => {
        await result.current.updateFogForViewport(viewportBounds, 12);
      });

      // Wait for debounced calculation
      await act(async () => {
        jest.advanceTimersByTime(400);
      });

      expect(result.current.fogGeoJSON).toBeTruthy();
      expect(result.current.performanceMetrics).toBeTruthy();
      expect(result.current.performanceMetrics.operationType).toBe('viewport');
    });

    it('should handle multiple GPS locations and merge revealed areas', async () => {
      getRevealedAreas.mockResolvedValue([]);
      saveRevealedArea.mockResolvedValue();

      const { result } = renderHook(() => useFogCalculation());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Simulate multiple GPS locations
      const locations = [
        { latitude: 37.7749, longitude: -122.4194 },
        { latitude: 37.7750, longitude: -122.4195 },
        { latitude: 37.7751, longitude: -122.4196 },
      ];

      // Process each location
      for (const location of locations) {
        await act(async () => {
          await result.current.updateFogForLocation(location);
        });

        // Wait for debounced calculation
        await act(async () => {
          jest.advanceTimersByTime(400);
        });
      }

      // Verify fog calculation handled multiple locations
      expect(result.current.fogGeoJSON).toBeTruthy();
      expect(result.current.featuresProcessed).toBeGreaterThan(0);
    });

    it('should handle real-world usage patterns with performance monitoring', async () => {
      getRevealedAreas.mockResolvedValue([]);

      const { result } = renderHook(() => useFogCalculation({
        useSpatialIndexing: true,
        performanceMode: 'accurate',
      }));

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Simulate real-world usage: multiple viewport changes
      const viewports = [
        [-122.5, 37.7, -122.3, 37.8], // San Francisco
        [-74.1, 40.7, -73.9, 40.8],   // New York
        [-118.3, 34.0, -118.1, 34.1], // Los Angeles
      ];

      for (const viewport of viewports) {
        await act(async () => {
          await result.current.updateFogForViewport(viewport, 12);
        });

        await act(async () => {
          jest.advanceTimersByTime(400);
        });
      }

      // Verify performance metrics are tracked
      expect(result.current.performanceMetrics).toBeTruthy();
      expect(result.current.performanceMetrics.executionTime).toBeGreaterThan(0);
      expect(result.current.performanceMetrics.performanceLevel).toBeDefined();
    });
  });

  describe('Persistence Across App Restarts', () => {
    it('should persist revealed areas correctly across app restarts', async () => {
      // Mock existing revealed areas in database
      const existingAreas = [
        {
          type: 'Feature',
          properties: { id: 'area-1', timestamp: Date.now() - 3600000 },
          geometry: {
            type: 'Polygon',
            coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
          },
        },
        {
          type: 'Feature',
          properties: { id: 'area-2', timestamp: Date.now() - 1800000 },
          geometry: {
            type: 'Polygon',
            coordinates: [[[1, 1], [2, 1], [2, 2], [1, 2], [1, 1]]],
          },
        },
      ];

      getRevealedAreas.mockResolvedValue(existingAreas);

      // Simulate app restart by creating new hook instance
      const { result } = renderHook(() => useFogCalculation());

      // Wait for initialization to load persisted data
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      expect(getRevealedAreas).toHaveBeenCalled();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.fogGeoJSON).toBeTruthy();

      // Verify that fog calculation uses persisted areas
      const viewportBounds = [-1, -1, 3, 3]; // Covers both existing areas
      
      await act(async () => {
        await result.current.updateFogForViewport(viewportBounds, 12);
      });

      await act(async () => {
        jest.advanceTimersByTime(400);
      });

      expect(result.current.featuresProcessed).toBe(2); // Both persisted areas processed
    });

    it('should merge new revealed areas with existing persisted areas', async () => {
      const existingAreas = [
        {
          type: 'Feature',
          properties: { id: 'existing-area' },
          geometry: {
            type: 'Polygon',
            coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
          },
        },
      ];

      getRevealedAreas.mockResolvedValue(existingAreas);
      saveRevealedArea.mockResolvedValue();

      const { result } = renderHook(() => useFogCalculation());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Add new location
      const newLocation = { latitude: 2, longitude: 2 };
      
      await act(async () => {
        await result.current.updateFogForLocation(newLocation);
      });

      await act(async () => {
        jest.advanceTimersByTime(400);
      });

      // Verify new area was saved
      expect(saveRevealedArea).toHaveBeenCalled();
      
      // Verify fog calculation includes both existing and new areas
      expect(result.current.fogGeoJSON).toBeTruthy();
    });

    it('should handle database errors gracefully during persistence', async () => {
      // Mock database error
      getRevealedAreas.mockRejectedValue(new Error('Database connection failed'));

      const { result } = renderHook(() => useFogCalculation());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Should still initialize with fallback behavior
      expect(result.current.isLoading).toBe(false);
      expect(result.current.fogGeoJSON).toBeTruthy();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load revealed areas'),
        expect.any(Error)
      );
    });

    it('should validate data integrity after app restart', async () => {
      const corruptedAreas = [
        {
          type: 'Feature',
          properties: { id: 'valid-area' },
          geometry: {
            type: 'Polygon',
            coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
          },
        },
        {
          // Missing geometry - should be filtered out
          type: 'Feature',
          properties: { id: 'corrupted-area' },
        },
        {
          // Invalid geometry type - should be filtered out
          type: 'Feature',
          properties: { id: 'invalid-geometry' },
          geometry: {
            type: 'Point',
            coordinates: [0, 0],
          },
        },
      ];

      getRevealedAreas.mockResolvedValue(corruptedAreas);

      const { result } = renderHook(() => useFogCalculation());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Should handle corrupted data gracefully
      expect(result.current.isLoading).toBe(false);
      expect(result.current.fogGeoJSON).toBeTruthy();
      
      // Only valid areas should be processed
      const viewportBounds = [-1, -1, 2, 2];
      
      await act(async () => {
        await result.current.updateFogForViewport(viewportBounds, 12);
      });

      await act(async () => {
        jest.advanceTimersByTime(400);
      });

      expect(result.current.featuresProcessed).toBe(1); // Only valid area processed
    });
  });

  describe('Advanced Fog Features with All Map Styles', () => {
    it('should work correctly with all map styles', async () => {
      getRevealedAreas.mockResolvedValue([]);

      const mapStyles = [
        'mapbox://styles/mapbox/dark-v10',
        'mapbox://styles/mapbox/light-v10',
        'mapbox://styles/mapbox/streets-v11',
        'mapbox://styles/mapbox/satellite-v9',
      ];

      for (const mapStyle of mapStyles) {
        const { result } = renderHook(() => useAdvancedFogVisualization('dark', mapStyle));

        expect(result.current.config).toBeTruthy();
        expect(result.current.config.theme).toBeDefined();
        expect(result.current.config.customStyling).toBeTruthy();
        
        // Test fog styling for each map style
        const styling = result.current.config.customStyling;
        expect(styling.fillColor).toBeDefined();
        expect(styling.fillOpacity).toBeGreaterThan(0);
        expect(styling.fillOpacity).toBeLessThanOrEqual(1);
      }
    });

    it('should handle advanced fog animations and effects', async () => {
      getRevealedAreas.mockResolvedValue([]);

      const { result } = renderHook(() => useAdvancedFogVisualization('dark', 'mapbox://styles/mapbox/dark-v10'));

      // Test animation configuration
      expect(result.current.config.enableAnimations).toBeDefined();
      expect(result.current.config.enableParticleEffects).toBeDefined();

      // Test reveal animation
      act(() => {
        result.current.triggerRevealAnimation();
      });

      expect(result.current.isRevealing).toBe(true);

      // Wait for animation to complete
      await act(async () => {
        jest.advanceTimersByTime(2000);
      });

      expect(result.current.isRevealing).toBe(false);
    });

    it('should provide customizable fog themes and visual effects', async () => {
      const { result } = renderHook(() => useAdvancedFogVisualization('dark', 'mapbox://styles/mapbox/dark-v10'));

      // Test theme customization
      act(() => {
        result.current.updateTheme('mystical');
      });

      expect(result.current.config.theme).toBe('mystical');

      // Test density adjustment
      act(() => {
        result.current.updateDensity(0.8);
      });

      expect(result.current.config.density).toBe(0.8);

      // Test custom styling
      const customStyling = {
        fillColor: '#FF0000',
        fillOpacity: 0.5,
        strokeColor: '#00FF00',
        strokeWidth: 2,
      };

      act(() => {
        result.current.updateCustomStyling(customStyling);
      });

      expect(result.current.config.customStyling).toEqual(customStyling);
    });

    it('should handle fog edge smoothing and anti-aliasing', async () => {
      const { result } = renderHook(() => useAdvancedFogVisualization('dark', 'mapbox://styles/mapbox/dark-v10'));

      // Test edge smoothing configuration
      expect(result.current.config.customStyling.strokeWidth).toBeDefined();
      expect(result.current.config.customStyling.strokeOpacity).toBeDefined();

      // Test anti-aliasing settings
      const styling = result.current.config.customStyling;
      expect(styling.fillAntialias).toBeDefined();
      expect(styling.strokeAntialias).toBeDefined();
    });

    it('should implement fog density variations based on exploration recency', async () => {
      const recentAreas = [
        {
          type: 'Feature',
          properties: { 
            id: 'recent-area',
            timestamp: Date.now() - 300000, // 5 minutes ago
          },
          geometry: {
            type: 'Polygon',
            coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
          },
        },
        {
          type: 'Feature',
          properties: { 
            id: 'old-area',
            timestamp: Date.now() - 86400000, // 24 hours ago
          },
          geometry: {
            type: 'Polygon',
            coordinates: [[[2, 2], [3, 2], [3, 3], [2, 3], [2, 2]]],
          },
        },
      ];

      getRevealedAreas.mockResolvedValue(recentAreas);

      const { result } = renderHook(() => useAdvancedFogVisualization('dark', 'mapbox://styles/mapbox/dark-v10'));

      // Test density variation based on recency
      expect(result.current.config.density).toBeDefined();
      expect(typeof result.current.config.density).toBe('number');
      expect(result.current.config.density).toBeGreaterThan(0);
      expect(result.current.config.density).toBeLessThanOrEqual(1);
    });
  });

  describe('Performance and Error Recovery', () => {
    it('should handle large datasets efficiently', async () => {
      // Create large dataset
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        type: 'Feature',
        properties: { id: `area-${i}` },
        geometry: {
          type: 'Polygon',
          coordinates: [[[i, i], [i+1, i], [i+1, i+1], [i, i+1], [i, i]]],
        },
      }));

      getRevealedAreas.mockResolvedValue(largeDataset);

      const { result } = renderHook(() => useFogCalculation({
        useSpatialIndexing: true,
        maxSpatialResults: 100,
        performanceMode: 'fast',
      }));

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Test viewport query with large dataset
      const viewportBounds = [0, 0, 50, 50];
      
      await act(async () => {
        await result.current.updateFogForViewport(viewportBounds, 12);
      });

      await act(async () => {
        jest.advanceTimersByTime(400);
      });

      // Should complete successfully with performance optimizations
      expect(result.current.isCalculating).toBe(false);
      expect(result.current.performanceMetrics.performanceLevel).toBeDefined();
      expect(result.current.usedSpatialIndexing).toBe(true);
    });

    it('should recover from calculation errors gracefully', async () => {
      // Mock Turf operations to fail
      const { difference } = require('@turf/turf');
      difference.mockImplementation(() => {
        throw new Error('Geometry operation failed');
      });

      getRevealedAreas.mockResolvedValue([
        {
          type: 'Feature',
          properties: { id: 'test-area' },
          geometry: {
            type: 'Polygon',
            coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
          },
        },
      ]);

      const { result } = renderHook(() => useFogCalculation());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Attempt fog calculation that will fail
      await act(async () => {
        await result.current.updateFogForViewport([-1, -1, 2, 2], 12);
      });

      await act(async () => {
        jest.advanceTimersByTime(400);
      });

      // Should fallback gracefully
      expect(result.current.fogGeoJSON).toBeTruthy();
      expect(result.current.performanceMetrics.fallbackUsed).toBe(true);
      expect(logger.error).toHaveBeenCalled();
    });

    it('should monitor memory usage and optimize when needed', async () => {
      getRevealedAreas.mockResolvedValue([]);

      const { result } = renderHook(() => useFogCalculation({
        useSpatialIndexing: true,
      }));

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Get memory statistics
      const memoryStats = result.current.getSpatialIndexStats();
      expect(memoryStats).toBeTruthy();
      expect(memoryStats.memoryStats).toBeTruthy();
      expect(memoryStats.memoryStats.estimatedMemoryUsage).toBeDefined();
      expect(memoryStats.memoryStats.recommendation).toBeDefined();

      // Test memory optimization
      await act(async () => {
        await result.current.optimizeSpatialIndex(true);
      });

      // Should complete without errors
      expect(result.current.isCalculating).toBe(false);
    });

    it('should handle circuit breaker activation during failures', async () => {
      const { CircuitBreaker } = require('@/utils/circuitBreaker');
      const mockCircuitBreaker = {
        canExecute: jest.fn(() => false), // Circuit is open
        execute: jest.fn(),
        getState: jest.fn(() => 'OPEN'),
        getStats: jest.fn(() => ({
          successCount: 0,
          failureCount: 10,
          timeoutCount: 0,
          state: 'OPEN',
        })),
      };

      CircuitBreaker.mockReturnValue(mockCircuitBreaker);

      getRevealedAreas.mockResolvedValue([]);

      const { result } = renderHook(() => useFogCalculation());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Attempt fog calculation with circuit breaker open
      await act(async () => {
        await result.current.updateFogForViewport([-1, -1, 1, 1], 12);
      });

      await act(async () => {
        jest.advanceTimersByTime(400);
      });

      // Should handle circuit breaker gracefully
      expect(result.current.fogGeoJSON).toBeTruthy();
      expect(mockCircuitBreaker.canExecute).toHaveBeenCalled();
    });
  });

  describe('Integration with Map Components', () => {
    it('should integrate properly with map viewport changes', async () => {
      getRevealedAreas.mockResolvedValue([]);

      const { result } = renderHook(() => useFogCalculation());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Simulate rapid viewport changes (should be debounced)
      const viewports = [
        [-122.5, 37.7, -122.3, 37.8],
        [-122.4, 37.75, -122.2, 37.85],
        [-122.3, 37.8, -122.1, 37.9],
      ];

      for (const viewport of viewports) {
        await act(async () => {
          await result.current.updateFogForViewport(viewport, 12);
        });
        
        // Small delay between updates
        await act(async () => {
          jest.advanceTimersByTime(50);
        });
      }

      // Wait for debounced calculation
      await act(async () => {
        jest.advanceTimersByTime(400);
      });

      // Should handle rapid updates efficiently
      expect(result.current.isCalculating).toBe(false);
      expect(result.current.fogGeoJSON).toBeTruthy();
    });

    it('should work with different zoom levels', async () => {
      getRevealedAreas.mockResolvedValue([]);

      const { result } = renderHook(() => useFogCalculation({
        useLevelOfDetail: true,
      }));

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Test different zoom levels
      const zoomLevels = [8, 12, 16, 20];
      const viewport = [-122.5, 37.7, -122.3, 37.8];

      for (const zoomLevel of zoomLevels) {
        await act(async () => {
          await result.current.updateFogForViewport(viewport, zoomLevel);
        });

        await act(async () => {
          jest.advanceTimersByTime(400);
        });

        expect(result.current.fogGeoJSON).toBeTruthy();
      }
    });

    it('should handle map style changes', async () => {
      getRevealedAreas.mockResolvedValue([]);

      const mapStyles = [
        'mapbox://styles/mapbox/dark-v10',
        'mapbox://styles/mapbox/light-v10',
        'mapbox://styles/mapbox/satellite-v9',
      ];

      for (const mapStyle of mapStyles) {
        const { result } = renderHook(() => useAdvancedFogVisualization('dark', mapStyle));

        expect(result.current.config.customStyling).toBeTruthy();
        expect(result.current.config.customStyling.fillColor).toBeDefined();
        expect(result.current.config.customStyling.fillOpacity).toBeGreaterThan(0);
      }
    });
  });
});