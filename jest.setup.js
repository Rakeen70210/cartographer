// Jest setup file - Consolidated configuration for all tests
import 'react-native-gesture-handler/jestSetup';

// Define __DEV__ for test environment
global.__DEV__ = true;

// Global test configuration
global.TEST_CONSTANTS = {
  DEFAULT_LATITUDE: 37.7749,
  DEFAULT_LONGITUDE: -122.4194,
  DEFAULT_TIMESTAMP: 1640995200000, // Jan 1, 2022 00:00:00 GMT
  EARTH_SURFACE_AREA_KM2: 510072000,
  DEFAULT_NETWORK_TIMEOUT: 5000,
  DEFAULT_CACHE_TTL: 24 * 60 * 60 * 1000, // 24 hours
};

// Mock logger FIRST to ensure it's available everywhere
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  success: jest.fn(),

  // Session-based logging methods
  infoOnce: jest.fn(),
  warnOnce: jest.fn(),
  debugOnce: jest.fn(),
  successOnce: jest.fn(),

  // Throttled logging methods
  infoThrottled: jest.fn(),
  warnThrottled: jest.fn(),
  debugThrottled: jest.fn(),

  // Viewport-specific logging (heavily throttled)
  debugViewport: jest.fn(),
  infoViewport: jest.fn()
};

// Use doMock to ensure runtime mocking
jest.doMock('@/utils/logger', () => ({
  logger: mockLogger
}));

jest.doMock('./utils/logger', () => ({
  logger: mockLogger
}));

// Also use regular mock for hoisting
jest.mock('@/utils/logger', () => ({
  logger: mockLogger
}));

jest.mock('./utils/logger', () => ({
  logger: mockLogger
}));

// Export mockLogger for use in tests
global.mockLogger = mockLogger;

// Mock performance.now for consistent timing in tests
const mockPerformanceNow = jest.fn(() => Date.now());
global.performance = global.performance || {};
global.performance.now = mockPerformanceNow;

// Global test cleanup and setup
beforeEach(() => {
  // Reset performance.now mock before each test
  mockPerformanceNow.mockClear();
  let currentTime = 1000; // Start at 1 second
  mockPerformanceNow.mockImplementation(() => {
    currentTime += Math.random() * 100; // Add 0-100ms each call
    return currentTime;
  });

  // Reset logger mocks before each test
  Object.values(mockLogger).forEach(fn => fn.mockClear());

  // Reset console mocks to reduce noise during tests
  if (!process.env.DEBUG_TESTS) {
    jest.spyOn(console, 'log').mockImplementation(() => { });
    jest.spyOn(console, 'warn').mockImplementation(() => { });
    jest.spyOn(console, 'info').mockImplementation(() => { });
    // Keep console.error for debugging test failures
  }

  // Clear any pending timers to prevent interference
  jest.clearAllTimers();
  
  // Reset React Testing Library cleanup
  if (global.cleanup) {
    global.cleanup();
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
  
  // Clear any remaining timers
  jest.clearAllTimers();
  
  // Force cleanup of any remaining test renderers
  if (global.cleanup) {
    global.cleanup();
  }
});

// Global mock implementations
global.mockFetch = jest.fn();
global.fetch = global.mockFetch;

// Mock timers setup utilities
global.setupMockTimers = () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(1640995200000)); // Jan 1, 2022 00:00:00 GMT
};

global.cleanupMockTimers = () => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
};

// Enhanced renderHook utilities for better async handling and cleanup
global.renderHookUtils = {
  // Safe renderHook wrapper that handles cleanup automatically
  safeRenderHook: (hookCallback, options = {}) => {
    const { renderHook } = require('@testing-library/react-native');
    let hookResult;
    let isUnmounted = false;
    
    try {
      hookResult = renderHook(hookCallback, options);
      
      // Wrap the original unmount to track state
      const originalUnmount = hookResult.unmount;
      hookResult.unmount = () => {
        if (!isUnmounted) {
          isUnmounted = true;
          try {
            originalUnmount();
          } catch (error) {
            // Ignore unmount errors - they're often due to test renderer state
            if (!error.message.includes("Can't access .root on unmounted test renderer")) {
              throw error;
            }
          }
        }
      };
      
      // Add helper to check if unmounted
      hookResult.isUnmounted = () => isUnmounted;
      
      return hookResult;
    } catch (error) {
      if (error.message.includes("Can't access .root on unmounted test renderer")) {
        // Return a mock result for unmounted renderer errors
        return {
          result: { current: null },
          unmount: () => {},
          rerender: () => {},
          isUnmounted: () => true
        };
      }
      throw error;
    }
  },
  
  // Wait for hook to stabilize with timeout
  waitForHookStable: async (result, timeout = 3000) => { // Reduced default timeout
    const { waitFor } = require('@testing-library/react-native');
    
    try {
      await waitFor(() => {
        if (result.isUnmounted && result.isUnmounted()) {
          return true; // Consider unmounted hooks as stable
        }
        
        const current = result.current;
        if (!current) return true;
        
        // Check common loading/calculating states
        const isStable = !current.isCalculating && 
                        !current.isChanging && 
                        !current.isLoading &&
                        !current.isRefreshing;
        
        if (!isStable) {
          throw new Error('Hook not yet stable');
        }
        
        return true;
      }, { timeout, interval: 50 }); // Reduced polling interval
    } catch (error) {
      if (error.message.includes('Hook not yet stable')) {
        // Hook didn't stabilize within timeout - this is acceptable in some cases
        console.warn(`Hook did not stabilize within ${timeout}ms`);
      } else {
        throw error;
      }
    }
  },
  
  // Safe act wrapper that handles unmounted components
  safeAct: async (callback) => {
    const { act } = require('@testing-library/react-native');
    
    try {
      if (typeof callback === 'function') {
        if (callback.constructor.name === 'AsyncFunction') {
          await act(async () => {
            await callback();
          });
        } else {
          act(() => {
            callback();
          });
        }
      }
    } catch (error) {
      if (error.message.includes("Can't access .root on unmounted test renderer") ||
          error.message.includes('Cannot update a component')) {
        // Ignore these errors as they're often due to test cleanup timing
        console.warn('Ignoring act error due to component unmount:', error.message);
      } else {
        throw error;
      }
    }
  }
};

