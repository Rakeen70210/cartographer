/**
 * Mock implementation for database utilities
 * Provides consistent mock behavior for all database operations
 */

const mockDatabase = {
  // Core database operations
  initDatabase: jest.fn().mockResolvedValue(true),
  database: {
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
  
  // Location operations
  getLocations: jest.fn().mockResolvedValue([]),
  saveLocation: jest.fn().mockResolvedValue({ id: 1 }),
  deleteLocation: jest.fn().mockResolvedValue(),
  
  // Revealed area operations
  getRevealedAreas: jest.fn().mockResolvedValue([]),
  saveRevealedArea: jest.fn().mockResolvedValue({ id: 1 }),
  deleteRevealedArea: jest.fn().mockResolvedValue(),
  
  // Cache operations
  getStatisticsCache: jest.fn().mockResolvedValue(null),
  saveStatisticsCache: jest.fn().mockResolvedValue(),
  deleteStatisticsCache: jest.fn().mockResolvedValue(),
  clearAllStatisticsCache: jest.fn().mockResolvedValue(),
  deleteExpiredStatisticsCache: jest.fn().mockResolvedValue(),
  getAllStatisticsCache: jest.fn().mockResolvedValue([]),
  
  // Geocoding operations
  getLocationGeocoding: jest.fn().mockResolvedValue(null),
  saveLocationGeocoding: jest.fn().mockResolvedValue(),
  deleteExpiredLocationGeocodings: jest.fn().mockResolvedValue(),
  getAllLocationGeocodings: jest.fn().mockResolvedValue([])
};

module.exports = mockDatabase;