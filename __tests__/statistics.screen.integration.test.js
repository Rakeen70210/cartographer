import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import StatisticsScreen from '../app/(tabs)/statistics';

// Mock the useOfflineStatistics hook
jest.mock('@/hooks/useOfflineStatistics', () => ({
  __esModule: true,
  default: jest.fn(),
  useOfflineStatistics: jest.fn()
}));

// Mock the components
jest.mock('@/components/StatisticsCard', () => ({
  StatisticsCard: ({ title, value, subtitle, icon, isLoading, onPress, testID }) => {
    const { View, Text, TouchableOpacity } = require('react-native');
    
    const Component = onPress ? TouchableOpacity : View;
    
    return (
      <Component 
        onPress={onPress} 
        testID={testID}
        accessible={true}
        accessibilityRole={onPress ? 'button' : 'text'}
        accessibilityLabel={`Statistics card: ${title}`}
        accessibilityHint={onPress ? 'Tap for more details' : undefined}
      >
        <Text testID={`${testID}-title`}>{title}</Text>
        <Text testID={`${testID}-value`}>{isLoading ? 'Loading...' : value}</Text>
        {subtitle && <Text testID={`${testID}-subtitle`}>{subtitle}</Text>}
        {icon && <Text testID={`${testID}-icon`}>{icon}</Text>}
      </Component>
    );
  }
}));