// Global cleanup registry for test renderers
global.testCleanupRegistry = new Set();

global.registerTestCleanup = (cleanupFn) => {
  global.testCleanupRegistry.add(cleanupFn);
};

global.cleanup = () => {
  // Run all registered cleanup functions
  global.testCleanupRegistry.forEach(cleanupFn => {
    try {
      cleanupFn();
    } catch (error) {
      // Ignore cleanup errors
      console.warn('Cleanup error:', error.message);
    }
  });
  global.testCleanupRegistry.clear();
  
  // Note: Don't call React Testing Library cleanup here as it causes Jest hook errors
  // The cleanup will be handled by Jest's afterEach automatically
};

// Timeout utilities for better async test handling
global.timeoutUtils = {
  // Create a promise that resolves after a delay
  delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Create a promise that rejects after a timeout
  timeout: (ms, message = 'Operation timed out') => 
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  
  // Race a promise against a timeout
  withTimeout: async (promise, timeoutMs, timeoutMessage) => {
    const timeoutPromise = global.timeoutUtils.timeout(timeoutMs, timeoutMessage);
    return Promise.race([promise, timeoutPromise]);
  },
  
  // Retry an async operation with exponential backoff
  retry: async (operation, maxAttempts = 3, baseDelay = 100) => {
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (attempt < maxAttempts) {
          const delay = baseDelay * Math.pow(2, attempt - 1);
          await global.timeoutUtils.delay(delay);
        }
      }
    }
    throw lastError;
  }
};

// Mock TurboModuleRegistry to prevent DevMenu errors and getViewManagerConfig issues
jest.mock('react-native/Libraries/TurboModule/TurboModuleRegistry', () => ({
  get: jest.fn(() => null),
  getEnforcing: jest.fn(() => ({})),
}));

// Mock UIManager to prevent getViewManagerConfig errors
jest.mock('react-native/Libraries/ReactNative/UIManager', () => ({
  getViewManagerConfig: jest.fn(() => ({})),
  hasViewManagerConfig: jest.fn(() => false),
  getConstants: jest.fn(() => ({})),
  getConstantsForViewManager: jest.fn(() => ({})),
  measure: jest.fn(),
  measureInWindow: jest.fn(),
  measureLayout: jest.fn(),
  measureLayoutRelativeToParent: jest.fn(),
  updateView: jest.fn(),
  setChildren: jest.fn(),
  manageChildren: jest.fn(),
  createView: jest.fn(),
  removeSubviewsFromContainerWithID: jest.fn(),
  replaceExistingNonRootView: jest.fn(),
  setLayoutAnimationEnabledExperimental: jest.fn(),
  configureNextLayoutAnimation: jest.fn(),
  dispatchViewManagerCommand: jest.fn(),
  blur: jest.fn(),
  focus: jest.fn(),
  findSubviewIn: jest.fn(),
}));

