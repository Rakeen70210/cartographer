import { logger } from './logger';

export interface Location {
  id: number;
  latitude: number;
  longitude: number;
  timestamp: number;
}

export interface DistanceResult {
  miles: number;
  kilometers: number;
}

/**
 * Calculate the distance between two points using the Haversine formula
 * @param lat1 Latitude of first point in degrees
 * @param lon1 Longitude of first point in degrees
 * @param lat2 Latitude of second point in degrees
 * @param lon2 Longitude of second point in degrees
 * @returns Distance in meters
 */
export const calculateHaversineDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  // Earth's radius in meters
  const EARTH_RADIUS_METERS = 6371000;

  // Convert degrees to radians
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lon1Rad = (lon1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;
  const lon2Rad = (lon2 * Math.PI) / 180;

  // Calculate differences
  const deltaLat = lat2Rad - lat1Rad;
  const deltaLon = lon2Rad - lon1Rad;

  // Haversine formula
  const a = 
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) *
    Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  // Distance in meters
  return EARTH_RADIUS_METERS * c;
};

/**
 * Convert meters to miles
 * @param meters Distance in meters
 * @returns Distance in miles
 */
export const metersToMiles = (meters: number): number => {
  const METERS_PER_MILE = 1609.344;
  return meters / METERS_PER_MILE;
};

/**
 * Convert meters to kilometers
 * @param meters Distance in meters
 * @returns Distance in kilometers
 */
export const metersToKilometers = (meters: number): number => {
  return meters / 1000;
};

/**
 * Convert miles to meters
 * @param miles Distance in miles
 * @returns Distance in meters
 */
export const milesToMeters = (miles: number): number => {
  const METERS_PER_MILE = 1609.344;
  return miles * METERS_PER_MILE;
};

/**
 * Convert kilometers to meters
 * @param kilometers Distance in kilometers
 * @returns Distance in meters
 */
export const kilometersToMeters = (kilometers: number): number => {
  return kilometers * 1000;
};

/**
 * Calculate total distance traveled from a series of location points
 * @param locations Array of location objects sorted by timestamp
 * @returns Promise resolving to distance in miles and kilometers
 */
export const calculateTotalDistance = async (locations: Location[]): Promise<DistanceResult> => {
  try {
    logger.debug('DistanceCalculator: Starting total distance calculation', { locationCount: locations.length });

    if (!locations || locations.length < 2) {
      logger.debug('DistanceCalculator: Insufficient locations for distance calculation');
      return { miles: 0, kilometers: 0 };
    }

    // Sort locations by timestamp to ensure proper order
    const sortedLocations = [...locations].sort((a, b) => a.timestamp - b.timestamp);

    let totalDistanceMeters = 0;

    // Calculate distance between consecutive points
    for (let i = 1; i < sortedLocations.length; i++) {
      const prevLocation = sortedLocations[i - 1];
      const currentLocation = sortedLocations[i];

      const segmentDistance = calculateHaversineDistance(
        prevLocation.latitude,
        prevLocation.longitude,
        currentLocation.latitude,
        currentLocation.longitude
      );

      totalDistanceMeters += segmentDistance;

      logger.debug('DistanceCalculator: Segment distance calculated', {
        from: { lat: prevLocation.latitude, lon: prevLocation.longitude },
        to: { lat: currentLocation.latitude, lon: currentLocation.longitude },
        distanceMeters: segmentDistance
      });
    }

    const result: DistanceResult = {
      miles: metersToMiles(totalDistanceMeters),
      kilometers: metersToKilometers(totalDistanceMeters)
    };

    logger.success('DistanceCalculator: Total distance calculation completed', {
      totalDistanceMeters,
      miles: result.miles,
      kilometers: result.kilometers
    });

    return result;
  } catch (error) {
    logger.error('DistanceCalculator: Error calculating total distance:', error);
    throw new Error(`Failed to calculate total distance: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Format distance for display with appropriate precision
 * @param distance Distance value
 * @param unit Unit of measurement ('miles' or 'kilometers')
 * @returns Formatted distance string
 */
export const formatDistance = (distance: number, unit: 'miles' | 'kilometers'): string => {
  if (distance === 0) {
    return `0 ${unit === 'miles' ? 'miles' : 'km'}`;
  }

  // Use appropriate precision based on distance magnitude
  let precision = 1;
  if (distance >= 1000) {
    precision = 0; // No decimal places for large distances
  } else if (distance >= 100) {
    precision = 1; // One decimal place for medium distances
  } else {
    precision = 2; // Two decimal places for small distances
  }

  const formatted = distance.toLocaleString('en-US', {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision
  });

  return `${formatted} ${unit === 'miles' ? 'miles' : 'km'}`;
};

/**
 * Validate location coordinates
 * @param latitude Latitude value
 * @param longitude Longitude value
 * @returns True if coordinates are valid
 */
export const validateCoordinates = (latitude: number, longitude: number): boolean => {
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    !isNaN(latitude) &&
    !isNaN(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
};