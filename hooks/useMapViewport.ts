import { useCallback, useEffect, useRef, useState } from 'react';

import { logger } from '@/utils/logger';

/**
 * Viewport bounds as [minLng, minLat, maxLng, maxLat]
 * Standard bounding box format compatible with Turf.js and other geospatial libraries
 */
export type ViewportBounds = [number, number, number, number];

/**
 * Camera/viewport change event data structure
 * Contains comprehensive information about viewport state changes
 */
export interface ViewportChangeEvent {
  /** Viewport bounds as [minLng, minLat, maxLng, maxLat] */
  bounds: ViewportBounds;
  /** Current zoom level */
  zoom: number;
  /** Center coordinates as [longitude, latitude] */
  center: [number, number];
  /** Timestamp when the change occurred */
  timestamp: number;
}

/**
 * Configuration options for the viewport hook
 * Controls debouncing, validation, and change tracking behavior
 */
export interface UseMapViewportOptions {
  /** Debounce delay in milliseconds for viewport updates (default: 300ms) */
  debounceDelay?: number;
  /** Whether to track viewport change state to prevent flickering (default: true) */
  trackViewportChanges?: boolean;
  /** Minimum zoom level to consider valid (default: 0) */
  minZoom?: number;
  /** Maximum zoom level to consider valid (default: 22) */
  maxZoom?: number;
  /** Minimum bounds change threshold to trigger updates in degrees (default: 0.001) */
  boundsChangeThreshold?: number;
}

/**
 * State interface for viewport hook
 * Represents the current viewport state and metadata
 */
export interface ViewportState {
  /** Current viewport bounds, null if not yet initialized */
  bounds: ViewportBounds | null;
  /** Current zoom level */
  zoom: number;
  /** Current center coordinates as [longitude, latitude] */
  center: [number, number] | null;
  /** Whether viewport is currently changing (for preventing flickering) */
  isChanging: boolean;
  /** Timestamp of the last viewport update */
  lastUpdateTime: number;
  /** Whether viewport has been initialized with valid bounds */
  isInitialized: boolean;
}

/**
 * Return interface for the viewport hook
 * Combines viewport state with methods for controlling viewport tracking
 */
export interface UseMapViewportReturn extends ViewportState {
  /** Update viewport bounds manually (typically called from map events) */
  updateViewportBounds: (bounds: ViewportBounds, zoom?: number, center?: [number, number]) => void;
  /** Set viewport changing state manually */
  setViewportChanging: (changing: boolean) => void;
  /** Get viewport bounds as bbox array (compatible with Turf.js) */
  getViewportBbox: () => ViewportBounds | null;
  /** Check if bounds have changed significantly from last update */
  hasBoundsChanged: (newBounds: ViewportBounds) => boolean;
  /** Reset viewport state to initial values */
  resetViewport: () => void;
  /** Get current viewport bounds directly from map reference */
  getCurrentViewportBounds: (mapRef: React.RefObject<MapboxGL.MapView>) => Promise<ViewportBounds | null>;
}

/**
 * Default options for viewport hook
 */
const DEFAULT_OPTIONS: Required<UseMapViewportOptions> = {
  debounceDelay: 300,
  trackViewportChanges: true,
  minZoom: 0,
  maxZoom: 22,
  boundsChangeThreshold: 0.001 // ~100m at equator
};

/**
 * Validates viewport bounds
 * Checks that bounds are finite numbers within valid geographic ranges
 * 
 * @param bounds - Viewport bounds to validate
 * @returns True if bounds are valid, false otherwise
 * 
 * @internal
 */
const validateBounds = (bounds: ViewportBounds): boolean => {
  const [minLng, minLat, maxLng, maxLat] = bounds;
  
  // Check if all values are finite numbers
  if (!bounds.every(val => typeof val === 'number' && isFinite(val))) {
    try {
      logger?.warn?.('Invalid bounds: contains non-finite values', bounds);
    } catch (error) {
      // Fallback if logger is not available
      console.warn('Invalid bounds: contains non-finite values', bounds);
    }
    return false;
  }
  
  // Check longitude range
  if (minLng < -180 || minLng > 180 || maxLng < -180 || maxLng > 180) {
    try {
      logger?.warn?.('Invalid bounds: longitude out of range', bounds);
    } catch (error) {
      console.warn('Invalid bounds: longitude out of range', bounds);
    }
    return false;
  }
  
  // Check latitude range
  if (minLat < -90 || minLat > 90 || maxLat < -90 || maxLat > 90) {
    try {
      logger?.warn?.('Invalid bounds: latitude out of range', bounds);
    } catch (error) {
      console.warn('Invalid bounds: latitude out of range', bounds);
    }
    return false;
  }
  
  // Check bounds order
  if (minLng >= maxLng || minLat >= maxLat) {
    try {
      logger?.warn?.('Invalid bounds: min values must be less than max values', bounds);
    } catch (error) {
      console.warn('Invalid bounds: min values must be less than max values', bounds);
    }
    return false;
  }
  
  return true;
};