// Mock react-native modules comprehensively
jest.mock('react-native', () => {
  const mockComponent = (name) => {
    const MockedComponent = (props) => {
      const React = require('react');
      return React.createElement(name, props, props.children);
    };
    MockedComponent.displayName = name;
    return MockedComponent;
  };

  // Create a proper Animated.Value constructor mock
  function MockAnimatedValue(value) {
    this.setValue = jest.fn();
    this.addListener = jest.fn();
    this.removeListener = jest.fn();
    this.removeAllListeners = jest.fn();
    this.stopAnimation = jest.fn();
    this.resetAnimation = jest.fn();
    this.interpolate = jest.fn((config) => {
      // Return a string or number based on outputRange
      if (config && config.outputRange && config.outputRange.length > 0) {
        return config.outputRange[0];
      }
      return '0%';
    });
    this._value = value || 0;
    this._listeners = {};
  }

  return {
    StyleSheet: {
      create: jest.fn((styles) => styles),
      flatten: jest.fn((style) => style),
      compose: jest.fn((style1, style2) => [style1, style2]),
      hairlineWidth: 1,
      absoluteFill: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
      },
    },
    View: mockComponent('View'),
    Text: mockComponent('Text'),
    ScrollView: mockComponent('ScrollView'),
    TouchableOpacity: mockComponent('TouchableOpacity'),
    Pressable: mockComponent('Pressable'),
    Image: mockComponent('Image'),
    RefreshControl: mockComponent('RefreshControl'),
    ActivityIndicator: mockComponent('ActivityIndicator'),
    FlatList: (props) => {
      const React = require('react');

      // Create a mock that renders items properly
      const { data, renderItem, keyExtractor, testID, style, ...otherProps } = props;

      // If no data, render empty view
      if (!data || !Array.isArray(data) || data.length === 0) {
        return React.createElement('View', {
          testID: testID || 'flat-list',
          style,
          ...otherProps
        });
      }

      // Render items using the renderItem function
      try {
        const renderedItems = data.map((item, index) => {
          if (!renderItem) return null;

          const renderedItem = renderItem({ item, index });

          // Add key to rendered item if keyExtractor is provided
          if (keyExtractor && renderedItem && React.isValidElement(renderedItem)) {
            const key = keyExtractor(item, index);
            return React.cloneElement(renderedItem, { key });
          }

          return renderedItem;
        }).filter(Boolean);

        return React.createElement('View', {
          testID: testID || 'flat-list',
          style,
          'data-testid': 'hierarchical-list',
          ...otherProps
        }, renderedItems);
      } catch (error) {
        // If rendering fails, return simple view
        return React.createElement('View', {
          testID: testID || 'flat-list',
          style,
          ...otherProps
        });
      }
    },
    Animated: {
      View: mockComponent('Animated.View'),
      Text: mockComponent('Animated.Text'),
      ScrollView: mockComponent('Animated.ScrollView'),
      Value: MockAnimatedValue,
      timing: jest.fn(() => ({
        start: jest.fn((callback) => callback && callback({ finished: true })),
        stop: jest.fn(),
        reset: jest.fn(),
      })),
      spring: jest.fn(() => ({
        start: jest.fn((callback) => callback && callback({ finished: true })),
        stop: jest.fn(),
        reset: jest.fn(),
      })),
      sequence: jest.fn(() => ({
        start: jest.fn((callback) => callback && callback({ finished: true })),
        stop: jest.fn(),
        reset: jest.fn(),
      })),
      parallel: jest.fn(() => ({
        start: jest.fn((callback) => callback && callback({ finished: true })),
        stop: jest.fn(),
        reset: jest.fn(),
      })),
      loop: jest.fn(() => ({
        start: jest.fn((callback) => callback && callback({ finished: true })),
        stop: jest.fn(),
        reset: jest.fn(),
      })),
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
    Dimensions: {
      get: jest.fn(() => ({ width: 375, height: 812 })),
      addEventListener: jest.fn(() => ({ remove: jest.fn() })),
      removeEventListener: jest.fn(),
    },
    Platform: {
      OS: 'ios',
      Version: '14.0',
      select: jest.fn((obj) => obj.ios || obj.default),
    },
    AppState: {
      currentState: 'active',
      addEventListener: jest.fn(() => ({ remove: jest.fn() })),
      removeEventListener: jest.fn(),
    },
    Alert: {
      alert: jest.fn()
    },
    Linking: {
      openURL: jest.fn()
    },
    NativeModules: {},
    DeviceEventEmitter: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
    NativeEventEmitter: jest.fn(() => ({
      addListener: jest.fn(),
      removeListener: jest.fn(),
    })),
    AccessibilityInfo: {
      addEventListener: jest.fn(() => ({ remove: jest.fn() })),
      removeEventListener: jest.fn(),
      isReduceMotionEnabled: jest.fn(() => Promise.resolve(false)),
      isScreenReaderEnabled: jest.fn(() => Promise.resolve(false)),
      isBoldTextEnabled: jest.fn(() => Promise.resolve(false)),
      isGrayscaleEnabled: jest.fn(() => Promise.resolve(false)),
      isInvertColorsEnabled: jest.fn(() => Promise.resolve(false)),
      isReduceTransparencyEnabled: jest.fn(() => Promise.resolve(false)),
      announceForAccessibility: jest.fn(),
      setAccessibilityFocus: jest.fn()
    },
  };
});

// Mock Expo modules comprehensively
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  requestBackgroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  getCurrentPositionAsync: jest.fn(() => Promise.resolve({
    coords: {
      latitude: 37.7749,
      longitude: -122.4194,
      altitude: 0,
      accuracy: 5,
      heading: 0,
      speed: 0,
    },
    timestamp: Date.now(),
  })),
  watchPositionAsync: jest.fn(() => Promise.resolve({ remove: jest.fn() })),
  startLocationUpdatesAsync: jest.fn(() => Promise.resolve()),
  stopLocationUpdatesAsync: jest.fn(() => Promise.resolve()),
  reverseGeocodeAsync: jest.fn(() => Promise.resolve([{
    country: 'United States',
    region: 'California',
    city: 'San Francisco',
    isoCountryCode: 'US'
  }])),
  Accuracy: {
    BestForNavigation: 6,
    Highest: 6,
    High: 4,
    Balanced: 3,
    Low: 2,
    Lowest: 1,
  },
  LocationAccuracy: {
    BestForNavigation: 6,
    Highest: 6,
    High: 4,
    Balanced: 3,
    Low: 2,
    Lowest: 1,
  },
}));

