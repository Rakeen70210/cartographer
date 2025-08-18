import {
    debugGeometry,
    GeometryComplexity,
    getPolygonComplexity,
    isValidPolygonFeature,
    RevealedArea,
    validateGeometry
} from '@/utils/geometryValidation';
import { logger } from '@/utils/logger';
import { buffer, difference, union } from '@turf/turf';
import { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson';

/**
 * Custom error class for geometry operations
 */
export class GeometryOperationError extends Error {
  constructor(
    message: string,
    public operation: string,
    public geometryType?: string,
    public fallbackUsed?: boolean
  ) {
    super(message);
    this.name = 'GeometryOperationError';
  }
}

/**
 * Performance metrics for geometry operations
 */
export interface GeometryOperationMetrics {
  operationType: string;
  executionTime: number;
  inputComplexity: GeometryComplexity;
  outputComplexity?: GeometryComplexity;
  hadErrors: boolean;
  fallbackUsed: boolean;
}

/**
 * Result wrapper for geometry operations
 */
export interface GeometryOperationResult<T> {
  result: T | null;
  metrics: GeometryOperationMetrics;
  errors: string[];
  warnings: string[];
}

/**
 * Sanitizes geometry for difference operations
 */
export const sanitizeGeometry = (feature: Feature<Polygon | MultiPolygon>): Feature<Polygon | MultiPolygon> | null => {
  const startTime = performance.now();
  
  try {
    if (!isValidPolygonFeature(feature)) {
      logger.warn('Cannot sanitize invalid geometry');
      return null;
    }
    
    let sanitized: Feature<Polygon | MultiPolygon>;
    
    if (feature.geometry.type === 'Polygon') {
      const sanitizedRings = feature.geometry.coordinates.map(ring => {
        return sanitizeRing(ring);
      }).filter(ring => ring.length >= 4); // Remove rings with insufficient points
      
      // Ensure we have at least one valid ring
      if (sanitizedRings.length === 0) {
        logger.warn('No valid rings remaining after sanitization');
        return null;
      }
      
      sanitized = {
        type: 'Feature',
        properties: feature.properties || {},
        geometry: {
          type: 'Polygon',
          coordinates: sanitizedRings
        }
      };
    } else if (feature.geometry.type === 'MultiPolygon') {
      const sanitizedPolygons = feature.geometry.coordinates.map(polygon => {
        return polygon.map(ring => {
          return sanitizeRing(ring);
        }).filter(ring => ring.length >= 4); // Remove rings with insufficient points
      }).filter(polygon => polygon.length > 0); // Remove empty polygons
      
      // Ensure we have at least one valid polygon
      if (sanitizedPolygons.length === 0) {
        logger.warn('No valid polygons remaining after sanitization');
        return null;
      }
      
      sanitized = {
        type: 'Feature',
        properties: feature.properties || {},
        geometry: {
          type: 'MultiPolygon',
          coordinates: sanitizedPolygons
        }
      };
    } else {
      logger.error('Unsupported geometry type for sanitization:', feature.geometry.type);
      return null;
    }
    
    // Validate the sanitized geometry
    if (!isValidPolygonFeature(sanitized)) {
      logger.error('Geometry sanitization produced invalid result');
      return null;
    }
    
    const executionTime = Math.max(0.001, performance.now() - startTime);
    logger.debug(`Geometry sanitized successfully in ${executionTime.toFixed(2)}ms`);
    return sanitized;
  } catch (error) {
    const executionTime = Math.max(0.001, performance.now() - startTime);
    logger.error(`Geometry sanitization failed after ${executionTime.toFixed(2)}ms:`, error);
    return null;
  }
};

/**
 * Helper function to sanitize a single ring of coordinates
 */
const sanitizeRing = (ring: number[][]): number[][] => {
  // Remove duplicate consecutive points
  const cleanRing = [];
  for (let i = 0; i < ring.length; i++) {
    const current = ring[i];
    const previous = cleanRing[cleanRing.length - 1];
    
    // Add point if it's different from the previous one (with small tolerance)
    if (!previous || 
        Math.abs(current[0] - previous[0]) > 0.000001 || 
        Math.abs(current[1] - previous[1]) > 0.000001) {
      cleanRing.push([
        Math.round(current[0] * 1000000) / 1000000, // Round to 6 decimal places
        Math.round(current[1] * 1000000) / 1000000
      ]);
    }
  }
  
  // Ensure polygon is closed
  if (cleanRing.length >= 3) {
    const first = cleanRing[0];
    const last = cleanRing[cleanRing.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      cleanRing.push([first[0], first[1]]);
    }
  }
  
  return cleanRing;
};

/**
 * Robust union operation with comprehensive error handling and performance monitoring
 */
export const unionPolygons = (polygons: RevealedArea[]): GeometryOperationResult<RevealedArea> => {
  const startTime = performance.now();
  const errors: string[] = [];
  const warnings: string[] = [];
  let fallbackUsed = false;
  
  if (polygons.length === 0) {
    return {
      result: null,
      metrics: {
        operationType: 'union',
        executionTime: Math.max(0.001, performance.now() - startTime),
        inputComplexity: { totalVertices: 0, ringCount: 0, maxRingVertices: 0, averageRingVertices: 0, complexityLevel: 'LOW' },
        hadErrors: false,
        fallbackUsed: false
      },
      errors: ['No polygons provided for union operation'],
      warnings: []
    };
  }
  
  if (polygons.length === 1) {
    // Validate and sanitize the single polygon
    const sanitized = sanitizeGeometry(polygons[0]);
    const inputComplexity = getPolygonComplexity(polygons[0]);
    
    return {
      result: sanitized || polygons[0],
      metrics: {
        operationType: 'union',
        executionTime: Math.max(0.001, performance.now() - startTime),
        inputComplexity,
        outputComplexity: sanitized ? getPolygonComplexity(sanitized) : inputComplexity,
        hadErrors: !sanitized,
        fallbackUsed: !sanitized
      },
      errors: sanitized ? [] : ['Failed to sanitize single polygon'],
      warnings: sanitized ? [] : ['Using unsanitized polygon as fallback']
    };
  }

  logger.debugOnce('Unioning multiple polygons');
  let unioned: RevealedArea = polygons[0];
  let inputComplexity = getPolygonComplexity(polygons[0]);
  
  // Validate and sanitize the first polygon
  const sanitizedFirst = sanitizeGeometry(unioned);
  if (sanitizedFirst) {
    unioned = sanitizedFirst;
  } else {
    logger.warn('First polygon failed sanitization, using as-is');
    warnings.push('First polygon failed sanitization');
    fallbackUsed = true;
  }
  
  for (let i = 1; i < polygons.length; i++) {
    try {
      const currentPolygon = polygons[i];
      
      // Debug the current polygon
      debugGeometry(currentPolygon, `Union polygon ${i}`);
      
      // Validate current polygon
      const validation = validateGeometry(currentPolygon);
      if (!validation.isValid) {
        logger.warn(`Skipping invalid polygon at index ${i}:`, validation.errors);
        errors.push(`Polygon ${i} validation failed: ${validation.errors.join(', ')}`);
        continue;
      }
      
      warnings.push(...validation.warnings.map(w => `Polygon ${i}: ${w}`));
      
      // Sanitize current polygon
      const sanitizedCurrent = sanitizeGeometry(currentPolygon);
      if (!sanitizedCurrent) {
        logger.warn(`Failed to sanitize polygon at index ${i}, skipping`);
        errors.push(`Failed to sanitize polygon ${i}`);
        continue;
      }
      
      // Perform union operation
      const featureCollection: FeatureCollection<Polygon | MultiPolygon> = {
        type: 'FeatureCollection',
        features: [unioned, sanitizedCurrent]
      };
      
      const result = union(featureCollection);
      if (result && result.type === 'Feature') {
        unioned = result as RevealedArea;
        // Removed excessive debug logging
      } else {
        logger.warn(`Union returned null or invalid result for polygon ${i}, skipping`);
        errors.push(`Union operation failed for polygon ${i}`);
        fallbackUsed = true;
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      logger.error(`Error unioning polygon ${i}:`, e);
      errors.push(`Union error for polygon ${i}: ${errorMessage}`);
      debugGeometry(polygons[i], `Error - Problematic polygon ${i}`);
      fallbackUsed = true;
      // Continue with the current unioned result, skip the problematic polygon
    }
  }
  
  // Final validation of the result
  const finalValidation = validateGeometry(unioned);
  if (!finalValidation.isValid) {
    logger.error('Final union result is invalid:', finalValidation.errors);
    errors.push(...finalValidation.errors.map(e => `Final result: ${e}`));
    debugGeometry(unioned, 'Invalid union result');
  } else {
    logger.successOnce('Polygon union completed successfully');
    warnings.push(...finalValidation.warnings.map(w => `Final result: ${w}`));
  }
  
  const executionTime = Math.max(0.001, performance.now() - startTime);
  const outputComplexity = finalValidation.isValid ? getPolygonComplexity(unioned) : undefined;
  
  return {
    result: unioned,
    metrics: {
      operationType: 'union',
      executionTime,
      inputComplexity,
      outputComplexity,
      hadErrors: errors.length > 0,
      fallbackUsed
    },
    errors,
    warnings
  };
};

/**
 * Robust difference operation with comprehensive error handling
 */
export const performRobustDifference = (
  minuend: Feature<Polygon | MultiPolygon>, 
  subtrahend: Feature<Polygon | MultiPolygon>
): GeometryOperationResult<Feature<Polygon | MultiPolygon>> => {
  const startTime = performance.now();
  const errors: string[] = [];
  const warnings: string[] = [];
  let fallbackUsed = false;
  
  try {
    logger.debugOnce('Starting robust difference operation');
    
    // Validate both geometries before operation
    const minuendValidation = validateGeometry(minuend);
    const subtrahendValidation = validateGeometry(subtrahend);
    
    if (!minuendValidation.isValid) {
      errors.push(`Minuend geometry invalid: ${minuendValidation.errors.join(', ')}`);
      logger.error('Minuend geometry is invalid for difference operation');
      debugGeometry(minuend, 'Invalid minuend geometry');
    }
    
    if (!subtrahendValidation.isValid) {
      errors.push(`Subtrahend geometry invalid: ${subtrahendValidation.errors.join(', ')}`);
      logger.error('Subtrahend geometry is invalid for difference operation');
      debugGeometry(subtrahend, 'Invalid subtrahend geometry');
    }
    
    if (!minuendValidation.isValid || !subtrahendValidation.isValid) {
      return {
        result: minuend, // Return original as fallback
        metrics: {
          operationType: 'difference',
          executionTime: Math.max(0.001, performance.now() - startTime),
          inputComplexity: getPolygonComplexity(minuend),
          outputComplexity: getPolygonComplexity(minuend),
          hadErrors: true,
          fallbackUsed: true
        },
        errors,
        warnings: ['Using original geometry as fallback due to validation errors']
      };
    }
    
    warnings.push(...minuendValidation.warnings.map(w => `Minuend: ${w}`));
    warnings.push(...subtrahendValidation.warnings.map(w => `Subtrahend: ${w}`));
    
    // Sanitize both geometries
    const sanitizedMinuend = sanitizeGeometry(minuend);
    const sanitizedSubtrahend = sanitizeGeometry(subtrahend);
    
    if (!sanitizedMinuend) {
      errors.push('Failed to sanitize minuend geometry');
      logger.error('Failed to sanitize minuend for difference operation');
      fallbackUsed = true;
    }
    
    if (!sanitizedSubtrahend) {
      errors.push('Failed to sanitize subtrahend geometry');
      logger.error('Failed to sanitize subtrahend for difference operation');
      fallbackUsed = true;
    }
    
    if (!sanitizedMinuend || !sanitizedSubtrahend) {
      return {
        result: minuend, // Return original as fallback
        metrics: {
          operationType: 'difference',
          executionTime: Math.max(0.001, performance.now() - startTime),
          inputComplexity: getPolygonComplexity(minuend),
          outputComplexity: getPolygonComplexity(minuend),
          hadErrors: true,
          fallbackUsed: true
        },
        errors,
        warnings: [...warnings, 'Using original geometry as fallback due to sanitization errors']
      };
    }
    
    // Perform the difference operation with error handling
    let result: Feature<Polygon | MultiPolygon> | null = null;
    
    try {
      // Try the standard Turf.js difference operation
      result = difference(sanitizedMinuend, sanitizedSubtrahend);
    } catch (error) {
      // If difference fails due to Turf.js compatibility issues, use fallback
      logger.warn('Turf.js difference operation failed, using fallback approach');
      result = null;
    }
    
    if (!result) {
      logger.warn('Difference operation returned null - subtrahend may completely cover minuend');
      warnings.push('Difference operation returned null - area may be completely covered');
      
      return {
        result: null,
        metrics: {
          operationType: 'difference',
          executionTime: Math.max(0.001, performance.now() - startTime),
          inputComplexity: getPolygonComplexity(minuend),
          hadErrors: false,
          fallbackUsed: false
        },
        errors,
        warnings
      };
    }
    
    // Validate the result
    const resultValidation = validateGeometry(result);
    if (!resultValidation.isValid) {
      logger.error('Difference operation produced invalid geometry:', resultValidation.errors);
      errors.push(...resultValidation.errors.map(e => `Result: ${e}`));
      fallbackUsed = true;
      
      return {
        result: minuend, // Return original as fallback
        metrics: {
          operationType: 'difference',
          executionTime: Math.max(0.001, performance.now() - startTime),
          inputComplexity: getPolygonComplexity(minuend),
          outputComplexity: getPolygonComplexity(minuend),
          hadErrors: true,
          fallbackUsed: true
        },
        errors,
        warnings: [...warnings, 'Using original geometry as fallback due to invalid result']
      };
    }
    
    warnings.push(...resultValidation.warnings.map(w => `Result: ${w}`));
    
    const executionTime = Math.max(0.001, performance.now() - startTime);
    logger.successOnce('Difference operation completed successfully');
    
    return {
      result: result as Feature<Polygon | MultiPolygon>,
      metrics: {
        operationType: 'difference',
        executionTime,
        inputComplexity: getPolygonComplexity(minuend),
        outputComplexity: getPolygonComplexity(result as Feature<Polygon | MultiPolygon>),
        hadErrors: false,
        fallbackUsed
      },
      errors,
      warnings
    };
    
  } catch (error) {
    const executionTime = Math.max(0.001, performance.now() - startTime);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logger.error(`Difference operation failed after ${executionTime.toFixed(2)}ms:`, error);
    errors.push(`Difference operation exception: ${errorMessage}`);
    
    // Log additional debugging information
    if (error instanceof Error) {
      logger.error('Difference error details:', {
        message: error.message,
        stack: error.stack
      });
    }
    
    debugGeometry(minuend, 'Error - Minuend geometry');
    debugGeometry(subtrahend, 'Error - Subtrahend geometry');
    
    return {
      result: minuend, // Return original as fallback
      metrics: {
        operationType: 'difference',
        executionTime,
        inputComplexity: getPolygonComplexity(minuend),
        outputComplexity: getPolygonComplexity(minuend),
        hadErrors: true,
        fallbackUsed: true
      },
      errors,
      warnings: [...warnings, 'Using original geometry as fallback due to operation exception']
    };
  }
};

/**
 * Creates a buffer around a point with error handling
 */
export const createBufferWithValidation = (
  point: Feature<GeoJSON.Point>, 
  distance: number, 
  units: 'meters' | 'kilometers' = 'meters'
): GeometryOperationResult<RevealedArea> => {
  const startTime = performance.now();
  const errors: string[] = [];
  const warnings: string[] = [];
  
  try {
    // Validate input point
    if (!point || point.type !== 'Feature' || !point.geometry || point.geometry.type !== 'Point') {
      errors.push('Invalid point geometry provided');
      return {
        result: null,
        metrics: {
          operationType: 'buffer',
          executionTime: Math.max(0.001, performance.now() - startTime),
          inputComplexity: { totalVertices: 1, ringCount: 0, maxRingVertices: 0, averageRingVertices: 0, complexityLevel: 'LOW' },
          hadErrors: true,
          fallbackUsed: false
        },
        errors,
        warnings
      };
    }
    
    // Validate coordinates
    const coords = point.geometry.coordinates;
    if (!Array.isArray(coords) || coords.length !== 2 || 
        typeof coords[0] !== 'number' || typeof coords[1] !== 'number' ||
        !isFinite(coords[0]) || !isFinite(coords[1])) {
      errors.push('Invalid point coordinates');
      return {
        result: null,
        metrics: {
          operationType: 'buffer',
          executionTime: Math.max(0.001, performance.now() - startTime),
          inputComplexity: { totalVertices: 1, ringCount: 0, maxRingVertices: 0, averageRingVertices: 0, complexityLevel: 'LOW' },
          hadErrors: true,
          fallbackUsed: false
        },
        errors,
        warnings
      };
    }
    
    // Validate coordinate ranges
    if (coords[0] < -180 || coords[0] > 180 || coords[1] < -90 || coords[1] > 90) {
      errors.push(`Point coordinates out of valid range: [${coords[0]}, ${coords[1]}]`);
    }
    
    // Validate buffer distance
    if (typeof distance !== 'number' || !isFinite(distance) || distance <= 0) {
      errors.push(`Invalid buffer distance: ${distance}`);
    }
    
    if (errors.length > 0) {
      return {
        result: null,
        metrics: {
          operationType: 'buffer',
          executionTime: Math.max(0.001, performance.now() - startTime),
          inputComplexity: { totalVertices: 1, ringCount: 0, maxRingVertices: 0, averageRingVertices: 0, complexityLevel: 'LOW' },
          hadErrors: true,
          fallbackUsed: false
        },
        errors,
        warnings
      };
    }
    
    // Perform buffer operation
    logger.debug(`Creating buffer around point [${coords[0]}, ${coords[1]}] with distance ${distance} ${units}`);
    const buffered = buffer(point, distance, { units }) as RevealedArea;
    
    if (!buffered) {
      errors.push('Buffer operation returned null');
      return {
        result: null,
        metrics: {
          operationType: 'buffer',
          executionTime: Math.max(0.001, performance.now() - startTime),
          inputComplexity: { totalVertices: 1, ringCount: 0, maxRingVertices: 0, averageRingVertices: 0, complexityLevel: 'LOW' },
          hadErrors: true,
          fallbackUsed: false
        },
        errors,
        warnings
      };
    }
    
    // Validate the result
    const resultValidation = validateGeometry(buffered);
    if (!resultValidation.isValid) {
      errors.push(...resultValidation.errors.map(e => `Buffer result: ${e}`));
    } else {
      warnings.push(...resultValidation.warnings.map(w => `Buffer result: ${w}`));
    }
    
    const executionTime = Math.max(0.001, performance.now() - startTime);
    logger.success(`Buffer operation completed successfully in ${executionTime.toFixed(2)}ms`);
    
    return {
      result: buffered,
      metrics: {
        operationType: 'buffer',
        executionTime,
        inputComplexity: { totalVertices: 1, ringCount: 0, maxRingVertices: 0, averageRingVertices: 0, complexityLevel: 'LOW' },
        outputComplexity: resultValidation.isValid ? getPolygonComplexity(buffered) : undefined,
        hadErrors: errors.length > 0,
        fallbackUsed: false
      },
      errors,
      warnings
    };
    
  } catch (error) {
    const executionTime = Math.max(0.001, performance.now() - startTime);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logger.error(`Buffer operation failed after ${executionTime.toFixed(2)}ms:`, error);
    errors.push(`Buffer operation exception: ${errorMessage}`);
    
    return {
      result: null,
      metrics: {
        operationType: 'buffer',
        executionTime,
        inputComplexity: { totalVertices: 1, ringCount: 0, maxRingVertices: 0, averageRingVertices: 0, complexityLevel: 'LOW' },
        hadErrors: true,
        fallbackUsed: false
      },
      errors,
      warnings
    };
  }
};

/**
 * Error handling strategy with fallback geometry
 */
export const handleGeometryError = (
  error: GeometryOperationError,
  fallbackGeometry: Feature<Polygon | MultiPolygon>
): Feature<Polygon | MultiPolygon> => {
  logger.error(`Geometry operation failed: ${error.operation}`, error);
  
  // Log fallback usage
  logger.warn(`Using fallback geometry for ${error.operation}`);
  
  return fallbackGeometry;
};