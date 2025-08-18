/**
 * Advanced FogOverlay component with animations, themes, and enhanced visual effects
 * Provides fog edge smoothing, animated transitions, density variations, and customizable themes
 */

import MapboxGL from '@rnmapbox/maps';
import { FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
    Easing,
    interpolate,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSequence,
    withTiming,
} from 'react-native-reanimated';

import {
    AdvancedFogStyling,
    convertToMapboxStyles,
    FogDensity,
    FogTheme,
    getAdvancedFogStyling,
    validateAdvancedFogStyling,
} from '@/utils/advancedFogStyling';
import { logger } from '@/utils/logger';

/**
 * Props interface for AdvancedFogOverlay component
 */
export interface AdvancedFogOverlayProps {
  /** GeoJSON feature collection containing fog polygon(s) to render */
  fogGeoJSON: FeatureCollection<Polygon | MultiPolygon>;
  /** Current system color scheme */
  colorScheme: 'light' | 'dark' | null;
  /** Current map style URL */
  mapStyleUrl: string;
  /** Selected fog theme */
  theme?: FogTheme;
  /** Fog density level */
  density?: FogDensity;
  /** Custom styling overrides */
  customStyling?: Partial<AdvancedFogStyling>;
  /** Whether to enable animated transitions */
  enableAnimations?: boolean;
  /** Whether fog is currently being revealed (triggers reveal animation) */
  isRevealing?: boolean;
  /** Callback when reveal animation completes */
  onRevealComplete?: () => void;
  /** Optional custom source ID for the MapboxGL ShapeSource */
  sourceId?: string;
  /** Optional custom layer ID for the fog fill layer */
  fillLayerId?: string;
  /** Optional custom layer ID for the fog edge layer */
  edgeLayerId?: string;
  /** Optional custom layer ID for the fog glow layer */
  glowLayerId?: string;
  /** Whether to enable particle effects during animations */
  enableParticleEffects?: boolean;
  /** Array of revealed areas with timestamps for recency-based density */
  revealedAreas?: Array<{ id: string; timestamp: number; geometry: any }>;
}

/**
 * Animated MapboxGL ShapeSource component
 */
const AnimatedShapeSource = Animated.createAnimatedComponent(MapboxGL.ShapeSource);

/**
 * AdvancedFogOverlay component with enhanced visual effects and animations
 * 
 * Features:
 * - Smooth fog edge anti-aliasing with configurable blur
 * - Animated fog transitions when new areas are revealed
 * - Fog density variations based on exploration recency
 * - Customizable fog themes with unique visual characteristics
 * - Particle effects for magical/mystical themes
 * - Glow effects for enhanced edge definition
 * 
 * @param props - Component props containing fog geometry, styling, and animation options
 * @returns JSX element for the advanced fog overlay or null if data is invalid
 */
