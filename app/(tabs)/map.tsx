import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import MapboxGL from '@rnmapbox/maps';

import AdvancedFogOverlay from '@/components/AdvancedFogOverlay';
import FogOverlay from '@/components/FogOverlay';
import FogVisualizationSettings from '@/components/FogVisualizationSettings';
import MapLocationMarker from '@/components/MapLocationMarker';
import MapStatusDisplay from '@/components/MapStatusDisplay';
import { ThemedText } from '@/components/ThemedText';
import { useAdvancedFogVisualization } from '@/hooks/useAdvancedFogVisualization';
import { useColorScheme } from '@/hooks/useColorScheme';
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
  const colorScheme = useColorScheme();
  const { 
    fogGeoJSON, 
    updateFogForLocation, 
    updateFogForViewport, 
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
  
  // Advanced fog visualization
  const advancedFogVisualization = useAdvancedFogVisualization(colorScheme, mapStyle);
  
  // Map refs and state
  const mapRef = useRef<MapboxGL.MapView>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [showAdvancedFog, setShowAdvancedFog] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
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
        logger.infoOnce('MapScreen: Database initialized successfully');
        // Don't call refreshFog here - let the fog calculation hook handle initialization
      } catch (error) {
        logger.error('MapScreen: Error in database setup:', error);
      }
    };
    setup().catch(error => logger.error('MapScreen: Error in setup promise:', error));
  }, []); // Remove refreshFog dependency to prevent infinite loops

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
        // Use the current updateFogForLocation function directly to avoid stale closure
        updateFogForLocation({ 
          latitude: currentLocation.lat, 
          longitude: currentLocation.lon 
        });
        
        // Trigger reveal animation for advanced fog
        if (showAdvancedFog) {
          advancedFogVisualization.triggerRevealAnimation();
        }
      })
      .catch((error: unknown) => {
        logger.error('Failed to process new location:', error);
      });
  }, [location, updateFogForLocation, showAdvancedFog, advancedFogVisualization]); // Include updateFogForLocation but it's stable from useCallback

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
        
        {/* Fog overlay - choose between classic and advanced */}
        {showAdvancedFog ? (
          <AdvancedFogOverlay
            fogGeoJSON={fogGeoJSON}
            colorScheme={colorScheme ?? 'dark'}
            mapStyleUrl={mapStyle}
            theme={advancedFogVisualization.config.theme}
            density={advancedFogVisualization.config.density}
            customStyling={advancedFogVisualization.config.customStyling}
            enableAnimations={advancedFogVisualization.config.enableAnimations}
            enableParticleEffects={advancedFogVisualization.config.enableParticleEffects}
            isRevealing={advancedFogVisualization.isRevealing}
            onRevealComplete={() => {
              logger.debugOnce('Advanced fog reveal animation completed');
            }}
          />
        ) : (
          <FogOverlay 
            fogGeoJSON={fogGeoJSON} 
            styling={fogStyling}
          />
        )}
      </MapboxGL.MapView>
      
      {/* Status display */}
      <MapStatusDisplay
        location={location}
        errorMsg={errorMsg}
        mapStyle={mapStyle}
        onStyleChange={cycleMapStyle}
      />
      
      {/* Advanced fog controls */}
      <View style={styles.advancedFogControls}>
        <TouchableOpacity
          style={[
            styles.controlButton,
            showAdvancedFog && styles.controlButtonActive,
          ]}
          onPress={() => setShowAdvancedFog(!showAdvancedFog)}
        >
          <ThemedText style={[
            styles.controlButtonText,
            showAdvancedFog && styles.controlButtonTextActive,
          ]}>
            {showAdvancedFog ? 'Classic Fog' : 'Advanced Fog'}
          </ThemedText>
        </TouchableOpacity>
        
        {showAdvancedFog && (
          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => setShowSettings(true)}
          >
            <ThemedText style={styles.controlButtonText}>
              ⚙️ Settings
            </ThemedText>
          </TouchableOpacity>
        )}
      </View>
      
      {/* Advanced fog settings */}
      <FogVisualizationSettings
        fogVisualization={advancedFogVisualization}
        visible={showSettings}
        onClose={() => setShowSettings(false)}
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
  advancedFogControls: {
    position: 'absolute',
    top: 60,
    right: 20,
    flexDirection: 'column',
    gap: 8,
  },
  controlButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  controlButtonActive: {
    backgroundColor: 'rgba(0, 122, 255, 0.8)',
    borderColor: '#007AFF',
  },
  controlButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  controlButtonTextActive: {
    fontWeight: '600',
  },
});

export default MapScreen;