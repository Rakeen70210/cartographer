/**
 * Advanced fog styling utilities for enhanced visualization features
 * Provides fog themes, density variations, edge smoothing, and animation support
 */

import { logger } from '@/utils/logger';
import { ColorSchemeName } from 'react-native';

/**
 * Available fog themes for customization
 */
export type FogTheme = 'classic' | 'mystical' | 'arctic' | 'volcanic' | 'ethereal' | 'neon';

/**
 * Fog density levels based on exploration recency
 */
export type FogDensity = 'light' | 'medium' | 'heavy' | 'ultra';

/**
 * Enhanced fog styling configuration with advanced features
 */
export interface AdvancedFogStyling {
  /** Base fill styling for the main fog area */
  fill: {
    /** Primary color of the fog fill */
    fillColor: string;
    /** Secondary color for gradient effects */
    fillColorSecondary?: string;
    /** Opacity of the fog fill (0-1) */
    fillOpacity: number;
    /** Pattern or texture for the fog (optional) */
    fillPattern?: string;
  };
  /** Enhanced edge styling with smoothing and anti-aliasing */
  edge: {
    /** Color of the fog edge lines */
    lineColor: string;
    /** Secondary edge color for gradient effects */
    lineColorSecondary?: string;
    /** Opacity of the fog edge lines (0-1) */
    lineOpacity: number;
    /** Width of the fog edge lines in pixels */
    lineWidth: number;
    /** Blur amount for softer fog edges (anti-aliasing) */
    lineBlur: number;
    /** Glow effect intensity (0-1) */
    glowIntensity: number;
    /** Glow color for edge effects */
    glowColor: string;
  };
  /** Animation properties for fog transitions */
  animation: {
    /** Duration of fog reveal animations in milliseconds */
    revealDuration: number;
    /** Easing function for animations */
    easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'bounce';
    /** Whether to enable particle effects */
    enableParticles: boolean;
    /** Fade transition duration in milliseconds */
    fadeDuration: number;
  };
  /** Density variation properties */
  density: {
    /** Base density multiplier */
    baseMultiplier: number;
    /** Recency-based density scaling */
    recencyScaling: boolean;
    /** Maximum age in hours for density calculation */
    maxAgeHours: number;
    /** Minimum density threshold */
    minDensity: number;
  };
}

/**
 * Fog theme definitions with unique visual characteristics
 */
const FOG_THEMES: Record<FogTheme, Partial<AdvancedFogStyling>> = {
  classic: {
    fill: {
      fillColor: '#1E293B',
      fillOpacity: 0.8,
    },
    edge: {
      lineColor: '#475569',
      lineOpacity: 0.6,
      lineWidth: 1.5,
      lineBlur: 3,
      glowIntensity: 0.2,
      glowColor: '#64748B',
    },
    animation: {
      revealDuration: 800,
      easing: 'ease-out',
      enableParticles: false,
      fadeDuration: 400,
    },
  },
  mystical: {
    fill: {
      fillColor: '#312E81',
      fillColorSecondary: '#1E1B4B',
      fillOpacity: 0.85,
    },
    edge: {
      lineColor: '#6366F1',
      lineColorSecondary: '#8B5CF6',
      lineOpacity: 0.7,
      lineWidth: 2,
      lineBlur: 5,
      glowIntensity: 0.6,
      glowColor: '#A855F7',
    },
    animation: {
      revealDuration: 1200,
      easing: 'ease-in-out',
      enableParticles: true,
      fadeDuration: 600,
    },
  },
  arctic: {
    fill: {
      fillColor: '#0F172A',
      fillColorSecondary: '#1E293B',
      fillOpacity: 0.9,
    },
    edge: {
      lineColor: '#0EA5E9',
      lineColorSecondary: '#38BDF8',
      lineOpacity: 0.8,
      lineWidth: 1.8,
      lineBlur: 4,
      glowIntensity: 0.5,
      glowColor: '#7DD3FC',
    },
    animation: {
      revealDuration: 1000,
      easing: 'ease-out',
      enableParticles: true,
      fadeDuration: 500,
    },
  },
  volcanic: {
    fill: {
      fillColor: '#7C2D12',
      fillColorSecondary: '#991B1B',
      fillOpacity: 0.85,
    },
    edge: {
      lineColor: '#F97316',
      lineColorSecondary: '#EF4444',
      lineOpacity: 0.75,
      lineWidth: 2.2,
      lineBlur: 6,
      glowIntensity: 0.8,
      glowColor: '#FBBF24',
    },
    animation: {
      revealDuration: 900,
      easing: 'ease-in',
      enableParticles: true,
      fadeDuration: 450,
    },
  },
  ethereal: {
    fill: {
      fillColor: '#F8FAFC',
      fillColorSecondary: '#E2E8F0',
      fillOpacity: 0.7,
    },
    edge: {
      lineColor: '#CBD5E1',
      lineColorSecondary: '#94A3B8',
      lineOpacity: 0.5,
      lineWidth: 1.2,
      lineBlur: 8,
      glowIntensity: 0.3,
      glowColor: '#E2E8F0',
    },
    animation: {
      revealDuration: 1500,
      easing: 'ease-in-out',
      enableParticles: false,
      fadeDuration: 750,
    },
  },
  neon: {
    fill: {
      fillColor: '#0C0A09',
      fillColorSecondary: '#1C1917',
      fillOpacity: 0.9,
    },
    edge: {
      lineColor: '#00FF88',
      lineColorSecondary: '#00D9FF',
      lineOpacity: 0.9,
      lineWidth: 2.5,
      lineBlur: 2,
      glowIntensity: 1.0,
      glowColor: '#39FF14',
    },
    animation: {
      revealDuration: 600,
      easing: 'bounce',
      enableParticles: true,
      fadeDuration: 300,
    },
  },
};

