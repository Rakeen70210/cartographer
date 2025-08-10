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
    FlatList: mockComponent('FlatList'), // Simple mock that doesn't try to render items
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

// Import component after all mocks are set up
import { HierarchicalView } from '@/components/HierarchicalView';

describe('HierarchicalView Integration Tests (Final)', () => {
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

  test('renders with sample data', () => {
    const { getByTestId } = render(
      <HierarchicalView
        data={sampleData}
        onToggleExpand={mockOnToggleExpand}
        testID="hierarchy-view"
      />
    );

    expect(getByTestId('hierarchy-view')).toBeTruthy();
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
});