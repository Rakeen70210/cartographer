// Jest setup file
import 'react-native-gesture-handler/jestSetup';

// Define __DEV__ for test environment
global.__DEV__ = true;

// Mock logger FIRST to ensure it's available everywhere
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  success: jest.fn()
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

// Mock TurboModuleRegistry to prevent DevMenu errors
jest.mock('react-native/Libraries/TurboModule/TurboModuleRegistry', () => ({
  get: jest.fn(() => null),
  getEnforcing: jest.fn(() => ({})),
}));

// Mock react-native modules more comprehensively
jest.mock('react-native', () => {
  const mockComponent = (name) => {
    const MockedComponent = (props) => {
      const React = require('react');
      return React.createElement(name, props, props.children);
    };
    MockedComponent.displayName = name;
    return MockedComponent;
  };

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
      Value: jest.fn(() => ({
        setValue: jest.fn(),
        addListener: jest.fn(),
        removeListener: jest.fn(),
        removeAllListeners: jest.fn(),
        stopAnimation: jest.fn(),
        resetAnimation: jest.fn(),
        interpolate: jest.fn(() => ({
          setValue: jest.fn(),
          addListener: jest.fn(),
          removeListener: jest.fn(),
          removeAllListeners: jest.fn(),
          stopAnimation: jest.fn(),
          resetAnimation: jest.fn(),
        })),
      })),
      timing: jest.fn(() => ({
        start: jest.fn(),
        stop: jest.fn(),
        reset: jest.fn(),
      })),
      spring: jest.fn(() => ({
        start: jest.fn(),
        stop: jest.fn(),
        reset: jest.fn(),
      })),
      sequence: jest.fn(() => ({
        start: jest.fn(),
        stop: jest.fn(),
        reset: jest.fn(),
      })),
      parallel: jest.fn(() => ({
        start: jest.fn(),
        stop: jest.fn(),
        reset: jest.fn(),
      })),
      loop: jest.fn(() => ({
        start: jest.fn(),
        stop: jest.fn(),
        reset: jest.fn(),
      })),
      createAnimatedComponent: jest.fn((component) => component),
    },
    Dimensions: {
      get: jest.fn(() => ({ width: 375, height: 812 })),
      addEventListener: jest.fn(),
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
      announceForAccessibility: jest.fn(),
    },
  };
});

// Mock expo modules that might be used in components
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

jest.mock('@react-navigation/bottom-tabs', () => ({
  useBottomTabBarHeight: jest.fn(() => 80),
}));

jest.mock('@react-navigation/elements', () => ({
  PlatformPressable: 'PlatformPressable',
}));

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

// Mock react-native-reanimated
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
    useSharedValue: jest.fn(() => ({ 
      value: 0,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      modify: jest.fn()
    })),
    useAnimatedStyle: jest.fn(() => ({})),
    useAnimatedRef: jest.fn(() => ({ current: null })),
    useScrollViewOffset: jest.fn(() => ({ value: 0 })),
    withTiming: jest.fn((value, config, callback) => {
      if (callback) setTimeout(callback, 0);
      return value;
    }),
    withSpring: jest.fn((value, config, callback) => {
      if (callback) setTimeout(callback, 0);
      return value;
    }),
    withRepeat: jest.fn((value, count, reverse, callback) => {
      if (callback) setTimeout(callback, 0);
      return value;
    }),
    withSequence: jest.fn((...values) => {
      return values[values.length - 1];
    }),
    runOnJS: jest.fn((fn) => (...args) => fn(...args)),
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

// Mock custom hooks
jest.mock('./hooks/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'light'),
}));

jest.mock('./hooks/useThemeColor', () => ({
  useThemeColor: jest.fn(() => '#000000'),
}));



// Mock Expo modules
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
  isTaskRegisteredAsync: jest.fn(),
}));

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn(() => ({
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

// Mock react-native-safe-area-context
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

// Silence console warnings during tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
};