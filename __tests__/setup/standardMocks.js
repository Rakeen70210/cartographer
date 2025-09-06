/**
 * Standardized mock factory for consistent mock implementations across all tests
 * This ensures all tests use the same mock behaviors and return values
 */

import {
  createMockNetworkState,
  createMockOfflineCapabilities,
  createMockStatisticsData,
  TEST_CONSTANTS
} from './testSetup.js';

// Standardized database mocks - extends the global mockDatabase with enhanced behaviors
export const createStandardDatabaseMocks = () => {
  // Use the enhanced database mock from __mocks__/@/utils/database.js
  const enhancedDatabaseMock = require('../__mocks__/@/utils/database');
  
  // Start with the global database mock as base
  const baseMock = global.mockDatabase || {};
  
  const combinedMock = {
    // Start with enhanced implementations from the dedicated mock file
    ...enhancedDatabaseMock,
    // Then override with any global mock functions that might be more specific
    ...baseMock,
    
    // Add test-specific utilities
    _setupTestScenario: (scenario) => {
      switch (scenario) {
        case 'empty':
          if (enhancedDatabaseMock._resetMockStorage) {
            enhancedDatabaseMock._resetMockStorage();
          }
          break;
        case 'small':
          if (enhancedDatabaseMock._resetMockStorage) {
            enhancedDatabaseMock._resetMockStorage();
          }
          if (enhancedDatabaseMock._populateWithTestData) {
            enhancedDatabaseMock._populateWithTestData('small');
          }
          break;
        case 'medium':
          if (enhancedDatabaseMock._resetMockStorage) {
            enhancedDatabaseMock._resetMockStorage();
          }
          if (enhancedDatabaseMock._populateWithTestData) {
            enhancedDatabaseMock._populateWithTestData('medium');
          }
          break;
        case 'large':
          if (enhancedDatabaseMock._resetMockStorage) {
            enhancedDatabaseMock._resetMockStorage();
          }
          if (enhancedDatabaseMock._populateWithTestData) {
            enhancedDatabaseMock._populateWithTestData('large');
          }
          break;
        default:
          if (enhancedDatabaseMock._resetMockStorage) {
            enhancedDatabaseMock._resetMockStorage();
          }
      }
    },
    
    // Error simulation helpers
    _simulateError: (operation, errorType = 'generic') => {
      const errors = {
        generic: new Error('Database operation failed'),
        timeout: new Error('Database timeout'),
        constraint: new Error('Database constraint violation'),
        connection: new Error('Database connection failed'),
        corruption: new Error('Database file is corrupted')
      };
      
      const error = errors[errorType] || errors.generic;
      
      // Temporarily override the specified operation to throw error
      const originalMethod = combinedMock[operation];
      if (originalMethod) {
        combinedMock[operation] = jest.fn().mockRejectedValue(error);
        
        // Return cleanup function to restore original behavior
        return () => {
          combinedMock[operation] = originalMethod;
        };
      }
      
      return () => {}; // No-op cleanup if method doesn't exist
    }
  };
  
  return combinedMock;
};

