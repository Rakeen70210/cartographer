// Set Mapbox access token for native module
import MapboxGL from '@rnmapbox/maps';
import { bboxPolygon, buffer, difference, union } from '@turf/turf';
import { Feature, FeatureCollection, GeoJsonProperties, MultiPolygon, Point, Polygon } from 'geojson';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
MapboxGL.setAccessToken('pk.eyJ1IjoicmFsaWtzNzAyMTAiLCJhIjoiY21icTM1cm4zMGFqNzJxcHdrbHEzY3hkYiJ9.o-DnPquzV98xBU8SMuenjg');

import { useColorScheme } from '../../hooks/useColorScheme';
import useLocationTracking from '../../hooks/useLocationTracking';
import { useThemeColor } from '../../hooks/useThemeColor';
import { getRevealedAreas, initDatabase, saveRevealedArea } from '../../utils/database';
import { logger } from '../../utils/logger';

// Define a more specific type for revealed areas, which can be polygons or multipolygons
type RevealedArea = Feature<Polygon | MultiPolygon, GeoJsonProperties>;

/**
 * Validates that a geometry is a proper Feature<Polygon | MultiPolygon>
 */
const isValidPolygonFeature = (feature: any): feature is Feature<Polygon | MultiPolygon> => {
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
 */
const validateRing = (ring: any, ringIndex: number, polygonIndex?: number): boolean => {
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
 * Sanitizes geometry for difference operations
 */
const sanitizeGeometry = (feature: Feature<Polygon | MultiPolygon>): Feature<Polygon | MultiPolygon> | null => {
  try {
    if (!isValidPolygonFeature(feature)) {
      logger.warn('Cannot sanitize invalid geometry');
      return null;
    }
    
    let sanitized: Feature<Polygon | MultiPolygon>;
    
    if (feature.geometry.type === 'Polygon') {
      sanitized = {
        type: 'Feature',
        properties: feature.properties || {},
        geometry: {
          type: 'Polygon',
          coordinates: feature.geometry.coordinates.map(ring => {
            return sanitizeRing(ring);
          }).filter(ring => ring.length >= 4) // Remove rings with insufficient points
        }
      };
    } else if (feature.geometry.type === 'MultiPolygon') {
      sanitized = {
        type: 'Feature',
        properties: feature.properties || {},
        geometry: {
          type: 'MultiPolygon',
          coordinates: feature.geometry.coordinates.map(polygon => {
            return polygon.map(ring => {
              return sanitizeRing(ring);
            }).filter(ring => ring.length >= 4); // Remove rings with insufficient points
          }).filter(polygon => polygon.length > 0) // Remove empty polygons
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
    
    logger.debug('Geometry sanitized successfully');
    return sanitized;
  } catch (error) {
    logger.error('Geometry sanitization failed:', error);
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
 * Calculates polygon complexity metrics for performance monitoring
 */
const getPolygonComplexity = (feature: Feature<Polygon | MultiPolygon>): {
  totalVertices: number;
  ringCount: number;
  maxRingVertices: number;
  averageRingVertices: number;
} => {
  let totalVertices = 0;
  let ringCount = 0;
  let maxRingVertices = 0;
  
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
  
  return {
    totalVertices,
    ringCount,
    maxRingVertices,
    averageRingVertices: ringCount > 0 ? totalVertices / ringCount : 0
  };
};

/**
 * Logs detailed geometry information for debugging with performance metrics
 */
const debugGeometry = (feature: any, name: string) => {
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
  if (isValidPolygonFeature(feature) || 
      (feature?.geometry?.type === 'MultiPolygon' && feature?.geometry?.coordinates)) {
    const complexity = getPolygonComplexity(feature);
    logger.debug(`${name} geometry debug:`, {
      ...basicInfo,
      complexity: {
        totalVertices: complexity.totalVertices,
        ringCount: complexity.ringCount,
        maxRingVertices: complexity.maxRingVertices,
        averageRingVertices: Math.round(complexity.averageRingVertices * 100) / 100,
        complexityLevel: complexity.totalVertices > 1000 ? 'HIGH' : 
                        complexity.totalVertices > 500 ? 'MEDIUM' : 'LOW'
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
 * Validates if a polygon is valid for processing (legacy function for backward compatibility)
 */
const isValidPolygon = (polygon: any): boolean => {
  return isValidPolygonFeature(polygon);
};

/**
 * Unions multiple polygons into a single polygon
 */
const unionPolygons = (polygons: RevealedArea[]): RevealedArea | null => {
  if (polygons.length === 0) return null;
  if (polygons.length === 1) {
    // Validate and sanitize the single polygon
    const sanitized = sanitizeGeometry(polygons[0]);
    return sanitized || polygons[0];
  }

  logger.debug('Unioning multiple polygons', { count: polygons.length });
  let unioned: RevealedArea = polygons[0];
  
  // Validate and sanitize the first polygon
  const sanitizedFirst = sanitizeGeometry(unioned);
  if (sanitizedFirst) {
    unioned = sanitizedFirst;
  } else {
    logger.warn('First polygon failed sanitization, using as-is');
  }
  
  for (let i = 1; i < polygons.length; i++) {
    try {
      const currentPolygon = polygons[i];
      
      // Debug the current polygon
      debugGeometry(currentPolygon, `Union polygon ${i}`);
      
      // Validate current polygon
      if (!isValidPolygonFeature(currentPolygon)) {
        logger.warn(`Skipping invalid polygon at index ${i}`);
        continue;
      }
      
      // Sanitize current polygon
      const sanitizedCurrent = sanitizeGeometry(currentPolygon);
      if (!sanitizedCurrent) {
        logger.warn(`Failed to sanitize polygon at index ${i}, skipping`);
        continue;
      }
      
      // Perform union operation
      const featureCollection = {
        type: 'FeatureCollection' as const,
        features: [unioned, sanitizedCurrent]
      };
      const result = union(featureCollection);
      if (result && result.type === 'Feature') {
        unioned = result as RevealedArea;
        logger.debug(`Successfully unioned polygon ${i}`);
      } else {
        logger.warn(`Union returned null or invalid result for polygon ${i}, skipping`);
      }
    } catch (e) {
      logger.error(`Error unioning polygon ${i}:`, e);
      debugGeometry(polygons[i], `Error - Problematic polygon ${i}`);
      // Continue with the current unioned result, skip the problematic polygon
    }
  }
  
  // Final validation of the result
  if (!isValidPolygonFeature(unioned)) {
    logger.error('Final union result is invalid');
    debugGeometry(unioned, 'Invalid union result');
  } else {
    logger.success('Polygon union completed successfully');
  }
  
  return unioned;
};

/**
 * Loads and processes revealed areas from database
 */
const loadRevealedAreas = async (): Promise<RevealedArea | null> => {
  logger.debug('Loading revealed areas');
  const revealedPolygons = await getRevealedAreas() as RevealedArea[];
  logger.debug('Revealed polygons count:', revealedPolygons.length);
  
  if (revealedPolygons.length === 0) {
    return null;
  }

  logger.debug('Starting polygon validation and union operations');
  
  // Validate each polygon and log details
  const validPolygons = revealedPolygons.filter((polygon, index) => {
    debugGeometry(polygon, `Loaded polygon ${index}`);
    const isValid = isValidPolygonFeature(polygon);
    if (!isValid) {
      logger.warn(`Polygon ${index} failed validation`);
    }
    return isValid;
  });
  
  logger.debug('Valid polygons count:', validPolygons.length);
  
  if (validPolygons.length === 0) {
    logger.warn('No valid polygons found after validation');
    return null;
  }

  const result = unionPolygons(validPolygons);
  
  if (result) {
    debugGeometry(result, 'Final loaded revealed areas');
  }
  
  return result;
};

const MapScreen = () => {
  logger.debug('MapScreen: Component started');
  
  const { location, errorMsg } = useLocationTracking();
  logger.debug('MapScreen: Location state - location:', !!location, 'error:', errorMsg);
  
  // Theme-aware styling
  const colorScheme = useColorScheme();
  const backgroundColor = useThemeColor({ light: '#fff', dark: '#151718' }, 'background');
  const textColor = useThemeColor({ light: '#11181C', dark: '#ECEDEE' }, 'text');
  
  const bufferDistance = 100; // Buffer distance in meters - increased for better visibility
  const mapRef = useRef<MapboxGL.MapView>(null);
  const cameraRef = useRef<MapboxGL.Camera>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [revealedGeoJSON, setRevealedGeoJSON] = useState<Feature<Polygon, GeoJsonProperties> | null>(null);
  const [viewportBounds, setViewportBounds] = useState<[number, number, number, number] | null>(null);
  const [currentMapStyle, setCurrentMapStyle] = useState<string>(MapboxGL.StyleURL.Dark);
  const [isViewportChanging, setIsViewportChanging] = useState(false);
  const hasCenteredRef = useRef(false);
  const viewportUpdateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Gets theme-aware and map-style-aware fog styling for optimal contrast
   */
  const getFogStyling = () => {
    const isDarkTheme = colorScheme === 'dark';
    const isDarkMapStyle = currentMapStyle === MapboxGL.StyleURL.Dark;
    
    // Enhanced fog styling based on theme and map style
    let fogColor: string;
    let fogOpacity: number;
    let edgeColor: string;
    let edgeOpacity: number;
    
    if (isDarkMapStyle) {
      // Dark map style - use darker fog with higher opacity for better contrast
      fogColor = isDarkTheme ? '#0F172A' : '#1E293B'; // Very dark blue-gray
      fogOpacity = 0.85; // Higher opacity for better coverage
      edgeColor = isDarkTheme ? '#334155' : '#475569'; // Lighter edge for definition
      edgeOpacity = 0.6;
    } else {
      // Light map style - use lighter fog with moderate opacity
      fogColor = isDarkTheme ? '#374151' : '#6B7280'; // Medium gray
      fogOpacity = 0.75; // Moderate opacity to not completely obscure light maps
      edgeColor = isDarkTheme ? '#4B5563' : '#9CA3AF'; // Lighter edge
      edgeOpacity = 0.5;
    }
    
    return {
      fill: {
        fillColor: fogColor,
        fillOpacity: fogOpacity,
      },
      edge: {
        lineColor: edgeColor,
        lineOpacity: edgeOpacity,
        lineWidth: 1.5,
        lineBlur: 3, // Softer edge for smoother transitions
      }
    };
  };

  // Effect for initializing DB and fetching existing data
  useEffect(() => {
    logger.debug('MapScreen: Database setup useEffect triggered');
    
    const setup = async () => {
      logger.info('MapScreen: Starting database initialization');
      try {
        await initDatabase();
        logger.success('MapScreen: Database initialized successfully');

        const revealedArea = await loadRevealedAreas();
        if (revealedArea) {
          setRevealedGeoJSON(revealedArea);
        }
      } catch (error) {
        logger.error('MapScreen: Error in database setup:', error);
      }
    };

    setup().catch(error => {
      logger.error('MapScreen: Error in setup promise:', error);
    });
  }, []);

  // Effect to center camera on user location once when map loads
  useEffect(() => {
    if (
      mapLoaded &&
      location &&
      location.coords &&
      cameraRef.current &&
      !hasCenteredRef.current
    ) {
      cameraRef.current.setCamera({
        centerCoordinate: [location.coords.longitude, location.coords.latitude],
        zoomLevel: 17,
        animationMode: 'flyTo',
        animationDuration: 2000,
      });
      hasCenteredRef.current = true;
      logger.info('Camera centered on user location at initial load');
    }
  }, [mapLoaded, location]);

  // Keep track of last processed location to prevent processing same location repeatedly
  const lastProcessedLocationRef = useRef<{lat: number, lon: number} | null>(null);

  /**
   * Checks if the current location is a duplicate of the last processed location
   */
  const isDuplicateLocation = (lat: number, lon: number): boolean => {
    const lastProcessed = lastProcessedLocationRef.current;
    return !!lastProcessed &&
           Math.abs(lastProcessed.lat - lat) < 0.00001 &&
           Math.abs(lastProcessed.lon - lon) < 0.00001;
  };

  /**
   * Creates a new revealed area from the current location
   */
  const createRevealedArea = (lat: number, lon: number): RevealedArea => {
    const newPoint: Feature<Point> = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Point',
        coordinates: [lon, lat]
      }
    };

    logger.debug('Creating buffer around new point');
    return buffer(newPoint, bufferDistance, { units: 'meters' }) as RevealedArea;
  };

  /**
   * Merges new revealed area with existing revealed area
   */
  const mergeRevealedAreas = (newArea: RevealedArea, existingArea: RevealedArea | null): RevealedArea => {
    if (!existingArea) {
      logger.success('First revealed area created');
      // Validate and sanitize the new area
      const sanitized = sanitizeGeometry(newArea);
      return sanitized || newArea;
    }

    try {
      logger.debug('Merging with existing revealed area');
      
      // Debug both areas
      debugGeometry(newArea, 'New revealed area');
      debugGeometry(existingArea, 'Existing revealed area');
      
      // Validate both areas
      if (!isValidPolygonFeature(newArea)) {
        logger.error('New revealed area is invalid, keeping existing area');
        return existingArea;
      }
      
      if (!isValidPolygonFeature(existingArea)) {
        logger.error('Existing revealed area is invalid, using new area');
        const sanitized = sanitizeGeometry(newArea);
        return sanitized || newArea;
      }
      
      // Sanitize both areas
      const sanitizedNew = sanitizeGeometry(newArea);
      const sanitizedExisting = sanitizeGeometry(existingArea);
      
      if (!sanitizedNew) {
        logger.error('Failed to sanitize new area, keeping existing area');
        return existingArea;
      }
      
      if (!sanitizedExisting) {
        logger.error('Failed to sanitize existing area, using new area');
        return sanitizedNew;
      }
      
      // Perform union operation
      const featureCollection = {
        type: 'FeatureCollection' as const,
        features: [sanitizedExisting, sanitizedNew]
      };
      const unioned = union(featureCollection);
      if (unioned && unioned.type === 'Feature') {
        logger.success('Areas successfully merged');
        debugGeometry(unioned, 'Merged revealed areas');
        return unioned as RevealedArea;
      } else {
        logger.warn('Union returned null or invalid result, keeping existing area');
        return existingArea;
      }
    } catch (e) {
      logger.error('Error unioning new area:', e);
      
      // Log additional debugging information
      if (e instanceof Error) {
        logger.error('Merge error details:', {
          message: e.message,
          stack: e.stack
        });
      }
      
      debugGeometry(newArea, 'Error - New area');
      debugGeometry(existingArea, 'Error - Existing area');
      
      return existingArea; // fallback to old one
    }
  };

  // Effect to process new locations and update the revealed area
  useEffect(() => {
    logger.debug('Location effect triggered - location:', !!location, 'coords:', !!location?.coords);
    
    if (location && location.coords) {
      const currentLat = location.coords.latitude;
      const currentLon = location.coords.longitude;
      
      // Check if this is the same location we just processed (to prevent infinite loops)
      if (isDuplicateLocation(currentLat, currentLon)) {
        logger.debug('Skipping duplicate location processing');
        return;
      }
      
      logger.info('Processing new location:', currentLat, currentLon);
      lastProcessedLocationRef.current = { lat: currentLat, lon: currentLon };
      
      const newRevealedArea = createRevealedArea(currentLat, currentLon);
      const updatedRevealedArea = mergeRevealedAreas(newRevealedArea, revealedGeoJSON);

      logger.debug('Updating revealed GeoJSON state');
      setRevealedGeoJSON(updatedRevealedArea);
      
      logger.debug('Saving new revealed area to database');
      saveRevealedArea(newRevealedArea); // Persist only the new area
    }
  }, [location?.coords?.latitude, location?.coords?.longitude]); // Only depend on coordinates, not revealedGeoJSON

  // Cleanup effect for viewport update timeout
  useEffect(() => {
    return () => {
      if (viewportUpdateTimeoutRef.current) {
        clearTimeout(viewportUpdateTimeoutRef.current);
      }
    };
  }, []);

  // Effect to log viewport bounds changes for debugging
  useEffect(() => {
    if (viewportBounds) {
      logger.debug('Viewport bounds changed, fog will be recalculated:', viewportBounds);
    }
  }, [viewportBounds]);

  // Create the fog overlay by creating a worldwide polygon and subtracting the revealed area
  const worldPolygon: Feature<Polygon> = {
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

  /**
   * Gets the current viewport bounds from the map camera
   */
  const getCurrentViewportBounds = async (): Promise<[number, number, number, number] | null> => {
    if (!mapRef.current) {
      logger.debug('Map ref not available for viewport bounds');
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
        
        const bounds: [number, number, number, number] = [actualMinLng, actualMinLat, actualMaxLng, actualMaxLat];
        logger.debug('Viewport bounds (corrected):', bounds);
        return bounds;
      }
    } catch (error) {
      logger.error('Error getting viewport bounds:', error);
    }
    
    return null;
  };

  /**
   * Updates viewport bounds with immediate temporary coverage and debounced final update
   */
  const updateViewportBounds = async () => {
    // Clear any existing timeout
    if (viewportUpdateTimeoutRef.current) {
      clearTimeout(viewportUpdateTimeoutRef.current);
    }

    // Set viewport changing state immediately to prevent flickering
    setIsViewportChanging(true);

    // Debounce the viewport update to avoid excessive recalculations
    viewportUpdateTimeoutRef.current = setTimeout(async () => {
      logger.debug('Updating viewport bounds after debounce');
      const bounds = await getCurrentViewportBounds();
      if (bounds) {
        setViewportBounds(bounds);
        logger.debug('Viewport bounds updated:', bounds);
        
        // Clear the changing state after a brief delay to ensure smooth fog transition
        setTimeout(() => {
          setIsViewportChanging(false);
          logger.debug('Viewport change completed');
        }, 50);
      } else {
        setIsViewportChanging(false);
      }
    }, 200); // Increased debounce to reduce update frequency
  };

  /**
   * Creates a viewport-sized fog polygon instead of world-wide polygon
   */
  const createViewportFogPolygon = (bounds: [number, number, number, number]): Feature<Polygon> => {
    const [minLng, minLat, maxLng, maxLat] = bounds;
    
    // Create a polygon from the bounding box
    const viewportPolygon = bboxPolygon(bounds);
    
    logger.debug('Created viewport fog polygon:', {
      minLng, minLat, maxLng, maxLat
    });
    
    return viewportPolygon;
  };

  /**
   * Filters revealed areas to only include those within or intersecting the viewport
   */
  const getRevealedAreasInViewport = (revealedAreas: RevealedArea, viewportBounds: [number, number, number, number]): RevealedArea | null => {
    if (!revealedAreas || !isValidPolygonFeature(revealedAreas)) {
      return null;
    }

    const [minLng, minLat, maxLng, maxLat] = viewportBounds;
    
    // Create viewport polygon for intersection testing
    const viewportPolygon = bboxPolygon(viewportBounds);
    
    try {
      // For now, we'll return the full revealed areas if they exist
      // In a more advanced implementation, we could use turf/intersect to clip
      // revealed areas to only the viewport portion, but this adds complexity
      // and the current approach should work fine for most use cases
      
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
   * Performs robust difference operation between viewport polygon and revealed areas
   */
  const performRobustDifference = (viewportPolygon: Feature<Polygon>, revealedAreas: RevealedArea): Feature<Polygon | MultiPolygon> | null => {
    const startTime = performance.now();
    
    try {
      logger.debug('Starting robust difference operation');
      
      // Validate both geometries before operation
      if (!isValidPolygonFeature(viewportPolygon)) {
        logger.error('Viewport polygon is invalid for difference operation');
        debugGeometry(viewportPolygon, 'Invalid viewport polygon');
        return null;
      }
      
      if (!isValidPolygonFeature(revealedAreas)) {
        logger.error('Revealed areas are invalid for difference operation');
        debugGeometry(revealedAreas, 'Invalid revealed areas');
        return null;
      }
      
      // Sanitize both geometries
      const sanitizedViewport = sanitizeGeometry(viewportPolygon);
      const sanitizedRevealed = sanitizeGeometry(revealedAreas);
      
      if (!sanitizedViewport) {
        logger.error('Failed to sanitize viewport polygon');
        return null;
      }
      
      if (!sanitizedRevealed) {
        logger.error('Failed to sanitize revealed areas');
        return null;
      }
      
      logger.debug('Performing difference operation between viewport and revealed areas');
      debugGeometry(sanitizedViewport, 'Sanitized viewport polygon');
      debugGeometry(sanitizedRevealed, 'Sanitized revealed areas');
      
      // Perform the difference operation
      // Note: @turf/difference expects a FeatureCollection with exactly two features
      const featureCollection = {
        type: 'FeatureCollection' as const,
        features: [sanitizedViewport, sanitizedRevealed]
      };
      const result = difference(featureCollection);
      
      const endTime = performance.now();
      logger.debug(`Difference operation completed in ${(endTime - startTime).toFixed(2)}ms`);
      
      if (result) {
        logger.success('Difference operation succeeded');
        debugGeometry(result, 'Difference operation result');
        
        // Validate the result
        if (result.type === 'Feature' && 
            (result.geometry.type === 'Polygon' || result.geometry.type === 'MultiPolygon')) {
          return result as Feature<Polygon | MultiPolygon>;
        } else {
          logger.warn('Difference operation returned unexpected geometry type:', result.geometry?.type);
          return null;
        }
      } else {
        logger.warn('Difference operation returned null - revealed areas may completely cover viewport');
        return null;
      }
      
    } catch (error) {
      const endTime = performance.now();
      logger.error(`Difference operation failed after ${(endTime - startTime).toFixed(2)}ms:`, error);
      
      // Log detailed error information
      if (error instanceof Error) {
        logger.error('Difference operation error details:', {
          message: error.message,
          stack: error.stack?.split('\n').slice(0, 5).join('\n') // First 5 lines of stack
        });
      }
      
      // Debug the geometries that caused the error
      debugGeometry(viewportPolygon, 'Error - Viewport polygon');
      debugGeometry(revealedAreas, 'Error - Revealed areas');
      
      return null;
    }
  };

  /**
   * Creates fog overlay features based on revealed areas with robust viewport-based difference operation
   */
  const createFogFeatures = (): Feature<Polygon | MultiPolygon>[] => {
    const startTime = performance.now();
    const fogFeatures: Feature<Polygon | MultiPolygon>[] = [];
    
    logger.debug('Starting fog feature creation');
    
    // During viewport changes, return the current fog to prevent flickering
    // instead of creating new temporary fog
    if (isViewportChanging) {
      logger.debug('Viewport changing - maintaining current fog to prevent flickering');
      // Return a simple viewport fog to maintain coverage without complex calculations
      if (viewportBounds) {
        try {
          const stableFogPolygon = createViewportFogPolygon(viewportBounds);
          fogFeatures.push(stableFogPolygon);
          
          const endTime = performance.now();
          logger.debug(`Stable fog maintained in ${(endTime - startTime).toFixed(2)}ms`);
          return fogFeatures;
        } catch (e) {
          logger.debug('Fallback to world polygon during viewport change');
          fogFeatures.push(worldPolygon);
          return fogFeatures;
        }
      } else {
        // No viewport bounds available, use world polygon
        fogFeatures.push(worldPolygon);
        return fogFeatures;
      }
    }
    
    // Always use viewport-based fog if bounds are available, otherwise fallback to world polygon
    let baseFogPolygon: Feature<Polygon>;
    
    if (viewportBounds) {
      try {
        logger.debug('Creating viewport-based fog overlay');
        baseFogPolygon = createViewportFogPolygon(viewportBounds);
        logger.debug('Successfully created viewport fog polygon');
        debugGeometry(baseFogPolygon, 'Viewport fog polygon');
      } catch (e) {
        logger.error('Error creating viewport fog overlay:', e);
        logger.debug('Falling back to world polygon');
        baseFogPolygon = worldPolygon;
      }
    } else {
      logger.debug('No viewport bounds available, using world polygon');
      baseFogPolygon = worldPolygon;
    }

    // If there are no revealed areas, return the base fog polygon
    if (!revealedGeoJSON) {
      logger.debug('No revealed areas, returning full fog polygon');
      fogFeatures.push(baseFogPolygon);
      
      const endTime = performance.now();
      logger.debug(`Fog creation completed in ${(endTime - startTime).toFixed(2)}ms (no revealed areas)`);
      return fogFeatures;
    }

    // Filter revealed areas to only those in the current viewport (if using viewport-based fog)
    let relevantRevealedAreas: RevealedArea | null = revealedGeoJSON;
    
    if (viewportBounds) {
      const filterStartTime = performance.now();
      relevantRevealedAreas = getRevealedAreasInViewport(revealedGeoJSON, viewportBounds);
      const filterEndTime = performance.now();
      
      logger.debug(`Viewport filtering completed in ${(filterEndTime - filterStartTime).toFixed(2)}ms`);
      
      if (!relevantRevealedAreas) {
        logger.debug('No revealed areas in viewport, returning full fog polygon');
        fogFeatures.push(baseFogPolygon);
        
        const endTime = performance.now();
        logger.debug(`Fog creation completed in ${(endTime - startTime).toFixed(2)}ms (no viewport overlap)`);
        return fogFeatures;
      }
    }

    // Log complexity metrics for revealed areas
    debugGeometry(relevantRevealedAreas, 'Relevant revealed areas');

    // Perform robust difference operation
    try {
      logger.debug('Starting robust difference operation for fog calculation');
      
      const fogWithHoles = performRobustDifference(baseFogPolygon, relevantRevealedAreas);
      
      if (fogWithHoles) {
        logger.success('Successfully created fog with holes using robust difference operation');
        debugGeometry(fogWithHoles, 'Final fog with holes');
        fogFeatures.push(fogWithHoles);
      } else {
        logger.warn('Robust difference operation failed or returned null, using fallback');
        
        // Fallback strategy: return viewport fog (better than world fog for performance)
        if (viewportBounds) {
          try {
            const fallbackFog = createViewportFogPolygon(viewportBounds);
            logger.debug('Using viewport fog as fallback');
            debugGeometry(fallbackFog, 'Fallback viewport fog');
            fogFeatures.push(fallbackFog);
          } catch (fallbackError) {
            logger.error('Fallback viewport fog creation failed:', fallbackError);
            logger.debug('Using world polygon as final fallback');
            fogFeatures.push(worldPolygon);
          }
        } else {
          logger.debug('Using world polygon as fallback');
          fogFeatures.push(worldPolygon);
        }
      }
      
    } catch (e) {
      logger.error('Error in fog feature creation:', e);
      
      // Log additional debugging information
      if (e instanceof Error) {
        logger.error('Fog creation error details:', {
          message: e.message,
          name: e.name,
          stack: e.stack?.split('\n').slice(0, 5).join('\n') // First 5 lines of stack
        });
      }
      
      // Debug the geometries that caused the error
      debugGeometry(baseFogPolygon, 'Error - Base fog polygon');
      debugGeometry(relevantRevealedAreas, 'Error - Relevant revealed areas');
      
      // Final fallback: return viewport fog or world fog
      if (viewportBounds) {
        try {
          const fallbackFog = createViewportFogPolygon(viewportBounds);
          logger.debug('Using viewport fog as error fallback');
          fogFeatures.push(fallbackFog);
        } catch (fallbackError) {
          logger.error('Error fallback viewport fog creation failed:', fallbackError);
          logger.debug('Using world polygon as final error fallback');
          fogFeatures.push(worldPolygon);
        }
      } else {
        logger.debug('Using world polygon as error fallback');
        fogFeatures.push(worldPolygon);
      }
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;
    
    // Log performance metrics
    logger.debug(`Fog creation completed in ${totalTime.toFixed(2)}ms`, {
      performanceLevel: totalTime > 100 ? 'SLOW' : totalTime > 50 ? 'MODERATE' : 'FAST',
      featureCount: fogFeatures.length,
      usedViewportBounds: !!viewportBounds,
      hadRevealedAreas: !!revealedGeoJSON
    });
    
    // Warn if performance is degraded
    if (totalTime > 100) {
      logger.warn(`Fog calculation took ${totalTime.toFixed(2)}ms - consider polygon simplification`);
    }

    return fogFeatures;
  };

  // Initialize fog with world coverage to ensure immediate fog display from first render
  const [fogGeoJSON, setFogGeoJSON] = useState<FeatureCollection<Polygon | import('geojson').MultiPolygon>>(() => ({
    type: 'FeatureCollection',
    features: [worldPolygon], // Start with full world coverage immediately
  }));

  // Debounced fog update to prevent flickering
  const fogUpdateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Update fog when relevant data changes, with debouncing to prevent flickering
  useEffect(() => {
    // Clear any existing fog update timeout
    if (fogUpdateTimeoutRef.current) {
      clearTimeout(fogUpdateTimeoutRef.current);
    }

    // Only update fog if we're not in the middle of a viewport change
    // This prevents flickering during map interactions
    if (!isViewportChanging) {
      fogUpdateTimeoutRef.current = setTimeout(() => {
        const newFogFeatures = createFogFeatures();
        setFogGeoJSON({
          type: 'FeatureCollection',
          features: newFogFeatures,
        });
        logger.debug('Fog updated after debounce');
      }, 100); // Short debounce to prevent rapid updates
    }

    // Cleanup timeout on unmount
    return () => {
      if (fogUpdateTimeoutRef.current) {
        clearTimeout(fogUpdateTimeoutRef.current);
      }
    };
  }, [revealedGeoJSON, viewportBounds, currentMapStyle, isViewportChanging]);

  /**
   * Cycles through different map styles for testing visual appearance
   */
  const cycleMapStyle = () => {
    const styles = [
      MapboxGL.StyleURL.Dark,
      MapboxGL.StyleURL.Light,
      MapboxGL.StyleURL.Street,
      MapboxGL.StyleURL.Satellite,
      MapboxGL.StyleURL.SatelliteStreet,
    ];
    
    const currentIndex = styles.indexOf(currentMapStyle);
    const nextIndex = (currentIndex + 1) % styles.length;
    const nextStyle = styles[nextIndex];
    
    setCurrentMapStyle(nextStyle);
    logger.info('Map style changed to:', nextStyle);
  };

  /**
   * Gets the display name for the current map style
   */
  const getMapStyleName = (): string => {
    switch (currentMapStyle) {
      case MapboxGL.StyleURL.Dark: return 'Dark';
      case MapboxGL.StyleURL.Light: return 'Light';
      case MapboxGL.StyleURL.Street: return 'Street';
      case MapboxGL.StyleURL.Satellite: return 'Satellite';
      case MapboxGL.StyleURL.SatelliteStreet: return 'Satellite Street';
      default: return 'Unknown';
    }
  };

  /**
   * Generates status text based on current location and error state
   */
  const getStatusText = (): string => {
    if (errorMsg) {
      return errorMsg;
    } else if (location) {
      return `Lat: ${location.coords.latitude.toFixed(5)}, Lon: ${location.coords.longitude.toFixed(5)}`;
    }
    return 'Waiting for location...';
  };

  logger.debug('About to render - statusText:', getStatusText());
  logger.debug('Render state - location:', !!location, 'revealedGeoJSON:', !!revealedGeoJSON, 'errorMsg:', errorMsg);

  return (
    <View style={styles.container}>
      <MapboxGL.MapView
        style={styles.map}
        ref={mapRef}
        styleURL={currentMapStyle}
        logoEnabled={false}
        attributionEnabled={false}
        onDidFinishLoadingMap={async () => {
          logger.success('Map finished loading with style:', getMapStyleName());
          setMapLoaded(true);
          
          // Ensure fog is applied immediately when map loads
          if (fogGeoJSON.features.length === 0 || fogGeoJSON.features[0] === worldPolygon) {
            logger.debug('Applying initial fog coverage on map load');
            setFogGeoJSON({
              type: 'FeatureCollection',
              features: [worldPolygon],
            });
          }
          
          // Get initial viewport bounds
          await updateViewportBounds();
        }}
        onRegionWillChange={() => {
          logger.debug('Region will change, preparing for viewport update');
          setIsViewportChanging(true);
        }}
        onRegionDidChange={async () => {
          logger.debug('Region changed, updating viewport bounds');
          await updateViewportBounds();
        }}
      >
        <MapboxGL.Camera
          ref={cameraRef}
          zoomLevel={16}
          centerCoordinate={location ? [location.coords.longitude, location.coords.latitude] : [-111.65926740290008, 33.35623807637663]}
          animationMode={'flyTo'}
          animationDuration={2000}
        />

        {/* Enhanced current location marker with better visibility */}
        {location && (
          <MapboxGL.PointAnnotation
            id="currentLocation"
            coordinate={[location.coords.longitude, location.coords.latitude]}
          >
            <View style={[
              styles.locationDot, 
              { 
                transform: [{ rotate: `${location?.coords.heading || 0}deg` }],
                backgroundColor: colorScheme === 'dark' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(0, 122, 255, 0.3)',
                borderColor: colorScheme === 'dark' ? '#3B82F6' : '#007AFF',
                borderWidth: 2,
              }
            ]}>
              <View style={[
                styles.locationDotCore,
                {
                  backgroundColor: colorScheme === 'dark' ? '#3B82F6' : '#007AFF',
                  borderColor: '#FFFFFF',
                  shadowColor: '#000000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.3,
                  shadowRadius: 4,
                  elevation: 5, // Android shadow
                }
              ]} />
            </View>
          </MapboxGL.PointAnnotation>
        )}

        {/* Fog of war overlay with enhanced styling */}
        <MapboxGL.ShapeSource id="fogSource" shape={fogGeoJSON}>
          <MapboxGL.FillLayer
            id="fogLayer"
            sourceID="fogSource"
            style={getFogStyling().fill}
          />
          <MapboxGL.LineLayer
            id="fogEdgeLayer"
            sourceID="fogSource"
            style={getFogStyling().edge}
          />
        </MapboxGL.ShapeSource>
      </MapboxGL.MapView>
      
      {/* Enhanced status display with map style information */}
      <View style={[styles.statusContainer, { backgroundColor }]}>
        <Text style={[styles.statusText, { color: textColor }]}>
          {getStatusText()}
        </Text>
        <Text style={[styles.mapStyleText, { color: textColor }]}>
          Map Style: {getMapStyleName()}
        </Text>
        <Text 
          style={[styles.styleButton, { color: colorScheme === 'dark' ? '#3B82F6' : '#007AFF' }]}
          onPress={cycleMapStyle}
        >
          Tap to change map style
        </Text>
        <Text style={[styles.zoomHint, { color: textColor, opacity: 0.7 }]}>
          Pinch to zoom • Pan to explore • Fog adapts to viewport
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  statusContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 32, // Extra padding for safe area
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8, // Android shadow
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
    textAlign: 'center',
  },
  mapStyleText: {
    fontSize: 12,
    opacity: 0.8,
    marginBottom: 8,
    textAlign: 'center',
  },
  styleButton: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  zoomHint: {
    fontSize: 10,
    textAlign: 'center',
    marginTop: 4,
    fontStyle: 'italic',
  },
  locationDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationDotCore: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
});

export default MapScreen;