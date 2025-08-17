/**
 * MapStatusDisplay component for displaying location status, map style info, and controls
 * Uses ThemedText and ThemedView for consistent styling
 */

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useThemeColor } from '@/hooks/useThemeColor';
import { getMapStyleName } from '@/utils/mapStyling';
import { LocationObject } from 'expo-location';
import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';

/**
 * Props interface for MapStatusDisplay component
 */
export interface MapStatusDisplayProps {
  /** Current location object from GPS, or null if no location available */
  location: LocationObject | null;
  /** Current error message from location services, or null if no error */
  errorMsg: string | null;
  /** Current map style URL */
  mapStyle: string;
  /** Callback function to handle map style change requests */
  onStyleChange: () => void;
}

/**
 * MapStatusDisplay component renders status information and controls at the bottom of the map
 * Shows current GPS coordinates, error messages, map style info, and style change controls
 * Uses themed styling that adapts to system color scheme
 * Provides user guidance with zoom and interaction hints
 * 
 * @param props - Component props containing location, error state, map style, and change handler
 * @returns JSX element for the status display overlay
 * 
 * @example
 * ```tsx
 * <MapStatusDisplay
 *   location={currentLocation}
 *   errorMsg={locationError}
 *   mapStyle={currentMapStyle}
 *   onStyleChange={handleStyleChange}
 * />
 * ```
 */
const MapStatusDisplay: React.FC<MapStatusDisplayProps> = ({
  location,
  errorMsg,
  mapStyle,
  onStyleChange,
}) => {
  const colorScheme = useColorScheme();
  const backgroundColor = useThemeColor({ light: '#fff', dark: '#151718' }, 'background');
  const textColor = useThemeColor({ light: '#11181C', dark: '#ECEDEE' }, 'text');
  const buttonColor = colorScheme === 'dark' ? '#3B82F6' : '#007AFF';

  /**
   * Generates status text based on current location and error state
   * Prioritizes error messages over location display for user awareness
   * Formats coordinates to 5 decimal places for reasonable precision
   * 
   * @returns Formatted status text for display
   * 
   * @internal
   */
  const getStatusText = (): string => {
    if (errorMsg) {
      return errorMsg;
    } else if (location && location.coords) {
      return `Lat: ${location.coords.latitude.toFixed(5)}, Lon: ${location.coords.longitude.toFixed(5)}`;
    }
    return 'Waiting for location...';
  };

  const mapStyleName = getMapStyleName(mapStyle);

  return (
    <ThemedView style={[styles.statusContainer, { backgroundColor }]}>
      <ThemedText style={[styles.statusText, { color: textColor }]}>
        {getStatusText()}
      </ThemedText>
      
      <ThemedText style={[styles.mapStyleText, { color: textColor }]}>
        Map Style: {mapStyleName}
      </ThemedText>
      
      <TouchableOpacity onPress={onStyleChange} activeOpacity={0.7}>
        <ThemedText style={[styles.styleButton, { color: buttonColor }]}>
          Tap to change map style
        </ThemedText>
      </TouchableOpacity>
      
      <ThemedText style={[styles.zoomHint, { color: textColor, opacity: 0.7 }]}>
        Pinch to zoom • Pan to explore • Fog adapts to viewport
      </ThemedText>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  statusContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 32, // Extra padding for safe area
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8, // Android shadow
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
    textAlign: 'center',
  },
  mapStyleText: {
    fontSize: 12,
    opacity: 0.8,
    marginBottom: 8,
    textAlign: 'center',
  },
  styleButton: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  zoomHint: {
    fontSize: 10,
    textAlign: 'center',
    marginTop: 4,
    fontStyle: 'italic',
  },
});

export default MapStatusDisplay;