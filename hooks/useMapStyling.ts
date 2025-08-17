import { useCallback, useEffect, useState } from 'react';
import { ColorSchemeName } from 'react-native';

import { useColorScheme } from '@/hooks/useColorScheme';
import { logger } from '@/utils/logger';
import {
    FogStyling,
    getAllMapStyles,
    getFogStyling,
    getLocationMarkerStyling,
    getMapStyleByName,
    getNextMapStyle,
    isMapStyleDark,
    LocationMarkerStyling,
    MAP_STYLES,
    MapStyleInfo
} from '@/utils/mapStyling';

/**
 * Configuration options for the map styling hook
 * Controls initial styling, customization, and persistence behavior
 */
export interface UseMapStylingOptions {
  /** Initial map style URL or name (default: Dark style) */
  initialMapStyle?: string;
  /** Whether to automatically adapt fog styling to map style changes (default: true) */
  autoAdaptFogStyling?: boolean;
  /** Whether to persist map style selection (not yet implemented) */
  persistMapStyle?: boolean;
  /** Custom fog styling overrides to merge with theme-based styling */
  customFogStyling?: Partial<FogStyling>;
  /** Custom location marker styling overrides to merge with theme-based styling */
  customMarkerStyling?: Partial<LocationMarkerStyling>;
}

/**
 * State interface for map styling hook
 * Represents current styling state and computed styling configurations
 */
export interface MapStylingState {
  /** Current map style URL */
  mapStyle: string;
  /** Current map style information and metadata */
  mapStyleInfo: MapStyleInfo;
  /** Current system color scheme */
  colorScheme: ColorSchemeName;
  /** Current fog styling configuration (theme + map style aware) */
  fogStyling: FogStyling;
  /** Current location marker styling configuration (theme aware) */
  locationMarkerStyling: LocationMarkerStyling;
  /** Whether the current map style is considered dark */
  isMapStyleDark: boolean;
  /** Array of all available map styles */
  availableMapStyles: MapStyleInfo[];
}

/**
 * Return interface for the map styling hook
 * Combines styling state with methods for controlling map styling
 */
export interface UseMapStylingReturn extends MapStylingState {
  /** Cycle to the next available map style in sequence */
  cycleMapStyle: () => void;
  /** Set map style by URL or display name */
  setMapStyle: (styleUrlOrName: string) => void;
  /** Get fog styling for specific theme and map style combination */
  getFogStylingFor: (colorScheme: ColorSchemeName, mapStyleUrl: string) => FogStyling;
  /** Get location marker styling for specific theme */
  getLocationMarkerStylingFor: (colorScheme: ColorSchemeName) => LocationMarkerStyling;
  /** Refresh styling (useful when theme changes externally) */
  refreshStyling: () => void;
  /** Reset to default map style */
  resetToDefaultStyle: () => void;
}

/**
 * Default options for map styling hook
 */
const DEFAULT_OPTIONS: Required<UseMapStylingOptions> = {
  initialMapStyle: 'mapbox://styles/mapbox/dark-v10', // Default to Dark style
  autoAdaptFogStyling: true,
  persistMapStyle: false, // Not implemented in this version
  customFogStyling: {},
  customMarkerStyling: {}
};

/**
 * Storage key for persisted map style (if persistence is enabled)
 * Currently unused but reserved for future implementation
 */
// const MAP_STYLE_STORAGE_KEY = 'cartographer_map_style';

/**
 * Resolves a map style URL from either URL or name
 * Handles both direct Mapbox URLs and display names
 * 
 * @param styleUrlOrName - Either a Mapbox style URL or display name
 * @returns Resolved Mapbox style URL
 * 
 * @internal
 */
const resolveMapStyleUrl = (styleUrlOrName: string): string => {
  // Check if it's already a valid URL (contains 'mapbox://')
  if (styleUrlOrName.includes('mapbox://')) {
    return styleUrlOrName;
  }
  
  // Try to find by name
  const styleByName = getMapStyleByName(styleUrlOrName);
  if (styleByName) {
    return styleByName.url;
  }
  
  // If not found, return the input (might be a custom URL)
  logger.warn(`Map style not found: ${styleUrlOrName}, using as-is`);
  return styleUrlOrName;
};

