import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import MapboxGL from '@rnmapbox/maps';

import FogOverlay from '@/components/FogOverlay';
import MapLocationMarker from '@/components/MapLocationMarker';
import MapStatusDisplay from '@/components/MapStatusDisplay';
import { useFogCalculation } from '@/hooks/useFogCalculation';
import useLocationTracking from '@/hooks/useLocationTracking';
import { useMapCamera } from '@/hooks/useMapCamera';
import { useMapStyling } from '@/hooks/useMapStyling';
import { useMapViewport } from '@/hooks/useMapViewport';
import { initDatabase } from '@/utils/database';
import { isDuplicateLocation, processNewLocation } from '@/utils/locationProcessing';
import { logger } from '@/utils/logger';
import {
    createCameraChangeHandler,
    createCameraIdleHandler,
    createMapLoadHandler
} from '@/utils/mapEventHandlers';

// Set Mapbox access token for native module
MapboxGL.setAccessToken('pk.eyJ1IjoicmFsaWtzNzAyMTAiLCJhIjoiY21icTM1cm4zMGFqNzJxcHdrbHEzY3hkYiJ9.o-DnPquzV98xBU8SMuenjg');

/**
 * Main map screen component that orchestrates map rendering and coordinates
 * between child components and hooks for fog of war functionality.
 * 
 * This component has been refactored to use extracted utilities and components:
 * - Geometry operations are handled by utils/geometryOperations.ts
 * - Fog calculations are managed by utils/fogCalculation.ts and hooks/useFogCalculation.ts
 * - Map styling is handled by utils/mapStyling.ts and hooks/useMapStyling.ts
 * - Viewport management is handled by hooks/useMapViewport.ts
 * - UI components are extracted to components/ directory
 * 
 * @returns {JSX.Element} The rendered map screen with fog overlay and controls
 */
const MapScreen = () => {
  // Core hooks for state management
  const { location, errorMsg } = useLocationTracking();
  const { 
    fogGeoJSON, 
    updateFogForLocation, 
    updateFogForViewport, 
    refreshFog,
    setViewportChanging
  } = useFogCalculation();
  const { 
    updateViewportBounds, 
    hasBoundsChanged,
    getCurrentViewportBounds
  } = useMapViewport();
  const { 
    mapStyle, 
    fogStyling, 
    cycleMapStyle 
  } = useMapStyling();
  const {
    cameraRef,
    centerOnLocation,
    hasCentered
  } = useMapCamera();
  
  // Map refs and state
  const mapRef = useRef<MapboxGL.MapView>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const lastProcessedLocationRef = useRef<{lat: number, lon: number} | null>(null);



  /**
   * Handles viewport changes with debouncing to prevent excessive fog recalculations.
   */
  const handleViewportChange = useCallback(async () => {
    const bounds = await getCurrentViewportBounds(mapRef);
    if (bounds && hasBoundsChanged(bounds)) {
      updateViewportBounds(bounds);
      await updateFogForViewport(bounds);
    }
  }, [getCurrentViewportBounds, hasBoundsChanged, updateViewportBounds, updateFogForViewport]);

  // Effect for initializing database
  useEffect(() => {
    const setup = async () => {
      try {
        await initDatabase();
        logger.info('MapScreen: Database initialized successfully');
        await refreshFog();
      } catch (error) {
        logger.error('MapScreen: Error in database setup:', error);
      }
    };
    setup().catch(error => logger.error('MapScreen: Error in setup promise:', error));
  }, [refreshFog]);

  // Effect to center camera on user location once when map loads
  useEffect(() => {
    if (mapLoaded && location && !hasCentered) {
      centerOnLocation(location);
    }
  }, [mapLoaded, location, hasCentered, centerOnLocation]);

  // Effect to process new locations and update fog
  useEffect(() => {
    if (!location?.coords) return;
    
    const currentLocation = {
      lat: location.coords.latitude,
      lon: location.coords.longitude
    };
    
    // Check for duplicate location to prevent infinite loops
    if (isDuplicateLocation(currentLocation, lastProcessedLocationRef.current)) {
      return;
    }
    
    lastProcessedLocationRef.current = currentLocation;
    
    // Process new location using extracted utility
    processNewLocation(location)
      .then(() => {
        updateFogForLocation({ 
          latitude: currentLocation.lat, 
          longitude: currentLocation.lon 
        });
      })
      .catch((error: unknown) => {
        logger.error('Failed to process new location:', error);
      });
  }, [location, updateFogForLocation]);

  // Create event handlers using extracted utilities
  const handleMapLoad = createMapLoadHandler(() => setMapLoaded(true));
  const handleCameraChanged = createCameraChangeHandler(setViewportChanging, handleViewportChange);
  const handleCameraIdle = createCameraIdleHandler(setViewportChanging);

  return (
    <View style={styles.container}>
      <MapboxGL.MapView
        ref={mapRef}
        style={styles.map}
        styleURL={mapStyle}
        onDidFinishLoadingMap={handleMapLoad}
        onCameraChanged={handleCameraChanged}
        onDidFinishRenderingMapFully={handleCameraIdle}
      >
        <MapboxGL.Camera
          ref={cameraRef}
          zoomLevel={10}
          centerCoordinate={[-74.006, 40.7128]} // Default to NYC
        />
        
        {/* Location marker */}
        <MapLocationMarker location={location} />
        
        {/* Fog overlay */}
        <FogOverlay 
          fogGeoJSON={fogGeoJSON} 
          styling={fogStyling}
        />
      </MapboxGL.MapView>
      
      {/* Status display */}
      <MapStatusDisplay
        location={location}
        errorMsg={errorMsg}
        mapStyle={mapStyle}
        onStyleChange={cycleMapStyle}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
});

export default MapScreen;