import { FeatureCollection, MultiPolygon, Polygon } from 'geojson';

import { FogCalculationResult } from '@/utils/fogCalculation';
import { logger } from '@/utils/logger';

/**
 * Configuration options for fog cache behavior
 * Controls cache size, expiration, and invalidation strategies
 */
export interface FogCacheOptions {
  /** Maximum number of cached fog tiles (default: 100) */
  maxCacheSize?: number;
  /** Cache entry expiration time in milliseconds (default: 5 minutes) */
  cacheExpirationMs?: number;
  /** Minimum time between cache cleanups in milliseconds (default: 30 seconds) */
  cleanupIntervalMs?: number;
  /** Whether to enable cache compression for memory efficiency (default: true) */
  enableCompression?: boolean;
  /** Viewport bounds tolerance for cache hits (default: 0.001 degrees) */
  viewportTolerance?: number;
  /** Whether to cache intermediate calculation results (default: true) */
  cacheIntermediateResults?: boolean;
}

/**
 * Represents a cached fog calculation entry
 * Contains fog geometry, metadata, and cache management information
 */
export interface FogCacheEntry {
  /** Unique cache key for this entry */
  key: string;
  /** Cached fog GeoJSON ready for rendering */
  fogGeoJSON: FeatureCollection<Polygon | MultiPolygon>;
  /** Viewport bounds this cache entry covers */
  viewportBounds: [number, number, number, number];
  /** Hash of revealed areas used for this calculation */
  revealedAreasHash: string;
  /** Timestamp when this entry was created */
  createdAt: number;
  /** Timestamp when this entry was last accessed */
  lastAccessedAt: number;
  /** Number of times this entry has been accessed */
  accessCount: number;
  /** Original calculation time in milliseconds */
  calculationTime: number;
  /** Compressed size in bytes (if compression is enabled) */
  compressedSize?: number;
  /** Whether this entry contains intermediate results */
  isIntermediateResult: boolean;
}

/**
 * Statistics about cache performance and usage
 * Used for monitoring and optimization of cache behavior
 */
export interface FogCacheStats {
  /** Total number of entries in cache */
  totalEntries: number;
  /** Number of cache hits since last reset */
  cacheHits: number;
  /** Number of cache misses since last reset */
  cacheMisses: number;
  /** Cache hit ratio as percentage */
  hitRatio: number;
  /** Total memory usage in bytes */
  memoryUsage: number;
  /** Average calculation time saved by caching (ms) */
  averageTimeSaved: number;
  /** Number of entries evicted due to size limits */
  evictedEntries: number;
  /** Number of entries expired due to age */
  expiredEntries: number;
  /** Most frequently accessed cache keys */
  topCacheKeys: string[];
}

/**
 * Default configuration for fog cache
 */
const DEFAULT_CACHE_OPTIONS: Required<FogCacheOptions> = {
  maxCacheSize: 100,
  cacheExpirationMs: 5 * 60 * 1000, // 5 minutes
  cleanupIntervalMs: 30 * 1000, // 30 seconds
  enableCompression: true,
  viewportTolerance: 0.001, // ~100 meters at equator
  cacheIntermediateResults: true,
};

/**
 * Manages caching of fog calculation results for improved performance
 * Provides intelligent caching with automatic invalidation and memory management
 * 
 * @example
 * ```typescript
 * const cacheManager = new FogCacheManager({
 *   maxCacheSize: 50,
 *   cacheExpirationMs: 10 * 60 * 1000 // 10 minutes
 * });
 * 
 * // Check for cached result
 * const cached = cacheManager.getCachedFog(viewportBounds, revealedAreasHash);
 * if (cached) {
 *   return cached.fogGeoJSON;
 * }
 * 
 * // Calculate and cache new result
 * const result = await calculateFog();
 * cacheManager.cacheFogResult(viewportBounds, revealedAreasHash, result);
 * ```
 */
export class FogCacheManager {
  private cache: Map<string, FogCacheEntry> = new Map();
  private options: Required<FogCacheOptions>;
  private stats: FogCacheStats;
  private lastCleanup: number = 0;
  private cleanupTimer: NodeJS.Timeout | null = null;

