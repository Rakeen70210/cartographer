/**
 * Enhanced mock implementation for database utilities
 * Provides realistic mock behavior with in-memory simulation for all database operations
 */

// In-memory storage to simulate database state across test operations
const mockStorage = {
  locations: new Map(),
  revealedAreas: new Map(),
  statisticsCache: new Map(),
  locationGeocodings: new Map(),
  nextLocationId: 1,
  nextAreaId: 1,
  nextCacheId: 1,
  nextGeocodingId: 1
};

// Use standardized mock location factory from testDataFactories
const { createMockLocation: baseCreateMockLocation } = require('../../mocks/testDataFactories');

// Helper to create realistic location data with database-specific fields
const createMockLocation = (data = {}) => ({
  ...baseCreateMockLocation({
    id: data.id || mockStorage.nextLocationId++,
    ...data
  }),
  // Add database-specific fields
  altitude: data.altitude || null,
  heading: data.heading || null,
  speed: data.speed || null
});

// Helper to create realistic revealed area data
const createMockRevealedArea = (data = {}) => {
  const defaultPolygon = {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [-122.4194, 37.7749],
        [-122.4194, 37.7849],
        [-122.4094, 37.7849],
        [-122.4094, 37.7749],
        [-122.4194, 37.7749]
      ]]
    },
    properties: {}
  };

  return {
    id: data.id || mockStorage.nextAreaId++,
    geojson: data.geojson || JSON.stringify(defaultPolygon),
    timestamp: data.timestamp || Date.now(),
    ...data
  };
};

// Helper to create realistic cache entry
const createMockCacheEntry = (key, value, data = {}) => ({
  id: data.id || mockStorage.nextCacheId++,
  cache_key: key,
  cache_value: typeof value === 'string' ? value : JSON.stringify(value),
  timestamp: data.timestamp || Date.now(),
  expires_at: data.expires_at || (Date.now() + (24 * 60 * 60 * 1000)), // 24 hours default
  ...data
});

// Helper to create realistic geocoding entry
const createMockGeocodingEntry = (locationId, data = {}) => ({
  id: data.id || mockStorage.nextGeocodingId++,
  location_id: locationId,
  country: data.country || 'United States',
  state: data.state || 'California',
  city: data.city || 'San Francisco',
  country_code: data.country_code || 'US',
  timestamp: data.timestamp || Date.now(),
  expires_at: data.expires_at || (Date.now() + (7 * 24 * 60 * 60 * 1000)), // 7 days default
  ...data
});

