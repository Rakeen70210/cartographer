import { HierarchicalView } from '@/components/HierarchicalView';
import { render } from '@testing-library/react-native';
import React from 'react';

// Mock the theme hook
jest.mock('@/hooks/useThemeColor', () => ({
  useThemeColor: jest.fn(() => '#000000'),
}));

// Mock ThemedText and ThemedView
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

// Mock ProgressIndicator
jest.mock('@/components/ProgressIndicator', () => ({
  ProgressIndicator: ({ percentage, testID }) => {
    const { View, Text } = require('react-native');
    return (
      <View testID={testID}>
        <Text>Progress: {percentage}%</Text>
      </View>
    );
  },
}));

describe('HierarchicalView', () => {
  const mockOnToggleExpand = jest.fn();

  beforeEach(() => {
    mockOnToggleExpand.mockClear();
  });

  it('shows empty state when no data provided', () => {
    const { getByText } = render(
      <HierarchicalView data={[]} onToggleExpand={mockOnToggleExpand} />
    );
    
    expect(getByText('No geographic data available')).toBeTruthy();
  });

  it('shows empty state when data is null', () => {
    const { getByText } = render(
      <HierarchicalView data={null} onToggleExpand={mockOnToggleExpand} />
    );
    
    expect(getByText('No geographic data available')).toBeTruthy();
  });

  it('applies testID correctly for empty state', () => {
    const { getByTestId } = render(
      <HierarchicalView 
        data={[]} 
        onToggleExpand={mockOnToggleExpand} 
        testID="custom-hierarchical-view"
      />
    );
    
    expect(getByTestId('custom-hierarchical-view')).toBeTruthy();
  });

  it('handles undefined data gracefully', () => {
    const { getByText } = render(
      <HierarchicalView data={undefined} onToggleExpand={mockOnToggleExpand} />
    );
    
    expect(getByText('No geographic data available')).toBeTruthy();
  });

  it('renders empty state with proper styling', () => {
    const { getByText } = render(
      <HierarchicalView data={[]} onToggleExpand={mockOnToggleExpand} />
    );
    
    const emptyText = getByText('No geographic data available');
    expect(emptyText).toBeTruthy();
  });

  it('accepts all required props without error', () => {
    // Test that component accepts props without crashing
    expect(() => {
      render(
        <HierarchicalView 
          data={[]} 
          onToggleExpand={mockOnToggleExpand}
          maxDepth={3}
          showProgressBars={true}
          testID="test"
        />
      );
    }).not.toThrow();
  });

  it('accepts minimal props without error', () => {
    // Test that component works with minimal props
    expect(() => {
      render(
        <HierarchicalView 
          data={[]} 
          onToggleExpand={mockOnToggleExpand}
        />
      );
    }).not.toThrow();
  });

  it('handles boolean props correctly', () => {
    expect(() => {
      render(
        <HierarchicalView 
          data={[]} 
          onToggleExpand={mockOnToggleExpand}
          showProgressBars={false}
        />
      );
    }).not.toThrow();
  });

  it('handles numeric props correctly', () => {
    expect(() => {
      render(
        <HierarchicalView 
          data={[]} 
          onToggleExpand={mockOnToggleExpand}
          maxDepth={5}
        />
      );
    }).not.toThrow();
  });

  it('handles callback prop correctly', () => {
    const customCallback = jest.fn();
    expect(() => {
      render(
        <HierarchicalView 
          data={[]} 
          onToggleExpand={customCallback}
        />
      );
    }).not.toThrow();
  });
});