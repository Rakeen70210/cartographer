import {
    FogCacheManager,
    getGlobalFogCacheManager,
    resetGlobalFogCacheManager
} from '@/utils/fogCacheManager';

// Mock logger to avoid console output during tests
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
  },
}));

describe('FogCacheManager', () => {
  let cacheManager;
  
  beforeEach(() => {
    // Create a fresh cache manager for each test
    cacheManager = new FogCacheManager({
      maxCacheSize: 5,
      cacheExpirationMs: 1000, // 1 second for testing
      cleanupIntervalMs: 100,   // 100ms for testing
      enableCompression: true,
      viewportTolerance: 0.001,
      cacheIntermediateResults: true,
    });
  });
  
  afterEach(() => {
    // Clean up after each test
    if (cacheManager) {
      cacheManager.destroy();
    }
    resetGlobalFogCacheManager();
  });

  describe('constructor', () => {
    it('should create cache manager with default options', () => {
      const manager = new FogCacheManager();
      expect(manager).toBeInstanceOf(FogCacheManager);
      
      const stats = manager.getCacheStats();
      expect(stats.totalEntries).toBe(0);
      expect(stats.cacheHits).toBe(0);
      expect(stats.cacheMisses).toBe(0);
      
      manager.destroy();
    });

    it('should create cache manager with custom options', () => {
      const customOptions = {
        maxCacheSize: 10,
        cacheExpirationMs: 5000,
        enableCompression: false,
      };
      
      const manager = new FogCacheManager(customOptions);
      expect(manager).toBeInstanceOf(FogCacheManager);
      
      manager.destroy();
    });
  });

  describe('cache operations', () => {
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

    it('should return null for cache miss', () => {
      const differentViewport = [-75.0, 41.0, -74.0, 42.0];
      
      const cached = cacheManager.getCachedFog(differentViewport, mockRevealedAreas);
      
      expect(cached).toBeNull();
      
      // Check cache stats
      const stats = cacheManager.getCacheStats();
      expect(stats.totalEntries).toBe(0);
      expect(stats.cacheHits).toBe(0);
      expect(stats.cacheMisses).toBe(1);
      expect(stats.hitRatio).toBe(0);
    });

    it('should handle null revealed areas', () => {
      // Cache with null revealed areas
      cacheManager.cacheFogResult(mockViewportBounds, null, mockFogResult);
      
      // Retrieve with null revealed areas
      const cached = cacheManager.getCachedFog(mockViewportBounds, null);
      
      expect(cached).not.toBeNull();
      expect(cached.fogGeoJSON).toEqual(mockFogResult.fogGeoJSON);
    });

    it('should handle intermediate results caching', () => {
      // Cache intermediate result
      cacheManager.cacheFogResult(mockViewportBounds, mockRevealedAreas, mockFogResult, true);
      
      // Retrieve intermediate result
      const cached = cacheManager.getCachedFog(mockViewportBounds, mockRevealedAreas, true);
      
      expect(cached).not.toBeNull();
      expect(cached.isIntermediateResult).toBe(true);
      
      // Should not find it when looking for final result
      const finalCached = cacheManager.getCachedFog(mockViewportBounds, mockRevealedAreas, false);
      expect(finalCached).toBeNull();
    });

    it('should update access statistics on cache hits', () => {
      // Cache a result
      cacheManager.cacheFogResult(mockViewportBounds, mockRevealedAreas, mockFogResult);
      
      // Access it multiple times and check access count after each access
      const cached1 = cacheManager.getCachedFog(mockViewportBounds, mockRevealedAreas);
      expect(cached1.accessCount).toBe(1);
      
      const cached2 = cacheManager.getCachedFog(mockViewportBounds, mockRevealedAreas);
      expect(cached2.accessCount).toBe(2);
      
      const cached3 = cacheManager.getCachedFog(mockViewportBounds, mockRevealedAreas);
      expect(cached3.accessCount).toBe(3);
      
      // Check that last accessed time is updated (all point to same object)
      expect(cached3.lastAccessedAt).toBeGreaterThanOrEqual(cached1.lastAccessedAt);
      
      // Check cache stats
      const stats = cacheManager.getCacheStats();
      expect(stats.cacheHits).toBe(3);
      expect(stats.averageTimeSaved).toBeGreaterThan(0);
    });
  });

  describe('cache invalidation', () => {
    const mockViewportBounds = [-74.1, 40.7, -73.9, 40.8];
    const mockRevealedAreas1 = {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[[-74.0, 40.75], [-74.0, 40.76], [-73.99, 40.76], [-73.99, 40.75], [-74.0, 40.75]]]
      },
      properties: {}
    };
    const mockRevealedAreas2 = {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[[-74.05, 40.75], [-74.05, 40.76], [-74.04, 40.76], [-74.04, 40.75], [-74.05, 40.75]]]
      },
      properties: {}
    };
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

    it('should invalidate cache when revealed areas change', () => {
      // Cache result with first revealed areas
      cacheManager.cacheFogResult(mockViewportBounds, mockRevealedAreas1, mockFogResult);
      
      // Verify it's cached
      let cached = cacheManager.getCachedFog(mockViewportBounds, mockRevealedAreas1);
      expect(cached).not.toBeNull();
      
      // Invalidate cache with different revealed areas
      cacheManager.invalidateCache(mockRevealedAreas2);
      
      // Should no longer find the cached result
      cached = cacheManager.getCachedFog(mockViewportBounds, mockRevealedAreas1);
      expect(cached).toBeNull();
      
      // Check cache stats
      const stats = cacheManager.getCacheStats();
      expect(stats.totalEntries).toBe(0);
    });

    it('should invalidate all cache entries when no revealed areas provided', () => {
      // Cache multiple results
      cacheManager.cacheFogResult(mockViewportBounds, mockRevealedAreas1, mockFogResult);
      cacheManager.cacheFogResult([-75.0, 41.0, -74.0, 42.0], mockRevealedAreas2, mockFogResult);
      
      // Verify they're cached
      expect(cacheManager.getCacheStats().totalEntries).toBe(2);
      
      // Invalidate all
      cacheManager.invalidateCache();
      
      // Should have no cached entries
      expect(cacheManager.getCacheStats().totalEntries).toBe(0);
    });

    it('should invalidate cache for specific viewport', () => {
      const viewport1 = [-74.1, 40.7, -73.9, 40.8];
      const viewport2 = [-75.0, 41.0, -74.0, 42.0];
      
      // Cache results for different viewports
      cacheManager.cacheFogResult(viewport1, mockRevealedAreas1, mockFogResult);
      cacheManager.cacheFogResult(viewport2, mockRevealedAreas1, mockFogResult);
      
      // Verify both are cached
      expect(cacheManager.getCacheStats().totalEntries).toBe(2);
      
      // Invalidate only viewport1
      cacheManager.invalidateViewport(viewport1);
      
      // Should have only viewport2 cached
      expect(cacheManager.getCacheStats().totalEntries).toBe(1);
      expect(cacheManager.getCachedFog(viewport1, mockRevealedAreas1)).toBeNull();
      expect(cacheManager.getCachedFog(viewport2, mockRevealedAreas1)).not.toBeNull();
    });
  });

  describe('cache expiration', () => {
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

    it('should expire cache entries after expiration time', async () => {
      // Cache a result
      cacheManager.cacheFogResult(mockViewportBounds, mockRevealedAreas, mockFogResult);
      
      // Verify it's cached
      let cached = cacheManager.getCachedFog(mockViewportBounds, mockRevealedAreas);
      expect(cached).not.toBeNull();
      
      // Wait for expiration (cache expiration is set to 1 second in test setup)
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Should be expired now
      cached = cacheManager.getCachedFog(mockViewportBounds, mockRevealedAreas);
      expect(cached).toBeNull();
      
      // Check that expired entries counter is updated
      const stats = cacheManager.getCacheStats();
      expect(stats.expiredEntries).toBe(1);
    });
  });

  describe('cache size limits', () => {
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

    it('should evict LRU entries when cache is full', () => {
      // Fill cache to capacity (maxCacheSize is 5 in test setup)
      const viewports = [];
      const revealedAreasArray = [];
      
      for (let i = 0; i < 5; i++) {
        const viewport = [-74.0 - i * 0.1, 40.7, -73.9 - i * 0.1, 40.8];
        const revealedAreas = { type: 'Feature', geometry: { type: 'Polygon', coordinates: [] }, properties: { id: i } };
        viewports.push(viewport);
        revealedAreasArray.push(revealedAreas);
        cacheManager.cacheFogResult(viewport, revealedAreas, mockFogResult);
      }
      
      // Verify cache is full
      expect(cacheManager.getCacheStats().totalEntries).toBe(5);
      
      // Access first entry to make it recently used (add some delay to ensure different timestamps)
      const firstViewport = viewports[0];
      const firstRevealedAreas = revealedAreasArray[0];
      
      // Wait a bit to ensure different timestamps
      const startTime = Date.now();
      while (Date.now() - startTime < 10) {
        // Small delay
      }
      
      cacheManager.getCachedFog(firstViewport, firstRevealedAreas);
      
      // Add one more entry (should evict LRU, but not the first one we just accessed)
      const newViewport = [-74.0 - 5 * 0.1, 40.7, -73.9 - 5 * 0.1, 40.8];
      const newRevealedAreas = { type: 'Feature', geometry: { type: 'Polygon', coordinates: [] }, properties: { id: 5 } };
      cacheManager.cacheFogResult(newViewport, newRevealedAreas, mockFogResult);
      
      // Should still have 5 entries (one was evicted, one was added)
      expect(cacheManager.getCacheStats().totalEntries).toBe(5);
      
      // First entry should still be there (was recently accessed)
      expect(cacheManager.getCachedFog(firstViewport, firstRevealedAreas)).not.toBeNull();
      
      // Check that evicted entries counter is updated
      const stats = cacheManager.getCacheStats();
      expect(stats.evictedEntries).toBeGreaterThan(0);
    });
  });

  describe('compression', () => {
    const mockViewportBounds = [-74.1, 40.7, -73.9, 40.8];
    const mockRevealedAreas = { type: 'Feature', geometry: { type: 'Polygon', coordinates: [] }, properties: {} };
    
    it('should compress fog data when compression is enabled', () => {
      const largeFogResult = {
        fogGeoJSON: {
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: [[
                [-74.123456789, 40.123456789],
                [-74.123456789, 40.823456789],
                [-73.923456789, 40.823456789],
                [-73.923456789, 40.123456789],
                [-74.123456789, 40.123456789]
              ]]
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
      
      // Cache the result
      cacheManager.cacheFogResult(mockViewportBounds, mockRevealedAreas, largeFogResult);
      
      // Retrieve and check that coordinates are compressed (rounded)
      const cached = cacheManager.getCachedFog(mockViewportBounds, mockRevealedAreas);
      expect(cached).not.toBeNull();
      
      const coordinates = cached.fogGeoJSON.features[0].geometry.coordinates[0];
      // Should be rounded to 6 decimal places
      expect(coordinates[0][0]).toBe(-74.123457); // Rounded from -74.123456789
      expect(coordinates[0][1]).toBe(40.123457);  // Rounded from 40.123456789
      
      // Should have compression size information
      expect(cached.compressedSize).toBeGreaterThan(0);
    });

    it('should handle compression disabled', () => {
      const managerNoCompression = new FogCacheManager({
        enableCompression: false
      });
      
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
      
      managerNoCompression.cacheFogResult(mockViewportBounds, mockRevealedAreas, mockFogResult);
      const cached = managerNoCompression.getCachedFog(mockViewportBounds, mockRevealedAreas);
      
      expect(cached).not.toBeNull();
      expect(cached.fogGeoJSON).toEqual(mockFogResult.fogGeoJSON);
      
      managerNoCompression.destroy();
    });
  });

  describe('cache optimization', () => {
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

    it('should optimize cache memory usage', async () => {
      // Fill cache with entries
      for (let i = 0; i < 3; i++) {
        const viewport = [-74.0 - i * 0.1, 40.7, -73.9 - i * 0.1, 40.8];
        const revealedAreas = { type: 'Feature', geometry: { type: 'Polygon', coordinates: [] }, properties: { id: i } };
        cacheManager.cacheFogResult(viewport, revealedAreas, mockFogResult);
      }
      
      const initialStats = cacheManager.getCacheStats();
      expect(initialStats.totalEntries).toBe(3);
      
      // Optimize cache
      await cacheManager.optimizeCache(false);
      
      // Should still have entries (gentle optimization)
      const afterStats = cacheManager.getCacheStats();
      expect(afterStats.totalEntries).toBeGreaterThan(0);
    });

    it('should perform aggressive cache optimization', async () => {
      // Fill cache with entries, some with low access counts
      for (let i = 0; i < 4; i++) {
        const viewport = [-74.0 - i * 0.1, 40.7, -73.9 - i * 0.1, 40.8];
        const revealedAreas = { type: 'Feature', geometry: { type: 'Polygon', coordinates: [] }, properties: { id: i } };
        cacheManager.cacheFogResult(viewport, revealedAreas, mockFogResult);
        
        // Access some entries more than others
        if (i < 2) {
          for (let j = 0; j < 3; j++) {
            cacheManager.getCachedFog(viewport, revealedAreas);
          }
        }
      }
      
      const initialStats = cacheManager.getCacheStats();
      expect(initialStats.totalEntries).toBe(4);
      
      // Aggressive optimization should remove low-access entries
      await cacheManager.optimizeCache(true);
      
      const afterStats = cacheManager.getCacheStats();
      expect(afterStats.totalEntries).toBeLessThan(initialStats.totalEntries);
    });
  });

  describe('global cache manager', () => {
    it('should return singleton instance', () => {
      const manager1 = getGlobalFogCacheManager();
      const manager2 = getGlobalFogCacheManager();
      
      expect(manager1).toBe(manager2);
      expect(manager1).toBeInstanceOf(FogCacheManager);
    });

    it('should reset global instance', () => {
      const manager1 = getGlobalFogCacheManager();
      
      resetGlobalFogCacheManager();
      const manager2 = getGlobalFogCacheManager();
      
      expect(manager1).not.toBe(manager2);
    });

    it('should accept options for global instance', () => {
      resetGlobalFogCacheManager(); // Ensure clean state
      
      const customOptions = { maxCacheSize: 20 };
      const manager = getGlobalFogCacheManager(customOptions);
      
      expect(manager).toBeInstanceOf(FogCacheManager);
    });
  });

  describe('error handling', () => {
    it('should handle invalid revealed areas gracefully', () => {
      const mockViewportBounds = [-74.1, 40.7, -73.9, 40.8];
      const invalidRevealedAreas = { invalid: 'data' };
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
      
      // Should not throw error
      expect(() => {
        cacheManager.cacheFogResult(mockViewportBounds, invalidRevealedAreas, mockFogResult);
      }).not.toThrow();
      
      // Should be able to retrieve with same invalid data
      const cached = cacheManager.getCachedFog(mockViewportBounds, invalidRevealedAreas);
      expect(cached).not.toBeNull();
    });

    it('should handle compression errors gracefully', () => {
      const mockViewportBounds = [-74.1, 40.7, -73.9, 40.8];
      const mockRevealedAreas = { type: 'Feature', geometry: { type: 'Polygon', coordinates: [] }, properties: {} };
      
      // Create fog result with circular reference to cause compression error
      const problematicFogResult = {
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
      
      // Add circular reference
      problematicFogResult.fogGeoJSON.circular = problematicFogResult.fogGeoJSON;
      
      // Should not throw error
      expect(() => {
        cacheManager.cacheFogResult(mockViewportBounds, mockRevealedAreas, problematicFogResult);
      }).not.toThrow();
    });
  });

  describe('memory management', () => {
    it('should track memory usage', () => {
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
      
      const initialStats = cacheManager.getCacheStats();
      expect(initialStats.memoryUsage).toBe(0);
      
      // Cache a result
      cacheManager.cacheFogResult(mockViewportBounds, mockRevealedAreas, mockFogResult);
      
      const afterStats = cacheManager.getCacheStats();
      expect(afterStats.memoryUsage).toBeGreaterThan(0);
    });

    it('should clear cache and reset memory usage', () => {
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
      
      // Cache a result
      cacheManager.cacheFogResult(mockViewportBounds, mockRevealedAreas, mockFogResult);
      
      let stats = cacheManager.getCacheStats();
      expect(stats.totalEntries).toBe(1);
      expect(stats.memoryUsage).toBeGreaterThan(0);
      
      // Clear cache
      cacheManager.clearCache();
      
      stats = cacheManager.getCacheStats();
      expect(stats.totalEntries).toBe(0);
      expect(stats.memoryUsage).toBe(0);
      expect(stats.cacheHits).toBe(0);
      expect(stats.cacheMisses).toBe(0);
    });
  });
});