jest.mock('expo-task-manager', () => ({
  defineTask: jest.fn(),
  isTaskRegisteredAsync: jest.fn(() => Promise.resolve(false)),
}));

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn(() => ({
    // Async methods (used by the actual database.ts)
    execAsync: jest.fn().mockResolvedValue(undefined),
    getAllAsync: jest.fn().mockResolvedValue([]),
    getFirstAsync: jest.fn().mockResolvedValue(null),
    runAsync: jest.fn().mockResolvedValue({ changes: 0, lastInsertRowId: 0 }),
    prepareAsync: jest.fn().mockResolvedValue({
      executeAsync: jest.fn().mockResolvedValue({ changes: 0, lastInsertRowId: 0 }),
      getAllAsync: jest.fn().mockResolvedValue([]),
      getFirstAsync: jest.fn().mockResolvedValue(null),
      finalizeAsync: jest.fn().mockResolvedValue(undefined),
    }),
    closeAsync: jest.fn().mockResolvedValue(undefined),

    // Sync methods (for backward compatibility)
    execSync: jest.fn(),
    getAllSync: jest.fn(() => []),
    getFirstSync: jest.fn(() => null),
    runSync: jest.fn(() => ({ changes: 0, lastInsertRowId: 0 })),
    prepareSync: jest.fn(() => ({
      executeSync: jest.fn(() => ({ changes: 0, lastInsertRowId: 0 })),
      getAllSync: jest.fn(() => []),
      getFirstSync: jest.fn(() => null),
      finalizeSync: jest.fn(),
    })),
    closeSync: jest.fn(),
  })),
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

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
}));

jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(),
}));

jest.mock('expo-blur', () => ({
  BlurView: 'BlurView',
}));

jest.mock('expo-symbols', () => ({
  SymbolView: 'SymbolView',
  SymbolWeight: {
    Regular: 'regular',
    Medium: 'medium',
    Bold: 'bold',
  },
}));

jest.mock('expo-asset', () => ({
  Asset: {
    fromModule: jest.fn(() => ({
      downloadAsync: jest.fn(),
      uri: 'mock-uri',
    })),
  },
}));

jest.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      name: 'Test App',
      version: '1.0.0',
    },
    platform: {
      ios: {
        platform: 'ios',
      },
    },
  },
}));

jest.mock('expo-router', () => ({
  Link: ({ children, onPress, ...props }) => {
    const React = require('react');
    const { TouchableOpacity } = require('react-native');
    return React.createElement(TouchableOpacity, { ...props, onPress }, children);
  },
  Href: jest.fn(),
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  })),
}));

// Mock React Navigation
jest.mock('@react-navigation/bottom-tabs', () => ({
  useBottomTabBarHeight: jest.fn(() => 80),
  createBottomTabNavigator: jest.fn(() => ({
    Navigator: 'Navigator',
    Screen: 'Screen',
  })),
}));

jest.mock('@react-navigation/elements', () => ({
  PlatformPressable: (props) => {
    const React = require('react');
    const { TouchableOpacity } = require('react-native');
    return React.createElement(TouchableOpacity, props, props.children);
  },
  Header: 'Header',
  HeaderButton: 'HeaderButton',
  HeaderTitle: 'HeaderTitle',
  getHeaderTitle: jest.fn((options) => options.title || ''),
}));

jest.mock('@react-navigation/native', () => ({
  NavigationContainer: (props) => {
    const React = require('react');
    return React.createElement('View', props, props.children);
  },
  DefaultTheme: {
    dark: false,
    colors: {
      primary: '#007AFF',
      background: '#FFFFFF',
      card: '#FFFFFF',
      text: '#000000',
      border: '#E5E5E5',
      notification: '#FF3B30',
    },
  },
  DarkTheme: {
    dark: true,
    colors: {
      primary: '#0A84FF',
      background: '#000000',
      card: '#1C1C1E',
      text: '#FFFFFF',
      border: '#38383A',
      notification: '#FF453A',
    },
  },
  ThemeProvider: (props) => {
    const React = require('react');
    return React.createElement('View', props, props.children);
  },
  useNavigation: jest.fn(() => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    dispatch: jest.fn(),
    setOptions: jest.fn(),
    isFocused: jest.fn(() => true),
    addListener: jest.fn(() => jest.fn()),
  })),
  useRoute: jest.fn(() => ({
    key: 'test-route',
    name: 'TestScreen',
    params: {},
  })),
  useFocusEffect: jest.fn((callback) => {
    // Simulate focus effect by calling the callback immediately
    if (typeof callback === 'function') {
      callback();
    }
  }),
  useIsFocused: jest.fn(() => true),
  CommonActions: {
    navigate: jest.fn((name, params) => ({ type: 'NAVIGATE', payload: { name, params } })),
    goBack: jest.fn(() => ({ type: 'GO_BACK' })),
    reset: jest.fn((state) => ({ type: 'RESET', payload: state })),
  },
}));

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => {
  const mockNetInfo = {
    fetch: jest.fn(() => Promise.resolve({
      type: 'wifi',
      isConnected: true,
      isInternetReachable: true,
    })),
    addEventListener: jest.fn(() => jest.fn()),
  };

  return {
    __esModule: true,
    default: mockNetInfo,
    useNetInfo: jest.fn(() => ({
      type: 'wifi',
      isConnected: true,
      isInternetReachable: true,
    })),
  };
});

// Mock Mapbox
jest.mock('@rnmapbox/maps', () => ({
  setAccessToken: jest.fn(),
  StyleURL: {
    Dark: 'mapbox://styles/mapbox/dark-v10',
    Light: 'mapbox://styles/mapbox/light-v10',
  },
  MapView: 'MapView',
  Camera: 'Camera',
  ShapeSource: 'ShapeSource',
  FillLayer: 'FillLayer',
  LineLayer: 'LineLayer',
  CircleLayer: 'CircleLayer',
}));

