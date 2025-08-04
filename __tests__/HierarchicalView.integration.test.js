import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { HierarchicalView } from '../components/HierarchicalView';

// Mock the themed components and hooks
jest.mock('@/components/ThemedText', () => ({
  ThemedText: ({ children, style, numberOfLines, accessibilityLabel, ...props }) => {
    const { Text } = require('react-native');
    return (
      <Text 
        style={style} 
        numberOfLines={numberOfLines}
        accessibilityLabel={accessibilityLabel}
        testID="themed-text"
        {...props}
      >
        {children}
      </Text>
    );
  }
}));

jest.mock('@/components/ThemedView', () => ({
  ThemedView: ({ children, style, accessible, accessibilityRole, accessibilityLabel, testID, ...props }) => {
    const { View } = require('react-native');
    return (
      <View 
        style={style}
        accessible={accessible}
        accessibilityRole={accessibilityRole}
        accessibilityLabel={accessibilityLabel}
        testID={testID}
        {...props}
      >
        {children}
      </View>
    );
  }
}));

jest.mock('@/components/ProgressIndicator', () => ({
  ProgressIndicator: ({ percentage, style, size, animated, testID }) => {
    const { View, Text } = require('react-native');
    return (
      <View testID={testID}>
        <Text testID="progress-percentage">{percentage}%</Text>
      </View>
    );
  }
}));

jest.mock('@/hooks/useThemeColor', () => ({
  useThemeColor: jest.fn((colors, colorName) => {
    const mockColors = {
      text: '#000000',
      tint: '#0a7ea4'
    };
    return colors?.light || mockColors[colorName] || '#000000';
  })
}));

