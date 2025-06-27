import * as SQLite from 'expo-sqlite';
import { SQLResultSet, SQLTransactionAsync } from 'expo-sqlite';

const database = SQLite.openDatabase('locations.db');

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
  try {
    await database.transactionAsync(async (tx: SQLTransactionAsync) => {
      await tx.executeSqlAsync(
        'CREATE TABLE IF NOT EXISTS locations (id INTEGER PRIMARY KEY NOT NULL, latitude REAL NOT NULL, longitude REAL NOT NULL, timestamp INTEGER NOT NULL);'
      );
      await tx.executeSqlAsync(
        'CREATE TABLE IF NOT EXISTS revealed_areas (id INTEGER PRIMARY KEY NOT NULL, geojson TEXT NOT NULL);'
      );
    });
    console.log('Database and tables created successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
};

export const getLocations = async (): Promise<Location[]> => {
  try {
    return await database.transactionAsync(async (tx: SQLTransactionAsync) => {
      const result = await tx.executeSqlAsync('SELECT * FROM locations');
      return (result as SQLResultSet).rows._array;
    });
  } catch (error) {
    console.error('Error fetching locations:', error);
    return [];
  }
};

export const saveRevealedArea = async (geojson: object): Promise<void> => {
  try {
    await database.transactionAsync(async (tx: SQLTransactionAsync) => {
      await tx.executeSqlAsync(
        'INSERT INTO revealed_areas (geojson) VALUES (?);',
        [JSON.stringify(geojson)]
      );
    });
  } catch (error) {
    console.error('Error saving revealed area:', error);
  }
};

export const getRevealedAreas = async (): Promise<object[]> => {
  try {
    return await database.transactionAsync(async (tx: SQLTransactionAsync) => {
      const result = await tx.executeSqlAsync('SELECT geojson FROM revealed_areas');
      return (result as SQLResultSet).rows._array.map((row: RevealedArea) => JSON.parse(row.geojson));
    });
  } catch (error) {
    console.error('Error fetching revealed areas:', error);
    return [];
  }
};

export { database };
