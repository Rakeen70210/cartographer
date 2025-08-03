import { clearAllStatisticsCache, getLocations, getRevealedAreas, getStatisticsCache, saveStatisticsCache } from '@/utils/database';
import { calculateTotalDistance, DistanceResult } from '@/utils/distanceCalculator';
import { buildGeographicHierarchy, calculateExplorationPercentages, convertToLocationWithGeography, GeographicHierarchy } from '@/utils/geographicHierarchy';
import { logger } from '@/utils/logger';
import { getRemainingRegionsData, RemainingRegionsData } from '@/utils/remainingRegionsService';
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

/**
 * Cache keys for different statistics components
 */
const CACHE_KEYS = {
  STATISTICS_DATA: 'statistics_data',
  DISTANCE_DATA: 'distance_data',
  WORLD_EXPLORATION: 'world_exploration',
  HIERARCHICAL_DATA: 'hierarchical_data',
  REMAINING_REGIONS: 'remaining_regions'
} as const;

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
      
      // Simple hash function
      let hash = 0;
      for (let i = 0; i < dataString.length; i++) {
        const char = dataString.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      
      return hash.toString();
    } catch (error) {
      logger.error('useStatistics: Error calculating data hash:', error);
      return Date.now().toString();
    }
  }, []);

  /**
   * Load cached statistics data
   */
  const loadCachedData = useCallback(async (): Promise<StatisticsData | null> => {
    try {
      const cached = await getStatisticsCache(CACHE_KEYS.STATISTICS_DATA);
      
      if (!cached) {
        return null;
      }

      const age = Date.now() - cached.timestamp;
      if (age > opts.cacheMaxAge) {
        logger.debug('useStatistics: Cached data expired');
        return null;
      }

      const data = JSON.parse(cached.cache_value) as StatisticsData;
      logger.debug('useStatistics: Loaded cached statistics data');
      return data;
    } catch (error) {
      logger.error('useStatistics: Error loading cached data:', error);
      return null;
    }
  }, [opts.cacheMaxAge]);

  /**
   * Cache statistics data
   */
  const cacheStatisticsData = useCallback(async (data: StatisticsData): Promise<void> => {
    try {
      await saveStatisticsCache(CACHE_KEYS.STATISTICS_DATA, data);
      logger.debug('useStatistics: Cached statistics data');
    } catch (error) {
      logger.error('useStatistics: Error caching statistics data:', error);
    }
  }, []);

  /**
   * Calculate distance statistics
   */
  const calculateDistanceStats = useCallback(async (): Promise<DistanceResult> => {
    try {
      const locations = await getLocations();
      return await calculateTotalDistance(locations);
    } catch (error) {
      logger.error('useStatistics: Error calculating distance stats:', error);
      return { miles: 0, kilometers: 0 };
    }
  }, []);

  /**
   * Calculate world exploration statistics
   */
  const calculateWorldExplorationStats = useCallback(async (): Promise<WorldExplorationResult> => {
    try {
      const revealedAreas = await getRevealedAreas();
      const revealedAreaObjects = revealedAreas.map((area, index) => ({
        id: index + 1,
        geojson: typeof area === 'string' ? area : JSON.stringify(area)
      }));
      
      return await calculateWorldExplorationPercentage(revealedAreaObjects);
    } catch (error) {
      logger.error('useStatistics: Error calculating world exploration stats:', error);
      return {
        percentage: 0,
        totalAreaKm2: 510072000,
        exploredAreaKm2: 0
      };
    }
  }, []);

  /**
   * Calculate hierarchical breakdown statistics
   */
  const calculateHierarchicalStats = useCallback(async (): Promise<GeographicHierarchy[]> => {
    try {
      const locationsWithGeography = await convertToLocationWithGeography();
      
      if (locationsWithGeography.length === 0) {
        return [];
      }

      const hierarchy = await buildGeographicHierarchy(locationsWithGeography, {
        sortBy: 'name',
        sortOrder: 'asc',
        maxDepth: 4
      });

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

      return await calculateExplorationPercentages(hierarchy, revealedGeoJSONFeatures);
    } catch (error) {
      logger.error('useStatistics: Error calculating hierarchical stats:', error);
      return [];
    }
  }, []);

  /**
   * Calculate remaining regions statistics
   */
  const calculateRemainingRegionsStats = useCallback(async (): Promise<RemainingRegionsData> => {
    try {
      return await getRemainingRegionsData();
    } catch (error) {
      logger.error('useStatistics: Error calculating remaining regions stats:', error);
      return {
        visited: { countries: 0, states: 0, cities: 0 },
        total: { countries: 195, states: 3142, cities: 10000 },
        remaining: { countries: 195, states: 3142, cities: 10000 },
        percentageVisited: { countries: 0, states: 0, cities: 0 }
      };
    }
  }, []);

  /**
   * Calculate all statistics data
   */
  const calculateStatistics = useCallback(async (): Promise<StatisticsData> => {
    logger.debug('useStatistics: Starting statistics calculation');

    try {
      // Calculate all statistics in parallel for better performance
      const [
        totalDistance,
        worldExploration,
        hierarchicalBreakdown,
        remainingRegionsData
      ] = await Promise.all([
        calculateDistanceStats(),
        calculateWorldExplorationStats(),
        calculateHierarchicalStats(),
        calculateRemainingRegionsStats()
      ]);

      const statisticsData: StatisticsData = {
        totalDistance,
        worldExploration,
        uniqueRegions: remainingRegionsData.visited,
        remainingRegions: remainingRegionsData.remaining,
        hierarchicalBreakdown,
        lastUpdated: Date.now()
      };

      logger.success('useStatistics: Statistics calculation completed', {
        distance: `${totalDistance.miles.toFixed(1)} miles`,
        worldPercentage: `${worldExploration.percentage.toFixed(3)}%`,
        countries: remainingRegionsData.visited.countries,
        hierarchyNodes: hierarchicalBreakdown.length
      });

      return statisticsData;
    } catch (error) {
      logger.error('useStatistics: Error calculating statistics:', error);
      throw error;
    }
  }, [calculateDistanceStats, calculateWorldExplorationStats, calculateHierarchicalStats, calculateRemainingRegionsStats]);

  /**
   * Fetch and update statistics data
   */
  const fetchStatisticsData = useCallback(async (forceRefresh: boolean = false): Promise<void> => {
    // Prevent concurrent calculations
    if (isCalculatingRef.current) {
      logger.debug('useStatistics: Calculation already in progress, skipping');
      return;
    }

    try {
      isCalculatingRef.current = true;

      // Check if data has changed
      const currentDataHash = await calculateDataHash();
      const hasDataChanged = currentDataHash !== lastDataHashRef.current;

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

      // Update data hash
      lastDataHashRef.current = currentDataHash;

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
  }, [calculateDataHash, loadCachedData, calculateStatistics, cacheStatisticsData]);

  /**
   * Manual refresh function
   */
  const refreshData = useCallback(async (): Promise<void> => {
    await fetchStatisticsData(true);
  }, [fetchStatisticsData]);

  /**
   * Clear all cached statistics data
   */
  const clearCache = useCallback(async (): Promise<void> => {
    try {
      await clearAllStatisticsCache();
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
   * Setup auto-refresh interval
   */
  const setupAutoRefresh = useCallback(() => {
    if (opts.enableAutoRefresh && opts.refreshInterval > 0) {
      refreshIntervalRef.current = setInterval(() => {
        fetchStatisticsData(false);
      }, opts.refreshInterval);

      logger.debug(`useStatistics: Auto-refresh enabled (${opts.refreshInterval}ms)`);
    }
  }, [opts.enableAutoRefresh, opts.refreshInterval, fetchStatisticsData]);

  /**
   * Cleanup function
   */
  const cleanup = useCallback(() => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
  }, []);

  // Initial data fetch and setup
  useEffect(() => {
    fetchStatisticsData(false);
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