// Standardized network utility mocks with enhanced error handling
export const createStandardNetworkMocks = () => {
  let mockNetworkState = createMockNetworkState();
  let connectivityFailureRate = 0; // 0 = never fail, 1 = always fail
  let latencySimulation = 0; // milliseconds to simulate network delay
  
  return {
    testConnectivity: jest.fn().mockImplementation(async () => {
      // Simulate network delay
      if (latencySimulation > 0) {
        await new Promise(resolve => setTimeout(resolve, latencySimulation));
      }
      
      // Simulate connectivity failures based on failure rate
      if (Math.random() < connectivityFailureRate) {
        throw new Error('Network connectivity test failed');
      }
      
      return mockNetworkState.isConnected;
    }),
    
    getCurrentState: jest.fn().mockImplementation(async () => {
      if (latencySimulation > 0) {
        await new Promise(resolve => setTimeout(resolve, latencySimulation));
      }
      return { ...mockNetworkState };
    }),
    
    isOffline: jest.fn().mockImplementation(async () => {
      return !mockNetworkState.isConnected;
    }),
    
    getConnectionQuality: jest.fn().mockImplementation(async () => {
      if (!mockNetworkState.isConnected) return 'none';
      
      // Simulate different connection qualities based on type
      const qualityMap = {
        'wifi': ['excellent', 'good', 'fair'][Math.floor(Math.random() * 3)],
        'cellular': ['good', 'fair', 'poor'][Math.floor(Math.random() * 3)],
        'ethernet': 'excellent',
        'none': 'none',
        'unknown': 'unknown'
      };
      
      return qualityMap[mockNetworkState.type] || 'unknown';
    }),
    
    waitForConnection: jest.fn().mockImplementation(async (timeout = 5000) => {
      if (mockNetworkState.isConnected) return true;
      
      // Simulate waiting for connection with timeout
      return new Promise((resolve) => {
        const checkInterval = 100;
        let elapsed = 0;
        
        const check = () => {
          elapsed += checkInterval;
          if (mockNetworkState.isConnected) {
            resolve(true);
          } else if (elapsed >= timeout) {
            resolve(false);
          } else {
            setTimeout(check, checkInterval);
          }
        };
        
        setTimeout(check, checkInterval);
      });
    }),
    
    addListener: jest.fn().mockImplementation((callback) => {
      // Return unsubscribe function
      return jest.fn(() => {
        // Cleanup logic would go here
      });
    }),
    
    withOfflineFallback: jest.fn().mockImplementation(async (onlineFunc, offlineFunc) => {
      try {
        // Simulate network delay
        if (latencySimulation > 0) {
          await new Promise(resolve => setTimeout(resolve, latencySimulation));
        }
        
        // Check if we should simulate being offline
        if (!mockNetworkState.isConnected || Math.random() < connectivityFailureRate) {
          throw new Error('Network unavailable');
        }
        
        const result = await onlineFunc();
        return { result, wasOffline: false };
      } catch (error) {
        if (offlineFunc) {
          const result = await offlineFunc();
          return { result, wasOffline: true };
        }
        throw error;
      }
    }),
    
    retryWithBackoff: jest.fn().mockImplementation(async (fn, maxRetries = 3, baseDelay = 1000) => {
      let lastError;
      
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          // Simulate network delay
          if (latencySimulation > 0) {
            await new Promise(resolve => setTimeout(resolve, latencySimulation));
          }
          
          return await fn();
        } catch (error) {
          lastError = error;
          
          if (attempt < maxRetries) {
            // Exponential backoff
            const delay = baseDelay * Math.pow(2, attempt);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      
      throw lastError;
    }),
    
    // Test utilities for controlling mock behavior
    _setNetworkState: (state) => {
      mockNetworkState = { ...mockNetworkState, ...state };
    },
    
    _setConnectivityFailureRate: (rate) => {
      connectivityFailureRate = Math.max(0, Math.min(1, rate));
    },
    
    _setLatencySimulation: (ms) => {
      latencySimulation = Math.max(0, ms);
    },
    
    _simulateNetworkChange: (newState) => {
      const oldState = { ...mockNetworkState };
      mockNetworkState = { ...mockNetworkState, ...newState };
      return oldState;
    },
    
    _reset: () => {
      mockNetworkState = createMockNetworkState();
      connectivityFailureRate = 0;
      latencySimulation = 0;
    }
  };
};

// Standardized calculation mocks - import from the new mock files
const distanceCalculatorMock = require('../__mocks__/@/utils/distanceCalculator');
const worldExplorationCalculatorMock = require('../__mocks__/@/utils/worldExplorationCalculator');

export const createStandardCalculationMocks = () => ({
  // Distance calculator - use the comprehensive mock
  ...distanceCalculatorMock,
  
  // World exploration calculator - use the comprehensive mock
  ...worldExplorationCalculatorMock,
  
  // Geographic hierarchy
  buildGeographicHierarchy: jest.fn().mockResolvedValue([]),
  calculateExplorationPercentages: jest.fn().mockResolvedValue([]),
  convertToLocationWithGeography: jest.fn().mockResolvedValue([]),
  
  // Remaining regions service
  getRemainingRegionsData: jest.fn().mockResolvedValue({
    visited: { countries: 0, states: 0, cities: 0 },
    total: { 
      countries: TEST_CONSTANTS.TOTAL_COUNTRIES, 
      states: TEST_CONSTANTS.TOTAL_STATES, 
      cities: TEST_CONSTANTS.TOTAL_CITIES 
    },
    remaining: { 
      countries: TEST_CONSTANTS.TOTAL_COUNTRIES, 
      states: TEST_CONSTANTS.TOTAL_STATES, 
      cities: TEST_CONSTANTS.TOTAL_CITIES 
    },
    percentageVisited: { countries: 0, states: 0, cities: 0 }
  })
});

// Standardized hook mocks with realistic state management
export const createStandardHookMocks = () => {
  // Shared state for hooks to simulate realistic behavior
  let statisticsState = {
    data: createMockStatisticsData(),
    isLoading: false,
    isRefreshing: false,
    error: null,
    isOffline: false,
    networkStatus: createMockNetworkState(),
    offlineCapabilities: createMockOfflineCapabilities()
  };
  
  let locationState = {
    location: {
      latitude: TEST_CONSTANTS.DEFAULT_LATITUDE,
      longitude: TEST_CONSTANTS.DEFAULT_LONGITUDE,
      accuracy: 5,
      timestamp: Date.now()
    },
    isTracking: false,
    error: null,
    permissionStatus: 'granted'
  };
  
  return {
    useOfflineStatistics: jest.fn().mockImplementation(() => ({
      ...statisticsState,
      refreshData: jest.fn().mockImplementation(async () => {
        statisticsState.isRefreshing = true;
        
        // Simulate async operation
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Simulate potential network error
        if (statisticsState.isOffline && Math.random() < 0.3) {
          statisticsState.error = new Error('Network unavailable');
        } else {
          statisticsState.error = null;
          statisticsState.data = createMockStatisticsData({
            lastUpdated: Date.now()
          });
        }
        
        statisticsState.isRefreshing = false;
      }),
      
      toggleHierarchyNode: jest.fn().mockImplementation((nodeId) => {
        // Simulate toggling hierarchy node expansion
        if (statisticsState.data.hierarchicalBreakdown) {
          const node = statisticsState.data.hierarchicalBreakdown.find(n => n.id === nodeId);
          if (node) {
            node.isExpanded = !node.isExpanded;
          }
        }
      }),
      
      retryConnection: jest.fn().mockImplementation(async () => {
        statisticsState.isLoading = true;
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Simulate connection retry success/failure
        const success = Math.random() > 0.2; // 80% success rate
        if (success) {
          statisticsState.isOffline = false;
          statisticsState.networkStatus.isConnected = true;
          statisticsState.error = null;
        } else {
          statisticsState.error = new Error('Connection retry failed');
        }
        
        statisticsState.isLoading = false;
        return success;
      }),
      
      forceOfflineMode: jest.fn().mockImplementation(() => {
        statisticsState.isOffline = true;
        statisticsState.networkStatus.isConnected = false;
        statisticsState.networkStatus.type = 'none';
      }),
      
      forceOnlineMode: jest.fn().mockImplementation(() => {
        statisticsState.isOffline = false;
        statisticsState.networkStatus.isConnected = true;
        statisticsState.networkStatus.type = 'wifi';
      }),
      
      clearCache: jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        // Reset to default data after cache clear
        statisticsState.data = createMockStatisticsData();
      })
    })),
    
    useThemeColor: jest.fn().mockImplementation((props, colorName) => {
      // Simulate theme color selection based on color scheme
      const colorScheme = 'light'; // Could be made dynamic
      const colors = {
        light: {
          text: '#000000',
          background: '#ffffff',
          tint: '#007AFF',
          icon: '#687076',
          tabIconDefault: '#687076',
          tabIconSelected: '#007AFF'
        },
        dark: {
          text: '#ffffff',
          background: '#000000',
          tint: '#0A84FF',
          icon: '#9BA1A6',
          tabIconDefault: '#9BA1A6',
          tabIconSelected: '#0A84FF'
        }
      };
      
      return colors[colorScheme][colorName] || colors[colorScheme].text;
    }),
    
    useLocationTracking: jest.fn().mockImplementation(() => ({
      ...locationState,
      
      startTracking: jest.fn().mockImplementation(async () => {
        // Simulate permission check
        if (locationState.permissionStatus !== 'granted') {
          locationState.error = new Error('Location permission not granted');
          return false;
        }
        
        locationState.isTracking = true;
        locationState.error = null;
        
        // Simulate getting initial location
        await new Promise(resolve => setTimeout(resolve, 100));
        
        locationState.location = {
          latitude: TEST_CONSTANTS.DEFAULT_LATITUDE + (Math.random() - 0.5) * 0.01,
          longitude: TEST_CONSTANTS.DEFAULT_LONGITUDE + (Math.random() - 0.5) * 0.01,
          accuracy: 5 + Math.random() * 10,
          timestamp: Date.now()
        };
        
        return true;
      }),
      
      stopTracking: jest.fn().mockImplementation(() => {
        locationState.isTracking = false;
      }),
      
      requestPermission: jest.fn().mockImplementation(async () => {
        // Simulate permission request
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Simulate different permission outcomes
        const outcomes = ['granted', 'denied', 'never_ask_again'];
        const outcome = outcomes[Math.floor(Math.random() * outcomes.length)];
        
        locationState.permissionStatus = outcome;
        
        if (outcome !== 'granted') {
          locationState.error = new Error(`Location permission ${outcome}`);
        }
        
        return outcome;
      })
    })),
    
    // Test utilities for controlling hook state
    _setStatisticsState: (newState) => {
      statisticsState = { ...statisticsState, ...newState };
    },
    
    _setLocationState: (newState) => {
      locationState = { ...locationState, ...newState };
    },
    
    _simulateNetworkChange: (isOnline) => {
      statisticsState.isOffline = !isOnline;
      statisticsState.networkStatus.isConnected = isOnline;
      statisticsState.networkStatus.type = isOnline ? 'wifi' : 'none';
    },
    
    _reset: () => {
      statisticsState = {
        data: createMockStatisticsData(),
        isLoading: false,
        isRefreshing: false,
        error: null,
        isOffline: false,
        networkStatus: createMockNetworkState(),
        offlineCapabilities: createMockOfflineCapabilities()
      };
      
      locationState = {
        location: {
          latitude: TEST_CONSTANTS.DEFAULT_LATITUDE,
          longitude: TEST_CONSTANTS.DEFAULT_LONGITUDE,
          accuracy: 5,
          timestamp: Date.now()
        },
        isTracking: false,
        error: null,
        permissionStatus: 'granted'
      };
    }
  };
};

