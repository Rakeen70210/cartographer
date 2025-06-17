import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Text, Platform } from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { database, getLocations } from '../utils/database';
import { buffer, intersect, lineString, featureCollection } from '@turf/turf';

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
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [pathData, setPathData] = useState([]); // pathData is still useful for knowing visited locations
  const bufferDistance = 20; // Buffer distance in meters around the path for spatial analysis
  const mapRef = useRef(null);
  const [visitedStreetsGeoJSON, setVisitedStreetsGeoJSON] = useState({ type: 'FeatureCollection', features: [] });

  // Effect for handling permissions and starting/stopping location tracking
  useEffect(() => {
    // Request permissions and start tracking
    const requestLocationPermission = async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        return;
      }

      let { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      if (backgroundStatus !== 'granted') {
        setErrorMsg('Permission to access location in background was denied');
        return;
      }

      // Check if the task is already defined before attempting to start it
      const isTaskDefined = await TaskManager.isTaskDefined(LOCATION_TRACKING_TASK_NAME);
       if (!isTaskDefined) {
         // This case should ideally not happen if the task is defined outside
         console.warn('Location tracking task was not defined outside the component.');
         // If it wasn't, you might want to define it here as a fallback, but the outside definition is preferred.
       }

      await Location.startLocationUpdatesAsync(LOCATION_TRACKING_TASK_NAME, {
        accuracy: Location.Accuracy.High,
        distanceInterval: 10, // Get updates every 10 meters
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: 'Cartographer',
          notificationBody: 'Tracking your path in the background',
          notificationColor: '#007bff',
        },
      });

      // Optionally, get the initial location right away
      let currentLocation = await Location.getCurrentPositionAsync({});
      setLocation(currentLocation);
    };

    requestLocationPermission();

    // Cleanup function to stop location updates when the component unmounts
    return () => {
      Location.stopLocationUpdatesAsync(LOCATION_TRACKING_TASK_NAME);
    };
  }, []); // Empty dependency array means this runs once on mount and cleans up on unmount

  // Effect for fetching existing locations from the database
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const data = await getLocations();
        // Store raw path data for later use in identifying visited streets
        setPathData(data.map(loc => ({ latitude: loc.latitude, longitude: loc.longitude })));
      } catch (error) {
        console.error('Error fetching locations:', error);
        setErrorMsg('Error loading past locations.');
      }
    };

    fetchLocations();
  }, []); // Empty dependency array means this runs once on mount


  // Effect to process pathData and generate GeoJSON for visited streets
  useEffect(() => {
    const processPathDataAndGenerateGeoJSON = async () => {
      const map = mapRef.current;
      if (map && pathData.length > 0) {
        // TODO: Implement logic to interact with Mapbox GL to identify
        console.log('Processing path data to generate visited streets GeoJSON...');

        try {
          const bounds = await map.getVisibleBounds();
          console.log('Visible bounds:', bounds);

          // Convert pathData to GeoJSON LineString
          const coordinates = pathData.map(loc => [loc.longitude, loc.latitude]);
          const pathLineString = lineString(coordinates);

          // Create a buffer around the path
          const bufferedPath = buffer(pathLineString, bufferDistance, { units: 'meters' });

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
          centerCoordinate={[-122.4324, 37.78825]} // Example coordinates (San Francisco)
          animationMode={'flyTo'}
          animationDuration={0}
        />

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