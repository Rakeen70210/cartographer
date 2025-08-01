import * as turf from '@turf/turf';
import {
  getAllRegionBoundaries,
  getRegionBoundary,
  RegionBoundary,
  saveRegionBoundary
} from './database';
import { logger } from './logger';

/**
 * Service for managing geographic region boundaries and area calculations
 */

export interface BoundaryData {
  type: 'country' | 'state' | 'city';
  name: string;
  code?: string;
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  area: number; // in square kilometers
  centroid: [number, number]; // [longitude, latitude]
}

export interface RegionExplorationData {
  regionName: string;
  regionType: 'country' | 'state' | 'city';
  totalArea: number; // in square kilometers
  exploredArea: number; // in square kilometers
  explorationPercentage: number;
  boundingBox: turf.BBox;
}

/**
 * Simplified boundary data for common regions
 * In a real implementation, this would be fetched from a geographic API
 */
const SIMPLIFIED_BOUNDARIES: Record<string, any> = {
  'United States': {
    type: 'Polygon',
    coordinates: [[
      [-125.0, 48.0], [-125.0, 25.0], [-66.0, 25.0], [-66.0, 48.0], [-125.0, 48.0]
    ]]
  },
  'Canada': {
    type: 'Polygon',
    coordinates: [[
      [-141.0, 69.0], [-141.0, 42.0], [-52.0, 42.0], [-52.0, 69.0], [-141.0, 69.0]
    ]]
  },
  'California': {
    type: 'Polygon',
    coordinates: [[
      [-124.5, 42.0], [-124.5, 32.5], [-114.0, 32.5], [-114.0, 42.0], [-124.5, 42.0]
    ]]
  },
  'New York': {
    type: 'Polygon',
    coordinates: [[
      [-79.8, 45.0], [-79.8, 40.5], [-71.8, 40.5], [-71.8, 45.0], [-79.8, 45.0]
    ]]
  },
  'Ontario': {
    type: 'Polygon',
    coordinates: [[
      [-95.0, 57.0], [-95.0, 42.0], [-74.0, 42.0], [-74.0, 57.0], [-95.0, 57.0]
    ]]
  }
};

/**
 * Fetches or creates simplified boundary data for a region
 */
export const getRegionBoundaryData = async (
  regionType: 'country' | 'state' | 'city',
  regionName: string
): Promise<BoundaryData | null> => {
  logger.debug(`RegionBoundaryService: Fetching boundary for ${regionType}: ${regionName}`);

  try {
    // First check if we have cached boundary data
    const cachedBoundary = await getRegionBoundary(regionType, regionName);

    if (cachedBoundary) {
      logger.debug(`RegionBoundaryService: Found cached boundary for ${regionName}`);

      const geometry = JSON.parse(cachedBoundary.boundary_geojson);
      const area = cachedBoundary.area_km2 || calculatePolygonArea(geometry);
      const centroid = turf.centroid(geometry).geometry.coordinates as [number, number];

      return {
        type: regionType,
        name: regionName,
        geometry,
        area,
        centroid
      };
    }

    // If not cached, try to get simplified boundary data
    const simplifiedGeometry = SIMPLIFIED_BOUNDARIES[regionName];

    if (simplifiedGeometry) {
      logger.debug(`RegionBoundaryService: Using simplified boundary for ${regionName}`);

      const area = calculatePolygonArea(simplifiedGeometry);
      const centroid = turf.centroid(simplifiedGeometry).geometry.coordinates as [number, number];

      // Cache the boundary data
      await saveRegionBoundary(regionType, regionName, simplifiedGeometry, area);

      return {
        type: regionType,
        name: regionName,
        geometry: simplifiedGeometry,
        area,
        centroid
      };
    }

    // If no boundary data available, create a very basic approximation
    logger.warn(`RegionBoundaryService: No boundary data available for ${regionName}, creating approximation`);
    return createApproximateBoundary(regionType, regionName);

  } catch (error) {
    logger.error(`RegionBoundaryService: Error fetching boundary for ${regionName}:`, error);
    return null;
  }
};