const AdvancedFogOverlay: React.FC<AdvancedFogOverlayProps> = ({
  fogGeoJSON,
  colorScheme,
  mapStyleUrl,
  theme = 'classic',
  density = 'medium',
  customStyling,
  enableAnimations = true,
  isRevealing = false,
  onRevealComplete,
  sourceId = 'advancedFogSource',
  fillLayerId = 'advancedFogFillLayer',
  edgeLayerId = 'advancedFogEdgeLayer',
  glowLayerId = 'advancedFogGlowLayer',
  enableParticleEffects = false,
  revealedAreas = [],
}) => {
  // Animation values
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);
  const revealProgress = useSharedValue(0);
  const particleOpacity = useSharedValue(0);
  
  // Refs for tracking animation state
  const isAnimatingRef = useRef(false);
  const lastRevealingStateRef = useRef(isRevealing);
  
  // Generate advanced styling
  const advancedStyling = useMemo(() => {
    const styling = getAdvancedFogStyling(
      colorScheme,
      mapStyleUrl,
      theme,
      density,
      customStyling
    );
    
    // Validate styling
    const validation = validateAdvancedFogStyling(styling);
    if (!validation.isValid) {
      logger.warn('Advanced fog styling validation failed:', validation.errors);
    }
    
    return styling;
  }, [colorScheme, mapStyleUrl, theme, density, customStyling]);
  
  // Convert to Mapbox-compatible styles
  const mapboxStyles = useMemo(() => {
    return convertToMapboxStyles(advancedStyling);
  }, [advancedStyling]);
  
  // Validate fog geometry
  const isValidGeometry = useMemo(() => {
    if (!fogGeoJSON) {
      logger.warn('AdvancedFogOverlay: No fog GeoJSON provided');
      return false;
    }
    
    if (fogGeoJSON.type !== 'FeatureCollection') {
      logger.error('AdvancedFogOverlay: Invalid fog GeoJSON - not a FeatureCollection', {
        type: fogGeoJSON.type
      });
      return false;
    }
    
    if (!fogGeoJSON.features || !Array.isArray(fogGeoJSON.features)) {
      logger.error('AdvancedFogOverlay: Invalid fog GeoJSON - missing or invalid features array');
      return false;
    }
    
    if (fogGeoJSON.features.length === 0) {
      logger.debug('AdvancedFogOverlay: No fog features to render');
      return false;
    }
    
    // Validate that all features are valid polygon geometries
    const hasInvalidFeatures = fogGeoJSON.features.some(feature => {
      if (!feature || feature.type !== 'Feature') {
        return true;
      }
      
      if (!feature.geometry) {
        return true;
      }
      
      if (feature.geometry.type !== 'Polygon' && feature.geometry.type !== 'MultiPolygon') {
        return true;
      }
      
      if (!feature.geometry.coordinates || !Array.isArray(feature.geometry.coordinates)) {
        return true;
      }
      
      return false;
    });
    
    if (hasInvalidFeatures) {
      logger.error('AdvancedFogOverlay: Some fog features are invalid');
      return false;
    }
    
    return true;
  }, [fogGeoJSON]);
  
  // Handle reveal animations
  useEffect(() => {
    if (!enableAnimations) return;
    
    const wasRevealing = lastRevealingStateRef.current;
    const isNowRevealing = isRevealing;
    
    if (!wasRevealing && isNowRevealing) {
      // Start reveal animation
      isAnimatingRef.current = true;
      
      const duration = advancedStyling.animation.revealDuration;
      const easing = getEasingFunction(advancedStyling.animation.easing);
      
      // Animate reveal progress
      revealProgress.value = withTiming(1, {
        duration,
        easing,
      }, (finished) => {
        if (finished) {
          runOnJS(() => {
            isAnimatingRef.current = false;
            onRevealComplete?.();
          })();
        }
      });
      
      // Animate scale for dramatic effect
      scale.value = withSequence(
        withTiming(1.1, { duration: duration * 0.3, easing }),
        withTiming(1, { duration: duration * 0.7, easing })
      );
      
      // Animate particle effects if enabled
      if (enableParticleEffects && advancedStyling.animation.enableParticles) {
        particleOpacity.value = withSequence(
          withTiming(1, { duration: duration * 0.5, easing }),
          withTiming(0, { duration: duration * 0.5, easing })
        );
      }
      
    } else if (wasRevealing && !isNowRevealing) {
      // Reset animation state
      revealProgress.value = withTiming(0, {
        duration: advancedStyling.animation.fadeDuration,
        easing: Easing.out(Easing.quad),
      });
      
      scale.value = withTiming(1, {
        duration: advancedStyling.animation.fadeDuration,
        easing: Easing.out(Easing.quad),
      });
      
      particleOpacity.value = withTiming(0, {
        duration: advancedStyling.animation.fadeDuration * 0.5,
        easing: Easing.out(Easing.quad),
      });
    }
    
    lastRevealingStateRef.current = isRevealing;
  }, [isRevealing, enableAnimations, advancedStyling.animation, enableParticleEffects, onRevealComplete]);
  
  // Animated styles for the fog overlay
  const animatedStyle = useAnimatedStyle(() => {
    if (!enableAnimations) {
      return {
        opacity: 1,
        transform: [{ scale: 1 }],
      };
    }
    
    // Calculate opacity based on reveal progress
    const animatedOpacity = interpolate(
      revealProgress.value,
      [0, 0.5, 1],
      [advancedStyling.fill.fillOpacity, advancedStyling.fill.fillOpacity * 0.7, advancedStyling.fill.fillOpacity]
    );
    
    return {
      opacity: animatedOpacity,
      transform: [{ scale: scale.value }],
    };
  }, [enableAnimations, advancedStyling.fill.fillOpacity]);
  
  // Particle effect styles
  const particleStyle = useAnimatedStyle(() => {
    if (!enableParticleEffects || !advancedStyling.animation.enableParticles) {
      return { opacity: 0 };
    }
    
    return {
      opacity: particleOpacity.value,
    };
  }, [enableParticleEffects, advancedStyling.animation.enableParticles]);
  
  // Don't render if geometry is invalid
  if (!isValidGeometry) {
    return null;
  }
  
  try {
    return (
      <View style={StyleSheet.absoluteFill}>
        {/* Main fog layers */}
        <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
          <MapboxGL.ShapeSource id={sourceId} shape={fogGeoJSON}>
            {/* Glow layer (rendered first, behind other layers) */}
            {mapboxStyles.glowLayer && (
              <MapboxGL.LineLayer
                id={glowLayerId}
                sourceID={sourceId}
                style={mapboxStyles.glowLayer}
              />
            )}
            
            {/* Main fill layer */}
            <MapboxGL.FillLayer
              id={fillLayerId}
              sourceID={sourceId}
              style={mapboxStyles.fillLayer}
            />
            
            {/* Edge layer with anti-aliasing */}
            <MapboxGL.LineLayer
              id={edgeLayerId}
              sourceID={sourceId}
              style={mapboxStyles.lineLayer}
            />
          </MapboxGL.ShapeSource>
        </Animated.View>
        
        {/* Particle effects overlay */}
        {enableParticleEffects && advancedStyling.animation.enableParticles && (
          <Animated.View style={[styles.particleContainer, particleStyle]}>
            <ParticleEffects
              theme={theme}
              isActive={isRevealing}
              intensity={advancedStyling.edge.glowIntensity}
            />
          </Animated.View>
        )}
      </View>
    );
  } catch (error) {
    logger.error('AdvancedFogOverlay: Error rendering fog overlay', error);
    return null;
  }
};

