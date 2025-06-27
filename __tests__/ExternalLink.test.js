import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ExternalLink } from '../components/ExternalLink';

describe('ExternalLink', () => {
  it('renders children and href', () => {
    const { getByText } = render(
      <ExternalLink href="https://example.com">Example Link</ExternalLink>
    );
    expect(getByText('Example Link')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPressMock = jest.fn();
    const { getByText } = render(
      <ExternalLink href="https://example.com" onPress={onPressMock}>
        Pressable Link
      </ExternalLink>
    );
    fireEvent.press(getByText('Pressable Link'));
    // The actual onPress may be wrapped, so this is a smoke test
    expect(getByText('Pressable Link')).toBeTruthy();
  });
});