import { getLocations, getRevealedAreas } from '@/utils/database';
import { calculateTotalDistance, DistanceResult } from '@/utils/distanceCalculator';
import { buildGeographicHierarchy, calculateExplorationPercentages, convertToLocationWithGeography, GeographicHierarchy } from '@/utils/geographicHierarchy';
import { logger } from '@/utils/logger';
import { getRemainingRegionsData, RemainingRegionsData } from '@/utils/remainingRegionsService';
import {
    CACHE_KEYS
} from '@/utils/statisticsCacheManager';
import { calculateWorldExplorationPercentage, WorldExplorationResult } from '@/utils/worldExplorationCalculator';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

/**
 * Statistics data interface matching the design document
 */
export interface StatisticsData {
  totalDistance: DistanceResult;
  worldExploration: WorldExplorationResult;
  uniqueRegions: {
    countries: number;
    states: number;
    cities: number;
  };
  remainingRegions: {
    countries: number;
    states: number;
    cities: number;
  };
  hierarchicalBreakdown: GeographicHierarchy[];
  lastUpdated: number;
}

/**
 * Hook state interface
 */
export interface UseStatisticsState {
  data: StatisticsData | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  lastUpdated: number | null;
}

/**
 * Hook options interface
 */
export interface UseStatisticsOptions {
  enableAutoRefresh?: boolean;
  refreshInterval?: number; // in milliseconds
  cacheMaxAge?: number; // in milliseconds
  enableBackgroundUpdates?: boolean;
}

/**
 * Default options
 */
const DEFAULT_OPTIONS: Required<UseStatisticsOptions> = {
  enableAutoRefresh: true,
  refreshInterval: 5 * 60 * 1000, // 5 minutes
  cacheMaxAge: 60 * 60 * 1000, // 1 hour
  enableBackgroundUpdates: true
};

// Cache keys are now imported from statisticsCacheManager

/**
 * Custom hook for managing statistics state and data fetching
 * Implements requirements 5.1, 5.2, 5.3, 5.4, 5.5
 */
