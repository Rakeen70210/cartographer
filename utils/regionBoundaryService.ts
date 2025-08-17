import { logger } from '@/utils/logger';
import * as turf from '@turf/turf';
import {
    getAllRegionBoundaries,
    RegionBoundary,
    saveRegionBoundary
} from './database';
import {
    BoundaryApiResponse,
    geographicApiService,
    getTotalRegionCounts,
    validateGeoJSONGeometry
} from './geographicApiService';

/**
 * Service for managing geographic region boundaries and area calculations
 * Now integrated with real geographic API data sources
 */

export interface BoundaryData {
  type: 'country' | 'state' | 'city';
  name: string;
  code?: string;
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  area: number; // in square kilometers
  centroid: [number, number]; // [longitude, latitude]
  source?: 'api' | 'cache' | 'fallback';
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
 * Fallback boundary data for common regions when APIs are unavailable
 * This serves as offline backup data
 */
const FALLBACK_BOUNDARIES: Record<string, any> = {
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
 * Fetches boundary data for a region using real geographic APIs with fallbacks
 */
export const getRegionBoundaryData = async (
  regionType: 'country' | 'state' | 'city',
  regionName: string,
  countryCode?: string,
  stateCode?: string
): Promise<BoundaryData | null> => {
  logger.debug(`RegionBoundaryService: Fetching boundary for ${regionType}: ${regionName}`);

  try {
    // Try to get data from geographic APIs first
    let apiResponse: BoundaryApiResponse | null = null;

    switch (regionType) {
      case 'country':
        apiResponse = await geographicApiService.getCountryBoundary(regionName, countryCode);
        break;
      case 'state':
        apiResponse = await geographicApiService.getStateBoundary(regionName, countryCode);
        break;
      case 'city':
        apiResponse = await geographicApiService.getCityBoundary(regionName, stateCode, countryCode);
        break;
    }

    if (apiResponse && validateGeoJSONGeometry(apiResponse.geometry)) {
      logger.debug(`RegionBoundaryService: Got boundary from API (${apiResponse.source}) for ${regionName}`);

      const area = apiResponse.area || calculatePolygonArea(apiResponse.geometry);
      const centroid = turf.centroid(apiResponse.geometry).geometry.coordinates as [number, number];

      return {
        type: regionType,
        name: apiResponse.name,
        code: apiResponse.code,
        geometry: apiResponse.geometry,
        area,
        centroid,
        source: apiResponse.source === 'cache' ? 'cache' : 'api'
      };
    }

    // Fallback to simplified boundary data if API fails
    const fallbackGeometry = FALLBACK_BOUNDARIES[regionName];

    if (fallbackGeometry && validateGeoJSONGeometry(fallbackGeometry)) {
      logger.debug(`RegionBoundaryService: Using fallback boundary for ${regionName}`);

      const area = calculatePolygonArea(fallbackGeometry);
      const centroid = turf.centroid(fallbackGeometry).geometry.coordinates as [number, number];

      // Cache the fallback boundary data
      await saveRegionBoundary(regionType, regionName, fallbackGeometry, area);

      return {
        type: regionType,
        name: regionName,
        geometry: fallbackGeometry,
        area,
        centroid,
        source: 'fallback'
      };
    }

    // If no boundary data available, create a very basic approximation
    logger.warn(`RegionBoundaryService: No boundary data available for ${regionName}, creating approximation`);
    return createApproximateBoundary(regionType, regionName);

  } catch (error) {
    logger.error(`RegionBoundaryService: Error fetching boundary for ${regionName}:`, error);
    
    // Try fallback data on error
    const fallbackGeometry = FALLBACK_BOUNDARIES[regionName];
    if (fallbackGeometry) {
      const area = calculatePolygonArea(fallbackGeometry);
      const centroid = turf.centroid(fallbackGeometry).geometry.coordinates as [number, number];

      return {
        type: regionType,
        name: regionName,
        geometry: fallbackGeometry,
        area,
        centroid,
        source: 'fallback'
      };
    }

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
      centroid,
      source: 'fallback'
    };
  } catch (error) {
    logger.error(`RegionBoundaryService: Error creating approximate boundary for ${regionName}:`, error);
    return null;
  }
};

/**
 * Get total counts of available regions from APIs
 */
export const getTotalRegionCountsFromApis = async (): Promise<{
  countries: number;
  states: number;
  cities: number;
}> => {
  try {
    return await getTotalRegionCounts();
  } catch (error) {
    logger.error('RegionBoundaryService: Error getting total region counts from APIs:', error);
    
    // Return fallback values
    return {
      countries: 195,
      states: 3142,
      cities: 10000
    };
  }
};

/**
 * Batch fetch boundaries for multiple regions
 */
export const batchGetRegionBoundaries = async (
  regions: Array<{
    type: 'country' | 'state' | 'city';
    name: string;
    countryCode?: string;
    stateCode?: string;
  }>
): Promise<BoundaryData[]> => {
  logger.debug(`RegionBoundaryService: Batch fetching ${regions.length} region boundaries`);

  const results: BoundaryData[] = [];
  const batchSize = 3; // Small batch size to respect API rate limits

  for (let i = 0; i < regions.length; i += batchSize) {
    const batch = regions.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (region) => {
      try {
        return await getRegionBoundaryData(
          region.type,
          region.name,
          region.countryCode,
          region.stateCode
        );
      } catch (error) {
        logger.warn(`RegionBoundaryService: Failed to fetch boundary for ${region.name}:`, error);
        return null;
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults.filter((result): result is BoundaryData => result !== null));

    // Add delay between batches to respect rate limits
    if (i + batchSize < regions.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  logger.debug(`RegionBoundaryService: Successfully fetched ${results.length} boundaries`);
  return results;
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