/**
 * Density multipliers for different fog density levels
 */
const DENSITY_MULTIPLIERS: Record<FogDensity, number> = {
  light: 0.5,
  medium: 0.75,
  heavy: 1.0,
  ultra: 1.3,
};

/**
 * Gets advanced fog styling with theme, density, and customization options
 * 
 * @param colorScheme - Current system color scheme
 * @param mapStyleUrl - Current map style URL
 * @param theme - Selected fog theme
 * @param density - Fog density level
 * @param customizations - Optional style customizations
 * @returns Advanced fog styling configuration
 */
export const getAdvancedFogStyling = (
  colorScheme: ColorSchemeName,
  mapStyleUrl: string,
  theme: FogTheme = 'classic',
  density: FogDensity = 'medium',
  customizations?: Partial<AdvancedFogStyling>
): AdvancedFogStyling => {
  const isDarkTheme = colorScheme === 'dark';
  const baseTheme = FOG_THEMES[theme];
  const densityMultiplier = DENSITY_MULTIPLIERS[density];
  
  // Create base styling from theme
  const baseStyling: AdvancedFogStyling = {
    fill: {
      fillColor: baseTheme.fill?.fillColor || '#1E293B',
      fillColorSecondary: baseTheme.fill?.fillColorSecondary,
      fillOpacity: (baseTheme.fill?.fillOpacity || 0.8) * densityMultiplier,
      fillPattern: baseTheme.fill?.fillPattern,
    },
    edge: {
      lineColor: baseTheme.edge?.lineColor || '#475569',
      lineColorSecondary: baseTheme.edge?.lineColorSecondary,
      lineOpacity: (baseTheme.edge?.lineOpacity || 0.6) * densityMultiplier,
      lineWidth: baseTheme.edge?.lineWidth || 1.5,
      lineBlur: baseTheme.edge?.lineBlur || 3,
      glowIntensity: baseTheme.edge?.glowIntensity || 0.2,
      glowColor: baseTheme.edge?.glowColor || '#64748B',
    },
    animation: {
      revealDuration: baseTheme.animation?.revealDuration || 800,
      easing: baseTheme.animation?.easing || 'ease-out',
      enableParticles: baseTheme.animation?.enableParticles || false,
      fadeDuration: baseTheme.animation?.fadeDuration || 400,
    },
    density: {
      baseMultiplier: densityMultiplier,
      recencyScaling: true,
      maxAgeHours: 24,
      minDensity: 0.3,
    },
  };
  
  // Adjust for theme compatibility
  if (!isDarkTheme && theme === 'classic') {
    // Lighter fog for light themes
    baseStyling.fill.fillColor = '#6B7280';
    baseStyling.fill.fillOpacity *= 0.9;
    baseStyling.edge.lineColor = '#9CA3AF';
  }
  
  // Apply customizations
  if (customizations) {
    return mergeAdvancedStyling(baseStyling, customizations);
  }
  
  return baseStyling;
};

