/**
 * Additional Jest setup for comprehensive testing
 * Extends the main Jest setup with testing-specific configurations
 */

// Import main setup from root - this provides mockLogger, mockDatabase, mockTurf, and other base mocks
import '../../jest.setup.js';

// Optimized timeout for performance (requirement 5.1: < 30 seconds per test)
jest.setTimeout(30000);

// Global test utilities for comprehensive testing - extend existing utilities from root setup
global.testUtils = {
  ...global.testUtils,
  
  // Create consistent mock geometry
  createMockPolygon: (offset = 0) => ({
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [-122.42 + offset, 37.77 + offset],
        [-122.41 + offset, 37.77 + offset],
        [-122.41 + offset, 37.78 + offset],
        [-122.42 + offset, 37.78 + offset],
        [-122.42 + offset, 37.77 + offset]
      ]]
    }
  }),
  
  // Create mock point
  createMockPoint: (lng = -122.4194, lat = 37.7749) => ({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [lng, lat]
    },
    properties: {}
  }),
  
  // Enhanced hook testing utilities
  renderHookSafely: (hookCallback, options = {}) => {
    return global.renderHookUtils.safeRenderHook(hookCallback, options);
  },
  
  waitForHookStable: async (result, timeout = 5000) => {
    return global.renderHookUtils.waitForHookStable(result, timeout);
  },
  
  actSafely: async (callback) => {
    return global.renderHookUtils.safeAct(callback);
  },
  
  // Cleanup helper for tests
  cleanupTest: () => {
    global.cleanup();
  }
};

// Export mockLogger from global scope (defined in root setup)
export const mockLogger = global.mockLogger;