// Standardized component mocks
export const createStandardComponentMocks = () => ({
  ThemedText: ({ children, ...props }) => {
    const { Text } = require('react-native');
    return React.createElement(Text, props, children);
  },
  
  ThemedView: ({ children, ...props }) => {
    const { View } = require('react-native');
    return React.createElement(View, props, children);
  },
  
  StatisticsCard: ({ title, value, subtitle, icon, isLoading, testID, onPress }) => {
    const { Text, View, TouchableOpacity } = require('react-native');
    
    if (isLoading) {
      return React.createElement(View, { testID }, 
        React.createElement(Text, null, 'Loading...')
      );
    }
    
    const Component = onPress ? TouchableOpacity : View;
    return React.createElement(Component, 
      { 
        testID, 
        onPress,
        accessibilityRole: onPress ? 'button' : 'text',
        accessibilityLabel: `Statistics card: ${title}`
      },
      icon && React.createElement(Text, null, icon),
      React.createElement(Text, null, title),
      React.createElement(Text, null, value),
      subtitle && React.createElement(Text, null, subtitle)
    );
  },
  
  HierarchicalView: ({ data, onToggleExpand, testID }) => {
    const { Text, View, TouchableOpacity } = require('react-native');
    
    if (!data || data.length === 0) {
      return React.createElement(View, { testID },
        React.createElement(Text, null, 'No geographic data available')
      );
    }
    
    return React.createElement(View, { testID },
      data.map((item, index) => 
        React.createElement(TouchableOpacity, 
          {
            key: item.id || index,
            testID: `hierarchical-item-${item.id || index}`,
            onPress: () => onToggleExpand && onToggleExpand(item)
          },
          React.createElement(Text, null, 
            `${item.name} - ${item.explorationPercentage?.toFixed(1) || '0.0'}%`
          )
        )
      )
    );
  },
  
  OfflineIndicator: ({ isOffline, testID }) => {
    const { View, Text } = require('react-native');
    
    if (!isOffline) return null;
    
    return React.createElement(View, { testID: testID || 'offline-indicator' },
      React.createElement(Text, null, 'Offline Mode')
    );
  },
  
  StatisticsErrorBoundary: ({ children }) => {
    const { View } = require('react-native');
    return React.createElement(View, null, children);
  }
});

