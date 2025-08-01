import * as SQLite from 'expo-sqlite';
import { logger } from './logger';

const database = SQLite.openDatabaseSync('locations.db');

interface Location {
  id: number;
  latitude: number;
  longitude: number;
  timestamp: number;
}

interface RevealedArea {
  id: number;
  geojson: string;
}

interface LocationGeocoding {
  id: number;
  latitude: number;
  longitude: number;
  country?: string;
  state?: string;
  city?: string;
  timestamp: number;
}

interface RegionBoundary {
  id: number;
  region_type: 'country' | 'state' | 'city';
  region_name: string;
  boundary_geojson: string;
  area_km2?: number;
  timestamp: number;
}

interface StatisticsCache {
  id: number;
  cache_key: string;
  cache_value: string;
  timestamp: number;
}

export const initDatabase = async (): Promise<void> => {
  logger.info('Database: Starting database initialization');
  try {
    logger.debug('Database: Creating locations table');
    await database.execAsync(
      'CREATE TABLE IF NOT EXISTS locations (id INTEGER PRIMARY KEY NOT NULL, latitude REAL NOT NULL, longitude REAL NOT NULL, timestamp INTEGER NOT NULL);'
    );
    logger.debug('Database: Creating revealed_areas table');
    await database.execAsync(
      'CREATE TABLE IF NOT EXISTS revealed_areas (id INTEGER PRIMARY KEY NOT NULL, geojson TEXT NOT NULL);'
    );

    // Clear existing revealed areas to start fresh (temporary fix for corrupted data)
    logger.debug('Database: Clearing existing revealed areas for fresh start');
    await database.execAsync('DELETE FROM revealed_areas;');

    // Run database migrations for schema updates
    const { runMigrations } = require('./databaseMigrations');
    await runMigrations();

    logger.success('Database: Database and tables created successfully');
  } catch (error) {
    logger.error('Database: Error initializing database:', error);
    throw error;
  }
};



export const getLocations = async (): Promise<Location[]> => {
  try {
    const result = await database.getAllAsync('SELECT * FROM locations');
    return result as Location[];
  } catch (error) {
    logger.error('Error fetching locations:', error);
    return [];
  }
};

export const saveRevealedArea = async (geojson: object): Promise<void> => {
  try {
    await database.runAsync(
      'INSERT INTO revealed_areas (geojson) VALUES (?);',
      [JSON.stringify(geojson)]
    );
  } catch (error) {
    logger.error('Error saving revealed area:', error);
  }
};

export const getRevealedAreas = async (): Promise<object[]> => {
  logger.debug('Database: Fetching revealed areas');
  try {
    logger.debug('Database: Executing SELECT query for revealed areas');
    const result = await database.getAllAsync('SELECT geojson FROM revealed_areas');
    const areas = (result as RevealedArea[]).map((row: RevealedArea) => JSON.parse(row.geojson));
    logger.debug('Database: Retrieved revealed areas count:', areas.length);
    return areas;
  } catch (error) {
    logger.error('Database: Error fetching revealed areas:', error);
    return [];
  }
};

// Location Geocoding CRUD operations
export const saveLocationGeocoding = async (
  latitude: number,
  longitude: number,
  country?: string,
  state?: string,
  city?: string
): Promise<void> => {
  try {
    const timestamp = Date.now();
    await database.runAsync(
      `INSERT OR REPLACE INTO location_geocoding 
       (latitude, longitude, country, state, city, timestamp) 
       VALUES (?, ?, ?, ?, ?, ?);`,
      [latitude, longitude, country || null, state || null, city || null, timestamp]
    );
    logger.debug('Database: Saved location geocoding data');
  } catch (error) {
    logger.error('Database: Error saving location geocoding:', error);
    throw error;
  }
};

export const getLocationGeocoding = async (
  latitude: number,
  longitude: number
): Promise<LocationGeocoding | null> => {
  try {
    const result = await database.getFirstAsync(
      'SELECT * FROM location_geocoding WHERE latitude = ? AND longitude = ?',
      [latitude, longitude]
    );
    return result as LocationGeocoding | null;
  } catch (error) {
    logger.error('Database: Error fetching location geocoding:', error);
    return null;
  }
};

export const getAllLocationGeocodings = async (): Promise<LocationGeocoding[]> => {
  try {
    const result = await database.getAllAsync('SELECT * FROM location_geocoding');
    return result as LocationGeocoding[];
  } catch (error) {
    logger.error('Database: Error fetching all location geocodings:', error);
    return [];
  }
};

export const deleteExpiredLocationGeocodings = async (maxAge: number = 30 * 24 * 60 * 60 * 1000): Promise<void> => {
  try {
    const cutoffTime = Date.now() - maxAge;
    await database.runAsync(
      'DELETE FROM location_geocoding WHERE timestamp < ?',
      [cutoffTime]
    );
    logger.debug('Database: Deleted expired location geocoding entries');
  } catch (error) {
    logger.error('Database: Error deleting expired location geocodings:', error);
    throw error;
  }
};

