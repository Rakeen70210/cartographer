import {
    clearAllStatisticsCache,
    deleteExpiredStatisticsCache,
    deleteStatisticsCache,
    getStatisticsCache,
    saveStatisticsCache
} from './database';
import { logger } from './logger';
import { performanceMonitor } from './statisticsPerformanceOptimizer';

/**
 * Advanced caching system for statistics calculations
 * Implements TTL, cache invalidation, and intelligent cache warming
 */

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
  dependencies?: string[];
}

export interface CacheConfig {
  defaultTTL: number; // milliseconds
  maxCacheSize: number; // number of entries
  cleanupInterval: number; // milliseconds
  enableCacheWarming: boolean;
  compressionThreshold: number; // bytes
}

const DEFAULT_CACHE_CONFIG: CacheConfig = {
  defaultTTL: 60 * 60 * 1000, // 1 hour
  maxCacheSize: 1000,
  cleanupInterval: 5 * 60 * 1000, // 5 minutes
  enableCacheWarming: true,
  compressionThreshold: 10000 // 10KB
};

/**
 * Cache keys for different statistics components
 */
export const CACHE_KEYS = {
  STATISTICS_DATA: 'statistics_data',
  DISTANCE_DATA: 'distance_data',
  WORLD_EXPLORATION: 'world_exploration',
  HIERARCHICAL_DATA: 'hierarchical_data',
  REMAINING_REGIONS: 'remaining_regions',
  LOCATION_HASH: 'location_hash',
  REVEALED_AREAS_HASH: 'revealed_areas_hash',
  GEOCODING_BATCH: 'geocoding_batch',
  REGION_BOUNDARIES: 'region_boundaries'
} as const;

/**
 * Cache dependency graph for invalidation
 */
const CACHE_DEPENDENCIES: Record<string, string[]> = {
  [CACHE_KEYS.STATISTICS_DATA]: [
    CACHE_KEYS.DISTANCE_DATA,
    CACHE_KEYS.WORLD_EXPLORATION,
    CACHE_KEYS.HIERARCHICAL_DATA,
    CACHE_KEYS.REMAINING_REGIONS
  ],
  [CACHE_KEYS.DISTANCE_DATA]: [CACHE_KEYS.LOCATION_HASH],
  [CACHE_KEYS.WORLD_EXPLORATION]: [CACHE_KEYS.REVEALED_AREAS_HASH],
  [CACHE_KEYS.HIERARCHICAL_DATA]: [
    CACHE_KEYS.LOCATION_HASH,
    CACHE_KEYS.GEOCODING_BATCH,
    CACHE_KEYS.REGION_BOUNDARIES
  ],
  [CACHE_KEYS.REMAINING_REGIONS]: [
    CACHE_KEYS.LOCATION_HASH,
    CACHE_KEYS.GEOCODING_BATCH
  ]
};

