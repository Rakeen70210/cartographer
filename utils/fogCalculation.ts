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
  
  logger.debug('Created viewport fog polygon:', {
    minLng, minLat, maxLng, maxLat,
    area: (maxLng - minLng) * (maxLat - minLat)
  });
  
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
    
    // Check if bounding boxes overlap
    const overlaps = !(revealedMaxLng < minLng || revealedMinLng > maxLng ||
                     revealedMaxLat < minLat || revealedMinLat > maxLat);
    
    logger.debug('Viewport filtering:', {
      viewport: { minLng, minLat, maxLng, maxLat },
      revealed: { minLng: revealedMinLng, minLat: revealedMinLat, maxLng: revealedMaxLng, maxLat: revealedMaxLat },
      overlaps
    });
    
    if (overlaps) {
      logger.debug('Revealed areas intersect with viewport');
      return revealedAreas;
    } else {
      logger.debug('No revealed areas in current viewport');
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
 * Includes comprehensive error handling and performance monitoring
 * 
 * @param revealedAreas - Previously revealed areas to subtract from fog, or null if none
 * @param options - Configuration options for the fog calculation
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
  options: FogCalculationOptions
): FogCalculationResult => {
  const startTime = performance.now();
  const errors: string[] = [];
  const warnings: string[] = [];
  let fallbackUsed = false;
  

  
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
      const executionTime = Math.max(0.001, performance.now() - startTime);
      
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
        warnings
      };
    }
    
    // Filter revealed areas to viewport if optimization is enabled
    let relevantRevealedAreas: RevealedArea | null = revealedAreas;
    
    if (options.useViewportOptimization) {
      const filterStartTime = performance.now();
      relevantRevealedAreas = getRevealedAreasInViewport(revealedAreas, options.viewportBounds);
      const filterTime = performance.now() - filterStartTime;
      
      if (!relevantRevealedAreas) {
        const executionTime = Math.max(0.001, performance.now() - startTime);
        
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
    
    const executionTime = Math.max(0.001, performance.now() - startTime);
    
    if (differenceResult.result) {
      
      return {
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
      logger.warn('Robust difference operation returned null, using fallback');
      warnings.push('Difference operation returned null - area may be completely revealed');
      
      // Return empty fog collection when difference is null (completely revealed)
      return {
        fogGeoJSON: {
          type: 'FeatureCollection',
          features: [],
        },
        calculationTime: executionTime,
        performanceMetrics: {
          geometryComplexity: { totalVertices: 0, ringCount: 0, maxRingVertices: 0, averageRingVertices: 0, complexityLevel: 'LOW' },
          operationType: 'viewport',
          hadErrors: false,
          fallbackUsed: false,
          executionTime,
          performanceLevel: executionTime > 100 ? 'SLOW' : executionTime > 50 ? 'MODERATE' : 'FAST'
        },
        errors,
        warnings
      };
    }
    
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
  
  logger.debug('Creating simplified fog');
  
  try {
    let fogPolygon: Feature<Polygon>;
    
    if (viewportBounds) {
      fogPolygon = createViewportFogPolygon(viewportBounds);
      logger.debug('Created simplified viewport fog');
    } else {
      fogPolygon = createWorldFogPolygon();
      logger.debug('Created simplified world fog');
    }
    
    const executionTime = Math.max(0.001, performance.now() - startTime);
    
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
    const executionTime = Math.max(0.001, performance.now() - startTime);
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
 * 
 * @param revealedAreas - Previously revealed areas to subtract from fog, or null if none
 * @param options - Configuration options including fallback strategy
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
  options: FogCalculationOptions
): FogCalculationResult => {
  const overallStartTime = performance.now();
  
  try {
    // Primary: Viewport-based fog with revealed areas
    if (options.useViewportOptimization && options.viewportBounds) {
      const result = calculateViewportFog(revealedAreas, options);
      
      // If successful and no critical errors, return result
      if (!result.performanceMetrics.hadErrors || result.errors.length === 0) {
        return result;
      }
      
      logger.warn('Viewport fog calculation had errors, trying fallback');
    }
    
    // Secondary: Simplified viewport fog
    if (options.fallbackStrategy === 'viewport' && options.viewportBounds) {
      logger.warn('Primary fog calculation failed, trying simplified viewport approach');
      
      try {
        const fallbackResult = calculateSimplifiedFog(options.viewportBounds);
        fallbackResult.warnings.push('Used simplified viewport fog as fallback');
        return fallbackResult;
      } catch (fallbackError) {
        logger.error('Simplified viewport fog calculation failed:', fallbackError);
      }
    }
    
    // Tertiary: World fog as final fallback
    if (options.fallbackStrategy === 'world' || options.fallbackStrategy === 'viewport') {
      logger.error('All fog calculation methods failed, using world fog');
      
      const worldResult = calculateSimplifiedFog(); // No viewport bounds = world fog
      worldResult.warnings.push('Used world fog as final fallback');
      worldResult.performanceMetrics.hadErrors = true;
      
      return worldResult;
    }
    
    // No fallback strategy
    logger.error('Fog calculation failed and no fallback strategy specified');
    throw new Error('Fog calculation failed and no fallback strategy available');
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Critical error in fog calculation with fallback:', error);
    
    // Emergency fallback - always return world fog
    const executionTime = performance.now() - overallStartTime;
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
      errors: [`Critical fog calculation error: ${errorMessage}`],
      warnings: ['Emergency fallback to world fog']
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
  logger.debug('Creating fallback fog result');
  
  try {
    let fogPolygon: Feature<Polygon>;
    let operationType: 'viewport' | 'world';
    
    if (options.fallbackStrategy === 'viewport' && options.viewportBounds) {
      fogPolygon = createViewportFogPolygon(options.viewportBounds);
      operationType = 'viewport';
      warnings.push('Using viewport fog as fallback');
    } else {
      fogPolygon = createWorldFogPolygon();
      operationType = 'world';
      warnings.push('Using world fog as fallback');
    }
    
    const executionTime = Math.max(0.001, performance.now() - startTime);
    
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
    const executionTime = Math.max(0.001, performance.now() - startTime);
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
 * 
 * @param revealedAreas - Previously revealed areas to subtract from fog, or null if none
 * @param options - Configuration options for fog calculation
 * @param isViewportChanging - Whether the viewport is currently changing (prevents flickering)
 * @returns Array of fog features ready for map rendering
 * 
 * @example
 * ```typescript
 * const fogFeatures = createFogFeatures(
 *   revealedAreas,
 *   { viewportBounds, useViewportOptimization: true, performanceMode: 'accurate', fallbackStrategy: 'viewport' },
 *   false // viewport is stable
 * );
 * 
 * // Use features with MapboxGL.ShapeSource
 * ```
 */
export const createFogFeatures = (
  revealedAreas: RevealedArea | null,
  options: FogCalculationOptions,
  isViewportChanging: boolean = false
): Feature<Polygon | MultiPolygon>[] => {
  const startTime = performance.now();
  
  logger.debug('Starting fog feature creation', {
    hasRevealedAreas: !!revealedAreas,
    useViewportOptimization: options.useViewportOptimization,
    isViewportChanging,
    performanceMode: options.performanceMode
  });
  
  // During viewport changes, return stable fog to prevent flickering
  if (isViewportChanging) {
    logger.debug('Viewport changing - maintaining stable fog to prevent flickering');
    
    if (options.viewportBounds) {
      try {
        const stableFogPolygon = createViewportFogPolygon(options.viewportBounds);
        const endTime = performance.now();
        logger.debug(`Stable fog maintained in ${(endTime - startTime).toFixed(2)}ms`);
        return [stableFogPolygon];
      } catch (e) {
        logger.debug('Fallback to world polygon during viewport change');
        return [createWorldFogPolygon()];
      }
    } else {
      return [createWorldFogPolygon()];
    }
  }
  
  // Use the comprehensive fog calculation with fallback
  const fogResult = createFogWithFallback(revealedAreas, options);
  
  // Log performance metrics
  const totalTime = performance.now() - startTime;
  logger.debug(`Fog creation completed in ${totalTime.toFixed(2)}ms`, {
    performanceLevel: fogResult.performanceMetrics.performanceLevel,
    featureCount: fogResult.fogGeoJSON.features.length,
    hadErrors: fogResult.performanceMetrics.hadErrors,
    fallbackUsed: fogResult.performanceMetrics.fallbackUsed
  });
  
  // Log any errors or warnings
  if (fogResult.errors.length > 0) {
    logger.warn('Fog calculation completed with errors:', fogResult.errors);
  }
  
  if (fogResult.warnings.length > 0) {
    logger.debug('Fog calculation warnings:', fogResult.warnings);
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