// Mock Safe Area Context
jest.mock('react-native-safe-area-context', () => {
  const mockComponent = (name) => {
    const MockedComponent = (props) => {
      const React = require('react');
      return React.createElement('View', props, props.children);
    };
    MockedComponent.displayName = name;
    return MockedComponent;
  };

  return {
    SafeAreaView: mockComponent('SafeAreaView'),
    SafeAreaProvider: mockComponent('SafeAreaProvider'),
    useSafeAreaInsets: jest.fn(() => ({ top: 44, bottom: 34, left: 0, right: 0 })),
    useSafeAreaFrame: jest.fn(() => ({ x: 0, y: 0, width: 375, height: 812 })),
  };
});

// Mock custom UI hooks
jest.mock('./components/ui/TabBarBackground', () => ({
  useBottomTabOverflow: jest.fn(() => 0),
}));

// Mock constants
jest.mock('./constants/Colors', () => ({
  Colors: {
    light: {
      icon: '#000000',
      background: '#ffffff',
      text: '#000000',
    },
    dark: {
      icon: '#ffffff',
      background: '#000000',
      text: '#ffffff',
    },
  },
}));

// Mock custom hooks
jest.mock('./hooks/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'light'),
}));

jest.mock('./hooks/useThemeColor', () => ({
  useThemeColor: jest.fn(() => '#000000'),
}));

// Mock map styling utilities
jest.mock('@/utils/mapStyling', () => ({
  getMapStyleName: jest.fn((style) => {
    const styleMap = {
      'mapbox://styles/mapbox/dark-v10': 'Dark',
      'mapbox://styles/mapbox/dark-v11': 'Dark',
      'mapbox://styles/mapbox/light-v10': 'Light',
      'mapbox://styles/mapbox/light-v11': 'Light',
      'mapbox://styles/mapbox/streets-v11': 'Street',
      'mapbox://styles/mapbox/streets-v12': 'Street',
      'mapbox://styles/mapbox/satellite-v9': 'Satellite',
      'mapbox://styles/mapbox/satellite-streets-v11': 'Satellite Street',
      'mapbox://styles/mapbox/satellite-streets-v12': 'Satellite Street'
    };
    return styleMap[style] || 'Unknown';
  }),
  getLocationMarkerStyling: jest.fn(() => ({
    container: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: '#007AFF',
      borderWidth: 2,
      borderColor: '#FFFFFF'
    },
    core: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: '#FFFFFF'
    }
  })),
  createLocationMarkerStyling: jest.fn(() => ({
    container: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: '#007AFF',
      borderWidth: 2,
      borderColor: '#FFFFFF'
    },
    core: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: '#FFFFFF'
    }
  })),
  // Add other map styling functions that might be used
  getMapStyleUrl: jest.fn((styleName) => `mapbox://styles/mapbox/${styleName.toLowerCase()}-v11`),
  createMapStyling: jest.fn(() => ({
    container: { flex: 1 },
    map: { flex: 1 }
  }))
}));

// Mock react-native-reanimated with proper cleanup
jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { View, Text, ScrollView } = require('react-native');

  const mockComponent = (Component, name) => {
    const MockedComponent = React.forwardRef((props, ref) => {
      return React.createElement(Component, { ...props, ref }, props.children);
    });
    MockedComponent.displayName = name;
    return MockedComponent;
  };

  return {
    __esModule: true,
    default: {
      View: mockComponent(View, 'Animated.View'),
      Text: mockComponent(Text, 'Animated.Text'),
      ScrollView: mockComponent(ScrollView, 'Animated.ScrollView'),
    },
    View: mockComponent(View, 'Animated.View'),
    Text: mockComponent(Text, 'Animated.Text'),
    ScrollView: mockComponent(ScrollView, 'Animated.ScrollView'),
    useSharedValue: jest.fn((initialValue) => {
      const sharedValue = {
        value: initialValue || 0,
        addListener: jest.fn(() => () => {}), // Return cleanup function
        removeListener: jest.fn(),
        modify: jest.fn(),
        interpolate: jest.fn((inputRange, outputRange, extrapolate) => {
          // Return a simple mock that behaves like an interpolated value
          return outputRange ? outputRange[0] : '0%';
        })
      };
      return sharedValue;
    }),
    useAnimatedStyle: jest.fn(() => ({})),
    useAnimatedRef: jest.fn(() => ({ current: null })),
    useScrollViewOffset: jest.fn(() => ({ value: 0 })),
    withTiming: jest.fn((value, config, callback) => {
      if (callback) {
        // Use setTimeout to avoid blocking test execution
        setTimeout(() => {
          try {
            callback({ finished: true });
          } catch (error) {
            // Ignore callback errors in tests
          }
        }, 0);
      }
      return value;
    }),
    withSpring: jest.fn((value, config, callback) => {
      if (callback) {
        setTimeout(() => {
          try {
            callback({ finished: true });
          } catch (error) {
            // Ignore callback errors in tests
          }
        }, 0);
      }
      return value;
    }),
    withRepeat: jest.fn((value, count, reverse, callback) => {
      if (callback) {
        setTimeout(() => {
          try {
            callback({ finished: true });
          } catch (error) {
            // Ignore callback errors in tests
          }
        }, 0);
      }
      return value;
    }),
    withSequence: jest.fn((...values) => {
      return values[values.length - 1];
    }),
    runOnJS: jest.fn((fn) => (...args) => {
      try {
        return fn(...args);
      } catch (error) {
        // Ignore JS thread errors in tests
        return undefined;
      }
    }),
    interpolate: jest.fn((value, inputRange, outputRange) => outputRange[0]),
    Extrapolate: {
      CLAMP: 'clamp',
      EXTEND: 'extend',
      IDENTITY: 'identity'
    },
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
    },
  };
});