const mockDatabase = {
  // Core database operations with realistic behavior
  initDatabase: jest.fn().mockImplementation(async () => {
    // Reset storage on init to simulate fresh database
    mockStorage.locations.clear();
    mockStorage.revealedAreas.clear();
    mockStorage.statisticsCache.clear();
    mockStorage.locationGeocodings.clear();
    mockStorage.nextLocationId = 1;
    mockStorage.nextAreaId = 1;
    mockStorage.nextCacheId = 1;
    mockStorage.nextGeocodingId = 1;
    return true;
  }),

  database: {
    // Async methods with realistic implementations
    execAsync: jest.fn().mockResolvedValue(undefined),
    getAllAsync: jest.fn().mockImplementation(async (sql, params = []) => {
      // Simulate different queries based on SQL
      if (sql.includes('locations')) {
        return Array.from(mockStorage.locations.values());
      }
      if (sql.includes('revealed_areas')) {
        return Array.from(mockStorage.revealedAreas.values());
      }
      if (sql.includes('statistics_cache')) {
        return Array.from(mockStorage.statisticsCache.values());
      }
      if (sql.includes('location_geocodings')) {
        return Array.from(mockStorage.locationGeocodings.values());
      }
      return [];
    }),
    getFirstAsync: jest.fn().mockImplementation(async (sql, params = []) => {
      // Simulate getting first result
      const results = await mockDatabase.database.getAllAsync(sql, params);
      return results.length > 0 ? results[0] : null;
    }),
    runAsync: jest.fn().mockImplementation(async (sql, params = []) => {
      // Simulate INSERT/UPDATE/DELETE operations
      let changes = 0;
      let lastInsertRowId = 0;

      if (sql.includes('INSERT')) {
        changes = 1;
        if (sql.includes('locations')) {
          lastInsertRowId = mockStorage.nextLocationId;
        } else if (sql.includes('revealed_areas')) {
          lastInsertRowId = mockStorage.nextAreaId;
        } else if (sql.includes('statistics_cache')) {
          lastInsertRowId = mockStorage.nextCacheId;
        } else if (sql.includes('location_geocodings')) {
          lastInsertRowId = mockStorage.nextGeocodingId;
        }
      } else if (sql.includes('UPDATE') || sql.includes('DELETE')) {
        changes = 1; // Assume one row affected
      }

      return { changes, lastInsertRowId };
    }),
    prepareAsync: jest.fn().mockResolvedValue({
      executeAsync: jest.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 1 }),
      getAllAsync: jest.fn().mockResolvedValue([]),
      getFirstAsync: jest.fn().mockResolvedValue(null),
      finalizeAsync: jest.fn().mockResolvedValue(undefined),
    }),
    closeAsync: jest.fn().mockResolvedValue(undefined),

    // Sync methods (for backward compatibility)
    execSync: jest.fn(),
    getAllSync: jest.fn(() => []),
    getFirstSync: jest.fn(() => null),
    runSync: jest.fn(() => ({ changes: 0, lastInsertRowId: 0 })),
    prepareSync: jest.fn(() => ({
      executeSync: jest.fn(() => ({ changes: 0, lastInsertRowId: 0 })),
      getAllSync: jest.fn(() => []),
      getFirstSync: jest.fn(() => null),
      finalizeSync: jest.fn(),
    })),
    closeSync: jest.fn(),
  },
  
  // Enhanced location operations with realistic data handling
  getLocations: jest.fn().mockImplementation(async (limit = null, offset = 0) => {
    const locations = Array.from(mockStorage.locations.values())
      .sort((a, b) => b.timestamp - a.timestamp); // Sort by timestamp desc
    
    if (limit) {
      return locations.slice(offset, offset + limit);
    }
    return locations.slice(offset);
  }),

  saveLocation: jest.fn().mockImplementation(async (locationData) => {
    const location = createMockLocation(locationData);
    mockStorage.locations.set(location.id, location);
    return location;
  }),

  deleteLocation: jest.fn().mockImplementation(async (locationId) => {
    const deleted = mockStorage.locations.delete(locationId);
    return { changes: deleted ? 1 : 0 };
  }),

  // Enhanced revealed area operations
  getRevealedAreas: jest.fn().mockImplementation(async (limit = null, offset = 0) => {
    const areas = Array.from(mockStorage.revealedAreas.values())
      .sort((a, b) => b.timestamp - a.timestamp);
    
    if (limit) {
      return areas.slice(offset, offset + limit);
    }
    return areas.slice(offset);
  }),

  saveRevealedArea: jest.fn().mockImplementation(async (areaData) => {
    const area = createMockRevealedArea(areaData);
    mockStorage.revealedAreas.set(area.id, area);
    return area;
  }),

  deleteRevealedArea: jest.fn().mockImplementation(async (areaId) => {
    const deleted = mockStorage.revealedAreas.delete(areaId);
    return { changes: deleted ? 1 : 0 };
  }),

  // Enhanced cache operations with TTL simulation
  getStatisticsCache: jest.fn().mockImplementation(async (key) => {
    const entry = mockStorage.statisticsCache.get(key);
    if (!entry) return null;
    
    // Check if expired
    const now = Date.now();
    if (entry.expires_at && now > entry.expires_at) {
      mockStorage.statisticsCache.delete(key);
      return null;
    }
    
    return entry;
  }),

  saveStatisticsCache: jest.fn().mockImplementation(async (key, value, ttl = 24 * 60 * 60 * 1000) => {
    const entry = createMockCacheEntry(key, value, {
      expires_at: Date.now() + ttl
    });
    mockStorage.statisticsCache.set(key, entry);
    return entry;
  }),

  deleteStatisticsCache: jest.fn().mockImplementation(async (key) => {
    const deleted = mockStorage.statisticsCache.delete(key);
    return { changes: deleted ? 1 : 0 };
  }),

  clearAllStatisticsCache: jest.fn().mockImplementation(async () => {
    const count = mockStorage.statisticsCache.size;
    mockStorage.statisticsCache.clear();
    return { changes: count };
  }),

  deleteExpiredStatisticsCache: jest.fn().mockImplementation(async () => {
    const now = Date.now();
    let deletedCount = 0;
    
    for (const [key, entry] of mockStorage.statisticsCache.entries()) {
      if (entry.expires_at && now > entry.expires_at) {
        mockStorage.statisticsCache.delete(key);
        deletedCount++;
      }
    }
    
    return { changes: deletedCount };
  }),

  getAllStatisticsCache: jest.fn().mockImplementation(async () => {
    return Array.from(mockStorage.statisticsCache.values());
  }),

  // Enhanced geocoding operations
  getLocationGeocoding: jest.fn().mockImplementation(async (locationId) => {
    for (const entry of mockStorage.locationGeocodings.values()) {
      if (entry.location_id === locationId) {
        // Check if expired
        const now = Date.now();
        if (entry.expires_at && now > entry.expires_at) {
          mockStorage.locationGeocodings.delete(entry.id);
          return null;
        }
        return entry;
      }
    }
    return null;
  }),

  saveLocationGeocoding: jest.fn().mockImplementation(async (locationId, geocodingData) => {
    const entry = createMockGeocodingEntry(locationId, geocodingData);
    mockStorage.locationGeocodings.set(entry.id, entry);
    return { id: entry.id };
  }),

  deleteExpiredLocationGeocodings: jest.fn().mockImplementation(async () => {
    const now = Date.now();
    let deletedCount = 0;
    
    for (const [id, entry] of mockStorage.locationGeocodings.entries()) {
      if (entry.expires_at && now > entry.expires_at) {
        mockStorage.locationGeocodings.delete(id);
        deletedCount++;
      }
    }
    
    return { changes: deletedCount };
  }),

  getAllLocationGeocodings: jest.fn().mockImplementation(async () => {
    return Array.from(mockStorage.locationGeocodings.values());
  }),

  // Additional utility methods for testing
  _resetMockStorage: () => {
    mockStorage.locations.clear();
    mockStorage.revealedAreas.clear();
    mockStorage.statisticsCache.clear();
    mockStorage.locationGeocodings.clear();
    mockStorage.nextLocationId = 1;
    mockStorage.nextAreaId = 1;
    mockStorage.nextCacheId = 1;
    mockStorage.nextGeocodingId = 1;
  },

  _getMockStorage: () => mockStorage,

  _populateWithTestData: (dataSet = 'small') => {
    // Helper to populate with different test data sets
    const dataSets = {
      small: { locations: 2, areas: 2 },
      medium: { locations: 100, areas: 50 },
      large: { locations: 10000, areas: 5000 }
    };

    const config = dataSets[dataSet] || dataSets.small;
    
    // Add locations
    for (let i = 0; i < config.locations; i++) {
      const location = createMockLocation({
        latitude: 37.7749 + (i * 0.01),
        longitude: -122.4194 + (i * 0.01),
        timestamp: Date.now() - ((config.locations - i) * 1000)
      });
      mockStorage.locations.set(location.id, location);
    }

    // Add revealed areas
    for (let i = 0; i < config.areas; i++) {
      const area = createMockRevealedArea({
        timestamp: Date.now() - ((config.areas - i) * 1000)
      });
      mockStorage.revealedAreas.set(area.id, area);
    }
  }
};

module.exports = mockDatabase;