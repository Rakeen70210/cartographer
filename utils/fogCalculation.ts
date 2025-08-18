import { bboxPolygon } from '@turf/turf';
import { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson';

import { performRobustDifference } from '@/utils/geometryOperations';
import {
    GeometryComplexity,
    getPolygonComplexity,
    RevealedArea
} from '@/utils/geometryValidation';
import { logger } from '@/utils/logger';

/**
 * Calculate execution time with fallback for test environments
 * Ensures timing is always a positive value, even in fast test environments
 * 
 * @param startTime - The start time from performance.now()
 * @returns Execution time in milliseconds, guaranteed to be > 0
 */
const calculateExecutionTime = (startTime: number): number => {
  const rawTime = performance.now() - startTime;
  // Ensure we always return a positive value, even in test environments
  // where operations might be too fast to measure accurately
  return Math.max(0.001, rawTime) || 0.001;
};

/**
 * Configuration options for fog calculation operations
 * Controls how fog is calculated, optimized, and handled in error scenarios
 */
export interface FogCalculationOptions {
  /** Viewport bounds as [minLng, minLat, maxLng, maxLat] for viewport-based optimization */
  viewportBounds?: [number, number, number, number];
  /** Buffer distance for revealed areas (currently unused, reserved for future use) */
  bufferDistance?: number;
  /** Whether to use viewport-based optimization to improve performance */
  useViewportOptimization: boolean;
  /** Performance mode affecting calculation accuracy vs speed trade-offs */
  performanceMode: 'fast' | 'accurate';
  /** Strategy to use when primary fog calculation fails */
  fallbackStrategy: 'viewport' | 'world' | 'none';
}

/**
 * Performance metrics collected during fog calculation operations
 * Used for monitoring, optimization, and debugging fog calculation performance
 */
export interface FogCalculationMetrics {
  /** Complexity analysis of the resulting fog geometry */
  geometryComplexity: GeometryComplexity;
  /** Type of fog calculation performed */
  operationType: 'viewport' | 'world';
  /** Whether any errors occurred during calculation */
  hadErrors: boolean;
  /** Whether a fallback strategy was used */
  fallbackUsed: boolean;
  /** Total execution time in milliseconds */
  executionTime: number;
  /** Performance classification based on execution time */
  performanceLevel: 'FAST' | 'MODERATE' | 'SLOW';
}

/**
 * Complete result of fog calculation including geometry, metrics, and diagnostic information
 * Contains everything needed to render fog and analyze calculation performance
 */
export interface FogCalculationResult {
  /** GeoJSON feature collection containing fog polygon(s) ready for rendering */
  fogGeoJSON: FeatureCollection<Polygon | MultiPolygon>;
  /** Total calculation time in milliseconds */
  calculationTime: number;
  /** Detailed performance and diagnostic metrics */
  performanceMetrics: FogCalculationMetrics;
  /** Array of error messages encountered during calculation */
  errors: string[];
  /** Array of warning messages about potential issues */
  warnings: string[];
}

/**
 * Creates a world-wide fog polygon for fallback scenarios
 * Generates a polygon covering the entire world (-180 to 180 longitude, -90 to 90 latitude)
 * Used when viewport-based fog calculation fails or is not available
 * 
 * @returns A GeoJSON Feature containing a world-covering polygon
 * 
 * @example
 * ```typescript
 * const worldFog = createWorldFogPolygon();
 * // Use when all other fog calculation methods fail
 * ```
 */
export const createWorldFogPolygon = (): Feature<Polygon> => {
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [-180, -90],
          [-180, 90],
          [180, 90],
          [180, -90],
          [-180, -90],
        ],
      ],
    },
  };
};

/**
 * Creates a world fog feature collection for immediate display
 * Wraps the world fog polygon in a FeatureCollection for direct use with map rendering
 * 
 * @returns A GeoJSON FeatureCollection containing the world fog polygon
 * 
 * @example
 * ```typescript
 * const fogCollection = createWorldFogCollection();
 * // Ready to use with MapboxGL.ShapeSource
 * ```
 */
export const createWorldFogCollection = (): FeatureCollection<Polygon | MultiPolygon> => {
  return {
    type: 'FeatureCollection',
    features: [createWorldFogPolygon()],
  };
};

