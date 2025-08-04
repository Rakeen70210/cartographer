import { calculateTotalDistance } from '../utils/distanceCalculator';
import { buildGeographicHierarchy } from '../utils/geographicHierarchy';
import {
    CACHE_KEYS,
    cleanupCacheManager,
    statisticsCacheManager
} from '../utils/statisticsCacheManager';
import {
    DataChunker,
    backgroundProcessor,
    cleanupPerformanceOptimizers,
    memoryManager,
    performanceMonitor,
    statisticsDebouncer
} from '../utils/statisticsPerformanceOptimizer';
import { calculateWorldExplorationPercentage } from '../utils/worldExplorationCalculator';

/**
 * Performance tests for statistics calculations
 * Tests caching, debouncing, background processing, and memory management
 */

// Mock data generators
const generateMockLocations = (count) => {
  const locations = [];
  for (let i = 0; i < count; i++) {
    locations.push({
      id: i + 1,
      latitude: 37.7749 + (Math.random() - 0.5) * 0.1, // Around San Francisco
      longitude: -122.4194 + (Math.random() - 0.5) * 0.1,
      timestamp: Date.now() - (count - i) * 1000 * 60 // 1 minute intervals
    });
  }
  return locations;
};

const generateMockRevealedAreas = (count) => {
  const areas = [];
  for (let i = 0; i < count; i++) {
    const centerLat = 37.7749 + (Math.random() - 0.5) * 0.1;
    const centerLon = -122.4194 + (Math.random() - 0.5) * 0.1;
    const radius = 0.001; // Small radius for testing
    
    // Create a simple square polygon around the center
    const polygon = {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [centerLon - radius, centerLat - radius],
          [centerLon + radius, centerLat - radius],
          [centerLon + radius, centerLat + radius],
          [centerLon - radius, centerLat + radius],
          [centerLon - radius, centerLat - radius]
        ]]
      },
      properties: {}
    };
    
    areas.push({
      id: i + 1,
      geojson: JSON.stringify(polygon)
    });
  }
  return areas;
};

const generateMockLocationWithGeography = (count) => {
  const locations = [];
  const countries = ['United States', 'Canada', 'Mexico', 'United Kingdom', 'France'];
  const states = ['California', 'New York', 'Texas', 'Florida', 'Illinois'];
  const cities = ['San Francisco', 'New York', 'Los Angeles', 'Chicago', 'Miami'];
  
  for (let i = 0; i < count; i++) {
    locations.push({
      id: i + 1,
      latitude: 37.7749 + (Math.random() - 0.5) * 0.1,
      longitude: -122.4194 + (Math.random() - 0.5) * 0.1,
      timestamp: Date.now() - (count - i) * 1000 * 60,
      country: countries[Math.floor(Math.random() * countries.length)],
      state: states[Math.floor(Math.random() * states.length)],
      city: cities[Math.floor(Math.random() * cities.length)],
      isGeocoded: true
    });
  }
  return locations;
};