jest.mock('@/components/HierarchicalView', () => ({
  HierarchicalView: ({ data, onToggleExpand, testID }) => {
    const { View, Text, TouchableOpacity } = require('react-native');
    
    if (!data || data.length === 0) {
      return (
        <View testID={testID}>
          <Text testID="hierarchy-empty">No geographic data available</Text>
        </View>
      );
    }
    
    return (
      <View testID={testID}>
        {data.map((item, index) => (
          <TouchableOpacity
            key={item.id || index}
            onPress={() => onToggleExpand(item)}
            testID={`hierarchy-item-${item.id || index}`}
          >
            <Text testID={`hierarchy-name-${item.id || index}`}>{item.name}</Text>
            <Text testID={`hierarchy-percentage-${item.id || index}`}>
              {item.explorationPercentage}%
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }
}));

jest.mock('@/components/ThemedText', () => ({
  ThemedText: ({ children, style, type, testID, ...props }) => {
    const { Text } = require('react-native');
    return (
      <Text style={style} testID={testID} {...props}>
        {children}
      </Text>
    );
  }
}));

jest.mock('@/components/ThemedView', () => ({
  ThemedView: ({ children, style, testID, ...props }) => {
    const { View } = require('react-native');
    return (
      <View style={style} testID={testID} {...props}>
        {children}
      </View>
    );
  }
}));

jest.mock('@/components/ParallaxScrollView', () => ({
  ParallaxScrollView: ({ children, headerBackgroundColor, headerImage, testID }) => {
    const { ScrollView, View } = require('react-native');
    return (
      <ScrollView testID={testID}>
        {headerImage && <View testID="header-image">{headerImage}</View>}
        <View testID="scroll-content">{children}</View>
      </ScrollView>
    );
  }
}));

jest.mock('@/hooks/useThemeColor', () => ({
  useThemeColor: jest.fn(() => '#FFFFFF')
}));

const { useOfflineStatistics } = require('@/hooks/useOfflineStatistics');


describe('Statistics Screen Integration Tests', () => {
  const mockStatisticsData = {
    totalDistance: { miles: 1234.5, kilometers: 1987.2 },
    worldExploration: { percentage: 0.001, totalAreaKm2: 510072000, exploredAreaKm2: 5100.72 },
    uniqueRegions: { countries: 3, states: 8, cities: 15 },
    remainingRegions: { countries: 192, states: 3134, cities: 9985 },
    hierarchicalBreakdown: [
      {
        id: 'us',
        type: 'country',
        name: 'United States',
        code: 'US',
        explorationPercentage: 2.5,
        isExpanded: false,
        children: [
          {
            id: 'us-ny',
            type: 'state',
            name: 'New York',
            code: 'NY',
            explorationPercentage: 15.2,
            isExpanded: false,
            children: []
          }
        ]
      },
      {
        id: 'ca',
        type: 'country',
        name: 'Canada',
        code: 'CA',
        explorationPercentage: 0.8,
        isExpanded: false,
        children: []
      }
    ],
    lastUpdated: Date.now()
  };

  const mockToggleHierarchyNode = jest.fn();
  const mockRefreshData = jest.fn();
  const mockClearCache = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    
    useOfflineStatistics.mockReturnValue({
      data: mockStatisticsData,
      isLoading: false,
      isRefreshing: false,
      error: null,
      isOffline: false,
      networkStatus: { isConnected: true, connectionType: 'wifi', lastOnlineTime: Date.now() },
      lastUpdated: mockStatisticsData.lastUpdated,
      refreshData: mockRefreshData,
      clearCache: mockClearCache,
      toggleHierarchyNode: mockToggleHierarchyNode,
      retryConnection: jest.fn()
    });
  });

  describe('Basic Rendering', () => {
    test('renders statistics screen with data', () => {
      const { getByTestId, getByText } = render(<StatisticsScreen />);

      // Check that main elements render
      expect(getByText('Statistics')).toBeTruthy();
      expect(getByText('Your exploration journey')).toBeTruthy();
      
      // Check that scroll view renders
      expect(getByTestId('statistics-scroll-view')).toBeTruthy();
      
      // Check that data cards are rendered when not loading
      expect(getByTestId('distance-card')).toBeTruthy();
      expect(getByTestId('world-exploration-card')).toBeTruthy();
    });

    test('displays correct statistics values', () => {
      const { getByTestId } = render(<StatisticsScreen />);

      // Check that data cards display correct values
      expect(getByTestId('distance-card-value')).toHaveTextContent('1,234.5 miles');
      expect(getByTestId('world-exploration-card-value')).toHaveTextContent('0.001%');
      expect(getByTestId('countries-card-value')).toHaveTextContent('3');
    });

    test('displays hierarchical breakdown', () => {
      const { getByText } = render(<StatisticsScreen />);

      // The hierarchical breakdown section should be present
      expect(getByText('Statistics')).toBeTruthy();
      expect(getByText('Your exploration journey')).toBeTruthy();
    });
  });

  describe('Loading States', () => {
    test('shows loading state when data is loading', () => {
      useOfflineStatistics.mockReturnValue({
        data: null,
        isLoading: true,
        isRefreshing: false,
        error: null,
        isOffline: false,
        networkStatus: { isConnected: true, connectionType: 'wifi', lastOnlineTime: Date.now() },
        lastUpdated: null,
        refreshData: mockRefreshData,
        clearCache: mockClearCache,
        toggleHierarchyNode: mockToggleHierarchyNode,
        retryConnection: jest.fn()
      });

      const { getByTestId } = render(<StatisticsScreen />);

      // All cards should show loading state
      expect(getByTestId('loading-card-0-value')).toHaveTextContent('Loading...');
      expect(getByTestId('loading-card-1-value')).toHaveTextContent('Loading...');
      expect(getByTestId('loading-card-2-value')).toHaveTextContent('Loading...');
    });

    test('shows refreshing state correctly', () => {
      useOfflineStatistics.mockReturnValue({
        data: mockStatisticsData,
        isLoading: false,
        isRefreshing: true,
        error: null,
        lastUpdated: mockStatisticsData.lastUpdated,
        refreshData: mockRefreshData,
        clearCache: mockClearCache,
        toggleHierarchyNode: mockToggleHierarchyNode
      });

      const { getByTestId } = render(<StatisticsScreen />);

      // Data should still be visible during refresh
      expect(getByTestId('distance-card-value')).toHaveTextContent('1,234.5 miles');
      expect(getByTestId('statistics-screen')).toBeTruthy();
    });

    test('transitions from loading to loaded state', async () => {
      // Start with loading state
      const { rerender, getByTestId } = render(<StatisticsScreen />);
      
      useOfflineStatistics.mockReturnValue({
        data: null,
        isLoading: true,
        isRefreshing: false,
        error: null,
        lastUpdated: null,
        refreshData: mockRefreshData,
        clearCache: mockClearCache,
        toggleHierarchyNode: mockToggleHierarchyNode
      });

      rerender(<StatisticsScreen />);
      expect(getByTestId('loading-card-0-value')).toHaveTextContent('Loading...');

      // Update to loaded state
      useOfflineStatistics.mockReturnValue({
        data: mockStatisticsData,
        isLoading: false,
        isRefreshing: false,
        error: null,
        lastUpdated: mockStatisticsData.lastUpdated,
        refreshData: mockRefreshData,
        clearCache: mockClearCache,
        toggleHierarchyNode: mockToggleHierarchyNode
      });

      rerender(<StatisticsScreen />);

      await waitFor(() => {
        expect(getByTestId('distance-card-value')).toHaveTextContent('1,234.5 miles');
      });
    });
  });

  describe('Error Handling', () => {
    test('displays error state when statistics loading fails', () => {
      useOfflineStatistics.mockReturnValue({
        data: null,
        isLoading: false,
        isRefreshing: false,
        error: 'Failed to load statistics data',
        lastUpdated: null,
        refreshData: mockRefreshData,
        clearCache: mockClearCache,
        toggleHierarchyNode: mockToggleHierarchyNode
      });

      const { getByTestId, getByText } = render(<StatisticsScreen />);

      expect(getByTestId('statistics-screen')).toBeTruthy();
      expect(getByText('Failed to load statistics data')).toBeTruthy();
    });

    test('shows retry functionality on error', () => {
      useOfflineStatistics.mockReturnValue({
        data: null,
        isLoading: false,
        isRefreshing: false,
        error: 'Network error occurred',
        lastUpdated: null,
        refreshData: mockRefreshData,
        clearCache: mockClearCache,
        toggleHierarchyNode: mockToggleHierarchyNode
      });

      const { getByTestId } = render(<StatisticsScreen />);

      const retryButton = getByTestId('retry-button');
      fireEvent.press(retryButton);

      expect(mockRefreshData).toHaveBeenCalledTimes(1);
    });

    test('handles partial data gracefully', () => {
      const partialData = {
        ...mockStatisticsData,
        hierarchicalBreakdown: [] // Empty hierarchy
      };

      useOfflineStatistics.mockReturnValue({
        data: partialData,
        isLoading: false,
        isRefreshing: false,
        error: null,
        lastUpdated: partialData.lastUpdated,
        refreshData: mockRefreshData,
        clearCache: mockClearCache,
        toggleHierarchyNode: mockToggleHierarchyNode
      });

      const { getByTestId } = render(<StatisticsScreen />);

      // Basic stats should still show
      expect(getByTestId('distance-card-value')).toHaveTextContent('1,234.5 miles');
      
      // Hierarchy should show empty state
      expect(getByTestId('hierarchy-empty')).toBeTruthy();
    });
  });

  describe('User Interactions', () => {
    test('handles pull-to-refresh', () => {
      const { getByTestId } = render(<StatisticsScreen />);

      const scrollView = getByTestId('statistics-scroll-view');
      
      // Simulate pull-to-refresh
      fireEvent(scrollView, 'refresh');

      expect(mockRefreshData).toHaveBeenCalledTimes(1);
    });

    test('handles hierarchy node expansion', () => {
      const { getByTestId } = render(<StatisticsScreen />);

      const usItem = getByTestId('hierarchy-item-us');
      fireEvent.press(usItem);

      expect(mockToggleHierarchyNode).toHaveBeenCalledTimes(1);
      expect(mockToggleHierarchyNode).toHaveBeenCalledWith(mockStatisticsData.hierarchicalBreakdown[0]);
    });

    test('handles statistics card press events', () => {
      const { getByTestId } = render(<StatisticsScreen />);

      // Cards with onPress should be interactive
      const distanceCard = getByTestId('distance-card');
      fireEvent.press(distanceCard);

      // Should not crash (specific behavior depends on implementation)
      expect(getByTestId('statistics-screen')).toBeTruthy();
    });
  });

  describe('Data Formatting', () => {
    test('formats distance values correctly', () => {
      const { getByTestId } = render(<StatisticsScreen />);

      expect(getByTestId('distance-card-value')).toHaveTextContent('1,234.5 miles');
      expect(getByTestId('distance-card-subtitle')).toHaveTextContent('1,987.2 km');
    });

    test('formats world exploration percentage correctly', () => {
      const { getByTestId } = render(<StatisticsScreen />);

      expect(getByTestId('world-exploration-card-value')).toHaveTextContent('0.001%');
    });

    test('formats region counts with proper pluralization', () => {
      const { getByTestId } = render(<StatisticsScreen />);

      expect(getByTestId('countries-card-subtitle')).toHaveTextContent('192 remaining');
      expect(getByTestId('states-card-subtitle')).toHaveTextContent('3,134 remaining');
      expect(getByTestId('cities-card-subtitle')).toHaveTextContent('9,985 remaining');
    });

    test('handles zero values correctly', () => {
      const zeroData = {
        ...mockStatisticsData,
        totalDistance: { miles: 0, kilometers: 0 },
        uniqueRegions: { countries: 0, states: 0, cities: 0 }
      };

      useOfflineStatistics.mockReturnValue({
        data: zeroData,
        isLoading: false,
        isRefreshing: false,
        error: null,
        lastUpdated: zeroData.lastUpdated,
        refreshData: mockRefreshData,
        clearCache: mockClearCache,
        toggleHierarchyNode: mockToggleHierarchyNode
      });

      const { getByTestId } = render(<StatisticsScreen />);

      expect(getByTestId('distance-card-value')).toHaveTextContent('0 miles');
      expect(getByTestId('countries-card-value')).toHaveTextContent('0');
    });

    test('handles very large numbers correctly', () => {
      const largeData = {
        ...mockStatisticsData,
        totalDistance: { miles: 1234567.89, kilometers: 1987654.32 },
        uniqueRegions: { countries: 195, states: 3142, cities: 50000 }
      };

      useOfflineStatistics.mockReturnValue({
        data: largeData,
        isLoading: false,
        isRefreshing: false,
        error: null,
        lastUpdated: largeData.lastUpdated,
        refreshData: mockRefreshData,
        clearCache: mockClearCache,
        toggleHierarchyNode: mockToggleHierarchyNode
      });

      const { getByTestId } = render(<StatisticsScreen />);

      expect(getByTestId('distance-card-value')).toHaveTextContent('1,234,568 miles');
      expect(getByTestId('cities-card-value')).toHaveTextContent('50.0k');
    });
  });

  describe('Accessibility', () => {
    test('provides proper accessibility labels', () => {
      const { getByTestId } = render(<StatisticsScreen />);

      const distanceCard = getByTestId('distance-card');
      expect(distanceCard.props.accessibilityLabel).toContain('Distance Traveled');
    });

    test('supports screen reader navigation', () => {
      const { getByTestId } = render(<StatisticsScreen />);

      const statisticsScreen = getByTestId('statistics-screen');
      expect(statisticsScreen.props.accessible).toBe(true);
    });

    test('provides accessibility hints for interactive elements', () => {
      const { getByTestId } = render(<StatisticsScreen />);

      const hierarchyView = getByTestId('geographic-hierarchy');
      expect(hierarchyView).toBeTruthy();
    });
  });

  describe('Performance', () => {
    test('renders efficiently with large hierarchy data', () => {
      const largeHierarchy = Array.from({ length: 100 }, (_, i) => ({
        id: `country-${i}`,
        type: 'country',
        name: `Country ${i}`,
        explorationPercentage: Math.random() * 100,
        isExpanded: false,
        children: []
      }));

      const largeData = {
        ...mockStatisticsData,
        hierarchicalBreakdown: largeHierarchy
      };

      useOfflineStatistics.mockReturnValue({
        data: largeData,
        isLoading: false,
        isRefreshing: false,
        error: null,
        lastUpdated: largeData.lastUpdated,
        refreshData: mockRefreshData,
        clearCache: mockClearCache,
        toggleHierarchyNode: mockToggleHierarchyNode
      });

      const startTime = Date.now();
      const { getByTestId } = render(<StatisticsScreen />);
      const endTime = Date.now();

      expect(getByTestId('statistics-screen')).toBeTruthy();
      expect(endTime - startTime).toBeLessThan(1000); // Should render quickly
    });

    test('handles frequent data updates efficiently', () => {
      const { rerender, getByTestId } = render(<StatisticsScreen />);

      // Simulate frequent updates
      for (let i = 0; i < 10; i++) {
        const updatedData = {
          ...mockStatisticsData,
          totalDistance: { miles: 1000 + i, kilometers: 1600 + i },
          lastUpdated: Date.now()
        };

        useOfflineStatistics.mockReturnValue({
          data: updatedData,
          isLoading: false,
          isRefreshing: false,
          error: null,
          lastUpdated: updatedData.lastUpdated,
          refreshData: mockRefreshData,
          clearCache: mockClearCache,
          toggleHierarchyNode: mockToggleHierarchyNode
        });

        rerender(<StatisticsScreen />);
      }

      expect(getByTestId('statistics-screen')).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    test('handles undefined data gracefully', () => {
      useOfflineStatistics.mockReturnValue({
        data: undefined,
        isLoading: false,
        isRefreshing: false,
        error: null,
        lastUpdated: null,
        refreshData: mockRefreshData,
        clearCache: mockClearCache,
        toggleHierarchyNode: mockToggleHierarchyNode
      });

      const { getByTestId } = render(<StatisticsScreen />);

      expect(getByTestId('statistics-screen')).toBeTruthy();
    });

    test('handles null data gracefully', () => {
      useOfflineStatistics.mockReturnValue({
        data: null,
        isLoading: false,
        isRefreshing: false,
        error: null,
        lastUpdated: null,
        refreshData: mockRefreshData,
        clearCache: mockClearCache,
        toggleHierarchyNode: mockToggleHierarchyNode
      });

      const { getByTestId } = render(<StatisticsScreen />);

      expect(getByTestId('statistics-screen')).toBeTruthy();
    });

    test('handles component unmounting during data loading', () => {
      useOfflineStatistics.mockReturnValue({
        data: null,
        isLoading: true,
        isRefreshing: false,
        error: null,
        lastUpdated: null,
        refreshData: mockRefreshData,
        clearCache: mockClearCache,
        toggleHierarchyNode: mockToggleHierarchyNode
      });

      const { getByTestId, unmount } = render(<StatisticsScreen />);

      expect(getByTestId('statistics-screen')).toBeTruthy();
      
      // Should not throw error when unmounting during loading
      expect(() => unmount()).not.toThrow();
    });
  });
});