/**
 * Creates a viewport-sized fog polygon instead of world-wide polygon
 * Generates a polygon covering only the current viewport bounds for better performance
 * Validates bounds and ensures proper coordinate ordering
 * 
 * @param bounds - Viewport bounds as [minLng, minLat, maxLng, maxLat]
 * @returns A GeoJSON Feature containing a viewport-covering polygon
 * @throws Error if bounds are invalid or out of valid geographic range
 * 
 * @example
 * ```typescript
 * const viewportBounds: [number, number, number, number] = [-74.1, 40.7, -73.9, 40.8];
 * const viewportFog = createViewportFogPolygon(viewportBounds);
 * ```
 */
export const createViewportFogPolygon = (bounds: [number, number, number, number]): Feature<Polygon> => {
  const [minLng, minLat, maxLng, maxLat] = bounds;
  
  // Validate bounds
  if (minLng >= maxLng || minLat >= maxLat) {
    throw new Error(`Invalid viewport bounds: [${minLng}, ${minLat}, ${maxLng}, ${maxLat}]`);
  }
  
  if (minLng < -180 || maxLng > 180 || minLat < -90 || maxLat > 90) {
    throw new Error(`Viewport bounds out of valid range: [${minLng}, ${minLat}, ${maxLng}, ${maxLat}]`);
  }
  
  // Create a polygon from the bounding box
  const viewportPolygon = bboxPolygon(bounds);
  
  logger.debugThrottled('Created viewport fog polygon', 2000);
  
  return viewportPolygon;
};

/**
 * Filters revealed areas to only include those within or intersecting the viewport
 * Performs bounding box intersection test to determine if revealed areas are relevant to current viewport
 * Optimizes fog calculation by excluding distant revealed areas
 * 
 * @param revealedAreas - The revealed areas to filter
 * @param viewportBounds - Current viewport bounds as [minLng, minLat, maxLng, maxLat]
 * @returns The revealed areas if they intersect the viewport, null if no intersection
 * 
 * @example
 * ```typescript
 * const relevantAreas = getRevealedAreasInViewport(allRevealedAreas, currentViewport);
 * if (relevantAreas) {
 *   // Use filtered areas for fog calculation
 * }
 * ```
 */
export const getRevealedAreasInViewport = (
  revealedAreas: RevealedArea, 
  viewportBounds: [number, number, number, number]
): RevealedArea | null => {
  if (!revealedAreas) {
    return null;
  }

  const [minLng, minLat, maxLng, maxLat] = viewportBounds;
  
  try {
    // Quick bounding box check to see if revealed areas might intersect viewport
    let revealedMinLng = Infinity, revealedMaxLng = -Infinity;
    let revealedMinLat = Infinity, revealedMaxLat = -Infinity;
    
    if (revealedAreas.geometry.type === 'Polygon') {
      const revealedCoords = revealedAreas.geometry.coordinates[0];
      revealedCoords.forEach(coord => {
        revealedMinLng = Math.min(revealedMinLng, coord[0]);
        revealedMaxLng = Math.max(revealedMaxLng, coord[0]);
        revealedMinLat = Math.min(revealedMinLat, coord[1]);
        revealedMaxLat = Math.max(revealedMaxLat, coord[1]);
      });
    } else if (revealedAreas.geometry.type === 'MultiPolygon') {
      revealedAreas.geometry.coordinates.forEach(polygon => {
        polygon.forEach(ring => {
          ring.forEach(coord => {
            revealedMinLng = Math.min(revealedMinLng, coord[0]);
            revealedMaxLng = Math.max(revealedMaxLng, coord[0]);
            revealedMinLat = Math.min(revealedMinLat, coord[1]);
            revealedMaxLat = Math.max(revealedMaxLat, coord[1]);
          });
        });
      });
    }
    
    // Check if bounding boxes overlap - use more lenient overlap check
    // Allow for small margins to account for floating point precision
    const margin = 0.0001; // Small margin for floating point precision
    const overlaps = !(revealedMaxLng < (minLng - margin) || 
                      revealedMinLng > (maxLng + margin) ||
                      revealedMaxLat < (minLat - margin) || 
                      revealedMinLat > (maxLat + margin));
    
    if (overlaps) {
      logger.debugThrottled('Revealed areas intersect with viewport', 2000);
      return revealedAreas;
    } else {
      logger.debugThrottled('No revealed areas in current viewport', 2000);
      return null;
    }
  } catch (error) {
    logger.error('Error filtering revealed areas for viewport:', error);
    return revealedAreas; // Return all revealed areas as fallback
  }
};

