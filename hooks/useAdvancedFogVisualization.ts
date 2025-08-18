/**
 * Hook for managing advanced fog visualization features
 * Provides state management for fog themes, animations, density variations, and visual effects
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ColorSchemeName } from 'react-native';

import {
    AdvancedFogStyling,
    calculateRecencyBasedDensity,
    FogDensity,
    FogTheme,
    getAdvancedFogStyling,
    getAvailableFogThemes,
} from '@/utils/advancedFogStyling';
import { logger } from '@/utils/logger';

/**
 * Configuration for advanced fog visualization
 */
export interface AdvancedFogVisualizationConfig {
  /** Selected fog theme */
  theme: FogTheme;
  /** Base fog density level */
  density: FogDensity;
  /** Whether animations are enabled */
  enableAnimations: boolean;
  /** Whether particle effects are enabled */
  enableParticleEffects: boolean;
  /** Whether recency-based density is enabled */
  enableRecencyBasedDensity: boolean;
  /** Whether edge smoothing/anti-aliasing is enabled */
  enableEdgeSmoothing: boolean;
  /** Custom styling overrides */
  customStyling?: Partial<AdvancedFogStyling>;
}

/**
 * State for advanced fog visualization
 */
export interface AdvancedFogVisualizationState {
  /** Current configuration */
  config: AdvancedFogVisualizationConfig;
  /** Whether fog is currently being revealed (for animations) */
  isRevealing: boolean;
  /** Current advanced fog styling */
  currentStyling: AdvancedFogStyling;
  /** Whether settings are being loaded */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Available fog themes */
  availableThemes: FogTheme[];
}

/**
 * Return interface for the advanced fog visualization hook
 */
export interface UseAdvancedFogVisualizationReturn extends AdvancedFogVisualizationState {
  /** Update fog theme */
  setTheme: (theme: FogTheme) => Promise<void>;
  /** Update fog density */
  setDensity: (density: FogDensity) => Promise<void>;
  /** Toggle animations */
  toggleAnimations: () => Promise<void>;
  /** Toggle particle effects */
  toggleParticleEffects: () => Promise<void>;
  /** Toggle recency-based density */
  toggleRecencyBasedDensity: () => Promise<void>;
  /** Toggle edge smoothing */
  toggleEdgeSmoothing: () => Promise<void>;
  /** Update custom styling */
  updateCustomStyling: (styling: Partial<AdvancedFogStyling>) => Promise<void>;
  /** Reset to default settings */
  resetToDefaults: () => Promise<void>;
  /** Trigger reveal animation */
  triggerRevealAnimation: () => void;
  /** Calculate density for specific timestamp */
  calculateDensityForTimestamp: (timestamp: number) => number;
  /** Get styling for specific revealed area */
  getStylingForArea: (areaId: string, timestamp: number) => AdvancedFogStyling;
}

/**
 * Default configuration for advanced fog visualization
 */
const DEFAULT_CONFIG: AdvancedFogVisualizationConfig = {
  theme: 'classic',
  density: 'medium',
  enableAnimations: true,
  enableParticleEffects: false,
  enableRecencyBasedDensity: true,
  enableEdgeSmoothing: true,
};

/**
 * Storage key for persisting fog visualization settings
 */
const STORAGE_KEY = 'advanced_fog_visualization_config';

/**
 * Custom hook for managing advanced fog visualization features
 * 
 * Features:
 * - Persistent fog theme and density settings
 * - Animation and particle effect controls
 * - Recency-based fog density calculations
 * - Edge smoothing and anti-aliasing options
 * - Custom styling support
 * - Reveal animation triggers
 * 
 * @param colorScheme - Current system color scheme
 * @param mapStyleUrl - Current map style URL
 * @returns Object containing fog visualization state and control methods
 * 
 * @example
 * ```typescript
 * const {
 *   config,
 *   currentStyling,
 *   isRevealing,
 *   setTheme,
 *   toggleAnimations,
 *   triggerRevealAnimation,
 * } = useAdvancedFogVisualization('dark', MapboxGL.StyleURL.Dark);
 * 
 * // Change fog theme
 * await setTheme('mystical');
 * 
 * // Trigger reveal animation when new area is explored
 * triggerRevealAnimation();
 * ```
 */
