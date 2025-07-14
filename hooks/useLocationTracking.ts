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
        await database.runAsync(
          'INSERT INTO locations (latitude, longitude, timestamp) VALUES (?, ?, ?)',
          [receivedLocation.coords.latitude, receivedLocation.coords.longitude, receivedLocation.timestamp]
        );
        console.log('Location saved to database');
      } catch (dbError) {
        console.error('Error saving location to database:', dbError);
      }
    }
  }
});

export default function useLocationTracking() {
  console.log('📍 useLocationTracking: Hook started');
  
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    console.log('⚡ useLocationTracking: useEffect triggered');
    
    const requestLocationPermission = async () => {
      console.log('🔐 useLocationTracking: Requesting foreground permission');
      try {
        const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
        console.log('🔐 useLocationTracking: Foreground permission status:', foregroundStatus);
        
        if (foregroundStatus !== 'granted') {
          console.log('❌ useLocationTracking: Foreground permission denied');
          setErrorMsg('Permission to access location was denied');
          return;
        }

        console.log('🔐 useLocationTracking: Requesting background permission');
        const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
        console.log('🔐 useLocationTracking: Background permission status:', backgroundStatus);
        
        if (backgroundStatus !== 'granted') {
          console.log('❌ useLocationTracking: Background permission denied');
          setErrorMsg('Permission to access background location was denied');
          return;
        }

        console.log('🚀 useLocationTracking: Starting location updates');
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
        console.log('✅ useLocationTracking: Location updates started');

        console.log('📍 useLocationTracking: Getting current position');
        // Get the current location to initialize the state
        const currentLocation = await Location.getCurrentPositionAsync({});
        console.log('📍 useLocationTracking: Current location obtained:', currentLocation);
        setLocation(currentLocation);
      } catch (error) {
        console.error('❌ useLocationTracking: Error in requestLocationPermission:', error);
        setErrorMsg(`Location error: ${error}`);
      }
    };

    console.log('👀 useLocationTracking: Setting up location watch');
    // Subscribe to location updates from the background task
    const subscription = Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        distanceInterval: 10,
      },
      (newLocation) => {
        console.log('📍 useLocationTracking: New location received:', newLocation);
        setLocation(newLocation);
      }
    );

    requestLocationPermission().catch(error => {
      console.error('❌ useLocationTracking: Error in requestLocationPermission promise:', error);
    });

    return () => {
      console.log('🧹 useLocationTracking: Cleanup started');
      // Clean up subscription and background task
      (async () => {
        try {
          const isTaskRunning = await TaskManager.isTaskRegisteredAsync(LOCATION_TRACKING_TASK_NAME);
          console.log('🧹 useLocationTracking: Task running status:', isTaskRunning);
          if(isTaskRunning) {
            Location.stopLocationUpdatesAsync(LOCATION_TRACKING_TASK_NAME);
          }
          (await subscription).remove();
          console.log('✅ useLocationTracking: Cleanup completed');
        } catch (error) {
          console.error('❌ useLocationTracking: Error in cleanup:', error);
        }
      })();
    };
  }, []);

  console.log('📍 useLocationTracking: Returning state - location:', !!location, 'error:', errorMsg);
  return { location, errorMsg };
}