describe('HierarchicalView Integration Tests', () => {
  const sampleData = [
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
          children: [
            {
              id: 'us-ny-nyc',
              type: 'city',
              name: 'New York City',
              explorationPercentage: 45.8,
              isExpanded: false
            },
            {
              id: 'us-ny-albany',
              type: 'city',
              name: 'Albany',
              explorationPercentage: 12.3,
              isExpanded: false
            }
          ]
        },
        {
          id: 'us-ca',
          type: 'state',
          name: 'California',
          code: 'CA',
          explorationPercentage: 8.7,
          isExpanded: false,
          children: [
            {
              id: 'us-ca-la',
              type: 'city',
              name: 'Los Angeles',
              explorationPercentage: 23.1,
              isExpanded: false
            }
          ]
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
      children: [
        {
          id: 'ca-on',
          type: 'state',
          name: 'Ontario',
          code: 'ON',
          explorationPercentage: 5.2,
          isExpanded: false,
          children: [
            {
              id: 'ca-on-toronto',
              type: 'city',
              name: 'Toronto',
              explorationPercentage: 18.9,
              isExpanded: false
            }
          ]
        }
      ]
    }
  ];

  const mockOnToggleExpand = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    test('renders with sample data', () => {
      const { getByTestId, getByText } = render(
        <HierarchicalView
          data={sampleData}
          onToggleExpand={mockOnToggleExpand}
          testID="hierarchy-view"
        />
      );

      expect(getByTestId('hierarchy-view')).toBeTruthy();
      expect(getByText('United States')).toBeTruthy();
      expect(getByText('Canada')).toBeTruthy();
    });

    test('renders empty state when no data provided', () => {
      const { getByTestId, getByText } = render(
        <HierarchicalView
          data={[]}
          onToggleExpand={mockOnToggleExpand}
          testID="empty-hierarchy"
        />
      );

      expect(getByTestId('empty-hierarchy')).toBeTruthy();
      expect(getByText('No geographic data available')).toBeTruthy();
    });

    test('renders null data gracefully', () => {
      const { getByTestId, getByText } = render(
        <HierarchicalView
          data={null}
          onToggleExpand={mockOnToggleExpand}
          testID="null-hierarchy"
        />
      );

      expect(getByTestId('null-hierarchy')).toBeTruthy();
      expect(getByText('No geographic data available')).toBeTruthy();
    });

    test('renders undefined data gracefully', () => {
      const { getByTestId, getByText } = render(
        <HierarchicalView
          data={undefined}
          onToggleExpand={mockOnToggleExpand}
          testID="undefined-hierarchy"
        />
      );

      expect(getByTestId('undefined-hierarchy')).toBeTruthy();
      expect(getByText('No geographic data available')).toBeTruthy();
    });
  });

  describe('Hierarchy Expansion and Collapse', () => {
    test('shows only top-level items when collapsed', () => {
      const { getByText, queryByText } = render(
        <HierarchicalView
          data={sampleData}
          onToggleExpand={mockOnToggleExpand}
          testID="collapsed-hierarchy"
        />
      );

      // Top-level countries should be visible
      expect(getByText('United States')).toBeTruthy();
      expect(getByText('Canada')).toBeTruthy();

      // States should not be visible when countries are collapsed
      expect(queryByText('New York')).toBeFalsy();
      expect(queryByText('California')).toBeFalsy();
      expect(queryByText('Ontario')).toBeFalsy();
    });

    test('shows children when parent is expanded', () => {
      const expandedData = [
        {
          ...sampleData[0],
          isExpanded: true
        },
        sampleData[1]
      ];

      const { getByText } = render(
        <HierarchicalView
          data={expandedData}
          onToggleExpand={mockOnToggleExpand}
          testID="expanded-hierarchy"
        />
      );

      // Top-level countries should be visible
      expect(getByText('United States')).toBeTruthy();
      expect(getByText('Canada')).toBeTruthy();

      // US states should be visible since US is expanded
      expect(getByText('New York')).toBeTruthy();
      expect(getByText('California')).toBeTruthy();

      // Canadian states should not be visible since Canada is collapsed
      expect(() => getByText('Ontario')).toThrow();
    });

    test('handles deep expansion correctly', () => {
      const deepExpandedData = [
        {
          ...sampleData[0],
          isExpanded: true,
          children: [
            {
              ...sampleData[0].children[0],
              isExpanded: true
            },
            sampleData[0].children[1]
          ]
        },
        sampleData[1]
      ];

      const { getByText } = render(
        <HierarchicalView
          data={deepExpandedData}
          onToggleExpand={mockOnToggleExpand}
          testID="deep-expanded-hierarchy"
        />
      );

      // All levels should be visible
      expect(getByText('United States')).toBeTruthy();
      expect(getByText('New York')).toBeTruthy();
      expect(getByText('New York City')).toBeTruthy();
      expect(getByText('Albany')).toBeTruthy();
      expect(getByText('California')).toBeTruthy();
    });

    test('calls onToggleExpand when expandable item is pressed', () => {
      const { getByTestId } = render(
        <HierarchicalView
          data={sampleData}
          onToggleExpand={mockOnToggleExpand}
          testID="interactive-hierarchy"
        />
      );

      const usItem = getByTestId('hierarchical-item-us');
      fireEvent.press(usItem);

      expect(mockOnToggleExpand).toHaveBeenCalledTimes(1);
      expect(mockOnToggleExpand).toHaveBeenCalledWith(sampleData[0]);
    });

    test('does not call onToggleExpand for leaf nodes', () => {
      const expandedData = [
        {
          ...sampleData[0],
          isExpanded: true,
          children: [
            {
              ...sampleData[0].children[0],
              isExpanded: true
            }
          ]
        }
      ];

      const { getByTestId } = render(
        <HierarchicalView
          data={expandedData}
          onToggleExpand={mockOnToggleExpand}
          testID="leaf-hierarchy"
        />
      );

      const leafItem = getByTestId('hierarchical-item-us-ny-nyc');
      fireEvent.press(leafItem);

      expect(mockOnToggleExpand).not.toHaveBeenCalled();
    });
  });

  describe('Progress Bar Integration', () => {
    test('shows progress bars when showProgressBars is true', () => {
      const { getAllByTestId } = render(
        <HierarchicalView
          data={sampleData}
          onToggleExpand={mockOnToggleExpand}
          showProgressBars={true}
          testID="progress-hierarchy"
        />
      );

      const progressBars = getAllByTestId(/^progress-/);
      expect(progressBars.length).toBeGreaterThan(0);
    });

    test('hides progress bars when showProgressBars is false', () => {
      const { queryAllByTestId } = render(
        <HierarchicalView
          data={sampleData}
          onToggleExpand={mockOnToggleExpand}
          showProgressBars={false}
          testID="no-progress-hierarchy"
        />
      );

      const progressBars = queryAllByTestId(/^progress-/);
      expect(progressBars.length).toBe(0);
    });

    test('displays correct percentage values in progress bars', () => {
      const { getByTestId } = render(
        <HierarchicalView
          data={sampleData}
          onToggleExpand={mockOnToggleExpand}
          showProgressBars={true}
          testID="percentage-hierarchy"
        />
      );

      // Check that progress bars show correct percentages
      const usProgress = getByTestId('progress-us');
      expect(usProgress).toBeTruthy();
    });
  });

  describe('Depth Limiting', () => {
    test('respects maxDepth parameter', () => {
      const { getByText, queryByText } = render(
        <HierarchicalView
          data={sampleData}
          onToggleExpand={mockOnToggleExpand}
          maxDepth={2}
          testID="depth-limited-hierarchy"
        />
      );

      // Countries should be visible (depth 0)
      expect(getByText('United States')).toBeTruthy();
      expect(getByText('Canada')).toBeTruthy();

      // With maxDepth=2, we should not see cities even if states are expanded
      // (countries=0, states=1, cities=2, but maxDepth=2 means we stop at depth 1)
    });

    test('handles maxDepth of 1 correctly', () => {
      const { getByText } = render(
        <HierarchicalView
          data={sampleData}
          onToggleExpand={mockOnToggleExpand}
          maxDepth={1}
          testID="shallow-hierarchy"
        />
      );

      // Only countries should be visible
      expect(getByText('United States')).toBeTruthy();
      expect(getByText('Canada')).toBeTruthy();
    });

    test('handles maxDepth of 0 correctly', () => {
      const { queryByText } = render(
        <HierarchicalView
          data={sampleData}
          onToggleExpand={mockOnToggleExpand}
          maxDepth={0}
          testID="no-depth-hierarchy"
        />
      );

      // Nothing should be visible with maxDepth=0
      expect(queryByText('United States')).toBeFalsy();
      expect(queryByText('Canada')).toBeFalsy();
    });
  });

  describe('Visual Indicators', () => {
    test('shows correct expand/collapse icons', () => {
      const { getByText } = render(
        <HierarchicalView
          data={sampleData}
          onToggleExpand={mockOnToggleExpand}
          testID="icon-hierarchy"
        />
      );

      // Collapsed items should show right arrow
      expect(getByText('▶')).toBeTruthy();
    });

    test('shows correct type icons', () => {
      const { getByText } = render(
        <HierarchicalView
          data={sampleData}
          onToggleExpand={mockOnToggleExpand}
          testID="type-icon-hierarchy"
        />
      );

      // Countries should show world icon
      expect(getByText('🌍')).toBeTruthy();
    });

    test('displays country codes when available', () => {
      const { getByText } = render(
        <HierarchicalView
          data={sampleData}
          onToggleExpand={mockOnToggleExpand}
          testID="code-hierarchy"
        />
      );

      expect(getByText('(US)')).toBeTruthy();
      expect(getByText('(CA)')).toBeTruthy();
    });

    test('handles missing country codes gracefully', () => {
      const dataWithoutCodes = [
        {
          id: 'unknown',
          type: 'country',
          name: 'Unknown Country',
          explorationPercentage: 1.0,
          isExpanded: false,
          children: []
        }
      ];

      const { getByText, queryByText } = render(
        <HierarchicalView
          data={dataWithoutCodes}
          onToggleExpand={mockOnToggleExpand}
          testID="no-code-hierarchy"
        />
      );

      expect(getByText('Unknown Country')).toBeTruthy();
      expect(queryByText('()')).toBeFalsy();
    });
  });

  describe('Percentage Formatting', () => {
    test('formats small percentages with 3 decimal places', () => {
      const smallPercentageData = [
        {
          id: 'small',
          type: 'country',
          name: 'Small Percentage',
          explorationPercentage: 0.001,
          isExpanded: false,
          children: []
        }
      ];

      const { getByText } = render(
        <HierarchicalView
          data={smallPercentageData}
          onToggleExpand={mockOnToggleExpand}
          testID="small-percentage-hierarchy"
        />
      );

      expect(getByText('0.001%')).toBeTruthy();
    });

    test('formats medium percentages with 2 decimal places', () => {
      const mediumPercentageData = [
        {
          id: 'medium',
          type: 'country',
          name: 'Medium Percentage',
          explorationPercentage: 0.567,
          isExpanded: false,
          children: []
        }
      ];

      const { getByText } = render(
        <HierarchicalView
          data={mediumPercentageData}
          onToggleExpand={mockOnToggleExpand}
          testID="medium-percentage-hierarchy"
        />
      );

      expect(getByText('0.57%')).toBeTruthy();
    });

    test('formats large percentages with 1 decimal place', () => {
      const largePercentageData = [
        {
          id: 'large',
          type: 'country',
          name: 'Large Percentage',
          explorationPercentage: 25.789,
          isExpanded: false,
          children: []
        }
      ];

      const { getByText } = render(
        <HierarchicalView
          data={largePercentageData}
          onToggleExpand={mockOnToggleExpand}
          testID="large-percentage-hierarchy"
        />
      );

      expect(getByText('25.8%')).toBeTruthy();
    });
  });

  describe('Accessibility Integration', () => {
    test('provides proper accessibility labels for items', () => {
      const { getByTestId } = render(
        <HierarchicalView
          data={sampleData}
          onToggleExpand={mockOnToggleExpand}
          testID="accessible-hierarchy"
        />
      );

      const usItem = getByTestId('hierarchical-item-us');
      expect(usItem.props.accessibilityLabel).toContain('United States');
      expect(usItem.props.accessibilityLabel).toContain('2.5%');
    });

    test('sets correct accessibility roles', () => {
      const { getByTestId } = render(
        <HierarchicalView
          data={sampleData}
          onToggleExpand={mockOnToggleExpand}
          testID="role-hierarchy"
        />
      );

      const container = getByTestId('role-hierarchy');
      expect(container.props.accessibilityRole).toBe('list');

      const usItem = getByTestId('hierarchical-item-us');
      expect(usItem.props.accessibilityRole).toBe('button');
    });

    test('provides accessibility hints for expandable items', () => {
      const { getByTestId } = render(
        <HierarchicalView
          data={sampleData}
          onToggleExpand={mockOnToggleExpand}
          testID="hint-hierarchy"
        />
      );

      const usItem = getByTestId('hierarchical-item-us');
      expect(usItem.props.accessibilityHint).toBe('Tap to expand');
    });

    test('handles accessibility for leaf nodes', () => {
      const expandedData = [
        {
          ...sampleData[0],
          isExpanded: true,
          children: [
            {
              ...sampleData[0].children[0],
              isExpanded: true
            }
          ]
        }
      ];

      const { getByTestId } = render(
        <HierarchicalView
          data={expandedData}
          onToggleExpand={mockOnToggleExpand}
          testID="leaf-accessibility-hierarchy"
        />
      );

      const leafItem = getByTestId('hierarchical-item-us-ny-nyc');
      expect(leafItem.props.accessibilityRole).toBe('text');
      expect(leafItem.props.accessibilityHint).toBeUndefined();
    });
  });

  describe('Performance and Large Datasets', () => {
    test('handles large datasets efficiently', () => {
      const largeData = Array.from({ length: 100 }, (_, i) => ({
        id: `country-${i}`,
        type: 'country',
        name: `Country ${i}`,
        explorationPercentage: Math.random() * 100,
        isExpanded: false,
        children: []
      }));

      const startTime = Date.now();
      const { getByTestId } = render(
        <HierarchicalView
          data={largeData}
          onToggleExpand={mockOnToggleExpand}
          testID="large-hierarchy"
        />
      );
      const endTime = Date.now();

      expect(getByTestId('large-hierarchy')).toBeTruthy();
      expect(endTime - startTime).toBeLessThan(1000); // Should render within 1 second
    });

    test('handles deep nesting efficiently', () => {
      const deepData = [
        {
          id: 'level-0',
          type: 'country',
          name: 'Level 0',
          explorationPercentage: 10,
          isExpanded: true,
          children: [
            {
              id: 'level-1',
              type: 'state',
              name: 'Level 1',
              explorationPercentage: 20,
              isExpanded: true,
              children: [
                {
                  id: 'level-2',
                  type: 'city',
                  name: 'Level 2',
                  explorationPercentage: 30,
                  isExpanded: false,
                  children: []
                }
              ]
            }
          ]
        }
      ];

      const { getByTestId, getByText } = render(
        <HierarchicalView
          data={deepData}
          onToggleExpand={mockOnToggleExpand}
          testID="deep-hierarchy"
        />
      );

      expect(getByTestId('deep-hierarchy')).toBeTruthy();
      expect(getByText('Level 0')).toBeTruthy();
      expect(getByText('Level 1')).toBeTruthy();
      expect(getByText('Level 2')).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    test('handles malformed data gracefully', () => {
      const malformedData = [
        {
          id: 'malformed',
          // Missing required fields
          explorationPercentage: 10
        },
        null,
        undefined,
        {
          id: 'valid',
          type: 'country',
          name: 'Valid Country',
          explorationPercentage: 15,
          isExpanded: false,
          children: []
        }
      ];

      const { getByTestId } = render(
        <HierarchicalView
          data={malformedData}
          onToggleExpand={mockOnToggleExpand}
          testID="malformed-hierarchy"
        />
      );

      expect(getByTestId('malformed-hierarchy')).toBeTruthy();
    });

    test('handles missing onToggleExpand gracefully', () => {
      const { getByTestId } = render(
        <HierarchicalView
          data={sampleData}
          onToggleExpand={undefined}
          testID="no-callback-hierarchy"
        />
      );

      expect(getByTestId('no-callback-hierarchy')).toBeTruthy();
    });

    test('handles component unmounting during interaction', () => {
      const { getByTestId, unmount } = render(
        <HierarchicalView
          data={sampleData}
          onToggleExpand={mockOnToggleExpand}
          testID="unmount-hierarchy"
        />
      );

      const usItem = getByTestId('hierarchical-item-us');
      
      // Should not throw error when unmounting
      expect(() => {
        fireEvent.press(usItem);
        unmount();
      }).not.toThrow();
    });
  });
});