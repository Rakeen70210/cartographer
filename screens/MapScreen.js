import MapboxGL from '@rnmapbox/maps';
import * as turf from '@turf/turf';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import useLocationTracking from '../hooks/useLocationTracking';
import { database, getLocations, getRevealedAreas, initDatabase, saveRevealedArea } from '../utils/database';
const { buffer, intersect, lineString, union, difference } = turf;

// Set Mapbox access token (should be configured in app.json via plugin)
// MapboxGL.setAccessToken('YOUR_MAPBOX_ACCESS_TOKEN'); // Not needed if using Expo config plugin

const LOCATION_TRACKING_TASK_NAME = 'location-tracking';

// Define the task outside the component to ensure it's registered correctly
TaskManager.defineTask(LOCATION_TRACKING_TASK_NAME, ({ data, error }) => {
  if (error) {
    console.error('Location tracking task error:', error);
    return;
  }
  if (data && data.locations) {
    const receivedLocation = data.locations[0];
    console.log('Received new location:', receivedLocation);
    // Save the location to the database
    database.transaction(tx => {
      tx.executeSql(
        'INSERT INTO locations (latitude, longitude, timestamp) VALUES (?, ?, ?)',
        [receivedLocation.coords.latitude, receivedLocation.coords.longitude, receivedLocation.timestamp],
        (_, { rowsAffected }) => {
          if (rowsAffected > 0) {
            console.log('Location saved to database');
          } else {
            console.log('Failed to save location to database');
          }
        },
        (_, error) => {
          console.error('Error saving location to database:', error);
          return true; // Roll back transaction
        }
      );
    });
  }
});

