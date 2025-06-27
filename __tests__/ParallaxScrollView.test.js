import React from 'react';
import { render } from '@testing-library/react-native';
import ParallaxScrollView from '../components/ParallaxScrollView';

describe('ParallaxScrollView', () => {
  it('renders children correctly', () => {
    const { getByText } = render(
      <ParallaxScrollView>
        <>{'Parallax Content'}</>
      </ParallaxScrollView>
    );
    expect(getByText('Parallax Content')).toBeTruthy();
  });
});