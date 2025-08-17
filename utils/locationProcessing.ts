import { buffer } from '@turf/turf';
import { LocationObject } from 'expo-location';
import { Feature, Point } from 'geojson';

import { saveRevealedArea } from '@/utils/database';
import { logger } from '@/utils/logger';

/**
 * Utility functions for processing location data and managing revealed areas
 */

/**
 * Checks if the current location is a duplicate of the last processed location
 * to prevent infinite loops and unnecessary processing.
 * 
 * @param currentLocation - Current location coordinates
 * @param lastProcessed - Last processed location coordinates
 * @param tolerance - Tolerance for duplicate detection (default: 0.00001)
 * @returns True if the location is a duplicate within tolerance
 */
export const isDuplicateLocation = (
  currentLocation: { lat: number; lon: number },
  lastProcessed: { lat: number; lon: number } | null,
  tolerance: number = 0.00001
): boolean => {
  return !!lastProcessed &&
         Math.abs(lastProcessed.lat - currentLocation.lat) < tolerance &&
         Math.abs(lastProcessed.lon - currentLocation.lon) < tolerance;
};

/**
 * Processes a new location by creating a revealed area and saving it to the database
 * 
 * @param location - Location object from GPS
 * @param bufferDistance - Buffer distance in meters (default: 100)
 * @returns Promise that resolves when the location is processed
 */
export const processNewLocation = async (
  location: LocationObject,
  bufferDistance: number = 100
): Promise<void> => {
  if (!location?.coords) {
    logger.error('Invalid location provided to processNewLocation');
    return;
  }

  const { latitude, longitude } = location.coords;
  
  logger.info('Processing new location:', latitude, longitude);
  
  // Create point feature for the new location
  const newPoint: Feature<Point> = {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Point',
      coordinates: [longitude, latitude]
    }
  };
  
  // Create buffer around the point
  const newRevealedArea = buffer(newPoint, bufferDistance, { units: 'meters' });
  
  if (newRevealedArea) {
    await saveRevealedArea(newRevealedArea);
    logger.info('New revealed area saved for location:', latitude, longitude);
  } else {
    logger.error('Failed to create buffer for new location:', latitude, longitude);
    throw new Error('Failed to create revealed area buffer');
  }
};