// Region Boundaries CRUD operations
export const saveRegionBoundary = async (
  regionType: 'country' | 'state' | 'city',
  regionName: string,
  boundaryGeojson: object,
  areaKm2?: number
): Promise<void> => {
  try {
    const timestamp = Date.now();
    await database.runAsync(
      `INSERT OR REPLACE INTO region_boundaries 
       (region_type, region_name, boundary_geojson, area_km2, timestamp) 
       VALUES (?, ?, ?, ?, ?);`,
      [regionType, regionName, JSON.stringify(boundaryGeojson), areaKm2 || null, timestamp]
    );
    logger.debug(`Database: Saved region boundary for ${regionType}: ${regionName}`);
  } catch (error) {
    logger.error('Database: Error saving region boundary:', error);
    throw error;
  }
};

export const getRegionBoundary = async (
  regionType: 'country' | 'state' | 'city',
  regionName: string
): Promise<RegionBoundary | null> => {
  try {
    const result = await database.getFirstAsync(
      'SELECT * FROM region_boundaries WHERE region_type = ? AND region_name = ?',
      [regionType, regionName]
    );
    return result as RegionBoundary | null;
  } catch (error) {
    logger.error('Database: Error fetching region boundary:', error);
    return null;
  }
};

export const getAllRegionBoundaries = async (
  regionType?: 'country' | 'state' | 'city'
): Promise<RegionBoundary[]> => {
  try {
    let query = 'SELECT * FROM region_boundaries';
    const params: any[] = [];

    if (regionType) {
      query += ' WHERE region_type = ?';
      params.push(regionType);
    }

    const result = await database.getAllAsync(query, params);
    return result as RegionBoundary[];
  } catch (error) {
    logger.error('Database: Error fetching region boundaries:', error);
    return [];
  }
};

export const deleteExpiredRegionBoundaries = async (maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void> => {
  try {
    const cutoffTime = Date.now() - maxAge;
    await database.runAsync(
      'DELETE FROM region_boundaries WHERE timestamp < ?',
      [cutoffTime]
    );
    logger.debug('Database: Deleted expired region boundary entries');
  } catch (error) {
    logger.error('Database: Error deleting expired region boundaries:', error);
    throw error;
  }
};

// Statistics Cache CRUD operations
export const saveStatisticsCache = async (
  cacheKey: string,
  cacheValue: object | string | number
): Promise<void> => {
  try {
    const timestamp = Date.now();
    const valueString = typeof cacheValue === 'string' ? cacheValue : JSON.stringify(cacheValue);

    await database.runAsync(
      `INSERT OR REPLACE INTO statistics_cache 
       (cache_key, cache_value, timestamp) 
       VALUES (?, ?, ?);`,
      [cacheKey, valueString, timestamp]
    );
    logger.debug(`Database: Saved statistics cache for key: ${cacheKey}`);
  } catch (error) {
    logger.error('Database: Error saving statistics cache:', error);
    throw error;
  }
};

export const getStatisticsCache = async (cacheKey: string): Promise<StatisticsCache | null> => {
  try {
    const result = await database.getFirstAsync(
      'SELECT * FROM statistics_cache WHERE cache_key = ?',
      [cacheKey]
    );
    return result as StatisticsCache | null;
  } catch (error) {
    logger.error('Database: Error fetching statistics cache:', error);
    return null;
  }
};

export const getAllStatisticsCache = async (): Promise<StatisticsCache[]> => {
  try {
    const result = await database.getAllAsync('SELECT * FROM statistics_cache');
    return result as StatisticsCache[];
  } catch (error) {
    logger.error('Database: Error fetching all statistics cache:', error);
    return [];
  }
};

export const deleteStatisticsCache = async (cacheKey: string): Promise<void> => {
  try {
    await database.runAsync(
      'DELETE FROM statistics_cache WHERE cache_key = ?',
      [cacheKey]
    );
    logger.debug(`Database: Deleted statistics cache for key: ${cacheKey}`);
  } catch (error) {
    logger.error('Database: Error deleting statistics cache:', error);
    throw error;
  }
};

export const deleteExpiredStatisticsCache = async (maxAge: number = 60 * 60 * 1000): Promise<void> => {
  try {
    const cutoffTime = Date.now() - maxAge;
    await database.runAsync(
      'DELETE FROM statistics_cache WHERE timestamp < ?',
      [cutoffTime]
    );
    logger.debug('Database: Deleted expired statistics cache entries');
  } catch (error) {
    logger.error('Database: Error deleting expired statistics cache:', error);
    throw error;
  }
};

export const clearAllStatisticsCache = async (): Promise<void> => {
  try {
    await database.runAsync('DELETE FROM statistics_cache');
    logger.debug('Database: Cleared all statistics cache');
  } catch (error) {
    logger.error('Database: Error clearing statistics cache:', error);
    throw error;
  }
};

export { database };