export class StatisticsCacheManager {
  private config: CacheConfig;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private cacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    invalidations: 0
  };

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
    this.startCleanupInterval();
  }

  /**
   * Get cached value with TTL check
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await getStatisticsCache(key);
      
      if (!cached) {
        this.cacheStats.misses++;
        performanceMonitor.recordCacheMiss();
        return null;
      }

      const now = Date.now();
      const age = now - cached.timestamp;

      // Check if cache entry has expired
      if (age > this.config.defaultTTL) {
        logger.debug('StatisticsCacheManager: Cache entry expired', { key, age });
        await this.delete(key);
        this.cacheStats.misses++;
        performanceMonitor.recordCacheMiss();
        return null;
      }

      // Update access statistics
      const entry: CacheEntry<T> = JSON.parse(cached.cache_value);
      entry.accessCount = (entry.accessCount || 0) + 1;
      entry.lastAccessed = now;

      // Save updated access stats
      await saveStatisticsCache(key, entry);

      this.cacheStats.hits++;
      performanceMonitor.recordCacheHit();
      
      logger.debug('StatisticsCacheManager: Cache hit', { 
        key, 
        age: `${age}ms`,
        accessCount: entry.accessCount 
      });

      return entry.value;
    } catch (error) {
      logger.error('StatisticsCacheManager: Error getting cache entry:', error);
      this.cacheStats.misses++;
      performanceMonitor.recordCacheMiss();
      return null;
    }
  }

  /**
   * Set cached value with TTL and dependencies
   */
  async set<T>(
    key: string, 
    value: T, 
    ttl?: number,
    dependencies?: string[]
  ): Promise<void> {
    try {
      const entry: CacheEntry<T> = {
        key,
        value,
        timestamp: Date.now(),
        ttl: ttl || this.config.defaultTTL,
        accessCount: 0,
        lastAccessed: Date.now(),
        dependencies: dependencies || CACHE_DEPENDENCIES[key]
      };

      await saveStatisticsCache(key, entry);
      this.cacheStats.sets++;

      logger.debug('StatisticsCacheManager: Cache set', { 
        key, 
        ttl: entry.ttl,
        dependencies: entry.dependencies?.length || 0
      });

      // Check cache size and cleanup if needed
      await this.enforceMaxCacheSize();
    } catch (error) {
      logger.error('StatisticsCacheManager: Error setting cache entry:', error);
    }
  }

  /**
   * Delete cached value
   */
  async delete(key: string): Promise<void> {
    try {
      await deleteStatisticsCache(key);
      logger.debug('StatisticsCacheManager: Cache deleted', { key });
    } catch (error) {
      logger.error('StatisticsCacheManager: Error deleting cache entry:', error);
    }
  }

  /**
   * Invalidate cache entries based on dependencies
   */
  async invalidate(changedKey: string): Promise<void> {
    try {
      const keysToInvalidate: string[] = [];

      // Find all cache entries that depend on the changed key
      for (const [cacheKey, dependencies] of Object.entries(CACHE_DEPENDENCIES)) {
        if (dependencies.includes(changedKey)) {
          keysToInvalidate.push(cacheKey);
        }
      }

      // Also invalidate the changed key itself
      keysToInvalidate.push(changedKey);

      // Remove duplicates
      const uniqueKeys = [...new Set(keysToInvalidate)];

      // Delete all dependent cache entries
      await Promise.all(uniqueKeys.map(key => this.delete(key)));

      this.cacheStats.invalidations += uniqueKeys.length;

      logger.debug('StatisticsCacheManager: Cache invalidated', { 
        changedKey,
        invalidatedKeys: uniqueKeys
      });
    } catch (error) {
      logger.error('StatisticsCacheManager: Error invalidating cache:', error);
    }
  }

  /**
   * Get or set cached value with computation
   */
  async getOrCompute<T>(
    key: string,
    computeFn: () => Promise<T>,
    ttl?: number,
    dependencies?: string[]
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Compute the value
    logger.debug('StatisticsCacheManager: Computing value for cache', { key });
    const value = await computeFn();

    // Cache the computed value
    await this.set(key, value, ttl, dependencies);

    return value;
  }

  /**
   * Warm cache with commonly accessed data
   */
  async warmCache(): Promise<void> {
    if (!this.config.enableCacheWarming) {
      return;
    }

    try {
      logger.debug('StatisticsCacheManager: Starting cache warming');

      // Import calculation functions
      const { calculateDataHash } = await import('../hooks/useStatistics');
      const { getLocations, getRevealedAreas } = await import('./database');

      // Warm location and revealed areas hashes
      const [locations, revealedAreas] = await Promise.all([
        getLocations(),
        getRevealedAreas()
      ]);

      // Cache data hashes for change detection
      const locationHash = this.calculateSimpleHash(JSON.stringify(locations));
      const revealedAreasHash = this.calculateSimpleHash(JSON.stringify(revealedAreas));

      await Promise.all([
        this.set(CACHE_KEYS.LOCATION_HASH, locationHash, this.config.defaultTTL),
        this.set(CACHE_KEYS.REVEALED_AREAS_HASH, revealedAreasHash, this.config.defaultTTL)
      ]);

      logger.debug('StatisticsCacheManager: Cache warming completed');
    } catch (error) {
      logger.error('StatisticsCacheManager: Error warming cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): typeof this.cacheStats & { hitRate: number } {
    const total = this.cacheStats.hits + this.cacheStats.misses;
    const hitRate = total > 0 ? (this.cacheStats.hits / total) * 100 : 0;

    return {
      ...this.cacheStats,
      hitRate
    };
  }

  /**
   * Clear all cache entries
   */
  async clearAll(): Promise<void> {
    try {
      await clearAllStatisticsCache();
      this.cacheStats = { hits: 0, misses: 0, sets: 0, invalidations: 0 };
      logger.debug('StatisticsCacheManager: All cache cleared');
    } catch (error) {
      logger.error('StatisticsCacheManager: Error clearing cache:', error);
    }
  }

  /**
   * Enforce maximum cache size by removing least recently used entries
   */
  private async enforceMaxCacheSize(): Promise<void> {
    try {
      // This is a simplified implementation
      // In a real scenario, you'd want to track cache size more precisely
      await deleteExpiredStatisticsCache(this.config.defaultTTL);
    } catch (error) {
      logger.error('StatisticsCacheManager: Error enforcing cache size:', error);
    }
  }

  /**
   * Start automatic cleanup interval
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(async () => {
      try {
        await deleteExpiredStatisticsCache(this.config.defaultTTL);
        logger.debug('StatisticsCacheManager: Automatic cleanup completed');
      } catch (error) {
        logger.error('StatisticsCacheManager: Error during automatic cleanup:', error);
      }
    }, this.config.cleanupInterval);
  }

  /**
   * Stop cleanup interval
   */
  stopCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Calculate simple hash for change detection
   */
  private calculateSimpleHash(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  /**
   * Check if data has changed by comparing hashes
   */
  async hasDataChanged(key: string, currentData: any): Promise<boolean> {
    const currentHash = this.calculateSimpleHash(JSON.stringify(currentData));
    const cachedHash = await this.get<string>(key);
    
    if (cachedHash !== currentHash) {
      await this.set(key, currentHash);
      return true;
    }
    
    return false;
  }

  /**
   * Batch cache operations for better performance
   */
  async batchSet(entries: Array<{
    key: string;
    value: any;
    ttl?: number;
    dependencies?: string[];
  }>): Promise<void> {
    try {
      await Promise.all(
        entries.map(entry => 
          this.set(entry.key, entry.value, entry.ttl, entry.dependencies)
        )
      );
      
      logger.debug('StatisticsCacheManager: Batch set completed', { 
        count: entries.length 
      });
    } catch (error) {
      logger.error('StatisticsCacheManager: Error in batch set:', error);
    }
  }

  /**
   * Cleanup function
   */
  cleanup(): void {
    this.stopCleanupInterval();
  }
}

// Global cache manager instance
export const statisticsCacheManager = new StatisticsCacheManager();

/**
 * Cleanup function for cache manager
 */
export const cleanupCacheManager = (): void => {
  statisticsCacheManager.cleanup();
};