// Standardized service mocks
export const createStandardServiceMocks = () => ({
  geocodingService: {
    reverseGeocode: jest.fn().mockResolvedValue({
      country: TEST_CONSTANTS.DEFAULT_COUNTRY,
      state: TEST_CONSTANTS.DEFAULT_STATE,
      city: TEST_CONSTANTS.DEFAULT_CITY,
      countryCode: TEST_CONSTANTS.DEFAULT_COUNTRY_CODE
    }),
    batchReverseGeocode: jest.fn().mockResolvedValue([])
  },
  
  regionBoundaryService: {
    getRegionBoundary: jest.fn().mockResolvedValue(null),
    cacheRegionBoundary: jest.fn().mockResolvedValue()
  },
  
  geographicApiService: {
    getTotalRegionCounts: jest.fn().mockResolvedValue({
      countries: TEST_CONSTANTS.TOTAL_COUNTRIES,
      states: TEST_CONSTANTS.TOTAL_STATES,
      cities: TEST_CONSTANTS.TOTAL_CITIES
    })
  }
});

// Standardized logger mock - uses the global mockLogger as base
export const createStandardLoggerMock = () => {
  // Use the global logger mock as base, or create a fallback
  const baseLogger = global.mockLogger || {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    success: jest.fn()
  };
  
  return {
    ...baseLogger,
    // Can add additional logger methods here if needed for specific tests
  };
};