export const useStatistics = (options: UseStatisticsOptions = {}): UseStatisticsState & {
  refreshData: () => Promise<void>;
  clearCache: () => Promise<void>;
  toggleHierarchyNode: (node: GeographicHierarchy) => void;
} => {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // State management
  const [state, setState] = useState<UseStatisticsState>({
    data: null,
    isLoading: true,
    isRefreshing: false,
    error: null,
    lastUpdated: null
  });

  // Refs for managing intervals and preventing memory leaks
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isCalculatingRef = useRef(false);
  const lastDataHashRef = useRef<string>('');

  /**
   * Calculate hash of location/revealed area data to detect changes
   * Now uses optimized cache manager for change detection
   */
  const calculateDataHash = useCallback(async (): Promise<string> => {
    try {
      const [locations, revealedAreas] = await Promise.all([
        getLocations(),
        getRevealedAreas()
      ]);
      
      const dataString = JSON.stringify({
        locationCount: locations.length,
        revealedAreaCount: revealedAreas.length,
        lastLocationTime: locations.length > 0 ? Math.max(...locations.map(l => l.timestamp)) : 0
      });
      
      // Use cache manager's hash function
      return statisticsCacheManager['calculateSimpleHash'](dataString);
    } catch (error) {
      logger.error('useStatistics: Error calculating data hash:', error);
      return Date.now().toString();
    }
  }, []);

  /**
   * Load cached statistics data using optimized cache manager
   */
  const loadCachedData = useCallback(async (): Promise<StatisticsData | null> => {
    try {
      return await statisticsCacheManager.get<StatisticsData>(CACHE_KEYS.STATISTICS_DATA);
    } catch (error) {
      logger.error('useStatistics: Error loading cached data:', error);
      return null;
    }
  }, []);

  /**
   * Cache statistics data using optimized cache manager
   */
  const cacheStatisticsData = useCallback(async (data: StatisticsData): Promise<void> => {
    try {
      await statisticsCacheManager.set(CACHE_KEYS.STATISTICS_DATA, data, opts.cacheMaxAge);
      logger.debug('useStatistics: Cached statistics data');
    } catch (error) {
      logger.error('useStatistics: Error caching statistics data:', error);
    }
  }, [opts.cacheMaxAge]);

  /**
   * Calculate distance statistics with caching and performance optimization
   */
  const calculateDistanceStats = useCallback(async (): Promise<DistanceResult> => {
    return await statisticsCacheManager.getOrCompute(
      CACHE_KEYS.DISTANCE_DATA,
      async () => {
        const endTiming = performanceMonitor.startTiming('distance_calculation');
        try {
          const locations = await getLocations();
          
          // Process large datasets in chunks
          if (locations.length > 10000) {
            logger.debug('useStatistics: Processing large location dataset in chunks');
            const chunks = await DataChunker.processInChunks(
              locations,
              async (chunk) => chunk,
              5000
            );
            const allLocations = chunks.flat();
            const result = await calculateTotalDistance(allLocations);
            endTiming();
            return result;
          }
          
          const result = await calculateTotalDistance(locations);
          endTiming();
          return result;
        } catch (error) {
          endTiming();
          logger.error('useStatistics: Error calculating distance stats:', error);
          return { miles: 0, kilometers: 0 };
        }
      },
      opts.cacheMaxAge / 2 // Cache distance for half the main cache time
    );
  }, [opts.cacheMaxAge]);

  /**
   * Calculate world exploration statistics with caching and performance optimization
   */
  const calculateWorldExplorationStats = useCallback(async (): Promise<WorldExplorationResult> => {
    return await statisticsCacheManager.getOrCompute(
      CACHE_KEYS.WORLD_EXPLORATION,
      async () => {
        const endTiming = performanceMonitor.startTiming('world_exploration_calculation');
        try {
          const revealedAreas = await getRevealedAreas();
          const revealedAreaObjects = revealedAreas.map((area, index) => ({
            id: index + 1,
            geojson: typeof area === 'string' ? area : JSON.stringify(area)
          }));
          
          // Process large datasets in chunks for memory efficiency
          if (revealedAreaObjects.length > 5000) {
            logger.debug('useStatistics: Processing large revealed areas dataset in chunks');
            const chunks = await DataChunker.processInChunks(
              revealedAreaObjects,
              async (chunk) => chunk,
              2500
            );
            const allAreas = chunks.flat();
            const result = await calculateWorldExplorationPercentage(allAreas);
            endTiming();
            return result;
          }
          
          const result = await calculateWorldExplorationPercentage(revealedAreaObjects);
          endTiming();
          return result;
        } catch (error) {
          endTiming();
          logger.error('useStatistics: Error calculating world exploration stats:', error);
          return {
            percentage: 0,
            totalAreaKm2: 510072000,
            exploredAreaKm2: 0
          };
        }
      },
      opts.cacheMaxAge / 2
    );
  }, [opts.cacheMaxAge]);

  /**
   * Calculate hierarchical breakdown statistics with performance optimization
   */
  const calculateHierarchicalStats = useCallback(async (): Promise<GeographicHierarchy[]> => {
    return await statisticsCacheManager.getOrCompute(
      CACHE_KEYS.HIERARCHICAL_DATA,
      async () => {
        const endTiming = performanceMonitor.startTiming('hierarchical_calculation');
        try {
          const locationsWithGeography = await convertToLocationWithGeography();
          
          if (locationsWithGeography.length === 0) {
            endTiming();
            return [];
          }

          // Limit hierarchy complexity for performance
          const maxDepth = locationsWithGeography.length > 10000 ? 3 : 4;
          const maxNodesPerLevel = locationsWithGeography.length > 50000 ? 50 : 100;

          const hierarchy = await buildGeographicHierarchy(locationsWithGeography, {
            sortBy: 'name',
            sortOrder: 'asc',
            maxDepth
          });

          // Apply hierarchy limits for large datasets
          const limitedHierarchy = DataChunker.processHierarchyWithLimits(
            hierarchy,
            maxDepth,
            maxNodesPerLevel
          );

          // Calculate exploration percentages with area data
          const revealedAreas = await getRevealedAreas();
          const revealedGeoJSONFeatures = revealedAreas
            .map(area => {
              try {
                const geojson = typeof area === 'string' ? JSON.parse(area) : area;
                return geojson.type === 'Feature' ? geojson : { type: 'Feature', geometry: geojson, properties: {} };
              } catch {
                return null;
              }
            })
            .filter((feature): feature is GeoJSON.Feature => feature !== null);

          const result = await calculateExplorationPercentages(limitedHierarchy, revealedGeoJSONFeatures);
          endTiming();
          return result;
        } catch (error) {
          endTiming();
          logger.error('useStatistics: Error calculating hierarchical stats:', error);
          return [];
        }
      },
      opts.cacheMaxAge
    );
  }, [opts.cacheMaxAge]);

  /**
   * Calculate remaining regions statistics with caching
   */
  const calculateRemainingRegionsStats = useCallback(async (): Promise<RemainingRegionsData> => {
    return await statisticsCacheManager.getOrCompute(
      CACHE_KEYS.REMAINING_REGIONS,
      async () => {
        const endTiming = performanceMonitor.startTiming('remaining_regions_calculation');
        try {
          const result = await getRemainingRegionsData();
          endTiming();
          return result;
        } catch (error) {
          endTiming();
          logger.error('useStatistics: Error calculating remaining regions stats:', error);
          return {
            visited: { countries: 0, states: 0, cities: 0 },
            total: { countries: 195, states: 3142, cities: 10000 },
            remaining: { countries: 195, states: 3142, cities: 10000 },
            percentageVisited: { countries: 0, states: 0, cities: 0 }
          };
        }
      },
      opts.cacheMaxAge
    );
  }, [opts.cacheMaxAge]);

  /**
   * Calculate all statistics data with background processing and performance monitoring
   */
  const calculateStatistics = useCallback(async (): Promise<StatisticsData> => {
    logger.debug('useStatistics: Starting statistics calculation');

    const endTiming = performanceMonitor.startTiming('full_statistics_calculation');

    try {
      // Check memory pressure before starting expensive calculations
      if (memoryManager.isMemoryPressure()) {
        logger.warn('useStatistics: Memory pressure detected, optimizing before calculation');
        await memoryManager.optimizeMemory();
      }

      // Use background processor for expensive calculations
      const [
        totalDistance,
        worldExploration,
        hierarchicalBreakdown,
        remainingRegionsData
      ] = await Promise.all([
        backgroundProcessor.enqueue('distance_stats', calculateDistanceStats, 1),
        backgroundProcessor.enqueue('world_exploration_stats', calculateWorldExplorationStats, 1),
        backgroundProcessor.enqueue('hierarchical_stats', calculateHierarchicalStats, 0),
        backgroundProcessor.enqueue('remaining_regions_stats', calculateRemainingRegionsStats, 1)
      ]);

      const statisticsData: StatisticsData = {
        totalDistance,
        worldExploration,
        uniqueRegions: remainingRegionsData.visited,
        remainingRegions: remainingRegionsData.remaining,
        hierarchicalBreakdown,
        lastUpdated: Date.now()
      };

      endTiming();

      logger.success('useStatistics: Statistics calculation completed', {
        distance: `${totalDistance.miles.toFixed(1)} miles`,
        worldPercentage: `${worldExploration.percentage.toFixed(3)}%`,
        countries: remainingRegionsData.visited.countries,
        hierarchyNodes: hierarchicalBreakdown.length,
        cacheStats: statisticsCacheManager.getCacheStats()
      });

      return statisticsData;
    } catch (error) {
      endTiming();
      logger.error('useStatistics: Error calculating statistics:', error);
      throw error;
    }
  }, [calculateDistanceStats, calculateWorldExplorationStats, calculateHierarchicalStats, calculateRemainingRegionsStats]);

  /**
   * Fetch and update statistics data with debouncing and performance optimization
   */
  const fetchStatisticsData = useCallback(async (forceRefresh: boolean = false): Promise<void> => {
    // Prevent concurrent calculations
    if (isCalculatingRef.current) {
      logger.debug('useStatistics: Calculation already in progress, skipping');
      return;
    }

    try {
      isCalculatingRef.current = true;

      // Check if data has changed using cache manager
      const [locations, revealedAreas] = await Promise.all([
        getLocations(),
        getRevealedAreas()
      ]);

      const locationChanged = await statisticsCacheManager.hasDataChanged(
        CACHE_KEYS.LOCATION_HASH, 
        locations
      );
      const revealedAreasChanged = await statisticsCacheManager.hasDataChanged(
        CACHE_KEYS.REVEALED_AREAS_HASH, 
        revealedAreas
      );

      const hasDataChanged = locationChanged || revealedAreasChanged;

      if (!forceRefresh && !hasDataChanged) {
        // Try to load from cache if data hasn't changed
        const cachedData = await loadCachedData();
        if (cachedData) {
          setState(prev => ({
            ...prev,
            data: cachedData,
            isLoading: false,
            isRefreshing: false,
            error: null,
            lastUpdated: cachedData.lastUpdated
          }));
          return;
        }
      }

      // Invalidate dependent caches if data changed
      if (hasDataChanged) {
        if (locationChanged) {
          await statisticsCacheManager.invalidate(CACHE_KEYS.LOCATION_HASH);
        }
        if (revealedAreasChanged) {
          await statisticsCacheManager.invalidate(CACHE_KEYS.REVEALED_AREAS_HASH);
        }
      }

      // Update loading state
      setState(prev => ({
        ...prev,
        isLoading: prev.data === null,
        isRefreshing: prev.data !== null,
        error: null
      }));

      // Calculate new statistics
      const statisticsData = await calculateStatistics();

      // Cache the new data
      await cacheStatisticsData(statisticsData);

      // Update state
      setState(prev => ({
        ...prev,
        data: statisticsData,
        isLoading: false,
        isRefreshing: false,
        error: null,
        lastUpdated: statisticsData.lastUpdated
      }));

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('useStatistics: Error fetching statistics data:', error);

      setState(prev => ({
        ...prev,
        isLoading: false,
        isRefreshing: false,
        error: errorMessage
      }));
    } finally {
      isCalculatingRef.current = false;
    }
  }, [loadCachedData, calculateStatistics, cacheStatisticsData]);

  /**
   * Manual refresh function with debouncing
   */
  const refreshData = useCallback(async (): Promise<void> => {
    const debouncedRefresh = statisticsDebouncer.debounce(
      'manual_refresh',
      () => fetchStatisticsData(true),
      100 // Short debounce for manual refresh
    );
    debouncedRefresh();
  }, [fetchStatisticsData]);

  /**
   * Clear all cached statistics data using cache manager
   */
  const clearCache = useCallback(async (): Promise<void> => {
    try {
      await statisticsCacheManager.clearAll();
      lastDataHashRef.current = '';
      logger.debug('useStatistics: Cleared statistics cache');
    } catch (error) {
      logger.error('useStatistics: Error clearing cache:', error);
    }
  }, []);

  /**
   * Toggle hierarchy node expansion
   */
  const toggleHierarchyNode = useCallback((targetNode: GeographicHierarchy): void => {
    setState(prev => {
      if (!prev.data) return prev;

      const toggleNode = (nodes: GeographicHierarchy[]): GeographicHierarchy[] => {
        return nodes.map(node => {
          if (node === targetNode) {
            return {
              ...node,
              isExpanded: !node.isExpanded
            };
          }

          if (node.children) {
            return {
              ...node,
              children: toggleNode(node.children)
            };
          }

          return node;
        });
      };

      return {
        ...prev,
        data: {
          ...prev.data,
          hierarchicalBreakdown: toggleNode(prev.data.hierarchicalBreakdown)
        }
      };
    });
  }, []);

  /**
   * Handle app state changes for background updates
   */
  const handleAppStateChange = useCallback((nextAppState: AppStateStatus) => {
    if (nextAppState === 'active' && opts.enableBackgroundUpdates) {
      // Refresh data when app becomes active
      fetchStatisticsData(false);
    }
  }, [fetchStatisticsData, opts.enableBackgroundUpdates]);

  /**
   * Setup auto-refresh interval with debouncing
   */
  const setupAutoRefresh = useCallback(() => {
    if (opts.enableAutoRefresh && opts.refreshInterval > 0) {
      const debouncedAutoRefresh = statisticsDebouncer.debounce(
        'auto_refresh',
        () => fetchStatisticsData(false),
        opts.refreshInterval
      );

      refreshIntervalRef.current = setInterval(() => {
        debouncedAutoRefresh();
      }, opts.refreshInterval);

      logger.debug(`useStatistics: Auto-refresh enabled (${opts.refreshInterval}ms)`);
    }
  }, [opts.enableAutoRefresh, opts.refreshInterval, fetchStatisticsData]);

  /**
   * Cleanup function with performance optimizer cleanup
   */
  const cleanup = useCallback(() => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
    
    // Cancel any pending debounced operations
    statisticsDebouncer.cancel('auto_refresh');
    statisticsDebouncer.cancel('manual_refresh');
  }, []);

  // Initial data fetch and setup with cache warming
  useEffect(() => {
    const initializeStatistics = async () => {
      // Warm cache on initialization
      await statisticsCacheManager.warmCache();
      
      // Debounced initial fetch
      const debouncedInitialFetch = statisticsDebouncer.debounce(
        'initial_fetch',
        () => fetchStatisticsData(false),
        100
      );
      debouncedInitialFetch();
    };

    initializeStatistics();
    setupAutoRefresh();

    // Listen for app state changes
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      cleanup();
      subscription?.remove();
    };
  }, [fetchStatisticsData, setupAutoRefresh, handleAppStateChange, cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    ...state,
    refreshData,
    clearCache,
    toggleHierarchyNode
  };
};