/**
 * Calculates viewport-based fog with revealed areas
 * Primary fog calculation function that creates fog by subtracting revealed areas from viewport
 * Includes comprehensive error handling, performance monitoring, and intelligent caching
 * 
 * @param revealedAreas - Previously revealed areas to subtract from fog, or null if none
 * @param options - Configuration options for the fog calculation
 * @param useCache - Whether to use caching for this calculation (default: true)
 * @returns Complete fog calculation result with geometry, metrics, and diagnostic information
 * 
 * @example
 * ```typescript
 * const options: FogCalculationOptions = {
 *   viewportBounds: [-74.1, 40.7, -73.9, 40.8],
 *   useViewportOptimization: true,
 *   performanceMode: 'accurate',
 *   fallbackStrategy: 'viewport'
 * };
 * const result = calculateViewportFog(revealedAreas, options);
 * ```
 */
export const calculateViewportFog = (
  revealedAreas: RevealedArea | null,
  options: FogCalculationOptions,
  useCache: boolean = true
): FogCalculationResult => {
  const startTime = performance.now();
  const errors: string[] = [];
  const warnings: string[] = [];
  let fallbackUsed = false;

  // Check cache first if enabled and viewport bounds are available
  if (useCache && options.viewportBounds) {
    try {
      const cacheManager = getGlobalFogCacheManager();
      const cachedResult = cacheManager.getCachedFog(options.viewportBounds, revealedAreas);
      
      if (cachedResult) {
        const cacheHitTime = calculateExecutionTime(startTime);
        
        logger.debugThrottled(
          `Fog calculation cache hit (saved ${cachedResult.calculationTime.toFixed(2)}ms)`,
          5000
        );
        
        return {
          fogGeoJSON: cachedResult.fogGeoJSON,
          calculationTime: cacheHitTime,
          performanceMetrics: {
            geometryComplexity: getPolygonComplexity(cachedResult.fogGeoJSON.features[0] || createViewportFogPolygon(options.viewportBounds)),
            operationType: 'viewport',
            hadErrors: false,
            fallbackUsed: false,
            executionTime: cacheHitTime,
            performanceLevel: 'FAST'
          },
          errors: [],
          warnings: ['Using cached fog calculation result']
        };
      }
    } catch (cacheError) {
      logger.warn('Error checking fog cache, proceeding with calculation:', cacheError);
      warnings.push('Cache lookup failed, performing fresh calculation');
    }
  }
  

  
  // Validate viewport bounds
  if (!options.viewportBounds) {
    errors.push('No viewport bounds provided for viewport fog calculation');
    return createFallbackFogResult(startTime, errors, warnings, options, true);
  }
  
  try {
    // Create viewport fog polygon
    const baseFogPolygon = createViewportFogPolygon(options.viewportBounds);
    
    // If there are no revealed areas, return the base fog polygon
    if (!revealedAreas) {
      const executionTime = calculateExecutionTime(startTime);
      logger.debugOnce('No revealed areas - returning full viewport fog');
      
      return {
        fogGeoJSON: {
          type: 'FeatureCollection',
          features: [baseFogPolygon],
        },
        calculationTime: executionTime,
        performanceMetrics: {
          geometryComplexity: getPolygonComplexity(baseFogPolygon),
          operationType: 'viewport',
          hadErrors: false,
          fallbackUsed: false,
          executionTime,
          performanceLevel: executionTime > 100 ? 'SLOW' : executionTime > 50 ? 'MODERATE' : 'FAST'
        },
        errors,
        warnings: [...warnings, 'No revealed areas found - showing full fog coverage']
      };
    }
    
    // Filter revealed areas to viewport if optimization is enabled
    let relevantRevealedAreas: RevealedArea | null = revealedAreas;
    
    if (options.useViewportOptimization && revealedAreas) {
      const filterStartTime = performance.now();
      relevantRevealedAreas = getRevealedAreasInViewport(revealedAreas, options.viewportBounds);
      const filterTime = performance.now() - filterStartTime;
      
      if (!relevantRevealedAreas) {
        const executionTime = calculateExecutionTime(startTime);
        logger.debugThrottled('No revealed areas in current viewport after filtering', 3000);
        
        return {
          fogGeoJSON: {
            type: 'FeatureCollection',
            features: [baseFogPolygon],
          },
          calculationTime: executionTime,
          performanceMetrics: {
            geometryComplexity: getPolygonComplexity(baseFogPolygon),
            operationType: 'viewport',
            hadErrors: false,
            fallbackUsed: false,
            executionTime,
            performanceLevel: executionTime > 100 ? 'SLOW' : executionTime > 50 ? 'MODERATE' : 'FAST'
          },
          errors,
          warnings: [...warnings, 'No revealed areas in viewport']
        };
      }
    }
    
    // Perform robust difference operation
    const differenceResult = performRobustDifference(baseFogPolygon, relevantRevealedAreas);
    
    errors.push(...differenceResult.errors);
    warnings.push(...differenceResult.warnings);
    fallbackUsed = differenceResult.metrics.fallbackUsed;
    
    const executionTime = calculateExecutionTime(startTime);
    
    let result: FogCalculationResult;
    
    if (differenceResult.result) {
      result = {
        fogGeoJSON: {
          type: 'FeatureCollection',
          features: [differenceResult.result],
        },
        calculationTime: executionTime,
        performanceMetrics: {
          geometryComplexity: differenceResult.metrics.outputComplexity || getPolygonComplexity(baseFogPolygon),
          operationType: 'viewport',
          hadErrors: differenceResult.metrics.hadErrors,
          fallbackUsed,
          executionTime,
          performanceLevel: executionTime > 100 ? 'SLOW' : executionTime > 50 ? 'MODERATE' : 'FAST'
        },
        errors,
        warnings
      };
    } else {
      logger.warn('Difference operation failed, showing full viewport fog as fallback');
      warnings.push('Difference operation failed - showing full fog coverage');
      
      // When difference fails, show the full viewport fog instead of empty
      // This is better UX than showing no fog at all
      result = {
        fogGeoJSON: {
          type: 'FeatureCollection',
          features: [baseFogPolygon],
        },
        calculationTime: executionTime,
        performanceMetrics: {
          geometryComplexity: getPolygonComplexity(baseFogPolygon),
          operationType: 'viewport',
          hadErrors: true,
          fallbackUsed: true,
          executionTime,
          performanceLevel: executionTime > 100 ? 'SLOW' : executionTime > 50 ? 'MODERATE' : 'FAST'
        },
        errors,
        warnings
      };
    }
    
    // Cache the result if caching is enabled and calculation was successful
    if (useCache && options.viewportBounds && !result.performanceMetrics.hadErrors) {
      try {
        const cacheManager = getGlobalFogCacheManager();
        cacheManager.cacheFogResult(options.viewportBounds, revealedAreas, result);
        
        logger.debugThrottled(
          `Cached fog calculation result (${executionTime.toFixed(2)}ms)`,
          5000
        );
      } catch (cacheError) {
        logger.warn('Error caching fog calculation result:', cacheError);
        // Don't fail the calculation due to cache errors
      }
    }
    
    return result;
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error in viewport fog calculation:', error);
    errors.push(`Viewport fog calculation error: ${errorMessage}`);
    
    return createFallbackFogResult(startTime, errors, warnings, options, true);
  }
};