// Enhanced error simulation utilities
export const createErrorSimulationUtilities = () => ({
  // Simulate different types of errors across all mock systems
  simulateNetworkError: (mocks, errorType = 'timeout') => {
    const errors = {
      timeout: new Error('Network request timeout'),
      connection: new Error('Network connection failed'),
      server: new Error('Server error (500)'),
      notFound: new Error('Resource not found (404)'),
      unauthorized: new Error('Unauthorized (401)'),
      rateLimit: new Error('Rate limit exceeded (429)')
    };
    
    const error = errors[errorType] || errors.timeout;
    
    // Apply error to network operations
    if (mocks.network) {
      mocks.network._setConnectivityFailureRate(1.0);
    }
    
    // Apply error to service operations
    if (mocks.services) {
      Object.keys(mocks.services).forEach(serviceName => {
        const service = mocks.services[serviceName];
        Object.keys(service).forEach(methodName => {
          if (typeof service[methodName] === 'function') {
            service[methodName].mockRejectedValue(error);
          }
        });
      });
    }
    
    return error;
  },
  
  simulateDatabaseError: (mocks, errorType = 'connection') => {
    if (mocks.database && mocks.database._simulateError) {
      return mocks.database._simulateError('getLocations', errorType);
    }
    return null;
  },
  
  simulateGeometryError: (mocks, errorType = 'invalid') => {
    if (mocks.calculations) {
      const geometryMock = require('../__mocks__/@/utils/geometryOperations');
      
      // Override geometry operations to return errors
      geometryMock.sanitizeGeometry.mockReturnValue(null);
      geometryMock.validateGeometry.mockReturnValue({
        isValid: false,
        errors: [`Simulated ${errorType} geometry error`],
        warnings: []
      });
    }
  },
  
  // Reset all error simulations
  resetErrorSimulations: (mocks) => {
    if (mocks.network && mocks.network._reset) {
      mocks.network._reset();
    }
    
    if (mocks.database && mocks.database._resetMockStorage) {
      mocks.database._resetMockStorage();
    }
    
    if (mocks.hooks && mocks.hooks._reset) {
      mocks.hooks._reset();
    }
    
    // Reset all jest mocks
    jest.clearAllMocks();
  }
});

