import { getGlobalFogCacheManager, resetGlobalFogCacheManager } from '@/utils/fogCacheManager';

// Mock dependencies
jest.mock('@/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debugThrottled: jest.fn(),
    debugOnce: jest.fn(),
    warnThrottled: jest.fn(),
    infoThrottled: jest.fn(),
    warnOnce: jest.fn(),
    debugViewport: jest.fn(),
  },
}));

describe('Fog Cache Integration Tests', () => {
  let cacheManager;
  
  beforeEach(() => {
    // Reset global cache manager before each test
    resetGlobalFogCacheManager();
    cacheManager = getGlobalFogCacheManager({
      maxCacheSize: 10,
      cacheExpirationMs: 5000, // 5 seconds
      cleanupIntervalMs: 1000,  // 1 second
    });
    
    // Clear any existing timers
    jest.clearAllTimers();
    jest.useFakeTimers();
  });
  
  afterEach(() => {
    if (cacheManager) {
      cacheManager.destroy();
    }
    resetGlobalFogCacheManager();
    jest.useRealTimers();
  });

  describe('cache manager integration', () => {
    const mockViewportBounds = [-74.1, 40.7, -73.9, 40.8];
    const mockRevealedAreas = {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[[-74.0, 40.75], [-74.0, 40.76], [-73.99, 40.76], [-73.99, 40.75], [-74.0, 40.75]]]
      },
      properties: {}
    };
    const mockFogResult = {
      fogGeoJSON: {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [[[-74.1, 40.7], [-74.1, 40.8], [-73.9, 40.8], [-73.9, 40.7], [-74.1, 40.7]]]
          },
          properties: {}
        }]
      },
      calculationTime: 50,
      performanceMetrics: {
        geometryComplexity: { vertexCount: 5, ringCount: 1, holeCount: 0 },
        operationType: 'viewport',
        hadErrors: false,
        fallbackUsed: false,
        executionTime: 50,
        performanceLevel: 'MODERATE'
      },
      errors: [],
      warnings: []
    };

    it('should cache and retrieve fog calculation results', () => {
      // Cache a result
      cacheManager.cacheFogResult(mockViewportBounds, mockRevealedAreas, mockFogResult);
      
      // Retrieve the cached result
      const cached = cacheManager.getCachedFog(mockViewportBounds, mockRevealedAreas);
      
      expect(cached).not.toBeNull();
      expect(cached.fogGeoJSON).toEqual(mockFogResult.fogGeoJSON);
      expect(cached.calculationTime).toBe(50);
      expect(cached.accessCount).toBe(1);
      
      // Check cache stats
      const stats = cacheManager.getCacheStats();
      expect(stats.totalEntries).toBe(1);
      expect(stats.cacheHits).toBe(1);
      expect(stats.cacheMisses).toBe(0);
      expect(stats.hitRatio).toBe(100);
    });

    it('should invalidate cache when revealed areas change', () => {
      const mockRevealedAreas2 = {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [[[-74.05, 40.75], [-74.05, 40.76], [-74.04, 40.76], [-74.04, 40.75], [-74.05, 40.75]]]
        },
        properties: {}
      };
      
      // Cache result with first revealed areas
      cacheManager.cacheFogResult(mockViewportBounds, mockRevealedAreas, mockFogResult);
      
      // Verify it's cached
      let cached = cacheManager.getCachedFog(mockViewportBounds, mockRevealedAreas);
      expect(cached).not.toBeNull();
      
      // Call with different revealed areas should not hit cache
      cached = cacheManager.getCachedFog(mockViewportBounds, mockRevealedAreas2);
      expect(cached).toBeNull();
      
      // Invalidate cache with new revealed areas
      cacheManager.invalidateCache(mockRevealedAreas2);
      
      // Original cache should be invalidated
      cached = cacheManager.getCachedFog(mockViewportBounds, mockRevealedAreas);
      expect(cached).toBeNull();
    });

    it('should track cache performance statistics', () => {
      const initialStats = cacheManager.getCacheStats();
      expect(initialStats.totalEntries).toBe(0);
      expect(initialStats.cacheHits).toBe(0);
      expect(initialStats.cacheMisses).toBe(0);
      expect(initialStats.hitRatio).toBe(0);
      
      // Cache miss
      let cached = cacheManager.getCachedFog(mockViewportBounds, mockRevealedAreas);
      expect(cached).toBeNull();
      
      let stats = cacheManager.getCacheStats();
      expect(stats.cacheMisses).toBe(1);
      expect(stats.hitRatio).toBe(0);
      
      // Cache a result
      cacheManager.cacheFogResult(mockViewportBounds, mockRevealedAreas, mockFogResult);
      
      // Cache hit
      cached = cacheManager.getCachedFog(mockViewportBounds, mockRevealedAreas);
      expect(cached).not.toBeNull();
      
      stats = cacheManager.getCacheStats();
      expect(stats.totalEntries).toBe(1);
      expect(stats.cacheHits).toBe(1);
      expect(stats.cacheMisses).toBe(1);
      expect(stats.hitRatio).toBe(50);
      
      // Another cache hit
      cached = cacheManager.getCachedFog(mockViewportBounds, mockRevealedAreas);
      expect(cached).not.toBeNull();
      
      stats = cacheManager.getCacheStats();
      expect(stats.cacheHits).toBe(2);
      expect(stats.cacheMisses).toBe(1);
      expect(stats.hitRatio).toBeCloseTo(66.67, 1);
      expect(stats.averageTimeSaved).toBeGreaterThan(0);
    });

    it('should expire cache entries after timeout', () => {
      // Cache a result
      cacheManager.cacheFogResult(mockViewportBounds, mockRevealedAreas, mockFogResult);
      
      // Verify it's cached
      let cached = cacheManager.getCachedFog(mockViewportBounds, mockRevealedAreas);
      expect(cached).not.toBeNull();
      
      // Fast-forward time beyond cache expiration (5 seconds in test setup)
      jest.advanceTimersByTime(6000);
      
      // Should be expired now
      cached = cacheManager.getCachedFog(mockViewportBounds, mockRevealedAreas);
      expect(cached).toBeNull();
      
      // Check that expired entries counter is updated
      const stats = cacheManager.getCacheStats();
      expect(stats.expiredEntries).toBe(1);
    });

    it('should evict entries when cache is full', () => {
      // Fill cache to capacity (maxCacheSize is 10 in test setup)
      for (let i = 0; i < 10; i++) {
        const viewport = [-74.0 - i * 0.1, 40.7, -73.9 - i * 0.1, 40.8];
        const revealedAreas = { 
          type: 'Feature', 
          geometry: { type: 'Polygon', coordinates: [] }, 
          properties: { id: i } 
        };
        cacheManager.cacheFogResult(viewport, revealedAreas, mockFogResult);
      }
      
      // Verify cache is full
      expect(cacheManager.getCacheStats().totalEntries).toBe(10);
      
      // Add one more entry (should evict LRU)
      const newViewport = [-74.0 - 10 * 0.1, 40.7, -73.9 - 10 * 0.1, 40.8];
      const newRevealedAreas = { 
        type: 'Feature', 
        geometry: { type: 'Polygon', coordinates: [] }, 
        properties: { id: 10 } 
      };
      cacheManager.cacheFogResult(newViewport, newRevealedAreas, mockFogResult);
      
      // Should still have 10 entries (evicted one)
      const stats = cacheManager.getCacheStats();
      expect(stats.totalEntries).toBe(10);
      expect(stats.evictedEntries).toBe(1);
    });

    it('should handle memory optimization', async () => {
      // Fill cache with entries
      for (let i = 0; i < 5; i++) {
        const viewport = [-74.0 - i * 0.1, 40.7, -73.9 - i * 0.1, 40.8];
        const revealedAreas = { 
          type: 'Feature', 
          geometry: { type: 'Polygon', coordinates: [] }, 
          properties: { id: i } 
        };
        cacheManager.cacheFogResult(viewport, revealedAreas, mockFogResult);
      }
      
      const initialStats = cacheManager.getCacheStats();
      expect(initialStats.totalEntries).toBe(5);
      expect(initialStats.memoryUsage).toBeGreaterThan(0);
      
      // Optimize cache
      await cacheManager.optimizeCache(false);
      
      const afterStats = cacheManager.getCacheStats();
      expect(afterStats.totalEntries).toBeGreaterThan(0);
      expect(afterStats.memoryUsage).toBeGreaterThan(0);
    });

    it('should clear all cache entries', () => {
      // Cache some results
      for (let i = 0; i < 3; i++) {
        const viewport = [-74.0 - i * 0.1, 40.7, -73.9 - i * 0.1, 40.8];
        const revealedAreas = { 
          type: 'Feature', 
          geometry: { type: 'Polygon', coordinates: [] }, 
          properties: { id: i } 
        };
        cacheManager.cacheFogResult(viewport, revealedAreas, mockFogResult);
      }
      
      let stats = cacheManager.getCacheStats();
      expect(stats.totalEntries).toBe(3);
      expect(stats.memoryUsage).toBeGreaterThan(0);
      
      // Clear cache
      cacheManager.clearCache();
      
      stats = cacheManager.getCacheStats();
      expect(stats.totalEntries).toBe(0);
      expect(stats.memoryUsage).toBe(0);
      expect(stats.cacheHits).toBe(0);
      expect(stats.cacheMisses).toBe(0);
    });

    it('should handle viewport-specific invalidation', () => {
      const viewport1 = [-74.1, 40.7, -73.9, 40.8];
      const viewport2 = [-75.0, 41.0, -74.0, 42.0];
      
      // Cache results for different viewports
      cacheManager.cacheFogResult(viewport1, mockRevealedAreas, mockFogResult);
      cacheManager.cacheFogResult(viewport2, mockRevealedAreas, mockFogResult);
      
      // Verify both are cached
      expect(cacheManager.getCacheStats().totalEntries).toBe(2);
      
      // Invalidate only viewport1
      cacheManager.invalidateViewport(viewport1);
      
      // Should have only viewport2 cached
      expect(cacheManager.getCacheStats().totalEntries).toBe(1);
      expect(cacheManager.getCachedFog(viewport1, mockRevealedAreas)).toBeNull();
      expect(cacheManager.getCachedFog(viewport2, mockRevealedAreas)).not.toBeNull();
    });
  });

  describe('global cache manager', () => {
    it('should maintain singleton instance', () => {
      const manager1 = getGlobalFogCacheManager();
      const manager2 = getGlobalFogCacheManager();
      
      expect(manager1).toBe(manager2);
      
      // Cache something in manager1
      const mockViewportBounds = [-74.1, 40.7, -73.9, 40.8];
      const mockRevealedAreas = { type: 'Feature', geometry: { type: 'Polygon', coordinates: [] }, properties: {} };
      const mockFogResult = {
        fogGeoJSON: { type: 'FeatureCollection', features: [] },
        calculationTime: 50,
        performanceMetrics: {
          geometryComplexity: { vertexCount: 0, ringCount: 0, holeCount: 0 },
          operationType: 'viewport',
          hadErrors: false,
          fallbackUsed: false,
          executionTime: 50,
          performanceLevel: 'MODERATE'
        },
        errors: [],
        warnings: []
      };
      
      manager1.cacheFogResult(mockViewportBounds, mockRevealedAreas, mockFogResult);
      
      // Should be accessible from manager2 (same instance)
      const cached = manager2.getCachedFog(mockViewportBounds, mockRevealedAreas);
      expect(cached).not.toBeNull();
    });

    it('should reset global instance', () => {
      const manager1 = getGlobalFogCacheManager();
      
      resetGlobalFogCacheManager();
      const manager2 = getGlobalFogCacheManager();
      
      expect(manager1).not.toBe(manager2);
    });
  });
});