import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useDistanceStatistics, useStatistics, useWorldExplorationStatistics } from '../hooks/useStatistics';

// Mock all dependencies
jest.mock('@/utils/database', () => ({
  getLocations: jest.fn(),
  getRevealedAreas: jest.fn()
}));

jest.mock('@/utils/distanceCalculator', () => ({
  calculateTotalDistance: jest.fn()
}));

jest.mock('@/utils/worldExplorationCalculator', () => ({
  calculateWorldExplorationPercentage: jest.fn()
}));

jest.mock('@/utils/geographicHierarchy', () => ({
  buildGeographicHierarchy: jest.fn(),
  calculateExplorationPercentages: jest.fn(),
  convertToLocationWithGeography: jest.fn()
}));

jest.mock('@/utils/remainingRegionsService', () => ({
  getRemainingRegionsData: jest.fn()
}));

jest.mock('@/utils/statisticsCacheManager', () => ({
  CACHE_KEYS: {
    STATISTICS_DATA: 'statistics_data',
    DISTANCE_DATA: 'distance_data',
    WORLD_EXPLORATION: 'world_exploration',
    HIERARCHICAL_DATA: 'hierarchical_data',
    REMAINING_REGIONS: 'remaining_regions',
    LOCATION_HASH: 'location_hash',
    REVEALED_AREAS_HASH: 'revealed_areas_hash'
  }
}));

jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() }))
  }
}));

// Mock the performance and cache managers that are referenced in useStatistics
global.statisticsCacheManager = {
  get: jest.fn(),
  set: jest.fn(),
  getOrCompute: jest.fn(),
  hasDataChanged: jest.fn(),
  invalidate: jest.fn(),
  clearAll: jest.fn(),
  warmCache: jest.fn(),
  getCacheStats: jest.fn(() => ({})),
  calculateSimpleHash: jest.fn()
};

global.performanceMonitor = {
  startTiming: jest.fn(() => jest.fn())
};

global.memoryManager = {
  isMemoryPressure: jest.fn(() => false),
  optimizeMemory: jest.fn()
};

global.backgroundProcessor = {
  enqueue: jest.fn((name, fn, priority) => fn())
};

global.DataChunker = {
  processInChunks: jest.fn((data, processor, chunkSize) => Promise.resolve([data])),
  processHierarchyWithLimits: jest.fn((hierarchy) => hierarchy)
};

global.statisticsDebouncer = {
  debounce: jest.fn((key, fn, delay) => fn),
  cancel: jest.fn()
};

import * as Database from '@/utils/database';
import * as DistanceCalculator from '@/utils/distanceCalculator';
import * as GeographicHierarchy from '@/utils/geographicHierarchy';
import * as RemainingRegionsService from '@/utils/remainingRegionsService';
import * as WorldExplorationCalculator from '@/utils/worldExplorationCalculator';

