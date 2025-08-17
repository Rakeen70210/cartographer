import { logger } from '@/utils/logger';
import { Feature, GeoJsonProperties, MultiPolygon, Polygon } from 'geojson';

/**
 * Type definition for revealed area features containing polygon geometries
 * Used throughout the fog of war system to represent areas that have been explored
 */
export type RevealedArea = Feature<Polygon | MultiPolygon, GeoJsonProperties>;

/**
 * Interface for geometry complexity metrics used in performance monitoring
 * Helps determine if geometry operations may be slow or memory-intensive
 */
export interface GeometryComplexity {
  /** Total number of vertices across all rings in the geometry */
  totalVertices: number;
  /** Number of rings (exterior + holes) in the geometry */
  ringCount: number;
  /** Maximum number of vertices in any single ring */
  maxRingVertices: number;
  /** Average number of vertices per ring */
  averageRingVertices: number;
  /** Complexity classification for performance optimization */
  complexityLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

/**
 * Interface for comprehensive geometry validation results
 * Provides detailed feedback about geometry validity and potential issues
 */
export interface GeometryValidationResult {
  /** Whether the geometry passes all validation checks */
  isValid: boolean;
  /** Array of validation errors that prevent geometry use */
  errors: string[];
  /** Array of warnings about potential performance or rendering issues */
  warnings: string[];
  /** Complexity metrics (only available for valid geometries) */
  complexity?: GeometryComplexity;
}

/**
 * Validates that a geometry is a proper Feature<Polygon | MultiPolygon>
 * Performs comprehensive validation of GeoJSON structure, coordinate validity, and polygon closure
 * 
 * @param feature - The feature to validate (can be any type)
 * @returns True if the feature is a valid polygon feature, false otherwise
 * 
 * @example
 * ```typescript
 * const feature = {
 *   type: 'Feature',
 *   geometry: {
 *     type: 'Polygon',
 *     coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]
 *   },
 *   properties: {}
 * };
 * 
 * if (isValidPolygonFeature(feature)) {
 *   // Safe to use as Feature<Polygon | MultiPolygon>
 * }
 * ```
 */
export const isValidPolygonFeature = (feature: any): feature is Feature<Polygon | MultiPolygon> => {
  if (!feature) {
    logger.debug('Geometry validation failed: feature is null/undefined');
    return false;
  }
  
  if (feature.type !== 'Feature') {
    logger.debug('Geometry validation failed: not a Feature type', { type: feature.type });
    return false;
  }
  
  if (!feature.geometry) {
    logger.debug('Geometry validation failed: missing geometry property');
    return false;
  }
  
  if (feature.geometry.type !== 'Polygon' && feature.geometry.type !== 'MultiPolygon') {
    logger.debug('Geometry validation failed: geometry is not Polygon or MultiPolygon type', { 
      geometryType: feature.geometry.type 
    });
    return false;
  }
  
  if (!feature.geometry.coordinates || !Array.isArray(feature.geometry.coordinates)) {
    logger.debug('Geometry validation failed: invalid coordinates');
    return false;
  }
  
  if (feature.geometry.coordinates.length === 0) {
    logger.debug('Geometry validation failed: empty coordinates array');
    return false;
  }
  
  // Handle both Polygon and MultiPolygon validation
  if (feature.geometry.type === 'Polygon') {
    // Validate Polygon: coordinates is array of rings
    const rings = feature.geometry.coordinates;
    for (let i = 0; i < rings.length; i++) {
      if (!validateRing(rings[i], i)) {
        return false;
      }
    }
  } else if (feature.geometry.type === 'MultiPolygon') {
    // Validate MultiPolygon: coordinates is array of polygons (each polygon is array of rings)
    const polygons = feature.geometry.coordinates;
    for (let p = 0; p < polygons.length; p++) {
      const rings = polygons[p];
      if (!Array.isArray(rings) || rings.length === 0) {
        logger.debug('Geometry validation failed: invalid polygon in MultiPolygon', { 
          polygonIndex: p 
        });
        return false;
      }
      for (let i = 0; i < rings.length; i++) {
        if (!validateRing(rings[i], i, p)) {
          return false;
        }
      }
    }
  }
  
  return true;
};

/**
 * Helper function to validate a single ring of coordinates
 * Checks coordinate format, count, closure, and geographic validity
 * 
 * @param ring - The coordinate ring to validate
 * @param ringIndex - Index of the ring within its polygon (for error reporting)
 * @param polygonIndex - Index of the polygon within a MultiPolygon (optional, for error reporting)
 * @returns True if the ring is valid, false otherwise
 * 
 * @example
 * ```typescript
 * const ring = [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]];
 * const isValid = validateRing(ring, 0); // true
 * ```
 */
export const validateRing = (ring: any, ringIndex: number, polygonIndex?: number): boolean => {
  if (!Array.isArray(ring) || ring.length < 4) {
    logger.debug('Geometry validation failed: ring has insufficient coordinates', { 
      ringIndex, 
      polygonIndex,
      ringLength: ring?.length 
    });
    return false;
  }
  
  // Validate that coordinates are valid numbers
  for (let j = 0; j < ring.length; j++) {
    const coord = ring[j];
    if (!Array.isArray(coord) || coord.length !== 2 || 
        typeof coord[0] !== 'number' || typeof coord[1] !== 'number' ||
        !isFinite(coord[0]) || !isFinite(coord[1])) {
      logger.debug('Geometry validation failed: invalid coordinate', { 
        ringIndex, 
        polygonIndex,
        coordIndex: j, 
        coordinate: coord 
      });
      return false;
    }
    
    // Validate coordinate ranges (longitude: -180 to 180, latitude: -90 to 90)
    if (coord[0] < -180 || coord[0] > 180 || coord[1] < -90 || coord[1] > 90) {
      logger.debug('Geometry validation failed: coordinate out of valid range', { 
        coordinate: coord,
        ringIndex,
        polygonIndex,
        coordIndex: j
      });
      return false;
    }
  }
  
  // Validate that polygon is closed (first and last coordinates are the same)
  const firstCoord = ring[0];
  const lastCoord = ring[ring.length - 1];
  if (firstCoord[0] !== lastCoord[0] || firstCoord[1] !== lastCoord[1]) {
    logger.debug('Geometry validation failed: polygon ring is not closed', { 
      ringIndex,
      polygonIndex,
      firstCoord,
      lastCoord
    });
    return false;
  }
  
  return true;
};

/**
 * Calculates polygon complexity metrics for performance monitoring
 * Analyzes vertex count, ring structure, and assigns complexity classification
 * 
 * @param feature - The polygon feature to analyze
 * @returns Complexity metrics including vertex counts and performance classification
 * 
 * @example
 * ```typescript
 * const complexity = getPolygonComplexity(polygonFeature);
 * if (complexity.complexityLevel === 'HIGH') {
 *   // Consider simplification or viewport-based processing
 * }
 * ```
 */
export const getPolygonComplexity = (feature: Feature<Polygon | MultiPolygon>): GeometryComplexity => {
  let totalVertices = 0;
  let ringCount = 0;
  let maxRingVertices = 0;
  
  // Handle invalid features gracefully
  if (!feature || !feature.geometry || !feature.geometry.coordinates) {
    return {
      totalVertices: 0,
      ringCount: 0,
      maxRingVertices: 0,
      averageRingVertices: 0,
      complexityLevel: 'LOW'
    };
  }
  
  if (feature.geometry.type === 'Polygon') {
    feature.geometry.coordinates.forEach(ring => {
      const vertexCount = ring.length;
      totalVertices += vertexCount;
      ringCount++;
      maxRingVertices = Math.max(maxRingVertices, vertexCount);
    });
  } else if (feature.geometry.type === 'MultiPolygon') {
    feature.geometry.coordinates.forEach(polygon => {
      polygon.forEach(ring => {
        const vertexCount = ring.length;
        totalVertices += vertexCount;
        ringCount++;
        maxRingVertices = Math.max(maxRingVertices, vertexCount);
      });
    });
  }
  
  const averageRingVertices = ringCount > 0 ? totalVertices / ringCount : 0;
  const complexityLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 
    totalVertices > 1000 ? 'HIGH' : 
    totalVertices > 500 ? 'MEDIUM' : 'LOW';
  
  return {
    totalVertices,
    ringCount,
    maxRingVertices,
    averageRingVertices,
    complexityLevel
  };
};

/**
 * Comprehensive geometry validation with detailed results
 * Performs thorough validation and returns detailed error/warning information
 * 
 * @param feature - The feature to validate (can be any type)
 * @returns Detailed validation results including errors, warnings, and complexity metrics
 * 
 * @example
 * ```typescript
 * const result = validateGeometry(unknownFeature);
 * if (!result.isValid) {
 *   console.error('Validation errors:', result.errors);
 * }
 * if (result.warnings.length > 0) {
 *   console.warn('Validation warnings:', result.warnings);
 * }
 * ```
 */
export const validateGeometry = (feature: any): GeometryValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Basic structure validation
  if (!feature) {
    errors.push('Feature is null or undefined');
    return { isValid: false, errors, warnings };
  }
  