/**
 * Calculates the distance between two bounds in degrees
 * Computes Euclidean distance between the centers of two bounding boxes
 * 
 * @param bounds1 - First bounding box
 * @param bounds2 - Second bounding box
 * @returns Distance between bounds centers in degrees
 * 
 * @internal
 */
const calculateBoundsDistance = (bounds1: ViewportBounds, bounds2: ViewportBounds): number => {
  const [minLng1, minLat1, maxLng1, maxLat1] = bounds1;
  const [minLng2, minLat2, maxLng2, maxLat2] = bounds2;
  
  const centerLng1 = (minLng1 + maxLng1) / 2;
  const centerLat1 = (minLat1 + maxLat1) / 2;
  const centerLng2 = (minLng2 + maxLng2) / 2;
  const centerLat2 = (minLat2 + maxLat2) / 2;
  
  const lngDiff = Math.abs(centerLng1 - centerLng2);
  const latDiff = Math.abs(centerLat1 - centerLat2);
  
  return Math.sqrt(lngDiff * lngDiff + latDiff * latDiff);
};

/**
 * Custom hook for managing map viewport state and bounds calculation
 * Provides debounced viewport tracking with validation and change detection
 * Handles viewport bounds updates from map interactions with proper cleanup
 * 
 * @param options - Configuration options for viewport tracking behavior
 * @returns Object containing viewport state and methods for controlling viewport tracking
 * 
 * @example
 * ```typescript
 * const {
 *   bounds,
 *   isChanging,
 *   updateViewportBounds,
 *   getCurrentViewportBounds
 * } = useMapViewport({
 *   debounceDelay: 300,
 *   trackViewportChanges: true,
 *   boundsChangeThreshold: 0.001
 * });
 * 
 * // In map event handler
 * const handleCameraChanged = async () => {
 *   const newBounds = await getCurrentViewportBounds(mapRef);
 *   if (newBounds) {
 *     updateViewportBounds(newBounds);
 *   }
 * };
 * ```
 */
