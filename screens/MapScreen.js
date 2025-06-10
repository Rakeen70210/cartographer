import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import MapView, { Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { database, getLocations } from '../utils/database';

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
  const [pathData, setPathData] = useState([]);

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
        setPathData(data.map(loc => ({ latitude: loc.latitude, longitude: loc.longitude })));
      } catch (error) {
        console.error('Error fetching locations:', error);
        setErrorMsg('Error loading past locations.');
      }
    };

    fetchLocations();
  }, []); // Empty dependency array means this runs once on mount


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
      <MapView
        style={{ flex: 1 }}
        initialRegion={{
          latitude: 37.78825, // Example latitude (San Francisco)
          longitude: -122.4324, // Example longitude (San Francisco)
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }}
      >
        {/* Render the fetched path data as a Polyline */}
        <Polyline
          coordinates={pathData}
          strokeColor="#FF0000" // Red color for the path
          strokeWidth={3}
        />
      </MapView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default MapScreen;