/**
 * Tests for advanced fog styling utilities
 */

import {
    calculateRecencyBasedDensity,
    convertToMapboxStyles,
    getAdvancedFogStyling,
    getAvailableFogThemes,
    getFogThemeInfo,
    mergeAdvancedStyling,
    validateAdvancedFogStyling,
} from '../utils/advancedFogStyling';

describe('Advanced Fog Styling', () => {
  describe('getAdvancedFogStyling', () => {
    it('should return default classic theme styling', () => {
      const styling = getAdvancedFogStyling('dark', 'mapbox://styles/mapbox/dark-v10');
      
      expect(styling).toBeDefined();
      expect(styling.fill).toBeDefined();
      expect(styling.edge).toBeDefined();
      expect(styling.animation).toBeDefined();
      expect(styling.density).toBeDefined();
      
      expect(styling.fill.fillColor).toBe('#1E293B');
      expect(styling.fill.fillOpacity).toBeCloseTo(0.6, 2); // medium density (0.8 * 0.75)
      expect(styling.edge.lineBlur).toBe(3);
      expect(styling.animation.revealDuration).toBe(800);
    });

    it('should apply different themes correctly', () => {
      const mysticalStyling = getAdvancedFogStyling('dark', 'mapbox://styles/mapbox/dark-v10', 'mystical');
      const arcticStyling = getAdvancedFogStyling('dark', 'mapbox://styles/mapbox/dark-v10', 'arctic');
      
      expect(mysticalStyling.fill.fillColor).toBe('#312E81');
      expect(mysticalStyling.edge.lineColor).toBe('#6366F1');
      expect(mysticalStyling.animation.enableParticles).toBe(true);
      
      expect(arcticStyling.fill.fillColor).toBe('#0F172A');
      expect(arcticStyling.edge.lineColor).toBe('#0EA5E9');
      expect(arcticStyling.edge.glowIntensity).toBe(0.5); // Base glow intensity from arctic theme
    });

    it('should apply density multipliers correctly', () => {
      const lightStyling = getAdvancedFogStyling('dark', 'mapbox://styles/mapbox/dark-v10', 'classic', 'light');
      const heavyStyling = getAdvancedFogStyling('dark', 'mapbox://styles/mapbox/dark-v10', 'classic', 'heavy');
      const ultraStyling = getAdvancedFogStyling('dark', 'mapbox://styles/mapbox/dark-v10', 'classic', 'ultra');
      
      expect(lightStyling.fill.fillOpacity).toBe(0.4); // 0.8 * 0.5
      expect(heavyStyling.fill.fillOpacity).toBe(0.8); // 0.8 * 1.0
      expect(ultraStyling.fill.fillOpacity).toBe(1.04); // 0.8 * 1.3
      
      expect(lightStyling.density.baseMultiplier).toBe(0.5);
      expect(heavyStyling.density.baseMultiplier).toBe(1.0);
      expect(ultraStyling.density.baseMultiplier).toBe(1.3);
    });

    it('should apply custom styling overrides', () => {
      const customStyling = {
        fill: {
          fillColor: '#FF0000',
          fillOpacity: 0.9,
        },
        edge: {
          lineWidth: 5,
          glowIntensity: 0.8,
        },
      };
      
      const styling = getAdvancedFogStyling(
        'dark',
        'mapbox://styles/mapbox/dark-v10',
        'classic',
        'medium',
        customStyling
      );
      
      expect(styling.fill.fillColor).toBe('#FF0000');
      expect(styling.fill.fillOpacity).toBe(0.9);
      expect(styling.edge.lineWidth).toBe(5);
      expect(styling.edge.glowIntensity).toBe(0.8);
      
      // Other properties should remain from base theme
      expect(styling.animation.revealDuration).toBe(800);
    });
  });

  describe('calculateRecencyBasedDensity', () => {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    const twelveHoursAgo = now - (12 * 60 * 60 * 1000);
    const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);
    const fortyEightHoursAgo = now - (48 * 60 * 60 * 1000);

    it('should return higher density for recently explored areas', () => {
      const recentDensity = calculateRecencyBasedDensity(oneHourAgo, 'medium', 24);
      const oldDensity = calculateRecencyBasedDensity(twentyFourHoursAgo, 'medium', 24);
      
      expect(recentDensity).toBeGreaterThan(oldDensity);
      expect(recentDensity).toBeCloseTo(0.75 * (0.5 + 0.5 * (23/24)), 2); // Recent area
      expect(oldDensity).toBeCloseTo(0.75 * 0.5, 2); // Old area
    });

    it('should clamp age to maximum hours', () => {
      const veryOldDensity = calculateRecencyBasedDensity(fortyEightHoursAgo, 'medium', 24);
      const maxAgeDensity = calculateRecencyBasedDensity(twentyFourHoursAgo, 'medium', 24);
      
      expect(veryOldDensity).toBeCloseTo(maxAgeDensity, 3);
    });

    it('should work with different base density levels', () => {
      const lightDensity = calculateRecencyBasedDensity(twelveHoursAgo, 'light', 24);
      const heavyDensity = calculateRecencyBasedDensity(twelveHoursAgo, 'heavy', 24);
      
      expect(heavyDensity).toBeGreaterThan(lightDensity);
    });
  });

  describe('convertToMapboxStyles', () => {
    it('should convert advanced styling to Mapbox layer styles', () => {
      const advancedStyling = getAdvancedFogStyling('dark', 'mapbox://styles/mapbox/dark-v10', 'mystical');
      const mapboxStyles = convertToMapboxStyles(advancedStyling);
      
      expect(mapboxStyles.fillLayer).toBeDefined();
      expect(mapboxStyles.lineLayer).toBeDefined();
      expect(mapboxStyles.glowLayer).toBeDefined(); // Mystical theme has glow
      
      expect(mapboxStyles.fillLayer.fillColor).toBe('#312E81');
      expect(mapboxStyles.fillLayer.fillOpacity).toBe(advancedStyling.fill.fillOpacity);
      
      expect(mapboxStyles.lineLayer.lineColor).toBe('#6366F1');
      expect(mapboxStyles.lineLayer.lineWidth).toBe(2);
      expect(mapboxStyles.lineLayer.lineBlur).toBe(5);
      
      expect(mapboxStyles.glowLayer.lineColor).toBe('#A855F7');
      expect(mapboxStyles.glowLayer.lineWidth).toBe(4); // 2 * lineWidth
    });

    it('should not include glow layer for low glow intensity', () => {
      const advancedStyling = getAdvancedFogStyling('dark', 'mapbox://styles/mapbox/dark-v10', 'classic');
      const mapboxStyles = convertToMapboxStyles(advancedStyling);
      
      expect(mapboxStyles.glowLayer).toBeDefined(); // Classic theme has glow intensity 0.2, which creates glow layer
    });
  });

  describe('validateAdvancedFogStyling', () => {
    it('should validate correct styling configuration', () => {
      const validStyling = {
        fill: {
          fillOpacity: 0.8,
        },
        edge: {
          lineOpacity: 0.6,
          lineWidth: 2,
          glowIntensity: 0.5,
        },
        animation: {
          revealDuration: 1000,
          fadeDuration: 500,
        },
      };
      
      const result = validateAdvancedFogStyling(validStyling);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid opacity values', () => {
      const invalidStyling = {
        fill: {
          fillOpacity: 1.5, // Invalid: > 1
        },
        edge: {
          lineOpacity: -0.1, // Invalid: < 0
          glowIntensity: 2.0, // Invalid: > 1
        },
      };
      
      const result = validateAdvancedFogStyling(invalidStyling);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Fill opacity must be between 0 and 1');
      expect(result.errors).toContain('Line opacity must be between 0 and 1');
      expect(result.errors).toContain('Glow intensity must be between 0 and 1');
    });

    it('should detect invalid numeric values', () => {
      const invalidStyling = {
        edge: {
          lineWidth: -5, // Invalid: negative
        },
        animation: {
          revealDuration: -100, // Invalid: negative
          fadeDuration: -50, // Invalid: negative
        },
      };
      
      const result = validateAdvancedFogStyling(invalidStyling);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Line width must be non-negative');
      expect(result.errors).toContain('Reveal duration must be non-negative');
      expect(result.errors).toContain('Fade duration must be non-negative');
    });
  });

  describe('getAvailableFogThemes', () => {
    it('should return all available fog themes', () => {
      const themes = getAvailableFogThemes();
      
      expect(themes).toContain('classic');
      expect(themes).toContain('mystical');
      expect(themes).toContain('arctic');
      expect(themes).toContain('volcanic');
      expect(themes).toContain('ethereal');
      expect(themes).toContain('neon');
      expect(themes.length).toBe(6);
    });
  });

  describe('getFogThemeInfo', () => {
    it('should return theme information for all themes', () => {
      const themes = getAvailableFogThemes();
      
      themes.forEach(theme => {
        const info = getFogThemeInfo(theme);
        
        expect(info.name).toBeDefined();
        expect(info.description).toBeDefined();
        expect(info.primaryColor).toBeDefined();
        expect(typeof info.name).toBe('string');
        expect(typeof info.description).toBe('string');
        expect(typeof info.primaryColor).toBe('string');
      });
    });

    it('should return correct information for specific themes', () => {
      const classicInfo = getFogThemeInfo('classic');
      expect(classicInfo.name).toBe('Classic');
      expect(classicInfo.primaryColor).toBe('#1E293B');
      expect(classicInfo.secondaryColor).toBeUndefined();
      
      const mysticalInfo = getFogThemeInfo('mystical');
      expect(mysticalInfo.name).toBe('Mystical');
      expect(mysticalInfo.primaryColor).toBe('#312E81');
      expect(mysticalInfo.secondaryColor).toBe('#6366F1');
    });
  });

  describe('mergeAdvancedStyling', () => {
    it('should merge styling configurations correctly', () => {
      const base = {
        fill: {
          fillColor: '#000000',
          fillOpacity: 0.5,
        },
        edge: {
          lineColor: '#FFFFFF',
          lineWidth: 1,
        },
        animation: {
          revealDuration: 500,
          easing: 'ease-out',
        },
        density: {
          baseMultiplier: 1.0,
        },
      };
      
      const override = {
        fill: {
          fillColor: '#FF0000', // Override
          // fillOpacity not specified, should keep base value
        },
        edge: {
          lineWidth: 3, // Override
          glowIntensity: 0.8, // New property
        },
        // animation not specified, should keep base values
      };
      
      const merged = mergeAdvancedStyling(base, override);
      
      expect(merged.fill.fillColor).toBe('#FF0000'); // Overridden
      expect(merged.fill.fillOpacity).toBe(0.5); // From base
      expect(merged.edge.lineColor).toBe('#FFFFFF'); // From base
      expect(merged.edge.lineWidth).toBe(3); // Overridden
      expect(merged.edge.glowIntensity).toBe(0.8); // New
      expect(merged.animation.revealDuration).toBe(500); // From base
      expect(merged.animation.easing).toBe('ease-out'); // From base
      expect(merged.density.baseMultiplier).toBe(1.0); // From base
    });
  });
});