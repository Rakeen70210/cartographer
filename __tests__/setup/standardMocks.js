/**
 * Standardized mock factory for consistent mock implementations across all tests
 * This ensures all tests use the same mock behaviors and return values
 */

import {
    createMockLocations,
    createMockNetworkState,
    createMockOfflineCapabilities,
    createMockRevealedAreas,
    createMockStatisticsData,
    TEST_CONSTANTS
} from './testSetup.js';

// Standardized database mocks
export const createStandardDatabaseMocks = () => {
  const mockCache = new Map();
  
  return {
    // Location operations
    getLocations: jest.fn().mockResolvedValue(createMockLocations(2)),
    saveLocation: jest.fn().mockResolvedValue({ id: 1 }),
    deleteLocation: jest.fn().mockResolvedValue(),
    
    // Revealed area operations
    getRevealedAreas: jest.fn().mockResolvedValue(createMockRevealedAreas(2)),
    saveRevealedArea: jest.fn().mockResolvedValue({ id: 1 }),
    deleteRevealedArea: jest.fn().mockResolvedValue(),
    
    // Cache operations
    getStatisticsCache: jest.fn().mockImplementation(async (key) => {
      const cached = mockCache.get(key);
      if (!cached) return null;
      
      const now = Date.now();
      const age = now - cached.timestamp;
      if (age > TEST_CONSTANTS.DEFAULT_CACHE_TTL) {
        mockCache.delete(key);
        return null;
      }
      
      return cached;
    }),
    
    saveStatisticsCache: jest.fn().mockImplementation(async (key, value) => {
      const entry = {
        id: Date.now(),
        cache_key: key,
        cache_value: typeof value === 'string' ? value : JSON.stringify(value),
        timestamp: Date.now()
      };
      mockCache.set(key, entry);
    }),
    
    deleteStatisticsCache: jest.fn().mockImplementation(async (key) => {
      mockCache.delete(key);
    }),
    
    clearAllStatisticsCache: jest.fn().mockImplementation(async () => {
      mockCache.clear();
    }),
    
    deleteExpiredStatisticsCache: jest.fn().mockResolvedValue(),
    getAllStatisticsCache: jest.fn().mockImplementation(async () => {
      return Array.from(mockCache.values());
    }),
    
    // Geocoding operations
    getLocationGeocoding: jest.fn().mockResolvedValue(null),
    saveLocationGeocoding: jest.fn().mockResolvedValue(),
    deleteExpiredLocationGeocodings: jest.fn().mockResolvedValue(),
    getAllLocationGeocodings: jest.fn().mockResolvedValue([])
  };
};

// Standardized network utility mocks
export const createStandardNetworkMocks = () => ({
  testConnectivity: jest.fn().mockResolvedValue(true),
  getCurrentState: jest.fn().mockResolvedValue(createMockNetworkState()),
  isOffline: jest.fn().mockResolvedValue(false),
  getConnectionQuality: jest.fn().mockResolvedValue('excellent'),
  waitForConnection: jest.fn().mockResolvedValue(true),
  addListener: jest.fn().mockReturnValue(jest.fn()),
  withOfflineFallback: jest.fn().mockImplementation(async (onlineFunc, offlineFunc) => {
    try {
      const result = await onlineFunc();
      return { result, wasOffline: false };
    } catch (error) {
      const result = await offlineFunc();
      return { result, wasOffline: true };
    }
  }),
  retryWithBackoff: jest.fn().mockImplementation(async (fn) => await fn())
});

