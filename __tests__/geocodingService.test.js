import {
    batchReverseGeocode,
    cleanupGeocodingCache,
    extractGeographicInfo,
    isValidCoordinate,
    reverseGeocode
} from '../utils/geocodingService';

// Mock expo-location
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  reverseGeocodeAsync: jest.fn()
}));

// Mock database functions
jest.mock('../utils/database', () => ({
  saveLocationGeocoding: jest.fn(),
  getLocationGeocoding: jest.fn(),
  deleteExpiredLocationGeocodings: jest.fn()
}));

import * as Location from 'expo-location';
import * as Database from '../utils/database';

describe('Geocoding Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isValidCoordinate', () => {
    test('validates correct coordinates', () => {
      expect(isValidCoordinate(40.7128, -74.0060)).toBe(true);
      expect(isValidCoordinate(0, 0)).toBe(true);
      expect(isValidCoordinate(90, 180)).toBe(true);
      expect(isValidCoordinate(-90, -180)).toBe(true);
    });

    test('rejects invalid latitude', () => {
      expect(isValidCoordinate(91, 0)).toBe(false);
      expect(isValidCoordinate(-91, 0)).toBe(false);
      expect(isValidCoordinate(NaN, 0)).toBe(false);
    });

    test('rejects invalid longitude', () => {
      expect(isValidCoordinate(0, 181)).toBe(false);
      expect(isValidCoordinate(0, -181)).toBe(false);
      expect(isValidCoordinate(0, NaN)).toBe(false);
    });

    test('rejects non-numeric values', () => {
      expect(isValidCoordinate('40.7128', -74.0060)).toBe(false);
      expect(isValidCoordinate(40.7128, '-74.0060')).toBe(false);
      expect(isValidCoordinate(null, 0)).toBe(false);
      expect(isValidCoordinate(undefined, 0)).toBe(false);
    });
  });

  describe('extractGeographicInfo', () => {
    test('extracts geographic information correctly', () => {
      const result = {
        latitude: 40.7128,
        longitude: -74.0060,
        timestamp: Date.now(),
        source: 'api',
        country: 'United States',
        countryCode: 'US',
        state: 'New York',
        city: 'New York City'
      };

      const extracted = extractGeographicInfo(result);
      
      expect(extracted.country).toBe('United States');
      expect(extracted.state).toBe('New York');
      expect(extracted.city).toBe('New York City');
    });

    test('handles missing information gracefully', () => {
      const result = {
        latitude: 40.7128,
        longitude: -74.0060,
        timestamp: Date.now(),
        source: 'api'
      };

      const extracted = extractGeographicInfo(result);
      
      expect(extracted.country).toBe(null);
      expect(extracted.state).toBe(null);
      expect(extracted.city).toBe(null);
    });

    test('handles partial information', () => {
      const result = {
        latitude: 40.7128,
        longitude: -74.0060,
        timestamp: Date.now(),
        source: 'api',
        country: 'United States',
        state: 'New York'
        // city is missing
      };

      const extracted = extractGeographicInfo(result);
      
      expect(extracted.country).toBe('United States');
      expect(extracted.state).toBe('New York');
      expect(extracted.city).toBe(null);
    });
  });

  describe('reverseGeocode', () => {
    test('rejects invalid coordinates', async () => {
      await expect(reverseGeocode(91, 0)).rejects.toThrow('Invalid coordinates');
      await expect(reverseGeocode(0, 181)).rejects.toThrow('Invalid coordinates');
      await expect(reverseGeocode(NaN, 0)).rejects.toThrow('Invalid coordinates');
    });

    test('uses cached result when available', async () => {
      const cachedResult = {
        id: 1,
        latitude: 40.7128,
        longitude: -74.0060,
        country: 'United States',
        state: 'New York',
        city: 'New York City',
        timestamp: Date.now()
      };

      Database.getLocationGeocoding.mockResolvedValue(cachedResult);
      Database.deleteExpiredLocationGeocodings.mockResolvedValue();

      const result = await reverseGeocode(40.7128, -74.0060);

      expect(result.source).toBe('cache');
      expect(result.country).toBe('United States');
      expect(result.state).toBe('New York');
      expect(result.city).toBe('New York City');
      expect(Database.getLocationGeocoding).toHaveBeenCalled();
    });

    test('performs API geocoding when cache miss', async () => {
      Database.getLocationGeocoding.mockResolvedValue(null);
      Database.deleteExpiredLocationGeocodings.mockResolvedValue();
      Database.saveLocationGeocoding.mockResolvedValue();

      Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
      Location.reverseGeocodeAsync.mockResolvedValue([{
        country: 'United States',
        isoCountryCode: 'US',
        region: 'New York',
        city: 'New York City'
      }]);

      const result = await reverseGeocode(40.7128, -74.0060);

      expect(result.source).toBe('api');
      expect(result.country).toBe('United States');
      expect(result.countryCode).toBe('US');
      expect(result.state).toBe('New York');
      expect(result.city).toBe('New York City');
      expect(Location.reverseGeocodeAsync).toHaveBeenCalledWith({
        latitude: 40.7128,
        longitude: -74.0060
      });
      expect(Database.saveLocationGeocoding).toHaveBeenCalled();
    });

    test('handles permission denied', async () => {
      Database.getLocationGeocoding.mockResolvedValue(null);
      Database.deleteExpiredLocationGeocodings.mockResolvedValue();

      Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });

      await expect(reverseGeocode(40.7128, -74.0060, { fallbackToOffline: false }))
        .rejects.toThrow('Location permission not granted');
    });

    test('handles API timeout', async () => {
      Database.getLocationGeocoding.mockResolvedValue(null);
      Database.deleteExpiredLocationGeocodings.mockResolvedValue();

      Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
      Location.reverseGeocodeAsync.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 500)) // Reduced delay
      );

      await expect(reverseGeocode(40.7128, -74.0060, { 
        timeout: 50, // Reduced timeout for faster test execution
        fallbackToOffline: false 
      })).rejects.toThrow('Geocoding timeout');
    });

    test('falls back to offline geocoding when API fails', async () => {
      Database.getLocationGeocoding.mockResolvedValue(null);
      Database.deleteExpiredLocationGeocodings.mockResolvedValue();

      Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
      Location.reverseGeocodeAsync.mockRejectedValue(new Error('API Error'));

      // Test coordinates in US range for offline fallback
      const result = await reverseGeocode(40.7128, -74.0060, { fallbackToOffline: true });

      expect(result.source).toBe('offline');
      expect(result.country).toBe('United States');
      expect(result.countryCode).toBe('US');
    });

    test('handles no geocoding results from API', async () => {
      Database.getLocationGeocoding.mockResolvedValue(null);
      Database.deleteExpiredLocationGeocodings.mockResolvedValue();

      Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
      Location.reverseGeocodeAsync.mockResolvedValue([]);

      await expect(reverseGeocode(40.7128, -74.0060, { fallbackToOffline: false }))
        .rejects.toThrow('No geocoding results found');
    });

    test('respects cache disabled option', async () => {
      Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
      Location.reverseGeocodeAsync.mockResolvedValue([{
        country: 'United States',
        isoCountryCode: 'US',
        region: 'New York',
        city: 'New York City'
      }]);

      await reverseGeocode(40.7128, -74.0060, { useCache: false });

      expect(Database.getLocationGeocoding).not.toHaveBeenCalled();
      expect(Database.saveLocationGeocoding).not.toHaveBeenCalled();
    });
  });

  describe('batchReverseGeocode', () => {
    test('processes multiple coordinates', async () => {
      Database.getLocationGeocoding.mockResolvedValue(null);
      Database.deleteExpiredLocationGeocodings.mockResolvedValue();
      Database.saveLocationGeocoding.mockResolvedValue();

      Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
      Location.reverseGeocodeAsync
        .mockResolvedValueOnce([{
          country: 'United States',
          isoCountryCode: 'US',
          region: 'New York',
          city: 'New York City'
        }])
        .mockResolvedValueOnce([{
          country: 'United States',
          isoCountryCode: 'US',
          region: 'California',
          city: 'Los Angeles'
        }]);

      const coordinates = [
        { latitude: 40.7128, longitude: -74.0060 },
        { latitude: 34.0522, longitude: -118.2437 }
      ];

      const results = await batchReverseGeocode(coordinates);

      expect(results).toHaveLength(2);
      expect(results[0].city).toBe('New York City');
      expect(results[1].city).toBe('Los Angeles');
      expect(Location.reverseGeocodeAsync).toHaveBeenCalledTimes(2);
    });

    test('handles individual failures gracefully', async () => {
      Database.getLocationGeocoding.mockResolvedValue(null);
      Database.deleteExpiredLocationGeocodings.mockResolvedValue();

      Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
      Location.reverseGeocodeAsync
        .mockResolvedValueOnce([{
          country: 'United States',
          isoCountryCode: 'US',
          region: 'New York',
          city: 'New York City'
        }])
        .mockRejectedValueOnce(new Error('API Error'));

      const coordinates = [
        { latitude: 40.7128, longitude: -74.0060 },
        { latitude: 34.0522, longitude: -118.2437 }
      ];

      const results = await batchReverseGeocode(coordinates);

      expect(results).toHaveLength(2);
      expect(results[0].city).toBe('New York City');
      expect(results[1].source).toBe('offline');
      expect(results[1].country).toBe('United States'); // Offline fallback worked
    });

    test('processes empty array', async () => {
      const results = await batchReverseGeocode([]);
      expect(results).toHaveLength(0);
    });
  });

  describe('cleanupGeocodingCache', () => {
    test('calls database cleanup function', async () => {
      Database.deleteExpiredLocationGeocodings.mockResolvedValue();

      await cleanupGeocodingCache();

      expect(Database.deleteExpiredLocationGeocodings).toHaveBeenCalledWith(30 * 24 * 60 * 60 * 1000);
    });

    test('handles cleanup errors gracefully', async () => {
      Database.deleteExpiredLocationGeocodings.mockRejectedValue(new Error('Database error'));

      // Should not throw
      await expect(cleanupGeocodingCache()).resolves.toBeUndefined();
    });

    test('accepts custom max age', async () => {
      Database.deleteExpiredLocationGeocodings.mockResolvedValue();

      const customMaxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
      await cleanupGeocodingCache(customMaxAge);

      expect(Database.deleteExpiredLocationGeocodings).toHaveBeenCalledWith(customMaxAge);
    });
  });

  describe('offline geocoding fallback', () => {
    test('identifies US coordinates', async () => {
      Database.getLocationGeocoding.mockResolvedValue(null);
      Database.deleteExpiredLocationGeocodings.mockResolvedValue();

      Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
      Location.reverseGeocodeAsync.mockRejectedValue(new Error('API Error'));

      // NYC coordinates
      const result = await reverseGeocode(40.7128, -74.0060);

      expect(result.source).toBe('offline');
      expect(result.country).toBe('United States');
      expect(result.countryCode).toBe('US');
    });

    test('identifies Canadian coordinates', async () => {
      Database.getLocationGeocoding.mockResolvedValue(null);
      Database.deleteExpiredLocationGeocodings.mockResolvedValue();

      Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
      Location.reverseGeocodeAsync.mockRejectedValue(new Error('API Error'));

      // Toronto coordinates
      const result = await reverseGeocode(43.6532, -79.3832);

      expect(result.source).toBe('offline');
      expect(result.country).toBe('Canada');
      expect(result.countryCode).toBe('CA');
    });

    test('identifies Australian coordinates', async () => {
      Database.getLocationGeocoding.mockResolvedValue(null);
      Database.deleteExpiredLocationGeocodings.mockResolvedValue();

      Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
      Location.reverseGeocodeAsync.mockRejectedValue(new Error('API Error'));

      // Sydney coordinates
      const result = await reverseGeocode(-33.8688, 151.2093);

      expect(result.source).toBe('offline');
      expect(result.country).toBe('Australia');
      expect(result.countryCode).toBe('AU');
    });

    test('handles coordinates outside known regions', async () => {
      Database.getLocationGeocoding.mockResolvedValue(null);
      Database.deleteExpiredLocationGeocodings.mockResolvedValue();

      Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
      Location.reverseGeocodeAsync.mockRejectedValue(new Error('API Error'));

      // Coordinates that fall within Africa range (0,0 is in Africa according to our offline logic)
      const result = await reverseGeocode(0, 0, { fallbackToOffline: true });
      expect(result.source).toBe('offline');
      expect(result.country).toBe('Africa');
    });
  });
});