/**
 * Hook for getting specific statistics without full state management
 * Useful for components that only need specific data
 */
export const useStatisticsData = () => {
  const { data, isLoading, error } = useStatistics({ enableAutoRefresh: false });
  return { data, isLoading, error };
};

/**
 * Hook for getting only distance statistics
 */
export const useDistanceStatistics = () => {
  const [distance, setDistance] = useState<DistanceResult>({ miles: 0, kilometers: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDistance = async () => {
      try {
        const locations = await getLocations();
        const result = await calculateTotalDistance(locations);
        setDistance(result);
      } catch (error) {
        logger.error('useDistanceStatistics: Error fetching distance:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDistance();
  }, []);

  return { distance, isLoading };
};

/**
 * Hook for getting only world exploration statistics
 */
export const useWorldExplorationStatistics = () => {
  const [worldExploration, setWorldExploration] = useState<WorldExplorationResult>({
    percentage: 0,
    totalAreaKm2: 510072000,
    exploredAreaKm2: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchWorldExploration = async () => {
      try {
        const revealedAreas = await getRevealedAreas();
        const revealedAreaObjects = revealedAreas.map((area, index) => ({
          id: index + 1,
          geojson: typeof area === 'string' ? area : JSON.stringify(area)
        }));
        
        const result = await calculateWorldExplorationPercentage(revealedAreaObjects);
        setWorldExploration(result);
      } catch (error) {
        logger.error('useWorldExplorationStatistics: Error fetching world exploration:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWorldExploration();
  }, []);

  return { worldExploration, isLoading };
};

export default useStatistics;