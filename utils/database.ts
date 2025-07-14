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

export { database };
