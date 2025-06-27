import React from 'react';
import { render } from '@testing-library/react-native';
import { ThemedText } from '../components/ThemedText';

describe('ThemedText', () => {
  it('renders children correctly', () => {
    const { getByText } = render(<ThemedText>Test Text</ThemedText>);
    expect(getByText('Test Text')).toBeTruthy();
  });

  it('applies custom props', () => {
    const { getByText } = render(<ThemedText style={{ color: 'red' }}>Styled Text</ThemedText>);
    const text = getByText('Styled Text');
    expect(text.props.style).toEqual(expect.arrayContaining([expect.objectContaining({ color: 'red' })]));
  });
});