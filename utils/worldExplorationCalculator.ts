import * as turf from '@turf/turf';
import { logger } from './logger';

export interface RevealedArea {
  id: number;
  geojson: string;
}

export interface WorldExplorationResult {
  percentage: number;
  totalAreaKm2: number;
  exploredAreaKm2: number;
}

// Earth's surface area in square kilometers
// Using the commonly accepted value for Earth's total surface area
export const EARTH_SURFACE_AREA_KM2 = 510072000;

/**
 * Calculate the total area of revealed polygons using Turf.js
 * @param revealedAreas Array of revealed area objects with GeoJSON data
 * @returns Promise resolving to total area in square kilometers
 */
export const calculateRevealedArea = async (revealedAreas: RevealedArea[]): Promise<number> => {
  try {
    if (!revealedAreas || !Array.isArray(revealedAreas) || revealedAreas.length === 0) {
      logger.debug('WorldExplorationCalculator: No revealed areas to calculate');
      return 0;
    }

    logger.debug('WorldExplorationCalculator: Starting revealed area calculation', { 
      revealedAreasCount: revealedAreas.length 
    });

    let totalAreaKm2 = 0;
    const validPolygons: turf.Feature<turf.Polygon | turf.MultiPolygon>[] = [];

    // Process each revealed area
    for (const area of revealedAreas) {
      try {
        const geojson = typeof area.geojson === 'string' 
          ? JSON.parse(area.geojson) 
          : area.geojson;

        // Validate that it's a valid GeoJSON feature
        if (!geojson || typeof geojson !== 'object') {
          logger.warn('WorldExplorationCalculator: Invalid GeoJSON object', { areaId: area.id });
          continue;
        }

        // Handle different GeoJSON types
        let feature: turf.Feature<turf.Polygon | turf.MultiPolygon>;

        if (geojson.type === 'Feature') {
          feature = geojson as turf.Feature<turf.Polygon | turf.MultiPolygon>;
        } else if (geojson.type === 'Polygon' || geojson.type === 'MultiPolygon') {
          feature = turf.feature(geojson);
        } else {
          logger.warn('WorldExplorationCalculator: Unsupported geometry type', { 
            areaId: area.id, 
            type: geojson.type 
          });
          continue;
        }

        // Validate geometry
        if (!feature.geometry || 
            (feature.geometry.type !== 'Polygon' && feature.geometry.type !== 'MultiPolygon')) {
          logger.warn('WorldExplorationCalculator: Invalid geometry type', { 
            areaId: area.id, 
            geometryType: feature.geometry?.type 
          });
          continue;
        }

        validPolygons.push(feature);

        // Calculate area for this polygon
        const areaM2 = turf.area(feature);
        const areaKm2 = areaM2 / 1000000; // Convert square meters to square kilometers
        totalAreaKm2 += areaKm2;

        logger.debug('WorldExplorationCalculator: Processed revealed area', {
          areaId: area.id,
          areaKm2,
          geometryType: feature.geometry.type
        });

      } catch (error) {
        logger.error('WorldExplorationCalculator: Error processing revealed area', {
          areaId: area.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        continue;
      }
    }

    logger.success('WorldExplorationCalculator: Revealed area calculation completed', {
      totalAreaKm2,
      validPolygonsCount: validPolygons.length,
      totalRevealedAreas: revealedAreas.length
    });

    return totalAreaKm2;

  } catch (error) {
    logger.error('WorldExplorationCalculator: Error calculating revealed area:', error);
    throw new Error(`Failed to calculate revealed area: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Calculate world exploration percentage
 * @param revealedAreas Array of revealed area objects
 * @returns Promise resolving to exploration statistics
 */
export const calculateWorldExplorationPercentage = async (
  revealedAreas: RevealedArea[]
): Promise<WorldExplorationResult> => {
  try {
    logger.debug('WorldExplorationCalculator: Starting world exploration percentage calculation');

    const exploredAreaKm2 = await calculateRevealedArea(revealedAreas);
    const percentage = (exploredAreaKm2 / EARTH_SURFACE_AREA_KM2) * 100;

    const result: WorldExplorationResult = {
      percentage,
      totalAreaKm2: EARTH_SURFACE_AREA_KM2,
      exploredAreaKm2
    };

    logger.success('WorldExplorationCalculator: World exploration percentage calculation completed', result);

    return result;

  } catch (error) {
    logger.error('WorldExplorationCalculator: Error calculating world exploration percentage:', error);
    throw new Error(`Failed to calculate world exploration percentage: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Format exploration percentage for display with appropriate precision
 * @param percentage Percentage value (0-100)
 * @param level Geographic level ('world', 'country', 'state', 'city')
 * @returns Formatted percentage string
 */
export const formatExplorationPercentage = (
  percentage: number, 
  level: 'world' | 'country' | 'state' | 'city' = 'world'
): string => {
  if (percentage === 0) {
    return level === 'world' ? '0.000%' : '0.0%';
  }

  // Use different precision based on geographic level
  let precision: number;
  switch (level) {
    case 'world':
      precision = 3; // 3 decimal places for world level (e.g., 0.001%)
      break;
    case 'country':
      precision = 2; // 2 decimal places for country level (e.g., 1.25%)
      break;
    case 'state':
    case 'city':
      precision = 1; // 1 decimal place for state/city level (e.g., 15.2%)
      break;
    default:
      precision = 3;
  }

  return percentage.toFixed(precision) + '%';
};

/**
 * Validate GeoJSON geometry for area calculations
 * @param geojson GeoJSON object to validate
 * @returns True if geometry is valid for area calculation
 */
export const validateGeometryForArea = (geojson: any): boolean => {
  try {
    if (!geojson || typeof geojson !== 'object') {
      return false;
    }

    // Handle Feature wrapper
    const geometry = geojson.type === 'Feature' ? geojson.geometry : geojson;

    if (!geometry || !geometry.type) {
      return false;
    }

    // Only Polygon and MultiPolygon geometries can have area calculated
    if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') {
      return false;
    }

    // Validate coordinates structure
    if (!geometry.coordinates || !Array.isArray(geometry.coordinates)) {
      return false;
    }

    // Basic validation for Polygon
    if (geometry.type === 'Polygon') {
      if (geometry.coordinates.length === 0) {
        return false;
      }
      // Each ring should have at least 4 coordinates (closed polygon)
      for (const ring of geometry.coordinates) {
        if (!Array.isArray(ring) || ring.length < 4) {
          return false;
        }
      }
    }

    // Basic validation for MultiPolygon
    if (geometry.type === 'MultiPolygon') {
      if (geometry.coordinates.length === 0) {
        return false;
      }
      for (const polygon of geometry.coordinates) {
        if (!Array.isArray(polygon) || polygon.length === 0) {
          return false;
        }
        for (const ring of polygon) {
          if (!Array.isArray(ring) || ring.length < 4) {
            return false;
          }
        }
      }
    }

    return true;

  } catch (error) {
    logger.debug('WorldExplorationCalculator: Geometry validation error:', error);
    return false;
  }
};

/**
 * Calculate area of a single GeoJSON feature
 * @param geojson GeoJSON feature or geometry
 * @returns Area in square kilometers, or 0 if invalid
 */
export const calculateSingleFeatureArea = (geojson: any): number => {
  try {
    if (!validateGeometryForArea(geojson)) {
      return 0;
    }

    let feature: turf.Feature<turf.Polygon | turf.MultiPolygon>;

    if (geojson.type === 'Feature') {
      feature = geojson;
    } else {
      feature = turf.feature(geojson);
    }

    const areaM2 = turf.area(feature);
    return areaM2 / 1000000; // Convert to square kilometers

  } catch (error) {
    logger.debug('WorldExplorationCalculator: Error calculating single feature area:', error);
    return 0;
  }
};

/**
 * Get Earth surface area constant
 * @returns Earth's total surface area in square kilometers
 */
export const getEarthSurfaceArea = (): number => {
  return EARTH_SURFACE_AREA_KM2;
};