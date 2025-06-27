import React from 'react';
import { render } from '@testing-library/react-native';
import { ThemedView } from '../components/ThemedView';

describe('ThemedView', () => {
  it('renders children correctly', () => {
    const { getByText } = render(
      <ThemedView>
        <>{'Test View'}</>
      </ThemedView>
    );
    expect(getByText('Test View')).toBeTruthy();
  });

  it('applies custom props', () => {
    const { getByTestId } = render(
      <ThemedView testID="themed-view" style={{ backgroundColor: 'blue' }} />
    );
    const view = getByTestId('themed-view');
    expect(view.props.style).toEqual(expect.arrayContaining([expect.objectContaining({ backgroundColor: 'blue' })]));
  });
});