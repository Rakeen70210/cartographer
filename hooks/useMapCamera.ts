import MapboxGL from '@rnmapbox/maps';
import { LocationObject } from 'expo-location';
import { useCallback, useRef } from 'react';

import { logger } from '@/utils/logger';

/**
 * Configuration options for camera management
 */
export interface UseMapCameraOptions {
  /** Default zoom level for initial camera positioning */
  defaultZoom?: number;
  /** Animation duration for camera movements in milliseconds */
  animationDuration?: number;
  /** Animation mode for camera movements */
  animationMode?: 'flyTo' | 'easeTo' | 'moveTo';
}

/**
 * Return interface for the camera hook
 */
export interface UseMapCameraReturn {
  /** Reference to the camera component */
  cameraRef: React.RefObject<MapboxGL.Camera | null>;
  /** Center camera on user location */
  centerOnLocation: (location: LocationObject) => void;
  /** Check if camera has been centered initially */
  hasCentered: boolean;
  /** Reset the centered state */
  resetCenteredState: () => void;
}

/**
 * Default options for camera hook
 */
const DEFAULT_OPTIONS: Required<UseMapCameraOptions> = {
  defaultZoom: 17,
  animationDuration: 2000,
  animationMode: 'flyTo'
};

/**
 * Custom hook for managing map camera operations
 * 
 * @param options - Configuration options for camera behavior
 * @returns Camera management interface
 */
export const useMapCamera = (
  options: UseMapCameraOptions = {}
): UseMapCameraReturn => {
  const config = { ...DEFAULT_OPTIONS, ...options };
  
  // Refs for camera management
  const cameraRef = useRef<MapboxGL.Camera>(null);
  const hasCenteredRef = useRef(false);

  /**
   * Centers the camera on the provided location with animation
   * 
   * @param location - Location object containing coordinates
   */
  const centerOnLocation = useCallback((location: LocationObject): void => {
    if (!location?.coords || !cameraRef.current) {
      logger.warn('Cannot center camera: invalid location or camera ref');
      return;
    }

    const { longitude, latitude } = location.coords;
    
    try {
      cameraRef.current.setCamera({
        centerCoordinate: [longitude, latitude],
        zoomLevel: config.defaultZoom,
        animationMode: config.animationMode,
        animationDuration: config.animationDuration,
      });
      
      hasCenteredRef.current = true;
      logger.info(`Camera centered on location: ${latitude}, ${longitude}`);
    } catch (error) {
      logger.error('Error centering camera on location:', error);
    }
  }, [config.defaultZoom, config.animationMode, config.animationDuration]);

  /**
   * Resets the centered state to allow re-centering
   */
  const resetCenteredState = useCallback((): void => {
    hasCenteredRef.current = false;
    logger.debug('Camera centered state reset');
  }, []);

  return {
    cameraRef,
    centerOnLocation,
    hasCentered: hasCenteredRef.current,
    resetCenteredState
  };
};

export default useMapCamera;