/**
 * Calculates simplified fog for fallback scenarios
 * Creates basic fog polygon without complex geometry operations
 * Used when primary fog calculation fails or for emergency fallback
 * 
 * @param viewportBounds - Optional viewport bounds; if provided, creates viewport fog, otherwise world fog
 * @returns Simplified fog calculation result with basic polygon geometry
 * 
 * @example
 * ```typescript
 * // Viewport-based simplified fog
 * const simpleFog = calculateSimplifiedFog(viewportBounds);
 * 
 * // World-based simplified fog
 * const worldFog = calculateSimplifiedFog();
 * ```
 */
export const calculateSimplifiedFog = (
  viewportBounds?: [number, number, number, number]
): FogCalculationResult => {
  const startTime = performance.now();
  const errors: string[] = [];
  const warnings: string[] = ['Using simplified fog calculation'];
  
  logger.debugOnce('Creating simplified fog');
  
  try {
    let fogPolygon: Feature<Polygon>;
    
    if (viewportBounds) {
      fogPolygon = createViewportFogPolygon(viewportBounds);
      logger.debugThrottled('Created simplified viewport fog', 3000);
    } else {
      fogPolygon = createWorldFogPolygon();
      logger.debugOnce('Created simplified world fog');
    }
    
    const executionTime = calculateExecutionTime(startTime);
    
    return {
      fogGeoJSON: {
        type: 'FeatureCollection',
        features: [fogPolygon],
      },
      calculationTime: executionTime,
      performanceMetrics: {
        geometryComplexity: getPolygonComplexity(fogPolygon),
        operationType: viewportBounds ? 'viewport' : 'world',
        hadErrors: false,
        fallbackUsed: true,
        executionTime,
        performanceLevel: 'FAST'
      },
      errors,
      warnings
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error in simplified fog calculation:', error);
    errors.push(`Simplified fog calculation error: ${errorMessage}`);
    
    // Final fallback to world fog
    const executionTime = calculateExecutionTime(startTime);
    const worldFog = createWorldFogPolygon();
    
    return {
      fogGeoJSON: {
        type: 'FeatureCollection',
        features: [worldFog],
      },
      calculationTime: executionTime,
      performanceMetrics: {
        geometryComplexity: getPolygonComplexity(worldFog),
        operationType: 'world',
        hadErrors: true,
        fallbackUsed: true,
        executionTime,
        performanceLevel: 'FAST'
      },
      errors,
      warnings: [...warnings, 'Using world fog as final fallback']
    };
  }
};

/**
 * Progressive fallback strategy for fog calculation
 * Implements a multi-tier approach: viewport fog → simplified fog → world fog
 * Ensures fog is always available even when complex calculations fail
 * Includes intelligent caching to improve performance for repeated calculations
 * 
 * @param revealedAreas - Previously revealed areas to subtract from fog, or null if none
 * @param options - Configuration options including fallback strategy
 * @param useCache - Whether to use caching for this calculation (default: true)
 * @returns Fog calculation result, guaranteed to contain valid fog geometry
 * 
 * @example
 * ```typescript
 * const options: FogCalculationOptions = {
 *   viewportBounds: currentBounds,
 *   useViewportOptimization: true,
 *   performanceMode: 'accurate',
 *   fallbackStrategy: 'viewport'
 * };
 * 
 * // This will always return valid fog, using fallbacks if needed
 * const fogResult = createFogWithFallback(revealedAreas, options);
 * ```
 */
export const createFogWithFallback = (
  revealedAreas: RevealedArea | null,
  options: FogCalculationOptions,
  useCache: boolean = true
): FogCalculationResult => {
  const overallStartTime = performance.now();
  let viewportCalculationAttempted = false;
  
  try {
    // Primary: Viewport-based fog with revealed areas (if viewport bounds available)
    if (options.useViewportOptimization && options.viewportBounds) {
      viewportCalculationAttempted = true;
      const result = calculateViewportFog(revealedAreas, options, useCache);
      
      // If successful and no critical errors, return result
      // Allow warnings but not errors
      if (!result.performanceMetrics.hadErrors) {
        return result;
      }
      
      logger.warn('Viewport fog calculation had errors, trying fallback');
    }
    
    // Secondary: Simplified viewport fog (if viewport bounds available)
    if (options.viewportBounds) {
      viewportCalculationAttempted = true;
      logger.warn('Primary fog calculation failed, trying simplified viewport approach');
      
      try {
        const fallbackResult = calculateSimplifiedFog(options.viewportBounds);
        fallbackResult.warnings.push('Used simplified viewport fog as fallback');
        return fallbackResult;
      } catch (fallbackError) {
        logger.error('Simplified viewport fog calculation failed:', fallbackError);
      }
    }
    
    // Tertiary: World fog as final fallback (only if no viewport bounds or all viewport methods failed)
    if (options.fallbackStrategy === 'world' || 
        (options.fallbackStrategy === 'viewport' && viewportCalculationAttempted)) {
      
      logger.warn('Using world fog as final fallback');
      
      const worldResult = calculateSimplifiedFog(); // No viewport bounds = world fog
      worldResult.warnings.push('Used world fog as final fallback');
      worldResult.performanceMetrics.hadErrors = viewportCalculationAttempted;
      
      return worldResult;
    }
    
    // If no fallback strategy and no viewport bounds, still provide world fog but mark as error
    if (!options.viewportBounds && options.fallbackStrategy === 'none') {
      logger.warn('No viewport bounds available and no fallback strategy, using emergency world fog');
      const worldResult = calculateSimplifiedFog();
      worldResult.warnings.push('Used emergency world fog (no viewport bounds, no fallback strategy)');
      worldResult.performanceMetrics.hadErrors = true; // Mark as error since no fallback strategy was specified
      return worldResult;
    } else if (!options.viewportBounds) {
      logger.warn('No viewport bounds available, using world fog');
      const worldResult = calculateSimplifiedFog();
      worldResult.warnings.push('Used world fog (no viewport bounds available)');
      return worldResult;
    }
    
    // No fallback strategy and viewport methods failed
    logger.error('Fog calculation failed and no fallback strategy specified');
    throw new Error('Fog calculation failed and no fallback strategy available');
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Critical error in fog calculation with fallback:', error);
    
    // Emergency fallback - prefer viewport if bounds available, otherwise world fog
    const executionTime = performance.now() - overallStartTime;
    let emergencyFog: Feature<Polygon>;
    let operationType: 'viewport' | 'world';
    
    if (options.viewportBounds) {
      try {
        emergencyFog = createViewportFogPolygon(options.viewportBounds);
        operationType = 'viewport';
      } catch (viewportError) {
        emergencyFog = createWorldFogPolygon();
        operationType = 'world';
      }
    } else {
      emergencyFog = createWorldFogPolygon();
      operationType = 'world';
    }
    
    return {
      fogGeoJSON: {
        type: 'FeatureCollection',
        features: [emergencyFog],
      },
      calculationTime: executionTime,
      performanceMetrics: {
        geometryComplexity: getPolygonComplexity(emergencyFog),
        operationType,
        hadErrors: true,
        fallbackUsed: true,
        executionTime,
        performanceLevel: 'FAST'
      },
      errors: [`Critical fog calculation error: ${errorMessage}`],
      warnings: [`Emergency fallback to ${operationType} fog`]
    };
  }
};

/**
 * Helper function to create fallback fog result
 * Internal utility for generating consistent fallback fog results with proper metrics
 * 
 * @param startTime - Calculation start time for performance measurement
 * @param errors - Array of error messages to include in result
 * @param warnings - Array of warning messages to include in result
 * @param options - Original fog calculation options
 * @param hadErrors - Whether errors occurred during calculation
 * @returns Fallback fog calculation result with appropriate geometry and metrics
 * 
 * @internal
 */
const createFallbackFogResult = (
  startTime: number,
  errors: string[],
  warnings: string[],
  options: FogCalculationOptions,
  hadErrors: boolean
): FogCalculationResult => {
  logger.debugThrottled('Creating fallback fog result', 2000);
  
  try {
    let fogPolygon: Feature<Polygon>;
    let operationType: 'viewport' | 'world';
    
    // Always prefer viewport fog if bounds are available, regardless of fallback strategy
    if (options.viewportBounds) {
      try {
        fogPolygon = createViewportFogPolygon(options.viewportBounds);
        operationType = 'viewport';
        warnings.push('Using viewport fog as fallback');
      } catch (viewportError) {
        logger.warn('Viewport fog creation failed in fallback, using world fog:', viewportError);
        fogPolygon = createWorldFogPolygon();
        operationType = 'world';
        warnings.push('Using world fog as fallback after viewport failure');
      }
    } else {
      fogPolygon = createWorldFogPolygon();
      operationType = 'world';
      warnings.push('Using world fog as fallback (no viewport bounds)');
    }
    
    const executionTime = calculateExecutionTime(startTime);
    
    return {
      fogGeoJSON: {
        type: 'FeatureCollection',
        features: [fogPolygon],
      },
      calculationTime: executionTime,
      performanceMetrics: {
        geometryComplexity: getPolygonComplexity(fogPolygon),
        operationType,
        hadErrors,
        fallbackUsed: true,
        executionTime,
        performanceLevel: 'FAST'
      },
      errors,
      warnings
    };
    
  } catch (fallbackError) {
    logger.error('Fallback fog creation failed:', fallbackError);
    
    // Emergency world fog
    const executionTime = calculateExecutionTime(startTime);
    const worldFog = createWorldFogPolygon();
    
    return {
      fogGeoJSON: {
        type: 'FeatureCollection',
        features: [worldFog],
      },
      calculationTime: executionTime,
      performanceMetrics: {
        geometryComplexity: getPolygonComplexity(worldFog),
        operationType: 'world',
        hadErrors: true,
        fallbackUsed: true,
        executionTime,
        performanceLevel: 'FAST'
      },
      errors: [...errors, 'Fallback fog creation failed'],
      warnings: [...warnings, 'Emergency world fog used']
    };
  }
};

/**
 * Creates fog overlay features based on revealed areas with robust viewport-based difference operation
 * High-level function that orchestrates fog calculation with viewport change handling
 * Prevents flickering during map interactions by maintaining stable fog during viewport changes
 * Includes intelligent caching to improve performance for repeated viewport calculations
 * 
 * @param revealedAreas - Previously revealed areas to subtract from fog, or null if none
 * @param options - Configuration options for fog calculation
 * @param isViewportChanging - Whether the viewport is currently changing (prevents flickering)
 * @param useCache - Whether to use caching for this calculation (default: true)
 * @returns Array of fog features ready for map rendering
 * 
 * @example
 * ```typescript
 * const fogFeatures = createFogFeatures(
 *   revealedAreas,
 *   { viewportBounds, useViewportOptimization: true, performanceMode: 'accurate', fallbackStrategy: 'viewport' },
 *   false, // viewport is stable
 *   true   // use caching
 * );
 * 
 * // Use features with MapboxGL.ShapeSource
 * ```
 */
export const createFogFeatures = (
  revealedAreas: RevealedArea | null,
  options: FogCalculationOptions,
  isViewportChanging: boolean = false,
  useCache: boolean = true
): Feature<Polygon | MultiPolygon>[] => {
  const startTime = performance.now();
  
  // During viewport changes, return stable fog to prevent flickering
  if (isViewportChanging) {
    if (options.viewportBounds) {
      try {
        const stableFogPolygon = createViewportFogPolygon(options.viewportBounds);
        return [stableFogPolygon];
      } catch (e) {
        return [createWorldFogPolygon()];
      }
    } else {
      return [createWorldFogPolygon()];
    }
  }
  
  // Use the comprehensive fog calculation with fallback
  const fogResult = createFogWithFallback(revealedAreas, options, useCache);
  
  // Log any errors (warnings are too verbose for production)
  if (fogResult.errors.length > 0) {
    logger.warn('Fog calculation completed with errors:', fogResult.errors);
  }
  
  return fogResult.fogGeoJSON.features;
};

/**
 * Default fog calculation options
 * Provides sensible defaults for fog calculation with optional viewport bounds
 * 
 * @param viewportBounds - Optional viewport bounds to enable viewport optimization
 * @returns Default fog calculation options with viewport optimization enabled if bounds provided
 * 
 * @example
 * ```typescript
 * // Basic default options
 * const options = getDefaultFogOptions();
 * 
 * // Options with viewport optimization
 * const viewportOptions = getDefaultFogOptions(currentViewportBounds);
 * ```
 */
export const getDefaultFogOptions = (viewportBounds?: [number, number, number, number]): FogCalculationOptions => {
  return {
    viewportBounds,
    useViewportOptimization: !!viewportBounds,
    performanceMode: 'accurate',
    fallbackStrategy: 'viewport'
  };
};