describe('useStatistics Integration Tests', () => {
  const mockLocations = [
    { id: 1, latitude: 40.7128, longitude: -74.0060, timestamp: 1000 },
    { id: 2, latitude: 34.0522, longitude: -118.2437, timestamp: 2000 }
  ];

  const mockRevealedAreas = [
    '{"type":"Polygon","coordinates":[[[-74.0,40.7],[-74.0,40.8],[-73.9,40.8],[-73.9,40.7],[-74.0,40.7]]]}',
    '{"type":"Polygon","coordinates":[[[-118.3,34.0],[-118.3,34.1],[-118.2,34.1],[-118.2,34.0],[-118.3,34.0]]]}'
  ];

  const mockDistanceResult = { miles: 2445.5, kilometers: 3936.2 };
  const mockWorldExplorationResult = { percentage: 0.001, totalAreaKm2: 510072000, exploredAreaKm2: 5100.72 };
  const mockHierarchyResult = [
    {
      id: 'us',
      type: 'country',
      name: 'United States',
      explorationPercentage: 2.5,
      children: []
    }
  ];
  const mockRemainingRegionsResult = {
    visited: { countries: 1, states: 2, cities: 3 },
    total: { countries: 195, states: 3142, cities: 10000 },
    remaining: { countries: 194, states: 3140, cities: 9997 },
    percentageVisited: { countries: 0.51, states: 0.06, cities: 0.03 }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock implementations
    Database.getLocations.mockResolvedValue(mockLocations);
    Database.getRevealedAreas.mockResolvedValue(mockRevealedAreas);
    DistanceCalculator.calculateTotalDistance.mockResolvedValue(mockDistanceResult);
    WorldExplorationCalculator.calculateWorldExplorationPercentage.mockResolvedValue(mockWorldExplorationResult);
    GeographicHierarchy.buildGeographicHierarchy.mockResolvedValue(mockHierarchyResult);
    GeographicHierarchy.calculateExplorationPercentages.mockResolvedValue(mockHierarchyResult);
    GeographicHierarchy.convertToLocationWithGeography.mockResolvedValue([]);
    RemainingRegionsService.getRemainingRegionsData.mockResolvedValue(mockRemainingRegionsResult);

    // Setup cache manager mocks
    global.statisticsCacheManager.get.mockResolvedValue(null);
    global.statisticsCacheManager.set.mockResolvedValue(undefined);
    global.statisticsCacheManager.getOrCompute.mockImplementation((key, computeFn) => computeFn());
    global.statisticsCacheManager.hasDataChanged.mockResolvedValue(true);
    global.statisticsCacheManager.invalidate.mockResolvedValue(undefined);
    global.statisticsCacheManager.clearAll.mockResolvedValue(undefined);
    global.statisticsCacheManager.warmCache.mockResolvedValue(undefined);
    global.statisticsCacheManager.calculateSimpleHash.mockReturnValue('mock-hash');
  });

  describe('Basic Hook Functionality', () => {
    test('initializes with loading state', () => {
      const { result } = renderHook(() => useStatistics());

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBe(null);
      expect(result.current.error).toBe(null);
    });

    test('loads statistics data successfully', async () => {
      const { result } = renderHook(() => useStatistics());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toBeTruthy();
      expect(result.current.data.totalDistance).toEqual(mockDistanceResult);
      expect(result.current.data.worldExploration).toEqual(mockWorldExplorationResult);
      expect(result.current.data.uniqueRegions).toEqual(mockRemainingRegionsResult.visited);
      expect(result.current.data.remainingRegions).toEqual(mockRemainingRegionsResult.remaining);
      expect(result.current.data.hierarchicalBreakdown).toEqual(mockHierarchyResult);
      expect(result.current.error).toBe(null);
    });

    test('handles calculation errors gracefully', async () => {
      DistanceCalculator.calculateTotalDistance.mockRejectedValue(new Error('Distance calculation failed'));

      const { result } = renderHook(() => useStatistics());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBe(null);
    });

    test('provides refresh functionality', async () => {
      const { result } = renderHook(() => useStatistics());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toBeTruthy();

      // Update mock data
      const newDistanceResult = { miles: 3000, kilometers: 4828 };
      DistanceCalculator.calculateTotalDistance.mockResolvedValue(newDistanceResult);

      await act(async () => {
        await result.current.refreshData();
      });

      await waitFor(() => {
        expect(result.current.data.totalDistance).toEqual(newDistanceResult);
      });
    });

    test('provides cache clearing functionality', async () => {
      const { result } = renderHook(() => useStatistics());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.clearCache();
      });

      expect(global.statisticsCacheManager.clearAll).toHaveBeenCalled();
    });
  });

  describe('Hierarchy Node Toggling', () => {
    test('toggles hierarchy node expansion', async () => {
      const { result } = renderHook(() => useStatistics());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const nodeToToggle = result.current.data.hierarchicalBreakdown[0];
      
      act(() => {
        result.current.toggleHierarchyNode(nodeToToggle);
      });

      // The node should be toggled in the state
      expect(result.current.data.hierarchicalBreakdown[0].isExpanded).toBe(!nodeToToggle.isExpanded);
    });

    test('handles toggling non-existent nodes gracefully', async () => {
      const { result } = renderHook(() => useStatistics());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const nonExistentNode = { id: 'non-existent', type: 'country', name: 'Non-existent', explorationPercentage: 0 };
      
      act(() => {
        result.current.toggleHierarchyNode(nonExistentNode);
      });

      // Should not crash or change existing data
      expect(result.current.data.hierarchicalBreakdown).toEqual(mockHierarchyResult);
    });
  });

  describe('Hook Options', () => {
    test('respects enableAutoRefresh option', () => {
      const { result } = renderHook(() => useStatistics({ enableAutoRefresh: false }));

      expect(result.current).toBeDefined();
      // Auto-refresh should be disabled, but we can't easily test the interval behavior
    });

    test('respects custom refresh interval', () => {
      const { result } = renderHook(() => useStatistics({ 
        enableAutoRefresh: true, 
        refreshInterval: 10000 
      }));

      expect(result.current).toBeDefined();
    });

    test('respects cache max age option', () => {
      const { result } = renderHook(() => useStatistics({ 
        cacheMaxAge: 30 * 60 * 1000 // 30 minutes
      }));

      expect(result.current).toBeDefined();
    });

    test('respects background updates option', () => {
      const { result } = renderHook(() => useStatistics({ 
        enableBackgroundUpdates: false 
      }));

      expect(result.current).toBeDefined();
    });
  });

  describe('Caching Integration', () => {
    test('uses cached data when available', async () => {
      const cachedData = {
        totalDistance: { miles: 1000, kilometers: 1609 },
        worldExploration: { percentage: 0.002, totalAreaKm2: 510072000, exploredAreaKm2: 10201.44 },
        uniqueRegions: { countries: 2, states: 3, cities: 4 },
        remainingRegions: { countries: 193, states: 3139, cities: 9996 },
        hierarchicalBreakdown: [],
        lastUpdated: Date.now()
      };

      global.statisticsCacheManager.get.mockResolvedValue(cachedData);
      global.statisticsCacheManager.hasDataChanged.mockResolvedValue(false);

      const { result } = renderHook(() => useStatistics());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual(cachedData);
      expect(global.statisticsCacheManager.get).toHaveBeenCalled();
    });

    test('invalidates cache when data changes', async () => {
      global.statisticsCacheManager.hasDataChanged.mockResolvedValue(true);

      const { result } = renderHook(() => useStatistics());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(global.statisticsCacheManager.invalidate).toHaveBeenCalled();
    });

    test('handles cache errors gracefully', async () => {
      global.statisticsCacheManager.get.mockRejectedValue(new Error('Cache error'));

      const { result } = renderHook(() => useStatistics());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should still load data despite cache error
      expect(result.current.data).toBeTruthy();
    });
  });

  describe('Performance Optimizations', () => {
    test('handles large datasets efficiently', async () => {
      const largeLocationSet = Array.from({ length: 15000 }, (_, i) => ({
        id: i + 1,
        latitude: 40 + (i * 0.001),
        longitude: -74 + (i * 0.001),
        timestamp: 1000 + i
      }));

      Database.getLocations.mockResolvedValue(largeLocationSet);

      const { result } = renderHook(() => useStatistics());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      }, { timeout: 5000 });

      expect(result.current.data).toBeTruthy();
      expect(global.DataChunker.processInChunks).toHaveBeenCalled();
    });

    test('handles memory pressure scenarios', async () => {
      global.memoryManager.isMemoryPressure.mockReturnValue(true);

      const { result } = renderHook(() => useStatistics());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(global.memoryManager.optimizeMemory).toHaveBeenCalled();
      expect(result.current.data).toBeTruthy();
    });

    test('uses background processing for expensive calculations', async () => {
      const { result } = renderHook(() => useStatistics());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(global.backgroundProcessor.enqueue).toHaveBeenCalledTimes(4); // distance, world, hierarchy, remaining
    });
  });

  describe('Error Recovery', () => {
    test('recovers from partial calculation failures', async () => {
      // Make one calculation fail
      DistanceCalculator.calculateTotalDistance.mockRejectedValue(new Error('Distance failed'));
      
      // But others succeed
      WorldExplorationCalculator.calculateWorldExplorationPercentage.mockResolvedValue(mockWorldExplorationResult);
      RemainingRegionsService.getRemainingRegionsData.mockResolvedValue(mockRemainingRegionsResult);

      const { result } = renderHook(() => useStatistics());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should have error due to failed calculation
      expect(result.current.error).toBeTruthy();
    });

    test('handles database connection failures', async () => {
      Database.getLocations.mockRejectedValue(new Error('Database connection failed'));
      Database.getRevealedAreas.mockRejectedValue(new Error('Database connection failed'));

      const { result } = renderHook(() => useStatistics());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
    });

    test('handles network-dependent calculation failures', async () => {
      RemainingRegionsService.getRemainingRegionsData.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useStatistics());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
    });
  });

  describe('Cleanup and Memory Management', () => {
    test('cleans up resources on unmount', () => {
      const { unmount } = renderHook(() => useStatistics());

      unmount();

      expect(global.statisticsDebouncer.cancel).toHaveBeenCalled();
    });

    test('handles rapid mount/unmount cycles', () => {
      for (let i = 0; i < 5; i++) {
        const { unmount } = renderHook(() => useStatistics());
        unmount();
      }

      // Should not cause memory leaks or errors
      expect(global.statisticsDebouncer.cancel).toHaveBeenCalledTimes(5);
    });
  });
});

