import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';
import { Collapsible } from '../components/Collapsible';

describe('Collapsible', () => {
  it('renders title and children when opened', () => {
    const { getByText, queryByText } = render(
      <Collapsible title="Section Title">
        <Text>Collapsible Content</Text>
      </Collapsible>
    );
    expect(getByText('Section Title')).toBeTruthy();
    // Content should not be visible initially
    expect(queryByText('Collapsible Content')).toBeNull();
    
    // Click to open
    fireEvent.press(getByText('Section Title'));
    expect(getByText('Collapsible Content')).toBeTruthy();
  });

  it('toggles content visibility on press', () => {
    const { getByText, queryByText } = render(
      <Collapsible title="Toggle Section">
        <Text>Hidden Content</Text>
      </Collapsible>
    );
    const title = getByText('Toggle Section');
    fireEvent.press(title);
    expect(queryByText('Hidden Content')).toBeTruthy();
  });
});