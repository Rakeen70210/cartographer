import { logger } from '@/utils/logger';

/**
 * Utility functions for handling map events and state management
 */

/**
 * Creates a debounced viewport change handler
 * 
 * @param updateCallback - Callback to execute when viewport changes
 * @param mapLoaded - Whether the map has finished loading
 * @returns Debounced viewport change handler
 */
export const createViewportChangeHandler = (
  updateCallback: () => Promise<void>,
  mapLoaded: boolean
) => {
  return async (): Promise<void> => {
    // Only process viewport changes if map is loaded
    if (!mapLoaded) {
      logger.debugViewport('Map not loaded, skipping viewport change');
      return;
    }
    
    try {
      await updateCallback();
    } catch (error) {
      logger.error('Error in viewport change handler:', error);
    }
  };
};

/**
 * Creates a map load completion handler
 * 
 * @param onMapLoad - Callback to execute when map loads
 * @returns Map load handler
 */
export const createMapLoadHandler = (
  onMapLoad: () => void
) => {
  return (): void => {
    try {
      onMapLoad();
      logger.infoOnce('Map loaded successfully');
    } catch (error) {
      logger.error('Error in map load handler:', error);
    }
  };
};

/**
 * Creates camera change event handler
 * 
 * @param setViewportChanging - Function to set viewport changing state
 * @param handleViewportChange - Function to handle viewport changes
 * @returns Camera change handler
 */
export const createCameraChangeHandler = (
  setViewportChanging: (changing: boolean) => void,
  handleViewportChange: () => Promise<void>
) => {
  return (): void => {
    try {
      setViewportChanging(true);
      handleViewportChange().catch(error => {
        logger.error('Error in camera change handler:', error);
      });
    } catch (error) {
      logger.error('Error setting viewport changing state:', error);
    }
  };
};

/**
 * Creates camera idle event handler
 * 
 * @param setViewportChanging - Function to set viewport changing state
 * @returns Camera idle handler
 */
export const createCameraIdleHandler = (
  setViewportChanging: (changing: boolean) => void
) => {
  return (): void => {
    try {
      setViewportChanging(false);
      logger.debugViewport('Camera idle, viewport changes complete');
    } catch (error) {
      logger.error('Error in camera idle handler:', error);
    }
  };
};