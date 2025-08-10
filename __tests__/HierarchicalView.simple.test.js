// Simple test to verify HierarchicalView can be imported
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
  const { View, Text } = require('react-native');
  return {
    ProgressIndicator: ({ percentage, testID }) => (
      <View testID={testID}>
        <Text testID="progress-percentage">{percentage}%</Text>
      </View>
    )
  };
});

describe('HierarchicalView Import Test', () => {
  test('can import HierarchicalView component', () => {
    const { HierarchicalView } = require('@/components/HierarchicalView');
    expect(HierarchicalView).toBeDefined();
    expect(typeof HierarchicalView).toBe('function');
  });
});