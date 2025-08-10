import {
    clearAllStatisticsCache,
    deleteExpiredStatisticsCache,
    deleteStatisticsCache,
    getAllStatisticsCache,
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
  private operationLocks = new Map<string, Promise<any>>();

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
    
    // Start cleanup interval with error handling
    try {
      this.startCleanupInterval();
    } catch (error) {
      logger.error('StatisticsCacheManager: Failed to start cleanup interval:', error);
    }
  }

  /**
   * Get cached value with TTL check
   * 
   * BEHAVIOR CHANGE (Test Fix): Enhanced to handle both new CacheEntry format and legacy
   * cache data. This fixes test failures where cache operations failed due to format
   * inconsistencies or parsing errors.
   * 
   * Improvements:
   * - Handles both CacheEntry objects and raw cached values
   * - Graceful fallback for unparseable cache data
   * - Improved error handling prevents cache failures from breaking application
   * - Asynchronous access count updates to avoid blocking operations
   * - Proper TTL validation with fallback to default values
   * - Cache miss/hit tracking for performance monitoring
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

      // Check if cache entry has expired based on stored TTL or default
      let entry: CacheEntry<T>;
      try {
        entry = JSON.parse(cached.cache_value);
        
        // Validate that it's a proper CacheEntry structure
        if (!entry || typeof entry !== 'object' || !entry.hasOwnProperty('value')) {
          // If it's not a proper CacheEntry, create one from the raw data
          entry = {
            key,
            value: entry as T,
            timestamp: cached.timestamp,
            ttl: this.config.defaultTTL,
            accessCount: 0,
            lastAccessed: now
          };
        }
      } catch (parseError) {
        // If parsing fails, treat the raw cache_value as the data
        logger.debug('StatisticsCacheManager: Failed to parse cache entry, treating as raw value:', parseError);
        entry = {
          key,
          value: cached.cache_value as T,
          timestamp: cached.timestamp,
          ttl: this.config.defaultTTL,
          accessCount: 0,
          lastAccessed: now
        };
      }

      // Use the entry's TTL if available, otherwise use default
      const effectiveTTL = entry.ttl || this.config.defaultTTL;
      
      if (age > effectiveTTL) {
        logger.debug('StatisticsCacheManager: Cache entry expired', { key, age, ttl: effectiveTTL });
        await this.delete(key);
        this.cacheStats.misses++;
        performanceMonitor.recordCacheMiss();
        return null;
      }

      // Update access statistics asynchronously to avoid blocking
      setImmediate(async () => {
        try {
          entry.accessCount = (entry.accessCount || 0) + 1;
          entry.lastAccessed = now;
          await saveStatisticsCache(key, entry);
        } catch (error) {
          logger.debug('StatisticsCacheManager: Failed to update access stats:', error);
          // Don't throw here as this is a background operation
        }
      });

      this.cacheStats.hits++;
      performanceMonitor.recordCacheHit();
      
      logger.debug('StatisticsCacheManager: Cache hit', { 
        key, 
        age: `${age}ms`,
        accessCount: entry.accessCount,
        ttl: effectiveTTL
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
    return this.withLock(`set_${key}`, async () => {
      try {
        const now = Date.now();
        const entry: CacheEntry<T> = {
          key,
          value,
          timestamp: now,
          ttl: ttl || this.config.defaultTTL,
          accessCount: 0,
          lastAccessed: now,
          dependencies: dependencies || CACHE_DEPENDENCIES[key]
        };

        // Save the complete CacheEntry structure to the database
        await saveStatisticsCache(key, entry);
        this.cacheStats.sets++;

        logger.debug('StatisticsCacheManager: Cache set', { 
          key, 
          ttl: entry.ttl,
          dependencies: entry.dependencies?.length || 0,
          valueType: typeof value
        });

        // Check cache size and cleanup if needed (async to avoid blocking)
        setImmediate(() => this.enforceMaxCacheSize().catch(error => {
          logger.debug('StatisticsCacheManager: Background cache cleanup failed:', error);
        }));
      } catch (error) {
        logger.error('StatisticsCacheManager: Error setting cache entry:', error);
        // Don't throw the error to prevent breaking the calling code
        // The cache is meant to be a performance optimization, not a critical dependency
      }
    });
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
      // Don't throw - deletion failures shouldn't break the application
      // The entry will eventually be cleaned up by the TTL mechanism
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

      // Delete all dependent cache entries with individual error handling
      const results = await Promise.allSettled(uniqueKeys.map(key => this.delete(key)));
      
      // Count successful invalidations
      const successfulInvalidations = results.filter(result => result.status === 'fulfilled').length;
      const failedInvalidations = results.filter(result => result.status === 'rejected');
      
      this.cacheStats.invalidations += successfulInvalidations;

      if (failedInvalidations.length > 0) {
        logger.warn('StatisticsCacheManager: Some cache invalidations failed', {
          changedKey,
          successfulCount: successfulInvalidations,
          failedCount: failedInvalidations.length
        });
      }

      logger.debug('StatisticsCacheManager: Cache invalidated', { 
        changedKey,
        invalidatedKeys: uniqueKeys,
        successfulCount: successfulInvalidations
      });
    } catch (error) {
      logger.error('StatisticsCacheManager: Error invalidating cache:', error);
      // Don't throw - invalidation failures shouldn't break the application
      // Stale cache entries will eventually expire via TTL
    }
  }

  private computingKeys = new Set<string>();

  /**
   * Execute operation with proper locking to prevent race conditions
   */
  private async withLock<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const lockKey = `lock_${key}`;
    
    // Check if there's already an operation in progress for this key
    const existingLock = this.operationLocks.get(lockKey);
    if (existingLock) {
      try {
        // Wait for the existing operation to complete, but with timeout
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Lock timeout')), 30000) // 30 second timeout
        );
        
        await Promise.race([existingLock, timeoutPromise]);
      } catch (error) {
        // If the existing operation failed or timed out, we can proceed
        logger.debug('StatisticsCacheManager: Previous operation failed or timed out', { key, error });
      }
    }

    // Create a new operation promise with proper error handling
    const operationPromise = (async () => {
      try {
        return await operation();
      } catch (error) {
        logger.error('StatisticsCacheManager: Operation failed in withLock', { key, error });
        throw error;
      }
    })();

    // Store the promise for other operations to wait on
    this.operationLocks.set(lockKey, operationPromise);

    try {
      const result = await operationPromise;
      return result;
    } finally {
      // Clean up the lock
      this.operationLocks.delete(lockKey);
    }
  }

  /**
   * Get or set cached value with computation
   * 
   * BEHAVIOR CHANGE (Test Fix): Enhanced to prevent duplicate computations through proper
   * locking mechanisms. This fixes test failures where concurrent cache operations
   * resulted in race conditions or duplicate computations.
   * 
   * Concurrency improvements:
   * - Proper locking prevents duplicate computations for the same key
   * - Double-check pattern ensures cache consistency
   * - Computing key tracking prevents overlapping operations
   * - Fallback to stale cache data if computation fails
   * - Graceful error handling with cache fallback mechanisms
   * - Timeout protection for long-running computations
   */
  async getOrCompute<T>(
    key: string,
    computeFn: () => Promise<T>,
    ttl?: number,
    dependencies?: string[]
  ): Promise<T> {
    return this.withLock(key, async () => {
      try {
        // Try to get from cache first
        const cached = await this.get<T>(key);
        if (cached !== null) {
          return cached;
        }

        // Check if already computing this key to prevent duplicate computation
        if (this.computingKeys.has(key)) {
          // Wait a bit and try again
          await new Promise(resolve => setTimeout(resolve, 10));
          const cachedAfterWait = await this.get<T>(key);
          if (cachedAfterWait !== null) {
            return cachedAfterWait;
          }
        }

        // Mark as computing
        this.computingKeys.add(key);

        try {
          // Double-check cache after acquiring lock
          const doubleCheckCached = await this.get<T>(key);
          if (doubleCheckCached !== null) {
            return doubleCheckCached;
          }

          // Compute the value
          logger.debug('StatisticsCacheManager: Computing value for cache', { key });
          const value = await computeFn();

          // Try to cache the computed value, but don't fail if caching fails
          try {
            await this.set(key, value, ttl, dependencies);
          } catch (cacheError) {
            logger.warn('StatisticsCacheManager: Failed to cache computed value, continuing with result', {
              key,
              error: cacheError
            });
          }

          return value;
        } finally {
          // Remove from computing set
          this.computingKeys.delete(key);
        }
      } catch (computeError) {
        logger.error('StatisticsCacheManager: Error in getOrCompute', { key, error: computeError });
        
        // Try to return stale cache data as fallback if computation fails
        try {
          const staleCache = await getStatisticsCache(key);
          if (staleCache) {
            logger.debug('StatisticsCacheManager: Using stale cache data as fallback', { key });
            const entry = JSON.parse(staleCache.cache_value);
            return entry.value || entry;
          }
        } catch (fallbackError) {
          logger.debug('StatisticsCacheManager: Stale cache fallback also failed', { key, error: fallbackError });
        }
        
        // Re-throw the original computation error if no fallback is available
        throw computeError;
      }
    });
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

      // Check current cache size before warming
      const cacheSize = await this.getCacheSize();
      if (cacheSize.utilizationPercentage > 80) {
        logger.debug('StatisticsCacheManager: Cache utilization high, skipping warming', {
          utilization: cacheSize.utilizationPercentage
        });
        return;
      }

      // Import calculation functions with error handling
      try {
        const { getLocations, getRevealedAreas } = await import('./database');

        // Warm location and revealed areas hashes with timeout
        const warmingPromise = Promise.all([
          getLocations(),
          getRevealedAreas()
        ]);

        // Add timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Cache warming timeout')), 10000)
        );

        const [locations, revealedAreas] = await Promise.race([
          warmingPromise,
          timeoutPromise
        ]) as [any[], any[]];

        // Cache data hashes for change detection
        const locationHash = this.calculateSimpleHash(JSON.stringify(locations));
        const revealedAreasHash = this.calculateSimpleHash(JSON.stringify(revealedAreas));

        // Use shorter TTL for hash data since it's used for change detection
        const hashTTL = Math.min(this.config.defaultTTL, 30 * 60 * 1000); // 30 minutes max

        await Promise.allSettled([
          this.set(CACHE_KEYS.LOCATION_HASH, locationHash, hashTTL),
          this.set(CACHE_KEYS.REVEALED_AREAS_HASH, revealedAreasHash, hashTTL)
        ]);

        logger.debug('StatisticsCacheManager: Cache warming completed', {
          locationCount: locations.length,
          revealedAreaCount: revealedAreas.length
        });
      } catch (importError) {
        logger.warn('StatisticsCacheManager: Failed to import dependencies for cache warming:', importError);
      }
    } catch (error) {
      logger.error('StatisticsCacheManager: Error warming cache:', error);
      // Don't throw - cache warming failures shouldn't break the application
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
   * Get cache size information
   */
  async getCacheSize(): Promise<{
    currentSize: number;
    maxSize: number;
    utilizationPercentage: number;
  }> {
    try {
      const allEntries = await getAllStatisticsCache();
      const currentSize = allEntries.length;
      const utilizationPercentage = (currentSize / this.config.maxCacheSize) * 100;

      return {
        currentSize,
        maxSize: this.config.maxCacheSize,
        utilizationPercentage
      };
    } catch (error) {
      logger.error('StatisticsCacheManager: Error getting cache size:', error);
      return {
        currentSize: 0,
        maxSize: this.config.maxCacheSize,
        utilizationPercentage: 0
      };
    }
  }

  /**
   * Clear all cache entries
   */
  async clearAll(): Promise<void> {
    try {
      await clearAllStatisticsCache();
      this.cacheStats = { hits: 0, misses: 0, sets: 0, invalidations: 0 };
      this.computingKeys.clear();
      this.operationLocks.clear();
      logger.debug('StatisticsCacheManager: All cache cleared');
    } catch (error) {
      logger.error('StatisticsCacheManager: Error clearing cache:', error);
      // Reset stats even if database clear failed to maintain consistency
      this.cacheStats = { hits: 0, misses: 0, sets: 0, invalidations: 0 };
      this.computingKeys.clear();
      this.operationLocks.clear();
      // Don't throw - cache clearing failures shouldn't break the application
    }
  }

  /**
   * Enforce maximum cache size by removing least recently used entries
   */
  private async enforceMaxCacheSize(): Promise<void> {
    try {
      // First, clean up expired entries
      await deleteExpiredStatisticsCache(this.config.defaultTTL);
      
      // Get all cache entries to check current size
      const allEntries = await getAllStatisticsCache();
      
      if (allEntries.length <= this.config.maxCacheSize) {
        return; // No need to evict
      }
      
      // Parse entries and calculate eviction scores
      const parsedEntries = allEntries
        .map(cached => {
          try {
            const entry = JSON.parse(cached.cache_value);
            const now = Date.now();
            const age = now - cached.timestamp;
            const timeSinceLastAccess = now - (entry.lastAccessed || cached.timestamp);
            const accessCount = entry.accessCount || 0;
            
            // Calculate eviction score (higher score = more likely to be evicted)
            // Factors: age, time since last access, access frequency
            const ageScore = age / (24 * 60 * 60 * 1000); // Age in days
            const accessScore = timeSinceLastAccess / (60 * 60 * 1000); // Hours since last access
            const frequencyScore = accessCount > 0 ? 1 / accessCount : 10; // Inverse of access count
            
            // Weighted eviction score
            const evictionScore = (ageScore * 0.3) + (accessScore * 0.5) + (frequencyScore * 0.2);
            
            return {
              key: cached.cache_key,
              lastAccessed: entry.lastAccessed || cached.timestamp,
              accessCount,
              age,
              evictionScore,
              isImportant: this.isImportantCacheKey(cached.cache_key)
            };
          } catch {
            // If parsing fails, mark for eviction with high score
            return {
              key: cached.cache_key,
              lastAccessed: cached.timestamp,
              accessCount: 0,
              age: Date.now() - cached.timestamp,
              evictionScore: 100, // High score for unparseable entries
              isImportant: false
            };
          }
        })
        .sort((a, b) => {
          // Important entries are less likely to be evicted
          if (a.isImportant && !b.isImportant) return 1;
          if (!a.isImportant && b.isImportant) return -1;
          
          // Otherwise sort by eviction score (highest first)
          return b.evictionScore - a.evictionScore;
        });
      
      // Calculate how many entries to remove
      const entriesToRemove = allEntries.length - this.config.maxCacheSize;
      const keysToRemove = parsedEntries.slice(0, entriesToRemove).map(entry => entry.key);
      
      // Remove the entries with highest eviction scores
      const results = await Promise.allSettled(keysToRemove.map(key => this.delete(key)));
      const successfulRemovals = results.filter(r => r.status === 'fulfilled').length;
      
      logger.debug('StatisticsCacheManager: Cache size enforced', {
        totalEntries: allEntries.length,
        targetRemovals: entriesToRemove,
        successfulRemovals,
        maxSize: this.config.maxCacheSize
      });
    } catch (error) {
      logger.error('StatisticsCacheManager: Error enforcing cache size:', error);
    }
  }

  /**
   * Determine if a cache key represents important data that should be preserved longer
   */
  private isImportantCacheKey(key: string): boolean {
    // Core statistics data is more important than intermediate calculations
    const importantKeys = [
      CACHE_KEYS.STATISTICS_DATA,
      CACHE_KEYS.DISTANCE_DATA,
      CACHE_KEYS.WORLD_EXPLORATION,
      CACHE_KEYS.HIERARCHICAL_DATA
    ];
    
    return importantKeys.includes(key);
  }

  /**
   * Start automatic cleanup interval
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(async () => {
      try {
        // First clean up expired entries
        await deleteExpiredStatisticsCache(this.config.defaultTTL);
        
        // Then enforce cache size limits
        await this.enforceMaxCacheSize();
        
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
    return this.withLock(`hash_${key}`, async () => {
      try {
        const currentHash = this.calculateSimpleHash(JSON.stringify(currentData));
        const cachedHash = await this.get<string>(key);
        
        if (cachedHash !== currentHash) {
          await this.set(key, currentHash);
          return true;
        }
        
        return false;
      } catch (error) {
        logger.error('StatisticsCacheManager: Error checking data changes:', error);
        // On error, assume data has changed to trigger refresh
        return true;
      }
    });
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
      // Process in smaller batches to avoid overwhelming the system
      const BATCH_SIZE = 10;
      const batches: Array<typeof entries> = [];
      
      for (let i = 0; i < entries.length; i += BATCH_SIZE) {
        batches.push(entries.slice(i, i + BATCH_SIZE));
      }

      let successfulSets = 0;
      let failedSets = 0;

      // Process batches sequentially to maintain order and prevent overwhelming
      for (const batch of batches) {
        const results = await Promise.allSettled(
          batch.map(entry => 
            this.set(entry.key, entry.value, entry.ttl, entry.dependencies)
          )
        );
        
        // Count successes and failures
        results.forEach(result => {
          if (result.status === 'fulfilled') {
            successfulSets++;
          } else {
            failedSets++;
          }
        });
        
        // Small delay between batches to prevent overwhelming
        if (batches.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 1));
        }
      }
      
      logger.debug('StatisticsCacheManager: Batch set completed', { 
        totalEntries: entries.length,
        successfulSets,
        failedSets,
        batches: batches.length
      });

      if (failedSets > 0) {
        logger.warn('StatisticsCacheManager: Some batch set operations failed', {
          successfulSets,
          failedSets
        });
      }
    } catch (error) {
      logger.error('StatisticsCacheManager: Error in batch set:', error);
      // Don't throw - batch set failures shouldn't break the application
      // Individual entries that failed to cache will be computed again when needed
    }
  }

  /**
   * Execute multiple operations concurrently with proper synchronization
   */
  async executeConcurrentOperations<T>(
    operations: Array<{
      key: string;
      operation: () => Promise<T>;
    }>,
    maxConcurrency: number = 5
  ): Promise<Array<{ key: string; result?: T; error?: Error }>> {
    const results: Array<{ key: string; result?: T; error?: Error }> = [];
    
    // Process operations in batches to limit concurrency
    for (let i = 0; i < operations.length; i += maxConcurrency) {
      const batch = operations.slice(i, i + maxConcurrency);
      
      const batchResults = await Promise.allSettled(
        batch.map(async ({ key, operation }) => {
          try {
            const result = await this.withLock(key, operation);
            return { key, result };
          } catch (error) {
            return { key, error: error as Error };
          }
        })
      );
      
      // Collect results from this batch
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            key: batch[index].key,
            error: result.reason
          });
        }
      });
      
      // Small delay between batches to prevent overwhelming
      if (i + maxConcurrency < operations.length) {
        await new Promise(resolve => setTimeout(resolve, 1));
      }
    }
    
    return results;
  }

  /**
   * Get cache health information
   */
  async getCacheHealth(): Promise<{
    isHealthy: boolean;
    issues: string[];
    stats: ReturnType<typeof this.getCacheStats>;
    size: Awaited<ReturnType<typeof this.getCacheSize>>;
    activeLocks: number;
    computingKeys: number;
  }> {
    const issues: string[] = [];
    const stats = this.getCacheStats();
    const size = await this.getCacheSize();
    
    // Check for potential issues
    if (stats.hitRate < 50) {
      issues.push('Low cache hit rate');
    }
    
    if (size.utilizationPercentage > 90) {
      issues.push('Cache near capacity');
    }
    
    if (this.operationLocks.size > 10) {
      issues.push('High number of concurrent operations');
    }
    
    if (this.computingKeys.size > 5) {
      issues.push('Many keys being computed simultaneously');
    }
    
    return {
      isHealthy: issues.length === 0,
      issues,
      stats,
      size,
      activeLocks: this.operationLocks.size,
      computingKeys: this.computingKeys.size
    };
  }

  /**
   * Cleanup function
   */
  cleanup(): void {
    this.stopCleanupInterval();
    this.operationLocks.clear();
    this.computingKeys.clear();
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