  /**
   * Creates a new fog cache manager
   * 
   * @param options - Configuration options for cache behavior
   */
  constructor(options: FogCacheOptions = {}) {
    this.options = { ...DEFAULT_CACHE_OPTIONS, ...options };
    this.stats = this.initializeStats();
    
    // Start periodic cleanup
    this.startPeriodicCleanup();
    
    logger.debug('FogCacheManager: Created with options:', this.options);
  }

  /**
   * Generates a cache key for viewport bounds with tolerance
   * Creates consistent keys for similar viewport bounds to improve cache hits
   * 
   * @param viewportBounds - Viewport bounds to generate key for
   * @param revealedAreasHash - Hash of revealed areas for cache invalidation
   * @param isIntermediate - Whether this is an intermediate result
   * @returns Cache key string
   * 
   * @private
   */
  private generateCacheKey(
    viewportBounds: [number, number, number, number],
    revealedAreasHash: string,
    isIntermediate: boolean = false
  ): string {
    // Round bounds to tolerance level for consistent keys
    const tolerance = this.options.viewportTolerance;
    const roundedBounds = viewportBounds.map(coord => 
      Math.round(coord / tolerance) * tolerance
    );
    
    const prefix = isIntermediate ? 'intermediate' : 'final';
    return `${prefix}:${roundedBounds.join(',')}:${revealedAreasHash}`;
  }

  /**
   * Calculates hash of revealed areas for cache invalidation
   * Creates consistent hash that changes when revealed areas are modified
   * 
   * @param revealedAreas - Revealed areas to hash (can be null)
   * @returns Hash string for cache invalidation
   * 
   * @private
   */
  private calculateRevealedAreasHash(revealedAreas: any): string {
    if (!revealedAreas) {
      return 'no-revealed-areas';
    }
    
    try {
      // Create a simple hash based on geometry coordinates
      const geometryString = JSON.stringify(revealedAreas.geometry || revealedAreas);
      
      // Simple hash function (not cryptographic, just for cache invalidation)
      let hash = 0;
      for (let i = 0; i < geometryString.length; i++) {
        const char = geometryString.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      
      return hash.toString(36);
    } catch (error) {
      logger.warn('FogCacheManager: Error calculating revealed areas hash:', error);
      return `error-${Date.now()}`;
    }
  }

  /**
   * Compresses fog GeoJSON for memory-efficient storage
   * Reduces memory usage by removing unnecessary precision and whitespace
   * 
   * @param fogGeoJSON - Fog GeoJSON to compress
   * @returns Compressed fog data and size information
   * 
   * @private
   */
  private compressFogData(fogGeoJSON: FeatureCollection<Polygon | MultiPolygon>): {
    compressed: FeatureCollection<Polygon | MultiPolygon>;
    originalSize: number;
    compressedSize: number;
  } {
    if (!this.options.enableCompression) {
      const size = JSON.stringify(fogGeoJSON).length;
      return {
        compressed: fogGeoJSON,
        originalSize: size,
        compressedSize: size,
      };
    }

    try {
      // Create a compressed version by reducing coordinate precision
      const compressed: FeatureCollection<Polygon | MultiPolygon> = {
        type: 'FeatureCollection',
        features: fogGeoJSON.features.map(feature => ({
          type: 'Feature',
          properties: {},
          geometry: {
            ...feature.geometry,
            coordinates: this.compressCoordinates(feature.geometry.coordinates),
          },
        })),
      };

      const originalSize = JSON.stringify(fogGeoJSON).length;
      const compressedSize = JSON.stringify(compressed).length;

      return {
        compressed,
        originalSize,
        compressedSize,
      };
    } catch (error) {
      logger.warn('FogCacheManager: Error compressing fog data:', error);
      
      // Handle circular reference or other JSON errors
      let size = 0;
      try {
        size = JSON.stringify(fogGeoJSON).length;
      } catch (jsonError) {
        // If we can't stringify, estimate size based on feature count
        size = fogGeoJSON.features.length * 1000; // Rough estimate
      }
      
      return {
        compressed: fogGeoJSON,
        originalSize: size,
        compressedSize: size,
      };
    }
  }

  /**
   * Compresses coordinate arrays by reducing precision
   * Removes unnecessary decimal places to reduce memory usage
   * 
   * @param coordinates - Coordinate arrays to compress
   * @returns Compressed coordinate arrays
   * 
   * @private
   */
  private compressCoordinates(coordinates: any): any {
    if (!Array.isArray(coordinates)) {
      return coordinates;
    }

    return coordinates.map(coord => {
      if (Array.isArray(coord)) {
        if (typeof coord[0] === 'number' && typeof coord[1] === 'number') {
          // This is a coordinate pair - round to 6 decimal places (~1 meter precision)
          return [
            Math.round(coord[0] * 1000000) / 1000000,
            Math.round(coord[1] * 1000000) / 1000000,
          ];
        } else {
          // This is a nested array - recurse
          return this.compressCoordinates(coord);
        }
      }
      return coord;
    });
  }

  /**
   * Checks if a cache entry is still valid
   * Validates expiration time and other cache validity criteria
   * 
   * @param entry - Cache entry to validate
   * @returns True if entry is still valid
   * 
   * @private
   */
  private isEntryValid(entry: FogCacheEntry): boolean {
    const now = Date.now();
    const age = now - entry.createdAt;
    
    return age < this.options.cacheExpirationMs;
  }

  /**
   * Evicts least recently used entries when cache is full
   * Maintains cache size within configured limits
   * 
   * @private
   */
  private evictLRUEntries(): void {
    if (this.cache.size <= this.options.maxCacheSize) {
      return;
    }

    // Sort entries by last accessed time (oldest first)
    const entries = Array.from(this.cache.entries()).sort(
      ([, a], [, b]) => a.lastAccessedAt - b.lastAccessedAt
    );

    // Remove oldest entries until we're under the limit
    const entriesToRemove = this.cache.size - this.options.maxCacheSize;
    for (let i = 0; i < entriesToRemove; i++) {
      const [key] = entries[i];
      this.cache.delete(key);
      this.stats.evictedEntries++;
      
      logger.debugThrottled(
        `FogCacheManager: Evicted LRU cache entry: ${key}`,
        10000
      );
    }
  }

  /**
   * Removes expired cache entries
   * Cleans up old entries that have exceeded their expiration time
   * 
   * @private
   */
  private removeExpiredEntries(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (!this.isEntryValid(entry)) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.cache.delete(key);
      this.stats.expiredEntries++;
    }

    if (expiredKeys.length > 0) {
      logger.debugThrottled(
        `FogCacheManager: Removed ${expiredKeys.length} expired cache entries`,
        10000
      );
    }
  }