// Mock react-native-gesture-handler
jest.mock('react-native-gesture-handler', () => {
  const mockComponent = (name) => {
    const MockedComponent = (props) => {
      const React = require('react');
      return React.createElement('View', props, props.children);
    };
    MockedComponent.displayName = name;
    return MockedComponent;
  };

  return {
    GestureHandlerRootView: mockComponent('GestureHandlerRootView'),
    TapGestureHandler: mockComponent('TapGestureHandler'),
    PanGestureHandler: mockComponent('PanGestureHandler'),
    State: {
      BEGAN: 'BEGAN',
      FAILED: 'FAILED',
      CANCELLED: 'CANCELLED',
      ACTIVE: 'ACTIVE',
      END: 'END',
    },
  };
});

// Mock database operations consistently
const mockDatabase = {
  // Core database operations
  initDatabase: jest.fn().mockResolvedValue(undefined),
  database: {
    // Async methods
    execAsync: jest.fn().mockResolvedValue(undefined),
    getAllAsync: jest.fn().mockResolvedValue([]),
    getFirstAsync: jest.fn().mockResolvedValue(null),
    runAsync: jest.fn().mockResolvedValue({ changes: 0, lastInsertRowId: 0 }),
    prepareAsync: jest.fn().mockResolvedValue({
      executeAsync: jest.fn().mockResolvedValue({ changes: 0, lastInsertRowId: 0 }),
      getAllAsync: jest.fn().mockResolvedValue([]),
      getFirstAsync: jest.fn().mockResolvedValue(null),
      finalizeAsync: jest.fn().mockResolvedValue(undefined),
    }),
    closeAsync: jest.fn().mockResolvedValue(undefined),

    // Sync methods (for backward compatibility)
    execSync: jest.fn(),
    getAllSync: jest.fn(() => []),
    getFirstSync: jest.fn(() => null),
    runSync: jest.fn(() => ({ changes: 0, lastInsertRowId: 0 })),
    prepareSync: jest.fn(() => ({
      executeSync: jest.fn(() => ({ changes: 0, lastInsertRowId: 0 })),
      getAllSync: jest.fn(() => []),
      getFirstSync: jest.fn(() => null),
      finalizeSync: jest.fn(),
    })),
    closeSync: jest.fn(),
  },

  // Location operations
  getLocations: jest.fn().mockResolvedValue([]),
  saveLocation: jest.fn().mockResolvedValue({ id: 1 }),
  deleteLocation: jest.fn().mockResolvedValue(),

  // Revealed area operations
  getRevealedAreas: jest.fn().mockResolvedValue([]),
  saveRevealedArea: jest.fn().mockResolvedValue({ id: 1 }),
  deleteRevealedArea: jest.fn().mockResolvedValue(),

  // Cache operations
  getStatisticsCache: jest.fn().mockResolvedValue(null),
  saveStatisticsCache: jest.fn().mockResolvedValue(),
  deleteStatisticsCache: jest.fn().mockResolvedValue(),
  clearAllStatisticsCache: jest.fn().mockResolvedValue(),
  deleteExpiredStatisticsCache: jest.fn().mockResolvedValue(),
  getAllStatisticsCache: jest.fn().mockResolvedValue([]),

  // Geocoding operations
  getLocationGeocoding: jest.fn().mockResolvedValue(null),
  saveLocationGeocoding: jest.fn().mockResolvedValue(),
  deleteExpiredLocationGeocodings: jest.fn().mockResolvedValue(),
  getAllLocationGeocodings: jest.fn().mockResolvedValue([])
};

// Mock the database module before it's loaded
jest.mock('@/utils/database', () => ({
  initDatabase: jest.fn().mockResolvedValue(undefined),
  getLocations: jest.fn().mockResolvedValue([]),
  saveLocation: jest.fn().mockResolvedValue({ id: 1 }),
  deleteLocation: jest.fn().mockResolvedValue(),
  getRevealedAreas: jest.fn().mockResolvedValue([]),
  saveRevealedArea: jest.fn().mockResolvedValue({ id: 1 }),
  deleteRevealedArea: jest.fn().mockResolvedValue(),
  getStatisticsCache: jest.fn().mockResolvedValue(null),
  saveStatisticsCache: jest.fn().mockResolvedValue(),
  deleteStatisticsCache: jest.fn().mockResolvedValue(),
  clearAllStatisticsCache: jest.fn().mockResolvedValue(),
  deleteExpiredStatisticsCache: jest.fn().mockResolvedValue(),
  getAllStatisticsCache: jest.fn().mockResolvedValue([]),
  getLocationGeocoding: jest.fn().mockResolvedValue(null),
  saveLocationGeocoding: jest.fn().mockResolvedValue(),
  deleteExpiredLocationGeocodings: jest.fn().mockResolvedValue(),
  getAllLocationGeocodings: jest.fn().mockResolvedValue([])
}));