// Standardized calculation mocks
export const createStandardCalculationMocks = () => ({
  // Distance calculator
  calculateTotalDistance: jest.fn().mockResolvedValue({
    miles: TEST_CONSTANTS.DEFAULT_DISTANCE_MILES,
    kilometers: TEST_CONSTANTS.DEFAULT_DISTANCE_KILOMETERS
  }),
  calculateHaversineDistance: jest.fn().mockReturnValue(TEST_CONSTANTS.DEFAULT_DISTANCE_METERS),
  formatDistance: jest.fn().mockImplementation((distance, unit) => {
    if (distance === 0) return `0 ${unit === 'miles' ? 'miles' : 'km'}`;
    return `${distance.toFixed(2)} ${unit === 'miles' ? 'miles' : 'km'}`;
  }),
  validateCoordinates: jest.fn().mockImplementation((lat, lon) => {
    return typeof lat === 'number' && typeof lon === 'number' &&
           lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180 &&
           !isNaN(lat) && !isNaN(lon);
  }),
  
  // World exploration calculator
  calculateWorldExplorationPercentage: jest.fn().mockResolvedValue({
    percentage: TEST_CONSTANTS.DEFAULT_EXPLORATION_PERCENTAGE,
    totalAreaKm2: TEST_CONSTANTS.EARTH_SURFACE_AREA_KM2,
    exploredAreaKm2: TEST_CONSTANTS.DEFAULT_EXPLORED_AREA_KM2
  }),
  calculateRevealedArea: jest.fn().mockResolvedValue(TEST_CONSTANTS.DEFAULT_EXPLORED_AREA_KM2),
  validateGeometryForArea: jest.fn().mockImplementation((geojson) => {
    if (!geojson || typeof geojson !== 'object') return false;
    const geometry = geojson.type === 'Feature' ? geojson.geometry : geojson;
    return geometry?.type === 'Polygon' || geometry?.type === 'MultiPolygon';
  }),
  formatExplorationPercentage: jest.fn().mockImplementation((percentage, level = 'world') => {
    switch (level) {
      case 'world': return `${percentage.toFixed(3)}%`;
      case 'country': return `${percentage.toFixed(2)}%`;
      default: return `${percentage.toFixed(1)}%`;
    }
  }),
  
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

// Standardized hook mocks
export const createStandardHookMocks = () => ({
  useOfflineStatistics: jest.fn().mockReturnValue({
    data: createMockStatisticsData(),
    isLoading: false,
    isRefreshing: false,
    error: null,
    isOffline: false,
    networkStatus: createMockNetworkState(),
    offlineCapabilities: createMockOfflineCapabilities(),
    refreshData: jest.fn(),
    toggleHierarchyNode: jest.fn(),
    retryConnection: jest.fn().mockResolvedValue(true),
    forceOfflineMode: jest.fn(),
    forceOnlineMode: jest.fn(),
    clearCache: jest.fn().mockResolvedValue()
  }),
  
  useThemeColor: jest.fn().mockReturnValue('#000000'),
  
  useLocationTracking: jest.fn().mockReturnValue({
    location: {
      latitude: TEST_CONSTANTS.DEFAULT_LATITUDE,
      longitude: TEST_CONSTANTS.DEFAULT_LONGITUDE
    },
    isTracking: false,
    startTracking: jest.fn(),
    stopTracking: jest.fn(),
    error: null
  })
});

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

// Standardized logger mock
export const createStandardLoggerMock = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  success: jest.fn()
});

// Factory function to create all standard mocks
export const createAllStandardMocks = () => ({
  database: createStandardDatabaseMocks(),
  network: createStandardNetworkMocks(),
  calculations: createStandardCalculationMocks(),
  hooks: createStandardHookMocks(),
  components: createStandardComponentMocks(),
  services: createStandardServiceMocks(),
  logger: createStandardLoggerMock()
});

// Helper to apply mocks to Jest
export const applyStandardMocks = (mocks = createAllStandardMocks()) => {
  // Database mocks
  jest.mock('../utils/database', () => mocks.database);
  
  // Network mocks
  jest.mock('../utils/networkUtils', () => ({ networkUtils: mocks.network }));
  
  // Calculation mocks
  jest.mock('../utils/distanceCalculator', () => mocks.calculations);
  jest.mock('../utils/worldExplorationCalculator', () => mocks.calculations);
  jest.mock('../utils/geographicHierarchy', () => mocks.calculations);
  jest.mock('../utils/remainingRegionsService', () => mocks.calculations);
  
  // Hook mocks
  jest.mock('../hooks/useOfflineStatistics', () => mocks.hooks);
  jest.mock('../hooks/useThemeColor', () => mocks.hooks);
  jest.mock('../hooks/useLocationTracking', () => mocks.hooks);
  
  // Component mocks
  jest.mock('../components/ThemedText', () => ({ ThemedText: mocks.components.ThemedText }));
  jest.mock('../components/ThemedView', () => ({ ThemedView: mocks.components.ThemedView }));
  jest.mock('../components/StatisticsCard', () => ({ StatisticsCard: mocks.components.StatisticsCard }));
  jest.mock('../components/HierarchicalView', () => ({ HierarchicalView: mocks.components.HierarchicalView }));
  jest.mock('../components/OfflineIndicator', () => ({ OfflineIndicator: mocks.components.OfflineIndicator }));
  jest.mock('../components/StatisticsErrorBoundary', () => ({ StatisticsErrorBoundary: mocks.components.StatisticsErrorBoundary }));
  
  // Service mocks
  jest.mock('../utils/geocodingService', () => mocks.services.geocodingService);
  jest.mock('../utils/regionBoundaryService', () => mocks.services.regionBoundaryService);
  jest.mock('../utils/geographicApiService', () => mocks.services.geographicApiService);
  
  // Logger mock
  jest.mock('../utils/logger', () => ({ logger: mocks.logger }));
  
  return mocks;
};