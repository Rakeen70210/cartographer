import * as SQLite from 'expo-sqlite';

const database = SQLite.openDatabase('locations.db');

const initDatabase = async () => {
  try {
    await database.transactionAsync(async tx => {
      await tx.executeSqlAsync(
        'CREATE TABLE IF NOT EXISTS locations (id INTEGER PRIMARY KEY NOT NULL, latitude REAL NOT NULL, longitude REAL NOT NULL, timestamp INTEGER NOT NULL);'
      );
    });
    console.log('Database and table created successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
};

const getLocations = async () => {
  try {
    return await database.transactionAsync(async tx => {
      const result = await tx.executeSqlAsync('SELECT * FROM locations');
      return result.rows._array;
    });
  } catch (error) {
    console.error('Error fetching locations:', error);
    return [];
  }
};


export { database, initDatabase, getLocations };