import { render } from '@testing-library/react-native';
import React from 'react';
import { HelloWave } from '../components/HelloWave';

describe('HelloWave', () => {
  it('renders without crashing', () => {
    const { getByText } = render(<HelloWave />);
    expect(getByText('👋')).toBeTruthy();
  });
});