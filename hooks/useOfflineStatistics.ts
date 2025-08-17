import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

import { clearAllStatisticsCache, getLocations, getRevealedAreas, getStatisticsCache, saveStatisticsCache } from '@/utils/database';
import { calculateTotalDistance, DistanceResult } from '@/utils/distanceCalculator';
import { buildGeographicHierarchy, calculateExplorationPercentages, convertToLocationWithGeography, GeographicHierarchy } from '@/utils/geographicHierarchy';
import { logger } from '@/utils/logger';
import { networkUtils, withOfflineFallback } from '@/utils/networkUtils';
import { getRemainingRegionsData, RemainingRegionsData } from '@/utils/remainingRegionsService';
import { calculateWorldExplorationPercentage, WorldExplorationResult } from '@/utils/worldExplorationCalculator';

/**
 * Enhanced statistics data interface with offline support
 */
export interface OfflineStatisticsData {
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
  isOfflineData: boolean;
  offlineReason?: string;
  dataSource: 'online' | 'offline' | 'cache';
  networkStatus: {
    isConnected: boolean;
    connectionType: string;
    lastOnlineTime?: number;
  };
}

/**
 * Hook state interface with offline support
 */
export interface UseOfflineStatisticsState {
  data: OfflineStatisticsData | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  lastUpdated: number | null;
  isOffline: boolean;
  networkStatus: {
    isConnected: boolean;
    connectionType: string;
    lastOnlineTime?: number;
  };
  offlineCapabilities: {
    canCalculateDistance: boolean;
    canCalculateWorldExploration: boolean;
    canCalculateBasicRegions: boolean;
    canCalculateHierarchy: boolean;
  };
}

/**
 * Hook options interface with offline configuration
 */
export interface UseOfflineStatisticsOptions {
  enableAutoRefresh?: boolean;
  refreshInterval?: number;
  cacheMaxAge?: number;
  enableBackgroundUpdates?: boolean;
  offlineMode?: 'auto' | 'force' | 'disabled';
  fallbackToCache?: boolean;
  maxOfflineAge?: number; // Maximum age for offline data in milliseconds
}

/**
 * Default options
 */
const DEFAULT_OPTIONS: Required<UseOfflineStatisticsOptions> = {
  enableAutoRefresh: true,
  refreshInterval: 5 * 60 * 1000, // 5 minutes
  cacheMaxAge: 60 * 60 * 1000, // 1 hour
  enableBackgroundUpdates: true,
  offlineMode: 'auto',
  fallbackToCache: true,
  maxOfflineAge: 24 * 60 * 60 * 1000 // 24 hours
};

/**
 * Cache keys for offline statistics
 */
const OFFLINE_CACHE_KEYS = {
  STATISTICS_DATA: 'offline_statistics_data',
  NETWORK_STATUS: 'network_status',
  LAST_ONLINE_TIME: 'last_online_time',
  OFFLINE_CAPABILITIES: 'offline_capabilities'
} as const;

/**
 * Custom hook for managing statistics with offline support
 */