  if (feature.type !== 'Feature') {
    errors.push(`Expected Feature type, got ${feature.type}`);
  }
  
  if (!feature.geometry) {
    errors.push('Missing geometry property');
    return { isValid: false, errors, warnings };
  }
  
  if (feature.geometry.type !== 'Polygon' && feature.geometry.type !== 'MultiPolygon') {
    errors.push(`Unsupported geometry type: ${feature.geometry.type}`);
    return { isValid: false, errors, warnings };
  }
  
  if (!feature.geometry.coordinates || !Array.isArray(feature.geometry.coordinates)) {
    errors.push('Invalid or missing coordinates');
    return { isValid: false, errors, warnings };
  }
  
  if (feature.geometry.coordinates.length === 0) {
    errors.push('Empty coordinates array');
    return { isValid: false, errors, warnings };
  }
  
  // Detailed coordinate validation
  let totalVertices = 0;
  let ringCount = 0;
  
  if (feature.geometry.type === 'Polygon') {
    const rings = feature.geometry.coordinates;
    for (let i = 0; i < rings.length; i++) {
      const ringValidation = validateRingDetailed(rings[i], i);
      errors.push(...ringValidation.errors);
      warnings.push(...ringValidation.warnings);
      totalVertices += rings[i]?.length || 0;
      ringCount++;
    }
  } else if (feature.geometry.type === 'MultiPolygon') {
    const polygons = feature.geometry.coordinates;
    for (let p = 0; p < polygons.length; p++) {
      const rings = polygons[p];
      if (!Array.isArray(rings) || rings.length === 0) {
        errors.push(`Invalid polygon at index ${p} in MultiPolygon`);
        continue;
      }
      for (let i = 0; i < rings.length; i++) {
        const ringValidation = validateRingDetailed(rings[i], i, p);
        errors.push(...ringValidation.errors);
        warnings.push(...ringValidation.warnings);
        totalVertices += rings[i]?.length || 0;
        ringCount++;
      }
    }
  }
  
