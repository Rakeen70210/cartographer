/**
 * Example demonstrating fog calculation caching and memoization
 * 
 * This example shows how the fog cache manager improves performance
 * by caching fog calculation results for repeated viewport bounds.
 */

import { getGlobalFogCacheManager } from '@/utils/fogCacheManager';
import { calculateViewportFog, getDefaultFogOptions } from '@/utils/fogCalculation';

// Example usage of fog calculation caching
async function demonstrateFogCaching() {
  console.log('=== Fog Calculation Caching Demo ===\n');
  
  // Get the global cache manager
  const cacheManager = getGlobalFogCacheManager({
    maxCacheSize: 50,
    cacheExpirationMs: 10 * 60 * 1000, // 10 minutes
    enableCompression: true,
    viewportTolerance: 0.001,
  });
  
  // Example viewport bounds (New York City area)
  const viewportBounds = [-74.1, 40.7, -73.9, 40.8];
  
  // Example revealed areas (Central Park area)
  const revealedAreas = {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [-73.98, 40.76], [-73.98, 40.78], 
        [-73.95, 40.78], [-73.95, 40.76], 
        [-73.98, 40.76]
      ]]
    },
    properties: {}
  };
  
  // Configure fog calculation options
  const fogOptions = getDefaultFogOptions(viewportBounds);
  fogOptions.performanceMode = 'accurate';
  fogOptions.fallbackStrategy = 'viewport';
  
  console.log('1. First fog calculation (cache miss):');
  const startTime1 = performance.now();
  const result1 = calculateViewportFog(revealedAreas, fogOptions, true);
  const endTime1 = performance.now();
  
  console.log(`   Calculation time: ${(endTime1 - startTime1).toFixed(2)}ms`);
  console.log(`   Features generated: ${result1.fogGeoJSON.features.length}`);
  console.log(`   Warnings: ${result1.warnings.join(', ') || 'None'}\n`);
  
  console.log('2. Second fog calculation (cache hit):');
  const startTime2 = performance.now();
  const result2 = calculateViewportFog(revealedAreas, fogOptions, true);
  const endTime2 = performance.now();
  
  console.log(`   Calculation time: ${(endTime2 - startTime2).toFixed(2)}ms`);
  console.log(`   Features generated: ${result2.fogGeoJSON.features.length}`);
  console.log(`   Warnings: ${result2.warnings.join(', ') || 'None'}\n`);
  
  // Show cache statistics
  const stats = cacheManager.getCacheStats();
  console.log('3. Cache Statistics:');
  console.log(`   Total entries: ${stats.totalEntries}`);
  console.log(`   Cache hits: ${stats.cacheHits}`);
  console.log(`   Cache misses: ${stats.cacheMisses}`);
  console.log(`   Hit ratio: ${stats.hitRatio.toFixed(1)}%`);
  console.log(`   Memory usage: ${(stats.memoryUsage / 1024).toFixed(1)} KB`);
  console.log(`   Average time saved: ${stats.averageTimeSaved.toFixed(2)}ms\n`);
  
  console.log('4. Testing cache invalidation:');
  
  // Modify revealed areas
  const newRevealedAreas = {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [-73.97, 40.75], [-73.97, 40.77], 
        [-73.94, 40.77], [-73.94, 40.75], 
        [-73.97, 40.75]
      ]]
    },
    properties: {}
  };
  
  const startTime3 = performance.now();
  const result3 = calculateViewportFog(newRevealedAreas, fogOptions, true);
  const endTime3 = performance.now();
  
  console.log(`   New calculation time: ${(endTime3 - startTime3).toFixed(2)}ms`);
  console.log(`   Cache was invalidated due to different revealed areas\n`);
  
  console.log('5. Testing different viewport (cache miss):');
  
  // Different viewport bounds (Brooklyn area)
  const newViewportBounds = [-74.0, 40.6, -73.8, 40.7];
  const newFogOptions = getDefaultFogOptions(newViewportBounds);
  newFogOptions.performanceMode = 'accurate';
  newFogOptions.fallbackStrategy = 'viewport';
  
  const startTime4 = performance.now();
  const result4 = calculateViewportFog(revealedAreas, newFogOptions, true);
  const endTime4 = performance.now();
  
  console.log(`   Calculation time: ${(endTime4 - startTime4).toFixed(2)}ms`);
  console.log(`   New viewport required fresh calculation\n`);
  
  // Final cache statistics
  const finalStats = cacheManager.getCacheStats();
  console.log('6. Final Cache Statistics:');
  console.log(`   Total entries: ${finalStats.totalEntries}`);
  console.log(`   Cache hits: ${finalStats.cacheHits}`);
  console.log(`   Cache misses: ${finalStats.cacheMisses}`);
  console.log(`   Hit ratio: ${finalStats.hitRatio.toFixed(1)}%`);
  console.log(`   Memory usage: ${(finalStats.memoryUsage / 1024).toFixed(1)} KB`);
  console.log(`   Top cache keys: ${finalStats.topCacheKeys.slice(0, 3).join(', ')}\n`);
  
  console.log('7. Cache optimization:');
  await cacheManager.optimizeCache(false);
  
  const optimizedStats = cacheManager.getCacheStats();
  console.log(`   Entries after optimization: ${optimizedStats.totalEntries}`);
  console.log(`   Memory after optimization: ${(optimizedStats.memoryUsage / 1024).toFixed(1)} KB\n`);
  
  console.log('=== Demo Complete ===');
  
  // Clean up
  cacheManager.destroy();
}

