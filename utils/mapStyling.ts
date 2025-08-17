/**
 * Map styling utilities for theme-aware fog styling and map style management
 * Provides consistent styling across different themes and map styles
 */

import MapboxGL from '@rnmapbox/maps';
import { ColorSchemeName } from 'react-native';

/**
 * Interface for fog overlay styling configuration
 * Defines fill and edge styling properties for fog rendering
 */
export interface FogStyling {
  /** Fill styling for the main fog area */
  fill: {
    /** Color of the fog fill */
    fillColor: string;
    /** Opacity of the fog fill (0-1) */
    fillOpacity: number;
  };
  /** Edge styling for fog boundaries */
  edge: {
    /** Color of the fog edge lines */
    lineColor: string;
    /** Opacity of the fog edge lines (0-1) */
    lineOpacity: number;
    /** Width of the fog edge lines in pixels */
    lineWidth: number;
    /** Blur amount for softer fog edges */
    lineBlur: number;
  };
}

/**
 * Interface for location marker styling configuration
 * Defines container and core styling for the current location marker
 */
export interface LocationMarkerStyling {
  /** Outer container styling with shadow and border */
  container: {
    /** Background color of the marker container */
    backgroundColor: string;
    /** Border color of the marker container */
    borderColor: string;
    /** Border width in pixels */
    borderWidth: number;
    /** Shadow color for elevation effect */
    shadowColor: string;
    /** Shadow offset for positioning */
    shadowOffset: { width: number; height: number };
    /** Shadow opacity (0-1) */
    shadowOpacity: number;
    /** Shadow blur radius */
    shadowRadius: number;
    /** Android elevation for shadow */
    elevation: number;
  };
  /** Inner core styling for the marker center */
  core: {
    /** Background color of the marker core */
    backgroundColor: string;
    /** Border color of the marker core */
    borderColor: string;
    /** Border width in pixels */
    borderWidth: number;
  };
}

/**
 * Interface for map style information and metadata
 * Contains URL, display name, and theme classification
 */
export interface MapStyleInfo {
  /** Mapbox style URL */
  url: string;
  /** Human-readable display name */
  name: string;
  /** Whether this style is considered dark themed */
  isDark: boolean;
}

// Available map styles with metadata
export const MAP_STYLES: MapStyleInfo[] = [
  {
    url: MapboxGL.StyleURL.Dark,
    name: 'Dark',
    isDark: true,
  },
  {
    url: MapboxGL.StyleURL.Light,
    name: 'Light',
    isDark: false,
  },
  {
    url: MapboxGL.StyleURL.Street,
    name: 'Street',
    isDark: false,
  },
  {
    url: MapboxGL.StyleURL.Satellite,
    name: 'Satellite',
    isDark: true,
  },
  {
    url: MapboxGL.StyleURL.SatelliteStreet,
    name: 'Satellite Street',
    isDark: false,
  },
];

/**
 * Gets theme-aware and map-style-aware fog styling for optimal contrast
 * Calculates fog colors and opacity based on both system theme and current map style
 * Ensures fog is always visible with good contrast against the map background
 * 
 * @param colorScheme - Current system color scheme ('light' | 'dark' | null)
 * @param mapStyleUrl - Current map style URL to determine background characteristics
 * @returns Fog styling configuration optimized for the current theme and map style
 * 
 * @example
 * ```typescript
 * const fogStyling = getFogStyling('dark', MapboxGL.StyleURL.Satellite);
 * // Returns styling optimized for dark theme on satellite imagery
 * ```
 */
export const getFogStyling = (
  colorScheme: ColorSchemeName,
  mapStyleUrl: string
): FogStyling => {
  const isDarkTheme = colorScheme === 'dark';
  const mapStyle = MAP_STYLES.find(style => style.url === mapStyleUrl);
  const isDarkMapStyle = mapStyle?.isDark ?? true;
  
  // Enhanced fog styling based on theme and map style
  let fogColor: string;
  let fogOpacity: number;
  let edgeColor: string;
  let edgeOpacity: number;
  
  if (isDarkMapStyle) {
    // Dark map style - use darker fog with higher opacity for better contrast
    fogColor = isDarkTheme ? '#0F172A' : '#1E293B'; // Very dark blue-gray
    fogOpacity = 0.85; // Higher opacity for better coverage
    edgeColor = isDarkTheme ? '#334155' : '#475569'; // Lighter edge for definition
    edgeOpacity = 0.6;
  } else {
    // Light map style - use lighter fog with moderate opacity
    fogColor = isDarkTheme ? '#374151' : '#6B7280'; // Medium gray
    fogOpacity = 0.75; // Moderate opacity to not completely obscure light maps
    edgeColor = isDarkTheme ? '#4B5563' : '#9CA3AF'; // Lighter edge
    edgeOpacity = 0.5;
  }
  
  return {
    fill: {
      fillColor: fogColor,
      fillOpacity: fogOpacity,
    },
    edge: {
      lineColor: edgeColor,
      lineOpacity: edgeOpacity,
      lineWidth: 1.5,
      lineBlur: 3, // Softer edge for smoother transitions
    }
  };
};

