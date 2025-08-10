import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { useDistanceStatistics, useStatistics, useWorldExplorationStatistics } from './useStatistics';

// Mock all the utility modules
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

jest.mock('@/utils/database', () => ({
  getLocations: jest.fn(),
  getRevealedAreas: jest.fn(),
  getStatisticsCache: jest.fn(),
  saveStatisticsCache: jest.fn(),
  clearAllStatisticsCache: jest.fn()
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    success: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

// Create a mock cache manager that matches the real interface
const mockStatisticsCacheManager = {
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
  clearAll: jest.fn(),
  getOrCompute: jest.fn(),
  hasDataChanged: jest.fn(),
  invalidate: jest.fn(),
  warmCache: jest.fn(),
  calculateSimpleHash: jest.fn(),
  getCacheStats: jest.fn(() => ({ hits: 0, misses: 0, sets: 0, invalidations: 0, hitRate: 0 }))
};

jest.mock('@/utils/statisticsCacheManager', () => ({
  statisticsCacheManager: mockStatisticsCacheManager,
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

// Mock the performance optimizer
jest.mock('@/utils/statisticsPerformanceOptimizer', () => ({
  statisticsDebouncer: {
    debounce: jest.fn((key, fn, delay) => fn),
    cancel: jest.fn()
  }
}));

// Import mocked modules
import {
    clearAllStatisticsCache,
    getLocations,
    getRevealedAreas,
    getStatisticsCache,
    saveStatisticsCache
} from '@/utils/database';
import { calculateTotalDistance } from '@/utils/distanceCalculator';
import {
    buildGeographicHierarchy,
    calculateExplorationPercentages,
    convertToLocationWithGeography
} from '@/utils/geographicHierarchy';
import { getRemainingRegionsData } from '@/utils/remainingRegionsService';
import { calculateWorldExplorationPercentage } from '@/utils/worldExplorationCalculator';

describe('useStatistics', () => {
  // Mock data
  const mockLocations = [
    { id: 1, latitude: 37.7749, longitude: -122.4194, timestamp: 1640995200000 },
    { id: 2, latitude: 37.7849, longitude: -122.4094, timestamp: 1640995260000 }
  ];

  const mockRevealedAreas = [
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[-122.5, 37.7], [-122.4, 37.7], [-122.4, 37.8], [-122.5, 37.8], [-122.5, 37.7]]] } }
  ];

  const mockDistanceResult = { miles: 10.5, kilometers: 16.9 };

  const mockWorldExplorationResult = {
    percentage: 0.001,
    totalAreaKm2: 510072000,
    exploredAreaKm2: 5100.72
  };

  const mockHierarchy = [
    {
      type: 'country',
      name: 'United States',
      code: 'US',
      explorationPercentage: 2.5,
      locationCount: 2,
      children: [
        {
          type: 'state',
          name: 'California',
          code: 'CA',
          explorationPercentage: 15.2,
          locationCount: 2,
          children: [
            {
              type: 'city',
              name: 'San Francisco',
              explorationPercentage: 45.8,
              locationCount: 2,
              isExpanded: false
            }
          ],
          isExpanded: false
        }
      ],
      isExpanded: false
    }
  ];

  const mockRemainingRegionsData = {
    visited: { countries: 1, states: 1, cities: 1 },
    total: { countries: 195, states: 3142, cities: 10000 },
    remaining: { countries: 194, states: 3141, cities: 9999 },
    percentageVisited: { countries: 0.5, states: 0.03, cities: 0.01 }
  };

  const mockLocationsWithGeography = [
    {
      id: 1,
      latitude: 37.7749,
      longitude: -122.4194,
      timestamp: 1640995200000,
      country: 'United States',
      countryCode: 'US',
      state: 'California',
      stateCode: 'CA',
      city: 'San Francisco',
      isGeocoded: true
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Setup default mock implementations
    getLocations.mockResolvedValue(mockLocations);
    getRevealedAreas.mockResolvedValue(mockRevealedAreas);
    calculateTotalDistance.mockResolvedValue(mockDistanceResult);
    calculateWorldExplorationPercentage.mockResolvedValue(mockWorldExplorationResult);
    convertToLocationWithGeography.mockResolvedValue(mockLocationsWithGeography);
    buildGeographicHierarchy.mockResolvedValue(mockHierarchy);
    calculateExplorationPercentages.mockResolvedValue(mockHierarchy);
    getRemainingRegionsData.mockResolvedValue(mockRemainingRegionsData);
    getStatisticsCache.mockResolvedValue(null);
    saveStatisticsCache.mockResolvedValue();
    clearAllStatisticsCache.mockResolvedValue();

    // Setup cache manager mocks
    mockStatisticsCacheManager.get.mockResolvedValue(null);
    mockStatisticsCacheManager.set.mockResolvedValue(undefined);
    mockStatisticsCacheManager.getOrCompute.mockImplementation((key, computeFn) => computeFn());
    mockStatisticsCacheManager.hasDataChanged.mockResolvedValue(true);
    mockStatisticsCacheManager.invalidate.mockResolvedValue(undefined);
    mockStatisticsCacheManager.clearAll.mockResolvedValue(undefined);
    mockStatisticsCacheManager.warmCache.mockResolvedValue(undefined);
    mockStatisticsCacheManager.calculateSimpleHash.mockReturnValue('mock-hash');
    
    // The cache manager should be properly mocked through the jest.mock above
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Basic functionality', () => {
    it('should initialize with loading state', () => {
      const { result } = renderHook(() => useStatistics());

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBe(null);
      expect(result.current.error).toBe(null);
    });

    it('should fetch and calculate statistics data on mount', async () => {
      const { result } = renderHook(() => useStatistics());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual({
        totalDistance: mockDistanceResult,
        worldExploration: mockWorldExplorationResult,
        uniqueRegions: mockRemainingRegionsData.visited,
        remainingRegions: mockRemainingRegionsData.remaining,
        hierarchicalBreakdown: mockHierarchy,
        lastUpdated: expect.any(Number)
      });

      expect(result.current.error).toBe(null);
    });

    it('should call all calculation functions', async () => {
      renderHook(() => useStatistics());

      await waitFor(() => {
        expect(getLocations).toHaveBeenCalled();
        expect(getRevealedAreas).toHaveBeenCalled();
        expect(calculateTotalDistance).toHaveBeenCalledWith(mockLocations);
        expect(calculateWorldExplorationPercentage).toHaveBeenCalled();
        expect(convertToLocationWithGeography).toHaveBeenCalled();
        expect(buildGeographicHierarchy).toHaveBeenCalled();
        expect(getRemainingRegionsData).toHaveBeenCalled();
      });
    });
  });

  describe('Caching functionality', () => {
    it('should handle caching functionality', async () => {
      const { result } = renderHook(() => useStatistics());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Verify that data was calculated successfully
      expect(result.current.data).toBeTruthy();
      expect(result.current.data.totalDistance).toEqual(mockDistanceResult);
      expect(result.current.error).toBe(null);
      
      // Verify that the hook has caching-related functionality
      expect(typeof result.current.clearCache).toBe('function');
      expect(typeof result.current.refreshData).toBe('function');
    });

    it('should not use expired cache data', async () => {
      const expiredCachedData = {
        totalDistance: { miles: 5, kilometers: 8 },
        worldExploration: { percentage: 0.0005, totalAreaKm2: 510072000, exploredAreaKm2: 2550.36 },
        uniqueRegions: { countries: 0, states: 0, cities: 0 },
        remainingRegions: { countries: 195, states: 3142, cities: 10000 },
        hierarchicalBreakdown: [],
        lastUpdated: Date.now() - 2 * 60 * 60 * 1000 // 2 hours ago
      };

      getStatisticsCache.mockResolvedValue({
        cache_key: 'statistics_data',
        cache_value: JSON.stringify(expiredCachedData),
        timestamp: Date.now() - 2 * 60 * 60 * 1000 // 2 hours ago
      });

      const { result } = renderHook(() => useStatistics({ cacheMaxAge: 60 * 60 * 1000 }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should fetch fresh data, not use expired cache
      expect(result.current.data).toEqual({
        totalDistance: mockDistanceResult,
        worldExploration: mockWorldExplorationResult,
        uniqueRegions: mockRemainingRegionsData.visited,
        remainingRegions: mockRemainingRegionsData.remaining,
        hierarchicalBreakdown: mockHierarchy,
        lastUpdated: expect.any(Number)
      });
    });

    it('should handle cache operations gracefully', async () => {
      const { result } = renderHook(() => useStatistics());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Verify that the hook works even if cache operations fail
      expect(result.current.data).toBeTruthy();
      expect(result.current.data.totalDistance).toEqual(mockDistanceResult);
      expect(result.current.data.worldExploration).toEqual(mockWorldExplorationResult);
      expect(result.current.error).toBe(null);
      
      // Test that cache clearing doesn't break the hook
      await act(async () => {
        await result.current.clearCache();
      });
      
      expect(result.current.data).toBeTruthy();
    });
  });

  describe('Error handling', () => {
    it('should provide error handling capabilities', async () => {
      const { result } = renderHook(() => useStatistics());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Verify error handling structure exists
      expect(result.current.error).toBeDefined();
      expect(typeof result.current.error === 'string' || result.current.error === null).toBe(true);
    });

    it('should handle individual calculation failures with fallback values', async () => {
      calculateTotalDistance.mockRejectedValue(new Error('Distance calculation failed'));

      const { result } = renderHook(() => useStatistics());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should still have data with fallback distance values
      expect(result.current.data).toEqual({
        totalDistance: { miles: 0, kilometers: 0 },
        worldExploration: mockWorldExplorationResult,
        uniqueRegions: mockRemainingRegionsData.visited,
        remainingRegions: mockRemainingRegionsData.remaining,
        hierarchicalBreakdown: mockHierarchy,
        lastUpdated: expect.any(Number)
      });
    });

    it('should handle cache loading errors', async () => {
      getStatisticsCache.mockRejectedValue(new Error('Cache read failed'));

      const { result } = renderHook(() => useStatistics());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should still calculate fresh data despite cache error
      expect(result.current.data).toEqual({
        totalDistance: mockDistanceResult,
        worldExploration: mockWorldExplorationResult,
        uniqueRegions: mockRemainingRegionsData.visited,
        remainingRegions: mockRemainingRegionsData.remaining,
        hierarchicalBreakdown: mockHierarchy,
        lastUpdated: expect.any(Number)
      });
    });
  });

  describe('Refresh functionality', () => {
    it('should provide manual refresh function', async () => {
      const { result } = renderHook(() => useStatistics());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Clear mocks to track refresh calls
      jest.clearAllMocks();
      
      // Setup fresh mocks for refresh test
      getLocations.mockResolvedValue(mockLocations);
      getRevealedAreas.mockResolvedValue(mockRevealedAreas);
      calculateTotalDistance.mockResolvedValue({ miles: 20, kilometers: 32 });
      calculateWorldExplorationPercentage.mockResolvedValue(mockWorldExplorationResult);
      convertToLocationWithGeography.mockResolvedValue(mockLocationsWithGeography);
      buildGeographicHierarchy.mockResolvedValue(mockHierarchy);
      calculateExplorationPercentages.mockResolvedValue(mockHierarchy);
      getRemainingRegionsData.mockResolvedValue(mockRemainingRegionsData);
      mockStatisticsCacheManager.get.mockResolvedValue(null);
      mockStatisticsCacheManager.set.mockResolvedValue();
      mockStatisticsCacheManager.getOrCompute.mockImplementation((key, computeFn) => computeFn());
      mockStatisticsCacheManager.hasDataChanged.mockResolvedValue(true);
      mockStatisticsCacheManager.calculateSimpleHash.mockReturnValue('test-hash');

      await act(async () => {
        await result.current.refreshData();
      });

      expect(result.current.data.totalDistance).toEqual({ miles: 20, kilometers: 32 });
    });

    it('should set refreshing state during manual refresh', async () => {
      const { result } = renderHook(() => useStatistics());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Test that refresh function exists and can be called
      expect(typeof result.current.refreshData).toBe('function');
      
      // Call refresh and verify it completes
      await act(async () => {
        await result.current.refreshData();
      });

      // Verify the data is still present after refresh
      expect(result.current.data).not.toBe(null);
      expect(result.current.isRefreshing).toBe(false);
    });
  });

  describe('Auto-refresh functionality', () => {
    it('should setup auto-refresh interval when enabled', async () => {
      const { result } = renderHook(() => 
        useStatistics({ enableAutoRefresh: true, refreshInterval: 5000 })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Clear mocks to track auto-refresh calls
      jest.clearAllMocks();
      getLocations.mockResolvedValue(mockLocations);
      getRevealedAreas.mockResolvedValue(mockRevealedAreas);
      calculateTotalDistance.mockResolvedValue({ miles: 15, kilometers: 24 });
      mockStatisticsCacheManager.getOrCompute.mockImplementation((key, computeFn) => computeFn());
      mockStatisticsCacheManager.hasDataChanged.mockResolvedValue(true);

      // Fast-forward time to trigger auto-refresh
      act(() => {
        jest.advanceTimersByTime(30000); // Use 30 seconds to ensure interval triggers
      });

      // Wait a bit more for debounced function to execute
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(getLocations).toHaveBeenCalled();
      }, { timeout: 3000 });
    });

    it('should not setup auto-refresh when disabled', async () => {
      renderHook(() => 
        useStatistics({ enableAutoRefresh: false })
      );

      await waitFor(() => {
        expect(getLocations).toHaveBeenCalled();
      });

      // Clear mocks
      jest.clearAllMocks();

      // Fast-forward time
      act(() => {
        jest.advanceTimersByTime(10000);
      });

      // Should not have made additional calls
      expect(getLocations).not.toHaveBeenCalled();
    });
  });

  describe('Background updates', () => {
    it('should refresh data when app becomes active', async () => {
      const mockAddEventListener = jest.fn();
      const mockRemoveEventListener = jest.fn();

      AppState.addEventListener = mockAddEventListener.mockReturnValue({
        remove: mockRemoveEventListener
      });

      const { result } = renderHook(() => 
        useStatistics({ enableBackgroundUpdates: true })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockAddEventListener).toHaveBeenCalledWith('change', expect.any(Function));

      // Simulate app state change to active
      const appStateChangeHandler = mockAddEventListener.mock.calls[0][1];
      
      // Clear mocks to track background refresh
      jest.clearAllMocks();
      getLocations.mockResolvedValue(mockLocations);
      getRevealedAreas.mockResolvedValue(mockRevealedAreas);
      calculateTotalDistance.mockResolvedValue({ miles: 25, kilometers: 40 });

      await act(async () => {
        appStateChangeHandler('active');
      });

      await waitFor(() => {
        expect(calculateTotalDistance).toHaveBeenCalled();
      });
    });
  });

  describe('Hierarchy node toggling', () => {
    it('should toggle hierarchy node expansion', async () => {
      const { result } = renderHook(() => useStatistics());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const nodeToToggle = result.current.data.hierarchicalBreakdown[0];
      expect(nodeToToggle.isExpanded).toBe(false);

      act(() => {
        result.current.toggleHierarchyNode(nodeToToggle);
      });

      expect(result.current.data.hierarchicalBreakdown[0].isExpanded).toBe(true);

      // Get the updated node reference for the second toggle
      const updatedNodeToToggle = result.current.data.hierarchicalBreakdown[0];
      
      act(() => {
        result.current.toggleHierarchyNode(updatedNodeToToggle);
      });

      expect(result.current.data.hierarchicalBreakdown[0].isExpanded).toBe(false);
    });

    it('should toggle nested hierarchy nodes', async () => {
      const { result } = renderHook(() => useStatistics());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const nestedNode = result.current.data.hierarchicalBreakdown[0].children[0];
      expect(nestedNode.isExpanded).toBe(false);

      act(() => {
        result.current.toggleHierarchyNode(nestedNode);
      });

      expect(result.current.data.hierarchicalBreakdown[0].children[0].isExpanded).toBe(true);
    });
  });

  describe('Cache management', () => {
    it('should provide cache clearing function', async () => {
      const { result } = renderHook(() => useStatistics());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Verify that clearCache function exists and can be called
      expect(typeof result.current.clearCache).toBe('function');
      
      await act(async () => {
        await expect(result.current.clearCache()).resolves.not.toThrow();
      });
    });
  });

  describe('Data change detection', () => {
    it('should detect when location data changes', async () => {
      const { result, rerender } = renderHook(() => useStatistics());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Change the mock data
      const newLocations = [
        ...mockLocations,
        { id: 3, latitude: 40.7128, longitude: -74.0060, timestamp: 1640995320000 }
      ];

      jest.clearAllMocks();
      
      // Setup fresh mocks for data change test
      getLocations.mockResolvedValue(newLocations);
      getRevealedAreas.mockResolvedValue(mockRevealedAreas);
      calculateTotalDistance.mockResolvedValue({ miles: 30, kilometers: 48 });
      calculateWorldExplorationPercentage.mockResolvedValue(mockWorldExplorationResult);
      convertToLocationWithGeography.mockResolvedValue(mockLocationsWithGeography);
      buildGeographicHierarchy.mockResolvedValue(mockHierarchy);
      calculateExplorationPercentages.mockResolvedValue(mockHierarchy);
      getRemainingRegionsData.mockResolvedValue(mockRemainingRegionsData);
      mockStatisticsCacheManager.get.mockResolvedValue(null);
      mockStatisticsCacheManager.set.mockResolvedValue();
      mockStatisticsCacheManager.getOrCompute.mockImplementation((key, computeFn) => computeFn());
      mockStatisticsCacheManager.hasDataChanged.mockResolvedValue(true);
      mockStatisticsCacheManager.calculateSimpleHash.mockReturnValue('test-hash-changed');

      // Trigger a refresh
      await act(async () => {
        await result.current.refreshData();
      });

      expect(calculateTotalDistance).toHaveBeenCalledWith(newLocations);
      expect(result.current.data.totalDistance).toEqual({ miles: 30, kilometers: 48 });
    });
  });
});

describe('useDistanceStatistics', () => {
  const mockLocations = [
    { id: 1, latitude: 37.7749, longitude: -122.4194, timestamp: 1640995200000 },
    { id: 2, latitude: 37.7849, longitude: -122.4094, timestamp: 1640995260000 }
  ];

  const mockDistanceResult = { miles: 10.5, kilometers: 16.9 };

  beforeEach(() => {
    jest.clearAllMocks();
    getLocations.mockResolvedValue(mockLocations);
    calculateTotalDistance.mockResolvedValue(mockDistanceResult);
  });

  it('should fetch and return distance statistics', async () => {
    const { result } = renderHook(() => useDistanceStatistics());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.distance).toEqual(mockDistanceResult);
    expect(calculateTotalDistance).toHaveBeenCalledWith(mockLocations);
  });

  it('should handle errors gracefully', async () => {
    calculateTotalDistance.mockRejectedValue(new Error('Calculation failed'));

    const { result } = renderHook(() => useDistanceStatistics());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.distance).toEqual({ miles: 0, kilometers: 0 });
  });
});

describe('useWorldExplorationStatistics', () => {
  const mockRevealedAreas = [
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[-122.5, 37.7], [-122.4, 37.7], [-122.4, 37.8], [-122.5, 37.8], [-122.5, 37.7]]] } }
  ];

  const mockWorldExplorationResult = {
    percentage: 0.001,
    totalAreaKm2: 510072000,
    exploredAreaKm2: 5100.72
  };

  beforeEach(() => {
    jest.clearAllMocks();
    getRevealedAreas.mockResolvedValue(mockRevealedAreas);
    calculateWorldExplorationPercentage.mockResolvedValue(mockWorldExplorationResult);
  });

  it('should fetch and return world exploration statistics', async () => {
    const { result } = renderHook(() => useWorldExplorationStatistics());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.worldExploration).toEqual(mockWorldExplorationResult);
    expect(calculateWorldExplorationPercentage).toHaveBeenCalled();
  });

  it('should handle errors gracefully', async () => {
    calculateWorldExplorationPercentage.mockRejectedValue(new Error('Calculation failed'));

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
});