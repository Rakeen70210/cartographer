import {
    GeographicApiService,
    getTotalRegionCounts,
    transformToStandardGeoJSON,
    validateGeoJSONGeometry
} from '../utils/geographicApiService';

// Mock fetch for testing
global.fetch = jest.fn();

// Mock database functions
jest.mock('../utils/database', () => ({
  getRegionBoundary: jest.fn(),
  saveRegionBoundary: jest.fn(),
  getStatisticsCache: jest.fn(),
  saveStatisticsCache: jest.fn()
}));

// Mock logger
jest.mock('../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    success: jest.fn()
  }
}));

describe('GeographicApiService', () => {
  let apiService;

  beforeEach(() => {
    jest.clearAllMocks();
    fetch.mockClear();
    apiService = new GeographicApiService();
  });

  describe('Country Boundary Fetching', () => {
    test('should fetch country boundary from Nominatim successfully', async () => {
      const mockNominatimResponse = [{
        display_name: 'United States of America',
        geojson: {
          type: 'Polygon',
          coordinates: [[[-125, 48], [-125, 25], [-66, 25], [-66, 48], [-125, 48]]]
        },
        boundingbox: ['25', '48', '-125', '-66'],
        address: {
          country_code: 'us'
        }
      }];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockNominatimResponse)
      });

      const result = await apiService.getCountryBoundary('United States', 'US');

      expect(result).toBeTruthy();
      expect(result.type).toBe('country');
      expect(result.name).toBe('United States of America');
      expect(result.code).toBe('US');
      expect(result.geometry.type).toBe('Polygon');
      expect(result.source).toBe('nominatim');
    });

    test('should fallback to Natural Earth when Nominatim fails', async () => {
      // Mock Nominatim failure
      fetch.mockRejectedValueOnce(new Error('Nominatim API error'));

      // Mock Natural Earth success
      const mockNaturalEarthResponse = {
        features: [{
          properties: {
            NAME: 'United States',
            NAME_EN: 'United States',
            ISO_A2: 'US',
            POP_EST: 331000000
          },
          geometry: {
            type: 'Polygon',
            coordinates: [[[-125, 48], [-125, 25], [-66, 25], [-66, 48], [-125, 48]]]
          }
        }]
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockNaturalEarthResponse)
      });

      const result = await apiService.getCountryBoundary('United States', 'US');

      expect(result).toBeTruthy();
      expect(result.source).toBe('naturalearth');
      expect(result.name).toBe('United States');
    });

    test('should fallback to REST Countries when other sources fail', async () => {
      // Mock Nominatim failure
      fetch.mockRejectedValueOnce(new Error('Nominatim API error'));
      
      // Mock Natural Earth failure
      fetch.mockRejectedValueOnce(new Error('Natural Earth API error'));

      // Mock REST Countries success
      const mockRestCountriesResponse = {
        name: {
          common: 'United States',
          official: 'United States of America'
        },
        cca2: 'US',
        latlng: [38, -97],
        area: 9833517,
        population: 331000000
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockRestCountriesResponse)
      });

      const result = await apiService.getCountryBoundary('United States', 'US');

      expect(result).toBeTruthy();
      expect(result.source).toBe('restcountries');
      expect(result.name).toBe('United States');
      expect(result.area).toBe(9833517);
    });

    test('should return null when all sources fail', async () => {
      // Mock all sources failing
      fetch.mockRejectedValue(new Error('API error'));

      const result = await apiService.getCountryBoundary('NonexistentCountry');

      expect(result).toBeNull();
    });
  });

  describe('State Boundary Fetching', () => {
    test('should fetch state boundary from Nominatim', async () => {
      const mockNominatimResponse = [{
        display_name: 'California, United States',
        geojson: {
          type: 'Polygon',
          coordinates: [[[-124.5, 42], [-124.5, 32.5], [-114, 32.5], [-114, 42], [-124.5, 42]]]
        },
        address: {
          state_code: 'CA'
        }
      }];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockNominatimResponse)
      });

      const result = await apiService.getStateBoundary('California', 'US');

      expect(result).toBeTruthy();
      expect(result.type).toBe('state');
      expect(result.name).toBe('California');
      expect(result.source).toBe('nominatim');
    });
  });

  describe('City Boundary Fetching', () => {
    test('should fetch city boundary from Nominatim', async () => {
      const mockNominatimResponse = [{
        display_name: 'San Francisco, California, United States',
        geojson: {
          type: 'Polygon',
          coordinates: [[[-122.5, 37.8], [-122.5, 37.7], [-122.3, 37.7], [-122.3, 37.8], [-122.5, 37.8]]]
        }
      }];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockNominatimResponse)
      });

      const result = await apiService.getCityBoundary('San Francisco', 'CA', 'US');

      expect(result).toBeTruthy();
      expect(result.type).toBe('city');
      expect(result.name).toBe('San Francisco');
      expect(result.source).toBe('nominatim');
    });
  });

  describe('Rate Limiting', () => {
    test('should enforce rate limits for API calls', async () => {
      const startTime = Date.now();

      // Mock successful responses
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([{
          display_name: 'Test',
          geojson: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] }
        }])
      });

      // Make multiple rapid requests
      const promises = [
        apiService.getCountryBoundary('Country1'),
        apiService.getCountryBoundary('Country2')
      ];

      await Promise.all(promises);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should take at least 1 second due to rate limiting (1 req/sec for Nominatim)
      expect(duration).toBeGreaterThan(900);
    });
  });

  describe('Connectivity Check', () => {
    test('should check connectivity successfully', async () => {
      fetch.mockResolvedValueOnce({
        ok: true
      });

      const isOnline = await apiService.checkConnectivity();

      expect(isOnline).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        'https://httpbin.org/status/200',
        expect.objectContaining({
          method: 'HEAD',
          signal: expect.any(AbortSignal)
        })
      );
    });

    test('should handle connectivity failure', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      const isOnline = await apiService.checkConnectivity();

      expect(isOnline).toBe(false);
    });
  });

  describe('Caching', () => {
    test('should use cached data when available', async () => {
      const { getRegionBoundary } = require('../utils/database');
      
      // Mock cached data
      getRegionBoundary.mockResolvedValueOnce({
        region_name: 'United States',
        boundary_geojson: JSON.stringify({
          type: 'Polygon',
          coordinates: [[[-125, 48], [-125, 25], [-66, 25], [-66, 48], [-125, 48]]]
        }),
        area_km2: 9833517,
        timestamp: Date.now() - 1000 // Recent timestamp
      });

      const result = await apiService.getCountryBoundary('United States');

      expect(result).toBeTruthy();
      expect(result.source).toBe('cache');
      expect(fetch).not.toHaveBeenCalled();
    });

    test('should ignore expired cache', async () => {
      const { getRegionBoundary } = require('../utils/database');
      
      // Mock expired cached data
      getRegionBoundary.mockResolvedValueOnce({
        region_name: 'United States',
        boundary_geojson: JSON.stringify({
          type: 'Polygon',
          coordinates: [[[-125, 48], [-125, 25], [-66, 25], [-66, 48], [-125, 48]]]
        }),
        area_km2: 9833517,
        timestamp: Date.now() - (8 * 24 * 60 * 60 * 1000) // 8 days old
      });

      // Mock fresh API response
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{
          display_name: 'United States',
          geojson: { type: 'Polygon', coordinates: [[[-125, 48], [-125, 25], [-66, 25], [-66, 48], [-125, 48]]] }
        }])
      });

      const result = await apiService.getCountryBoundary('United States');

      expect(result).toBeTruthy();
      expect(result.source).toBe('nominatim');
      expect(fetch).toHaveBeenCalled();
    });
  });
});

