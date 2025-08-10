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

// Import component after mocks
import { HierarchicalView } from '@/components/HierarchicalView';

describe('HierarchicalView Minimal Test', () => {
  test('component can be imported and rendered', () => {
    expect(HierarchicalView).toBeDefined();
    expect(typeof HierarchicalView).toBe('function');
    
    const { getByTestId } = render(
      <HierarchicalView
        data={[]}
        onToggleExpand={jest.fn()}
        testID="test-hierarchical-view"
      />
    );
    
    expect(getByTestId('test-hierarchical-view')).toBeTruthy();
  });
});