export const useMapViewport = (
  options: UseMapViewportOptions = {}
): UseMapViewportReturn => {
  const config = { ...DEFAULT_OPTIONS, ...options };
  
  // State management
  const [state, setState] = useState<ViewportState>({
    bounds: null,
    zoom: 10,
    center: null,
    isChanging: false,
    lastUpdateTime: 0,
    isInitialized: false
  });
  
  // Refs for managing debouncing and cleanup
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isUnmountedRef = useRef(false);
  const lastBoundsRef = useRef<ViewportBounds | null>(null);
  
  /**
   * Internal function to update viewport state
   * Validates bounds and updates state with proper error handling
   * 
   * @param bounds - New viewport bounds
   * @param zoom - New zoom level (optional)
   * @param center - New center coordinates (optional, calculated if not provided)
   * 
   * @internal
   */
  const updateViewportState = useCallback((
    bounds: ViewportBounds,
    zoom: number = state.zoom,
    center: [number, number] | null = null
  ) => {
    if (isUnmountedRef.current) {
      try {
        logger?.debug?.('Component unmounted, skipping viewport update');
      } catch (error) {
        // Fallback if logger is not available
      }
      return;
    }
    
    // Validate bounds
    if (!validateBounds(bounds)) {
      try {
        logger?.error?.('Invalid viewport bounds provided:', bounds);
      } catch (error) {
        console.error('Invalid viewport bounds provided:', bounds);
      }
      return;
    }
    
    // Validate zoom level
    if (zoom < config.minZoom || zoom > config.maxZoom) {
      try {
        logger?.warn?.(`Zoom level ${zoom} outside valid range [${config.minZoom}, ${config.maxZoom}]`);
      } catch (error) {
        console.warn(`Zoom level ${zoom} outside valid range [${config.minZoom}, ${config.maxZoom}]`);
      }
      zoom = Math.max(config.minZoom, Math.min(config.maxZoom, zoom));
    }
    
    // Calculate center if not provided
    if (!center) {
      const [minLng, minLat, maxLng, maxLat] = bounds;
      center = [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
    }
    
    const timestamp = Date.now();
    
    try {
      setState(prev => ({
        ...prev,
        bounds,
        zoom,
        center,
        lastUpdateTime: timestamp,
        isInitialized: true
      }));
      
      // Store last bounds for comparison
      lastBoundsRef.current = bounds;
    } catch (error) {
      try {
        logger?.error?.('Error updating viewport state:', error);
      } catch (logError) {
        console.error('Error updating viewport state:', error);
      }
    }
    

  }, [state.zoom, config.minZoom, config.maxZoom]);
  
  /**
   * Debounced viewport update to prevent excessive updates
   * Delays viewport state updates to avoid performance issues during rapid map interactions
   * Sets changing state during debounce period if tracking is enabled
   * 
   * @param bounds - New viewport bounds
   * @param zoom - New zoom level (optional)
   * @param center - New center coordinates (optional)
   * 
   * @internal
   */
  const debouncedUpdateViewport = useCallback((
    bounds: ViewportBounds,
    zoom?: number,
    center?: [number, number]
  ) => {
    // Clear existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    // Set viewport changing state if tracking is enabled
    if (config.trackViewportChanges) {
      setState(prev => ({
        ...prev,
        isChanging: true
      }));
    }
    
    // Set new timeout
    debounceTimeoutRef.current = setTimeout(() => {
      updateViewportState(bounds, zoom, center);
      
      // Clear changing state after update
      if (config.trackViewportChanges) {
        setState(prev => ({
          ...prev,
          isChanging: false
        }));
      }
    }, config.debounceDelay);
  }, [updateViewportState, config.debounceDelay, config.trackViewportChanges]);
  
  /**
   * Updates viewport bounds manually (typically called from map events)
   * Triggers debounced viewport state update with validation
   * Should be called from map camera change events
   * 
   * @param bounds - New viewport bounds from map
   * @param zoom - New zoom level (optional)
   * @param center - New center coordinates (optional)
   * 
   * @example
   * ```typescript
   * const handleCameraChanged = (event) => {
   *   const bounds = event.visibleBounds;
   *   updateViewportBounds(bounds, event.zoom);
   * };
   * ```
   */
  const updateViewportBounds = useCallback((
    bounds: ViewportBounds,
    zoom?: number,
    center?: [number, number]
  ): void => {
    // Use debounced update to prevent excessive updates during map interactions
    debouncedUpdateViewport(bounds, zoom, center);
  }, [debouncedUpdateViewport]);
  
  /**
   * Sets viewport changing state manually
   * Controls the changing state independently of debounced updates
   * Useful for coordinating with other components that need to know about viewport changes
   * 
   * @param changing - True if viewport is changing, false when stable
   * 
   * @example
   * ```typescript
   * const handleMapMoveStart = () => setViewportChanging(true);
   * const handleMapMoveEnd = () => setViewportChanging(false);
   * ```
   */
  const setViewportChanging = useCallback((changing: boolean): void => {
    setState(prev => ({
      ...prev,
      isChanging: changing
    }));
    
    // If setting to false and there's a pending debounced update, let it complete
    if (!changing && debounceTimeoutRef.current) {
      // Don't clear the timeout, let it complete naturally
    }
  }, []);
  
  /**
   * Gets viewport bounds as bbox array (compatible with Turf.js)
   * Returns current viewport bounds in standard bbox format
   * 
   * @returns Current viewport bounds or null if not initialized
   * 
   * @example
   * ```typescript
   * const bbox = getViewportBbox();
   * if (bbox) {
   *   const viewportPolygon = turf.bboxPolygon(bbox);
   * }
   * ```
   */
  const getViewportBbox = useCallback((): ViewportBounds | null => {
    return state.bounds;
  }, [state.bounds]);
  
  /**
   * Checks if bounds have changed significantly
   * Compares new bounds with last known bounds using configured threshold
   * Helps prevent unnecessary updates for minor viewport changes
   * 
   * @param newBounds - New bounds to compare against current bounds
   * @returns True if bounds have changed significantly, false otherwise
   * 
   * @example
   * ```typescript
   * if (hasBoundsChanged(newBounds)) {
   *   // Trigger expensive operations only for significant changes
   *   updateFogForViewport(newBounds);
   * }
   * ```
   */
  const hasBoundsChanged = useCallback((newBounds: ViewportBounds): boolean => {
    if (!lastBoundsRef.current) {
      return true; // First bounds update
    }
    
    const distance = calculateBoundsDistance(lastBoundsRef.current, newBounds);
    const hasChanged = distance > config.boundsChangeThreshold;
    
    return hasChanged;
  }, [config.boundsChangeThreshold]);
  
  /**
   * Resets viewport state to initial values
   * Clears all viewport data and cancels any pending debounced updates
   * Useful for reinitializing viewport tracking
   * 
   * @example
   * ```typescript
   * // When switching to a different map or resetting the view
   * resetViewport();
   * ```
   */
  const resetViewport = useCallback((): void => {
    try {
      logger?.debug?.('Resetting viewport state');
    } catch (error) {
      // Fallback if logger is not available
    }
    
    // Clear any pending debounced updates
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }
    
    setState({
      bounds: null,
      zoom: 10,
      center: null,
      isChanging: false,
      lastUpdateTime: 0,
      isInitialized: false
    });
    
    lastBoundsRef.current = null;
  }, []);

  /**
   * Gets the current viewport bounds from the map camera.
   * Returns bounds in the format [minLng, minLat, maxLng, maxLat].
   * 
   * @param mapRef - Reference to the MapboxGL.MapView component
   * @returns Promise resolving to viewport bounds or null if unavailable
   */
  const getCurrentViewportBounds = useCallback(async (
    mapRef: React.RefObject<MapboxGL.MapView>
  ): Promise<ViewportBounds | null> => {
    if (!mapRef.current) {
      try {
        logger?.debug?.('Map ref not available for viewport bounds');
      } catch (error) {
        // Fallback if logger is not available
      }
      return null;
    }

    try {
      const visibleBounds = await mapRef.current.getVisibleBounds();
      if (visibleBounds && visibleBounds.length === 2) {
        // visibleBounds returns [[southWest], [northEast]] = [[minLng, minLat], [maxLng, maxLat]]
        const [[minLng, minLat], [maxLng, maxLat]] = visibleBounds;
        
        // Ensure proper ordering (sometimes the bounds can be flipped)
        const actualMinLng = Math.min(minLng, maxLng);
        const actualMaxLng = Math.max(minLng, maxLng);
        const actualMinLat = Math.min(minLat, maxLat);
        const actualMaxLat = Math.max(minLat, maxLat);
        
        const bounds: ViewportBounds = [actualMinLng, actualMinLat, actualMaxLng, actualMaxLat];
        
        // Validate bounds before returning
        if (!validateBounds(bounds)) {
          return null;
        }
        
        return bounds;
      }
    } catch (error) {
      try {
        logger?.error?.('Error getting viewport bounds:', error);
      } catch (logError) {
        console.error('Error getting viewport bounds:', error);
      }
    }
    
    return null;
  }, []);
  
  // Cleanup effect
  useEffect(() => {
    return () => {
      isUnmountedRef.current = true;
      
      // Clear any pending timeouts
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
      }
    };
  }, []);
  
  // Effect to handle viewport changing timeout
  useEffect(() => {
    if (state.isChanging && config.trackViewportChanges) {
      // Set a maximum timeout for viewport changing state
      const maxChangeTimeout = setTimeout(() => {
        if (!isUnmountedRef.current) {
          setState(prev => ({
            ...prev,
            isChanging: false
          }));
        }
      }, config.debounceDelay * 3); // 3x debounce delay as maximum
      
      return () => {
        clearTimeout(maxChangeTimeout);
      };
    }
  }, [state.isChanging, config.trackViewportChanges, config.debounceDelay]);
  
  return {
    ...state,
    updateViewportBounds,
    setViewportChanging,
    getViewportBbox,
    hasBoundsChanged,
    resetViewport,
    getCurrentViewportBounds
  };
};

export default useMapViewport;