  const isValid = errors.length === 0;
  let complexity: GeometryComplexity | undefined;
  
  if (isValid) {
    complexity = getPolygonComplexity(feature as Feature<Polygon | MultiPolygon>);
    
    // Add complexity warnings
    if (complexity.complexityLevel === 'HIGH') {
      warnings.push(`High complexity geometry with ${complexity.totalVertices} vertices may impact performance`);
    }
    
    if (complexity.maxRingVertices > 1000) {
      warnings.push(`Ring with ${complexity.maxRingVertices} vertices may cause rendering issues`);
    }
  }
  
  return {
    isValid,
    errors,
    warnings,
    complexity
  };
};

/**
 * Detailed ring validation with specific error messages
 * Internal helper function that provides comprehensive ring validation with detailed feedback
 * 
 * @param ring - The coordinate ring to validate
 * @param ringIndex - Index of the ring within its polygon
 * @param polygonIndex - Index of the polygon within a MultiPolygon (optional)
 * @returns Object containing arrays of specific error and warning messages
 * 
 * @internal
 */
const validateRingDetailed = (ring: any, ringIndex: number, polygonIndex?: number): { errors: string[]; warnings: string[] } => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const context = polygonIndex !== undefined ? `polygon ${polygonIndex}, ring ${ringIndex}` : `ring ${ringIndex}`;
  
  if (!Array.isArray(ring)) {
    errors.push(`Ring at ${context} is not an array`);
    return { errors, warnings };
  }
  
  if (ring.length < 4) {
    errors.push(`Ring at ${context} has insufficient coordinates (${ring.length}, minimum 4 required)`);
    return { errors, warnings };
  }
  
  // Validate coordinates
  for (let j = 0; j < ring.length; j++) {
    const coord = ring[j];
    if (!Array.isArray(coord) || coord.length !== 2) {
      errors.push(`Invalid coordinate format at ${context}, coordinate ${j}`);
      continue;
    }
    
    if (typeof coord[0] !== 'number' || typeof coord[1] !== 'number') {
      errors.push(`Non-numeric coordinate at ${context}, coordinate ${j}: [${coord[0]}, ${coord[1]}]`);
      continue;
    }
    
    if (!isFinite(coord[0]) || !isFinite(coord[1])) {
      errors.push(`Non-finite coordinate at ${context}, coordinate ${j}: [${coord[0]}, ${coord[1]}]`);
      continue;
    }
    
    // Validate coordinate ranges
    if (coord[0] < -180 || coord[0] > 180) {
      errors.push(`Longitude out of range at ${context}, coordinate ${j}: ${coord[0]} (must be -180 to 180)`);
    }
    
    if (coord[1] < -90 || coord[1] > 90) {
      errors.push(`Latitude out of range at ${context}, coordinate ${j}: ${coord[1]} (must be -90 to 90)`);
    }
  }
  
  // Validate closure
  if (ring.length >= 4) {
    const firstCoord = ring[0];
    const lastCoord = ring[ring.length - 1];
    if (firstCoord[0] !== lastCoord[0] || firstCoord[1] !== lastCoord[1]) {
      errors.push(`Ring at ${context} is not closed (first: [${firstCoord[0]}, ${firstCoord[1]}], last: [${lastCoord[0]}, ${lastCoord[1]}])`);
    }
  }
  
  // Performance warnings
  if (ring.length > 1000) {
    warnings.push(`Ring at ${context} has ${ring.length} vertices, which may impact performance`);
  }
  
  return { errors, warnings };
};