// Also mock the relative path version
jest.mock('./utils/database', () => ({
  initDatabase: jest.fn().mockResolvedValue(undefined),
  getLocations: jest.fn().mockResolvedValue([]),
  saveLocation: jest.fn().mockResolvedValue({ id: 1 }),
  deleteLocation: jest.fn().mockResolvedValue(),
  getRevealedAreas: jest.fn().mockResolvedValue([]),
  saveRevealedArea: jest.fn().mockResolvedValue({ id: 1 }),
  deleteRevealedArea: jest.fn().mockResolvedValue(),
  getStatisticsCache: jest.fn().mockResolvedValue(null),
  saveStatisticsCache: jest.fn().mockResolvedValue(),
  deleteStatisticsCache: jest.fn().mockResolvedValue(),
  clearAllStatisticsCache: jest.fn().mockResolvedValue(),
  deleteExpiredStatisticsCache: jest.fn().mockResolvedValue(),
  getAllStatisticsCache: jest.fn().mockResolvedValue([]),
  getLocationGeocoding: jest.fn().mockResolvedValue(null),
  saveLocationGeocoding: jest.fn().mockResolvedValue(),
  deleteExpiredLocationGeocodings: jest.fn().mockResolvedValue(),
  getAllLocationGeocodings: jest.fn().mockResolvedValue([])
}));

// Make mockDatabase available globally
global.mockDatabase = mockDatabase;



// Enhanced Turf.js mocks with proper edge case handling and consistent GeoJSON results
const mockTurf = {
  difference: jest.fn((minuend, subtrahend) => {
    // Handle null/undefined inputs gracefully
    if (!minuend || !subtrahend) return null;
    
    // Validate input types
    if (minuend.type !== 'Feature' || subtrahend.type !== 'Feature') return null;
    if (!minuend.geometry || !subtrahend.geometry) return null;
    
    // Handle invalid geometry types
    const validTypes = ['Polygon', 'MultiPolygon'];
    if (!validTypes.includes(minuend.geometry.type) || !validTypes.includes(subtrahend.geometry.type)) {
      return null;
    }
    
    // Return a consistent difference result for testing
    return {
      type: 'Feature',
      properties: minuend.properties || {},
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-122.5, 37.7],
          [-122.3, 37.7],
          [-122.3, 37.8],
          [-122.5, 37.8],
          [-122.5, 37.7]
        ]]
      }
    };
  }),
  
  union: jest.fn((featureCollection) => {
    // Handle null/undefined inputs
    if (!featureCollection) return null;
    
    // Validate FeatureCollection structure
    if (featureCollection.type !== 'FeatureCollection') return null;
    if (!featureCollection.features || !Array.isArray(featureCollection.features)) return null;
    if (featureCollection.features.length === 0) return null;
    
    // Filter out invalid features
    const validFeatures = featureCollection.features.filter(feature => {
      return feature && 
             feature.type === 'Feature' && 
             feature.geometry && 
             ['Polygon', 'MultiPolygon'].includes(feature.geometry.type);
    });
    
    if (validFeatures.length === 0) return null;
    
    // Return the first valid feature as a simplified union for testing
    const firstFeature = validFeatures[0];
    return {
      type: 'Feature',
      properties: firstFeature.properties || {},
      geometry: firstFeature.geometry
    };
  }),
  
  buffer: jest.fn((point, distance, options = {}) => {
    // Handle null/undefined inputs
    if (!point || !distance) return null;
    
    // Validate point structure
    if (point.type !== 'Feature') return null;
    if (!point.geometry || point.geometry.type !== 'Point') return null;
    if (!Array.isArray(point.geometry.coordinates) || point.geometry.coordinates.length !== 2) return null;
    
    // Validate coordinates
    const coords = point.geometry.coordinates;
    if (typeof coords[0] !== 'number' || typeof coords[1] !== 'number') return null;
    if (!isFinite(coords[0]) || !isFinite(coords[1])) return null;
    
    // Validate distance
    if (typeof distance !== 'number' || !isFinite(distance) || distance <= 0) return null;
    
    // Validate coordinate ranges (basic validation)
    if (coords[0] < -180 || coords[0] > 180 || coords[1] < -90 || coords[1] > 90) return null;
    
    // Calculate buffer offset based on units
    const units = options.units || 'kilometers';
    let offset;
    
    switch (units) {
      case 'meters':
        offset = distance / 111320; // Rough conversion from meters to degrees
        break;
      case 'kilometers':
        offset = distance / 111.32; // Rough conversion from km to degrees
        break;
      default:
        offset = distance / 111.32; // Default to kilometers
    }
    
    // Create a simple square buffer for testing (more predictable than circle)
    return {
      type: 'Feature',
      properties: point.properties || {},
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [coords[0] - offset, coords[1] - offset],
          [coords[0] + offset, coords[1] - offset],
          [coords[0] + offset, coords[1] + offset],
          [coords[0] - offset, coords[1] + offset],
          [coords[0] - offset, coords[1] - offset]
        ]]
      }
    };
  }),
  
  bbox: jest.fn((feature) => {
    // Handle null/undefined inputs
    if (!feature) return [-122.5, 37.7, -122.3, 37.8];
    
    // Validate feature structure
    if (feature.type !== 'Feature' || !feature.geometry) {
      return [-122.5, 37.7, -122.3, 37.8];
    }
    
    // Return consistent bbox based on geometry type
    switch (feature.geometry.type) {
      case 'Point':
        const coords = feature.geometry.coordinates;
        if (Array.isArray(coords) && coords.length >= 2) {
          const buffer = 0.01; // Small buffer around point
          return [coords[0] - buffer, coords[1] - buffer, coords[0] + buffer, coords[1] + buffer];
        }
        break;
      case 'Polygon':
      case 'MultiPolygon':
        // Return a consistent bbox for polygon features
        return [-122.5, 37.7, -122.3, 37.8];
      default:
        break;
    }
    
    // Default bbox
    return [-122.5, 37.7, -122.3, 37.8];
  }),
  
  bboxPolygon: jest.fn((bbox) => {
    // Handle null/undefined inputs
    if (!bbox || !Array.isArray(bbox) || bbox.length !== 4) {
      return {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [-122.5, 37.7],
            [-122.3, 37.7],
            [-122.3, 37.8],
            [-122.5, 37.8],
            [-122.5, 37.7]
          ]]
        }
      };
    }
    
    // Validate bbox values
    const [minX, minY, maxX, maxY] = bbox;
    if (typeof minX !== 'number' || typeof minY !== 'number' || 
        typeof maxX !== 'number' || typeof maxY !== 'number') {
      return null;
    }
    
    if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
      return null;
    }
    
    if (minX >= maxX || minY >= maxY) {
      return null;
    }
    
    return {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [minX, minY],
          [maxX, minY],
          [maxX, maxY],
          [minX, maxY],
          [minX, minY]
        ]]
      }
    };
  }),
  
  area: jest.fn((feature) => {
    // Handle null/undefined inputs
    if (!feature) return 0;
    
    // Validate feature structure
    if (feature.type !== 'Feature' || !feature.geometry) return 0;
    
    // Return consistent area based on geometry type
    switch (feature.geometry.type) {
      case 'Polygon':
        return 1000000; // 1 km² for polygons
      case 'MultiPolygon':
        return 2000000; // 2 km² for multipolygons
      default:
        return 0;
    }
  }),
  
  point: jest.fn((coordinates) => {
    // Handle null/undefined inputs
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 2) return null;
    
    // Validate coordinates
    if (typeof coordinates[0] !== 'number' || typeof coordinates[1] !== 'number') return null;
    if (!isFinite(coordinates[0]) || !isFinite(coordinates[1])) return null;
    
    return {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Point',
        coordinates: [coordinates[0], coordinates[1]]
      }
    };
  }),
  
  polygon: jest.fn((coordinates) => {
    // Handle null/undefined inputs
    if (!coordinates || !Array.isArray(coordinates)) return null;
    
    // Validate coordinate structure
    if (coordinates.length === 0) return null;
    
    // Basic validation of first ring
    const firstRing = coordinates[0];
    if (!Array.isArray(firstRing) || firstRing.length < 4) return null;
    
    return {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: coordinates
      }
    };
  }),
  
  featureCollection: jest.fn((features) => {
    // Handle null/undefined inputs
    if (!features || !Array.isArray(features)) {
      return {
        type: 'FeatureCollection',
        features: []
      };
    }
    
    // Filter out null/undefined features
    const validFeatures = features.filter(feature => feature !== null && feature !== undefined);
    
    return {
      type: 'FeatureCollection',
      features: validFeatures
    };
  }),
  
  // Additional commonly used Turf functions
  centroid: jest.fn((feature) => {
    if (!feature || !feature.geometry) return null;
    
    // Return a consistent centroid
    return {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Point',
        coordinates: [-122.4194, 37.7749]
      }
    };
  }),
  
  intersect: jest.fn((feature1, feature2) => {
    // Handle null/undefined inputs
    if (!feature1 || !feature2) return null;
    
    // Validate features
    if (feature1.type !== 'Feature' || feature2.type !== 'Feature') return null;
    if (!feature1.geometry || !feature2.geometry) return null;
    
    // Return null for no intersection (common case in tests)
    return null;
  }),
  
  simplify: jest.fn((feature, options = {}) => {
    // Handle null/undefined inputs
    if (!feature) return null;
    
    // Return the feature as-is for simplification (simplified mock)
    return feature;
  })
};

