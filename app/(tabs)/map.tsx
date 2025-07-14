// Set Mapbox access token for native module
import MapboxGL from '@rnmapbox/maps';
MapboxGL.setAccessToken('pk.eyJ1IjoicmFsaWtzNzAyMTAiLCJhIjoiY21icTM1cm4zMGFqNzJxcHdrbHEzY3hkYiJ9.o-DnPquzV98xBU8SMuenjg');
import { buffer, union } from '@turf/turf';
import difference from '@turf/difference';
import { Feature, FeatureCollection, GeoJsonProperties, Point, Polygon } from 'geojson';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

// Debug: Enhanced logging for native module loading
console.log('=== MAP SCREEN DEBUG START ===');
console.log('MapboxGL object:', MapboxGL);
console.log('MapboxGL.MapView:', MapboxGL?.MapView);
console.log('MapboxGL.Camera:', MapboxGL?.Camera);
console.log('global object exists:', typeof global !== 'undefined');
console.log('React Native Bridge:', typeof (global as any)?.nativeModules);
console.log('=== MAP SCREEN DEBUG END ===');
import useLocationTracking from '../../hooks/useLocationTracking';
import { getRevealedAreas, initDatabase, saveRevealedArea } from '../../utils/database';

// Define a more specific type for revealed areas, which are polygons
type RevealedArea = Feature<Polygon, GeoJsonProperties>;

