import React from 'react';
import { render } from '@testing-library/react-native';
import { HelloWave } from '../components/HelloWave';

describe('HelloWave', () => {
  it('renders without crashing', () => {
    const { getByTestId } = render(<HelloWave />);
    expect(getByTestId('hello-wave')).toBeTruthy();
  });
});