/**
 * Simple particle effects component for enhanced fog themes
 */
const ParticleEffects: React.FC<{
  theme: FogTheme;
  isActive: boolean;
  intensity: number;
}> = ({ theme, isActive, intensity }) => {
  const particleCount = Math.floor(intensity * 20); // 0-20 particles based on intensity
  
  // Generate particle positions and animations
  const particles = useMemo(() => {
    return Array.from({ length: particleCount }, (_, index) => ({
      id: index,
      x: Math.random() * 100, // Percentage position
      y: Math.random() * 100,
      size: Math.random() * 3 + 1, // 1-4px
      delay: Math.random() * 2000, // 0-2s delay
    }));
  }, [particleCount]);
  
  if (!isActive || particleCount === 0) {
    return null;
  }
  
  const particleColor = getParticleColor(theme);
  
  return (
    <View style={styles.particleContainer}>
      {particles.map((particle) => (
        <AnimatedParticle
          key={particle.id}
          x={particle.x}
          y={particle.y}
          size={particle.size}
          color={particleColor}
          delay={particle.delay}
        />
      ))}
    </View>
  );
};

/**
 * Individual animated particle component
 */
const AnimatedParticle: React.FC<{
  x: number;
  y: number;
  size: number;
  color: string;
  delay: number;
}> = ({ x, y, size, color, delay }) => {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(0);
  
  useEffect(() => {
    // Start animation after delay
    const timer = setTimeout(() => {
      opacity.value = withSequence(
        withTiming(1, { duration: 500 }),
        withTiming(0, { duration: 1500 })
      );
      
      translateY.value = withTiming(-50, {
        duration: 2000,
        easing: Easing.out(Easing.quad),
      });
    }, delay);
    
    return () => clearTimeout(timer);
  }, [delay]);
  
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));
  
  return (
    <Animated.View
      style={[
        styles.particle,
        {
          left: `${x}%`,
          top: `${y}%`,
          width: size,
          height: size,
          backgroundColor: color,
        },
        animatedStyle,
      ]}
    />
  );
};

/**
 * Gets particle color for the specified theme
 */
const getParticleColor = (theme: FogTheme): string => {
  const colors = {
    classic: '#64748B',
    mystical: '#A855F7',
    arctic: '#7DD3FC',
    volcanic: '#FBBF24',
    ethereal: '#E2E8F0',
    neon: '#39FF14',
  };
  
  return colors[theme] || colors.classic;
};

/**
 * Converts easing string to Reanimated easing function
 */
const getEasingFunction = (easing: string) => {
  switch (easing) {
    case 'linear':
      return Easing.linear;
    case 'ease-in':
      return Easing.in(Easing.quad);
    case 'ease-out':
      return Easing.out(Easing.quad);
    case 'ease-in-out':
      return Easing.inOut(Easing.quad);
    case 'bounce':
      return Easing.bounce;
    default:
      return Easing.out(Easing.quad);
  }
};

const styles = StyleSheet.create({
  particleContainer: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'none',
  },
  particle: {
    position: 'absolute',
    borderRadius: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
});

export default AdvancedFogOverlay;