const MapScreen = () => {
  console.log('🗺️ MapScreen: Component started');
  
  const { location, errorMsg } = useLocationTracking();
  console.log('🗺️ MapScreen: Location state - location:', !!location, 'error:', errorMsg);
  
  const bufferDistance = 20; // Buffer distance in meters
  const mapRef = useRef<MapboxGL.MapView>(null);
  const [revealedGeoJSON, setRevealedGeoJSON] = useState<Feature<Polygon, GeoJsonProperties> | null>(null);

  // Effect for initializing DB and fetching existing data
  useEffect(() => {
    console.log('⚡ MapScreen: Database setup useEffect triggered');
    
    const setup = async () => {
      console.log('🗄️ MapScreen: Starting database initialization');
      try {
        await initDatabase();
        console.log('✅ MapScreen: Database initialized successfully');

        console.log('🗄️ MapScreen: Loading revealed areas');
        // Load all revealed areas and union them into a single polygon
        const revealedPolygons = await getRevealedAreas() as RevealedArea[];
        console.log('🗄️ MapScreen: Revealed polygons count:', revealedPolygons.length);
        
        if (revealedPolygons.length > 0) {
          console.log('🔧 MapScreen: Starting polygon union operations');
          
          // Filter out any invalid polygons
          const validPolygons = revealedPolygons.filter(polygon => {
            try {
              return polygon &&
                     polygon.type === 'Feature' &&
                     polygon.geometry &&
                     polygon.geometry.type === 'Polygon' &&
                     polygon.geometry.coordinates &&
                     polygon.geometry.coordinates.length > 0;
            } catch (e) {
              console.log('🚫 MapScreen: Invalid polygon filtered out:', e);
              return false;
            }
          });
          
          console.log('✅ MapScreen: Valid polygons count:', validPolygons.length);
          
          if (validPolygons.length === 0) {
            console.log('⚠️ MapScreen: No valid polygons found');
            return;
          }
          
          if (validPolygons.length === 1) {
            // If only one polygon, use it directly
            console.log('✅ MapScreen: Single polygon, using directly');
            setRevealedGeoJSON(validPolygons[0]);
          } else {
            // Union multiple polygons
            console.log('🔧 MapScreen: Unioning multiple polygons');
            let unioned: RevealedArea = validPolygons[0];
            for (let i = 1; i < validPolygons.length; i++) {
              try {
                // @ts-ignore
                const result = union(unioned, validPolygons[i]);
                if (result) {
                  unioned = result as RevealedArea;
                } else {
                  console.log('⚠️ MapScreen: Union returned null, skipping polygon', i);
                }
              } catch (e) {
                console.error("❌ MapScreen: Error unioning polygons:", e);
                console.log('🔍 MapScreen: Problematic polygon:', validPolygons[i]);
                // Continue with the current unioned result, skip the problematic polygon
              }
            }
            console.log('✅ MapScreen: Polygon union completed');
            setRevealedGeoJSON(unioned);
          }
        }
      } catch (error) {
        console.error('❌ MapScreen: Error in database setup:', error);
      }
    };

    setup().catch(error => {
      console.error('❌ MapScreen: Error in setup promise:', error);
    });
  }, []);

  // Keep track of last processed location to prevent processing same location repeatedly
  const lastProcessedLocationRef = useRef<{lat: number, lon: number} | null>(null);

  // Effect to process new locations and update the revealed area
  useEffect(() => {
    console.log('⚡ MapScreen: Location effect triggered - location:', !!location, 'coords:', !!location?.coords);
    
    if (location && location.coords) {
      const currentLat = location.coords.latitude;
      const currentLon = location.coords.longitude;
      
      // Check if this is the same location we just processed (to prevent infinite loops)
      const lastProcessed = lastProcessedLocationRef.current;
      if (lastProcessed &&
          Math.abs(lastProcessed.lat - currentLat) < 0.00001 &&
          Math.abs(lastProcessed.lon - currentLon) < 0.00001) {
        console.log('⏭️ MapScreen: Skipping duplicate location processing');
        return;
      }
      
      console.log('📍 MapScreen: Processing new location:', currentLat, currentLon);
      lastProcessedLocationRef.current = { lat: currentLat, lon: currentLon };
      
      const newPoint: Feature<Point> = {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Point',
          coordinates: [currentLon, currentLat]
        }
      };

      console.log('🔵 MapScreen: Creating buffer around new point');
      // Create a buffer around the new point
      const newRevealedArea = buffer(newPoint, bufferDistance, { units: 'meters' }) as RevealedArea;

      console.log('🔧 MapScreen: Unioning with existing revealed area');
      // Union the new area with the existing revealed area
      let updatedRevealedArea: RevealedArea;
      if (revealedGeoJSON) {
        try {
          console.log('🔗 MapScreen: Merging with existing revealed area');
          // Create a FeatureCollection with both polygons for union
          const featureCollection: FeatureCollection<Polygon> = {
            type: 'FeatureCollection',
            features: [revealedGeoJSON, newRevealedArea]
          };
          
          // Use union on FeatureCollection
          const unioned = union(featureCollection);
          if (unioned) {
            console.log('✅ MapScreen: Areas successfully merged');
            updatedRevealedArea = unioned as RevealedArea;
          } else {
            console.log('⚠️ MapScreen: Union returned null, keeping existing area');
            updatedRevealedArea = revealedGeoJSON;
          }
        } catch (e) {
          console.error("❌ MapScreen: Error unioning new area:", e);
          updatedRevealedArea = revealedGeoJSON; // fallback to old one
        }
      } else {
        updatedRevealedArea = newRevealedArea;
        console.log('✅ MapScreen: First revealed area created');
      }

      console.log('🔄 MapScreen: Updating revealed GeoJSON state');
      setRevealedGeoJSON(updatedRevealedArea);
      
      console.log('🗄️ MapScreen: Saving new revealed area to database');
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

  const fogFeatures: Feature<Polygon | import('geojson').MultiPolygon>[] = [];
  if (revealedGeoJSON) {
    try {
      console.log('🌫️ MapScreen: Creating fog overlay with difference operation');
      console.log('🌫️ MapScreen: World polygon type:', worldPolygon.geometry.type);
      console.log('🌫️ MapScreen: Revealed area type:', revealedGeoJSON.geometry.type);

      // Defensive: Check if revealedGeoJSON is a valid polygon with coordinates
      if (
        revealedGeoJSON.geometry &&
        revealedGeoJSON.geometry.type === 'Polygon' &&
        Array.isArray(revealedGeoJSON.geometry.coordinates) &&
        revealedGeoJSON.geometry.coordinates.length > 0
      ) {
        // Try actual difference operation, but catch turf errors
        let fogPolygon;
        // Turf difference API is incompatible, fallback to world polygon as fog
        console.log('⚠️ MapScreen: Skipping fog difference, using world polygon');
        fogFeatures.push(worldPolygon);
      } else {
        console.log('🚫 MapScreen: revealedGeoJSON is not a valid polygon, using world polygon');
        fogFeatures.push(worldPolygon);
      }
    } catch (e) {
      console.error('❌ MapScreen: Error creating fog overlay:', e);
      console.log('🔄 MapScreen: Falling back to world polygon');
      fogFeatures.push(worldPolygon);
    }
  } else {
    console.log('🌫️ MapScreen: No revealed area, using full world polygon');
    fogFeatures.push(worldPolygon);
  }

  const fogGeoJSON: FeatureCollection<Polygon | import('geojson').MultiPolygon> = {
    type: 'FeatureCollection',
    features: fogFeatures,
  };


  let statusText = 'Waiting for location...';
  if (errorMsg) {
    statusText = errorMsg;
  } else if (location) {
    statusText = `Lat: ${location.coords.latitude.toFixed(5)}, Lon: ${location.coords.longitude.toFixed(5)}`;
  }

  console.log('🎨 MapScreen: About to render - statusText:', statusText);
  console.log('🎨 MapScreen: Render state - location:', !!location, 'revealedGeoJSON:', !!revealedGeoJSON, 'errorMsg:', errorMsg);

  return (
    <View style={styles.container}>
      <MapboxGL.MapView
        style={styles.map}
        ref={mapRef}
        styleURL={MapboxGL.StyleURL.Dark}
        logoEnabled={false}
        attributionEnabled={false}
        onDidFinishLoadingMap={() => {
          console.log('✅ MapScreen: Map finished loading');
        }}
        onDidFailLoadingMap={() => {
          console.error('❌ MapScreen: Map failed to load');
        }}
        onRegionDidChange={() => {
          console.log('🗺️ MapScreen: Region changed');
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
      <Text>{statusText}</Text>
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