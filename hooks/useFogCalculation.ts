import { FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import { useCallback, useEffect, useRef, useState } from 'react';

import { getRevealedAreas } from '@/utils/database';
import {
    createFogWithFallback,
    FogCalculationOptions,
    FogCalculationResult,
    getDefaultFogOptions
} from '@/utils/fogCalculation';
import { unionPolygons } from '@/utils/geometryOperations';
import { RevealedArea } from '@/utils/geometryValidation';
import { logger } from '@/utils/logger';

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
}

/**
 * Return interface for the fog calculation hook
 * Combines state with methods for controlling fog calculation
 */
export interface UseFogCalculationReturn extends FogCalculationState {
  /** Update fog for a specific GPS location (immediate, not debounced) */
  updateFogForLocation: (location: { latitude: number; longitude: number }) => Promise<void>;
  /** Update fog for current viewport bounds (debounced for performance) */
  updateFogForViewport: (bounds: [number, number, number, number]) => Promise<void>;
  /** Force refresh fog from database (useful after new areas are revealed) */
  refreshFog: () => Promise<void>;
  /** Clear all fog for testing/debugging purposes */
  clearFog: () => void;
  /** Set viewport changing state to control fog stability during map interactions */
  setViewportChanging: (changing: boolean) => void;
}

/**
 * Default options for fog calculation hook
 */
