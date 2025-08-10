/**
 * Jest setup file for consistent test configuration across all test files
 * This file is automatically loaded before each test suite
 */

import { TEST_CONSTANTS } from './testSetup.js';

// Global test configuration
global.TEST_CONSTANTS = TEST_CONSTANTS;

// Mock console methods to reduce noise during tests (but allow debugging)
const originalConsole = { ...console };

beforeEach(() => {
  // Reset console mocks before each test
  if (!process.env.DEBUG_TESTS) {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'info').mockImplementation(() => {});
    // Keep console.error for debugging test failures
  }
});

afterEach(() => {
  // Restore console after each test
  if (!process.env.DEBUG_TESTS) {
    console.log.mockRestore?.();
    console.warn.mockRestore?.();
    console.info.mockRestore?.();
  }
  
  // Clear all mocks after each test
  jest.clearAllMocks();
});

// Global mock implementations that should be consistent across all tests
global.mockFetch = jest.fn();
global.fetch = global.mockFetch;

// Mock timers setup
global.setupMockTimers = () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(1640995200000)); // Jan 1, 2022 00:00:00 GMT
};

global.cleanupMockTimers = () => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
};

// Mock React Native modules consistently
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: jest.fn((options) => options.ios || options.default)
  },
  Dimensions: {
    get: jest.fn(() => ({ width: 375, height: 812 }))
  },
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    currentState: 'active'
  },
  Alert: {
    alert: jest.fn()
  },
  Linking: {
    openURL: jest.fn()
  },
  StyleSheet: {
    create: jest.fn((styles) => styles),
    flatten: jest.fn((styles) => styles)
  },
  View: 'View',
  Text: 'Text',
  ScrollView: 'ScrollView',
  TouchableOpacity: 'TouchableOpacity',
  ActivityIndicator: 'ActivityIndicator',
  Animated: {
    Value: jest.fn().mockImplementation((value) => ({
      setValue: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      removeAllListeners: jest.fn(),
      stopAnimation: jest.fn(),
      resetAnimation: jest.fn(),
      interpolate: jest.fn(() => ({ setValue: jest.fn() })),
      _value: value,
      _listeners: {}
    })),
    View: 'Animated.View',
    Text: 'Animated.Text',
    ScrollView: 'Animated.ScrollView',
    timing: jest.fn(() => ({
      start: jest.fn((callback) => callback && callback({ finished: true }))
    })),
    spring: jest.fn(() => ({
      start: jest.fn((callback) => callback && callback({ finished: true }))
    })),
    sequence: jest.fn(() => ({
      start: jest.fn((callback) => callback && callback({ finished: true }))
    })),
    parallel: jest.fn(() => ({
      start: jest.fn((callback) => callback && callback({ finished: true }))
    })),
    stagger: jest.fn(() => ({
      start: jest.fn((callback) => callback && callback({ finished: true }))
    })),
    loop: jest.fn(() => ({
      start: jest.fn((callback) => callback && callback({ finished: true }))
    })),
    decay: jest.fn(() => ({
      start: jest.fn((callback) => callback && callback({ finished: true }))
    })),
    add: jest.fn(),
    subtract: jest.fn(),
    multiply: jest.fn(),
    divide: jest.fn(),
    modulo: jest.fn(),
    diffClamp: jest.fn(),
    createAnimatedComponent: jest.fn((component) => component),
    Easing: {
      linear: jest.fn(),
      ease: jest.fn(),
      quad: jest.fn(),
      cubic: jest.fn(),
      poly: jest.fn(),
      sin: jest.fn(),
      circle: jest.fn(),
      exp: jest.fn(),
      elastic: jest.fn(),
      back: jest.fn(),
      bounce: jest.fn(),
      bezier: jest.fn(),
      in: jest.fn(),
      out: jest.fn(),
      inOut: jest.fn()
    }
  },
  RefreshControl: 'RefreshControl',
  AccessibilityInfo: {
    addEventListener: jest.fn(() => ({
      remove: jest.fn()
    })),
    removeEventListener: jest.fn(),
    isReduceMotionEnabled: jest.fn().mockResolvedValue(false),
    isScreenReaderEnabled: jest.fn().mockResolvedValue(false),
    isBoldTextEnabled: jest.fn().mockResolvedValue(false),
    isGrayscaleEnabled: jest.fn().mockResolvedValue(false),
    isInvertColorsEnabled: jest.fn().mockResolvedValue(false),
    isReduceTransparencyEnabled: jest.fn().mockResolvedValue(false),
    announceForAccessibility: jest.fn(),
    setAccessibilityFocus: jest.fn()
  }
}));

