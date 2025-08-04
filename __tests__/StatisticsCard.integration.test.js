import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import { StatisticsCard } from '../components/StatisticsCard';

// Mock the themed components and hooks
jest.mock('@/components/ThemedText', () => ({
  ThemedText: ({ children, style, type, accessibilityLabel, accessibilityRole, ...props }) => {
    const { Text } = require('react-native');
    return (
      <Text 
        style={style} 
        accessibilityLabel={accessibilityLabel}
        accessibilityRole={accessibilityRole}
        testID={`themed-text-${type || 'default'}`}
        {...props}
      >
        {children}
      </Text>
    );
  }
}));

jest.mock('@/hooks/useThemeColor', () => ({
  useThemeColor: jest.fn((colors, colorName) => {
    const mockColors = {
      background: '#FFFFFF',
      text: '#000000',
      tint: '#0a7ea4'
    };
    return colors?.light || mockColors[colorName] || '#000000';
  })
}));

describe('StatisticsCard Integration Tests', () => {
  const defaultProps = {
    title: 'Distance Traveled',
    value: '125.5 miles',
    testID: 'statistics-card'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    test('renders with required props', () => {
      const { getByTestId, getByText } = render(
        <StatisticsCard {...defaultProps} />
      );

      expect(getByTestId('statistics-card')).toBeTruthy();
      expect(getByText('Distance Traveled')).toBeTruthy();
      expect(getByText('125.5 miles')).toBeTruthy();
    });

    test('renders with all optional props', () => {
      const { getByTestId, getByText } = render(
        <StatisticsCard
          {...defaultProps}
          subtitle="Total distance across all journeys"
          icon="🚶"
          progressPercentage={75}
          onPress={() => {}}
        />
      );

      expect(getByTestId('statistics-card')).toBeTruthy();
      expect(getByText('Distance Traveled')).toBeTruthy();
      expect(getByText('125.5 miles')).toBeTruthy();
      expect(getByText('Total distance across all journeys')).toBeTruthy();
      expect(getByText('🚶')).toBeTruthy();
    });

    test('renders numeric values correctly', () => {
      const { getByText } = render(
        <StatisticsCard
          title="Countries Visited"
          value={42}
          testID="countries-card"
        />
      );

      expect(getByText('42')).toBeTruthy();
    });

    test('renders zero values correctly', () => {
      const { getByText } = render(
        <StatisticsCard
          title="Cities Visited"
          value={0}
          testID="cities-card"
        />
      );

      expect(getByText('0')).toBeTruthy();
    });
  });

  describe('Loading States', () => {
    test('shows loading state when isLoading is true', () => {
      const { getByTestId, queryByText } = render(
        <StatisticsCard
          {...defaultProps}
          isLoading={true}
        />
      );

      expect(getByTestId('statistics-card')).toBeTruthy();
      // Content should not be visible during loading
      expect(queryByText('Distance Traveled')).toBeFalsy();
      expect(queryByText('125.5 miles')).toBeFalsy();
    });

    test('shows content when loading completes', async () => {
      const { getByTestId, getByText, rerender } = render(
        <StatisticsCard
          {...defaultProps}
          isLoading={true}
        />
      );

      // Initially loading
      expect(getByTestId('statistics-card')).toBeTruthy();

      // Update to loaded state
      rerender(
        <StatisticsCard
          {...defaultProps}
          isLoading={false}
        />
      );

      await waitFor(() => {
        expect(getByText('Distance Traveled')).toBeTruthy();
        expect(getByText('125.5 miles')).toBeTruthy();
      });
    });

    test('handles loading state transitions smoothly', async () => {
      const { getByTestId, rerender } = render(
        <StatisticsCard
          title="World Explored"
          value="0.001%"
          isLoading={true}
          testID="world-card"
        />
      );

      expect(getByTestId('world-card')).toBeTruthy();

      // Transition to loaded
      rerender(
        <StatisticsCard
          title="World Explored"
          value="0.001%"
          isLoading={false}
          testID="world-card"
        />
      );

      await waitFor(() => {
        expect(getByTestId('world-card')).toBeTruthy();
      });
    });
  });

  describe('Progress Bar Integration', () => {
    test('renders progress bar when progressPercentage is provided', () => {
      const { getByTestId } = render(
        <StatisticsCard
          {...defaultProps}
          progressPercentage={65}
        />
      );

      const card = getByTestId('statistics-card');
      expect(card).toBeTruthy();
      
      // Progress bar should be rendered (we can't easily test the visual aspect in unit tests)
      // but we can verify the component renders without errors
    });

    test('handles progress percentage edge cases', () => {
      const testCases = [
        { percentage: 0, description: 'zero progress' },
        { percentage: 100, description: 'full progress' },
        { percentage: 150, description: 'over 100%' },
        { percentage: -10, description: 'negative progress' }
      ];

      testCases.forEach(({ percentage, description }) => {
        const { getByTestId } = render(
          <StatisticsCard
            title={`Test ${description}`}
            value="Test Value"
            progressPercentage={percentage}
            testID={`test-${percentage}`}
          />
        );

        expect(getByTestId(`test-${percentage}`)).toBeTruthy();
      });
    });

    test('renders without progress bar when progressPercentage is undefined', () => {
      const { getByTestId } = render(
        <StatisticsCard
          {...defaultProps}
          progressPercentage={undefined}
        />
      );

      expect(getByTestId('statistics-card')).toBeTruthy();
    });
  });

  describe('Interaction Handling', () => {
    test('handles press events when onPress is provided', () => {
      const mockOnPress = jest.fn();
      const { getByTestId } = render(
        <StatisticsCard
          {...defaultProps}
          onPress={mockOnPress}
        />
      );

      const card = getByTestId('statistics-card');
      fireEvent.press(card);

      expect(mockOnPress).toHaveBeenCalledTimes(1);
    });

    test('does not handle press events when onPress is not provided', () => {
      const { getByTestId } = render(
        <StatisticsCard {...defaultProps} />
      );

      const card = getByTestId('statistics-card');
      
      // Should not throw error when pressed without onPress handler
      expect(() => fireEvent.press(card)).not.toThrow();
    });

    test('handles multiple rapid presses', () => {
      const mockOnPress = jest.fn();
      const { getByTestId } = render(
        <StatisticsCard
          {...defaultProps}
          onPress={mockOnPress}
        />
      );

      const card = getByTestId('statistics-card');
      
      // Rapid presses
      fireEvent.press(card);
      fireEvent.press(card);
      fireEvent.press(card);

      expect(mockOnPress).toHaveBeenCalledTimes(3);
    });
  });

  describe('Accessibility Integration', () => {
    test('provides proper accessibility labels', () => {
      const { getByTestId } = render(
        <StatisticsCard
          title="Countries Visited"
          value={15}
          subtitle="Out of 195 total countries"
          testID="countries-card"
        />
      );

      const card = getByTestId('countries-card');
      expect(card.props.accessibilityLabel).toBe('Statistics card: Countries Visited');
    });

    test('sets correct accessibility role for interactive cards', () => {
      const { getByTestId } = render(
        <StatisticsCard
          {...defaultProps}
          onPress={() => {}}
        />
      );

      const card = getByTestId('statistics-card');
      expect(card.props.accessibilityRole).toBe('button');
    });

    test('sets correct accessibility role for non-interactive cards', () => {
      const { getByTestId } = render(
        <StatisticsCard {...defaultProps} />
      );

      const card = getByTestId('statistics-card');
      expect(card.props.accessibilityRole).toBe('text');
    });

    test('provides accessibility hint for interactive cards', () => {
      const { getByTestId } = render(
        <StatisticsCard
          {...defaultProps}
          onPress={() => {}}
        />
      );

      const card = getByTestId('statistics-card');
      expect(card.props.accessibilityHint).toBe('Tap for more details');
    });

    test('does not provide accessibility hint for non-interactive cards', () => {
      const { getByTestId } = render(
        <StatisticsCard {...defaultProps} />
      );

      const card = getByTestId('statistics-card');
      expect(card.props.accessibilityHint).toBeUndefined();
    });
  });

  describe('Data State Variations', () => {
    test('handles very large numbers', () => {
      const { getByText } = render(
        <StatisticsCard
          title="Total Steps"
          value="1,234,567,890"
          testID="steps-card"
        />
      );

      expect(getByText('1,234,567,890')).toBeTruthy();
    });

    test('handles very small decimal numbers', () => {
      const { getByText } = render(
        <StatisticsCard
          title="World Explored"
          value="0.00001%"
          testID="world-card"
        />
      );

      expect(getByText('0.00001%')).toBeTruthy();
    });

    test('handles empty string values gracefully', () => {
      const { getByTestId } = render(
        <StatisticsCard
          title="Test Card"
          value=""
          testID="empty-card"
        />
      );

      expect(getByTestId('empty-card')).toBeTruthy();
    });

    test('handles special characters in values', () => {
      const { getByText } = render(
        <StatisticsCard
          title="Special Data"
          value="N/A - No data available"
          testID="special-card"
        />
      );

      expect(getByText('N/A - No data available')).toBeTruthy();
    });
  });

  describe('Theme Integration', () => {
    test('applies theme colors correctly', () => {
      const mockUseThemeColor = require('@/hooks/useThemeColor').useThemeColor;
      
      mockUseThemeColor.mockImplementation((colors, colorName) => {
        const darkTheme = {
          background: '#1F2937',
          text: '#F9FAFB',
          tint: '#60A5FA'
        };
        return colors?.dark || darkTheme[colorName] || '#F9FAFB';
      });

      const { getByTestId } = render(
        <StatisticsCard {...defaultProps} />
      );

      expect(getByTestId('statistics-card')).toBeTruthy();
      expect(mockUseThemeColor).toHaveBeenCalled();
    });

    test('handles theme changes dynamically', () => {
      const mockUseThemeColor = require('@/hooks/useThemeColor').useThemeColor;
      
      // Start with light theme
      mockUseThemeColor.mockImplementation(() => '#FFFFFF');
      
      const { getByTestId, rerender } = render(
        <StatisticsCard {...defaultProps} />
      );

      expect(getByTestId('statistics-card')).toBeTruthy();

      // Switch to dark theme
      mockUseThemeColor.mockImplementation(() => '#1F2937');
      
      rerender(<StatisticsCard {...defaultProps} />);

      expect(getByTestId('statistics-card')).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    test('handles undefined props gracefully', () => {
      const { getByTestId } = render(
        <StatisticsCard
          title="Test"
          value={undefined}
          testID="undefined-card"
        />
      );

      expect(getByTestId('undefined-card')).toBeTruthy();
    });

    test('handles null props gracefully', () => {
      const { getByTestId } = render(
        <StatisticsCard
          title="Test"
          value={null}
          testID="null-card"
        />
      );

      expect(getByTestId('null-card')).toBeTruthy();
    });

    test('handles component unmounting during loading', () => {
      const { getByTestId, unmount } = render(
        <StatisticsCard
          {...defaultProps}
          isLoading={true}
        />
      );

      expect(getByTestId('statistics-card')).toBeTruthy();
      
      // Should not throw error when unmounting during loading
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('Performance Considerations', () => {
    test('renders efficiently with minimal props', () => {
      const startTime = Date.now();
      
      const { getByTestId } = render(
        <StatisticsCard
          title="Performance Test"
          value="Test Value"
          testID="perf-card"
        />
      );

      const endTime = Date.now();
      const renderTime = endTime - startTime;

      expect(getByTestId('perf-card')).toBeTruthy();
      expect(renderTime).toBeLessThan(100); // Should render quickly
    });

    test('handles frequent prop updates efficiently', () => {
      const { getByTestId, rerender } = render(
        <StatisticsCard
          title="Update Test"
          value="Initial Value"
          testID="update-card"
        />
      );

      expect(getByTestId('update-card')).toBeTruthy();

      // Simulate frequent updates
      for (let i = 0; i < 10; i++) {
        rerender(
          <StatisticsCard
            title="Update Test"
            value={`Updated Value ${i}`}
            testID="update-card"
          />
        );
      }

      expect(getByTestId('update-card')).toBeTruthy();
    });
  });
});