describe('Statistics Performance Tests', () => {
  beforeEach(async () => {
    // Clear cache before each test
    await statisticsCacheManager.clearAll();
    performanceMonitor.reset();
  });

  afterAll(() => {
    // Cleanup after all tests
    cleanupPerformanceOptimizers();
    cleanupCacheManager();
  });

  describe('Debouncing Performance', () => {
    test('should debounce rapid function calls', async () => {
      let callCount = 0;
      const testFunction = () => {
        callCount++;
      };

      const debouncedFunction = statisticsDebouncer.debounce(
        'test_debounce',
        testFunction,
        100
      );

      // Call function rapidly
      for (let i = 0; i < 10; i++) {
        debouncedFunction();
      }

      // Should not have been called yet
      expect(callCount).toBe(0);

      // Wait for debounce delay
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should have been called only once
      expect(callCount).toBe(1);
    });

    test('should handle multiple debounced functions independently', async () => {
      let count1 = 0;
      let count2 = 0;

      const func1 = statisticsDebouncer.debounce('test1', () => count1++, 50);
      const func2 = statisticsDebouncer.debounce('test2', () => count2++, 50);

      func1();
      func2();
      func1();
      func2();

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(count1).toBe(1);
      expect(count2).toBe(1);
    });
  });

  describe('Background Processing Performance', () => {
    test('should process tasks in background queue', async () => {
      const results = [];
      
      const task1 = () => Promise.resolve('task1');
      const task2 = () => Promise.resolve('task2');
      const task3 = () => Promise.resolve('task3');

      const promises = [
        backgroundProcessor.enqueue('task1', task1, 1),
        backgroundProcessor.enqueue('task2', task2, 2), // Higher priority
        backgroundProcessor.enqueue('task3', task3, 0)
      ];

      const taskResults = await Promise.all(promises);
      
      expect(taskResults).toContain('task1');
      expect(taskResults).toContain('task2');
      expect(taskResults).toContain('task3');
    });

    test('should respect priority ordering', async () => {
      const executionOrder = [];
      
      const createTask = (name) => () => {
        executionOrder.push(name);
        return Promise.resolve(name);
      };

      // Add tasks with different priorities
      const promises = [
        backgroundProcessor.enqueue('low', createTask('low'), 0),
        backgroundProcessor.enqueue('high', createTask('high'), 2),
        backgroundProcessor.enqueue('medium', createTask('medium'), 1)
      ];

      await Promise.all(promises);

      // High priority should execute first
      expect(executionOrder[0]).toBe('high');
    });
  });

  describe('Cache Performance', () => {
    test('should cache and retrieve values efficiently', async () => {
      const testData = { value: 'test', timestamp: Date.now() };
      
      // Set cache
      await statisticsCacheManager.set('test_key', testData);
      
      // Get from cache
      const cached = await statisticsCacheManager.get('test_key');
      
      expect(cached).toEqual(testData);
      
      // Check cache stats
      const stats = statisticsCacheManager.getCacheStats();
      expect(stats.hits).toBe(1);
      expect(stats.sets).toBe(1);
    });

    test('should handle cache invalidation correctly', async () => {
      await statisticsCacheManager.set(CACHE_KEYS.LOCATION_HASH, 'hash1');
      await statisticsCacheManager.set(CACHE_KEYS.DISTANCE_DATA, { miles: 100, kilometers: 160 });
      
      // Invalidate location hash should also invalidate distance data
      await statisticsCacheManager.invalidate(CACHE_KEYS.LOCATION_HASH);
      
      const locationHash = await statisticsCacheManager.get(CACHE_KEYS.LOCATION_HASH);
      const distanceData = await statisticsCacheManager.get(CACHE_KEYS.DISTANCE_DATA);
      
      expect(locationHash).toBeNull();
      expect(distanceData).toBeNull();
    });

    test('should handle getOrCompute efficiently', async () => {
      let computeCount = 0;
      const computeFunction = async () => {
        computeCount++;
        return { computed: true, count: computeCount };
      };

      // First call should compute
      const result1 = await statisticsCacheManager.getOrCompute(
        'compute_test',
        computeFunction
      );
      
      // Second call should use cache
      const result2 = await statisticsCacheManager.getOrCompute(
        'compute_test',
        computeFunction
      );

      expect(computeCount).toBe(1);
      expect(result1).toEqual(result2);
    });
  });

  describe('Memory Management Performance', () => {
    test('should detect memory pressure', () => {
      const memoryUsage = memoryManager.getMemoryUsage();
      expect(typeof memoryUsage).toBe('number');
      expect(memoryUsage).toBeGreaterThanOrEqual(0);
    });

    test('should optimize memory when under pressure', async () => {
      // This test is limited since we can't easily simulate memory pressure
      // in a test environment, but we can test that the function runs
      await expect(memoryManager.optimizeMemory()).resolves.not.toThrow();
    });
  });

  describe('Data Chunking Performance', () => {
    test('should process large datasets in chunks', async () => {
      const largeDataset = Array.from({ length: 10000 }, (_, i) => i);
      const chunkSize = 1000;
      let processedChunks = 0;

      const processor = async (chunk) => {
        processedChunks++;
        return chunk.length;
      };

      const results = await DataChunker.processInChunks(
        largeDataset,
        processor,
        chunkSize
      );

      expect(processedChunks).toBe(10); // 10000 / 1000
      expect(results).toHaveLength(10);
      expect(results.every(result => result === chunkSize)).toBe(true);
    });

    test('should limit hierarchy complexity', () => {
      const deepHierarchy = [
        {
          name: 'Root',
          children: [
            {
              name: 'Level1',
              children: [
                {
                  name: 'Level2',
                  children: [
                    { name: 'Level3', children: [{ name: 'Level4' }] }
                  ]
                }
              ]
            }
          ]
        }
      ];

      const limited = DataChunker.processHierarchyWithLimits(
        deepHierarchy,
        2, // Max depth
        100 // Max nodes per level
      );

      // Should only have 2 levels deep
      expect(limited[0].children[0].children[0].children).toBeUndefined();
    });
  });

  describe('Performance Monitoring', () => {
    test('should track calculation timing', async () => {
      const endTiming = performanceMonitor.startTiming('test_calculation');
      
      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 50));
      
      endTiming();
      
      const metrics = performanceMonitor.getMetrics('test_calculation');
      expect(metrics).toBeTruthy();
      expect(metrics.calculationTime).toBeGreaterThan(40);
      expect(metrics.calculationTime).toBeLessThan(100);
    });

    test('should track cache hit rates', () => {
      performanceMonitor.recordCacheHit();
      performanceMonitor.recordCacheHit();
      performanceMonitor.recordCacheMiss();
      
      const hitRate = performanceMonitor.getCacheHitRate();
      expect(hitRate).toBeCloseTo(66.67, 1); // 2/3 * 100
    });
  });

  describe('Large Dataset Performance', () => {
    test('should handle large location datasets efficiently', async () => {
      const largeLocationSet = generateMockLocations(50000);
      
      const startTime = Date.now();
      const result = await calculateTotalDistance(largeLocationSet);
      const endTime = Date.now();
      
      const calculationTime = endTime - startTime;
      
      expect(result.miles).toBeGreaterThan(0);
      expect(result.kilometers).toBeGreaterThan(0);
      expect(calculationTime).toBeLessThan(5000); // Should complete within 5 seconds
    }, 10000); // 10 second timeout

    test('should handle large revealed areas datasets efficiently', async () => {
      const largeRevealedAreas = generateMockRevealedAreas(10000);
      
      const startTime = Date.now();
      const result = await calculateWorldExplorationPercentage(largeRevealedAreas);
      const endTime = Date.now();
      
      const calculationTime = endTime - startTime;
      
      expect(result.percentage).toBeGreaterThan(0);
      expect(result.exploredAreaKm2).toBeGreaterThan(0);
      expect(calculationTime).toBeLessThan(10000); // Should complete within 10 seconds
    }, 15000); // 15 second timeout

    test('should handle complex hierarchies efficiently', async () => {
      const largeLocationSet = generateMockLocationWithGeography(25000);
      
      const startTime = Date.now();
      const hierarchy = await buildGeographicHierarchy(largeLocationSet, {
        maxDepth: 3,
        sortBy: 'name',
        sortOrder: 'asc'
      });
      const endTime = Date.now();
      
      const calculationTime = endTime - startTime;
      
      expect(hierarchy).toBeInstanceOf(Array);
      expect(hierarchy.length).toBeGreaterThan(0);
      expect(calculationTime).toBeLessThan(8000); // Should complete within 8 seconds
    }, 12000); // 12 second timeout
  });

  describe('Cache Performance with Large Datasets', () => {
    test('should cache large datasets efficiently', async () => {
      const largeData = {
        locations: generateMockLocations(10000),
        areas: generateMockRevealedAreas(5000),
        timestamp: Date.now()
      };

      const startTime = Date.now();
      await statisticsCacheManager.set('large_dataset', largeData);
      const setTime = Date.now() - startTime;

      const retrieveStartTime = Date.now();
      const retrieved = await statisticsCacheManager.get('large_dataset');
      const retrieveTime = Date.now() - retrieveStartTime;

      expect(retrieved).toBeTruthy();
      expect(retrieved.locations).toHaveLength(10000);
      expect(retrieved.areas).toHaveLength(5000);
      expect(setTime).toBeLessThan(1000); // Should cache within 1 second
      expect(retrieveTime).toBeLessThan(500); // Should retrieve within 0.5 seconds
    });

    test('should handle cache warming efficiently', async () => {
      const startTime = Date.now();
      await statisticsCacheManager.warmCache();
      const warmTime = Date.now() - startTime;

      expect(warmTime).toBeLessThan(2000); // Should warm cache within 2 seconds
    });
  });

  describe('Concurrent Operations Performance', () => {
    test('should handle concurrent cache operations', async () => {
      const operations = [];
      
      // Create multiple concurrent cache operations
      for (let i = 0; i < 100; i++) {
        operations.push(
          statisticsCacheManager.set(`concurrent_${i}`, { value: i })
        );
      }

      const startTime = Date.now();
      await Promise.all(operations);
      const setTime = Date.now() - startTime;

      // Retrieve all values concurrently
      const retrieveOperations = [];
      for (let i = 0; i < 100; i++) {
        retrieveOperations.push(
          statisticsCacheManager.get(`concurrent_${i}`)
        );
      }

      const retrieveStartTime = Date.now();
      const results = await Promise.all(retrieveOperations);
      const retrieveTime = Date.now() - retrieveStartTime;

      expect(results).toHaveLength(100);
      expect(results.every((result, index) => result?.value === index)).toBe(true);
      expect(setTime).toBeLessThan(3000); // Should complete within 3 seconds
      expect(retrieveTime).toBeLessThan(2000); // Should retrieve within 2 seconds
    });

    test('should handle concurrent background processing', async () => {
      const tasks = [];
      
      for (let i = 0; i < 50; i++) {
        tasks.push(
          backgroundProcessor.enqueue(
            `concurrent_task_${i}`,
            () => Promise.resolve(i * 2),
            Math.floor(Math.random() * 3) // Random priority 0-2
          )
        );
      }

      const startTime = Date.now();
      const results = await Promise.all(tasks);
      const processingTime = Date.now() - startTime;

      expect(results).toHaveLength(50);
      expect(results.every((result, index) => result === index * 2)).toBe(true);
      expect(processingTime).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });
});