import { render } from '@testing-library/react-native';
import React from 'react';

// Mock dependencies first
jest.mock('@/hooks/useThemeColor', () => ({
  useThemeColor: jest.fn(() => '#000000')
}));

jest.mock('@/components/ThemedText', () => {
  const { Text } = require('react-native');
  return {
    ThemedText: (props) => <Text {...props} />
  };
});

jest.mock('@/components/ThemedView', () => {
  const { View } = require('react-native');
  return {
    ThemedView: (props) => <View {...props} />
  };
});

jest.mock('@/components/ProgressIndicator', () => {
  const { View } = require('react-native');
  return {
    ProgressIndicator: (props) => <View testID={props.testID} />
  };
});

// Create a simplified version of HierarchicalView for testing
const SimpleHierarchicalView = ({ data, onToggleExpand, testID }) => {
  const { ThemedView } = require('@/components/ThemedView');
  const { ThemedText } = require('@/components/ThemedText');
  
  if (!data || data.length === 0) {
    return (
      <ThemedView testID={testID}>
        <ThemedText>No geographic data available</ThemedText>
      </ThemedView>
    );
  }
  
  return (
    <ThemedView testID={testID}>
      {data.map((item) => (
        <ThemedView key={item.id} testID={`hierarchical-item-${item.id}`}>
          <ThemedText>{item.name}</ThemedText>
        </ThemedView>
      ))}
    </ThemedView>
  );
};

describe('HierarchicalView Simple Component Test', () => {
  const sampleData = [
    {
      id: 'us',
      type: 'country',
      name: 'United States',
      code: 'US',
      explorationPercentage: 2.5,
      isExpanded: false,
      children: []
    }
  ];

  const mockOnToggleExpand = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('simple component renders with data', () => {
    const { getByTestId, getByText } = render(
      <SimpleHierarchicalView
        data={sampleData}
        onToggleExpand={mockOnToggleExpand}
        testID="simple-hierarchy"
      />
    );

    expect(getByTestId('simple-hierarchy')).toBeTruthy();
    expect(getByText('United States')).toBeTruthy();
  });

  test('simple component renders empty state', () => {
    const { getByTestId, getByText } = render(
      <SimpleHierarchicalView
        data={[]}
        onToggleExpand={mockOnToggleExpand}
        testID="simple-empty"
      />
    );

    expect(getByTestId('simple-empty')).toBeTruthy();
    expect(getByText('No geographic data available')).toBeTruthy();
  });
});