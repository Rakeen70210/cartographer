import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Collapsible } from '../components/Collapsible';

describe('Collapsible', () => {
  it('renders title and children', () => {
    const { getByText } = render(
      <Collapsible title="Section Title">
        <>{'Collapsible Content'}</>
      </Collapsible>
    );
    expect(getByText('Section Title')).toBeTruthy();
    expect(getByText('Collapsible Content')).toBeTruthy();
  });

  it('toggles content visibility on press', () => {
    const { getByText, queryByText } = render(
      <Collapsible title="Toggle Section">
        <>{'Hidden Content'}</>
      </Collapsible>
    );
    const title = getByText('Toggle Section');
    fireEvent.press(title);
    expect(queryByText('Hidden Content')).toBeTruthy();
  });
});