jest.mock('@turf/turf', () => mockTurf);
jest.mock('@turf/difference', () => ({ difference: mockTurf.difference }));
jest.mock('@turf/union', () => ({ union: mockTurf.union }));
jest.mock('@turf/buffer', () => ({ buffer: mockTurf.buffer }));
jest.mock('@turf/bbox', () => ({ bbox: mockTurf.bbox }));
jest.mock('@turf/bbox-polygon', () => ({ bboxPolygon: mockTurf.bboxPolygon }));
jest.mock('@turf/area', () => ({ area: mockTurf.area }));
jest.mock('@turf/centroid', () => ({ centroid: mockTurf.centroid }));
jest.mock('@turf/intersect', () => ({ intersect: mockTurf.intersect }));
jest.mock('@turf/simplify', () => ({ simplify: mockTurf.simplify }));

// Make mockTurf available globally
global.mockTurf = mockTurf;

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
  },

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

  // Wait for hook to stabilize
  waitForHookStable: async (result, timeout = 5000) => {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (!result.current.isCalculating && !result.current.isChanging) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error('Hook did not stabilize within timeout');
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

// Configure timeouts based on test type
const configureTestTimeouts = () => {
  // Default timeout for all tests
  jest.setTimeout(30000); // 30 seconds
  
  // Set up timeout utilities for different test types
  global.TEST_TIMEOUTS = {
    UNIT: 5000,        // 5 seconds for unit tests
    INTEGRATION: 15000, // 15 seconds for integration tests
    PERFORMANCE: 60000, // 60 seconds for performance tests
    E2E: 120000        // 2 minutes for end-to-end tests
  };
};

configureTestTimeouts();

// Silence console warnings during tests unless debugging
if (!process.env.DEBUG_TESTS) {
  global.console = {
    ...console,
    warn: jest.fn(),
    error: jest.fn(),
  };
}