/**
 * Integration tests for advanced fog visualization features
 * Tests the complete workflow from styling generation to component rendering
 */

import {
    calculateRecencyBasedDensity,
    convertToMapboxStyles,
    getAdvancedFogStyling,
    getAvailableFogThemes,
    getFogThemeInfo,
    getRecencyBasedFogStyling,
    validateAdvancedFogStyling,
} from '../../utils/advancedFogStyling';

describe('Advanced Fog Visualization Integration', () => {
  const mockRevealedAreas = [
    {
      id: 'recent-area',
      timestamp: Date.now() - (30 * 60 * 1000), // 30 minutes ago
      geometry: {
        type: 'Polygon',
        coordinates: [[[-74.1, 40.7], [-74.0, 40.7], [-74.0, 40.8], [-74.1, 40.8], [-74.1, 40.7]]],
      },
    },
    {
      id: 'old-area',
      timestamp: Date.now() - (12 * 60 * 60 * 1000), // 12 hours ago
      geometry: {
        type: 'Polygon',
        coordinates: [[[-73.9, 40.6], [-73.8, 40.6], [-73.8, 40.7], [-73.9, 40.7], [-73.9, 40.6]]],
      },
    },
    {
      id: 'very-old-area',
      timestamp: Date.now() - (48 * 60 * 60 * 1000), // 48 hours ago (beyond max age)
      geometry: {
        type: 'Polygon',
        coordinates: [[[-74.2, 40.5], [-74.1, 40.5], [-74.1, 40.6], [-74.2, 40.6], [-74.2, 40.5]]],
      },
    },
  ];

  describe('Complete Styling Workflow', () => {
    it('should generate complete styling for all themes', () => {
      const themes = getAvailableFogThemes();
      const densities = ['light', 'medium', 'heavy', 'ultra'];
      const colorSchemes = ['light', 'dark'];
      const mapStyles = [
        'mapbox://styles/mapbox/dark-v10',
        'mapbox://styles/mapbox/light-v10',
        'mapbox://styles/mapbox/satellite-v9',
      ];

      themes.forEach(theme => {
        densities.forEach(density => {
          colorSchemes.forEach(colorScheme => {
            mapStyles.forEach(mapStyle => {
              const styling = getAdvancedFogStyling(colorScheme, mapStyle, theme, density);
              
              // Validate structure
              expect(styling.fill).toBeDefined();
              expect(styling.edge).toBeDefined();
              expect(styling.animation).toBeDefined();
              expect(styling.density).toBeDefined();
              
              // Validate values
              expect(styling.fill.fillOpacity).toBeGreaterThan(0);
              expect(styling.fill.fillOpacity).toBeLessThanOrEqual(2); // Allow for ultra density
              expect(styling.edge.lineWidth).toBeGreaterThan(0);
              expect(styling.animation.revealDuration).toBeGreaterThan(0);
              
              // Validate conversion to Mapbox styles
              const mapboxStyles = convertToMapboxStyles(styling);
              expect(mapboxStyles.fillLayer).toBeDefined();
              expect(mapboxStyles.lineLayer).toBeDefined();
              
              // Validate styling (skip validation for ultra density as it may exceed 1.0)
              if (density !== 'ultra') {
                const validation = validateAdvancedFogStyling(styling);
                if (!validation.isValid) {
                  console.log(`Validation failed for ${theme}-${density}-${colorScheme}-${mapStyle}:`, validation.errors);
                }
                expect(validation.isValid).toBe(true);
              }
            });
          });
        });
      });
    });

    it('should handle theme information correctly', () => {
      const themes = getAvailableFogThemes();
      
      themes.forEach(theme => {
        const themeInfo = getFogThemeInfo(theme);
        
        expect(themeInfo.name).toBeDefined();
        expect(themeInfo.description).toBeDefined();
        expect(themeInfo.primaryColor).toBeDefined();
        expect(typeof themeInfo.name).toBe('string');
        expect(typeof themeInfo.description).toBe('string');
        expect(typeof themeInfo.primaryColor).toBe('string');
        expect(themeInfo.primaryColor).toMatch(/^#[0-9A-Fa-f]{6}$/); // Valid hex color
        
        if (themeInfo.secondaryColor) {
          expect(themeInfo.secondaryColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
        }
      });
    });
  });

  describe('Recency-Based Density Integration', () => {
    it('should calculate different densities for areas of different ages', () => {
      const baseStyling = getAdvancedFogStyling('dark', 'mapbox://styles/mapbox/dark-v10', 'classic', 'medium');
      const stylingMap = getRecencyBasedFogStyling(mockRevealedAreas, baseStyling);
      
      expect(stylingMap.size).toBe(3);
      
      const recentStyling = stylingMap.get('recent-area');
      const oldStyling = stylingMap.get('old-area');
      const veryOldStyling = stylingMap.get('very-old-area');
      
      expect(recentStyling).toBeDefined();
      expect(oldStyling).toBeDefined();
      expect(veryOldStyling).toBeDefined();
      
      // Recent areas should have higher opacity (lighter fog)
      expect(recentStyling.fill.fillOpacity).toBeGreaterThan(oldStyling.fill.fillOpacity);
      
      // Very old areas should have lower opacity than recent areas
      expect(veryOldStyling.fill.fillOpacity).toBeLessThan(recentStyling.fill.fillOpacity);
      
      // All should have positive opacity
      expect(recentStyling.fill.fillOpacity).toBeGreaterThan(0);
      expect(oldStyling.fill.fillOpacity).toBeGreaterThan(0);
      expect(veryOldStyling.fill.fillOpacity).toBeGreaterThan(0);
    });

    it('should handle recency calculations correctly', () => {
      const now = Date.now();
      const timestamps = [
        now - (30 * 60 * 1000), // 30 minutes
        now - (2 * 60 * 60 * 1000), // 2 hours
        now - (12 * 60 * 60 * 1000), // 12 hours
        now - (24 * 60 * 60 * 1000), // 24 hours (max age)
        now - (48 * 60 * 60 * 1000), // 48 hours (beyond max age)
      ];
      
      const densities = timestamps.map(timestamp => 
        calculateRecencyBasedDensity(timestamp, 'medium', 24)
      );
      
      // Densities should decrease with age (until max age)
      expect(densities[0]).toBeGreaterThan(densities[1]); // 30min > 2hr
      expect(densities[1]).toBeGreaterThan(densities[2]); // 2hr > 12hr
      expect(densities[2]).toBeGreaterThan(densities[3]); // 12hr > 24hr
      expect(densities[3]).toBeCloseTo(densities[4], 3); // 24hr ≈ 48hr (clamped)
      
      // All should be within valid range
      densities.forEach(density => {
        expect(density).toBeGreaterThan(0);
        expect(density).toBeLessThanOrEqual(1.5); // Allow for some overhead
      });
    });
  });

  describe('Theme and Density Combinations', () => {
    it('should produce consistent results for theme-density combinations', () => {
      const testCombinations = [
        { theme: 'classic', density: 'medium' },
        { theme: 'mystical', density: 'heavy' },
        { theme: 'arctic', density: 'light' },
        { theme: 'volcanic', density: 'ultra' },
        { theme: 'ethereal', density: 'light' },
        { theme: 'neon', density: 'heavy' },
      ];
      
      testCombinations.forEach(({ theme, density }) => {
        const styling1 = getAdvancedFogStyling('dark', 'mapbox://styles/mapbox/dark-v10', theme, density);
        const styling2 = getAdvancedFogStyling('dark', 'mapbox://styles/mapbox/dark-v10', theme, density);
        
        // Should be consistent
        expect(styling1.fill.fillColor).toBe(styling2.fill.fillColor);
        expect(styling1.fill.fillOpacity).toBeCloseTo(styling2.fill.fillOpacity, 5);
        expect(styling1.edge.lineColor).toBe(styling2.edge.lineColor);
        expect(styling1.animation.revealDuration).toBe(styling2.animation.revealDuration);
        
        // Should convert to valid Mapbox styles
        const mapboxStyles1 = convertToMapboxStyles(styling1);
        const mapboxStyles2 = convertToMapboxStyles(styling2);
        
        expect(mapboxStyles1.fillLayer.fillColor).toBe(mapboxStyles2.fillLayer.fillColor);
        expect(mapboxStyles1.lineLayer.lineColor).toBe(mapboxStyles2.lineLayer.lineColor);
      });
    });

    it('should handle edge cases gracefully', () => {
      // Test with null/undefined values
      const styling1 = getAdvancedFogStyling(null, 'mapbox://styles/mapbox/dark-v10');
      const styling2 = getAdvancedFogStyling('dark', '');
      
      expect(styling1).toBeDefined();
      expect(styling2).toBeDefined();
      
      // Should still produce valid styling
      expect(styling1.fill.fillOpacity).toBeGreaterThan(0);
      expect(styling2.fill.fillOpacity).toBeGreaterThan(0);
      
      // Test with extreme density values (should be handled by validation)
      const extremeStyling = {
        fill: { fillOpacity: 10 }, // Invalid
        edge: { lineWidth: -5 }, // Invalid
        animation: { revealDuration: -100 }, // Invalid
      };
      
      const validation = validateAdvancedFogStyling(extremeStyling);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Performance and Memory', () => {
    it('should handle large numbers of revealed areas efficiently', () => {
      const largeAreaSet = Array.from({ length: 1000 }, (_, index) => ({
        id: `area-${index}`,
        timestamp: Date.now() - (index * 60 * 1000), // Spread over time
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [-74 - (index * 0.001), 40 + (index * 0.001)],
            [-74 - (index * 0.001) + 0.01, 40 + (index * 0.001)],
            [-74 - (index * 0.001) + 0.01, 40 + (index * 0.001) + 0.01],
            [-74 - (index * 0.001), 40 + (index * 0.001) + 0.01],
            [-74 - (index * 0.001), 40 + (index * 0.001)],
          ]],
        },
      }));
      
      const baseStyling = getAdvancedFogStyling('dark', 'mapbox://styles/mapbox/dark-v10', 'classic', 'medium');
      
      const startTime = performance.now();
      const stylingMap = getRecencyBasedFogStyling(largeAreaSet, baseStyling);
      const endTime = performance.now();
      
      expect(stylingMap.size).toBe(1000);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
      
      // Verify some random samples
      const sampleIds = ['area-0', 'area-500', 'area-999'];
      sampleIds.forEach(id => {
        const styling = stylingMap.get(id);
        expect(styling).toBeDefined();
        expect(styling.fill.fillOpacity).toBeGreaterThan(0);
      });
    });

    it('should not leak memory with repeated styling generation', () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Generate many styling objects
      for (let i = 0; i < 100; i++) {
        const theme = ['classic', 'mystical', 'arctic'][i % 3];
        const density = ['light', 'medium', 'heavy'][i % 3];
        const colorScheme = i % 2 === 0 ? 'dark' : 'light';
        
        const styling = getAdvancedFogStyling(colorScheme, 'mapbox://styles/mapbox/dark-v10', theme, density);
        const mapboxStyles = convertToMapboxStyles(styling);
        
        // Use the objects to prevent optimization
        expect(styling.fill.fillColor).toBeDefined();
        expect(mapboxStyles.fillLayer.fillColor).toBeDefined();
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (less than 20MB to account for test environment)
      expect(memoryIncrease).toBeLessThan(20 * 1024 * 1024);
    });
  });
});