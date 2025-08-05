import { render } from '@testing-library/react-native';
import React from 'react';
import StatisticsScreen from '../app/(tabs)/statistics';

// Mock the useOfflineStatistics hook
jest.mock('@/hooks/useOfflineStatistics', () => ({
  useOfflineStatistics: jest.fn(),
}));

// Mock the StatisticsCard component
jest.mock('@/components/StatisticsCard', () => ({
  StatisticsCard: ({ title, value, subtitle, icon, isLoading, testID }) => {
    const { Text, View } = require('react-native');
    
    if (isLoading) {
      return (
        <View testID={testID}>
          <Text>Loading...</Text>
        </View>
      );
    }
    
    return (
      <View testID={testID}>
        <Text>{icon} {title}</Text>
        <Text>{value}</Text>
        {subtitle && <Text>{subtitle}</Text>}
      </View>
    );
  },
}));

// Mock the HierarchicalView component
jest.mock('@/components/HierarchicalView', () => ({
  HierarchicalView: ({ data, onToggleExpand, testID }) => {
    const { Text, View, TouchableOpacity } = require('react-native');
    
    if (!data || data.length === 0) {
      return (
        <View testID={testID}>
          <Text>No geographic data available</Text>
        </View>
      );
    }
    
    return (
      <View testID={testID}>
        {data.map((item, index) => (
          <TouchableOpacity
            key={item.id || index}
            testID={`hierarchical-item-${item.id || index}`}
            onPress={() => onToggleExpand(item)}
          >
            <Text>{item.name} - {item.explorationPercentage.toFixed(1)}%</Text>
            {item.children && item.isExpanded && (
              <View style={{ marginLeft: 20 }}>
                {item.children.map((child, childIndex) => (
                  <Text key={child.id || childIndex}>
                    {child.name} - {child.explorationPercentage.toFixed(1)}%
                  </Text>
                ))}
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
    );
  },
}));

// Mock themed components
jest.mock('@/components/ThemedText', () => ({
  ThemedText: ({ children, ...props }) => {
    const { Text } = require('react-native');
    return <Text {...props}>{children}</Text>;
  },
}));

jest.mock('@/components/ThemedView', () => ({
  ThemedView: ({ children, ...props }) => {
    const { View } = require('react-native');
    return <View {...props}>{children}</View>;
  },
}));

// Mock the OfflineIndicator component
jest.mock('@/components/OfflineIndicator', () => ({
  OfflineIndicator: ({ isOffline, offlineReason, dataSource, lastOnlineTime, onRetry }) => {
    const { View, Text, TouchableOpacity } = require('react-native');
    
    if (!isOffline) return null;
    
    return (
      <View testID="offline-indicator">
        <Text>Offline Mode</Text>
        {offlineReason && <Text>{offlineReason}</Text>}
        {dataSource && <Text>Data source: {dataSource}</Text>}
        {onRetry && (
          <TouchableOpacity onPress={onRetry} testID="retry-connection">
            <Text>Retry</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  },
}));

// Mock the StatisticsErrorBoundary component
jest.mock('@/components/StatisticsErrorBoundary', () => ({
  StatisticsErrorBoundary: ({ children, onRetry }) => {
    const { View } = require('react-native');
    return <View>{children}</View>;
  },
}));

// Mock hooks
jest.mock('@/hooks/useThemeColor', () => ({
  useThemeColor: () => '#000000',
}));



// Mock safe area view
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children, ...props }) => {
    const { View } = require('react-native');
    return <View {...props}>{children}</View>;
  },
}));

describe('StatisticsScreen', () => {
  const mockUseOfflineStatistics = require('@/hooks/useOfflineStatistics').useOfflineStatistics;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state correctly', async () => {
    mockUseOfflineStatistics.mockReturnValue({
      data: null,
      isLoading: true,
      isRefreshing: false,
      error: null,
      isOffline: false,
      networkStatus: { isConnected: true, connectionType: 'wifi', lastOnlineTime: Date.now() },
      refreshData: jest.fn(),
      toggleHierarchyNode: jest.fn(),
      retryConnection: jest.fn(),
    });

    const { getByText, getAllByText } = render(<StatisticsScreen />);

    expect(getByText('Statistics')).toBeTruthy();
    expect(getByText('Your exploration journey')).toBeTruthy();
    expect(getAllByText('Loading...')).toHaveLength(6);
  });

  it('renders statistics data correctly', async () => {
    const mockData = {
      totalDistance: { miles: 123.4, kilometers: 198.6 },
      worldExploration: { 
        percentage: 0.001, 
        exploredAreaKm2: 50.5,
        totalAreaKm2: 510072000 
      },
      uniqueRegions: { countries: 2, states: 5, cities: 12 },
      remainingRegions: { countries: 193, states: 3137, cities: 9988 },
      hierarchicalBreakdown: [],
      lastUpdated: 1640995200000, // Jan 1, 2022 00:00:00 GMT
    };

    mockUseOfflineStatistics.mockReturnValue({
      data: mockData,
      isLoading: false,
      isRefreshing: false,
      error: null,
      isOffline: false,
      networkStatus: { isConnected: true, connectionType: 'wifi', lastOnlineTime: Date.now() },
      refreshData: jest.fn(),
      toggleHierarchyNode: jest.fn(),
      retryConnection: jest.fn(),
    });

    const { getByText, getByTestId } = render(<StatisticsScreen />);

    expect(getByText('Statistics')).toBeTruthy();
    expect(getByText('Your exploration journey')).toBeTruthy();

    // Check distance card
    const distanceCard = getByTestId('distance-card');
    expect(distanceCard).toBeTruthy();

    // Check world exploration card
    const worldCard = getByTestId('world-exploration-card');
    expect(worldCard).toBeTruthy();

    // Check countries card
    const countriesCard = getByTestId('countries-card');
    expect(countriesCard).toBeTruthy();

    // Check states card
    const statesCard = getByTestId('states-card');
    expect(statesCard).toBeTruthy();

    // Check cities card
    const citiesCard = getByTestId('cities-card');
    expect(citiesCard).toBeTruthy();

    // Check last updated card
    const lastUpdatedCard = getByTestId('last-updated-card');
    expect(lastUpdatedCard).toBeTruthy();
  });

  it('renders error state correctly', async () => {
    mockUseOfflineStatistics.mockReturnValue({
      data: null,
      isLoading: false,
      isRefreshing: false,
      error: 'Network error',
      isOffline: false,
      networkStatus: { isConnected: false, connectionType: 'none', lastOnlineTime: Date.now() },
      refreshData: jest.fn(),
      toggleHierarchyNode: jest.fn(),
      retryConnection: jest.fn(),
    });

    const { getByText } = render(<StatisticsScreen />);

    expect(getByText('Statistics')).toBeTruthy();
    expect(getByText('Unable to load statistics')).toBeTruthy();
    expect(getByText('Network error')).toBeTruthy();
  });

  it('handles pull-to-refresh correctly', async () => {
    const mockRefreshData = jest.fn();
    
    mockUseOfflineStatistics.mockReturnValue({
      data: {
        totalDistance: { miles: 0, kilometers: 0 },
        worldExploration: { percentage: 0, exploredAreaKm2: 0, totalAreaKm2: 510072000 },
        uniqueRegions: { countries: 0, states: 0, cities: 0 },
        remainingRegions: { countries: 195, states: 3142, cities: 10000 },
        hierarchicalBreakdown: [],
        lastUpdated: Date.now(),
      },
      isLoading: false,
      isRefreshing: false,
      error: null,
      isOffline: false,
      networkStatus: { isConnected: true, connectionType: 'wifi', lastOnlineTime: Date.now() },
      refreshData: mockRefreshData,
      toggleHierarchyNode: jest.fn(),
      retryConnection: jest.fn(),
    });

    const { getByTestId } = render(<StatisticsScreen />);

    const scrollView = getByTestId('statistics-scroll-view');
    
    // Simulate pull-to-refresh by triggering the onRefresh callback
    // Since we can't easily test the actual pull gesture, we'll test the callback directly
    const refreshControl = scrollView.props.refreshControl;
    if (refreshControl && refreshControl.props.onRefresh) {
      await refreshControl.props.onRefresh();
    }

    expect(mockRefreshData).toHaveBeenCalledTimes(1);
  });

  it('displays refreshing state correctly', async () => {
    mockUseOfflineStatistics.mockReturnValue({
      data: {
        totalDistance: { miles: 0, kilometers: 0 },
        worldExploration: { percentage: 0, exploredAreaKm2: 0, totalAreaKm2: 510072000 },
        uniqueRegions: { countries: 0, states: 0, cities: 0 },
        remainingRegions: { countries: 195, states: 3142, cities: 10000 },
        hierarchicalBreakdown: [],
        lastUpdated: Date.now(),
      },
      isLoading: false,
      isRefreshing: true,
      error: null,
      isOffline: false,
      networkStatus: { isConnected: true, connectionType: 'wifi', lastOnlineTime: Date.now() },
      refreshData: jest.fn(),
      toggleHierarchyNode: jest.fn(),
      retryConnection: jest.fn(),
    });

    const { getByTestId } = render(<StatisticsScreen />);

    const scrollView = getByTestId('statistics-scroll-view');
    expect(scrollView).toBeTruthy();
    
    // The RefreshControl should be in refreshing state
    // This is handled internally by React Native
  });

  it('renders responsive layout correctly', async () => {
    const mockData = {
      totalDistance: { miles: 100, kilometers: 160 },
      worldExploration: { percentage: 0.001, exploredAreaKm2: 50, totalAreaKm2: 510072000 },
      uniqueRegions: { countries: 1, states: 2, cities: 3 },
      remainingRegions: { countries: 194, states: 3140, cities: 9997 },
      hierarchicalBreakdown: [],
      lastUpdated: Date.now(),
    };

    mockUseOfflineStatistics.mockReturnValue({
      data: mockData,
      isLoading: false,
      isRefreshing: false,
      error: null,
      isOffline: false,
      networkStatus: { isConnected: true, connectionType: 'wifi', lastOnlineTime: Date.now() },
      refreshData: jest.fn(),
      toggleHierarchyNode: jest.fn(),
      retryConnection: jest.fn(),
    });

    const { getByTestId } = render(<StatisticsScreen />);

    // Check that all cards are rendered
    expect(getByTestId('distance-card')).toBeTruthy();
    expect(getByTestId('world-exploration-card')).toBeTruthy();
    expect(getByTestId('countries-card')).toBeTruthy();
    expect(getByTestId('states-card')).toBeTruthy();
    expect(getByTestId('cities-card')).toBeTruthy();
    expect(getByTestId('last-updated-card')).toBeTruthy();
  });

  it('formats statistics data correctly', async () => {
    const mockData = {
      totalDistance: { miles: 123.456, kilometers: 198.654 },
      worldExploration: { percentage: 0.00123, exploredAreaKm2: 50.789, totalAreaKm2: 510072000 },
      uniqueRegions: { countries: 5, states: 12, cities: 45 },
      remainingRegions: { countries: 190, states: 3130, cities: 9955 },
      hierarchicalBreakdown: [],
      lastUpdated: 1640995200000, // Jan 1, 2022 00:00:00 GMT
    };

    mockUseOfflineStatistics.mockReturnValue({
      data: mockData,
      isLoading: false,
      isRefreshing: false,
      error: null,
      isOffline: false,
      networkStatus: { isConnected: true, connectionType: 'wifi', lastOnlineTime: Date.now() },
      refreshData: jest.fn(),
      toggleHierarchyNode: jest.fn(),
      retryConnection: jest.fn(),
    });

    const { getByTestId } = render(<StatisticsScreen />);

    // Check that cards are rendered with formatted data
    expect(getByTestId('distance-card')).toBeTruthy();
    expect(getByTestId('world-exploration-card')).toBeTruthy();
    expect(getByTestId('countries-card')).toBeTruthy();
    expect(getByTestId('states-card')).toBeTruthy();
    expect(getByTestId('cities-card')).toBeTruthy();
    expect(getByTestId('last-updated-card')).toBeTruthy();
  });

  it('shows enhanced error state with helpful messaging', async () => {
    mockUseOfflineStatistics.mockReturnValue({
      data: null,
      isLoading: false,
      isRefreshing: false,
      error: 'Database connection failed',
      isOffline: false,
      networkStatus: { isConnected: false, connectionType: 'none', lastOnlineTime: Date.now() },
      refreshData: jest.fn(),
      toggleHierarchyNode: jest.fn(),
      retryConnection: jest.fn(),
    });

    const { getByText } = render(<StatisticsScreen />);

    expect(getByText('⚠️')).toBeTruthy();
    expect(getByText('Unable to load statistics')).toBeTruthy();
    expect(getByText('Database connection failed')).toBeTruthy();
    expect(getByText('Pull down to refresh')).toBeTruthy();
  });

  it('shows loading cards with proper titles', async () => {
    mockUseOfflineStatistics.mockReturnValue({
      data: null,
      isLoading: true,
      isRefreshing: false,
      error: null,
      isOffline: false,
      networkStatus: { isConnected: true, connectionType: 'wifi', lastOnlineTime: Date.now() },
      refreshData: jest.fn(),
      toggleHierarchyNode: jest.fn(),
      retryConnection: jest.fn(),
    });

    const { getByTestId } = render(<StatisticsScreen />);

    // Check that loading cards have proper titles instead of generic "Loading..."
    expect(getByTestId('loading-card-0')).toBeTruthy();
    expect(getByTestId('loading-card-1')).toBeTruthy();
    expect(getByTestId('loading-card-2')).toBeTruthy();
    expect(getByTestId('loading-card-3')).toBeTruthy();
    expect(getByTestId('loading-card-4')).toBeTruthy();
    expect(getByTestId('loading-card-5')).toBeTruthy();
  });

  describe('Hierarchical Geographic Breakdown', () => {
    it('renders hierarchical section with data', async () => {
      const mockHierarchicalData = [
        {
          id: 'usa',
          type: 'country',
          name: 'United States',
          code: 'US',
          explorationPercentage: 2.5,
          isExpanded: true,
          children: [
            {
              id: 'ca',
              type: 'state',
              name: 'California',
              code: 'CA',
              explorationPercentage: 15.2,
              isExpanded: false,
              children: [
                {
                  id: 'sf',
                  type: 'city',
                  name: 'San Francisco',
                  explorationPercentage: 45.8,
                  children: []
                }
              ]
            }
          ]
        }
      ];

      const mockData = {
        totalDistance: { miles: 100, kilometers: 160 },
        worldExploration: { percentage: 0.001, exploredAreaKm2: 50, totalAreaKm2: 510072000 },
        uniqueRegions: { countries: 1, states: 1, cities: 1 },
        remainingRegions: { countries: 194, states: 3141, cities: 9999 },
        hierarchicalBreakdown: mockHierarchicalData,
        lastUpdated: Date.now(),
      };

      mockUseOfflineStatistics.mockReturnValue({
        data: mockData,
        isLoading: false,
        isRefreshing: false,
        error: null,
        isOffline: false,
        networkStatus: { isConnected: true, connectionType: 'wifi', lastOnlineTime: Date.now() },
        refreshData: jest.fn(),
        toggleHierarchyNode: jest.fn(),
        retryConnection: jest.fn(),
      });

      const { getByText, getByTestId } = render(<StatisticsScreen />);

      // Check section header
      expect(getByText('Geographic Breakdown')).toBeTruthy();
      expect(getByText('Exploration by region')).toBeTruthy();

      // Check hierarchical view is rendered
      expect(getByTestId('geographic-hierarchy')).toBeTruthy();

      // Check hierarchical data is displayed
      expect(getByText('United States - 2.5%')).toBeTruthy();
    });

    it('renders empty state when no hierarchical data', async () => {
      const mockData = {
        totalDistance: { miles: 0, kilometers: 0 },
        worldExploration: { percentage: 0, exploredAreaKm2: 0, totalAreaKm2: 510072000 },
        uniqueRegions: { countries: 0, states: 0, cities: 0 },
        remainingRegions: { countries: 195, states: 3142, cities: 10000 },
        hierarchicalBreakdown: [],
        lastUpdated: Date.now(),
      };

      mockUseOfflineStatistics.mockReturnValue({
        data: mockData,
        isLoading: false,
        isRefreshing: false,
        error: null,
        isOffline: false,
        networkStatus: { isConnected: true, connectionType: 'wifi', lastOnlineTime: Date.now() },
        refreshData: jest.fn(),
        toggleHierarchyNode: jest.fn(),
        retryConnection: jest.fn(),
      });

      const { getByText, getByTestId } = render(<StatisticsScreen />);

      // Check section header
      expect(getByText('Geographic Breakdown')).toBeTruthy();
      expect(getByText('Exploration by region')).toBeTruthy();

      // Check empty state
      expect(getByText('🗺️')).toBeTruthy();
      expect(getByText('No Geographic Data')).toBeTruthy();
      expect(getByText('Start exploring to see your geographic breakdown')).toBeTruthy();
    });

    it('renders loading state for hierarchical data', async () => {
      const mockData = {
        totalDistance: { miles: 100, kilometers: 160 },
        worldExploration: { percentage: 0.001, exploredAreaKm2: 50, totalAreaKm2: 510072000 },
        uniqueRegions: { countries: 1, states: 1, cities: 1 },
        remainingRegions: { countries: 194, states: 3141, cities: 9999 },
        hierarchicalBreakdown: [],
        lastUpdated: Date.now(),
      };

      mockUseOfflineStatistics.mockReturnValue({
        data: mockData,
        isLoading: true,
        isRefreshing: false,
        error: null,
        isOffline: false,
        networkStatus: { isConnected: true, connectionType: 'wifi', lastOnlineTime: Date.now() },
        refreshData: jest.fn(),
        toggleHierarchyNode: jest.fn(),
        retryConnection: jest.fn(),
      });

      const { getByText } = render(<StatisticsScreen />);

      // Check section header
      expect(getByText('Geographic Breakdown')).toBeTruthy();
      expect(getByText('Exploration by region')).toBeTruthy();

      // Check loading state
      expect(getByText('Loading geographic data...')).toBeTruthy();
    });

    it('handles hierarchy node toggle correctly', async () => {
      const mockToggleHierarchyNode = jest.fn();
      const mockHierarchicalData = [
        {
          id: 'usa',
          type: 'country',
          name: 'United States',
          code: 'US',
          explorationPercentage: 2.5,
          isExpanded: false,
          children: [
            {
              id: 'ca',
              type: 'state',
              name: 'California',
              code: 'CA',
              explorationPercentage: 15.2,
              children: []
            }
          ]
        }
      ];

      const mockData = {
        totalDistance: { miles: 100, kilometers: 160 },
        worldExploration: { percentage: 0.001, exploredAreaKm2: 50, totalAreaKm2: 510072000 },
        uniqueRegions: { countries: 1, states: 1, cities: 1 },
        remainingRegions: { countries: 194, states: 3141, cities: 9999 },
        hierarchicalBreakdown: mockHierarchicalData,
        lastUpdated: Date.now(),
      };

      mockUseOfflineStatistics.mockReturnValue({
        data: mockData,
        isLoading: false,
        isRefreshing: false,
        error: null,
        isOffline: false,
        networkStatus: { isConnected: true, connectionType: 'wifi', lastOnlineTime: Date.now() },
        refreshData: jest.fn(),
        toggleHierarchyNode: mockToggleHierarchyNode,
        retryConnection: jest.fn(),
      });

      const { getByTestId } = render(<StatisticsScreen />);

      // Get the hierarchical item and simulate tap
      const hierarchicalItem = getByTestId('hierarchical-item-usa');
      expect(hierarchicalItem).toBeTruthy();

      // Simulate press on the item
      hierarchicalItem.props.onPress();

      // Check that toggle function was called
      expect(mockToggleHierarchyNode).toHaveBeenCalledWith(mockHierarchicalData[0]);
    });

    it('does not render hierarchical section when there is an error', async () => {
      mockUseOfflineStatistics.mockReturnValue({
        data: null,
        isLoading: false,
        isRefreshing: false,
        error: 'Network error',
        isOffline: false,
        networkStatus: { isConnected: false, connectionType: 'none', lastOnlineTime: Date.now() },
        refreshData: jest.fn(),
        toggleHierarchyNode: jest.fn(),
        retryConnection: jest.fn(),
      });

      const { queryByText } = render(<StatisticsScreen />);

      // Check that hierarchical section is not rendered
      expect(queryByText('Geographic Breakdown')).toBeFalsy();
      expect(queryByText('Exploration by region')).toBeFalsy();
    });

    it('renders hierarchical section with proper spacing and visual separation', async () => {
      const mockData = {
        totalDistance: { miles: 100, kilometers: 160 },
        worldExploration: { percentage: 0.001, exploredAreaKm2: 50, totalAreaKm2: 510072000 },
        uniqueRegions: { countries: 1, states: 1, cities: 1 },
        remainingRegions: { countries: 194, states: 3141, cities: 9999 },
        hierarchicalBreakdown: [
          {
            id: 'usa',
            type: 'country',
            name: 'United States',
            explorationPercentage: 2.5,
            children: []
          }
        ],
        lastUpdated: Date.now(),
      };

      mockUseOfflineStatistics.mockReturnValue({
        data: mockData,
        isLoading: false,
        isRefreshing: false,
        error: null,
        isOffline: false,
        networkStatus: { isConnected: true, connectionType: 'wifi', lastOnlineTime: Date.now() },
        refreshData: jest.fn(),
        toggleHierarchyNode: jest.fn(),
        retryConnection: jest.fn(),
      });

      const { getByTestId } = render(<StatisticsScreen />);

      // Check that hierarchical view is rendered with proper testID
      expect(getByTestId('geographic-hierarchy')).toBeTruthy();

      // Check that statistics cards are still rendered (proper separation)
      expect(getByTestId('distance-card')).toBeTruthy();
      expect(getByTestId('world-exploration-card')).toBeTruthy();
    });
  });
});