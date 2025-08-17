import { logger } from '@/utils/logger';

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
 * 
 * BEHAVIOR CHANGE (Test Fix): Enhanced input validation to return NaN for invalid coordinates
 * instead of throwing errors, maintaining consistency with mathematical operations.
 * This fixes test failures where invalid coordinates caused unexpected exceptions.
 * 
 * Input validation improvements:
 * - Returns NaN for invalid coordinate values (NaN, undefined, out of range)
 * - Maintains mathematical consistency with other calculation functions
 * - Prevents exceptions that could break distance calculation chains
 * - Allows calling code to handle NaN results appropriately
 * 
 * @param lat1 Latitude of first point in degrees
 * @param lon1 Longitude of first point in degrees
 * @param lat2 Latitude of second point in degrees
 * @param lon2 Longitude of second point in degrees
 * @returns Distance in meters, or NaN if coordinates are invalid
 */
export const calculateHaversineDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  // Validate input coordinates
  if (!validateCoordinates(lat1, lon1) || !validateCoordinates(lat2, lon2)) {
    // Return NaN for invalid coordinates to maintain consistency with existing behavior
    return NaN;
  }

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
    let validSegments = 0;
    let invalidSegments = 0;

    // Process in chunks to avoid blocking the event loop for large datasets
    const CHUNK_SIZE = 1000;

    for (let chunkStart = 1; chunkStart < sortedLocations.length; chunkStart += CHUNK_SIZE) {
      const chunkEnd = Math.min(chunkStart + CHUNK_SIZE, sortedLocations.length);

      // Calculate distance between consecutive points in this chunk
      for (let i = chunkStart; i < chunkEnd; i++) {
        const prevLocation = sortedLocations[i - 1];
        const currentLocation = sortedLocations[i];

        // Validate that location objects have required properties
        if (!prevLocation || !currentLocation ||
          typeof prevLocation.latitude !== 'number' ||
          typeof prevLocation.longitude !== 'number' ||
          typeof currentLocation.latitude !== 'number' ||
          typeof currentLocation.longitude !== 'number') {
          invalidSegments++;
          continue;
        }

        const segmentDistance = calculateHaversineDistance(
          prevLocation.latitude,
          prevLocation.longitude,
          currentLocation.latitude,
          currentLocation.longitude
        );

        // Skip NaN distances (from invalid coordinates)
        if (!isNaN(segmentDistance)) {
          totalDistanceMeters += segmentDistance;
          validSegments++;
        } else {
          invalidSegments++;
        }
      }

      // Yield control to prevent blocking for large datasets
      if (chunkEnd < sortedLocations.length) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    const result: DistanceResult = {
      miles: metersToMiles(totalDistanceMeters),
      kilometers: metersToKilometers(totalDistanceMeters)
    };

    logger.success('DistanceCalculator: Total distance calculation completed', {
      totalDistanceMeters,
      miles: result.miles,
      kilometers: result.kilometers,
      validSegments,
      invalidSegments
    });

    return result;
  } catch (error) {
    logger.error('DistanceCalculator: Error calculating total distance:', error);
    throw new Error(`Failed to calculate total distance: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Format distance for display with appropriate precision
 * 
 * BEHAVIOR CHANGE (Test Fix): Enhanced to handle negative distances, NaN, and Infinity values.
 * This fixes test failures where special numeric values were not formatted correctly.
 * 
 * Special value handling:
 * - Negative distances maintain proper precision formatting
 * - NaN values display as "NaN miles" or "NaN km"
 * - Infinity values display as "Infinity miles" or "Infinity km"
 * - -Infinity values display as "-Infinity miles" or "-Infinity km"
 * - Zero values display as "0 miles" or "0 km"
 * 
 * Precision logic:
 * - Large distances (≥1000): no decimal places
 * - Medium distances (100-999): 1 decimal place
 * - Small distances (<100): 2 decimal places
 * - Precision applied consistently for both positive and negative values
 * 
 * @param distance Distance value
 * @param unit Unit of measurement ('miles' or 'kilometers')
 * @returns Formatted distance string
 */
export const formatDistance = (distance: number, unit: 'miles' | 'kilometers'): string => {
  if (distance === 0) {
    return `0 ${unit === 'miles' ? 'miles' : 'km'}`;
  }

  // Handle special cases
  if (isNaN(distance)) return `NaN ${unit === 'miles' ? 'miles' : 'km'}`;
  if (distance === Infinity) return `Infinity ${unit === 'miles' ? 'miles' : 'km'}`;
  if (distance === -Infinity) return `-Infinity ${unit === 'miles' ? 'miles' : 'km'}`;

  // Use appropriate precision based on distance magnitude (use absolute value for precision logic)
  const absDistance = Math.abs(distance);
  let precision = 2; // Default to 2 decimal places for small distances
  if (absDistance >= 1000) {
    precision = 0; // No decimal places for large distances
  } else if (absDistance >= 100) {
    precision = 1; // One decimal place for medium distances
  }

  // Format with proper precision
  // For small distances (< 100), always show the specified precision with trailing zeros
  // For medium distances (100-999), show 1 decimal place with trailing zeros
  // For large distances (>= 1000), show no decimal places
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

/**
 * Validate a location object
 * @param location Location object to validate
 * @returns True if location object is valid
 */
export const validateLocation = (location: any): location is Location => {
  return (
    location &&
    typeof location === 'object' &&
    typeof location.id === 'number' &&
    typeof location.timestamp === 'number' &&
    validateCoordinates(location.latitude, location.longitude)
  );
};