/**
 * Calculates fog density based on exploration recency
 * 
 * @param lastExploredTimestamp - Timestamp of last exploration in the area
 * @param baseDensity - Base fog density level
 * @param maxAgeHours - Maximum age in hours for density calculation
 * @returns Calculated fog density multiplier
 */
export const calculateRecencyBasedDensity = (
  lastExploredTimestamp: number,
  baseDensity: FogDensity = 'medium',
  maxAgeHours: number = 24
): number => {
  const now = Date.now();
  const ageHours = (now - lastExploredTimestamp) / (1000 * 60 * 60);
  
  // Clamp age to max hours
  const clampedAge = Math.min(ageHours, maxAgeHours);
  
  // Calculate recency factor (1.0 = just explored, 0.0 = max age)
  const recencyFactor = 1.0 - (clampedAge / maxAgeHours);
  
  // Base density multiplier
  const baseDensityMultiplier = DENSITY_MULTIPLIERS[baseDensity];
  
  // Apply recency scaling (more recent = lighter fog)
  const recencyMultiplier = 0.5 + (recencyFactor * 0.5); // Range: 0.5 to 1.0
  
  return baseDensityMultiplier * recencyMultiplier;
};

/**
 * Gets fog styling for specific revealed areas with recency-based density
 * 
 * @param revealedAreas - Array of revealed areas with timestamps
 * @param baseStyling - Base advanced fog styling
 * @returns Map of area IDs to density-adjusted styling
 */
export const getRecencyBasedFogStyling = (
  revealedAreas: Array<{ id: string; timestamp: number; geometry: any }>,
  baseStyling: AdvancedFogStyling
): Map<string, AdvancedFogStyling> => {
  const stylingMap = new Map<string, AdvancedFogStyling>();
  
  revealedAreas.forEach(area => {
    if (!baseStyling.density.recencyScaling) {
      stylingMap.set(area.id, baseStyling);
      return;
    }
    
    const recencyMultiplier = calculateRecencyBasedDensity(
      area.timestamp,
      'medium',
      baseStyling.density.maxAgeHours
    );
    
    // Ensure minimum density
    const finalMultiplier = Math.max(recencyMultiplier, baseStyling.density.minDensity);
    
    const areaStyling: AdvancedFogStyling = {
      ...baseStyling,
      fill: {
        ...baseStyling.fill,
        fillOpacity: baseStyling.fill.fillOpacity * finalMultiplier,
      },
      edge: {
        ...baseStyling.edge,
        lineOpacity: baseStyling.edge.lineOpacity * finalMultiplier,
        glowIntensity: baseStyling.edge.glowIntensity * finalMultiplier,
      },
    };
    
    stylingMap.set(area.id, areaStyling);
  });
  
  return stylingMap;
};

/**
 * Converts advanced fog styling to Mapbox-compatible layer styles
 * 
 * @param advancedStyling - Advanced fog styling configuration
 * @returns Object with fill and line layer styles for Mapbox
 */
export const convertToMapboxStyles = (
  advancedStyling: AdvancedFogStyling
): {
  fillLayer: any;
  lineLayer: any;
  glowLayer?: any;
} => {
  const fillLayer = {
    fillColor: advancedStyling.fill.fillColor,
    fillOpacity: advancedStyling.fill.fillOpacity,
    ...(advancedStyling.fill.fillPattern && {
      fillPattern: advancedStyling.fill.fillPattern,
    }),
  };
  
  const lineLayer = {
    lineColor: advancedStyling.edge.lineColor,
    lineOpacity: advancedStyling.edge.lineOpacity,
    lineWidth: advancedStyling.edge.lineWidth,
    lineBlur: advancedStyling.edge.lineBlur,
  };
  
  // Add glow layer if glow intensity is significant
  let glowLayer;
  if (advancedStyling.edge.glowIntensity > 0.1) {
    glowLayer = {
      lineColor: advancedStyling.edge.glowColor,
      lineOpacity: advancedStyling.edge.glowIntensity * 0.5,
      lineWidth: advancedStyling.edge.lineWidth * 2,
      lineBlur: advancedStyling.edge.lineBlur * 2,
    };
  }
  
  return { fillLayer, lineLayer, glowLayer };
};

