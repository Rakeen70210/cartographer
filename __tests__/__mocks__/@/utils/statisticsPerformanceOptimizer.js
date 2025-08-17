// Mock for statisticsPerformanceOptimizer
export const statisticsDebouncer = {
  debounce: jest.fn((key, fn, delay) => {
    return (...args) => {
      // Execute immediately in tests
      fn(...args);
    };
  }),
  cancel: jest.fn(),
  cancelAll: jest.fn(),
  getPendingKeys: jest.fn(() => [])
};

export const backgroundProcessor = {
  enqueue: jest.fn(async (id, task, priority = 0) => {
    // Execute immediately in tests
    return await task();
  }),
  getStatus: jest.fn(() => ({
    queueLength: 0,
    activeCount: 0,
    isProcessing: false
  })),
  clear: jest.fn()
};

export const memoryManager = {
  getMemoryUsage: jest.fn(() => 50), // 50MB
  isMemoryPressure: jest.fn(() => false),
  optimizeMemory: jest.fn(),
  stopCleanupInterval: jest.fn()
};

export const performanceMonitor = {
  startTiming: jest.fn(() => jest.fn()),
  recordCacheHit: jest.fn(),
  recordCacheMiss: jest.fn(),
  getCacheHitRate: jest.fn(() => 75),
  getMetrics: jest.fn(() => ({
    calculationTime: 100,
    memoryUsage: 10,
    cacheHitRate: 75,
    lastOptimization: Date.now()
  })),
  getAllMetrics: jest.fn(() => new Map()),
  reset: jest.fn()
};

export const DataChunker = {
  processInChunks: jest.fn(async (data, processor, chunkSize = 1000) => {
    const results = [];
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      const result = await processor(chunk);
      results.push(result);
    }
    return results;
  }),
  processHierarchyWithLimits: jest.fn((data, maxDepth, maxNodesPerLevel = 100) => {
    return data.slice(0, maxNodesPerLevel);
  })
};

export const cleanupPerformanceOptimizers = jest.fn();