/**
 * Gets theme-aware location marker styling
 * Provides consistent location marker appearance that adapts to system theme
 * Uses platform-appropriate colors and shadow effects
 * 
 * @param colorScheme - Current system color scheme ('light' | 'dark' | null)
 * @returns Location marker styling configuration for the current theme
 * 
 * @example
 * ```typescript
 * const markerStyling = getLocationMarkerStyling('light');
 * // Returns styling optimized for light theme
 * ```
 */
export const getLocationMarkerStyling = (
  colorScheme: ColorSchemeName
): LocationMarkerStyling => {
  const isDarkTheme = colorScheme === 'dark';
  
  const primaryColor = isDarkTheme ? '#3B82F6' : '#007AFF';
  const primaryColorTransparent = isDarkTheme ? 'rgba(59, 130, 246, 0.3)' : 'rgba(0, 122, 255, 0.3)';
  
  return {
    container: {
      backgroundColor: primaryColorTransparent,
      borderColor: primaryColor,
      borderWidth: 2,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    },
    core: {
      backgroundColor: primaryColor,
      borderColor: '#FFFFFF',
      borderWidth: 2,
    },
  };
};

/**
 * Gets the display name for a map style URL
 * Converts Mapbox style URLs to human-readable names for UI display
 * 
 * @param mapStyleUrl - The Mapbox style URL to get the name for
 * @returns Human-readable name for the map style, or 'Unknown' if not found
 * 
 * @example
 * ```typescript
 * const name = getMapStyleName(MapboxGL.StyleURL.Dark);
 * // Returns: 'Dark'
 * ```
 */
export const getMapStyleName = (mapStyleUrl: string): string => {
  const mapStyle = MAP_STYLES.find(style => style.url === mapStyleUrl);
  return mapStyle?.name ?? 'Unknown';
};

/**
 * Cycles to the next map style in the available styles array
 * Provides circular navigation through available map styles
 * 
 * @param currentMapStyleUrl - The current map style URL
 * @returns The URL of the next map style in the cycle
 * 
 * @example
 * ```typescript
 * const nextStyle = getNextMapStyle(MapboxGL.StyleURL.Dark);
 * // Returns the next style in the cycle (e.g., Light)
 * ```
 */
export const getNextMapStyle = (currentMapStyleUrl: string): string => {
  const currentIndex = MAP_STYLES.findIndex(style => style.url === currentMapStyleUrl);
  // If current style not found, start from first style and return second
  if (currentIndex === -1) {
    return MAP_STYLES[1].url; // Return Light style as next after unknown
  }
  const nextIndex = (currentIndex + 1) % MAP_STYLES.length;
  return MAP_STYLES[nextIndex].url;
};

/**
 * Checks if a map style is considered dark
 * Determines whether a map style has a dark background for styling decisions
 * 
 * @param mapStyleUrl - The map style URL to check
 * @returns True if the map style is dark, false if light, defaults to true for unknown styles
 * 
 * @example
 * ```typescript
 * const isDark = isMapStyleDark(MapboxGL.StyleURL.Satellite);
 * // Returns: true (satellite imagery is considered dark)
 * ```
 */
export const isMapStyleDark = (mapStyleUrl: string): boolean => {
  const mapStyle = MAP_STYLES.find(style => style.url === mapStyleUrl);
  return mapStyle?.isDark ?? true;
};

/**
 * Gets all available map styles
 * Returns a copy of the complete list of supported map styles
 * 
 * @returns Array of all available map style information
 * 
 * @example
 * ```typescript
 * const styles = getAllMapStyles();
 * styles.forEach(style => {
 *   console.log(`${style.name}: ${style.url}`);
 * });
 * ```
 */
export const getAllMapStyles = (): MapStyleInfo[] => {
  return [...MAP_STYLES];
};

/**
 * Gets a map style by name (case-insensitive)
 * Searches for a map style by its display name, ignoring case
 * 
 * @param name - The display name to search for
 * @returns Map style information if found, undefined otherwise
 * 
 * @example
 * ```typescript
 * const style = getMapStyleByName('dark');
 * // Returns the Dark style info (case-insensitive match)
 * 
 * const notFound = getMapStyleByName('invalid');
 * // Returns undefined
 * ```
 */
export const getMapStyleByName = (name: string): MapStyleInfo | undefined => {
  if (!name || typeof name !== 'string') {
    return undefined;
  }
  
  return MAP_STYLES.find(style => 
    style.name.toLowerCase() === name.toLowerCase()
  );
};