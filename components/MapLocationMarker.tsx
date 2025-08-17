/**
 * MapLocationMarker component for rendering the current location marker
 * with theme-aware styling and heading-based rotation
 */

import { useColorScheme } from '@/hooks/useColorScheme';
import { getLocationMarkerStyling } from '@/utils/mapStyling';
import MapboxGL from '@rnmapbox/maps';
import { LocationObject } from 'expo-location';
import React from 'react';
import { View, ViewStyle } from 'react-native';

/**
 * Props interface for MapLocationMarker component
 */
export interface MapLocationMarkerProps {
  /** Current location object from GPS, or null if no location available */
  location: LocationObject | null;
  /** Optional color scheme override, uses system theme if not provided */
  colorScheme?: 'light' | 'dark';
}

/**
 * MapLocationMarker component renders the current location marker on the map
 * Features theme-aware styling, heading-based rotation, and proper shadow effects
 * Returns null if no location is available to avoid rendering empty markers
 * 
 * @param props - Component props containing location and optional color scheme
 * @returns JSX element for the location marker or null if no location
 * 
 * @example
 * ```tsx
 * <MapLocationMarker 
 *   location={currentLocation} 
 *   colorScheme="dark" 
 * />
 * ```
 */
const MapLocationMarker: React.FC<MapLocationMarkerProps> = ({
  location,
  colorScheme: propColorScheme
}) => {
  const systemColorScheme = useColorScheme();
  const colorScheme = propColorScheme || systemColorScheme;
  
  // Don't render if no location
  if (!location || !location.coords) {
    return null;
  }

  const markerStyling = getLocationMarkerStyling(colorScheme);
  const heading = location.coords.heading || 0;

  const containerStyle: ViewStyle = {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ rotate: `${heading}deg` }],
    ...markerStyling.container,
  };

  const coreStyle: ViewStyle = {
    width: 12,
    height: 12,
    borderRadius: 6,
    ...markerStyling.core,
  };

  return (
    <MapboxGL.PointAnnotation
      id="currentLocation"
      coordinate={[location.coords.longitude, location.coords.latitude]}
    >
      <View style={containerStyle}>
        <View style={coreStyle} />
      </View>
    </MapboxGL.PointAnnotation>
  );
};

export default MapLocationMarker;