// Enhanced validation utilities for mock behavior
export const createMockValidationUtilities = () => ({
  // Validate that mocks are behaving consistently
  validateMockConsistency: (mocks) => {
    const issues = [];
    
    // Check database mock consistency
    if (mocks.database) {
      try {
        // Test basic operations
        mocks.database.getLocations();
        mocks.database.saveLocation({ latitude: 0, longitude: 0 });
      } catch (error) {
        issues.push(`Database mock inconsistency: ${error.message}`);
      }
    }
    
    // Check network mock consistency
    if (mocks.network) {
      try {
        mocks.network.getCurrentState();
        mocks.network.testConnectivity();
      } catch (error) {
        issues.push(`Network mock inconsistency: ${error.message}`);
      }
    }
    
    return {
      isConsistent: issues.length === 0,
      issues
    };
  },
  
  // Validate mock data structures
  validateMockDataStructures: (mocks) => {
    const issues = [];
    
    // Validate statistics data structure
    if (mocks.hooks && mocks.hooks.useOfflineStatistics) {
      const hookResult = mocks.hooks.useOfflineStatistics();
      if (!hookResult.data || typeof hookResult.data !== 'object') {
        issues.push('useOfflineStatistics hook data is invalid');
      }
      
      if (typeof hookResult.isLoading !== 'boolean') {
        issues.push('useOfflineStatistics hook isLoading is not boolean');
      }
    }
    
    // Validate location data structure
    if (mocks.hooks && mocks.hooks.useLocationTracking) {
      const hookResult = mocks.hooks.useLocationTracking();
      if (!hookResult.location || 
          typeof hookResult.location.latitude !== 'number' ||
          typeof hookResult.location.longitude !== 'number') {
        issues.push('useLocationTracking hook location data is invalid');
      }
    }
    
    return {
      isValid: issues.length === 0,
      issues
    };
  },
  
  // Performance validation for mocks
  validateMockPerformance: async (mocks) => {
    const metrics = {};
    
    // Test database operation performance
    if (mocks.database) {
      const start = Date.now();
      await mocks.database.getLocations();
      metrics.databaseOperationTime = Date.now() - start;
    }
    
    // Test network operation performance
    if (mocks.network) {
      const start = Date.now();
      await mocks.network.getCurrentState();
      metrics.networkOperationTime = Date.now() - start;
    }
    
    return {
      metrics,
      isPerformant: Object.values(metrics).every(time => time < 100) // All operations under 100ms
    };
  }
});

// Factory function to create all standard mocks with utilities
export const createAllStandardMocks = () => {
  const mocks = {
    database: createStandardDatabaseMocks(),
    network: createStandardNetworkMocks(),
    calculations: createStandardCalculationMocks(),
    hooks: createStandardHookMocks(),
    components: createStandardComponentMocks(),
    services: createStandardServiceMocks(),
    logger: createStandardLoggerMock()
  };
  
  // Add utility functions
  mocks.errorSimulation = createErrorSimulationUtilities();
  mocks.validation = createMockValidationUtilities();
  
  return mocks;
};