/**
 * Logs detailed geometry information for debugging with performance metrics
 * Provides comprehensive debugging output including structure, validity, and complexity analysis
 * 
 * @param feature - The geometry feature to debug (can be any type)
 * @param name - Descriptive name for the geometry (used in log messages)
 * 
 * @example
 * ```typescript
 * debugGeometry(suspiciousGeometry, 'fog-calculation-result');
 * // Logs detailed information about the geometry structure and validity
 * ```
 */
export const debugGeometry = (feature: any, name: string): void => {
  const basicInfo = {
    type: feature?.type,
    geometryType: feature?.geometry?.type,
    hasCoordinates: !!feature?.geometry?.coordinates,
    coordinateRingCount: feature?.geometry?.coordinates?.length,
    firstRingLength: feature?.geometry?.coordinates?.[0]?.length,
    firstCoordinate: feature?.geometry?.coordinates?.[0]?.[0],
    properties: feature?.properties,
    isValid: isValidPolygonFeature(feature)
  };
  
  // Add complexity metrics for valid polygon features
  if (isValidPolygonFeature(feature)) {
    const complexity = getPolygonComplexity(feature);
    logger.debug(`${name} geometry debug:`, {
      ...basicInfo,
      complexity: {
        totalVertices: complexity.totalVertices,
        ringCount: complexity.ringCount,
        maxRingVertices: complexity.maxRingVertices,
        averageRingVertices: Math.round(complexity.averageRingVertices * 100) / 100,
        complexityLevel: complexity.complexityLevel
      }
    });
  } else {
    logger.debug(`${name} geometry debug:`, basicInfo);
  }
  
  // Log coordinate details for first ring if available
  if (feature?.geometry?.coordinates?.[0]) {
    const firstRing = feature.geometry.coordinates[0];
    logger.debug(`${name} first ring details:`, {
      length: firstRing.length,
      isClosed: firstRing.length >= 4 && 
                firstRing[0][0] === firstRing[firstRing.length - 1][0] &&
                firstRing[0][1] === firstRing[firstRing.length - 1][1],
      firstPoint: firstRing[0],
      lastPoint: firstRing[firstRing.length - 1]
    });
  }
};

/**
 * Legacy function for backward compatibility
 * @deprecated Use isValidPolygonFeature instead for better type safety and validation
 * 
 * @param polygon - The polygon to validate
 * @returns True if the polygon is valid, false otherwise
 */
export const isValidPolygon = (polygon: any): boolean => {
  return isValidPolygonFeature(polygon);
};