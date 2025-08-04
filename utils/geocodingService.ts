import * as Location from 'expo-location';
import {
    deleteExpiredLocationGeocodings,
    getLocationGeocoding,
    saveLocationGeocoding
} from './database';
import { logger } from './logger';

export interface GeographicRegion {
  country?: string;
  countryCode?: string;
  state?: string;
  stateCode?: string;
  city?: string;
  region?: string;
  district?: string;
}

export interface GeocodingResult extends GeographicRegion {
  latitude: number;
  longitude: number;
  timestamp: number;
  source: 'api' | 'cache' | 'offline';
}

export interface GeocodingOptions {
  useCache?: boolean;
  cacheMaxAge?: number; // in milliseconds
  timeout?: number; // in milliseconds
  fallbackToOffline?: boolean;
}

// Default options for geocoding
const DEFAULT_OPTIONS: Required<GeocodingOptions> = {
  useCache: true,
  cacheMaxAge: 24 * 60 * 60 * 1000, // 24 hours
  timeout: 10000, // 10 seconds
  fallbackToOffline: true
};

/**
 * Reverse geocode coordinates to get geographic region information
 * @param latitude Latitude coordinate
 * @param longitude Longitude coordinate
 * @param options Geocoding options
 * @returns Promise resolving to geographic region information
 */
export const reverseGeocode = async (
  latitude: number,
  longitude: number,
  options: GeocodingOptions = {}
): Promise<GeocodingResult> => {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  try {
    logger.debug('GeocodingService: Starting reverse geocoding', { 
      latitude, 
      longitude, 
      options: opts 
    });

    // Validate coordinates
    if (!isValidCoordinate(latitude, longitude)) {
      throw new Error(`Invalid coordinates: ${latitude}, ${longitude}`);
    }

    // Check cache first if enabled
    if (opts.useCache) {
      const cachedResult = await getCachedGeocoding(latitude, longitude, opts.cacheMaxAge);
      if (cachedResult) {
        logger.debug('GeocodingService: Using cached result', { latitude, longitude });
        return {
          ...cachedResult,
          latitude,
          longitude,
          timestamp: cachedResult.timestamp,
          source: 'cache'
        };
      }
    }

    // Try API geocoding
    try {
      const apiResult = await performApiGeocoding(latitude, longitude, opts.timeout);
      
      // Cache the result if caching is enabled
      if (opts.useCache) {
        await cacheGeocodingResult(latitude, longitude, apiResult);
      }

      logger.success('GeocodingService: API geocoding successful', { 
        latitude, 
        longitude, 
        result: apiResult 
      });

      return {
        ...apiResult,
        latitude,
        longitude,
        timestamp: Date.now(),
        source: 'api'
      };

    } catch (apiError) {
      logger.warn('GeocodingService: API geocoding failed', { 
        latitude, 
        longitude, 
        error: apiError instanceof Error ? apiError.message : 'Unknown error' 
      });

      // Fallback to offline data if enabled
      if (opts.fallbackToOffline) {
        const offlineResult = await getOfflineGeocoding(latitude, longitude);
        if (offlineResult) {
          logger.debug('GeocodingService: Using offline fallback', { latitude, longitude });
          return {
            ...offlineResult,
            latitude,
            longitude,
            timestamp: Date.now(),
            source: 'offline'
          };
        }
      }

      // If all methods fail, throw the original API error
      throw apiError;
    }

  } catch (error) {
    logger.error('GeocodingService: Reverse geocoding failed:', error);
    throw new Error(`Failed to reverse geocode coordinates ${latitude}, ${longitude}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Perform API-based reverse geocoding using multiple sources with fallback
 * @param latitude Latitude coordinate
 * @param longitude Longitude coordinate
 * @param timeout Timeout in milliseconds
 * @returns Promise resolving to geographic region information
 */
const performApiGeocoding = async (
  latitude: number,
  longitude: number,
  timeout: number
): Promise<GeographicRegion> => {
  return new Promise(async (resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Geocoding timeout after ${timeout}ms`));
    }, timeout);

    try {
      // First try the geographic API service (Nominatim)
      try {
        const nominatimResult = await tryNominatimGeocoding(latitude, longitude);
        if (nominatimResult) {
          clearTimeout(timeoutId);
          resolve(nominatimResult);
          return;
        }
      } catch (nominatimError) {
        logger.debug('GeocodingService: Nominatim geocoding failed, trying Expo Location');
      }

      // Fallback to Expo Location service
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        clearTimeout(timeoutId);
        reject(new Error('Location permission not granted'));
        return;
      }

      // Perform reverse geocoding with Expo Location
      const result = await Location.reverseGeocodeAsync({
        latitude,
        longitude
      });

      clearTimeout(timeoutId);

      if (!result || result.length === 0) {
        reject(new Error('No geocoding results found'));
        return;
      }

      // Extract the first (most accurate) result
      const location = result[0];
      
      const geocodingResult: GeographicRegion = {
        country: location.country || undefined,
        countryCode: location.isoCountryCode || undefined,
        state: location.region || undefined,
        city: location.city || undefined,
        region: location.subregion || undefined,
        district: location.district || undefined
      };

      resolve(geocodingResult);

    } catch (error) {
      clearTimeout(timeoutId);
      reject(error);
    }
  });
};

