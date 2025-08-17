/**
 * Tests for MapStatusDisplay component
 */

import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import MapStatusDisplay from './MapStatusDisplay';

// Mock the themed components
jest.mock('@/components/ThemedText', () => {
  const { Text } = require('react-native');
  return {
    ThemedText: ({ children, style, ...props }) => (
      <Text style={style} {...props}>{children}</Text>
    ),
  };
});

jest.mock('@/components/ThemedView', () => {
  const { View } = require('react-native');
  return {
    ThemedView: ({ children, style, ...props }) => (
      <View style={style} {...props}>{children}</View>
    ),
  };
});

// Mock the hooks
jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'light'),
}));

jest.mock('@/hooks/useThemeColor', () => ({
  useThemeColor: jest.fn((colors) => colors.light),
}));

// Mock the styling utilities
jest.mock('@/utils/mapStyling', () => ({
  getMapStyleName: jest.fn((mapStyle) => {
    const styleMap = {
      'mapbox://styles/mapbox/dark-v11': 'Dark',
      'mapbox://styles/mapbox/light-v11': 'Light',
      'mapbox://styles/mapbox/streets-v12': 'Street',
      'mapbox://styles/mapbox/satellite-v9': 'Satellite',
      'mapbox://styles/mapbox/satellite-streets-v12': 'Satellite Street',
    };
    return styleMap[mapStyle] || 'Unknown';
  }),
}));