/**
 * Creates an approximate boundary for regions without specific data
 */
const createApproximateBoundary = async (
  regionType: 'country' | 'state' | 'city',
  regionName: string
): Promise<BoundaryData | null> => {
  try {
    // Create a very basic square boundary as approximation
    // In a real implementation, this would use more sophisticated methods
    let size = 1.0; // degrees

    switch (regionType) {
      case 'country':
        size = 10.0;
        break;
      case 'state':
        size = 5.0;
        break;
      case 'city':
        size = 0.5;
        break;
    }

    // Use a default center point (this is very approximate)
    const centerLon = 0;
    const centerLat = 0;

    const approximateGeometry: GeoJSON.Polygon = {
      type: 'Polygon',
      coordinates: [[
        [centerLon - size, centerLat - size],
        [centerLon + size, centerLat - size],
        [centerLon + size, centerLat + size],
        [centerLon - size, centerLat + size],
        [centerLon - size, centerLat - size]
      ]]
    };

    const area = calculatePolygonArea(approximateGeometry);
    const centroid: [number, number] = [centerLon, centerLat];

    // Cache the approximate boundary
    await saveRegionBoundary(regionType, regionName, approximateGeometry, area);

    return {
      type: regionType,
      name: regionName,
      geometry: approximateGeometry,
      area,
      centroid
    };
  } catch (error) {
    logger.error(`RegionBoundaryService: Error creating approximate boundary for ${regionName}:`, error);
    return null;
  }
};

/**
 * Calculates the area of a polygon in square kilometers using Turf.js
 */
export const calculatePolygonArea = (geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon): number => {
  try {
    const feature = turf.feature(geometry);
    const areaInSquareMeters = turf.area(feature);
    const areaInSquareKilometers = areaInSquareMeters / 1_000_000;

    logger.debug(`RegionBoundaryService: Calculated area: ${areaInSquareKilometers.toFixed(2)} km²`);
    return areaInSquareKilometers;
  } catch (error) {
    logger.error('RegionBoundaryService: Error calculating polygon area:', error);
    return 0;
  }
};

/**
 * Calculates the intersection between revealed areas and a region boundary
 */
export const calculateRegionExploration = async (
  regionBoundary: BoundaryData,
  revealedAreas: GeoJSON.Feature[]
): Promise<RegionExplorationData> => {
  logger.debug(`RegionBoundaryService: Calculating exploration for ${regionBoundary.name}`);

  try {
    const regionFeature = turf.feature(regionBoundary.geometry);
    let totalExploredArea = 0;

    // Calculate intersection with each revealed area
    for (const revealedArea of revealedAreas) {
      try {
        // Check if the revealed area intersects with the region boundary
        const intersection = turf.intersect(regionFeature, revealedArea);

        if (intersection) {
          const intersectionArea = turf.area(intersection) / 1_000_000; // Convert to km²
          totalExploredArea += intersectionArea;
        }
      } catch (intersectionError) {
        // Skip invalid intersections but continue processing
        logger.debug(`RegionBoundaryService: Skipping invalid intersection for ${regionBoundary.name}`);
      }
    }

    const explorationPercentage = regionBoundary.area > 0
      ? (totalExploredArea / regionBoundary.area) * 100
      : 0;

    const boundingBox = turf.bbox(regionFeature);

    const result: RegionExplorationData = {
      regionName: regionBoundary.name,
      regionType: regionBoundary.type,
      totalArea: regionBoundary.area,
      exploredArea: totalExploredArea,
      explorationPercentage: Math.min(explorationPercentage, 100), // Cap at 100%
      boundingBox
    };

    logger.debug(`RegionBoundaryService: ${regionBoundary.name} exploration: ${explorationPercentage.toFixed(3)}%`);
    return result;
  } catch (error) {
    logger.error(`RegionBoundaryService: Error calculating exploration for ${regionBoundary.name}:`, error);

    // Return default values on error
    return {
      regionName: regionBoundary.name,
      regionType: regionBoundary.type,
      totalArea: regionBoundary.area,
      exploredArea: 0,
      explorationPercentage: 0,
      boundingBox: [0, 0, 0, 0]
    };
  }
};

