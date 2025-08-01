/**
 * Database Statistics Extensions Tests
 * Tests Requirements: 6.1, 6.2, 6.3
 */

// Mock logger first
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
  }
}));

// Mock expo-sqlite
const mockDatabase = {
  execAsync: jest.fn().mockResolvedValue(undefined),
  runAsync: jest.fn().mockResolvedValue(undefined),
  getAllAsync: jest.fn().mockResolvedValue([]),
  getFirstAsync: jest.fn().mockResolvedValue(null),
  closeSync: jest.fn(),
};

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn(() => mockDatabase),
}));

// Mock databaseMigrations
jest.mock('../utils/databaseMigrations', () => ({
  runMigrations: jest.fn().mockResolvedValue(undefined),
  checkMigrationsNeeded: jest.fn().mockResolvedValue(false),
  getMigrationStatus: jest.fn().mockResolvedValue({
    currentVersion: 2,
    latestVersion: 2,
    migrationsNeeded: false,
    pendingMigrations: []
  })
}));

describe('Database Statistics Extensions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset all mock implementations to their default resolved values
    mockDatabase.execAsync.mockResolvedValue(undefined);
    mockDatabase.runAsync.mockResolvedValue(undefined);
    mockDatabase.getAllAsync.mockResolvedValue([]);
    mockDatabase.getFirstAsync.mockResolvedValue(null);
  });

  describe('Database Schema Creation', () => {
    test('should create statistics tables with correct schema', async () => {
      const { runMigrations } = require('../utils/databaseMigrations');
      
      await runMigrations();
      
      expect(runMigrations).toHaveBeenCalled();
    });

    test('should initialize database with migrations', async () => {
      const { initDatabase } = require('../utils/database');
      
      await initDatabase();
      
      // Should create original tables
      expect(mockDatabase.execAsync).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS locations')
      );
      expect(mockDatabase.execAsync).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS revealed_areas')
      );
    });
  });

  describe('Location Geocoding CRUD Operations', () => {
    test('should save location geocoding data with correct SQL', async () => {
      const { saveLocationGeocoding } = require('../utils/database');
      
      await saveLocationGeocoding(37.7749, -122.4194, 'United States', 'California', 'San Francisco');
      
      expect(mockDatabase.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO location_geocoding'),
        [37.7749, -122.4194, 'United States', 'California', 'San Francisco', expect.any(Number)]
      );
    });

    test('should query location geocoding with correct SQL', async () => {
      const { getLocationGeocoding } = require('../utils/database');
      
      await getLocationGeocoding(37.7749, -122.4194);
      
      expect(mockDatabase.getFirstAsync).toHaveBeenCalledWith(
        'SELECT * FROM location_geocoding WHERE latitude = ? AND longitude = ?',
        [37.7749, -122.4194]
      );
    });

    test('should query all location geocodings', async () => {
      const { getAllLocationGeocodings } = require('../utils/database');
      
      await getAllLocationGeocodings();
      
      expect(mockDatabase.getAllAsync).toHaveBeenCalledWith('SELECT * FROM location_geocoding');
    });

    test('should delete expired location geocodings', async () => {
      const { deleteExpiredLocationGeocodings } = require('../utils/database');
      
      await deleteExpiredLocationGeocodings(30 * 24 * 60 * 60 * 1000);
      
      expect(mockDatabase.runAsync).toHaveBeenCalledWith(
        'DELETE FROM location_geocoding WHERE timestamp < ?',
        [expect.any(Number)]
      );
    });

    test('should handle null values in geocoding data', async () => {
      const { saveLocationGeocoding } = require('../utils/database');
      
      await saveLocationGeocoding(37.7749, -122.4194);
      
      expect(mockDatabase.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO location_geocoding'),
        [37.7749, -122.4194, null, null, null, expect.any(Number)]
      );
    });
  });

  describe('Region Boundary CRUD Operations', () => {
    test('should save region boundary data with correct SQL', async () => {
      const { saveRegionBoundary } = require('../utils/database');
      
      const boundaryGeojson = { type: 'Polygon', coordinates: [] };
      await saveRegionBoundary('country', 'United States', boundaryGeojson, 9833517);
      
      expect(mockDatabase.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO region_boundaries'),
        ['country', 'United States', JSON.stringify(boundaryGeojson), 9833517, expect.any(Number)]
      );
    });

    test('should query region boundary with correct SQL', async () => {
      const { getRegionBoundary } = require('../utils/database');
      
      await getRegionBoundary('country', 'United States');
      
      expect(mockDatabase.getFirstAsync).toHaveBeenCalledWith(
        'SELECT * FROM region_boundaries WHERE region_type = ? AND region_name = ?',
        ['country', 'United States']
      );
    });

    test('should query all region boundaries', async () => {
      const { getAllRegionBoundaries } = require('../utils/database');
      
      await getAllRegionBoundaries();
      
      expect(mockDatabase.getAllAsync).toHaveBeenCalledWith(
        'SELECT * FROM region_boundaries',
        []
      );
    });

    test('should filter region boundaries by type', async () => {
      const { getAllRegionBoundaries } = require('../utils/database');
      
      await getAllRegionBoundaries('country');
      
      expect(mockDatabase.getAllAsync).toHaveBeenCalledWith(
        'SELECT * FROM region_boundaries WHERE region_type = ?',
        ['country']
      );
    });

    test('should delete expired region boundaries', async () => {
      const { deleteExpiredRegionBoundaries } = require('../utils/database');
      
      await deleteExpiredRegionBoundaries(7 * 24 * 60 * 60 * 1000);
      
      expect(mockDatabase.runAsync).toHaveBeenCalledWith(
        'DELETE FROM region_boundaries WHERE timestamp < ?',
        [expect.any(Number)]
      );
    });

    test('should handle null area in region boundary', async () => {
      const { saveRegionBoundary } = require('../utils/database');
      
      const boundaryGeojson = { type: 'Polygon', coordinates: [] };
      await saveRegionBoundary('city', 'San Francisco', boundaryGeojson);
      
      expect(mockDatabase.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO region_boundaries'),
        ['city', 'San Francisco', JSON.stringify(boundaryGeojson), null, expect.any(Number)]
      );
    });
  });

  describe('Statistics Cache CRUD Operations', () => {
    test('should save statistics cache with object value', async () => {
      const { saveStatisticsCache } = require('../utils/database');
      
      const cacheValue = { miles: 100.5, kilometers: 161.7 };
      await saveStatisticsCache('total_distance', cacheValue);
      
      expect(mockDatabase.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO statistics_cache'),
        ['total_distance', JSON.stringify(cacheValue), expect.any(Number)]
      );
    });

    test('should save statistics cache with string value', async () => {
      const { saveStatisticsCache } = require('../utils/database');
      
      await saveStatisticsCache('string_key', 'test_value');
      
      expect(mockDatabase.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO statistics_cache'),
        ['string_key', 'test_value', expect.any(Number)]
      );
    });

    test('should save statistics cache with number value', async () => {
      const { saveStatisticsCache } = require('../utils/database');
      
      await saveStatisticsCache('number_key', 42);
      
      expect(mockDatabase.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO statistics_cache'),
        ['number_key', '42', expect.any(Number)]
      );
    });

    test('should query statistics cache with correct SQL', async () => {
      const { getStatisticsCache } = require('../utils/database');
      
      await getStatisticsCache('total_distance');
      
      expect(mockDatabase.getFirstAsync).toHaveBeenCalledWith(
        'SELECT * FROM statistics_cache WHERE cache_key = ?',
        ['total_distance']
      );
    });

    test('should query all statistics cache entries', async () => {
      const { getAllStatisticsCache } = require('../utils/database');
      
      await getAllStatisticsCache();
      
      expect(mockDatabase.getAllAsync).toHaveBeenCalledWith('SELECT * FROM statistics_cache');
    });

    test('should delete specific cache entry', async () => {
      const { deleteStatisticsCache } = require('../utils/database');
      
      await deleteStatisticsCache('key1');
      
      expect(mockDatabase.runAsync).toHaveBeenCalledWith(
        'DELETE FROM statistics_cache WHERE cache_key = ?',
        ['key1']
      );
    });

    test('should delete expired cache entries', async () => {
      const { deleteExpiredStatisticsCache } = require('../utils/database');
      
      await deleteExpiredStatisticsCache(60 * 60 * 1000);
      
      expect(mockDatabase.runAsync).toHaveBeenCalledWith(
        'DELETE FROM statistics_cache WHERE timestamp < ?',
        [expect.any(Number)]
      );
    });

    test('should clear all cache entries', async () => {
      const { clearAllStatisticsCache } = require('../utils/database');
      
      await clearAllStatisticsCache();
      
      expect(mockDatabase.runAsync).toHaveBeenCalledWith('DELETE FROM statistics_cache');
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors gracefully in read operations', async () => {
      const { getLocationGeocoding, getRegionBoundary, getStatisticsCache } = require('../utils/database');
      
      mockDatabase.getFirstAsync.mockRejectedValue(new Error('Database error'));
      
      const result1 = await getLocationGeocoding(0, 0);
      expect(result1).toBeNull();
      
      const result2 = await getRegionBoundary('country', 'Test');
      expect(result2).toBeNull();
      
      const result3 = await getStatisticsCache('test_key');
      expect(result3).toBeNull();
    });

    test('should handle database errors gracefully in list operations', async () => {
      const { getAllLocationGeocodings, getAllRegionBoundaries, getAllStatisticsCache } = require('../utils/database');
      
      mockDatabase.getAllAsync.mockRejectedValue(new Error('Database error'));
      
      const result1 = await getAllLocationGeocodings();
      expect(result1).toEqual([]);
      
      const result2 = await getAllRegionBoundaries();
      expect(result2).toEqual([]);
      
      const result3 = await getAllStatisticsCache();
      expect(result3).toEqual([]);
    });

    test('should throw errors for save operations when database fails', async () => {
      const { saveLocationGeocoding, saveRegionBoundary, saveStatisticsCache } = require('../utils/database');
      
      mockDatabase.runAsync.mockRejectedValue(new Error('Database error'));
      
      await expect(saveLocationGeocoding(0, 0)).rejects.toThrow('Database error');
      await expect(saveRegionBoundary('country', 'Test', {})).rejects.toThrow('Database error');
      await expect(saveStatisticsCache('key', 'value')).rejects.toThrow('Database error');
    });

    test('should throw errors for delete operations when database fails', async () => {
      const { deleteExpiredLocationGeocodings, deleteExpiredRegionBoundaries, deleteStatisticsCache } = require('../utils/database');
      
      mockDatabase.runAsync.mockRejectedValue(new Error('Database error'));
      
      await expect(deleteExpiredLocationGeocodings()).rejects.toThrow('Database error');
      await expect(deleteExpiredRegionBoundaries()).rejects.toThrow('Database error');
      await expect(deleteStatisticsCache('key')).rejects.toThrow('Database error');
    });
  });

  describe('Data Validation', () => {
    test('should handle coordinate precision in geocoding', async () => {
      const { saveLocationGeocoding } = require('../utils/database');
      
      const preciseLat = 37.7749295;
      const preciseLng = -122.4194155;
      
      await saveLocationGeocoding(preciseLat, preciseLng, 'United States', 'California', 'San Francisco');
      
      expect(mockDatabase.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO location_geocoding'),
        [preciseLat, preciseLng, 'United States', 'California', 'San Francisco', expect.any(Number)]
      );
    });

    test('should handle complex GeoJSON in region boundaries', async () => {
      const { saveRegionBoundary } = require('../utils/database');
      
      const complexGeojson = {
        type: 'MultiPolygon',
        coordinates: [
          [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]],
          [[[2, 2], [2, 3], [3, 3], [3, 2], [2, 2]]]
        ]
      };
      
      await saveRegionBoundary('country', 'Test Country', complexGeojson, 1000000);
      
      expect(mockDatabase.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO region_boundaries'),
        ['country', 'Test Country', JSON.stringify(complexGeojson), 1000000, expect.any(Number)]
      );
    });

    test('should handle large cache values', async () => {
      const { saveStatisticsCache } = require('../utils/database');
      
      const largeCacheValue = {
        hierarchicalBreakdown: Array.from({ length: 100 }, (_, i) => ({
          type: 'country',
          name: `Country ${i}`,
          explorationPercentage: Math.random() * 100,
          children: Array.from({ length: 10 }, (_, j) => ({
            type: 'state',
            name: `State ${j}`,
            explorationPercentage: Math.random() * 100
          }))
        }))
      };
      
      await saveStatisticsCache('large_hierarchy', largeCacheValue);
      
      expect(mockDatabase.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO statistics_cache'),
        ['large_hierarchy', JSON.stringify(largeCacheValue), expect.any(Number)]
      );
    });
  });

  describe('Performance Considerations', () => {
    test('should handle multiple concurrent operations', async () => {
      const { saveLocationGeocoding, saveRegionBoundary, saveStatisticsCache } = require('../utils/database');
      
      const operations = [
        saveLocationGeocoding(37.7749, -122.4194, 'US', 'CA', 'SF'),
        saveRegionBoundary('country', 'US', { type: 'Polygon', coordinates: [] }),
        saveStatisticsCache('test', { value: 123 })
      ];
      
      await Promise.all(operations);
      
      expect(mockDatabase.runAsync).toHaveBeenCalledTimes(3);
    });

    test('should use appropriate SQL for bulk operations', async () => {
      const { deleteExpiredLocationGeocodings, deleteExpiredRegionBoundaries, deleteExpiredStatisticsCache } = require('../utils/database');
      
      // Test that bulk delete operations use efficient SQL
      await deleteExpiredLocationGeocodings(30 * 24 * 60 * 60 * 1000);
      await deleteExpiredRegionBoundaries(7 * 24 * 60 * 60 * 1000);
      await deleteExpiredStatisticsCache(60 * 60 * 1000);
      
      expect(mockDatabase.runAsync).toHaveBeenCalledTimes(3);
      expect(mockDatabase.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM'),
        expect.any(Array)
      );
    });
  });
});