/**
 * Try geocoding using Nominatim API through the geographic service
 */
const tryNominatimGeocoding = async (
  latitude: number,
  longitude: number
): Promise<GeographicRegion | null> => {
  try {
    // Import the geographic API service dynamically to avoid circular dependency
    const { geographicApiService } = await import('./geographicApiService');
    
    // Check connectivity first
    const isOnline = await geographicApiService.checkConnectivity();
    if (!isOnline) {
      logger.debug('GeocodingService: Device is offline, skipping Nominatim');
      return null;
    }

    // Use Nominatim for reverse geocoding
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Cartographer/1.0 (https://github.com/cartographer-app)'
      },
      signal: AbortSignal.timeout(8000)
    });

    if (!response.ok) {
      logger.debug(`GeocodingService: Nominatim API returned ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    if (!data || !data.address) {
      logger.debug('GeocodingService: No address data in Nominatim response');
      return null;
    }

    const address = data.address;
    
    return {
      country: address.country || undefined,
      countryCode: address.country_code?.toUpperCase() || undefined,
      state: address.state || address.region || address.province || undefined,
      stateCode: address.state_code || undefined,
      city: address.city || address.town || address.village || undefined,
      region: address.county || address.district || undefined,
      district: address.suburb || address.neighbourhood || undefined
    };

  } catch (error) {
    logger.debug('GeocodingService: Nominatim reverse geocoding failed:', error);
    return null;
  }
};

/**
 * Get cached geocoding result if available and not expired
 * @param latitude Latitude coordinate
 * @param longitude Longitude coordinate
 * @param maxAge Maximum age in milliseconds
 * @returns Promise resolving to cached result or null
 */
const getCachedGeocoding = async (
  latitude: number,
  longitude: number,
  maxAge: number
): Promise<GeographicRegion | null> => {
  try {
    // Clean up expired entries periodically
    await deleteExpiredLocationGeocodings(maxAge);

    // Look for exact coordinate match (within small tolerance)
    const tolerance = 0.0001; // ~11 meters
    const cached = await getLocationGeocoding(
      Math.round(latitude / tolerance) * tolerance,
      Math.round(longitude / tolerance) * tolerance
    );

    if (!cached) {
      return null;
    }

    // Check if cache entry is still valid
    const age = Date.now() - cached.timestamp;
    if (age > maxAge) {
      return null;
    }

    return {
      country: cached.country || undefined,
      state: cached.state || undefined,
      city: cached.city || undefined
    };

  } catch (error) {
    logger.debug('GeocodingService: Error retrieving cached geocoding:', error);
    return null;
  }
};

/**
 * Cache geocoding result in database
 * @param latitude Latitude coordinate
 * @param longitude Longitude coordinate
 * @param result Geocoding result to cache
 */
const cacheGeocodingResult = async (
  latitude: number,
  longitude: number,
  result: GeographicRegion
): Promise<void> => {
  try {
    // Round coordinates to reduce cache size and improve hit rate
    const tolerance = 0.0001; // ~11 meters
    const roundedLat = Math.round(latitude / tolerance) * tolerance;
    const roundedLon = Math.round(longitude / tolerance) * tolerance;

    await saveLocationGeocoding(
      roundedLat,
      roundedLon,
      result.country,
      result.state,
      result.city
    );

    logger.debug('GeocodingService: Cached geocoding result', { 
      latitude: roundedLat, 
      longitude: roundedLon 
    });

  } catch (error) {
    logger.warn('GeocodingService: Failed to cache geocoding result:', error);
    // Don't throw error - caching failure shouldn't break the main flow
  }
};

/**
 * Get offline geocoding data (basic fallback based on coordinate ranges)
 * @param latitude Latitude coordinate
 * @param longitude Longitude coordinate
 * @returns Promise resolving to basic geographic information or null
 */
const getOfflineGeocoding = async (
  latitude: number,
  longitude: number
): Promise<GeographicRegion | null> => {
  try {
    // Basic offline geocoding using coordinate ranges
    // This is a simplified fallback - in a production app, you might use
    // a local database of geographic boundaries
    
    const region = getRegionFromCoordinates(latitude, longitude);
    if (region) {
      logger.debug('GeocodingService: Offline geocoding successful', { 
        latitude, 
        longitude, 
        region 
      });
      return region;
    }

    return null;

  } catch (error) {
    logger.debug('GeocodingService: Offline geocoding failed:', error);
    return null;
  }
};

/**
 * Get basic region information from coordinates using simple ranges
 * This is a basic fallback implementation
 * @param latitude Latitude coordinate
 * @param longitude Longitude coordinate
 * @returns Basic geographic region or null
 */
const getRegionFromCoordinates = (
  latitude: number,
  longitude: number
): GeographicRegion | null => {
  // Basic coordinate-based region detection
  // This is a simplified implementation for offline fallback
  
  // North America
  if (latitude >= 25 && latitude <= 72 && longitude >= -168 && longitude <= -52) {
    // Canada (more specific check first)
    if (latitude >= 41.7 && latitude <= 72 && longitude >= -141 && longitude <= -52) {
      return { country: 'Canada', countryCode: 'CA' };
    } else if (latitude >= 25 && latitude <= 49 && longitude >= -125 && longitude <= -66) {
      return { country: 'United States', countryCode: 'US' };
    } else if (latitude >= 14 && latitude <= 33 && longitude >= -118 && longitude <= -86) {
      return { country: 'Mexico', countryCode: 'MX' };
    }
  }

  // Europe (simplified)
  if (latitude >= 35 && latitude <= 71 && longitude >= -10 && longitude <= 40) {
    return { country: 'Europe' }; // Generic Europe for offline fallback
  }

  // Asia (simplified)
  if (latitude >= -10 && latitude <= 55 && longitude >= 60 && longitude <= 180) {
    return { country: 'Asia' }; // Generic Asia for offline fallback
  }

  // Australia
  if (latitude >= -44 && latitude <= -10 && longitude >= 113 && longitude <= 154) {
    return { country: 'Australia', countryCode: 'AU' };
  }

  // South America (simplified)
  if (latitude >= -56 && latitude <= 13 && longitude >= -82 && longitude <= -34) {
    return { country: 'South America' }; // Generic South America for offline fallback
  }

  // Africa (simplified)
  if (latitude >= -35 && latitude <= 37 && longitude >= -18 && longitude <= 52) {
    return { country: 'Africa' }; // Generic Africa for offline fallback
  }

  return null;
};

/**
 * Extract country, state, and city from geocoding result
 * @param result Geocoding result
 * @returns Object with extracted geographic information
 */
export const extractGeographicInfo = (result: GeocodingResult): {
  country: string | null;
  state: string | null;
  city: string | null;
} => {
  return {
    country: result.country || null,
    state: result.state || null,
    city: result.city || null
  };
};

/**
 * Batch geocode multiple coordinates
 * @param coordinates Array of coordinate pairs
 * @param options Geocoding options
 * @returns Promise resolving to array of geocoding results
 */
export const batchReverseGeocode = async (
  coordinates: Array<{ latitude: number; longitude: number }>,
  options: GeocodingOptions = {}
): Promise<GeocodingResult[]> => {
  logger.debug('GeocodingService: Starting batch reverse geocoding', { 
    coordinateCount: coordinates.length 
  });

  const results: GeocodingResult[] = [];
  const batchSize = 5; // Process in small batches to avoid overwhelming the API

  for (let i = 0; i < coordinates.length; i += batchSize) {
    const batch = coordinates.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (coord) => {
      try {
        return await reverseGeocode(coord.latitude, coord.longitude, options);
      } catch (error) {
        logger.warn('GeocodingService: Batch geocoding failed for coordinate', { 
          coordinate: coord, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
        // Return a result with minimal information for failed geocoding
        return {
          latitude: coord.latitude,
          longitude: coord.longitude,
          timestamp: Date.now(),
          source: 'offline' as const
        };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // Add small delay between batches to be respectful to the API
    if (i + batchSize < coordinates.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  logger.success('GeocodingService: Batch reverse geocoding completed', { 
    totalCoordinates: coordinates.length,
    successfulResults: results.filter(r => r.country).length
  });

  return results;
};

/**
 * Validate coordinate values
 * @param latitude Latitude value
 * @param longitude Longitude value
 * @returns True if coordinates are valid
 */
export const isValidCoordinate = (latitude: number, longitude: number): boolean => {
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
 * Clean up expired geocoding cache entries
 * @param maxAge Maximum age in milliseconds (default: 30 days)
 */
export const cleanupGeocodingCache = async (maxAge: number = 30 * 24 * 60 * 60 * 1000): Promise<void> => {
  try {
    await deleteExpiredLocationGeocodings(maxAge);
    logger.debug('GeocodingService: Cleaned up expired geocoding cache entries');
  } catch (error) {
    logger.warn('GeocodingService: Failed to cleanup geocoding cache:', error);
  }
};