// Performance comparison example
async function performanceComparison() {
  console.log('\n=== Performance Comparison ===\n');
  
  const cacheManager = getGlobalFogCacheManager();
  const viewportBounds = [-74.1, 40.7, -73.9, 40.8];
  const revealedAreas = {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [-73.98, 40.76], [-73.98, 40.78], 
        [-73.95, 40.78], [-73.95, 40.76], 
        [-73.98, 40.76]
      ]]
    },
    properties: {}
  };
  
  const fogOptions = getDefaultFogOptions(viewportBounds);
  
  // Test without caching
  console.log('Without caching (10 calculations):');
  const withoutCacheStart = performance.now();
  
  for (let i = 0; i < 10; i++) {
    calculateViewportFog(revealedAreas, fogOptions, false); // No caching
  }
  
  const withoutCacheEnd = performance.now();
  const withoutCacheTime = withoutCacheEnd - withoutCacheStart;
  
  console.log(`   Total time: ${withoutCacheTime.toFixed(2)}ms`);
  console.log(`   Average per calculation: ${(withoutCacheTime / 10).toFixed(2)}ms\n`);
  
  // Test with caching
  console.log('With caching (10 calculations):');
  const withCacheStart = performance.now();
  
  for (let i = 0; i < 10; i++) {
    calculateViewportFog(revealedAreas, fogOptions, true); // With caching
  }
  
  const withCacheEnd = performance.now();
  const withCacheTime = withCacheEnd - withCacheStart;
  
  console.log(`   Total time: ${withCacheTime.toFixed(2)}ms`);
  console.log(`   Average per calculation: ${(withCacheTime / 10).toFixed(2)}ms`);
  
  const speedup = withoutCacheTime / withCacheTime;
  console.log(`   Speedup: ${speedup.toFixed(1)}x faster\n`);
  
  const stats = cacheManager.getCacheStats();
  console.log(`Cache hit ratio: ${stats.hitRatio.toFixed(1)}%`);
  console.log(`Time saved: ${stats.averageTimeSaved.toFixed(2)}ms per cached calculation\n`);
  
  cacheManager.destroy();
}

// Memory usage example
async function memoryUsageExample() {
  console.log('\n=== Memory Usage Example ===\n');
  
  const cacheManager = getGlobalFogCacheManager({
    maxCacheSize: 20,
    enableCompression: true,
  });
  
  console.log('Filling cache with different viewport calculations...\n');
  
  // Fill cache with different viewports
  for (let i = 0; i < 15; i++) {
    const viewport = [-74.0 - i * 0.01, 40.7, -73.9 - i * 0.01, 40.8];
    const revealedAreas = {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-73.98 - i * 0.01, 40.76], [-73.98 - i * 0.01, 40.78], 
          [-73.95 - i * 0.01, 40.78], [-73.95 - i * 0.01, 40.76], 
          [-73.98 - i * 0.01, 40.76]
        ]]
      },
      properties: {}
    };
    
    const fogOptions = getDefaultFogOptions(viewport);
    calculateViewportFog(revealedAreas, fogOptions, true);
    
    if ((i + 1) % 5 === 0) {
      const stats = cacheManager.getCacheStats();
      console.log(`After ${i + 1} calculations:`);
      console.log(`   Cache entries: ${stats.totalEntries}`);
      console.log(`   Memory usage: ${(stats.memoryUsage / 1024).toFixed(1)} KB`);
      console.log(`   Evicted entries: ${stats.evictedEntries}\n`);
    }
  }
  
  console.log('Performing aggressive memory optimization...');
  await cacheManager.optimizeCache(true);
  
  const finalStats = cacheManager.getCacheStats();
  console.log(`Final cache entries: ${finalStats.totalEntries}`);
  console.log(`Final memory usage: ${(finalStats.memoryUsage / 1024).toFixed(1)} KB`);
  console.log(`Total evicted entries: ${finalStats.evictedEntries}\n`);
  
  cacheManager.destroy();
}

// Run examples
if (typeof module !== 'undefined' && require.main === module) {
  (async () => {
    try {
      await demonstrateFogCaching();
      await performanceComparison();
      await memoryUsageExample();
    } catch (error) {
      console.error('Example error:', error);
    }
  })();
}

export {
    demonstrateFogCaching, memoryUsageExample, performanceComparison
};