export const useAdvancedFogVisualization = (
  colorScheme: ColorSchemeName,
  mapStyleUrl: string
): UseAdvancedFogVisualizationReturn => {
  // State management
  const [state, setState] = useState<AdvancedFogVisualizationState>({
    config: DEFAULT_CONFIG,
    isRevealing: false,
    currentStyling: getAdvancedFogStyling(colorScheme, mapStyleUrl),
    isLoading: true,
    error: null,
    availableThemes: getAvailableFogThemes(),
  });
  
  // Refs for managing animation state
  const revealTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isUnmountedRef = useRef(false);
  
  /**
   * Loads configuration (using defaults for now, can be extended with persistent storage)
   */
  const loadConfig = useCallback(async (): Promise<void> => {
    try {
      // For now, always use defaults - can be extended with persistent storage later
      const styling = getAdvancedFogStyling(
        colorScheme,
        mapStyleUrl,
        DEFAULT_CONFIG.theme,
        DEFAULT_CONFIG.density
      );
      
      setState(prev => ({
        ...prev,
        config: DEFAULT_CONFIG,
        currentStyling: styling,
        isLoading: false,
      }));
      
      logger.debugOnce('Using default advanced fog visualization config');
    } catch (error) {
      logger.error('Error loading advanced fog visualization config:', error);
      
      // Fallback to defaults on error
      const styling = getAdvancedFogStyling(
        colorScheme,
        mapStyleUrl,
        DEFAULT_CONFIG.theme,
        DEFAULT_CONFIG.density
      );
      
      setState(prev => ({
        ...prev,
        config: DEFAULT_CONFIG,
        currentStyling: styling,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load config',
      }));
    }
  }, [colorScheme, mapStyleUrl]);
  
  /**
   * Saves configuration (placeholder for persistent storage)
   */
  const saveConfig = useCallback(async (config: AdvancedFogVisualizationConfig): Promise<void> => {
    try {
      // Placeholder for persistent storage - could use SQLite or other storage
      logger.debugThrottled('Advanced fog visualization config would be saved', 5000);
    } catch (error) {
      logger.error('Error saving advanced fog visualization config:', error);
      throw error;
    }
  }, []);
  
  /**
   * Updates configuration and regenerates styling
   */
  const updateConfig = useCallback(async (
    updates: Partial<AdvancedFogVisualizationConfig>
  ): Promise<void> => {
    if (isUnmountedRef.current) return;
    
    const newConfig = { ...state.config, ...updates };
    
    // Generate new styling
    const newStyling = getAdvancedFogStyling(
      colorScheme,
      mapStyleUrl,
      newConfig.theme,
      newConfig.density,
      newConfig.customStyling
    );
    
    // Update state
    setState(prev => ({
      ...prev,
      config: newConfig,
      currentStyling: newStyling,
      error: null,
    }));
    
    // Save to storage
    try {
      await saveConfig(newConfig);
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to save config',
      }));
    }
  }, [state.config, colorScheme, mapStyleUrl, saveConfig]);
  
  /**
   * Sets fog theme
   */
  const setTheme = useCallback(async (theme: FogTheme): Promise<void> => {
    logger.debugOnce(`Setting fog theme to: ${theme}`);
    await updateConfig({ theme });
  }, [updateConfig]);
  
  /**
   * Sets fog density
   */
  const setDensity = useCallback(async (density: FogDensity): Promise<void> => {
    logger.debugOnce(`Setting fog density to: ${density}`);
    await updateConfig({ density });
  }, [updateConfig]);
  
  /**
   * Toggles animations
   */
  const toggleAnimations = useCallback(async (): Promise<void> => {
    const newValue = !state.config.enableAnimations;
    logger.debugOnce(`Toggling fog animations: ${newValue}`);
    await updateConfig({ enableAnimations: newValue });
  }, [state.config.enableAnimations, updateConfig]);
  
  /**
   * Toggles particle effects
   */
  const toggleParticleEffects = useCallback(async (): Promise<void> => {
    const newValue = !state.config.enableParticleEffects;
    logger.debugOnce(`Toggling fog particle effects: ${newValue}`);
    await updateConfig({ enableParticleEffects: newValue });
  }, [state.config.enableParticleEffects, updateConfig]);
  
  /**
   * Toggles recency-based density
   */
  const toggleRecencyBasedDensity = useCallback(async (): Promise<void> => {
    const newValue = !state.config.enableRecencyBasedDensity;
    logger.debugOnce(`Toggling recency-based fog density: ${newValue}`);
    await updateConfig({ enableRecencyBasedDensity: newValue });
  }, [state.config.enableRecencyBasedDensity, updateConfig]);
  
  /**
   * Toggles edge smoothing
   */
  const toggleEdgeSmoothing = useCallback(async (): Promise<void> => {
    const newValue = !state.config.enableEdgeSmoothing;
    logger.debugOnce(`Toggling fog edge smoothing: ${newValue}`);
    
    // Update edge blur in custom styling
    const customStyling = {
      ...state.config.customStyling,
      edge: {
        ...state.config.customStyling?.edge,
        lineBlur: newValue ? 3 : 0,
      },
    };
    
    await updateConfig({ 
      enableEdgeSmoothing: newValue,
      customStyling,
    });
  }, [state.config.enableEdgeSmoothing, state.config.customStyling, updateConfig]);
  
  /**
   * Updates custom styling
   */
  const updateCustomStyling = useCallback(async (
    styling: Partial<AdvancedFogStyling>
  ): Promise<void> => {
    logger.debugThrottled('Updating custom fog styling', 2000);
    
    const mergedStyling = {
      ...state.config.customStyling,
      ...styling,
    };
    
    await updateConfig({ customStyling: mergedStyling });
  }, [state.config.customStyling, updateConfig]);
  
  /**
   * Resets to default settings
   */
  const resetToDefaults = useCallback(async (): Promise<void> => {
    logger.debugOnce('Resetting fog visualization to defaults');
    
    setState(prev => ({
      ...prev,
      config: DEFAULT_CONFIG,
      currentStyling: getAdvancedFogStyling(colorScheme, mapStyleUrl),
      error: null,
    }));
    
    try {
      await saveConfig(DEFAULT_CONFIG);
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to save defaults',
      }));
    }
  }, [colorScheme, mapStyleUrl, saveConfig]);
  
  /**
   * Triggers reveal animation
   */
  const triggerRevealAnimation = useCallback((): void => {
    if (!state.config.enableAnimations) return;
    
    logger.debugThrottled('Triggering fog reveal animation', 1000);
    
    // Clear existing timeout
    if (revealTimeoutRef.current) {
      clearTimeout(revealTimeoutRef.current);
    }
    
    // Set revealing state
    setState(prev => ({ ...prev, isRevealing: true }));
    
    // Reset after animation duration
    const duration = state.currentStyling.animation.revealDuration + 100; // Add small buffer
    revealTimeoutRef.current = setTimeout(() => {
      if (!isUnmountedRef.current) {
        setState(prev => ({ ...prev, isRevealing: false }));
      }
    }, duration);
  }, [state.config.enableAnimations, state.currentStyling.animation.revealDuration]);
  
  /**
   * Calculates density for specific timestamp
   */
  const calculateDensityForTimestamp = useCallback((timestamp: number): number => {
    if (!state.config.enableRecencyBasedDensity) {
      return 1.0; // Full density if recency-based density is disabled
    }
    
    return calculateRecencyBasedDensity(
      timestamp,
      state.config.density,
      state.currentStyling.density.maxAgeHours
    );
  }, [state.config.enableRecencyBasedDensity, state.config.density, state.currentStyling.density.maxAgeHours]);
  
  /**
   * Gets styling for specific revealed area with recency-based density
   */
  const getStylingForArea = useCallback((areaId: string, timestamp: number): AdvancedFogStyling => {
    if (!state.config.enableRecencyBasedDensity) {
      return state.currentStyling;
    }
    
    const densityMultiplier = calculateDensityForTimestamp(timestamp);
    
    // Apply density multiplier to styling
    return {
      ...state.currentStyling,
      fill: {
        ...state.currentStyling.fill,
        fillOpacity: Math.max(
          state.currentStyling.fill.fillOpacity * densityMultiplier,
          state.currentStyling.density.minDensity
        ),
      },
      edge: {
        ...state.currentStyling.edge,
        lineOpacity: Math.max(
          state.currentStyling.edge.lineOpacity * densityMultiplier,
          state.currentStyling.density.minDensity * 0.8
        ),
        glowIntensity: Math.max(
          state.currentStyling.edge.glowIntensity * densityMultiplier,
          state.currentStyling.density.minDensity * 0.5
        ),
      },
    };
  }, [state.config.enableRecencyBasedDensity, state.currentStyling, calculateDensityForTimestamp]);
  
  // Load configuration on mount
  useEffect(() => {
    loadConfig();
    
    return () => {
      isUnmountedRef.current = true;
      if (revealTimeoutRef.current) {
        clearTimeout(revealTimeoutRef.current);
      }
    };
  }, [loadConfig]);
  
  // Update styling when color scheme or map style changes
  useEffect(() => {
    if (!state.isLoading) {
      const newStyling = getAdvancedFogStyling(
        colorScheme,
        mapStyleUrl,
        state.config.theme,
        state.config.density,
        state.config.customStyling
      );
      
      setState(prev => ({
        ...prev,
        currentStyling: newStyling,
      }));
    }
  }, [colorScheme, mapStyleUrl, state.config, state.isLoading]);
  
  return {
    ...state,
    setTheme,
    setDensity,
    toggleAnimations,
    toggleParticleEffects,
    toggleRecencyBasedDensity,
    toggleEdgeSmoothing,
    updateCustomStyling,
    resetToDefaults,
    triggerRevealAnimation,
    calculateDensityForTimestamp,
    getStylingForArea,
  };
};

export default useAdvancedFogVisualization;