describe('Utility Functions', () => {
  describe('transformToStandardGeoJSON', () => {
    test('should transform API response to standard GeoJSON', () => {
      const apiResponse = {
        type: 'country',
        name: 'United States',
        displayName: 'United States of America',
        code: 'US',
        geometry: {
          type: 'Polygon',
          coordinates: [[[-125, 48], [-125, 25], [-66, 25], [-66, 48], [-125, 48]]]
        },
        area: 9833517,
        population: 331000000,
        source: 'nominatim'
      };

      const result = transformToStandardGeoJSON(apiResponse);

      expect(result.type).toBe('Feature');
      expect(result.properties.name).toBe('United States');
      expect(result.properties.type).toBe('country');
      expect(result.geometry).toEqual(apiResponse.geometry);
    });
  });

  describe('validateGeoJSONGeometry', () => {
    test('should validate valid Polygon geometry', () => {
      const validPolygon = {
        type: 'Polygon',
        coordinates: [[[-125, 48], [-125, 25], [-66, 25], [-66, 48], [-125, 48]]]
      };

      expect(validateGeoJSONGeometry(validPolygon)).toBe(true);
    });

    test('should validate valid MultiPolygon geometry', () => {
      const validMultiPolygon = {
        type: 'MultiPolygon',
        coordinates: [
          [[[-125, 48], [-125, 25], [-66, 25], [-66, 48], [-125, 48]]],
          [[[-130, 50], [-130, 45], [-120, 45], [-120, 50], [-130, 50]]]
        ]
      };

      expect(validateGeoJSONGeometry(validMultiPolygon)).toBe(true);
    });

    test('should reject invalid geometry types', () => {
      const invalidGeometry = {
        type: 'Point',
        coordinates: [-125, 48]
      };

      expect(validateGeoJSONGeometry(invalidGeometry)).toBe(false);
    });

    test('should reject malformed geometry', () => {
      const malformedGeometry = {
        type: 'Polygon',
        coordinates: [[-125, 48]] // Missing proper ring structure
      };

      expect(validateGeoJSONGeometry(malformedGeometry)).toBe(false);
    });

    test('should reject null or undefined geometry', () => {
      expect(validateGeoJSONGeometry(null)).toBe(false);
      expect(validateGeoJSONGeometry(undefined)).toBe(false);
      expect(validateGeoJSONGeometry({})).toBe(false);
    });
  });

  describe('getTotalRegionCounts', () => {
    test('should return cached region counts', async () => {
      const { getStatisticsCache } = require('../utils/database');
      
      getStatisticsCache.mockResolvedValueOnce({
        cache_value: JSON.stringify({
          countries: 195,
          states: 3142,
          cities: 10000
        }),
        timestamp: Date.now() - 1000
      });

      const result = await getTotalRegionCounts();

      expect(result).toEqual({
        countries: 195,
        states: 3142,
        cities: 10000
      });
    });

    test('should return fallback values when cache fails', async () => {
      const { getStatisticsCache } = require('../utils/database');
      
      getStatisticsCache.mockRejectedValueOnce(new Error('Database error'));

      const result = await getTotalRegionCounts();

      expect(result).toEqual({
        countries: 195,
        states: 3142,
        cities: 10000
      });
    });
  });
});