const DEFAULT_OPTIONS: Required<UseFogCalculationOptions> = {
  debounceDelay: 300,
  useViewportOptimization: true,
  performanceMode: 'accurate',
  fallbackStrategy: 'viewport'
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
    isViewportChanging: false
  });
  
  // Refs for managing debouncing and cleanup
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentViewportBoundsRef = useRef<[number, number, number, number] | null>(null);
  const isUnmountedRef = useRef(false);
  
  /**
   * Loads revealed areas from database and unions them
   * Fetches all revealed areas from SQLite database and combines overlapping areas
   * 
   * @returns Combined revealed areas as a single feature, or null if no areas exist
   * @throws Error if database access fails
   * 
   * @internal
   */
  const loadRevealedAreas = useCallback(async (): Promise<RevealedArea | null> => {
    try {
      const areas = await getRevealedAreas();
      
      if (areas.length === 0) {
        return null;
      }
      
      // Convert to proper RevealedArea features
      const revealedFeatures: RevealedArea[] = areas
        .filter(area => area && typeof area === 'object')
        .map(area => area as RevealedArea)
        .filter(area => area.type === 'Feature' && area.geometry);
      
      if (revealedFeatures.length === 0) {
        logger.warn('No valid revealed area features found');
        return null;
      }
      
      if (revealedFeatures.length === 1) {
        return revealedFeatures[0];
      }
      
      // Union multiple revealed areas
      const unionResult = unionPolygons(revealedFeatures);
      
      if (unionResult.errors.length > 0) {
        logger.warn('Union operation had errors:', unionResult.errors);
      }
      

      
      return unionResult.result;
      
    } catch (error) {
      logger.error('Error loading revealed areas:', error);
      // Re-throw the error so it can be caught by the calling function
      throw error;
    }
  }, []);
  
  /**
   * Performs fog calculation with the given options
   * Core calculation function that loads revealed areas and computes fog geometry
   * Updates component state with results and handles errors gracefully
   * 
   * @param fogOptions - Configuration options for the fog calculation
   * @param isViewportChanging - Whether viewport is changing (affects fog stability)
   * 
   * @internal
   */
  const calculateFog = useCallback(async (
    fogOptions: FogCalculationOptions,
    isViewportChanging: boolean = false
  ): Promise<void> => {
    if (isUnmountedRef.current) {
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
      // Load revealed areas from database
      const revealedAreas = await loadRevealedAreas();
      
      if (isUnmountedRef.current) {
        return;
      }
      
      // Perform fog calculation with fallback
      const fogResult: FogCalculationResult = createFogWithFallback(
        revealedAreas,
        fogOptions
      );
      
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
        isViewportChanging
      }));
      
    } catch (error) {
      if (isUnmountedRef.current) {
        return;
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown fog calculation error';
      logger.error('Fog calculation failed:', error);
      
      // Provide fallback fog even when there's an error
      try {
        const fallbackFogOptions = getDefaultFogOptions(fogOptions.viewportBounds);
        fallbackFogOptions.fallbackStrategy = 'world'; // Force world fallback on error
        
        const fallbackResult = createFogWithFallback(null, fallbackFogOptions);
        
        if (isUnmountedRef.current) {
          return;
        }
        
        setState(prev => ({
          ...prev,
          fogGeoJSON: fallbackResult.fogGeoJSON,
          isCalculating: false,
          isLoading: false,
          lastCalculationTime: fallbackResult.calculationTime,
          error: errorMessage,
          warnings: [...fallbackResult.warnings, 'Using fallback fog due to error']
        }));
      } catch (fallbackError) {
        if (isUnmountedRef.current) {
          return;
        }
        
        // If even fallback fails, provide empty fog but keep error state
        logger.error('Fallback fog creation also failed:', fallbackError);
        setState(prev => ({
          ...prev,
          isCalculating: false,
          isLoading: false,
          error: errorMessage,
          warnings: ['Fallback fog creation failed']
        }));
      }
    }
  }, [loadRevealedAreas]);
  
  /**
   * Debounced fog calculation to prevent excessive updates
   * Delays fog calculation to avoid performance issues during rapid map interactions
   * Sets viewport changing state during debounce period to prevent flickering
   * 
   * @param fogOptions - Configuration options for the fog calculation
   * @param isViewportChanging - Whether viewport is changing
   * 
   * @internal
   */
  const debouncedCalculateFog = useCallback((
    fogOptions: FogCalculationOptions,
    isViewportChanging: boolean = false
  ) => {
    // Clear existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    // Set new timeout
    debounceTimeoutRef.current = setTimeout(() => {
      calculateFog(fogOptions, isViewportChanging);
    }, config.debounceDelay);
  }, [calculateFog, config.debounceDelay]);
  
  /**
   * Updates fog for a specific location (typically current GPS location)
   * Triggers immediate fog calculation without debouncing for responsive location updates
   * Uses current viewport bounds if available for optimization
   * 
   * @param location - GPS coordinates to update fog for
   * 
   * @example
   * ```typescript
   * await updateFogForLocation({ latitude: 40.7128, longitude: -74.0060 });
   * ```
   */
  const updateFogForLocation = useCallback(async (
    location: { latitude: number; longitude: number }
  ): Promise<void> => {
    logger.debug('Updating fog for location', location);
    
    const fogOptions = getDefaultFogOptions(currentViewportBoundsRef.current || undefined);
    fogOptions.useViewportOptimization = config.useViewportOptimization;
    fogOptions.performanceMode = config.performanceMode;
    fogOptions.fallbackStrategy = config.fallbackStrategy;
    
    // Use immediate calculation for location updates (not debounced)
    await calculateFog(fogOptions, false);
  }, [calculateFog, config]);
  
  /**
   * Updates fog for current viewport bounds with debouncing
   * Triggers debounced fog calculation optimized for the specified viewport
   * Prevents excessive calculations during map panning and zooming
   * 
   * @param bounds - Viewport bounds as [minLng, minLat, maxLng, maxLat]
   * 
   * @example
   * ```typescript
   * const bounds: [number, number, number, number] = [-74.1, 40.7, -73.9, 40.8];
   * await updateFogForViewport(bounds);
   * ```
   */
  const updateFogForViewport = useCallback(async (
    bounds: [number, number, number, number]
  ): Promise<void> => {
    logger.debug('Updating fog for viewport bounds', bounds);
    
    // Store current viewport bounds
    currentViewportBoundsRef.current = bounds;
    
    const fogOptions = getDefaultFogOptions(bounds);
    fogOptions.useViewportOptimization = config.useViewportOptimization;
    fogOptions.performanceMode = config.performanceMode;
    fogOptions.fallbackStrategy = config.fallbackStrategy;
    
    // Use debounced calculation for viewport updates
    debouncedCalculateFog(fogOptions, state.isViewportChanging);
  }, [debouncedCalculateFog, config, state.isViewportChanging]);
  
  /**
   * Force refresh fog from database (useful after new areas are revealed)
   * Immediately recalculates fog by reloading all revealed areas from database
   * Should be called after new locations are visited and saved to database
   * 
   * @example
   * ```typescript
   * // After saving a new revealed area to database
   * await saveRevealedArea(newArea);
   * await refreshFog(); // Update fog to reflect new area
   * ```
   */
  const refreshFog = useCallback(async (): Promise<void> => {
    logger.debug('Force refreshing fog from database');
    
    const fogOptions = getDefaultFogOptions(currentViewportBoundsRef.current || undefined);
    fogOptions.useViewportOptimization = config.useViewportOptimization;
    fogOptions.performanceMode = config.performanceMode;
    fogOptions.fallbackStrategy = config.fallbackStrategy;
    
    // Use immediate calculation for refresh
    await calculateFog(fogOptions, false);
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
    logger.debug('Clearing all fog');
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
    logger.debug('Setting viewport changing state:', changing);
    setState(prev => ({
      ...prev,
      isViewportChanging: changing
    }));
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
    setViewportChanging
  };
};

export default useFogCalculation;