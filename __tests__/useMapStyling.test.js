import { act, renderHook } from '@testing-library/react-native';
import { useColorScheme } from '../hooks/useColorScheme';
import { useMapStyling } from '../hooks/useMapStyling';
import * as mapStyling from '../utils/mapStyling';

// Mock dependencies
jest.mock('../hooks/useColorScheme');
jest.mock('../utils/mapStyling');
jest.mock('../utils/logger');

describe('useMapStyling', () => {
  const mockMapStyles = [
    { url: 'mapbox://styles/mapbox/dark-v10', name: 'Dark', isDark: true },
    { url: 'mapbox://styles/mapbox/light-v10', name: 'Light', isDark: false },
    { url: 'mapbox://styles/mapbox/streets-v11', name: 'Street', isDark: false },
    { url: 'mapbox://styles/mapbox/satellite-v9', name: 'Satellite', isDark: true }
  ];

  const mockFogStyling = {
    fill: { fillColor: '#0F172A', fillOpacity: 0.85 },
    edge: { lineColor: '#334155', lineOpacity: 0.6, lineWidth: 1.5, lineBlur: 3 }
  };

  const mockMarkerStyling = {
    container: {
      backgroundColor: 'rgba(59, 130, 246, 0.3)',
      borderColor: '#3B82F6',
      borderWidth: 2,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5
    },
    core: {
      backgroundColor: '#3B82F6',
      borderColor: '#FFFFFF',
      borderWidth: 2
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    useColorScheme.mockReturnValue('dark');
    mapStyling.MAP_STYLES = mockMapStyles;
    mapStyling.getAllMapStyles.mockReturnValue(mockMapStyles);
    mapStyling.getFogStyling.mockReturnValue(mockFogStyling);
    mapStyling.getLocationMarkerStyling.mockReturnValue(mockMarkerStyling);
    mapStyling.getMapStyleName.mockReturnValue('Dark');
    mapStyling.isMapStyleDark.mockReturnValue(true);
    mapStyling.getNextMapStyle.mockReturnValue(mockMapStyles[1].url);
    mapStyling.getMapStyleByName.mockImplementation(name => 
      mockMapStyles.find(style => style.name.toLowerCase() === name.toLowerCase())
    );
  });

  describe('initialization', () => {
    it('should initialize with default map style', () => {
      const { result } = renderHook(() => useMapStyling());

      expect(result.current.mapStyle).toBe(mockMapStyles[0].url);
      expect(result.current.mapStyleInfo).toEqual(mockMapStyles[0]);
      expect(result.current.colorScheme).toBe('dark');
      expect(result.current.fogStyling).toEqual(mockFogStyling);
      expect(result.current.locationMarkerStyling).toEqual(mockMarkerStyling);
      expect(result.current.isMapStyleDark).toBe(true);
      expect(result.current.availableMapStyles).toEqual(mockMapStyles);
    });

    it('should initialize with custom initial map style', () => {
      const { result } = renderHook(() => useMapStyling({
        initialMapStyle: mockMapStyles[1].url
      }));

      expect(result.current.mapStyle).toBe(mockMapStyles[1].url);
    });

    it('should initialize with map style by name', () => {
      const { result } = renderHook(() => useMapStyling({
        initialMapStyle: 'Light'
      }));

      expect(result.current.mapStyle).toBe(mockMapStyles[1].url);
    });

    it('should handle unknown initial map style', () => {
      const customUrl = 'mapbox://styles/custom/style';
      const { result } = renderHook(() => useMapStyling({
        initialMapStyle: customUrl
      }));

      expect(result.current.mapStyle).toBe(customUrl);
      expect(result.current.mapStyleInfo).toEqual({
        url: customUrl,
        name: 'Custom',
        isDark: true
      });
    });
  });

  describe('cycleMapStyle', () => {
    it('should cycle to the next map style', () => {
      const { result } = renderHook(() => useMapStyling());

      act(() => {
        result.current.cycleMapStyle();
      });

      expect(mapStyling.getNextMapStyle).toHaveBeenCalledWith(mockMapStyles[0].url);
      expect(result.current.mapStyle).toBe(mockMapStyles[1].url);
    });

    it('should update styling when cycling map styles', () => {
      mapStyling.getFogStyling.mockReturnValueOnce(mockFogStyling);
      const lightFogStyling = {
        fill: { fillColor: '#6B7280', fillOpacity: 0.75 },
        edge: { lineColor: '#9CA3AF', lineOpacity: 0.5, lineWidth: 1.5, lineBlur: 3 }
      };
      mapStyling.getFogStyling.mockReturnValueOnce(lightFogStyling);

      const { result } = renderHook(() => useMapStyling());

      act(() => {
        result.current.cycleMapStyle();
      });

      expect(result.current.fogStyling).toEqual(lightFogStyling);
    });
  });

  describe('setMapStyle', () => {
    it('should set map style by URL', () => {
      const { result } = renderHook(() => useMapStyling());

      act(() => {
        result.current.setMapStyle(mockMapStyles[2].url);
      });

      expect(result.current.mapStyle).toBe(mockMapStyles[2].url);
    });

    it('should set map style by name', () => {
      const { result } = renderHook(() => useMapStyling());

      act(() => {
        result.current.setMapStyle('Street');
      });

      expect(result.current.mapStyle).toBe(mockMapStyles[2].url);
    });

    it('should handle case-insensitive style names', () => {
      const { result } = renderHook(() => useMapStyling());

      act(() => {
        result.current.setMapStyle('LIGHT');
      });

      expect(result.current.mapStyle).toBe(mockMapStyles[1].url);
    });

    it('should handle unknown style names as custom URLs', () => {
      mapStyling.getMapStyleByName.mockReturnValue(undefined);
      const customUrl = 'mapbox://styles/custom/unknown';

      const { result } = renderHook(() => useMapStyling());

      act(() => {
        result.current.setMapStyle(customUrl);
      });

      expect(result.current.mapStyle).toBe(customUrl);
    });
  });

  describe('getFogStylingFor', () => {
    it('should get fog styling for specific theme and map style', () => {
      const { result } = renderHook(() => useMapStyling());

      const styling = result.current.getFogStylingFor('light', mockMapStyles[1].url);

      expect(mapStyling.getFogStyling).toHaveBeenCalledWith('light', mockMapStyles[1].url);
      expect(styling).toEqual(mockFogStyling);
    });

    it('should merge custom fog styling', () => {
      const customStyling = {
        fill: { fillOpacity: 0.9 },
        edge: { lineWidth: 2 }
      };

      const { result } = renderHook(() => useMapStyling({
        customFogStyling: customStyling
      }));

      const styling = result.current.getFogStylingFor('dark', mockMapStyles[0].url);

      expect(styling.fill.fillOpacity).toBe(0.9);
      expect(styling.edge.lineWidth).toBe(2);
      expect(styling.fill.fillColor).toBe(mockFogStyling.fill.fillColor); // Unchanged
    });
  });

  describe('getLocationMarkerStylingFor', () => {
    it('should get location marker styling for specific theme', () => {
      const { result } = renderHook(() => useMapStyling());

      const styling = result.current.getLocationMarkerStylingFor('light');

      expect(mapStyling.getLocationMarkerStyling).toHaveBeenCalledWith('light');
      expect(styling).toEqual(mockMarkerStyling);
    });

    it('should merge custom marker styling', () => {
      const customStyling = {
        container: { borderWidth: 3 },
        core: { backgroundColor: '#FF0000' }
      };

      const { result } = renderHook(() => useMapStyling({
        customMarkerStyling: customStyling
      }));

      const styling = result.current.getLocationMarkerStylingFor('dark');

      expect(styling.container.borderWidth).toBe(3);
      expect(styling.core.backgroundColor).toBe('#FF0000');
      expect(styling.container.backgroundColor).toBe(mockMarkerStyling.container.backgroundColor); // Unchanged
    });
  });

  describe('refreshStyling', () => {
    it('should refresh styling without changing map style', () => {
      const { result } = renderHook(() => useMapStyling());
      const initialMapStyle = result.current.mapStyle;

      act(() => {
        result.current.refreshStyling();
      });

      expect(result.current.mapStyle).toBe(initialMapStyle);
      // The refresh should trigger re-calculation of styling
    });
  });

  describe('resetToDefaultStyle', () => {
    it('should reset to default map style', () => {
      const { result } = renderHook(() => useMapStyling());

      // Change to a different style first
      act(() => {
        result.current.setMapStyle(mockMapStyles[2].url);
      });

      expect(result.current.mapStyle).toBe(mockMapStyles[2].url);

      // Reset to default
      act(() => {
        result.current.resetToDefaultStyle();
      });

      expect(result.current.mapStyle).toBe(mockMapStyles[0].url);
    });
  });

  describe('theme changes', () => {
    it('should update styling when color scheme changes', () => {
      const { result, rerender } = renderHook(() => useMapStyling());

      // Initial dark theme
      expect(result.current.colorScheme).toBe('dark');

      // Change to light theme
      useColorScheme.mockReturnValue('light');
      rerender();

      expect(result.current.colorScheme).toBe('light');
      expect(mapStyling.getFogStyling).toHaveBeenCalledWith('light', mockMapStyles[0].url);
    });

    it('should auto-adapt fog styling when enabled', () => {
      const { result, rerender } = renderHook(() => useMapStyling({
        autoAdaptFogStyling: true
      }));

      // Change theme
      useColorScheme.mockReturnValue('light');
      rerender();

      // Should recalculate fog styling for new theme
      expect(mapStyling.getFogStyling).toHaveBeenCalledWith('light', mockMapStyles[0].url);
    });
  });

  describe('custom styling', () => {
    it('should apply custom fog styling overrides', () => {
      const customFogStyling = {
        fill: { fillColor: '#FF0000', fillOpacity: 0.5 },
        edge: { lineWidth: 3 }
      };

      const { result } = renderHook(() => useMapStyling({
        customFogStyling
      }));

      expect(result.current.fogStyling.fill.fillColor).toBe('#FF0000');
      expect(result.current.fogStyling.fill.fillOpacity).toBe(0.5);
      expect(result.current.fogStyling.edge.lineWidth).toBe(3);
      // Other properties should remain from base styling
      expect(result.current.fogStyling.edge.lineColor).toBe(mockFogStyling.edge.lineColor);
    });

    it('should apply custom marker styling overrides', () => {
      const customMarkerStyling = {
        container: { backgroundColor: '#00FF00', borderWidth: 5 },
        core: { borderColor: '#000000' }
      };

      const { result } = renderHook(() => useMapStyling({
        customMarkerStyling
      }));

      expect(result.current.locationMarkerStyling.container.backgroundColor).toBe('#00FF00');
      expect(result.current.locationMarkerStyling.container.borderWidth).toBe(5);
      expect(result.current.locationMarkerStyling.core.borderColor).toBe('#000000');
      // Other properties should remain from base styling
      expect(result.current.locationMarkerStyling.core.backgroundColor).toBe(mockMarkerStyling.core.backgroundColor);
    });
  });

  describe('map style info', () => {
    it('should provide correct map style info for known styles', () => {
      mapStyling.isMapStyleDark.mockReturnValue(false); // Mock for light style
      
      const { result } = renderHook(() => useMapStyling({
        initialMapStyle: mockMapStyles[1].url
      }));

      expect(result.current.mapStyleInfo).toEqual(mockMapStyles[1]);
      expect(result.current.isMapStyleDark).toBe(false);
    });

    it('should provide fallback info for unknown styles', () => {
      const customUrl = 'mapbox://styles/custom/unknown';
      const { result } = renderHook(() => useMapStyling({
        initialMapStyle: customUrl
      }));

      expect(result.current.mapStyleInfo).toEqual({
        url: customUrl,
        name: 'Custom',
        isDark: true
      });
    });

    it('should provide available map styles', () => {
      const { result } = renderHook(() => useMapStyling());

      expect(result.current.availableMapStyles).toEqual(mockMapStyles);
    });
  });

  describe('edge cases', () => {
    it('should handle empty custom styling objects', () => {
      const { result } = renderHook(() => useMapStyling({
        customFogStyling: {},
        customMarkerStyling: {}
      }));

      expect(result.current.fogStyling).toEqual(mockFogStyling);
      expect(result.current.locationMarkerStyling).toEqual(mockMarkerStyling);
    });

    it('should handle partial custom styling objects', () => {
      const { result } = renderHook(() => useMapStyling({
        customFogStyling: { fill: { fillOpacity: 0.7 } },
        customMarkerStyling: { container: { borderWidth: 4 } }
      }));

      expect(result.current.fogStyling.fill.fillOpacity).toBe(0.7);
      expect(result.current.fogStyling.fill.fillColor).toBe(mockFogStyling.fill.fillColor);
      expect(result.current.locationMarkerStyling.container.borderWidth).toBe(4);
      expect(result.current.locationMarkerStyling.container.backgroundColor).toBe(mockMarkerStyling.container.backgroundColor);
    });

    it('should handle null/undefined color scheme', () => {
      useColorScheme.mockReturnValue(null);

      const { result } = renderHook(() => useMapStyling());

      expect(result.current.colorScheme).toBe(null);
      expect(mapStyling.getFogStyling).toHaveBeenCalledWith(null, mockMapStyles[0].url);
    });
  });

  describe('persistence placeholder', () => {
    it('should log when persistence is enabled but not implemented', () => {
      const { result } = renderHook(() => useMapStyling({
        persistMapStyle: true
      }));

      // Should not throw error, just log that persistence is not implemented
      expect(result.current.mapStyle).toBe(mockMapStyles[0].url);
    });
  });
});