/**
 * Gets map style info, with fallback for unknown styles
 * Returns metadata for known styles or creates fallback info for custom styles
 * 
 * @param mapStyleUrl - The map style URL to get info for
 * @returns Map style information with name and theme classification
 * 
 * @internal
 */
const getMapStyleInfo = (mapStyleUrl: string): MapStyleInfo => {
  const knownStyle = MAP_STYLES.find(style => style.url === mapStyleUrl);
  
  if (knownStyle) {
    return knownStyle;
  }
  
  // Create fallback info for unknown styles
  return {
    url: mapStyleUrl,
    name: 'Custom',
    isDark: true // Default to dark for unknown styles
  };
};

/**
 * Merges custom styling with base styling
 * Combines theme-based fog styling with user customizations
 * 
 * @param baseStyling - Base fog styling from theme calculation
 * @param customStyling - Custom styling overrides
 * @returns Merged fog styling configuration
 * 
 * @internal
 */
const mergeFogStyling = (baseStyling: FogStyling, customStyling: Partial<FogStyling>): FogStyling => {
  return {
    fill: {
      ...baseStyling.fill,
      ...customStyling.fill
    },
    edge: {
      ...baseStyling.edge,
      ...customStyling.edge
    }
  };
};

/**
 * Merges custom marker styling with base styling
 * Combines theme-based marker styling with user customizations
 * 
 * @param baseStyling - Base marker styling from theme calculation
 * @param customStyling - Custom styling overrides
 * @returns Merged location marker styling configuration
 * 
 * @internal
 */
const mergeMarkerStyling = (
  baseStyling: LocationMarkerStyling, 
  customStyling: Partial<LocationMarkerStyling>
): LocationMarkerStyling => {
  return {
    container: {
      ...baseStyling.container,
      ...customStyling.container
    },
    core: {
      ...baseStyling.core,
      ...customStyling.core
    }
  };
};

/**
 * Custom hook for managing map styling and theme-aware styling coordination
 * Provides comprehensive map styling with automatic theme adaptation and customization support
 * Handles map style cycling, fog styling coordination, and location marker styling
 * 
 * @param options - Configuration options for styling behavior and customization
 * @returns Object containing current styling state and methods for controlling map styling
 * 
 * @example
 * ```typescript
 * const {
 *   mapStyle,
 *   fogStyling,
 *   locationMarkerStyling,
 *   cycleMapStyle,
 *   setMapStyle
 * } = useMapStyling({
 *   initialMapStyle: 'Dark',
 *   autoAdaptFogStyling: true,
 *   customFogStyling: {
 *     fill: { fillOpacity: 0.9 }
 *   }
 * });
 * 
 * // Use in map components
 * <MapboxGL.MapView styleURL={mapStyle}>
 *   <FogOverlay styling={fogStyling} />
 *   <MapLocationMarker styling={locationMarkerStyling} />
 * </MapboxGL.MapView>
 * ```
 */