describe('Integration Tests', () => {
  describe('Real API Calls', () => {
    // These tests make real API calls and should be run sparingly
    // They are skipped by default to avoid hitting rate limits during regular testing
    
    test.skip('should fetch real country data from Nominatim', async () => {
      const realApiService = new GeographicApiService();
      
      const result = await realApiService.getCountryBoundary('Monaco');
      
      expect(result).toBeTruthy();
      expect(result.name).toContain('Monaco');
      expect(result.geometry).toBeTruthy();
      expect(result.source).toBe('nominatim');
    }, 30000); // 30 second timeout for real API calls

    test.skip('should handle API rate limiting gracefully', async () => {
      const realApiService = new GeographicApiService();
      
      const startTime = Date.now();
      
      // Make multiple requests that should trigger rate limiting
      const promises = [
        realApiService.getCountryBoundary('Monaco'),
        realApiService.getCountryBoundary('Vatican'),
        realApiService.getCountryBoundary('San Marino')
      ];
      
      const results = await Promise.all(promises);
      const endTime = Date.now();
      
      // Should take at least 2 seconds due to rate limiting
      expect(endTime - startTime).toBeGreaterThan(2000);
      
      // All requests should succeed
      results.forEach(result => {
        expect(result).toBeTruthy();
      });
    }, 60000); // 60 second timeout for rate limiting test
  });

  describe('Fallback Scenarios', () => {
    test('should handle offline scenario gracefully', async () => {
      // Mock all network requests to fail
      fetch.mockRejectedValue(new Error('Network unavailable'));

      const result = await new GeographicApiService().getCountryBoundary('United States');

      // Should return null when all sources fail
      expect(result).toBeNull();
    });

    test('should handle partial API failures', async () => {
      // Mock Nominatim failure but Natural Earth success
      fetch
        .mockRejectedValueOnce(new Error('Nominatim error'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            features: [{
              properties: { NAME: 'United States', ISO_A2: 'US' },
              geometry: { type: 'Polygon', coordinates: [[[-125, 48], [-125, 25], [-66, 25], [-66, 48], [-125, 48]]] }
            }]
          })
        });

      const result = await new GeographicApiService().getCountryBoundary('United States');

      expect(result).toBeTruthy();
      expect(result.source).toBe('naturalearth');
    });
  });
});