// Mock Expo modules consistently
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestBackgroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getCurrentPositionAsync: jest.fn().mockResolvedValue({
    coords: {
      latitude: 37.7749,
      longitude: -122.4194,
      accuracy: 10
    }
  }),
  watchPositionAsync: jest.fn().mockResolvedValue({
    remove: jest.fn()
  }),
  reverseGeocodeAsync: jest.fn().mockResolvedValue([{
    country: 'United States',
    region: 'California',
    city: 'San Francisco',
    isoCountryCode: 'US'
  }])
}));

jest.mock('expo-sqlite', () => ({
  openDatabase: jest.fn(() => ({
    transaction: jest.fn((callback) => {
      callback({
        executeSql: jest.fn((sql, params, success) => {
          if (success) success([], { rows: { _array: [] } });
        })
      });
    })
  }))
}));

jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn().mockResolvedValue({
    isConnected: true,
    isInternetReachable: true,
    type: 'wifi',
    details: {}
  }),
  addEventListener: jest.fn(() => jest.fn())
}));

// Mock safe area context
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 })
}));

// Global test utilities
global.testUtils = {
  // Wait for async operations to complete
  waitForAsync: (ms = 0) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Create a mock function with consistent behavior
  createMockFunction: (returnValue) => jest.fn().mockResolvedValue(returnValue),
  
  // Create a mock function that fails
  createFailingMockFunction: (error) => jest.fn().mockRejectedValue(error),
  
  // Simulate network delay
  simulateNetworkDelay: (ms = 100) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Generate consistent test IDs
  generateTestId: (prefix, suffix) => `${prefix}-${suffix || Date.now()}`,
  
  // Validate mock call arguments
  expectMockCalledWith: (mockFn, expectedArgs) => {
    expect(mockFn).toHaveBeenCalledWith(...expectedArgs);
  }
};

// Performance testing utilities
global.performanceUtils = {
  measureTime: async (operation) => {
    const start = Date.now();
    await operation();
    return Date.now() - start;
  },
  
  expectPerformance: (actualTime, expectedTime, tolerance = 0.2) => {
    const maxTime = expectedTime * (1 + tolerance);
    expect(actualTime).toBeLessThan(maxTime);
  }
};

// Error testing utilities
global.errorUtils = {
  expectError: async (operation, expectedErrorMessage) => {
    await expect(operation()).rejects.toThrow(expectedErrorMessage);
  },
  
  expectNoError: async (operation) => {
    await expect(operation()).resolves.not.toThrow();
  }
};

// Data validation utilities
global.validationUtils = {
  expectValidCoordinates: (lat, lon) => {
    expect(typeof lat).toBe('number');
    expect(typeof lon).toBe('number');
    expect(lat).toBeGreaterThanOrEqual(-90);
    expect(lat).toBeLessThanOrEqual(90);
    expect(lon).toBeGreaterThanOrEqual(-180);
    expect(lon).toBeLessThanOrEqual(180);
  },
  
  expectValidTimestamp: (timestamp) => {
    expect(typeof timestamp).toBe('number');
    expect(timestamp).toBeGreaterThan(0);
    expect(timestamp).toBeLessThanOrEqual(Date.now());
  },
  
  expectValidPercentage: (percentage) => {
    expect(typeof percentage).toBe('number');
    expect(percentage).toBeGreaterThanOrEqual(0);
    // Note: percentages can be > 100 in some edge cases
  }
};

// Setup global error handler for unhandled promise rejections in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process in tests, just log the error
});

// Increase timeout for all tests to account for system variability
jest.setTimeout(30000); // 30 seconds

// Export for use in individual test files
export {
    TEST_CONSTANTS
};