export const useMapStyling = (
  options: UseMapStylingOptions = {}
): UseMapStylingReturn => {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const colorScheme = useColorScheme();
  
  // Initialize map style
  const [mapStyle, setMapStyleState] = useState<string>(() => {
    const initialStyle = resolveMapStyleUrl(config.initialMapStyle);
    logger.debug('Initializing map style:', initialStyle);
    return initialStyle;
  });
  
  // Derived state
  const mapStyleInfo = getMapStyleInfo(mapStyle);
  const availableMapStyles = getAllMapStyles();
  const isCurrentMapStyleDark = isMapStyleDark(mapStyle);
  
  // Calculate current styling
  const baseFogStyling = getFogStyling(colorScheme, mapStyle);
  const fogStyling = mergeFogStyling(baseFogStyling, config.customFogStyling);
  
  const baseMarkerStyling = getLocationMarkerStyling(colorScheme);
  const locationMarkerStyling = mergeMarkerStyling(baseMarkerStyling, config.customMarkerStyling);
  
  /**
   * Cycles to the next available map style
   * Advances to the next style in the predefined sequence
   * Wraps around to the first style after the last one
   * 
   * @example
   * ```typescript
   * // In a button press handler
   * const handleStyleChange = () => cycleMapStyle();
   * ```
   */
  const cycleMapStyle = useCallback((): void => {
    const nextStyleUrl = getNextMapStyle(mapStyle);
    setMapStyleState(nextStyleUrl);
  }, [mapStyle]);
  
  /**
   * Sets map style by URL or name
   * Accepts either a Mapbox style URL or a display name
   * Automatically resolves names to URLs and updates styling
   * 
   * @param styleUrlOrName - Either a Mapbox style URL or display name (e.g., 'Dark', 'Light')
   * 
   * @example
   * ```typescript
   * setMapStyle('Satellite'); // By name
   * setMapStyle('mapbox://styles/mapbox/satellite-v9'); // By URL
   * ```
   */
  const setMapStyle = useCallback((styleUrlOrName: string): void => {
    const resolvedUrl = resolveMapStyleUrl(styleUrlOrName);
    setMapStyleState(resolvedUrl);
  }, []);
  
  /**
   * Gets fog styling for specific theme and map style
   * Calculates fog styling for any theme/style combination with custom overrides
   * Useful for previewing styling or calculating styling for different contexts
   * 
   * @param targetColorScheme - The color scheme to calculate styling for
   * @param targetMapStyleUrl - The map style URL to calculate styling for
   * @returns Fog styling configuration for the specified theme and map style
   * 
   * @example
   * ```typescript
   * const darkSatelliteFog = getFogStylingFor('dark', MapboxGL.StyleURL.Satellite);
   * ```
   */
  const getFogStylingFor = useCallback((
    targetColorScheme: ColorSchemeName,
    targetMapStyleUrl: string
  ): FogStyling => {
    const baseStyling = getFogStyling(targetColorScheme, targetMapStyleUrl);
    return mergeFogStyling(baseStyling, config.customFogStyling);
  }, [config.customFogStyling]);
  
  /**
   * Gets location marker styling for specific theme
   * Calculates location marker styling for any theme with custom overrides
   * Useful for previewing styling or calculating styling for different contexts
   * 
   * @param targetColorScheme - The color scheme to calculate styling for
   * @returns Location marker styling configuration for the specified theme
   * 
   * @example
   * ```typescript
   * const lightMarkerStyling = getLocationMarkerStylingFor('light');
   * ```
   */
  const getLocationMarkerStylingFor = useCallback((
    targetColorScheme: ColorSchemeName
  ): LocationMarkerStyling => {
    const baseStyling = getLocationMarkerStyling(targetColorScheme);
    return mergeMarkerStyling(baseStyling, config.customMarkerStyling);
  }, [config.customMarkerStyling]);
  
  /**
   * Refreshes styling (useful when theme changes externally)
   * Forces recalculation of all styling by triggering a re-render
   * Useful when system theme changes or custom styling options are updated externally
   * 
   * @example
   * ```typescript
   * // After updating custom styling options
   * refreshStyling();
   * ```
   */
  const refreshStyling = useCallback((): void => {
    // Force re-render by updating state
    setMapStyleState(current => current);
  }, []);
  
  /**
   * Resets to default map style
   * Returns to the first style in the available styles array (typically Dark)
   * Useful for resetting styling to a known state
   * 
   * @example
   * ```typescript
   * // In a reset button handler
   * const handleReset = () => resetToDefaultStyle();
   * ```
   */
  const resetToDefaultStyle = useCallback((): void => {
    const defaultStyle = MAP_STYLES[0].url;
    setMapStyleState(defaultStyle);
  }, []);
  

  

  
  // Effect for map style persistence (placeholder for future implementation)
  useEffect(() => {
    if (config.persistMapStyle) {
      logger.debug('Map style persistence is enabled but not yet implemented');
      // TODO: Implement AsyncStorage persistence
      // AsyncStorage.setItem(MAP_STYLE_STORAGE_KEY, mapStyle);
    }
  }, [mapStyle, config.persistMapStyle]);
  
  return {
    mapStyle,
    mapStyleInfo,
    colorScheme,
    fogStyling,
    locationMarkerStyling,
    isMapStyleDark: isCurrentMapStyleDark,
    availableMapStyles,
    cycleMapStyle,
    setMapStyle,
    getFogStylingFor,
    getLocationMarkerStylingFor,
    refreshStyling,
    resetToDefaultStyle
  };
};

export default useMapStyling;