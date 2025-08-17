import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { useEffect, useState } from 'react';

import { database } from '@/utils/database';
import { logger } from '@/utils/logger';

const LOCATION_TRACKING_TASK_NAME = 'location-tracking';

// Define the task outside of the hook
TaskManager.defineTask(LOCATION_TRACKING_TASK_NAME, async ({ data, error }) => {
  if (error) {
    logger.error('Location tracking task error:', error);
    return;
  }
  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    const receivedLocation = locations[0];
    if (receivedLocation) {
      logger.info('Received new location:', receivedLocation);
      // Save the location to the database
      try {
        await database.runAsync(
          'INSERT INTO locations (latitude, longitude, timestamp) VALUES (?, ?, ?)',
          [receivedLocation.coords.latitude, receivedLocation.coords.longitude, receivedLocation.timestamp]
        );
        logger.success('Location saved to database');
      } catch (dbError) {
        logger.error('Error saving location to database:', dbError);
      }
    }
  }
});

/**
 * Requests foreground and background location permissions
 */
const requestLocationPermissions = async (setErrorMsg: (msg: string) => void): Promise<boolean> => {
  logger.debug('Requesting foreground permission');
  try {
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    logger.debug('Foreground permission status:', foregroundStatus);
    
    if (foregroundStatus !== 'granted') {
      logger.warn('Foreground permission denied');
      setErrorMsg('Permission to access location was denied');
      return false;
    }

    logger.debug('Requesting background permission');
    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    logger.debug('Background permission status:', backgroundStatus);
    
    if (backgroundStatus !== 'granted') {
      logger.warn('Background permission denied');
      setErrorMsg('Permission to access background location was denied');
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Error requesting permissions:', error);
    setErrorMsg(`Permission error: ${error}`);
    return false;
  }
};

/**
 * Starts location tracking with background task
 */
const startLocationTracking = async (): Promise<void> => {
  logger.debug('Starting location updates');
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
  logger.success('Location updates started');
};

/**
 * Gets current location and sets initial state
 */
const getCurrentLocation = async (setLocation: (loc: Location.LocationObject) => void): Promise<void> => {
  logger.debug('Getting current position');
  const currentLocation = await Location.getCurrentPositionAsync({});
  logger.debug('Current location obtained:', currentLocation);
  setLocation(currentLocation);
};

/**
 * Sets up location watching subscription
 */
const setupLocationWatch = (setLocation: (loc: Location.LocationObject) => void) => {
  logger.debug('Setting up location watch');
  return Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.BestForNavigation,
      distanceInterval: 10,
    },
    (newLocation) => {
      logger.debug('New location received:', newLocation);
      setLocation(newLocation);
    }
  );
};

/**
 * Cleans up location tracking resources
 */
const cleanupLocationTracking = async (subscription: Promise<Location.LocationSubscription>): Promise<void> => {
  logger.debug('Cleanup started');
  try {
    const isTaskRunning = await TaskManager.isTaskRegisteredAsync(LOCATION_TRACKING_TASK_NAME);
    logger.debug('Task running status:', isTaskRunning);
    if (isTaskRunning) {
      await Location.stopLocationUpdatesAsync(LOCATION_TRACKING_TASK_NAME);
    }
    (await subscription).remove();
    logger.success('Cleanup completed');
  } catch (error) {
    logger.error('Error in cleanup:', error);
  }
};

/**
 * Custom hook for managing location tracking with background support.
 * Handles permission requests, location watching, and background task management.
 * 
 * @returns Object containing current location and any error messages
 */
export default function useLocationTracking() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let subscription: Promise<Location.LocationSubscription> | null = null;
    
    const initializeLocationTracking = async () => {
      if (!isMounted) return;
      
      // Request permissions
      const hasPermissions = await requestLocationPermissions(setErrorMsg);
      if (!hasPermissions || !isMounted) {
        return;
      }

      try {
        // Start location tracking
        await startLocationTracking();
        
        if (!isMounted) return;
        
        // Get current location
        await getCurrentLocation(setLocation);
      } catch (error) {
        if (isMounted) {
          logger.error('Error in initializeLocationTracking:', error);
          setErrorMsg(`Location error: ${error}`);
        }
      }
    };

    // Set up location watch subscription
    subscription = setupLocationWatch(setLocation);

    // Initialize location tracking
    initializeLocationTracking().catch(error => {
      if (isMounted) {
        logger.error('Error in initializeLocationTracking promise:', error);
      }
    });

    return () => {
      isMounted = false;
      if (subscription) {
        cleanupLocationTracking(subscription).catch(error => {
          logger.error('Error in cleanup:', error);
        });
      }
    };
  }, []);

  return { location, errorMsg };
}