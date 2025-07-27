import { render } from '@testing-library/react-native';
import React from 'react';
import { Text, View } from 'react-native';
import ParallaxScrollView from '../components/ParallaxScrollView';

describe('ParallaxScrollView', () => {
  it('renders children correctly', () => {
    const { getByText } = render(
      <ParallaxScrollView 
        headerImage={<View testID="header-image" />}
        headerBackgroundColor={{ light: '#ffffff', dark: '#000000' }}
      >
        <Text>Parallax Content</Text>
      </ParallaxScrollView>
    );
    expect(getByText('Parallax Content')).toBeTruthy();
  });
});