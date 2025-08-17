// Mock for statisticsCacheManager
export const CACHE_KEYS = {
  TOTAL_DISTANCE: 'total_distance',
  WORLD_EXPLORATION: 'world_exploration',
  UNIQUE_REGIONS: 'unique_regions',
  REMAINING_REGIONS: 'remaining_regions',
  HIERARCHICAL_BREAKDOWN: 'hierarchical_breakdown',
  LAST_UPDATED: 'last_updated'
};

export const statisticsCacheManager = {
  get: jest.fn(async (key) => {
    // Return null by default (cache miss)
    return null;
  }),
  
  set: jest.fn(async (key, value, ttl) => {
    // Mock successful cache set
    return true;
  }),
  
  delete: jest.fn(async (key) => {
    // Mock successful cache delete
    return true;
  }),
  
  clear: jest.fn(async () => {
    // Mock successful cache clear
    return true;
  }),
  
  clearAll: jest.fn(async () => {
    // Mock successful cache clear all
    return true;
  }),
  
  has: jest.fn(async (key) => {
    // Return false by default (cache miss)
    return false;
  }),
  
  getOrCompute: jest.fn(async (key, computeFn, ttl) => {
    // Always compute (cache miss)
    return await computeFn();
  }),
  
  invalidatePattern: jest.fn(async (pattern) => {
    // Mock successful pattern invalidation
    return 0;
  }),
  
  getStats: jest.fn(() => ({
    hits: 0,
    misses: 0,
    sets: 0,
    invalidations: 0
  })),
  
  resetStats: jest.fn(() => {
    // Mock stats reset
  }),
  
  cleanup: jest.fn(() => {
    // Mock cleanup
  }),
  
  warmCache: jest.fn(async (keys) => {
    // Mock cache warming
    return keys.length;
  }),
  
  preloadCache: jest.fn(async (preloadFunctions) => {
    // Mock cache preloading
    return preloadFunctions.length;
  })
};

export const cleanupCacheManager = jest.fn(() => {
  // Mock cleanup
});