export const useOfflineStatistics = (options: UseOfflineStatisticsOptions = {}): UseOfflineStatisticsState & {
  refreshData: () => Promise<void>;
  clearCache: () => Promise<void>;
  toggleHierarchyNode: (node: GeographicHierarchy) => void;
  forceOfflineMode: () => void;
  forceOnlineMode: () => void;
  retryConnection: () => Promise<boolean>;
} => {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // State management
  const [state, setState] = useState<UseOfflineStatisticsState>({
    data: null,
    isLoading: true,
    isRefreshing: false,
    error: null,
    lastUpdated: null,
    isOffline: false,
    networkStatus: {
      isConnected: false,
      connectionType: 'unknown'
    },
    offlineCapabilities: {
      canCalculateDistance: false,
      canCalculateWorldExploration: false,
      canCalculateBasicRegions: false,
      canCalculateHierarchy: false
    }
  });

  // Refs for managing intervals and preventing memory leaks
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isCalculatingRef = useRef(false);
  const lastDataHashRef = useRef<string>('');
  const networkListenerRef = useRef<(() => void) | null>(null);
  const forcedModeRef = useRef<'online' | 'offline' | null>(null);

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
      logger.error('useOfflineStatistics: Error calculating data hash:', error);
      // Re-throw the error so it can be handled by the caller
      throw new Error(`Database access error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, []);

  /**
   * Get current network status
   */
  const getCurrentNetworkStatus = useCallback(async () => {
    try {
      const networkState = await networkUtils.getCurrentState();
      const isOnline = networkState.isConnected && networkState.isInternetReachable;
      
      const status = {
        isConnected: isOnline,
        connectionType: networkState.type,
        lastOnlineTime: isOnline ? Date.now() : undefined
      };

      // Cache the last online time
      if (isOnline) {
        await saveStatisticsCache(OFFLINE_CACHE_KEYS.LAST_ONLINE_TIME, { timestamp: Date.now() });
      }

      return status;
    } catch (error) {
      logger.error('useOfflineStatistics: Error getting network status:', error);
      return {
        isConnected: false,
        connectionType: 'unknown'
      };
    }
  }, []);

  /**
   * Determine offline capabilities based on available data
   * 
   * BEHAVIOR CHANGE (Test Fix): Enhanced to more accurately assess offline capabilities
   * by checking for actual geocoding data availability rather than making assumptions.
   * This fixes test failures where offline capabilities were incorrectly assessed.
   * 
   * Improvements:
   * - Validates actual presence of geocoding data (country, state, city information)
   * - Checks for hierarchical geographic data availability
   * - More accurate capability assessment for offline mode
   * - Proper error handling when geocoding data is unavailable
   * - Caches capability assessment results for performance
   */
  const assessOfflineCapabilities = useCallback(async () => {
    try {
      const [locations, revealedAreas] = await Promise.all([
        getLocations(),
        getRevealedAreas()
      ]);

      // Check if we have cached geocoding data
      let hasGeocodingData = false;
      try {
        const locationsWithGeography = await convertToLocationWithGeography();
        hasGeocodingData = locationsWithGeography.length > 0 && 
                          locationsWithGeography.some(loc => loc.country || loc.state || loc.city);
        logger.debug('useOfflineStatistics: Geocoding data assessment:', { 
          locationsCount: locationsWithGeography.length,
          hasGeocodingData,
          sampleLocation: locationsWithGeography[0]
        });
      } catch (error) {
        logger.debug('useOfflineStatistics: Error getting geocoding data:', error);
        hasGeocodingData = false;
      }

      const capabilities = {
        canCalculateDistance: locations.length > 0,
        canCalculateWorldExploration: revealedAreas.length > 0,
        canCalculateBasicRegions: hasGeocodingData,
        canCalculateHierarchy: hasGeocodingData
      };

      logger.debug('useOfflineStatistics: Assessed capabilities:', capabilities);

      try {
        await saveStatisticsCache(OFFLINE_CACHE_KEYS.OFFLINE_CAPABILITIES, capabilities);
      } catch (cacheError) {
        logger.debug('useOfflineStatistics: Error caching capabilities:', cacheError);
        // Continue without caching
      }
      
      return capabilities;
    } catch (error) {
      logger.error('useOfflineStatistics: Error assessing offline capabilities:', error);
      return {
        canCalculateDistance: false,
        canCalculateWorldExploration: false,
        canCalculateBasicRegions: false,
        canCalculateHierarchy: false
      };
    }
  }, []);

  /**
   * Load cached statistics data with offline support
   */
  const loadCachedData = useCallback(async (): Promise<OfflineStatisticsData | null> => {
    try {
      const cached = await getStatisticsCache(OFFLINE_CACHE_KEYS.STATISTICS_DATA);
      
      if (!cached) {
        return null;
      }

      const age = Date.now() - cached.timestamp;
      
      // For offline mode, allow older cache
      const maxAge = state.isOffline ? opts.maxOfflineAge : opts.cacheMaxAge;
      
      if (age > maxAge) {
        logger.debug('useOfflineStatistics: Cached data expired');
        return null;
      }

      const data = JSON.parse(cached.cache_value) as OfflineStatisticsData;
      logger.debug('useOfflineStatistics: Loaded cached statistics data');
      return data;
    } catch (error) {
      logger.error('useOfflineStatistics: Error loading cached data:', error);
      return null;
    }
  }, [opts.cacheMaxAge, opts.maxOfflineAge, state.isOffline]);

  /**
   * Cache statistics data with offline metadata
   */
  const cacheStatisticsData = useCallback(async (data: OfflineStatisticsData): Promise<void> => {
    try {
      await saveStatisticsCache(OFFLINE_CACHE_KEYS.STATISTICS_DATA, data);
      logger.debug('useOfflineStatistics: Cached statistics data');
    } catch (error) {
      logger.error('useOfflineStatistics: Error caching statistics data:', error);
    }
  }, []);

  /**
   * Calculate distance statistics (always available offline)
   */
  const calculateDistanceStats = useCallback(async (): Promise<DistanceResult> => {
    const locations = await getLocations();
    return await calculateTotalDistance(locations);
  }, []);

  /**
   * Calculate world exploration statistics (available offline)
   */
  const calculateWorldExplorationStats = useCallback(async (): Promise<WorldExplorationResult> => {
    const revealedAreas = await getRevealedAreas();
    const revealedAreaObjects = revealedAreas.map((area, index) => ({
      id: index + 1,
      geojson: typeof area === 'string' ? area : JSON.stringify(area)
    }));
    
    return await calculateWorldExplorationPercentage(revealedAreaObjects);
  }, []);

  /**
   * Calculate hierarchical breakdown with offline fallback
   */
  const calculateHierarchicalStats = useCallback(async (isOffline: boolean): Promise<GeographicHierarchy[]> => {
    try {
      const locationsWithGeography = await convertToLocationWithGeography();
      
      if (locationsWithGeography.length === 0) {
        return [];
      }

      // In offline mode, only use cached geocoding data
      const validLocations = isOffline 
        ? locationsWithGeography.filter(loc => loc.country || loc.state || loc.city)
        : locationsWithGeography;

      if (validLocations.length === 0) {
        logger.debug('useOfflineStatistics: No valid locations for hierarchy calculation');
        return [];
      }

      const hierarchy = await buildGeographicHierarchy(validLocations, {
        sortBy: 'name',
        sortOrder: 'asc',
        maxDepth: isOffline ? 3 : 4 // Limit depth in offline mode
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
      logger.error('useOfflineStatistics: Error calculating hierarchical stats:', error);
      return [];
    }
  }, []);

  /**
   * Calculate remaining regions with offline fallback
   */
  const calculateRemainingRegionsStats = useCallback(async (isOffline: boolean): Promise<RemainingRegionsData> => {
    try {
      if (isOffline) {
        // In offline mode, use basic calculation from cached data
        const locationsWithGeography = await convertToLocationWithGeography();
        const uniqueCountries = new Set(locationsWithGeography.map(l => l.country).filter(Boolean));
        const uniqueStates = new Set(locationsWithGeography.map(l => l.state).filter(Boolean));
        const uniqueCities = new Set(locationsWithGeography.map(l => l.city).filter(Boolean));

        const visited = {
          countries: uniqueCountries.size,
          states: uniqueStates.size,
          cities: uniqueCities.size
        };

        // Use fallback totals for offline mode
        const total = {
          countries: 195,
          states: 3142,
          cities: 10000
        };

        const remaining = {
          countries: Math.max(0, total.countries - visited.countries),
          states: Math.max(0, total.states - visited.states),
          cities: Math.max(0, total.cities - visited.cities)
        };

        const percentageVisited = {
          countries: total.countries > 0 ? (visited.countries / total.countries) * 100 : 0,
          states: total.states > 0 ? (visited.states / total.states) * 100 : 0,
          cities: total.cities > 0 ? (visited.cities / total.cities) * 100 : 0
        };

        return { visited, total, remaining, percentageVisited };
      }

      return await getRemainingRegionsData();
    } catch (error) {
      logger.error('useOfflineStatistics: Error calculating remaining regions stats:', error);
      return {
        visited: { countries: 0, states: 0, cities: 0 },
        total: { countries: 195, states: 3142, cities: 10000 },
        remaining: { countries: 195, states: 3142, cities: 10000 },
        percentageVisited: { countries: 0, states: 0, cities: 0 }
      };
    }
  }, []);

  /**
   * Calculate all statistics with offline support
   */
  const calculateStatistics = useCallback(async (forceOffline: boolean = false): Promise<OfflineStatisticsData> => {
    logger.debug('useOfflineStatistics: Starting statistics calculation', { forceOffline });

    const networkStatus = await getCurrentNetworkStatus();
    const isOffline = forceOffline || 
                     (!networkStatus.isConnected && forcedModeRef.current !== 'online') || 
                     forcedModeRef.current === 'offline';
    const capabilities = await assessOfflineCapabilities();

    try {
      // Always calculate basic stats (available offline)
      const totalDistance = await calculateDistanceStats();
      const worldExploration = await calculateWorldExplorationStats();

      // Calculate region stats with offline fallback
      const [hierarchicalBreakdown, remainingRegionsData] = await Promise.all([
        withOfflineFallback(
          () => calculateHierarchicalStats(false),
          () => calculateHierarchicalStats(true),
          { testConnectivity: !isOffline }
        ).then(result => result.result),
        withOfflineFallback(
          () => calculateRemainingRegionsStats(false),
          () => calculateRemainingRegionsStats(true),
          { testConnectivity: !isOffline }
        ).then(result => result.result)
      ]);

      const statisticsData: OfflineStatisticsData = {
        totalDistance,
        worldExploration,
        uniqueRegions: remainingRegionsData.visited,
        remainingRegions: remainingRegionsData.remaining,
        hierarchicalBreakdown,
        lastUpdated: Date.now(),
        isOfflineData: isOffline,
        offlineReason: isOffline ? (forceOffline ? 'Forced offline mode' : 'No internet connection') : undefined,
        dataSource: forcedModeRef.current === 'offline' ? 'offline' : (isOffline ? 'offline' : 'online'),
        networkStatus
      };

      logger.success('useOfflineStatistics: Statistics calculation completed', {
        distance: `${totalDistance.miles.toFixed(1)} miles`,
        worldPercentage: `${worldExploration.percentage.toFixed(3)}%`,
        countries: remainingRegionsData.visited.countries,
        hierarchyNodes: hierarchicalBreakdown.length,
        isOffline,
        dataSource: statisticsData.dataSource
      });

      return statisticsData;
    } catch (error) {
      logger.error('useOfflineStatistics: Error calculating statistics:', error);
      throw error;
    }
  }, [getCurrentNetworkStatus, assessOfflineCapabilities, calculateDistanceStats, calculateWorldExplorationStats, calculateHierarchicalStats, calculateRemainingRegionsStats]);

  /**
   * Fetch and update statistics data with offline support
   */
  const fetchStatisticsData = useCallback(async (forceRefresh: boolean = false): Promise<void> => {
    // Prevent concurrent calculations
    if (isCalculatingRef.current) {
      logger.debug('useOfflineStatistics: Calculation already in progress, skipping');
      return;
    }

    try {
      isCalculatingRef.current = true;

      const networkStatus = await getCurrentNetworkStatus();
      const isOffline = (!networkStatus.isConnected && forcedModeRef.current !== 'online') || 
                       forcedModeRef.current === 'offline';

      // Assess offline capabilities
      const capabilities = await assessOfflineCapabilities();

      // Update network status and capabilities in state
      setState(prev => ({
        ...prev,
        isOffline,
        networkStatus,
        offlineCapabilities: capabilities
      }));

      // Check if data has changed
      let currentDataHash;
      let hasDataChanged = true;
      try {
        currentDataHash = await calculateDataHash();
        hasDataChanged = currentDataHash !== lastDataHashRef.current;
      } catch (hashError) {
        // If we can't calculate hash due to database error, this is a serious error
        logger.error('useOfflineStatistics: Error calculating data hash:', hashError);
        // Set error state and return early if we can't access basic data
        setState(prev => ({
          ...prev,
          isLoading: false,
          isRefreshing: false,
          error: `Database access error: ${hashError instanceof Error ? hashError.message : 'Unknown database error'}`
        }));
        return;
      }

      // Try to load from cache first if not forcing refresh and not in forced offline mode
      if (!forceRefresh && forcedModeRef.current !== 'offline') {
        const cachedData = await loadCachedData();
        if (cachedData && (!hasDataChanged || isOffline)) {
          setState(prev => ({
            ...prev,
            data: {
              ...cachedData,
              dataSource: 'cache'
            },
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

      // Calculate new statistics with error handling
      let statisticsData;
      try {
        // Pass true for forceOffline if we're in forced offline mode
        const forceOffline = forcedModeRef.current === 'offline';
        statisticsData = await calculateStatistics(forceOffline);
      } catch (calculationError) {
        logger.error('useOfflineStatistics: Statistics calculation failed:', calculationError);
        
        // If calculation fails, try to use cached data as fallback
        if (opts.fallbackToCache) {
          try {
            const cachedData = await loadCachedData();
            if (cachedData) {
              logger.debug('useOfflineStatistics: Using cached data as fallback');
              setState(prev => ({
                ...prev,
                data: {
                  ...cachedData,
                  isOfflineData: true,
                  offlineReason: 'Error occurred, using cached data',
                  dataSource: 'cache'
                },
                isLoading: false,
                isRefreshing: false,
                error: `Using cached data: ${calculationError instanceof Error ? calculationError.message : 'Unknown error'}`
              }));
              return;
            }
          } catch (cacheError) {
            logger.error('useOfflineStatistics: Error loading cached fallback data:', cacheError);
          }
        }
        throw calculationError;
      }

      // Cache the new data
      await cacheStatisticsData(statisticsData);

      // Update state
      setState(prev => ({
        ...prev,
        data: statisticsData,
        isLoading: false,
        isRefreshing: false,
        error: null,
        lastUpdated: statisticsData.lastUpdated,
        isOffline: statisticsData.isOfflineData,
        networkStatus: statisticsData.networkStatus
      }));

      // Update data hash
      if (currentDataHash) {
        lastDataHashRef.current = currentDataHash;
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('useOfflineStatistics: Error fetching statistics data:', error);

      // Try to load cached data as fallback
      if (opts.fallbackToCache) {
        try {
          const cachedData = await loadCachedData();
          if (cachedData) {
            setState(prev => ({
              ...prev,
              data: {
                ...cachedData,
                isOfflineData: true,
                offlineReason: 'Error occurred, using cached data',
                dataSource: 'cache'
              },
              isLoading: false,
              isRefreshing: false,
              error: `Using cached data: ${errorMessage}`
            }));
            return;
          }
        } catch (cacheError) {
          logger.error('useOfflineStatistics: Error loading cached fallback data:', cacheError);
        }
      }

      setState(prev => ({
        ...prev,
        isLoading: false,
        isRefreshing: false,
        error: errorMessage
      }));
    } finally {
      isCalculatingRef.current = false;
    }
  }, [getCurrentNetworkStatus, calculateDataHash, loadCachedData, calculateStatistics, cacheStatisticsData, opts.fallbackToCache]);

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
      // Always call the database clear function, even if it might fail
      await clearAllStatisticsCache();
      lastDataHashRef.current = '';
      logger.debug('useOfflineStatistics: Cleared statistics cache');
    } catch (error) {
      logger.error('useOfflineStatistics: Error clearing cache:', error);
      // Still reset the hash even if database clear fails
      lastDataHashRef.current = '';
      // Don't re-throw in normal operation, but ensure the database function was called
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
   * Force offline mode
   */
  const forceOfflineMode = useCallback(async () => {
    forcedModeRef.current = 'offline';
    logger.debug('useOfflineStatistics: Forced offline mode enabled');
    
    // Update state immediately to reflect forced offline mode
    setState(prev => ({
      ...prev,
      isOffline: true
    }));
    
    // Wait for any ongoing calculation to complete
    while (isCalculatingRef.current) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    await fetchStatisticsData(true);
  }, [fetchStatisticsData]);

  /**
   * Force online mode
   */
  const forceOnlineMode = useCallback(async () => {
    forcedModeRef.current = 'online';
    logger.debug('useOfflineStatistics: Forced online mode enabled');
    
    // Wait for any ongoing calculation to complete
    while (isCalculatingRef.current) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    await fetchStatisticsData(true);
  }, [fetchStatisticsData]);

  /**
   * Retry connection
   */
  const retryConnection = useCallback(async (): Promise<boolean> => {
    try {
      logger.debug('useOfflineStatistics: Retrying connection...');
      const isConnected = await networkUtils.testConnectivity();
      
      if (isConnected) {
        forcedModeRef.current = null;
        await fetchStatisticsData(true);
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('useOfflineStatistics: Error retrying connection:', error);
      return false;
    }
  }, [fetchStatisticsData]);

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
   * Handle network state changes
   * 
   * BEHAVIOR CHANGE (Test Fix): Fixed undefined variable reference error that occurred
   * when accessing 'prev' variable outside of setState callback. All network state
   * transition logic is now properly contained within the setState callback to ensure
   * correct variable scoping and prevent runtime errors.
   * 
   * The fix ensures:
   * - Proper access to previous state values
   * - Correct detection of online/offline transitions
   * - Automatic data refresh when network is restored
   * - No undefined variable references that caused test failures
   */
  const handleNetworkStateChange = useCallback((networkState: any) => {
    const isOnline = networkState.isConnected && networkState.isInternetReachable;
    
    setState(prev => {
      const wasOffline = prev.isOffline;
      
      const newState = {
        ...prev,
        isOffline: !isOnline,
        networkStatus: {
          isConnected: isOnline,
          connectionType: networkState.type,
          lastOnlineTime: isOnline ? Date.now() : prev.networkStatus.lastOnlineTime
        }
      };

      // If we just came back online, refresh data
      if (isOnline && wasOffline && opts.enableAutoRefresh) {
        logger.debug('useOfflineStatistics: Network restored, refreshing data');
        fetchStatisticsData(false);
      }
      
      return newState;
    });
  }, [fetchStatisticsData, opts.enableAutoRefresh]);

  /**
   * Setup auto-refresh interval
   */
  const setupAutoRefresh = useCallback(() => {
    if (opts.enableAutoRefresh && opts.refreshInterval > 0) {
      refreshIntervalRef.current = setInterval(() => {
        fetchStatisticsData(false);
      }, opts.refreshInterval);

      logger.debug(`useOfflineStatistics: Auto-refresh enabled (${opts.refreshInterval}ms)`);
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

    if (networkListenerRef.current) {
      try {
        networkListenerRef.current();
      } catch (error) {
        logger.error('Error removing network listener:', error);
      }
      networkListenerRef.current = null;
    }
    
    // Mark as calculating false to prevent concurrent operations
    isCalculatingRef.current = false;
    
    // Reset forced mode
    forcedModeRef.current = null;
  }, []);

  // Initial data fetch and setup
  useEffect(() => {
    fetchStatisticsData(false);
    setupAutoRefresh();

    // Listen for app state changes
    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    // Listen for network state changes
    networkListenerRef.current = networkUtils.addListener(handleNetworkStateChange);

    return () => {
      cleanup();
      appStateSubscription?.remove();
    };
  }, [fetchStatisticsData, setupAutoRefresh, handleAppStateChange, handleNetworkStateChange, cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    ...state,
    refreshData,
    clearCache,
    toggleHierarchyNode,
    forceOfflineMode,
    forceOnlineMode,
    retryConnection
  };
};

export default useOfflineStatistics;