describe('MapStatusDisplay', () => {
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

  const mockOnStyleChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly with valid location', () => {
    const { getByText } = render(
      <MapStatusDisplay
        location={mockLocation}
        errorMsg={null}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        onStyleChange={mockOnStyleChange}
      />
    );
    
    expect(getByText('Lat: 37.77490, Lon: -122.41940')).toBeTruthy();
    expect(getByText('Map Style: Dark')).toBeTruthy();
    expect(getByText('Tap to change map style')).toBeTruthy();
    expect(getByText('Pinch to zoom • Pan to explore • Fog adapts to viewport')).toBeTruthy();
  });

  it('displays error message when errorMsg is provided', () => {
    const errorMessage = 'Location permission denied';
    const { getByText } = render(
      <MapStatusDisplay
        location={mockLocation}
        errorMsg={errorMessage}
        mapStyle="mapbox://styles/mapbox/light-v11"
        onStyleChange={mockOnStyleChange}
      />
    );
    
    expect(getByText(errorMessage)).toBeTruthy();
    expect(getByText('Map Style: Light')).toBeTruthy();
  });

  it('displays waiting message when location is null', () => {
    const { getByText } = render(
      <MapStatusDisplay
        location={null}
        errorMsg={null}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        onStyleChange={mockOnStyleChange}
      />
    );
    
    expect(getByText('Waiting for location...')).toBeTruthy();
    expect(getByText('Map Style: Street')).toBeTruthy();
  });

  it('displays waiting message when location coords are missing', () => {
    const locationWithoutCoords = {
      timestamp: Date.now(),
    };
    
    const { getByText } = render(
      <MapStatusDisplay
        location={locationWithoutCoords}
        errorMsg={null}
        mapStyle="mapbox://styles/mapbox/satellite-v9"
        onStyleChange={mockOnStyleChange}
      />
    );
    
    expect(getByText('Waiting for location...')).toBeTruthy();
    expect(getByText('Map Style: Satellite')).toBeTruthy();
  });

  it('calls onStyleChange when style button is pressed', () => {
    const { getByText } = render(
      <MapStatusDisplay
        location={mockLocation}
        errorMsg={null}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        onStyleChange={mockOnStyleChange}
      />
    );
    
    const styleButton = getByText('Tap to change map style');
    fireEvent.press(styleButton);
    
    expect(mockOnStyleChange).toHaveBeenCalledTimes(1);
  });

  it('formats coordinates correctly with 5 decimal places', () => {
    const preciseLocation = {
      coords: {
        latitude: 37.774929123456789,
        longitude: -122.419415987654321,
        altitude: 10,
        accuracy: 5,
        altitudeAccuracy: 5,
        heading: 45,
        speed: 0,
      },
      timestamp: Date.now(),
    };
    
    const { getByText } = render(
      <MapStatusDisplay
        location={preciseLocation}
        errorMsg={null}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        onStyleChange={mockOnStyleChange}
      />
    );
    
    expect(getByText('Lat: 37.77493, Lon: -122.41942')).toBeTruthy();
  });

  it('displays correct map style name for different styles', () => {
    const { rerender, getByText } = render(
      <MapStatusDisplay
        location={mockLocation}
        errorMsg={null}
        mapStyle="mapbox://styles/mapbox/satellite-streets-v12"
        onStyleChange={mockOnStyleChange}
      />
    );
    
    expect(getByText('Map Style: Satellite Street')).toBeTruthy();
    
    rerender(
      <MapStatusDisplay
        location={mockLocation}
        errorMsg={null}
        mapStyle="unknown-style"
        onStyleChange={mockOnStyleChange}
      />
    );
    
    expect(getByText('Map Style: Unknown')).toBeTruthy();
  });

  it('prioritizes error message over location display', () => {
    const errorMessage = 'GPS signal lost';
    const { getByText, queryByText } = render(
      <MapStatusDisplay
        location={mockLocation}
        errorMsg={errorMessage}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        onStyleChange={mockOnStyleChange}
      />
    );
    
    expect(getByText(errorMessage)).toBeTruthy();
    expect(queryByText('Lat: 37.77490, Lon: -122.41940')).toBeNull();
  });

  it('uses correct theme colors for dark mode', () => {
    const { useColorScheme, useThemeColor } = require('@/hooks/useColorScheme');
    useColorScheme.mockReturnValue('dark');
    
    const { useThemeColor: mockUseThemeColor } = require('@/hooks/useThemeColor');
    mockUseThemeColor.mockImplementation((colors) => colors.dark);
    
    render(
      <MapStatusDisplay
        location={mockLocation}
        errorMsg={null}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        onStyleChange={mockOnStyleChange}
      />
    );
    
    expect(mockUseThemeColor).toHaveBeenCalledWith(
      { light: '#fff', dark: '#151718' },
      'background'
    );
    expect(mockUseThemeColor).toHaveBeenCalledWith(
      { light: '#11181C', dark: '#ECEDEE' },
      'text'
    );
  });

  it('uses correct theme colors for light mode', () => {
    const { useColorScheme } = require('@/hooks/useColorScheme');
    useColorScheme.mockReturnValue('light');
    
    const { useThemeColor } = require('@/hooks/useThemeColor');
    useThemeColor.mockImplementation((colors) => colors.light);
    
    render(
      <MapStatusDisplay
        location={mockLocation}
        errorMsg={null}
        mapStyle="mapbox://styles/mapbox/light-v11"
        onStyleChange={mockOnStyleChange}
      />
    );
    
    expect(useThemeColor).toHaveBeenCalledWith(
      { light: '#fff', dark: '#151718' },
      'background'
    );
    expect(useThemeColor).toHaveBeenCalledWith(
      { light: '#11181C', dark: '#ECEDEE' },
      'text'
    );
  });

  it('handles TouchableOpacity press correctly', () => {
    const { getByText } = render(
      <MapStatusDisplay
        location={mockLocation}
        errorMsg={null}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        onStyleChange={mockOnStyleChange}
      />
    );
    
    const touchableButton = getByText('Tap to change map style');
    
    // Simulate press
    fireEvent.press(touchableButton);
    expect(mockOnStyleChange).toHaveBeenCalledTimes(1);
    
    // Simulate another press
    fireEvent.press(touchableButton);
    expect(mockOnStyleChange).toHaveBeenCalledTimes(2);
  });
});