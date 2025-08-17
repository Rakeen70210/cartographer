import { logger } from '@/utils/logger';
import { database } from './database';

interface Migration {
  version: number;
  description: string;
  up: () => Promise<void>;
}

const CURRENT_SCHEMA_VERSION = 2;
const SCHEMA_VERSION_KEY = 'schema_version';

// Get current schema version from database
const getCurrentSchemaVersion = async (): Promise<number> => {
  try {
    // Check if schema_version table exists
    const tableExists = await database.getFirstAsync(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'"
    );
    
    if (!tableExists) {
      // Create schema_version table if it doesn't exist
      await database.execAsync(`
        CREATE TABLE schema_version (
          key TEXT PRIMARY KEY,
          version INTEGER NOT NULL
        );
      `);
      
      // Set initial version to 1 (original schema)
      await database.runAsync(
        'INSERT INTO schema_version (key, version) VALUES (?, ?)',
        [SCHEMA_VERSION_KEY, 1]
      );
      return 1;
    }
    
    const result = await database.getFirstAsync(
      'SELECT version FROM schema_version WHERE key = ?',
      [SCHEMA_VERSION_KEY]
    );
    
    return result ? (result as { version: number }).version : 1;
  } catch (error) {
    logger.error('Database Migration: Error getting schema version:', error);
    return 1;
  }
};

// Update schema version in database
const updateSchemaVersion = async (version: number): Promise<void> => {
  try {
    await database.runAsync(
      'UPDATE schema_version SET version = ? WHERE key = ?',
      [version, SCHEMA_VERSION_KEY]
    );
    logger.info(`Database Migration: Updated schema version to ${version}`);
  } catch (error) {
    logger.error('Database Migration: Error updating schema version:', error);
    throw error;
  }
};

// Migration definitions
const migrations: Migration[] = [
  {
    version: 2,
    description: 'Add statistics dashboard tables',
    up: async () => {
      logger.info('Database Migration: Adding statistics dashboard tables');
      
      // Cache for reverse geocoding results
      await database.execAsync(`
        CREATE TABLE IF NOT EXISTS location_geocoding (
          id INTEGER PRIMARY KEY,
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          country TEXT,
          state TEXT,
          city TEXT,
          timestamp INTEGER NOT NULL,
          UNIQUE(latitude, longitude)
        );
      `);

      // Cache for region boundary data
      await database.execAsync(`
        CREATE TABLE IF NOT EXISTS region_boundaries (
          id INTEGER PRIMARY KEY,
          region_type TEXT NOT NULL,
          region_name TEXT NOT NULL,
          boundary_geojson TEXT NOT NULL,
          area_km2 REAL,
          timestamp INTEGER NOT NULL,
          UNIQUE(region_type, region_name)
        );
      `);

      // Statistics calculation cache
      await database.execAsync(`
        CREATE TABLE IF NOT EXISTS statistics_cache (
          id INTEGER PRIMARY KEY,
          cache_key TEXT UNIQUE NOT NULL,
          cache_value TEXT NOT NULL,
          timestamp INTEGER NOT NULL
        );
      `);
      
      logger.success('Database Migration: Statistics dashboard tables created successfully');
    }
  }
];

// Run all pending migrations
export const runMigrations = async (): Promise<void> => {
  try {
    logger.info('Database Migration: Starting migration process');
    
    const currentVersion = await getCurrentSchemaVersion();
    logger.info(`Database Migration: Current schema version: ${currentVersion}`);
    
    if (currentVersion >= CURRENT_SCHEMA_VERSION) {
      logger.info('Database Migration: Schema is up to date');
      return;
    }
    
    // Run migrations in order
    for (const migration of migrations) {
      if (migration.version > currentVersion) {
        logger.info(`Database Migration: Running migration ${migration.version}: ${migration.description}`);
        
        try {
          await migration.up();
          await updateSchemaVersion(migration.version);
          logger.success(`Database Migration: Migration ${migration.version} completed successfully`);
        } catch (error) {
          logger.error(`Database Migration: Migration ${migration.version} failed:`, error);
          throw error;
        }
      }
    }
    
    logger.success('Database Migration: All migrations completed successfully');
  } catch (error) {
    logger.error('Database Migration: Migration process failed:', error);
    throw error;
  }
};

// Check if migrations are needed
export const checkMigrationsNeeded = async (): Promise<boolean> => {
  try {
    const currentVersion = await getCurrentSchemaVersion();
    return currentVersion < CURRENT_SCHEMA_VERSION;
  } catch (error) {
    logger.error('Database Migration: Error checking if migrations are needed:', error);
    return false;
  }
};

// Get migration status
export const getMigrationStatus = async (): Promise<{
  currentVersion: number;
  latestVersion: number;
  migrationsNeeded: boolean;
  pendingMigrations: Migration[];
}> => {
  try {
    const currentVersion = await getCurrentSchemaVersion();
    const migrationsNeeded = currentVersion < CURRENT_SCHEMA_VERSION;
    const pendingMigrations = migrations.filter(m => m.version > currentVersion);
    
    return {
      currentVersion,
      latestVersion: CURRENT_SCHEMA_VERSION,
      migrationsNeeded,
      pendingMigrations
    };
  } catch (error) {
    logger.error('Database Migration: Error getting migration status:', error);
    throw error;
  }
};