  /**
   * Performs periodic cache cleanup
   * Removes expired entries and manages memory usage
   * 
   * @private
   */
  private performCleanup(): void {
    const now = Date.now();
    
    if (now - this.lastCleanup < this.options.cleanupIntervalMs) {
      return;
    }

    logger.debugThrottled('FogCacheManager: Performing cache cleanup', 30000);

    this.removeExpiredEntries();
    this.evictLRUEntries();
    this.updateMemoryUsage();

    this.lastCleanup = now;
  }

  /**
   * Starts periodic cleanup timer
   * Ensures cache is regularly cleaned up without manual intervention
   * 
   * @private
   */
  private startPeriodicCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.performCleanup();
    }, this.options.cleanupIntervalMs);
  }

  /**
   * Updates memory usage statistics
   * Calculates current memory consumption of cached data
   * 
   * @private
   */
  private updateMemoryUsage(): void {
    let totalMemory = 0;

    for (const entry of this.cache.values()) {
      totalMemory += entry.compressedSize || 0;
      totalMemory += JSON.stringify({
        key: entry.key,
        viewportBounds: entry.viewportBounds,
        revealedAreasHash: entry.revealedAreasHash,
        createdAt: entry.createdAt,
        lastAccessedAt: entry.lastAccessedAt,
        accessCount: entry.accessCount,
        calculationTime: entry.calculationTime,
      }).length;
    }

    this.stats.memoryUsage = totalMemory;
  }

  /**
   * Initializes cache statistics
   * Sets up initial statistics tracking structure
   * 
   * @returns Initial statistics object
   * 
   * @private
   */
  private initializeStats(): FogCacheStats {
    return {
      totalEntries: 0,
      cacheHits: 0,
      cacheMisses: 0,
      hitRatio: 0,
      memoryUsage: 0,
      averageTimeSaved: 0,
      evictedEntries: 0,
      expiredEntries: 0,
      topCacheKeys: [],
    };
  }

  /**
   * Updates cache statistics after cache operations
   * Maintains accurate performance metrics for monitoring
   * 
   * @private
   */
  private updateStats(): void {
    this.stats.totalEntries = this.cache.size;
    
    const totalRequests = this.stats.cacheHits + this.stats.cacheMisses;
    this.stats.hitRatio = totalRequests > 0 ? (this.stats.cacheHits / totalRequests) * 100 : 0;

    // Calculate average time saved
    let totalTimeSaved = 0;
    let hitCount = 0;

    for (const entry of this.cache.values()) {
      if (entry.accessCount > 1) {
        totalTimeSaved += entry.calculationTime * (entry.accessCount - 1);
        hitCount += entry.accessCount - 1;
      }
    }

    this.stats.averageTimeSaved = hitCount > 0 ? totalTimeSaved / hitCount : 0;

    // Update top cache keys
    const sortedEntries = Array.from(this.cache.entries())
      .sort(([, a], [, b]) => b.accessCount - a.accessCount)
      .slice(0, 5);
    
    this.stats.topCacheKeys = sortedEntries.map(([key]) => key);
  }

  /**
   * Retrieves cached fog result for given viewport and revealed areas
   * Returns cached fog geometry if available and valid
   * 
   * @param viewportBounds - Viewport bounds to look up
   * @param revealedAreas - Current revealed areas for cache validation
   * @param isIntermediate - Whether to look for intermediate results
   * @returns Cached fog entry if found and valid, null otherwise
   * 
   * @example
   * ```typescript
   * const cached = cacheManager.getCachedFog(
   *   [-74.1, 40.7, -73.9, 40.8],
   *   currentRevealedAreas
   * );
   * 
   * if (cached) {
   *   console.log('Cache hit! Using cached fog geometry');
   *   return cached.fogGeoJSON;
   * }
   * ```
   */
  getCachedFog(
    viewportBounds: [number, number, number, number],
    revealedAreas: any,
    isIntermediate: boolean = false
  ): FogCacheEntry | null {
    const revealedAreasHash = this.calculateRevealedAreasHash(revealedAreas);
    const cacheKey = this.generateCacheKey(viewportBounds, revealedAreasHash, isIntermediate);

    const entry = this.cache.get(cacheKey);

    if (!entry) {
      this.stats.cacheMisses++;
      this.updateStats();
      return null;
    }

    if (!this.isEntryValid(entry)) {
      this.cache.delete(cacheKey);
      this.stats.cacheMisses++;
      this.stats.expiredEntries++;
      this.updateStats();
      return null;
    }

    // Update access statistics
    entry.lastAccessedAt = Date.now();
    entry.accessCount++;
    this.stats.cacheHits++;

    logger.debugThrottled(
      `FogCacheManager: Cache hit for key: ${cacheKey} (accessed ${entry.accessCount} times)`,
      5000
    );

    this.updateStats();
    return entry;
  }

  /**
   * Caches a fog calculation result for future use
   * Stores fog geometry with metadata for intelligent cache management
   * 
   * @param viewportBounds - Viewport bounds this result covers
   * @param revealedAreas - Revealed areas used for this calculation
   * @param fogResult - Fog calculation result to cache
   * @param isIntermediate - Whether this is an intermediate result
   * 
   * @example
   * ```typescript
   * const fogResult = await calculateFog(viewportBounds, revealedAreas);
   * 
   * cacheManager.cacheFogResult(
   *   viewportBounds,
   *   revealedAreas,
   *   fogResult
   * );
   * ```
   */
  cacheFogResult(
    viewportBounds: [number, number, number, number],
    revealedAreas: any,
    fogResult: FogCalculationResult,
    isIntermediate: boolean = false
  ): void {
    // Skip caching intermediate results if disabled
    if (isIntermediate && !this.options.cacheIntermediateResults) {
      return;
    }

    const revealedAreasHash = this.calculateRevealedAreasHash(revealedAreas);
    const cacheKey = this.generateCacheKey(viewportBounds, revealedAreasHash, isIntermediate);

    // Compress fog data for storage
    const compressionResult = this.compressFogData(fogResult.fogGeoJSON);

    const cacheEntry: FogCacheEntry = {
      key: cacheKey,
      fogGeoJSON: compressionResult.compressed,
      viewportBounds: [...viewportBounds] as [number, number, number, number],
      revealedAreasHash,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      accessCount: 0, // Start at 0, will be incremented on first access
      calculationTime: fogResult.calculationTime,
      compressedSize: compressionResult.compressedSize,
      isIntermediateResult: isIntermediate,
    };

    this.cache.set(cacheKey, cacheEntry);

    logger.debugThrottled(
      `FogCacheManager: Cached fog result for key: ${cacheKey} ` +
      `(${compressionResult.compressedSize} bytes, ` +
      `${((1 - compressionResult.compressedSize / compressionResult.originalSize) * 100).toFixed(1)}% compression)`,
      5000
    );

    // Perform cleanup immediately if needed (for testing and immediate size enforcement)
    if (this.cache.size > this.options.maxCacheSize) {
      this.evictLRUEntries();
    }
    
    this.updateStats();
  }

  /**
   * Invalidates cache entries that depend on revealed areas
   * Removes cached entries when revealed areas change
   * 
   * @param revealedAreas - New revealed areas that invalidate existing cache
   * 
   * @example
   * ```typescript
   * // After new areas are revealed
   * await saveNewRevealedArea(newArea);
   * cacheManager.invalidateCache(updatedRevealedAreas);
   * ```
   */
  invalidateCache(revealedAreas?: any): void {
    if (!revealedAreas) {
      // Invalidate all cache entries
      const entriesRemoved = this.cache.size;
      this.cache.clear();
      
      logger.info(`FogCacheManager: Invalidated all cache entries (${entriesRemoved} entries)`);
      this.updateStats();
      return;
    }

    const newHash = this.calculateRevealedAreasHash(revealedAreas);
    const keysToRemove: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (entry.revealedAreasHash !== newHash) {
        keysToRemove.push(key);
      }
    }

    for (const key of keysToRemove) {
      this.cache.delete(key);
    }

    if (keysToRemove.length > 0) {
      logger.info(
        `FogCacheManager: Invalidated ${keysToRemove.length} cache entries due to revealed areas change`
      );
    }

    this.updateStats();
  }

  /**
   * Invalidates cache entries for a specific viewport
   * Removes cached entries that cover the specified viewport bounds
   * 
   * @param viewportBounds - Viewport bounds to invalidate
   * 
   * @example
   * ```typescript
   * // Invalidate cache for specific area after manual refresh
   * cacheManager.invalidateViewport([-74.1, 40.7, -73.9, 40.8]);
   * ```
   */
  invalidateViewport(viewportBounds: [number, number, number, number]): void {
    const keysToRemove: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      // Check if viewport bounds overlap with cached entry bounds
      const [minLng, minLat, maxLng, maxLat] = viewportBounds;
      const [cacheMinLng, cacheMinLat, cacheMaxLng, cacheMaxLat] = entry.viewportBounds;

      const overlaps = !(
        maxLng < cacheMinLng ||
        minLng > cacheMaxLng ||
        maxLat < cacheMinLat ||
        minLat > cacheMaxLat
      );

      if (overlaps) {
        keysToRemove.push(key);
      }
    }

    for (const key of keysToRemove) {
      this.cache.delete(key);
    }

    if (keysToRemove.length > 0) {
      logger.info(
        `FogCacheManager: Invalidated ${keysToRemove.length} cache entries for viewport bounds`
      );
    }

    this.updateStats();
  }

  /**
   * Gets current cache statistics and performance metrics
   * Provides insights into cache effectiveness and memory usage
   * 
   * @returns Current cache statistics
   * 
   * @example
   * ```typescript
   * const stats = cacheManager.getCacheStats();
   * console.log(`Cache hit ratio: ${stats.hitRatio.toFixed(1)}%`);
   * console.log(`Memory usage: ${(stats.memoryUsage / 1024).toFixed(1)} KB`);
   * ```
   */
  getCacheStats(): FogCacheStats {
    this.updateStats();
    this.updateMemoryUsage();
    return { ...this.stats };
  }

  /**
   * Clears all cached entries and resets statistics
   * Provides a clean slate for cache operations
   * 
   * @example
   * ```typescript
   * cacheManager.clearCache();
   * console.log('Cache cleared');
   * ```
   */
  clearCache(): void {
    const entriesRemoved = this.cache.size;
    this.cache.clear();
    this.stats = this.initializeStats();

    logger.info(`FogCacheManager: Cleared all cache entries (${entriesRemoved} entries removed)`);
  }

  /**
   * Optimizes cache memory usage
   * Removes low-value entries and compresses remaining data
   * 
   * @param aggressiveCleanup - Whether to perform aggressive optimization
   * 
   * @example
   * ```typescript
   * await cacheManager.optimizeCache(false); // Gentle optimization
   * await cacheManager.optimizeCache(true);  // Aggressive optimization
   * ```
   */
  async optimizeCache(aggressiveCleanup: boolean = false): Promise<void> {
    logger.info('FogCacheManager: Starting cache optimization');

    const initialEntries = this.cache.size;
    const initialMemory = this.stats.memoryUsage;

    // Remove expired entries
    this.removeExpiredEntries();

    if (aggressiveCleanup) {
      // Remove entries with low access counts
      const keysToRemove: string[] = [];
      const averageAccessCount = Array.from(this.cache.values())
        .reduce((sum, entry) => sum + entry.accessCount, 0) / this.cache.size;

      for (const [key, entry] of this.cache.entries()) {
        if (entry.accessCount < averageAccessCount * 0.5) {
          keysToRemove.push(key);
        }
      }

      for (const key of keysToRemove) {
        this.cache.delete(key);
        this.stats.evictedEntries++;
      }

      logger.info(
        `FogCacheManager: Aggressive cleanup removed ${keysToRemove.length} low-access entries`
      );
    }

    // Ensure we're within size limits
    this.evictLRUEntries();

    this.updateStats();
    this.updateMemoryUsage();

    const finalEntries = this.cache.size;
    const finalMemory = this.stats.memoryUsage;
    const memorySaved = initialMemory - finalMemory;

    logger.info(
      `FogCacheManager: Cache optimization completed. ` +
      `Entries: ${initialEntries} → ${finalEntries}, ` +
      `Memory: ${(initialMemory / 1024).toFixed(1)} KB → ${(finalMemory / 1024).toFixed(1)} KB ` +
      `(saved ${(memorySaved / 1024).toFixed(1)} KB)`
    );
  }

  /**
   * Destroys the cache manager and cleans up resources
   * Should be called when cache manager is no longer needed
   * 
   * @example
   * ```typescript
   * cacheManager.destroy();
   * ```
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    this.clearCache();
    logger.debug('FogCacheManager: Destroyed cache manager');
  }
}

/**
 * Global fog cache manager instance
 * Provides singleton pattern for consistent caching across the application
 */
let globalFogCacheManager: FogCacheManager | null = null;

/**
 * Gets or creates the global fog cache manager instance
 * 
 * @param options - Optional configuration for cache manager
 * @returns Global fog cache manager instance
 * 
 * @example
 * ```typescript
 * const cacheManager = getGlobalFogCacheManager();
 * const cached = cacheManager.getCachedFog(viewportBounds, revealedAreas);
 * ```
 */
export const getGlobalFogCacheManager = (options?: FogCacheOptions): FogCacheManager => {
  if (!globalFogCacheManager) {
    globalFogCacheManager = new FogCacheManager(options);
    logger.debug('FogCacheManager: Created global fog cache manager instance');
  }
  return globalFogCacheManager;
};

/**
 * Resets the global fog cache manager instance
 * Useful for testing or when a complete reset is needed
 */
export const resetGlobalFogCacheManager = (): void => {
  if (globalFogCacheManager) {
    globalFogCacheManager.destroy();
  }
  globalFogCacheManager = null;
  logger.debug('FogCacheManager: Reset global fog cache manager instance');
};

export default FogCacheManager;