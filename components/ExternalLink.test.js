import { render } from '@testing-library/react-native';
import React from 'react';
import { ExternalLink } from '../components/ExternalLink';

describe('ExternalLink', () => {
  it('renders without crashing', () => {
    const result = render(
      <ExternalLink href="https://example.com">Example Link</ExternalLink>
    );
    expect(result).toBeTruthy();
  });

  it('accepts onPress prop', () => {
    const mockOnPress = jest.fn();
    const result = render(
      <ExternalLink href="https://example.com" onPress={mockOnPress}>
        Pressable Link
      </ExternalLink>
    );
    expect(result).toBeTruthy();
  });
});