/**
 * Calculates exploration data for multiple regions
 */
export const calculateMultipleRegionExploration = async (
  regionNames: Array<{ type: 'country' | 'state' | 'city'; name: string }>,
  revealedAreas: GeoJSON.Feature[]
): Promise<RegionExplorationData[]> => {
  logger.debug(`RegionBoundaryService: Calculating exploration for ${regionNames.length} regions`);

  const results: RegionExplorationData[] = [];

  for (const region of regionNames) {
    try {
      const boundaryData = await getRegionBoundaryData(region.type, region.name);

      if (boundaryData) {
        const explorationData = await calculateRegionExploration(boundaryData, revealedAreas);
        results.push(explorationData);
      } else {
        logger.warn(`RegionBoundaryService: Could not get boundary data for ${region.name}`);

        // Add placeholder data for regions without boundaries
        results.push({
          regionName: region.name,
          regionType: region.type,
          totalArea: 0,
          exploredArea: 0,
          explorationPercentage: 0,
          boundingBox: [0, 0, 0, 0]
        });
      }
    } catch (error) {
      logger.error(`RegionBoundaryService: Error processing region ${region.name}:`, error);
    }
  }

  logger.debug(`RegionBoundaryService: Completed exploration calculation for ${results.length} regions`);
  return results;
};

/**
 * Gets all cached region boundaries from the database
 */
export const getAllCachedBoundaries = async (): Promise<BoundaryData[]> => {
  try {
    const cachedBoundaries = await getAllRegionBoundaries();

    return cachedBoundaries.map((boundary: RegionBoundary): BoundaryData => ({
      type: boundary.region_type,
      name: boundary.region_name,
      geometry: JSON.parse(boundary.boundary_geojson),
      area: boundary.area_km2 || 0,
      centroid: turf.centroid(JSON.parse(boundary.boundary_geojson)).geometry.coordinates as [number, number]
    }));
  } catch (error) {
    logger.error('RegionBoundaryService: Error getting cached boundaries:', error);
    return [];
  }
};

/**
 * Validates that a geometry is a valid polygon or multipolygon
 */
export const validateGeometry = (geometry: any): boolean => {
  try {
    if (!geometry || !geometry.type) return false;

    if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') return false;

    // Try to create a turf feature to validate the geometry
    turf.feature(geometry);
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Simplifies a complex polygon to reduce computational complexity
 */
export const simplifyPolygon = (
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon,
  tolerance: number = 0.01
): GeoJSON.Polygon | GeoJSON.MultiPolygon => {
  try {
    const feature = turf.feature(geometry);
    const simplified = turf.simplify(feature, { tolerance, highQuality: false });
    return simplified.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon;
  } catch (error) {
    logger.error('RegionBoundaryService: Error simplifying polygon:', error);
    return geometry;
  }
};

/**
 * Checks if a point is within a region boundary
 */
export const isPointInRegion = (
  point: [number, number], // [longitude, latitude]
  regionBoundary: BoundaryData
): boolean => {
  try {
    const pointFeature = turf.point(point);
    const regionFeature = turf.feature(regionBoundary.geometry);
    return turf.booleanPointInPolygon(pointFeature, regionFeature);
  } catch (error) {
    logger.error('RegionBoundaryService: Error checking point in region:', error);
    return false;
  }
};

/**
 * Gets the bounding box for a region
 */
export const getRegionBoundingBox = (regionBoundary: BoundaryData): turf.BBox => {
  try {
    const regionFeature = turf.feature(regionBoundary.geometry);
    return turf.bbox(regionFeature);
  } catch (error) {
    logger.error('RegionBoundaryService: Error getting region bounding box:', error);
    return [0, 0, 0, 0];
  }
};