const MapScreen = () => {
  const { location, errorMsg } = useLocationTracking();
  const [pathData, setPathData] = useState([]); // pathData is still useful for knowing visited locations
  const bufferDistance = 20; // Buffer distance in meters around the path for spatial analysis
  const mapRef = useRef(null);
  const [visitedStreetsGeoJSON, setVisitedStreetsGeoJSON] = useState({ type: 'FeatureCollection', features: [] });
  const [fogGeoJSON, setFogGeoJSON] = useState({ type: 'FeatureCollection', features: [] });

  // Effect for fetching existing locations from the database
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const data = await getLocations();
        // Store raw path data for later use in identifying visited streets
        setPathData(data.map(loc => ({ latitude: loc.latitude, longitude: loc.longitude })));
      } catch (error) {
        console.error('Error fetching locations:', error);
        // Optionally, handle error state here if needed
      }
    };

    fetchLocations();
  }, []); // Empty dependency array means this runs once on mount
  // Utility to load turf only once and reuse it
  let turfModule = null;
  const getTurf = async () => {
    if (!turfModule) {
      turfModule = await import('@turf/turf');
    }
    return turfModule;
  };
  
  // Initialize DB and load revealed areas
  useEffect(() => {
    const setup = async () => {
      await initDatabase();
      // Load all revealed areas
      const revealedPolygons = await getRevealedAreas();
      if (revealedPolygons.length > 0) {
        // Union all revealed polygons
        const turf = await getTurf();
        let unioned = revealedPolygons[0];
        for (let i = 1; i < revealedPolygons.length; i++) {
          try {
            unioned = turf.union(unioned, revealedPolygons[i]);
          } catch (e) {
            // fallback: skip invalid
          }
        }
        setFogGeoJSON({ type: 'FeatureCollection', features: [unioned] });
      }
    };
    setup();
  }, []);

  // Effect to process pathData and generate GeoJSON for visited streets and fog
  useEffect(() => {
    const processPathDataAndGenerateGeoJSON = async () => {
      const map = mapRef.current;
      if (map && pathData.length > 0) {
        try {
          const bounds = await map.getVisibleBounds();
          // bounds: [[minLng, minLat], [maxLng, maxLat]]
          const minLng = bounds[0][0];
          const minLat = bounds[0][1];
          const maxLng = bounds[1][0];
          const maxLat = bounds[1][1];
          // Create a rectangular polygon covering the visible map area
          const fogPolygon = {
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: [[
                [minLng, minLat],
                [maxLng, minLat],
                [maxLng, maxLat],
                [minLng, maxLat],
                [minLng, minLat]
              ]]
            },
            properties: {}
          };
          // Convert pathData to GeoJSON LineString
          const coordinates = pathData.map(loc => [loc.longitude, loc.latitude]);
          const pathLineString = lineString(coordinates);
          // Create a buffer around the path
          const bufferedPath = buffer(pathLineString, bufferDistance, { units: 'meters' });
          // Subtract the buffered path from the fog polygon
          let revealed;
          try {
            const turf = await getTurf();
            revealed = turf.difference(fogPolygon, bufferedPath);
          } catch (e) {
            revealed = null;
          }
          // Debounce saveRevealedArea to avoid excessive writes
          if (bufferedPath && bufferedPath.geometry && bufferedPath.geometry.coordinates.length > 0) {
            if (saveRevealedArea.debounceTimeout) {
              clearTimeout(saveRevealedArea.debounceTimeout);
            }
            saveRevealedArea.debounceTimeout = setTimeout(() => {
              saveRevealedArea(bufferedPath);
            }, 1000); // 1 second debounce
          }
          // Set fogGeoJSON to the remaining fog (if difference worked), else just the fogPolygon
          setFogGeoJSON({
            type: 'FeatureCollection',
            features: revealed ? [revealed] : [fogPolygon]
          });

          // Query rendered features in the visible bounds, focusing on road layers
          // Layer IDs might vary depending on the Mapbox style.
          const queriedFeatures = await map.queryRenderedFeaturesInRect(bounds, null, ['road-street', 'road-secondary', 'road-primary', 'road-highway']);
          console.log('Queried features:', queriedFeatures);

          const visitedStreetFeatures = [];

          // Iterate through queried features and check for intersection with buffered path
          for (const feature of queriedFeatures) {
            // Ensure the feature is a LineString (street segment)
            if (feature.geometry && feature.geometry.type === 'LineString') {
              try {
                // Check if the street segment intersects the buffered path
                if (intersect(feature, bufferedPath)) {
                  visitedStreetFeatures.push(feature);
                }
              } catch (error) {
                console.warn('Error checking intersection for feature:', feature, error);
              }
            }
          }

        } catch (error) {
          console.error('Error querying map features:', error);
        }

        // Placeholder for generated GeoJSON - replace with actual logic output
        const generatedGeoJSON = { type: 'FeatureCollection', features: [] };
        setVisitedStreetsGeoJSON(generatedGeoJSON);
      }
    };

    processPathDataAndGenerateGeoJSON();
  }, [pathData]); // Rerun when pathData changes

  // Determine the status text to display
  let statusText = 'Waiting for location...';
  if (errorMsg) {
    statusText = errorMsg;
  } else if (location) {
    statusText = `Lat: ${location.coords.latitude.toFixed(5)}, Lon: ${location.coords.longitude.toFixed(5)}`;
  }

  return (
    <View style={styles.container}>
      <Text>{statusText}</Text>
      <MapboxGL.MapView
        style={styles.map}
        ref={mapRef}
        styleURL={MapboxGL.StyleURL.Street}
      >
        <MapboxGL.Camera
          zoomLevel={14}
          centerCoordinate={[-122.4324, 37.78825]}
          animationMode={'flyTo'}
          animationDuration={0}
        />
        {/* Accuracy indicator */}
        {location && location.coords.accuracy && (
          <MapboxGL.ShapeSource
            id="accuracyCircleSource"
            shape={{
              type: 'FeatureCollection',
              features: [
                {
                  type: 'Feature',
                  geometry: {
                    type: 'Point',
                    coordinates: [location.coords.longitude, location.coords.latitude],
                  },
                  properties: {},
                },
              ],
            }}
          >
            <MapboxGL.CircleLayer
              id="accuracyCircleLayer"
              sourceID="accuracyCircleSource"
              style={{
                circleRadius: location.coords.accuracy, // meters
                circleColor: 'rgba(0,122,255,0.15)',
                circleOpacity: 0.4,
                circleStrokeWidth: 0,
              }}
            />
          </MapboxGL.ShapeSource>
        )}
        {/* Heading indicator (cone) */}
        {location && location.coords.heading !== undefined && !isNaN(location.coords.heading) && (
          <MapboxGL.ShapeSource
            id="headingConeSource"
            shape={{
              type: 'FeatureCollection',
              features: [
                {
                  type: 'Feature',
                  geometry: {
                    type: 'Polygon',
                    coordinates: [[
                      [location.coords.longitude, location.coords.latitude],
                      // Calculate two points 30 degrees left/right of heading, 0.0005 deg away
                      [
                        location.coords.longitude + 0.0005 * Math.cos((location.coords.heading - 30) * Math.PI / 180),
                        location.coords.latitude + 0.0005 * Math.sin((location.coords.heading - 30) * Math.PI / 180),
                      ],
                      [
                        location.coords.longitude + 0.0005 * Math.cos((location.coords.heading + 30) * Math.PI / 180),
                        location.coords.latitude + 0.0005 * Math.sin((location.coords.heading + 30) * Math.PI / 180),
                      ],
                      [location.coords.longitude, location.coords.latitude],
                    ]],
                  },
                  properties: {},
                },
              ],
            }}
          >
            <MapboxGL.FillLayer
              id="headingConeLayer"
              sourceID="headingConeSource"
              style={{
                fillColor: 'rgba(0,122,255,0.25)',
                fillOpacity: 0.5,
              }}
            />
          </MapboxGL.ShapeSource>
        )}
        {/* Current location marker */}
        {location && (
          <MapboxGL.PointAnnotation
            id="currentLocation"
            coordinate={[location.coords.longitude, location.coords.latitude]}
          >
            <View style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: 'rgba(0,122,255,0.9)',
              borderWidth: 3,
              borderColor: 'white',
            }} />
          </MapboxGL.PointAnnotation>
        )}
        {/* Fog of war overlay */}
        <MapboxGL.ShapeSource id="fogSource" shape={fogGeoJSON}>
          <MapboxGL.FillLayer
            id="fogLayer"
            sourceID="fogSource"
            style={{ fillColor: 'rgba(0,0,0,0.5)', fillOpacity: 0.5 }}
          />
        </MapboxGL.ShapeSource>
        {/* Visited streets visualization */}
        <MapboxGL.ShapeSource
          id="visitedStreetsSource"
          shape={visitedStreetsGeoJSON}
        >
          <MapboxGL.LineLayer
            id="visitedStreetsLayer"
            sourceID="visitedStreetsSource"
            style={{ lineColor: 'green', lineWidth: 4 }}
          />
        </MapboxGL.ShapeSource>

      </MapboxGL.MapView>
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
});

export default MapScreen;