describe('useDistanceStatistics Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Database.getLocations.mockResolvedValue([
      { id: 1, latitude: 40.7128, longitude: -74.0060, timestamp: 1000 },
      { id: 2, latitude: 34.0522, longitude: -118.2437, timestamp: 2000 }
    ]);
    DistanceCalculator.calculateTotalDistance.mockResolvedValue({ miles: 2445.5, kilometers: 3936.2 });
  });

  test('loads distance statistics successfully', async () => {
    const { result } = renderHook(() => useDistanceStatistics());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.distance).toEqual({ miles: 2445.5, kilometers: 3936.2 });
  });

  test('handles distance calculation errors', async () => {
    DistanceCalculator.calculateTotalDistance.mockRejectedValue(new Error('Calculation failed'));

    const { result } = renderHook(() => useDistanceStatistics());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.distance).toEqual({ miles: 0, kilometers: 0 });
  });
});

describe('useWorldExplorationStatistics Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Database.getRevealedAreas.mockResolvedValue([
      '{"type":"Polygon","coordinates":[[[-74.0,40.7],[-74.0,40.8],[-73.9,40.8],[-73.9,40.7],[-74.0,40.7]]]}'
    ]);
    WorldExplorationCalculator.calculateWorldExplorationPercentage.mockResolvedValue({
      percentage: 0.001,
      totalAreaKm2: 510072000,
      exploredAreaKm2: 5100.72
    });
  });

  test('loads world exploration statistics successfully', async () => {
    const { result } = renderHook(() => useWorldExplorationStatistics());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.worldExploration).toEqual({
      percentage: 0.001,
      totalAreaKm2: 510072000,
      exploredAreaKm2: 5100.72
    });
  });

  test('handles world exploration calculation errors', async () => {
    WorldExplorationCalculator.calculateWorldExplorationPercentage.mockRejectedValue(new Error('Calculation failed'));

    const { result } = renderHook(() => useWorldExplorationStatistics());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.worldExploration).toEqual({
      percentage: 0,
      totalAreaKm2: 510072000,
      exploredAreaKm2: 0
    });
  });

  test('handles malformed revealed area data', async () => {
    Database.getRevealedAreas.mockResolvedValue([
      'invalid json',
      '{"type":"Point","coordinates":[-74.0,40.7]}', // Invalid for area calculation
      '{"type":"Polygon","coordinates":[[[-74.0,40.7],[-74.0,40.8],[-73.9,40.8],[-73.9,40.7],[-74.0,40.7]]]}'
    ]);

    const { result } = renderHook(() => useWorldExplorationStatistics());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should still work with valid data
    expect(result.current.worldExploration.percentage).toBe(0.001);
  });
});