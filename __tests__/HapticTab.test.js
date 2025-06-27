import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { HapticTab } from '../components/HapticTab';

describe('HapticTab', () => {
  it('renders without crashing', () => {
    const { getByTestId } = render(
      <HapticTab testID="haptic-tab" />
    );
    expect(getByTestId('haptic-tab')).toBeTruthy();
  });

  it('handles onPressIn event', () => {
    const { getByTestId } = render(
      <HapticTab testID="haptic-tab-press" />
    );
    fireEvent(getByTestId('haptic-tab-press'), 'pressIn');
    expect(getByTestId('haptic-tab-press')).toBeTruthy();
  });
});