// Helper to apply mocks to Jest - only applies mocks that aren't already set up globally
export const applyStandardMocks = (mocks = createAllStandardMocks()) => {
  // Note: Database, logger, and Turf mocks are already set up globally in jest.setup.js
  // Only apply additional mocks that aren't covered by the global setup
  
  try {
    // Network mocks
    jest.mock('@/utils/networkUtils', () => ({ networkUtils: mocks.network }));
    jest.mock('./utils/networkUtils', () => ({ networkUtils: mocks.network }));
    
    // Calculation mocks (these extend the global mocks with specific behaviors)
    jest.mock('@/utils/distanceCalculator', () => mocks.calculations);
    jest.mock('./utils/distanceCalculator', () => mocks.calculations);
    jest.mock('@/utils/worldExplorationCalculator', () => mocks.calculations);
    jest.mock('./utils/worldExplorationCalculator', () => mocks.calculations);
    jest.mock('@/utils/geographicHierarchy', () => mocks.calculations);
    jest.mock('./utils/geographicHierarchy', () => mocks.calculations);
    jest.mock('@/utils/remainingRegionsService', () => mocks.calculations);
    jest.mock('./utils/remainingRegionsService', () => mocks.calculations);
    
    // Hook mocks
    jest.mock('@/hooks/useOfflineStatistics', () => ({ useOfflineStatistics: mocks.hooks.useOfflineStatistics }));
    jest.mock('./hooks/useOfflineStatistics', () => ({ useOfflineStatistics: mocks.hooks.useOfflineStatistics }));
    jest.mock('@/hooks/useThemeColor', () => ({ useThemeColor: mocks.hooks.useThemeColor }));
    jest.mock('./hooks/useThemeColor', () => ({ useThemeColor: mocks.hooks.useThemeColor }));
    jest.mock('@/hooks/useLocationTracking', () => ({ useLocationTracking: mocks.hooks.useLocationTracking }));
    jest.mock('./hooks/useLocationTracking', () => ({ useLocationTracking: mocks.hooks.useLocationTracking }));
    
    // Component mocks
    jest.mock('@/components/ThemedText', () => ({ ThemedText: mocks.components.ThemedText }));
    jest.mock('./components/ThemedText', () => ({ ThemedText: mocks.components.ThemedText }));
    jest.mock('@/components/ThemedView', () => ({ ThemedView: mocks.components.ThemedView }));
    jest.mock('./components/ThemedView', () => ({ ThemedView: mocks.components.ThemedView }));
    jest.mock('@/components/StatisticsCard', () => ({ StatisticsCard: mocks.components.StatisticsCard }));
    jest.mock('./components/StatisticsCard', () => ({ StatisticsCard: mocks.components.StatisticsCard }));
    jest.mock('@/components/HierarchicalView', () => ({ HierarchicalView: mocks.components.HierarchicalView }));
    jest.mock('./components/HierarchicalView', () => ({ HierarchicalView: mocks.components.HierarchicalView }));
    jest.mock('@/components/OfflineIndicator', () => ({ OfflineIndicator: mocks.components.OfflineIndicator }));
    jest.mock('./components/OfflineIndicator', () => ({ OfflineIndicator: mocks.components.OfflineIndicator }));
    jest.mock('@/components/StatisticsErrorBoundary', () => ({ StatisticsErrorBoundary: mocks.components.StatisticsErrorBoundary }));
    jest.mock('./components/StatisticsErrorBoundary', () => ({ StatisticsErrorBoundary: mocks.components.StatisticsErrorBoundary }));
    
    // Service mocks
    jest.mock('@/utils/geocodingService', () => mocks.services.geocodingService);
    jest.mock('./utils/geocodingService', () => mocks.services.geocodingService);
    jest.mock('@/utils/regionBoundaryService', () => mocks.services.regionBoundaryService);
    jest.mock('./utils/regionBoundaryService', () => mocks.services.regionBoundaryService);
    jest.mock('@/utils/geographicApiService', () => mocks.services.geographicApiService);
    jest.mock('./utils/geographicApiService', () => mocks.services.geographicApiService);
    
  } catch (error) {
    // If mocking fails, log warning but don't break tests
    console.warn('Warning: Some mocks could not be applied:', error.message);
  }
  
  return mocks;
};

// Utility to validate and setup mocks for a specific test scenario
export const setupMocksForScenario = (scenario, customMocks = {}) => {
  const mocks = createAllStandardMocks();
  
  // Apply scenario-specific configurations
  switch (scenario) {
    case 'offline':
      mocks.network._setNetworkState({ isConnected: false, type: 'none' });
      mocks.hooks._simulateNetworkChange(false);
      break;
      
    case 'slow_network':
      mocks.network._setLatencySimulation(2000);
      mocks.network._setConnectivityFailureRate(0.3);
      break;
      
    case 'database_error':
      mocks.database._simulateError('getLocations', 'connection');
      break;
      
    case 'empty_data':
      mocks.database._setupTestScenario('empty');
      break;
      
    case 'large_dataset':
      mocks.database._setupTestScenario('large');
      break;
      
    default:
      // Default scenario - small dataset, online
      mocks.database._setupTestScenario('small');
      break;
  }
  
  // Apply custom mock overrides
  Object.keys(customMocks).forEach(category => {
    if (mocks[category]) {
      Object.assign(mocks[category], customMocks[category]);
    }
  });
  
  // Apply mocks to Jest
  applyStandardMocks(mocks);
  
  return mocks;
};