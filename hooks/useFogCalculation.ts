import { FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import { useCallback, useEffect, useRef, useState } from 'react';

import { CircuitBreaker, FOG_CALCULATION_CIRCUIT_OPTIONS } from '@/utils/circuitBreaker';
import { getRevealedAreas } from '@/utils/database';
import { getGlobalFogCacheManager } from '@/utils/fogCacheManager';
import {
    createFogWithFallback,
    createViewportFogPolygon,
    createWorldFogPolygon,
    FogCalculationOptions,
    getDefaultFogOptions
} from '@/utils/fogCalculation';
import { unionPolygons } from '@/utils/geometryOperations';
import { RevealedArea } from '@/utils/geometryValidation';
import { logger } from '@/utils/logger';
import {
    calculateSpatialFog,
    getGlobalSpatialFogManager,
    SpatialFogCalculationOptions,
    SpatialFogCalculationResult
} from '@/utils/spatialFogCalculation';

/**
 * Configuration options for the fog calculation hook
 * Controls debouncing, optimization, and error handling behavior
 */
export interface UseFogCalculationOptions {
  /** Debounce delay in milliseconds for fog updates (default: 300ms) */
  debounceDelay?: number;
  /** Whether to use viewport-based optimization for better performance (default: true) */
  useViewportOptimization?: boolean;
  /** Performance mode affecting calculation accuracy vs speed (default: 'accurate') */
  performanceMode?: 'fast' | 'accurate';
  /** Fallback strategy when calculations fail (default: 'viewport') */
  fallbackStrategy?: 'viewport' | 'world' | 'none';
  /** Whether to use spatial indexing for improved performance (default: true) */
  useSpatialIndexing?: boolean;
  /** Maximum number of features to load from spatial index (default: 1000) */
  maxSpatialResults?: number;
  /** Whether to use level-of-detail optimization (default: true) */
  useLevelOfDetail?: boolean;
}

/**
 * State interface for fog calculation hook
 * Represents the current state of fog calculation and related metadata
 */
export interface FogCalculationState {
  /** Current fog GeoJSON features ready for map rendering */
  fogGeoJSON: FeatureCollection<Polygon | MultiPolygon>;
  /** Whether fog calculation is currently in progress */
  isCalculating: boolean;
  /** Whether any loading operation is in progress (includes data loading) */
  isLoading: boolean;
  /** Duration of the last fog calculation in milliseconds */
  lastCalculationTime: number;
  /** Current error message from fog calculation, if any */
  error: string | null;
  /** Array of warning messages from the last fog calculation */
  warnings: string[];
  /** Whether viewport is currently changing (used to prevent flickering) */
  isViewportChanging: boolean;
  /** Whether spatial indexing was used in the last calculation */
  usedSpatialIndexing: boolean;
  /** Number of features processed in the last calculation */
  featuresProcessed: number;
}

/**
 * Return interface for the fog calculation hook
 * Combines state with methods for controlling fog calculation
 */
export interface UseFogCalculationReturn extends FogCalculationState {
  /** Update fog for a specific GPS location (immediate, not debounced) */
  updateFogForLocation: (location: { latitude: number; longitude: number }, zoomLevel?: number) => Promise<void>;
  /** Update fog for current viewport bounds (debounced for performance) */
  updateFogForViewport: (bounds: [number, number, number, number], zoomLevel?: number) => Promise<void>;
  /** Force refresh fog from database (useful after new areas are revealed) */
  refreshFog: (zoomLevel?: number) => Promise<void>;
  /** Clear all fog for testing/debugging purposes */
  clearFog: () => void;
  /** Set viewport changing state to control fog stability during map interactions */
  setViewportChanging: (changing: boolean) => void;
  /** Add new revealed areas to spatial index for immediate availability */
  addRevealedAreasToIndex: (features: RevealedArea[]) => Promise<void>;
  /** Get memory usage statistics for spatial index */
  getSpatialIndexStats: () => { featureCount: number; memoryStats: any };
  /** Optimize spatial index memory usage */
  optimizeSpatialIndex: (aggressive?: boolean) => Promise<void>;
  /** Get fog cache statistics */
  getCacheStats: () => any;
  /** Clear fog cache */
  clearCache: () => void;
  /** Invalidate cache for specific revealed areas */
  invalidateCache: (revealedAreas?: any) => void;
}

/**
 * Default options for fog calculation hook
 */
const DEFAULT_OPTIONS: Required<UseFogCalculationOptions> = {
  debounceDelay: 300,
  useViewportOptimization: true,
  performanceMode: 'accurate',
  fallbackStrategy: 'viewport',
  useSpatialIndexing: true,
  maxSpatialResults: 1000,
  useLevelOfDetail: true
};

/**
 * Custom hook for managing fog calculation state and operations
 * Provides comprehensive fog calculation with debouncing, error handling, and performance optimization
 * Automatically loads revealed areas from database and calculates fog based on viewport and location changes
 * 
 * @param options - Configuration options for fog calculation behavior
 * @returns Object containing fog state and methods for controlling fog calculation
 * 
 * @example
 * ```typescript
 * const {
 *   fogGeoJSON,
 *   isCalculating,
 *   updateFogForLocation,
 *   updateFogForViewport,
 *   refreshFog
 * } = useFogCalculation({
 *   debounceDelay: 300,
 *   useViewportOptimization: true,
 *   performanceMode: 'accurate'
 * });
 * 
 * // Update fog when location changes
 * useEffect(() => {
 *   if (currentLocation) {
 *     updateFogForLocation(currentLocation.coords);
 *   }
 * }, [currentLocation, updateFogForLocation]);
 * ```
 */
export const useFogCalculation = (
  options: UseFogCalculationOptions = {}
): UseFogCalculationReturn => {
  const config = { ...DEFAULT_OPTIONS, ...options };
  
  // State management
  const [state, setState] = useState<FogCalculationState>({
    fogGeoJSON: { type: 'FeatureCollection', features: [] },
    isCalculating: true, // Start with true since we initialize fog calculation on mount
    isLoading: true, // Start with true since we're loading data on mount
    lastCalculationTime: 0,
    error: null,
    warnings: [],
    isViewportChanging: false,
    usedSpatialIndexing: false,
    featuresProcessed: 0
  });
  
  // Refs for managing debouncing and cleanup
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentViewportBoundsRef = useRef<[number, number, number, number] | null>(null);
  const isUnmountedRef = useRef(false);
  
  // Circuit breaker for fog calculations
  const circuitBreakerRef = useRef<CircuitBreaker>(
    new CircuitBreaker(FOG_CALCULATION_CIRCUIT_OPTIONS)
  );
  
  /**
   * Loads revealed areas from database and unions them
   * Fetches all revealed areas from SQLite database and combines overlapping areas
   * 
   * @returns Combined revealed areas as a single feature, or null if no areas exist
   * @throws Error if database access fails (to be caught by circuit breaker)
   * 
   * @internal
   */
  const loadRevealedAreas = useCallback(async (): Promise<RevealedArea | null> => {
    try {
      const areas = await getRevealedAreas();
      
      if (areas.length === 0) {
        logger.debugOnce('No revealed areas found in database');
        return null;
      }
      
      // Convert to proper RevealedArea features
      const revealedFeatures: RevealedArea[] = areas
        .filter(area => area && typeof area === 'object')
        .map(area => area as RevealedArea)
        .filter(area => area.type === 'Feature' && area.geometry);
      
      if (revealedFeatures.length === 0) {
        logger.warnOnce('No valid revealed area features found');
        return null;
      }
      
      if (revealedFeatures.length === 1) {
        return revealedFeatures[0];
      }
      
      // Union multiple revealed areas
      const unionResult = unionPolygons(revealedFeatures);
      
      if (unionResult.errors.length > 0) {
        logger.warnThrottled('Union operation had errors', 5000);
      }
      
      return unionResult.result;
      
    } catch (error) {
      logger.error('Error loading revealed areas:', error);
      // Re-throw the error so it can be caught by the circuit breaker and propagated to the hook state
      throw error;
    }
  }, []);
  
  /**
   * Performs fog calculation with the given options using circuit breaker protection
   * Core calculation function that uses spatial indexing when available
   * Updates component state with results and handles errors gracefully
   * 
   * @param fogOptions - Configuration options for the fog calculation
   * @param isViewportChanging - Whether viewport is changing (affects fog stability)
   * @param zoomLevel - Current map zoom level for level-of-detail optimization
   * 
   * @internal
   */
  const calculateFog = useCallback(async (
    fogOptions: FogCalculationOptions,
    isViewportChanging: boolean = false,
    zoomLevel?: number
  ): Promise<void> => {
    if (isUnmountedRef.current) {
      return;
    }

    // Check circuit breaker before attempting calculation
    if (!circuitBreakerRef.current.canExecute()) {
      logger.debugThrottled('Fog calculation skipped - circuit breaker is OPEN', 10000);
      
      // Provide fallback fog when circuit is open
      let circuitBreakerFallbackFog = { type: 'FeatureCollection' as const, features: [] };
      
      try {
        // Use imported functions
        if (fogOptions.viewportBounds) {
          try {
            const viewportFog = createViewportFogPolygon(fogOptions.viewportBounds);
            circuitBreakerFallbackFog = { type: 'FeatureCollection', features: [viewportFog] };
          } catch (viewportError) {
            const worldFog = createWorldFogPolygon();
            circuitBreakerFallbackFog = { type: 'FeatureCollection', features: [worldFog] };
          }
        } else {
          // No viewport bounds, use world fog based on fallback strategy
          const worldFog = createWorldFogPolygon();
          circuitBreakerFallbackFog = { type: 'FeatureCollection', features: [worldFog] };
        }
      } catch (importError) {
        logger.error('Failed to create circuit breaker fallback fog:', importError);
      }
      
      setState(prev => ({
        ...prev,
        fogGeoJSON: circuitBreakerFallbackFog,
        isCalculating: false,
        isLoading: false,
        lastCalculationTime: 0.001, // Ensure we always have a positive calculation time
        error: 'Fog calculation temporarily disabled due to repeated failures',
        warnings: ['Using circuit breaker protection with fallback fog'],
        usedSpatialIndexing: false,
        featuresProcessed: 0
      }));
      return;
    }
    
    setState(prev => ({
      ...prev,
      isCalculating: true,
      isLoading: true,
      error: null,
      warnings: []
    }));
    
    try {
      // Execute fog calculation with circuit breaker protection
      const fogResult = await circuitBreakerRef.current.execute(async () => {
        if (isUnmountedRef.current) {
          throw new Error('Component unmounted during calculation');
        }
        
        // Use spatial indexing if enabled
        if (config.useSpatialIndexing) {
          const spatialOptions: SpatialFogCalculationOptions = {
            ...fogOptions,
            useSpatialIndexing: true,
            maxSpatialResults: config.maxSpatialResults,
            useLevelOfDetail: config.useLevelOfDetail,
            zoomLevel: zoomLevel || 10,
          };
          
          return await calculateSpatialFog(fogOptions.viewportBounds, spatialOptions);
        } else {
          // Fall back to standard calculation
          const revealedAreas = await loadRevealedAreas();
          const standardResult = createFogWithFallback(revealedAreas, fogOptions, true);
          
          // Convert to spatial result format for consistency
          return {
            ...standardResult,
            usedSpatialIndexing: false,
            dataSourceStats: {
              fromDatabase: revealedAreas ? 1 : 0,
              fromSpatialIndex: 0,
              totalProcessed: revealedAreas ? 1 : 0,
            },
          } as SpatialFogCalculationResult;
        }
      });
      
      if (isUnmountedRef.current) {
        return;
      }
      
      // Update state with results
      setState(prev => ({
        ...prev,
        fogGeoJSON: fogResult.fogGeoJSON,
        isCalculating: false,
        isLoading: false,
        lastCalculationTime: fogResult.calculationTime,
        error: fogResult.errors.length > 0 ? fogResult.errors.join('; ') : null,
        warnings: fogResult.warnings,
        isViewportChanging,
        usedSpatialIndexing: fogResult.usedSpatialIndexing,
        featuresProcessed: fogResult.dataSourceStats.totalProcessed
      }));
      
    } catch (error) {
      if (isUnmountedRef.current) {
        return;
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown fog calculation error';
      
      // Only log errors once per session to prevent spam
      if (error instanceof Error && error.message.includes('Circuit breaker')) {
        logger.debugThrottled('Fog calculation circuit breaker activated', 10000);
      } else {
        logger.error('Fog calculation failed:', error);
      }
      
      // Provide fallback fog when calculation fails completely
      // Try to create viewport fog if bounds are available, otherwise world fog
      let fallbackFogGeoJSON = { type: 'FeatureCollection' as const, features: [] };
      
      try {
        // Use imported functions
        if (fogOptions.viewportBounds) {
          try {
            const viewportFog = createViewportFogPolygon(fogOptions.viewportBounds);
            fallbackFogGeoJSON = { type: 'FeatureCollection', features: [viewportFog] };
          } catch (viewportError) {
            logger.warn('Failed to create fallback viewport fog, using world fog:', viewportError);
            const worldFog = createWorldFogPolygon();
            fallbackFogGeoJSON = { type: 'FeatureCollection', features: [worldFog] };
          }
        } else {
          // No viewport bounds available, use world fog as fallback
          const worldFog = createWorldFogPolygon();
          fallbackFogGeoJSON = { type: 'FeatureCollection', features: [worldFog] };
        }
      } catch (importError) {
        logger.error('Failed to import fog calculation functions:', importError);
        // Keep empty feature collection as final fallback
      }
      
      setState(prev => ({
        ...prev,
        fogGeoJSON: fallbackFogGeoJSON,
        isCalculating: false,
        isLoading: false,
        lastCalculationTime: 0.001, // Ensure we always have a positive calculation time
        error: errorMessage,
        warnings: ['Using fallback fog due to calculation failure'],
        usedSpatialIndexing: false,
        featuresProcessed: 0
      }));
    }
  }, [loadRevealedAreas, config]);
  
  /**
   * Debounced fog calculation to prevent excessive updates
   * Delays fog calculation to avoid performance issues during rapid map interactions
   * Sets viewport changing state during debounce period to prevent flickering
   * 
   * @param fogOptions - Configuration options for the fog calculation
   * @param isViewportChanging - Whether viewport is changing
   * @param zoomLevel - Current map zoom level for level-of-detail optimization
   * 
   * @internal
   */
  const debouncedCalculateFog = useCallback((
    fogOptions: FogCalculationOptions,
    isViewportChanging: boolean = false,
    zoomLevel?: number
  ) => {
    // Clear existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    // Set new timeout
    debounceTimeoutRef.current = setTimeout(() => {
      calculateFog(fogOptions, isViewportChanging, zoomLevel);
    }, config.debounceDelay);
  }, [calculateFog, config.debounceDelay]);
  
  /**
   * Updates fog for a specific location (typically current GPS location)
   * Triggers immediate fog calculation without debouncing for responsive location updates
   * Uses current viewport bounds if available for optimization
   * 
   * @param location - GPS coordinates to update fog for
   * @param zoomLevel - Current map zoom level for level-of-detail optimization
   * 
   * @example
   * ```typescript
   * await updateFogForLocation({ latitude: 40.7128, longitude: -74.0060 }, 12);
   * ```
   */
  const updateFogForLocation = useCallback(async (
    location: { latitude: number; longitude: number },
    zoomLevel?: number
  ): Promise<void> => {
    logger.debugThrottled('Updating fog for location', 3000, location);
    
    const fogOptions = getDefaultFogOptions(currentViewportBoundsRef.current || undefined);
    fogOptions.useViewportOptimization = config.useViewportOptimization;
    fogOptions.performanceMode = config.performanceMode;
    fogOptions.fallbackStrategy = config.fallbackStrategy;
    
    // Use immediate calculation for location updates (not debounced)
    await calculateFog(fogOptions, false, zoomLevel);
  }, [calculateFog, config]);
  
  /**
   * Updates fog for current viewport bounds with debouncing
   * Triggers debounced fog calculation optimized for the specified viewport
   * Prevents excessive calculations during map panning and zooming
   * 
   * @param bounds - Viewport bounds as [minLng, minLat, maxLng, maxLat]
   * @param zoomLevel - Current map zoom level for level-of-detail optimization
   * 
   * @example
   * ```typescript
   * const bounds: [number, number, number, number] = [-74.1, 40.7, -73.9, 40.8];
   * await updateFogForViewport(bounds, 12);
   * ```
   */
  const updateFogForViewport = useCallback(async (
    bounds: [number, number, number, number],
    zoomLevel?: number
  ): Promise<void> => {
    logger.debugViewport('Updating fog for viewport bounds', bounds);
    
    // Store current viewport bounds
    currentViewportBoundsRef.current = bounds;
    
    const fogOptions = getDefaultFogOptions(bounds);
    fogOptions.useViewportOptimization = config.useViewportOptimization;
    fogOptions.performanceMode = config.performanceMode;
    fogOptions.fallbackStrategy = config.fallbackStrategy;
    
    // Use debounced calculation for viewport updates
    debouncedCalculateFog(fogOptions, state.isViewportChanging, zoomLevel);
  }, [debouncedCalculateFog, config, state.isViewportChanging]);
  
  /**
   * Force refresh fog from database (useful after new areas are revealed)
   * Immediately recalculates fog by reloading all revealed areas from database
   * Should be called after new locations are visited and saved to database
   * Invalidates cache to ensure fresh calculations
   * 
   * @param zoomLevel - Current map zoom level for level-of-detail optimization
   * 
   * @example
   * ```typescript
   * // After saving a new revealed area to database
   * await saveRevealedArea(newArea);
   * await refreshFog(12); // Update fog to reflect new area
   * ```
   */
  const refreshFog = useCallback(async (zoomLevel?: number): Promise<void> => {
    logger.debugThrottled('Force refreshing fog from database', 2000);
    
    // Invalidate cache since we're refreshing from database
    try {
      const cacheManager = getGlobalFogCacheManager();
      cacheManager.invalidateCache(); // Invalidate all cache entries
      logger.debugThrottled('Invalidated fog cache for refresh', 3000);
    } catch (cacheError) {
      logger.warn('Error invalidating fog cache during refresh:', cacheError);
    }
    
    // Refresh spatial index if using spatial indexing
    if (config.useSpatialIndexing) {
      try {
        const spatialManager = getGlobalSpatialFogManager();
        await spatialManager.refreshIndex();
      } catch (error) {
        logger.warn('Failed to refresh spatial index, continuing with standard refresh:', error);
      }
    }
    
    const fogOptions = getDefaultFogOptions(currentViewportBoundsRef.current || undefined);
    fogOptions.useViewportOptimization = config.useViewportOptimization;
    fogOptions.performanceMode = config.performanceMode;
    fogOptions.fallbackStrategy = config.fallbackStrategy;
    
    // Use immediate calculation for refresh
    await calculateFog(fogOptions, false, zoomLevel);
  }, [calculateFog, config]);
  
  /**
   * Clears all fog (for testing/debugging)
   * Removes all fog from the map display without affecting database
   * Useful for testing and debugging fog calculation issues
   * 
   * @example
   * ```typescript
   * clearFog(); // Map will show no fog overlay
   * ```
   */
  const clearFog = useCallback((): void => {
    logger.debugOnce('Clearing all fog');
    setState(prev => ({
      ...prev,
      fogGeoJSON: { type: 'FeatureCollection', features: [] },
      error: null,
      warnings: []
    }));
  }, []);
  
  /**
   * Sets viewport changing state to control fog stability
   * Controls whether fog should remain stable during map interactions
   * Prevents fog flickering during panning, zooming, and other viewport changes
   * 
   * @param changing - True if viewport is changing, false when stable
   * 
   * @example
   * ```typescript
   * // In map event handlers
   * const handleMapMoveStart = () => setViewportChanging(true);
   * const handleMapMoveEnd = () => setViewportChanging(false);
   * ```
   */
  const setViewportChanging = useCallback((changing: boolean): void => {
    logger.debugViewport('Setting viewport changing state:', changing);
    setState(prev => ({
      ...prev,
      isViewportChanging: changing
    }));
  }, []);
  
  /**
   * Adds new revealed areas to the spatial index for immediate availability
   * Should be called when new areas are revealed to keep spatial index up-to-date
   * 
   * @param features - New revealed area features to add to spatial index
   * 
   * @example
   * ```typescript
   * await addRevealedAreasToIndex([newRevealedArea]);
   * ```
   */
  const addRevealedAreasToIndex = useCallback(async (features: RevealedArea[]): Promise<void> => {
    if (!config.useSpatialIndexing) {
      logger.debugThrottled('Spatial indexing disabled, skipping index update', 5000);
      return;
    }
    
    try {
      const spatialManager = getGlobalSpatialFogManager();
      await spatialManager.addRevealedAreas(features);
      
      logger.debugThrottled(
        `Added ${features.length} features to spatial index`,
        3000
      );
    } catch (error) {
      logger.error('Failed to add revealed areas to spatial index:', error);
      // Don't throw error as this is not critical for fog calculation
    }
  }, [config.useSpatialIndexing]);
  
  /**
   * Gets memory usage statistics for the spatial index
   * 
   * @returns Object containing feature count and memory statistics
   * 
   * @example
   * ```typescript
   * const stats = getSpatialIndexStats();
   * console.log(`Spatial index contains ${stats.featureCount} features`);
   * ```
   */
  const getSpatialIndexStats = useCallback(() => {
    if (!config.useSpatialIndexing) {
      return { featureCount: 0, memoryStats: null };
    }
    
    try {
      const spatialManager = getGlobalSpatialFogManager();
      return {
        featureCount: spatialManager.getFeatureCount(),
        memoryStats: spatialManager.getMemoryStats(),
      };
    } catch (error) {
      logger.error('Failed to get spatial index stats:', error);
      return { featureCount: 0, memoryStats: null };
    }
  }, [config.useSpatialIndexing]);
  
  /**
   * Optimizes spatial index memory usage
   * Removes redundant or low-priority features to reduce memory consumption
   * 
   * @param aggressive - Whether to perform aggressive cleanup
   * 
   * @example
   * ```typescript
   * await optimizeSpatialIndex(false); // Gentle cleanup
   * await optimizeSpatialIndex(true);  // Aggressive cleanup
   * ```
   */
  const optimizeSpatialIndex = useCallback(async (aggressive: boolean = false): Promise<void> => {
    if (!config.useSpatialIndexing) {
      logger.debugThrottled('Spatial indexing disabled, skipping optimization', 5000);
      return;
    }
    
    try {
      const spatialManager = getGlobalSpatialFogManager();
      await spatialManager.optimizeMemory(aggressive);
      
      logger.info(`Spatial index memory optimization completed (aggressive: ${aggressive})`);
    } catch (error) {
      logger.error('Failed to optimize spatial index memory:', error);
      throw error;
    }
  }, [config.useSpatialIndexing]);

  /**
   * Gets fog cache statistics and performance metrics
   * Provides insights into cache effectiveness and memory usage
   * 
   * @returns Current cache statistics
   * 
   * @example
   * ```typescript
   * const stats = getCacheStats();
   * console.log(`Cache hit ratio: ${stats.hitRatio.toFixed(1)}%`);
   * ```
   */
  const getCacheStats = useCallback(() => {
    try {
      const cacheManager = getGlobalFogCacheManager();
      return cacheManager.getCacheStats();
    } catch (error) {
      logger.error('Failed to get fog cache stats:', error);
      return {
        totalEntries: 0,
        cacheHits: 0,
        cacheMisses: 0,
        hitRatio: 0,
        memoryUsage: 0,
        averageTimeSaved: 0,
        evictedEntries: 0,
        expiredEntries: 0,
        topCacheKeys: [],
      };
    }
  }, []);

  /**
   * Clears all cached fog entries
   * Removes all cached fog calculations and resets cache statistics
   * 
   * @example
   * ```typescript
   * clearCache();
   * console.log('Fog cache cleared');
   * ```
   */
  const clearCache = useCallback((): void => {
    try {
      const cacheManager = getGlobalFogCacheManager();
      cacheManager.clearCache();
      logger.info('Fog cache cleared');
    } catch (error) {
      logger.error('Failed to clear fog cache:', error);
    }
  }, []);

  /**
   * Invalidates cache entries for specific revealed areas
   * Removes cached entries that are no longer valid due to revealed area changes
   * 
   * @param revealedAreas - New revealed areas that invalidate existing cache
   * 
   * @example
   * ```typescript
   * // After new areas are revealed
   * invalidateCache(updatedRevealedAreas);
   * ```
   */
  const invalidateCache = useCallback((revealedAreas?: any): void => {
    try {
      const cacheManager = getGlobalFogCacheManager();
      cacheManager.invalidateCache(revealedAreas);
      
      if (revealedAreas) {
        logger.debugThrottled('Invalidated fog cache for revealed areas change', 3000);
      } else {
        logger.info('Invalidated all fog cache entries');
      }
    } catch (error) {
      logger.error('Failed to invalidate fog cache:', error);
    }
  }, []);
  
  // Initialize fog calculation on mount - run only once
  useEffect(() => {
    const initializeFog = async () => {
      try {
        const fogOptions = getDefaultFogOptions();
        fogOptions.useViewportOptimization = false; // Initial load without viewport optimization
        fogOptions.performanceMode = config.performanceMode;
        fogOptions.fallbackStrategy = config.fallbackStrategy;
        
        await calculateFog(fogOptions, false);
      } catch (error) {
        logger.error('Error initializing fog calculation:', error);
        // Ensure loading state is cleared even on error
        if (!isUnmountedRef.current) {
          setState(prev => ({
            ...prev,
            isCalculating: false,
            isLoading: false,
            lastCalculationTime: 0.001, // Ensure we always have a positive calculation time
            error: error instanceof Error ? error.message : 'Initialization failed'
          }));
        }
      }
    };
    
    initializeFog();
    
    // Cleanup function
    return () => {
      isUnmountedRef.current = true;
      
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
      }
    };
  }, []); // Remove dependencies to prevent re-initialization
  
  return {
    ...state,
    updateFogForLocation,
    updateFogForViewport,
    refreshFog,
    clearFog,
    setViewportChanging,
    addRevealedAreasToIndex,
    getSpatialIndexStats,
    optimizeSpatialIndex,
    getCacheStats,
    clearCache,
    invalidateCache
  };
};

export default useFogCalculation;