/**
 * Merges advanced fog styling configurations
 * 
 * @param base - Base styling configuration
 * @param override - Override styling configuration
 * @returns Merged styling configuration
 */
export const mergeAdvancedStyling = (
  base: AdvancedFogStyling,
  override: Partial<AdvancedFogStyling>
): AdvancedFogStyling => {
  return {
    fill: { ...base.fill, ...override.fill },
    edge: { ...base.edge, ...override.edge },
    animation: { ...base.animation, ...override.animation },
    density: { ...base.density, ...override.density },
  };
};

/**
 * Gets all available fog themes
 * 
 * @returns Array of available fog theme names
 */
export const getAvailableFogThemes = (): FogTheme[] => {
  return Object.keys(FOG_THEMES) as FogTheme[];
};

/**
 * Gets theme information for UI display
 * 
 * @param theme - Fog theme name
 * @returns Theme display information
 */
export const getFogThemeInfo = (theme: FogTheme): {
  name: string;
  description: string;
  primaryColor: string;
  secondaryColor?: string;
} => {
  const themeData = FOG_THEMES[theme];
  
  const themeInfo = {
    classic: {
      name: 'Classic',
      description: 'Traditional dark fog with subtle edges',
      primaryColor: '#1E293B',
    },
    mystical: {
      name: 'Mystical',
      description: 'Purple-tinted fog with magical glow effects',
      primaryColor: '#312E81',
      secondaryColor: '#6366F1',
    },
    arctic: {
      name: 'Arctic',
      description: 'Ice-blue fog with crystalline edges',
      primaryColor: '#0F172A',
      secondaryColor: '#0EA5E9',
    },
    volcanic: {
      name: 'Volcanic',
      description: 'Fiery red-orange fog with ember glow',
      primaryColor: '#7C2D12',
      secondaryColor: '#F97316',
    },
    ethereal: {
      name: 'Ethereal',
      description: 'Light, translucent fog with soft edges',
      primaryColor: '#F8FAFC',
      secondaryColor: '#CBD5E1',
    },
    neon: {
      name: 'Neon',
      description: 'Cyberpunk-style fog with bright neon edges',
      primaryColor: '#0C0A09',
      secondaryColor: '#00FF88',
    },
  };
  
  return themeInfo[theme];
};

/**
 * Validates advanced fog styling configuration
 * 
 * @param styling - Styling configuration to validate
 * @returns Validation result with errors if any
 */
export const validateAdvancedFogStyling = (
  styling: Partial<AdvancedFogStyling>
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  // Validate fill properties
  if (styling.fill) {
    if (styling.fill.fillOpacity !== undefined) {
      if (styling.fill.fillOpacity < 0 || styling.fill.fillOpacity > 1) {
        errors.push('Fill opacity must be between 0 and 1');
      }
    }
  }
  
  // Validate edge properties
  if (styling.edge) {
    if (styling.edge.lineOpacity !== undefined) {
      if (styling.edge.lineOpacity < 0 || styling.edge.lineOpacity > 1) {
        errors.push('Line opacity must be between 0 and 1');
      }
    }
    
    if (styling.edge.lineWidth !== undefined) {
      if (styling.edge.lineWidth < 0) {
        errors.push('Line width must be non-negative');
      }
    }
    
    if (styling.edge.glowIntensity !== undefined) {
      if (styling.edge.glowIntensity < 0 || styling.edge.glowIntensity > 1) {
        errors.push('Glow intensity must be between 0 and 1');
      }
    }
  }
  
  // Validate animation properties
  if (styling.animation) {
    if (styling.animation.revealDuration !== undefined) {
      if (styling.animation.revealDuration < 0) {
        errors.push('Reveal duration must be non-negative');
      }
    }
    
    if (styling.animation.fadeDuration !== undefined) {
      if (styling.animation.fadeDuration < 0) {
        errors.push('Fade duration must be non-negative');
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
};

logger.debugOnce('Advanced fog styling utilities loaded');