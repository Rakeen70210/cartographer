import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { useEffect, useState } from 'react';
import { database } from '../utils/database';

const LOCATION_TRACKING_TASK_NAME = 'location-tracking';

// Define the task outside of the hook
TaskManager.defineTask(LOCATION_TRACKING_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('Location tracking task error:', error);
    return;
  }
  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    const receivedLocation = locations[0];
    if (receivedLocation) {
      console.log('Received new location:', receivedLocation);
      // Save the location to the database
      try {
        await database.transactionAsync(async tx => {
          await tx.executeSqlAsync(
            'INSERT INTO locations (latitude, longitude, timestamp) VALUES (?, ?, ?)',
            [receivedLocation.coords.latitude, receivedLocation.coords.longitude, receivedLocation.timestamp]
          );
        });
        console.log('Location saved to database');
      } catch (dbError) {
        console.error('Error saving location to database:', dbError);
      }
    }
  }
});

export default function useLocationTracking() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const requestLocationPermission = async () => {
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      if (foregroundStatus !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        return;
      }

      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      if (backgroundStatus !== 'granted') {
        setErrorMsg('Permission to access background location was denied');
        return;
      }

      // Start location updates
      await Location.startLocationUpdatesAsync(LOCATION_TRACKING_TASK_NAME, {
        accuracy: Location.Accuracy.BestForNavigation,
        distanceInterval: 10, // In meters
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: 'Cartographer',
          notificationBody: 'Tracking your path to uncover the world.',
          notificationColor: '#333333',
        },
      });

      // Get the current location to initialize the state
      const currentLocation = await Location.getCurrentPositionAsync({});
      setLocation(currentLocation);
    };

    // Subscribe to location updates from the background task
    const subscription = Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        distanceInterval: 10,
      },
      (newLocation) => {
        setLocation(newLocation);
      }
    );

    requestLocationPermission();

    return () => {
      // Clean up subscription and background task
      (async () => {
        const isTaskRunning = await TaskManager.isTaskRegisteredAsync(LOCATION_TRACKING_TASK_NAME);
        if(isTaskRunning) {
          Location.stopLocationUpdatesAsync(LOCATION_TRACKING_TASK_NAME);
        }
        (await subscription).remove();
      })();
    };
  }, []);

  return { location, errorMsg };
}