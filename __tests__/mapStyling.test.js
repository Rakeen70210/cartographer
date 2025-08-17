/**
 * Unit tests for map styling utilities
 * Tests theme-aware fog styling, location marker styling, and map style management
 */

import MapboxGL from '@rnmapbox/maps';
import {
    getAllMapStyles,
    getFogStyling,
    getLocationMarkerStyling,
    getMapStyleByName,
    getMapStyleName,
    getNextMapStyle,
    isMapStyleDark,
    MAP_STYLES,
} from '../utils/mapStyling';

// Mock MapboxGL StyleURL constants
jest.mock('@rnmapbox/maps', () => ({
  StyleURL: {
    Dark: 'mapbox://styles/mapbox/dark-v10',
    Light: 'mapbox://styles/mapbox/light-v10',
    Street: 'mapbox://styles/mapbox/streets-v11',
    Satellite: 'mapbox://styles/mapbox/satellite-v9',
    SatelliteStreet: 'mapbox://styles/mapbox/satellite-streets-v11',
  },
}));

describe('mapStyling utilities', () => {
  describe('getFogStyling', () => {
    it('should return dark fog styling for dark theme and dark map style', () => {
      const styling = getFogStyling('dark', MapboxGL.StyleURL.Dark);
      
      expect(styling.fill.fillColor).toBe('#0F172A');
      expect(styling.fill.fillOpacity).toBe(0.85);
      expect(styling.edge.lineColor).toBe('#334155');
      expect(styling.edge.lineOpacity).toBe(0.6);
      expect(styling.edge.lineWidth).toBe(1.5);
      expect(styling.edge.lineBlur).toBe(3);
    });

    it('should return appropriate fog styling for light theme and dark map style', () => {
      const styling = getFogStyling('light', MapboxGL.StyleURL.Dark);
      
      expect(styling.fill.fillColor).toBe('#1E293B');
      expect(styling.fill.fillOpacity).toBe(0.85);
      expect(styling.edge.lineColor).toBe('#475569');
      expect(styling.edge.lineOpacity).toBe(0.6);
    });

    it('should return appropriate fog styling for dark theme and light map style', () => {
      const styling = getFogStyling('dark', MapboxGL.StyleURL.Light);
      
      expect(styling.fill.fillColor).toBe('#374151');
      expect(styling.fill.fillOpacity).toBe(0.75);
      expect(styling.edge.lineColor).toBe('#4B5563');
      expect(styling.edge.lineOpacity).toBe(0.5);
    });

    it('should return appropriate fog styling for light theme and light map style', () => {
      const styling = getFogStyling('light', MapboxGL.StyleURL.Light);
      
      expect(styling.fill.fillColor).toBe('#6B7280');
      expect(styling.fill.fillOpacity).toBe(0.75);
      expect(styling.edge.lineColor).toBe('#9CA3AF');
      expect(styling.edge.lineOpacity).toBe(0.5);
    });

    it('should handle satellite map style correctly', () => {
      const styling = getFogStyling('dark', MapboxGL.StyleURL.Satellite);
      
      // Satellite is considered a dark map style
      expect(styling.fill.fillColor).toBe('#0F172A');
      expect(styling.fill.fillOpacity).toBe(0.85);
    });

    it('should handle street map style correctly', () => {
      const styling = getFogStyling('light', MapboxGL.StyleURL.Street);
      
      // Street is considered a light map style
      expect(styling.fill.fillColor).toBe('#6B7280');
      expect(styling.fill.fillOpacity).toBe(0.75);
    });

    it('should handle unknown map style with default dark styling', () => {
      const styling = getFogStyling('dark', 'unknown-style-url');
      
      // Should default to dark map style behavior
      expect(styling.fill.fillColor).toBe('#0F172A');
      expect(styling.fill.fillOpacity).toBe(0.85);
    });

    it('should handle null color scheme gracefully', () => {
      const styling = getFogStyling(null, MapboxGL.StyleURL.Dark);
      
      // Should treat null as light theme
      expect(styling.fill.fillColor).toBe('#1E293B');
      expect(styling.fill.fillOpacity).toBe(0.85);
    });
  });

  describe('getLocationMarkerStyling', () => {
    it('should return dark theme location marker styling', () => {
      const styling = getLocationMarkerStyling('dark');
      
      expect(styling.container.backgroundColor).toBe('rgba(59, 130, 246, 0.3)');
      expect(styling.container.borderColor).toBe('#3B82F6');
      expect(styling.container.borderWidth).toBe(2);
      expect(styling.container.shadowColor).toBe('#000000');
      expect(styling.container.shadowOpacity).toBe(0.25);
      expect(styling.container.elevation).toBe(5);
      
      expect(styling.core.backgroundColor).toBe('#3B82F6');
      expect(styling.core.borderColor).toBe('#FFFFFF');
      expect(styling.core.borderWidth).toBe(2);
    });

    it('should return light theme location marker styling', () => {
      const styling = getLocationMarkerStyling('light');
      
      expect(styling.container.backgroundColor).toBe('rgba(0, 122, 255, 0.3)');
      expect(styling.container.borderColor).toBe('#007AFF');
      expect(styling.container.borderWidth).toBe(2);
      
      expect(styling.core.backgroundColor).toBe('#007AFF');
      expect(styling.core.borderColor).toBe('#FFFFFF');
      expect(styling.core.borderWidth).toBe(2);
    });

    it('should handle null color scheme gracefully', () => {
      const styling = getLocationMarkerStyling(null);
      
      // Should treat null as light theme
      expect(styling.container.backgroundColor).toBe('rgba(0, 122, 255, 0.3)');
      expect(styling.container.borderColor).toBe('#007AFF');
      expect(styling.core.backgroundColor).toBe('#007AFF');
    });

    it('should include proper shadow properties', () => {
      const styling = getLocationMarkerStyling('dark');
      
      expect(styling.container.shadowOffset).toEqual({ width: 0, height: 2 });
      expect(styling.container.shadowRadius).toBe(3.84);
      expect(typeof styling.container.elevation).toBe('number');
    });
  });

  describe('getMapStyleName', () => {
    it('should return correct names for all map styles', () => {
      expect(getMapStyleName(MapboxGL.StyleURL.Dark)).toBe('Dark');
      expect(getMapStyleName(MapboxGL.StyleURL.Light)).toBe('Light');
      expect(getMapStyleName(MapboxGL.StyleURL.Street)).toBe('Street');
      expect(getMapStyleName(MapboxGL.StyleURL.Satellite)).toBe('Satellite');
      expect(getMapStyleName(MapboxGL.StyleURL.SatelliteStreet)).toBe('Satellite Street');
    });

    it('should return "Unknown" for unrecognized map style', () => {
      expect(getMapStyleName('unknown-style')).toBe('Unknown');
    });

    it('should handle empty string', () => {
      expect(getMapStyleName('')).toBe('Unknown');
    });

    it('should handle null/undefined input', () => {
      expect(getMapStyleName(null)).toBe('Unknown');
      expect(getMapStyleName(undefined)).toBe('Unknown');
    });
  });

  describe('getNextMapStyle', () => {
    it('should cycle through map styles correctly', () => {
      expect(getNextMapStyle(MapboxGL.StyleURL.Dark)).toBe(MapboxGL.StyleURL.Light);
      expect(getNextMapStyle(MapboxGL.StyleURL.Light)).toBe(MapboxGL.StyleURL.Street);
      expect(getNextMapStyle(MapboxGL.StyleURL.Street)).toBe(MapboxGL.StyleURL.Satellite);
      expect(getNextMapStyle(MapboxGL.StyleURL.Satellite)).toBe(MapboxGL.StyleURL.SatelliteStreet);
      expect(getNextMapStyle(MapboxGL.StyleURL.SatelliteStreet)).toBe(MapboxGL.StyleURL.Dark);
    });

    it('should handle unknown map style by returning first style', () => {
      expect(getNextMapStyle('unknown-style')).toBe(MapboxGL.StyleURL.Light);
    });

    it('should handle empty string', () => {
      expect(getNextMapStyle('')).toBe(MapboxGL.StyleURL.Light);
    });
  });

  describe('isMapStyleDark', () => {
    it('should correctly identify dark map styles', () => {
      expect(isMapStyleDark(MapboxGL.StyleURL.Dark)).toBe(true);
      expect(isMapStyleDark(MapboxGL.StyleURL.Satellite)).toBe(true);
    });

    it('should correctly identify light map styles', () => {
      expect(isMapStyleDark(MapboxGL.StyleURL.Light)).toBe(false);
      expect(isMapStyleDark(MapboxGL.StyleURL.Street)).toBe(false);
      expect(isMapStyleDark(MapboxGL.StyleURL.SatelliteStreet)).toBe(false);
    });

    it('should default to true for unknown map styles', () => {
      expect(isMapStyleDark('unknown-style')).toBe(true);
    });
  });

  describe('getAllMapStyles', () => {
    it('should return all available map styles', () => {
      const styles = getAllMapStyles();
      
      expect(styles).toHaveLength(5);
      expect(styles[0].name).toBe('Dark');
      expect(styles[0].url).toBe(MapboxGL.StyleURL.Dark);
      expect(styles[0].isDark).toBe(true);
      
      expect(styles[1].name).toBe('Light');
      expect(styles[1].isDark).toBe(false);
    });

    it('should return a copy of the styles array', () => {
      const styles1 = getAllMapStyles();
      const styles2 = getAllMapStyles();
      
      expect(styles1).not.toBe(styles2); // Different array instances
      expect(styles1).toEqual(styles2); // Same content
    });

    it('should include all required properties for each style', () => {
      const styles = getAllMapStyles();
      
      styles.forEach(style => {
        expect(style).toHaveProperty('url');
        expect(style).toHaveProperty('name');
        expect(style).toHaveProperty('isDark');
        expect(typeof style.url).toBe('string');
        expect(typeof style.name).toBe('string');
        expect(typeof style.isDark).toBe('boolean');
      });
    });
  });

  describe('getMapStyleByName', () => {
    it('should find map styles by exact name match', () => {
      expect(getMapStyleByName('Dark')).toEqual({
        url: MapboxGL.StyleURL.Dark,
        name: 'Dark',
        isDark: true,
      });
      
      expect(getMapStyleByName('Light')).toEqual({
        url: MapboxGL.StyleURL.Light,
        name: 'Light',
        isDark: false,
      });
    });

    it('should find map styles by case-insensitive name match', () => {
      expect(getMapStyleByName('dark')).toEqual({
        url: MapboxGL.StyleURL.Dark,
        name: 'Dark',
        isDark: true,
      });
      
      expect(getMapStyleByName('LIGHT')).toEqual({
        url: MapboxGL.StyleURL.Light,
        name: 'Light',
        isDark: false,
      });
      
      expect(getMapStyleByName('satellite street')).toEqual({
        url: MapboxGL.StyleURL.SatelliteStreet,
        name: 'Satellite Street',
        isDark: false,
      });
    });

    it('should return undefined for unknown style names', () => {
      expect(getMapStyleByName('Unknown Style')).toBeUndefined();
      expect(getMapStyleByName('')).toBeUndefined();
    });

    it('should handle null/undefined input', () => {
      expect(getMapStyleByName(null)).toBeUndefined();
      expect(getMapStyleByName(undefined)).toBeUndefined();
    });
  });

  describe('MAP_STYLES constant', () => {
    it('should contain all expected map styles', () => {
      expect(MAP_STYLES).toHaveLength(5);
      
      const styleNames = MAP_STYLES.map(style => style.name);
      expect(styleNames).toContain('Dark');
      expect(styleNames).toContain('Light');
      expect(styleNames).toContain('Street');
      expect(styleNames).toContain('Satellite');
      expect(styleNames).toContain('Satellite Street');
    });

    it('should have correct dark/light classifications', () => {
      const darkStyles = MAP_STYLES.filter(style => style.isDark);
      const lightStyles = MAP_STYLES.filter(style => !style.isDark);
      
      expect(darkStyles.map(s => s.name)).toEqual(['Dark', 'Satellite']);
      expect(lightStyles.map(s => s.name)).toEqual(['Light', 'Street', 'Satellite Street']);
    });

    it('should have valid URLs for all styles', () => {
      MAP_STYLES.forEach(style => {
        expect(style.url).toBeTruthy();
        expect(typeof style.url).toBe('string');
        expect(style.url.length).toBeGreaterThan(0);
      });
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle various falsy values gracefully', () => {
      // Test fog styling with falsy values
      expect(() => getFogStyling(null, MapboxGL.StyleURL.Dark)).not.toThrow();
      expect(() => getFogStyling(undefined, MapboxGL.StyleURL.Dark)).not.toThrow();
      expect(() => getFogStyling('dark', null)).not.toThrow();
      expect(() => getFogStyling('dark', undefined)).not.toThrow();
      
      // Test location marker styling with falsy values
      expect(() => getLocationMarkerStyling(null)).not.toThrow();
      expect(() => getLocationMarkerStyling(undefined)).not.toThrow();
    });

    it('should maintain consistent styling structure', () => {
      const fogStyling = getFogStyling('dark', MapboxGL.StyleURL.Dark);
      
      expect(fogStyling).toHaveProperty('fill');
      expect(fogStyling).toHaveProperty('edge');
      expect(fogStyling.fill).toHaveProperty('fillColor');
      expect(fogStyling.fill).toHaveProperty('fillOpacity');
      expect(fogStyling.edge).toHaveProperty('lineColor');
      expect(fogStyling.edge).toHaveProperty('lineOpacity');
      expect(fogStyling.edge).toHaveProperty('lineWidth');
      expect(fogStyling.edge).toHaveProperty('lineBlur');
    });

    it('should maintain consistent marker styling structure', () => {
      const markerStyling = getLocationMarkerStyling('dark');
      
      expect(markerStyling).toHaveProperty('container');
      expect(markerStyling).toHaveProperty('core');
      expect(markerStyling.container).toHaveProperty('backgroundColor');
      expect(markerStyling.container).toHaveProperty('borderColor');
      expect(markerStyling.container).toHaveProperty('shadowColor');
      expect(markerStyling.core).toHaveProperty('backgroundColor');
      expect(markerStyling.core).toHaveProperty('borderColor');
    });
  });
});