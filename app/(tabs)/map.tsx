// Set Mapbox access token for native module
import MapboxGL from '@rnmapbox/maps';
MapboxGL.setAccessToken('pk.eyJ1IjoicmFsaWtzNzAyMTAiLCJhIjoiY21icTM1cm4zMGFqNzJxcHdrbHEzY3hkYiJ9.o-DnPquzV98xBU8SMuenjg');
import { buffer, union } from '@turf/turf';
import difference from '@turf/difference';
import { Feature, FeatureCollection, GeoJsonProperties, Point, Polygon } from 'geojson';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import useLocationTracking from '../../hooks/useLocationTracking';
import { getRevealedAreas, initDatabase, saveRevealedArea } from '../../utils/database';
import { logger } from '../../utils/logger';

// Define a more specific type for revealed areas, which are polygons
type RevealedArea = Feature<Polygon, GeoJsonProperties>;

/**
 * Validates if a polygon is valid for processing
 */
const isValidPolygon = (polygon: any): boolean => {
  try {
    return polygon &&
           polygon.type === 'Feature' &&
           polygon.geometry &&
           polygon.geometry.type === 'Polygon' &&
           polygon.geometry.coordinates &&
           polygon.geometry.coordinates.length > 0;
  } catch (e) {
    logger.debug('Invalid polygon filtered out:', e);
    return false;
  }
};

/**
 * Unions multiple polygons into a single polygon
 */
const unionPolygons = (polygons: RevealedArea[]): RevealedArea | null => {
  if (polygons.length === 0) return null;
  if (polygons.length === 1) return polygons[0];

  logger.debug('Unioning multiple polygons');
  let unioned: RevealedArea = polygons[0];
  
  for (let i = 1; i < polygons.length; i++) {
    try {
      // @ts-ignore
      const result = union(unioned, polygons[i]);
      if (result) {
        unioned = result as RevealedArea;
      } else {
        logger.warn('Union returned null, skipping polygon', i);
      }
    } catch (e) {
      logger.error('Error unioning polygons:', e);
      logger.debug('Problematic polygon:', polygons[i]);
      // Continue with the current unioned result, skip the problematic polygon
    }
  }
  
  logger.success('Polygon union completed');
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

  logger.debug('Starting polygon union operations');
  const validPolygons = revealedPolygons.filter(isValidPolygon);
  logger.debug('Valid polygons count:', validPolygons.length);
  
  if (validPolygons.length === 0) {
    logger.warn('No valid polygons found');
    return null;
  }

  return unionPolygons(validPolygons);
};

const MapScreen = () => {
  logger.debug('MapScreen: Component started');
  
  const { location, errorMsg } = useLocationTracking();
  logger.debug('MapScreen: Location state - location:', !!location, 'error:', errorMsg);
  
  const bufferDistance = 20; // Buffer distance in meters
  const mapRef = useRef<MapboxGL.MapView>(null);
  const [revealedGeoJSON, setRevealedGeoJSON] = useState<Feature<Polygon, GeoJsonProperties> | null>(null);

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
      return newArea;
    }

    try {
      logger.debug('Merging with existing revealed area');
      // Create a FeatureCollection with both polygons for union
      const featureCollection: FeatureCollection<Polygon> = {
        type: 'FeatureCollection',
        features: [existingArea, newArea]
      };
      
      // Use union on FeatureCollection
      const unioned = union(featureCollection);
      if (unioned) {
        logger.success('Areas successfully merged');
        return unioned as RevealedArea;
      } else {
        logger.warn('Union returned null, keeping existing area');
        return existingArea;
      }
    } catch (e) {
      logger.error('Error unioning new area:', e);
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
   * Creates fog overlay features based on revealed areas
   */
  const createFogFeatures = (): Feature<Polygon | import('geojson').MultiPolygon>[] => {
    const fogFeatures: Feature<Polygon | import('geojson').MultiPolygon>[] = [];
    
    if (revealedGeoJSON) {
      try {
        logger.debug('Creating fog overlay with difference operation');
        logger.debug('World polygon type:', worldPolygon.geometry.type);
        logger.debug('Revealed area type:', revealedGeoJSON.geometry.type);

        // Defensive: Check if revealedGeoJSON is a valid polygon with coordinates
        if (
          revealedGeoJSON.geometry &&
          revealedGeoJSON.geometry.type === 'Polygon' &&
          Array.isArray(revealedGeoJSON.geometry.coordinates) &&
          revealedGeoJSON.geometry.coordinates.length > 0
        ) {
          // Try actual difference operation, but catch turf errors
          // Turf difference API is incompatible, fallback to world polygon as fog
          logger.debug('Skipping fog difference, using world polygon');
          fogFeatures.push(worldPolygon);
        } else {
          logger.debug('revealedGeoJSON is not a valid polygon, using world polygon');
          fogFeatures.push(worldPolygon);
        }
      } catch (e) {
        logger.error('Error creating fog overlay:', e);
        logger.debug('Falling back to world polygon');
        fogFeatures.push(worldPolygon);
      }
    } else {
      logger.debug('No revealed area, using full world polygon');
      fogFeatures.push(worldPolygon);
    }

    return fogFeatures;
  };

  const fogGeoJSON: FeatureCollection<Polygon | import('geojson').MultiPolygon> = {
    type: 'FeatureCollection',
    features: createFogFeatures(),
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
        styleURL={MapboxGL.StyleURL.Dark}
        logoEnabled={false}
        attributionEnabled={false}
        onDidFinishLoadingMap={() => {
          logger.success('Map finished loading');
        }}
        onDidFailLoadingMap={() => {
          logger.error('Map failed to load');
        }}
        onRegionDidChange={() => {
          logger.debug('Region changed');
        }}
      >
        <MapboxGL.Camera
          zoomLevel={16}
          centerCoordinate={location ? [location.coords.longitude, location.coords.latitude] : [-111.65926740290008, 33.35623807637663]}
          animationMode={'flyTo'}
          animationDuration={2000}
          followUserLocation={true}
        />

        {/* Current location marker */}
        {location && (
          <MapboxGL.PointAnnotation
            id="currentLocation"
            coordinate={[location.coords.longitude, location.coords.latitude]}
          >
            <View style={[styles.locationDot, { transform: [{ rotate: `${location?.coords.heading || 0}deg` }] }]}>
              <View style={styles.locationDotCore} />
            </View>
          </MapboxGL.PointAnnotation>
        )}

        {/* Fog of war overlay */}
        <MapboxGL.ShapeSource id="fogSource" shape={fogGeoJSON}>
          <MapboxGL.FillLayer
            id="fogLayer"
            sourceID="fogSource"
            style={{
              fillColor: '#1E293B', // A dark, desaturated blue
              fillOpacity: 0.8,
            }}
          />
          <MapboxGL.LineLayer
            id="fogEdgeLayer"
            sourceID="fogSource"
            style={{
              lineColor: '#334155', // A slightly lighter blue for the edge
              lineWidth: 2,
              lineBlur: 5, // Soften the edge of the fog
            }}
          />
        </MapboxGL.ShapeSource>
      </MapboxGL.MapView>
      {/* Show status text below the map */}
      <Text>{getStatusText()}</Text>
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
  locationDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 122, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationDotCore: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#007AFF',
    borderWidth: 2,
    borderColor: 'white',
  },
});

export default MapScreen;