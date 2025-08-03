import { render } from '@testing-library/react-native';
import React from 'react';
import { ProgressIndicator } from './ProgressIndicator';

// Mock the theme hook
jest.mock('@/hooks/useThemeColor', () => ({
  useThemeColor: jest.fn(() => '#000000'),
}));

// Mock ThemedText
jest.mock('@/components/ThemedText', () => ({
  ThemedText: ({ children, ...props }) => {
    const { Text } = require('react-native');
    return <Text {...props}>{children}</Text>;
  },
}));

describe('ProgressIndicator', () => {
  const defaultProps = {
    percentage: 50,
    animated: false, // Disable animation for testing
  };

  it('renders bar progress indicator by default', () => {
    const { getByRole } = render(<ProgressIndicator {...defaultProps} />);
    
    const progressBar = getByRole('progressbar');
    expect(progressBar).toBeTruthy();
    expect(progressBar.props.accessibilityLabel).toBe('Progress: 50.0%');
  });

  it('renders circular progress indicator when style is circular', () => {
    const { getByRole } = render(
      <ProgressIndicator {...defaultProps} style="circular" />
    );
    
    const progressBar = getByRole('progressbar');
    expect(progressBar).toBeTruthy();
    expect(progressBar.props.accessibilityLabel).toBe('Circular progress: 50.0%');
  });

  it('shows label when showLabel is true', () => {
    const { getByText } = render(
      <ProgressIndicator {...defaultProps} showLabel={true} />
    );
    
    expect(getByText('50.0%')).toBeTruthy();
  });

  it('shows label for circular progress when showLabel is true', () => {
    const { getByText } = render(
      <ProgressIndicator {...defaultProps} style="circular" showLabel={true} />
    );
    
    expect(getByText('50%')).toBeTruthy();
  });

  it('clamps percentage to valid range', () => {
    const { getByRole, rerender } = render(
      <ProgressIndicator percentage={150} animated={false} />
    );
    
    let progressBar = getByRole('progressbar');
    expect(progressBar.props.accessibilityValue.now).toBe(100);
    
    rerender(<ProgressIndicator percentage={-10} animated={false} />);
    progressBar = getByRole('progressbar');
    expect(progressBar.props.accessibilityValue.now).toBe(0);
  });

  it('handles different sizes correctly', () => {
    const { getByRole, rerender } = render(
      <ProgressIndicator {...defaultProps} size="small" testID="progress-small" />
    );
    
    expect(getByRole('progressbar')).toBeTruthy();
    
    rerender(<ProgressIndicator {...defaultProps} size="large" testID="progress-large" />);
    expect(getByRole('progressbar')).toBeTruthy();
    
    rerender(<ProgressIndicator {...defaultProps} size="medium" testID="progress-medium" />);
    expect(getByRole('progressbar')).toBeTruthy();
  });

  it('handles circular progress with different sizes', () => {
    const { getByRole, rerender } = render(
      <ProgressIndicator {...defaultProps} style="circular" size="small" />
    );
    
    expect(getByRole('progressbar')).toBeTruthy();
    
    rerender(<ProgressIndicator {...defaultProps} style="circular" size="large" />);
    expect(getByRole('progressbar')).toBeTruthy();
  });

  it('applies custom colors when provided', () => {
    const { getByRole } = render(
      <ProgressIndicator 
        {...defaultProps} 
        color="#FF0000" 
        backgroundColor="#00FF00"
        testID="custom-colors"
      />
    );
    
    expect(getByRole('progressbar')).toBeTruthy();
  });

  it('has proper accessibility properties', () => {
    const { getByRole } = render(
      <ProgressIndicator {...defaultProps} testID="accessibility-test" />
    );
    
    const progressBar = getByRole('progressbar');
    expect(progressBar.props.accessibilityValue).toEqual({
      min: 0,
      max: 100,
      now: 50,
    });
    expect(progressBar.props.accessibilityLabel).toBe('Progress: 50.0%');
  });

  it('applies testID correctly', () => {
    const { getByTestId } = render(
      <ProgressIndicator {...defaultProps} testID="custom-test-id" />
    );
    
    expect(getByTestId('custom-test-id')).toBeTruthy();
  });

  it('handles zero percentage', () => {
    const { getByRole } = render(<ProgressIndicator percentage={0} animated={false} />);
    
    const progressBar = getByRole('progressbar');
    expect(progressBar.props.accessibilityValue.now).toBe(0);
    expect(progressBar.props.accessibilityLabel).toBe('Progress: 0.0%');
  });

  it('handles 100 percentage', () => {
    const { getByRole } = render(<ProgressIndicator percentage={100} animated={false} />);
    
    const progressBar = getByRole('progressbar');
    expect(progressBar.props.accessibilityValue.now).toBe(100);
    expect(progressBar.props.accessibilityLabel).toBe('Progress: 100.0%');
  });

  it('handles decimal percentages', () => {
    const { getByRole, getByText } = render(
      <ProgressIndicator percentage={33.7} showLabel={true} animated={false} />
    );
    
    const progressBar = getByRole('progressbar');
    expect(progressBar.props.accessibilityValue.now).toBe(33.7);
    expect(progressBar.props.accessibilityLabel).toBe('Progress: 33.7%');
    expect(getByText('33.7%')).toBeTruthy();
  });

  it('handles animation disabled', () => {
    const { getByRole } = render(
      <ProgressIndicator {...defaultProps} animated={false} />
    );
    
    expect(getByRole('progressbar')).toBeTruthy();
  });

  it('handles custom animation duration', () => {
    const { getByRole } = render(
      <ProgressIndicator {...defaultProps} duration={2000} />
    );
    
    expect(getByRole('progressbar')).toBeTruthy();
  });

  it('has proper accessibility labels for percentage values', () => {
    const { getByLabelText } = render(
      <ProgressIndicator {...defaultProps} showLabel={true} />
    );
    
    expect(getByLabelText('50.0 percent')).toBeTruthy();
  });

  it('circular progress has proper accessibility labels', () => {
    const { getByLabelText } = render(
      <ProgressIndicator {...defaultProps} style="circular" showLabel={true} />
    );
    
    expect(getByLabelText('50.0 percent')).toBeTruthy();
  });
});