/**
 * Simple memory leak prevention utilities for tests
 * This provides basic cleanup without complex tracking that could break tests
 */

// Simple cleanup utilities that don't interfere with existing test mocks
export const simpleCleanup = {
  // Clear any global timers that might be left hanging
  clearAllTimers: () => {
    if (typeof jest !== 'undefined') {
      jest.clearAllTimers();
    }
  },

  // Clear any global mocks
  clearAllMocks: () => {
    if (typeof jest !== 'undefined') {
      jest.clearAllMocks();
    }
  },

  // Simple memory usage check (if available)
  checkMemoryUsage: () => {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
      
      // Warn if memory usage is very high (over 500MB)
      if (heapUsedMB > 500) {
        console.warn(`High memory usage detected: ${heapUsedMB}MB`);
      }
      
      return heapUsedMB;
    }
    return 0;
  },

  // Setup basic cleanup for test suites
  setupBasicCleanup: () => {
    if (typeof afterEach === 'function') {
      afterEach(() => {
        simpleCleanup.clearAllTimers();
        simpleCleanup.clearAllMocks();
      });
    }

    if (typeof afterAll === 'function') {
      afterAll(() => {
        simpleCleanup.clearAllTimers();
        simpleCleanup.clearAllMocks();
        simpleCleanup.checkMemoryUsage();
      });
    }
  }
};

// Auto-setup if this file is imported
if (typeof global !== 'undefined' && !global.__memoryLeakPreventionSetup) {
  global.__memoryLeakPreventionSetup = true;
  simpleCleanup.setupBasicCleanup();
}

export default simpleCleanup;