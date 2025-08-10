import { render } from '@testing-library/react-native';
import React from 'react';

// Mock all react-native components used in HierarchicalView
jest.mock('react-native', () => {
  const mockComponent = (name) => {
    const MockedComponent = (props) => {
      const React = require('react');
      return React.createElement('View', {
        ...props,
        'data-component': name
      }, props.children);
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
    },
    View: mockComponent('View'),
    Text: mockComponent('Text'),
    TouchableOpacity: mockComponent('TouchableOpacity'),
    FlatList: (props) => {
      const React = require('react');
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
    }, // Mock that renders items
  };
});

// Mock dependencies
jest.mock('@/hooks/useThemeColor', () => ({
  useThemeColor: jest.fn(() => '#000000')
}));

jest.mock('@/components/ThemedText', () => {
  const mockComponent = (props) => {
    const React = require('react');
    return React.createElement('Text', props, props.children);
  };
  return {
    ThemedText: mockComponent
  };
});

jest.mock('@/components/ThemedView', () => {
  const mockComponent = (props) => {
    const React = require('react');
    return React.createElement('View', props, props.children);
  };
  return {
    ThemedView: mockComponent
  };
});

jest.mock('@/components/ProgressIndicator', () => {
  const mockComponent = (props) => {
    const React = require('react');
    return React.createElement('View', { testID: props.testID });
  };
  return {
    ProgressIndicator: mockComponent
  };
});

// Import component after mocks
import { HierarchicalView } from '@/components/HierarchicalView';

describe('HierarchicalView Integration Tests (Fixed V2)', () => {
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
          children: []
        }
      ]
    }
  ];

  const mockOnToggleExpand = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('component renders without crashing with data', () => {
    expect(() => {
      render(
        <HierarchicalView
          data={sampleData}
          onToggleExpand={mockOnToggleExpand}
          testID="hierarchy-view"
        />
      );
    }).not.toThrow();
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

  test('renders with data and shows content', () => {
    const { getByTestId, getByText } = render(
      <HierarchicalView
        data={sampleData}
        onToggleExpand={mockOnToggleExpand}
        testID="hierarchy-view"
      />
    );

    expect(getByTestId('hierarchy-view')).toBeTruthy();
    // The text is split across multiple Text components, so we need to check for the parts
    expect(getByText(/United States/)).toBeTruthy();
    expect(getByText('2.5%')).toBeTruthy();
  });
});