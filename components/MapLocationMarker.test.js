/**
 * Tests for MapLocationMarker component
 */

import { render } from '@testing-library/react-native';
import React from 'react';
import MapLocationMarker from './MapLocationMarker';

// Mock the Mapbox module
jest.mock('@rnmapbox/maps', () => ({
  PointAnnotation: ({ children, ...props }) => {
    const MockedPointAnnotation = 'MockedPointAnnotation';
    return <MockedPointAnnotation {...props}>{children}</MockedPointAnnotation>;
  },
}));

// Mock the hooks
jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'light'),
}));

// Mock the styling utilities
jest.mock('@/utils/mapStyling', () => ({
  getLocationMarkerStyling: jest.fn(() => ({
    container: {
      backgroundColor: 'rgba(0, 122, 255, 0.3)',
      borderColor: '#007AFF',
      borderWidth: 2,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    },
    core: {
      backgroundColor: '#007AFF',
      borderColor: '#FFFFFF',
      borderWidth: 2,
    },
  })),
}));

describe('MapLocationMarker', () => {
  const mockLocation = {
    coords: {
      latitude: 37.7749,
      longitude: -122.4194,
      altitude: 10,
      accuracy: 5,
      altitudeAccuracy: 5,
      heading: 45,
      speed: 0,
    },
    timestamp: Date.now(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly with valid location', () => {
    const { UNSAFE_getByType } = render(
      <MapLocationMarker location={mockLocation} />
    );
    
    // Should render the PointAnnotation
    expect(UNSAFE_getByType('MockedPointAnnotation')).toBeTruthy();
  });

  it('does not render when location is null', () => {
    const { UNSAFE_queryByType } = render(
      <MapLocationMarker location={null} />
    );
    
    // Should not render anything
    expect(UNSAFE_queryByType('MockedPointAnnotation')).toBeNull();
  });

  it('does not render when location coords are missing', () => {
    const locationWithoutCoords = {
      timestamp: Date.now(),
    };
    
    const { UNSAFE_queryByType } = render(
      <MapLocationMarker location={locationWithoutCoords} />
    );
    
    // Should not render anything
    expect(UNSAFE_queryByType('MockedPointAnnotation')).toBeNull();
  });

  it('applies correct coordinate to PointAnnotation', () => {
    const { UNSAFE_getByType } = render(
      <MapLocationMarker location={mockLocation} />
    );
    
    const pointAnnotation = UNSAFE_getByType('MockedPointAnnotation');
    
    expect(pointAnnotation).toBeTruthy();
    expect(pointAnnotation.props.id).toBe('currentLocation');
    expect(pointAnnotation.props.coordinate).toEqual([
      mockLocation.coords.longitude, 
      mockLocation.coords.latitude
    ]);
  });

  it('applies heading rotation correctly', () => {
    const locationWithHeading = {
      ...mockLocation,
      coords: {
        ...mockLocation.coords,
        heading: 90,
      },
    };

    const { UNSAFE_getByType } = render(
      <MapLocationMarker location={locationWithHeading} />
    );
    
    // The rotation should be applied to the container view
    const pointAnnotation = UNSAFE_getByType('MockedPointAnnotation');
    expect(pointAnnotation).toBeTruthy();
  });

  it('handles missing heading gracefully', () => {
    const locationWithoutHeading = {
      ...mockLocation,
      coords: {
        ...mockLocation.coords,
        heading: null,
      },
    };

    const { UNSAFE_getByType } = render(
      <MapLocationMarker location={locationWithoutHeading} />
    );
    
    // Should still render without errors
    const pointAnnotation = UNSAFE_getByType('MockedPointAnnotation');
    expect(pointAnnotation).toBeTruthy();
  });

  it('uses provided colorScheme prop', () => {
    const { getLocationMarkerStyling } = require('@/utils/mapStyling');
    
    render(
      <MapLocationMarker location={mockLocation} colorScheme="dark" />
    );
    
    expect(getLocationMarkerStyling).toHaveBeenCalledWith('dark');
  });

  it('falls back to system colorScheme when prop not provided', () => {
    const { useColorScheme } = require('@/hooks/useColorScheme');
    const { getLocationMarkerStyling } = require('@/utils/mapStyling');
    
    useColorScheme.mockReturnValue('dark');
    
    render(
      <MapLocationMarker location={mockLocation} />
    );
    
    expect(getLocationMarkerStyling).toHaveBeenCalledWith('dark');
  });

  it('applies correct styling for light theme', () => {
    const { getLocationMarkerStyling } = require('@/utils/mapStyling');
    
    render(
      <MapLocationMarker location={mockLocation} colorScheme="light" />
    );
    
    expect(getLocationMarkerStyling).toHaveBeenCalledWith('light');
  });

  it('applies correct styling for dark theme', () => {
    const { getLocationMarkerStyling } = require('@/utils/mapStyling');
    
    render(
      <MapLocationMarker location={mockLocation} colorScheme="dark" />
    );
    
    expect(getLocationMarkerStyling).toHaveBeenCalledWith('dark');
  });
});