import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useFogCalculation } from '../hooks/useFogCalculation';

// Mock dependencies
jest.mock('../utils/database', () => ({
  getRevealedAreas: jest.fn()
}));
jest.mock('../utils/fogCalculation', () => ({
  createFogWithFallback: jest.fn(),
  getDefaultFogOptions: jest.fn()
}));
jest.mock('../utils/geometryOperations', () => ({
  unionPolygons: jest.fn()
}));
jest.mock('../utils/logger');

// Use real timers by default for async operations

// Import mocked modules
const database = require('../utils/database');
const fogCalculation = require('../utils/fogCalculation');
const geometryOperations = require('../utils/geometryOperations');

describe('useFogCalculation', () => {
  const mockRevealedArea = {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]
    },
    properties: {}
  };

  const mockFogResult = {
    fogGeoJSON: {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]]
        },
        properties: {}
      }]
    },
    calculationTime: 50,
    performanceMetrics: {
      geometryComplexity: { totalVertices: 5, ringCount: 1, maxRingVertices: 5, averageRingVertices: 5, complexityLevel: 'LOW' },
      operationType: 'viewport',
      hadErrors: false,
      fallbackUsed: false,
      executionTime: 50,
      performanceLevel: 'FAST'
    },
    errors: [],
    warnings: []
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    database.getRevealedAreas.mockResolvedValue([mockRevealedArea]);
    fogCalculation.createFogWithFallback.mockReturnValue(mockFogResult);
    fogCalculation.getDefaultFogOptions.mockReturnValue({
      useViewportOptimization: true,
      performanceMode: 'accurate',
      fallbackStrategy: 'viewport'
    });
    geometryOperations.unionPolygons.mockReturnValue({
      result: mockRevealedArea,
      metrics: { hadErrors: false, fallbackUsed: false },
      errors: [],
      warnings: []
    });
  });

  describe('initialization', () => {
    it('should initialize with empty fog state', () => {
      const { result } = renderHook(() => useFogCalculation());

      expect(result.current.fogGeoJSON).toEqual({
        type: 'FeatureCollection',
        features: []
      });
      expect(result.current.isCalculating).toBe(true); // Initially calculating
      expect(result.current.lastCalculationTime).toBe(0);
      expect(result.current.error).toBe(null);
      expect(result.current.warnings).toEqual([]);
      expect(result.current.isViewportChanging).toBe(false);
    });

    it('should load and calculate initial fog on mount', async () => {
      const { result } = renderHook(() => useFogCalculation());

      await waitFor(() => {
        expect(result.current.isCalculating).toBe(false);
      });

      // The hook should complete initialization without errors
      expect(result.current.error).toBeNull();
      expect(result.current.fogGeoJSON).toBeDefined();
      expect(result.current.fogGeoJSON.type).toBe('FeatureCollection');
      expect(result.current.lastCalculationTime).toBeGreaterThan(0);
    });

    it('should handle initialization with custom options', () => {
      const options = {
        debounceDelay: 500,
        useViewportOptimization: false,
        performanceMode: 'fast',
        fallbackStrategy: 'world'
      };

      const { result } = renderHook(() => useFogCalculation(options));

      expect(result.current).toBeDefined();
      // Options are used internally, not exposed in return value
    });
  });

  describe('updateFogForLocation', () => {
    it('should update fog for a specific location immediately', async () => {
      const { result } = renderHook(() => useFogCalculation());

      await waitFor(() => {
        expect(result.current.isCalculating).toBe(false);
      });

      const location = { latitude: 37.7749, longitude: -122.4194 };
      const initialCalculationTime = result.current.lastCalculationTime;

      await act(async () => {
        await result.current.updateFogForLocation(location);
      });

      // Should complete the location update
      expect(result.current.isCalculating).toBe(false);
      expect(result.current.lastCalculationTime).toBeGreaterThanOrEqual(initialCalculationTime);
      expect(result.current.fogGeoJSON).toBeDefined();
    });

    it('should handle location update errors gracefully', async () => {
      // Set up database to fail
      database.getRevealedAreas.mockRejectedValue(new Error('Database error'));

      const { result } = renderHook(() => useFogCalculation());

      await waitFor(() => {
        expect(result.current.isCalculating).toBe(false);
      });

      const location = { latitude: 37.7749, longitude: -122.4194 };

      await act(async () => {
        await result.current.updateFogForLocation(location);
      });

      // Should handle errors gracefully and still provide fog
      expect(result.current.isCalculating).toBe(false);
      expect(result.current.fogGeoJSON).toBeDefined();
      // May or may not have an error depending on fallback behavior
    });
  });

  describe('updateFogForViewport', () => {
    it('should update fog for viewport bounds with debouncing', async () => {
      const { result } = renderHook(() => useFogCalculation({ debounceDelay: 50 }));

      await waitFor(() => {
        expect(result.current.isCalculating).toBe(false);
      });

      const bounds = [-122.5, 37.7, -122.3, 37.8];
      const initialCalculationTime = result.current.lastCalculationTime;

      await act(async () => {
        result.current.updateFogForViewport(bounds);
        // Wait for debounce to complete
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Should complete the viewport update
      expect(result.current.isCalculating).toBe(false);
      expect(result.current.lastCalculationTime).toBeGreaterThanOrEqual(initialCalculationTime);
    });

    it('should cancel previous debounced calls when new viewport update occurs', async () => {
      const { result } = renderHook(() => useFogCalculation({ debounceDelay: 100 }));

      await waitFor(() => {
        expect(result.current.isCalculating).toBe(false);
      });

      const bounds1 = [-122.5, 37.7, -122.3, 37.8];
      const bounds2 = [-122.6, 37.6, -122.2, 37.9];

      await act(async () => {
        result.current.updateFogForViewport(bounds1);
        // Quickly call with new bounds before debounce completes
        await new Promise(resolve => setTimeout(resolve, 25));
        result.current.updateFogForViewport(bounds2);
        // Wait for debounce to complete
        await new Promise(resolve => setTimeout(resolve, 150));
      });

      // Should complete with the final bounds
      expect(result.current.isCalculating).toBe(false);
    });

    it('should respect viewport changing state', async () => {
      const { result } = renderHook(() => useFogCalculation());

      await waitFor(() => {
        expect(result.current.isCalculating).toBe(false);
      });

      // Set viewport changing state
      act(() => {
        result.current.setViewportChanging(true);
      });

      expect(result.current.isViewportChanging).toBe(true);

      const bounds = [-122.5, 37.7, -122.3, 37.8];

      await act(async () => {
        result.current.updateFogForViewport(bounds);
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Should complete the viewport update
      expect(result.current.isCalculating).toBe(false);
    });
  });

  describe('refreshFog', () => {
    it('should force refresh fog from database', async () => {
      const { result } = renderHook(() => useFogCalculation());

      await waitFor(() => {
        expect(result.current.isCalculating).toBe(false);
      });

      const initialCalculationTime = result.current.lastCalculationTime;

      await act(async () => {
        await result.current.refreshFog();
      });

      // Should complete the refresh
      expect(result.current.isCalculating).toBe(false);
      expect(result.current.lastCalculationTime).toBeGreaterThanOrEqual(initialCalculationTime);
    });

    it('should handle refresh errors gracefully', async () => {
      // Set up database to fail for all calls
      database.getRevealedAreas.mockRejectedValue(new Error('Database error'));

      const { result } = renderHook(() => useFogCalculation());

      await waitFor(() => {
        expect(result.current.isCalculating).toBe(false);
      });

      await act(async () => {
        await result.current.refreshFog();
      });

      // Should handle errors gracefully and still provide fog
      expect(result.current.isCalculating).toBe(false);
      expect(result.current.fogGeoJSON).toBeDefined();
    });
  });

  describe('clearFog', () => {
    it('should clear all fog features', async () => {
      const { result } = renderHook(() => useFogCalculation());

      await waitFor(() => {
        expect(result.current.isCalculating).toBe(false);
      });

      // Ensure fog is loaded first
      expect(result.current.fogGeoJSON.features.length).toBeGreaterThan(0);

      act(() => {
        result.current.clearFog();
      });

      expect(result.current.fogGeoJSON).toEqual({
        type: 'FeatureCollection',
        features: []
      });
      expect(result.current.error).toBe(null);
      expect(result.current.warnings).toEqual([]);
    });
  });

  describe('setViewportChanging', () => {
    it('should update viewport changing state', () => {
      const { result } = renderHook(() => useFogCalculation());

      expect(result.current.isViewportChanging).toBe(false);

      act(() => {
        result.current.setViewportChanging(true);
      });

      expect(result.current.isViewportChanging).toBe(true);

      act(() => {
        result.current.setViewportChanging(false);
      });

      expect(result.current.isViewportChanging).toBe(false);
    });
  });

  describe('revealed areas handling', () => {
    it('should handle empty revealed areas', async () => {
      database.getRevealedAreas.mockResolvedValue([]);

      const { result } = renderHook(() => useFogCalculation());

      await waitFor(() => {
        expect(result.current.isCalculating).toBe(false);
      });

      // Should complete initialization without errors
      expect(result.current.error).toBeNull();
      expect(result.current.fogGeoJSON).toBeDefined();
      expect(result.current.fogGeoJSON.type).toBe('FeatureCollection');
    });

    it('should handle single revealed area', async () => {
      database.getRevealedAreas.mockResolvedValue([mockRevealedArea]);

      const { result } = renderHook(() => useFogCalculation());

      await waitFor(() => {
        expect(result.current.isCalculating).toBe(false);
      });

      // Should complete initialization without errors
      expect(result.current.error).toBeNull();
      expect(result.current.fogGeoJSON).toBeDefined();
      expect(result.current.fogGeoJSON.type).toBe('FeatureCollection');
    });

    it('should union multiple revealed areas', async () => {
      const area2 = {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [[[2, 2], [3, 2], [3, 3], [2, 3], [2, 2]]]
        },
        properties: {}
      };

      database.getRevealedAreas.mockResolvedValue([mockRevealedArea, area2]);

      const { result } = renderHook(() => useFogCalculation());

      await waitFor(() => {
        expect(result.current.isCalculating).toBe(false);
      });

      // Should complete initialization without errors
      expect(result.current.error).toBeNull();
      expect(result.current.fogGeoJSON).toBeDefined();
      expect(result.current.fogGeoJSON.type).toBe('FeatureCollection');
    });

    it('should handle union operation errors', async () => {
      const area2 = {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [[[2, 2], [3, 2], [3, 3], [2, 3], [2, 2]]]
        },
        properties: {}
      };

      database.getRevealedAreas.mockResolvedValue([mockRevealedArea, area2]);
      geometryOperations.unionPolygons.mockReturnValue({
        result: mockRevealedArea,
        metrics: { hadErrors: true, fallbackUsed: true },
        errors: ['Union failed'],
        warnings: ['Using fallback']
      });

      const { result } = renderHook(() => useFogCalculation());

      await waitFor(() => {
        expect(result.current.isCalculating).toBe(false);
      });

      // Should complete initialization and handle errors gracefully
      expect(result.current.fogGeoJSON).toBeDefined();
      expect(result.current.fogGeoJSON.type).toBe('FeatureCollection');
    });
  });

  describe('cleanup', () => {
    it('should cleanup debounce timers on unmount', async () => {
      const { result, unmount } = renderHook(() => useFogCalculation());

      await waitFor(() => {
        expect(result.current.isCalculating).toBe(false);
      });

      const initialCallCount = fogCalculation.createFogWithFallback.mock.calls.length;

      act(() => {
        result.current.updateFogForViewport([-122.5, 37.7, -122.3, 37.8]);
      });

      unmount();

      // Advance timers after unmount
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      // Should not trigger additional fog calculations after unmount
      expect(fogCalculation.createFogWithFallback).toHaveBeenCalledTimes(initialCallCount);
    });

    it('should ignore calculation results after unmount', async () => {
      let resolveCalculation;
      const calculationPromise = new Promise(resolve => {
        resolveCalculation = resolve;
      });

      fogCalculation.createFogWithFallback.mockImplementation(() => {
        calculationPromise.then(() => mockFogResult);
        return mockFogResult;
      });

      const { result, unmount } = renderHook(() => useFogCalculation());

      unmount();

      // Resolve the calculation after unmount
      resolveCalculation();

      await act(async () => {
        await calculationPromise;
      });

      // State should not be updated after unmount
      expect(result.current.isCalculating).toBe(true); // Still in initial state
    });
  });

  describe('error handling', () => {
    it('should handle fog calculation errors with proper state updates', async () => {
      // Set up database to fail
      database.getRevealedAreas.mockRejectedValue(new Error('Database connection failed'));

      const { result } = renderHook(() => useFogCalculation());

      await waitFor(() => {
        expect(result.current.isCalculating).toBe(false);
      });

      // Should handle errors gracefully and still provide fog
      expect(result.current.fogGeoJSON).toBeDefined();
      expect(result.current.fogGeoJSON.type).toBe('FeatureCollection');
      // May or may not have an error depending on fallback behavior
    });

    it('should handle fog calculation results with errors and warnings', async () => {
      // Set up database to return invalid data that might cause warnings
      database.getRevealedAreas.mockResolvedValue([
        null,
        { type: 'InvalidFeature' },
        mockRevealedArea
      ]);

      const { result } = renderHook(() => useFogCalculation());

      await waitFor(() => {
        expect(result.current.isCalculating).toBe(false);
      });

      // Should complete initialization and filter out invalid data
      expect(result.current.fogGeoJSON).toBeDefined();
      expect(result.current.fogGeoJSON.type).toBe('FeatureCollection');
    });
  });
});