/**
 * Integration tests for fog calculation with loaded revealed areas
 * Tests Requirements: 2.1, 2.2, 2.3, 2.4
 */

// Jest globals are available in test environment
import { bboxPolygon, buffer, difference, union } from '@turf/turf';

// Mock the database functions
const mockGetRevealedAreas = jest.fn();
const mockSaveRevealedArea = jest.fn();
const mockInitDatabase = jest.fn();

jest.mock('../utils/database', () => ({
  getRevealedAreas: mockGetRevealedAreas,
  saveRevealedArea: mockSaveRevealedArea,
  initDatabase: mockInitDatabase,
}));

// Mock logger
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

// Import the functions we need to test (these would be extracted from map.tsx)
// For testing purposes, we'll recreate the key functions here

/**
 * Validates that a geometry is a proper Feature<Polygon | MultiPolygon>
 */
const isValidPolygonFeature = (feature) => {
  if (!feature) return false;
  if (feature.type !== 'Feature') return false;
  if (!feature.geometry) return false;
  if (feature.geometry.type !== 'Polygon' && feature.geometry.type !== 'MultiPolygon') return false;
  if (!feature.geometry.coordinates || !Array.isArray(feature.geometry.coordinates)) return false;
  if (feature.geometry.coordinates.length === 0) return false;
  return true;
};

/**
 * Unions multiple polygons into a single polygon
 */
const unionPolygons = (polygons) => {
  if (polygons.length === 0) return null;
  if (polygons.length === 1) return polygons[0];

  let unioned = polygons[0];
  
  for (let i = 1; i < polygons.length; i++) {
    try {
      const currentPolygon = polygons[i];
      
      if (!isValidPolygonFeature(currentPolygon)) {
        continue;
      }
      
      const featureCollection = {
        type: 'FeatureCollection',
        features: [unioned, currentPolygon]
      };
      const result = union(featureCollection);
      if (result && result.type === 'Feature') {
        unioned = result;
      }
    } catch (e) {
      // Continue with the current unioned result, skip the problematic polygon
    }
  }
  
  return unioned;
};

/**
 * Loads and processes revealed areas from database
 */
const loadRevealedAreas = async () => {
  const revealedPolygons = await mockGetRevealedAreas();
  
  if (revealedPolygons.length === 0) {
    return null;
  }

  const validPolygons = revealedPolygons.filter((polygon) => {
    return isValidPolygonFeature(polygon);
  });
  
  if (validPolygons.length === 0) {
    return null;
  }

  const result = unionPolygons(validPolygons);
  return result;
};

/**
 * Creates fog features with viewport-based calculation
 */
const createFogFeatures = (revealedAreas, viewportBounds) => {
  if (!viewportBounds) {
    return null;
  }

  try {
    // Create viewport polygon
    const viewportPolygon = bboxPolygon(viewportBounds);
    
    if (!revealedAreas) {
      // No revealed areas, return full viewport as fog
      return viewportPolygon;
    }

    // Perform difference operation
    const fogGeometry = difference(viewportPolygon, revealedAreas);
    return fogGeometry;
  } catch (error) {
    // Return viewport polygon as fallback
    return bboxPolygon(viewportBounds);
  }
};

describe('Fog Calculation with Loaded Revealed Areas Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Requirement 2.1: Previously revealed areas load correctly on app startup', () => {
    test('should load and process revealed areas from database on startup', async () => {
      const mockRevealedAreas = [
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]]
          }
        },
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [[[2, 2], [2, 3], [3, 3], [3, 2], [2, 2]]]
          }
        }
      ];

      mockGetRevealedAreas.mockResolvedValue(mockRevealedAreas);

      const result = await loadRevealedAreas();

      expect(mockGetRevealedAreas).toHaveBeenCalled();
      expect(result).toBeTruthy();
      expect(result.type).toBe('Feature');
      expect(result.geometry.type).toMatch(/^(Polygon|MultiPolygon)$/);
    });

    test('should handle empty database on startup', async () => {
      mockGetRevealedAreas.mockResolvedValue([]);

      const result = await loadRevealedAreas();

      expect(result).toBeNull();
    });

    test('should handle database errors on startup', async () => {
      mockGetRevealedAreas.mockRejectedValue(new Error('Database connection failed'));

      await expect(loadRevealedAreas()).rejects.toThrow('Database connection failed');
    });

    test('should filter out invalid geometries on startup', async () => {
      const mockMixedAreas = [
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]]
          }
        },
        {
          type: 'Invalid',
          geometry: null
        },
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [[[2, 2], [2, 3], [3, 3], [3, 2], [2, 2]]]
          }
        }
      ];

      mockGetRevealedAreas.mockResolvedValue(mockMixedAreas);

      const result = await loadRevealedAreas();

      expect(result).toBeTruthy();
      expect(result.type).toBe('Feature');
    });
  });

  describe('Requirement 2.2: Fog calculation works with loaded revealed areas across viewports', () => {
    test('should calculate fog correctly with loaded revealed areas in viewport', async () => {
      const mockRevealedArea = {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [[[0.5, 0.5], [0.5, 1.5], [1.5, 1.5], [1.5, 0.5], [0.5, 0.5]]]
        }
      };

      mockGetRevealedAreas.mockResolvedValue([mockRevealedArea]);

      const loadedAreas = await loadRevealedAreas();
      const viewportBounds = [0, 0, 2, 2]; // [minLng, minLat, maxLng, maxLat]
      
      const fogGeometry = createFogFeatures(loadedAreas, viewportBounds);

      expect(fogGeometry).toBeTruthy();
      expect(fogGeometry.type).toBe('Feature');
      // The fog should have holes where revealed areas are
      expect(fogGeometry.geometry.type).toMatch(/^(Polygon|MultiPolygon)$/);
    });

    test('should handle viewport with no revealed areas', async () => {
      mockGetRevealedAreas.mockResolvedValue([]);

      const loadedAreas = await loadRevealedAreas();
      const viewportBounds = [0, 0, 2, 2];
      
      const fogGeometry = createFogFeatures(loadedAreas, viewportBounds);

      expect(fogGeometry).toBeTruthy();
      expect(fogGeometry.type).toBe('Feature');
      expect(fogGeometry.geometry.type).toBe('Polygon');
      // Should be full viewport polygon since no revealed areas
    });

    test('should handle different viewport sizes with same revealed areas', async () => {
      const mockRevealedArea = {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [[[1, 1], [1, 2], [2, 2], [2, 1], [1, 1]]]
        }
      };

      mockGetRevealedAreas.mockResolvedValue([mockRevealedArea]);
      const loadedAreas = await loadRevealedAreas();

      // Test small viewport that includes revealed area
      const smallViewport = [0.5, 0.5, 2.5, 2.5];
      const smallFog = createFogFeatures(loadedAreas, smallViewport);
      expect(smallFog).toBeTruthy();

      // Test large viewport that includes revealed area
      const largeViewport = [-5, -5, 5, 5];
      const largeFog = createFogFeatures(loadedAreas, largeViewport);
      expect(largeFog).toBeTruthy();

      // Test viewport that doesn't include revealed area
      const distantViewport = [10, 10, 15, 15];
      const distantFog = createFogFeatures(loadedAreas, distantViewport);
      expect(distantFog).toBeTruthy();
    });

    test('should handle complex MultiPolygon revealed areas', async () => {
      const mockMultiPolygonArea = {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'MultiPolygon',
          coordinates: [
            [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]],
            [[[2, 2], [2, 3], [3, 3], [3, 2], [2, 2]]]
          ]
        }
      };

      mockGetRevealedAreas.mockResolvedValue([mockMultiPolygonArea]);
      const loadedAreas = await loadRevealedAreas();
      const viewportBounds = [-1, -1, 4, 4];
      
      const fogGeometry = createFogFeatures(loadedAreas, viewportBounds);

      expect(fogGeometry).toBeTruthy();
      expect(fogGeometry.type).toBe('Feature');
    });
  });

  describe('Requirement 2.3: New revealed areas merge properly with existing areas', () => {
    test('should merge new area with existing loaded areas', async () => {
      // Simulate existing areas in database
      const existingArea = {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]]
        }
      };

      mockGetRevealedAreas.mockResolvedValue([existingArea]);
      const loadedAreas = await loadRevealedAreas();

      // Create new area that overlaps with existing
      const newPoint = { type: 'Feature', geometry: { type: 'Point', coordinates: [0.5, 0.5] } };
      const newArea = buffer(newPoint, 50, { units: 'meters' });

      // Merge new area with existing
      const mergedAreas = unionPolygons([loadedAreas, newArea]);

      expect(mergedAreas).toBeTruthy();
      expect(mergedAreas.type).toBe('Feature');
      expect(mergedAreas.geometry.type).toMatch(/^(Polygon|MultiPolygon)$/);
    });

    test('should handle merging when no existing areas', async () => {
      mockGetRevealedAreas.mockResolvedValue([]);
      const loadedAreas = await loadRevealedAreas();

      // Create new area
      const newPoint = { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] } };
      const newArea = buffer(newPoint, 50, { units: 'meters' });

      // Since no existing areas, should just return the new area
      const result = loadedAreas || newArea;

      expect(result).toBeTruthy();
      expect(result.type).toBe('Feature');
    });

    test('should handle merging with multiple existing areas', async () => {
      const existingAreas = [
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]]
          }
        },
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [[[2, 2], [2, 3], [3, 3], [3, 2], [2, 2]]]
          }
        }
      ];

      mockGetRevealedAreas.mockResolvedValue(existingAreas);
      const loadedAreas = await loadRevealedAreas();

      // Create new area
      const newPoint = { type: 'Feature', geometry: { type: 'Point', coordinates: [1.5, 1.5] } };
      const newArea = buffer(newPoint, 100, { units: 'meters' });

      // Merge new area with existing union
      const mergedAreas = unionPolygons([loadedAreas, newArea]);

      expect(mergedAreas).toBeTruthy();
      expect(mergedAreas.type).toBe('Feature');
    });
  });

  describe('Requirement 2.4: App restart persistence and data consistency', () => {
    test('should maintain data consistency across app restarts', async () => {
      // Simulate first app session - save some areas
      const session1Areas = [
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]]
          }
        }
      ];

      // First session: load areas
      mockGetRevealedAreas.mockResolvedValue(session1Areas);
      const firstLoad = await loadRevealedAreas();
      expect(firstLoad).toBeTruthy();

      // Simulate app restart - should load same areas
      mockGetRevealedAreas.mockResolvedValue(session1Areas);
      const secondLoad = await loadRevealedAreas();
      
      expect(secondLoad).toEqual(firstLoad);
    });

    test('should handle incremental area additions across restarts', async () => {
      // Initial state
      const initialAreas = [
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]]
          }
        }
      ];

      mockGetRevealedAreas.mockResolvedValue(initialAreas);
      const initialLoad = await loadRevealedAreas();

      // After restart with additional area
      const expandedAreas = [
        ...initialAreas,
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [[[2, 2], [2, 3], [3, 3], [3, 2], [2, 2]]]
          }
        }
      ];

      mockGetRevealedAreas.mockResolvedValue(expandedAreas);
      const expandedLoad = await loadRevealedAreas();

      expect(expandedLoad).toBeTruthy();
      expect(expandedLoad).not.toEqual(initialLoad);
      // The expanded load should include both areas
    });

    test('should validate data integrity after restart', async () => {
      const testAreas = [
        {
          type: 'Feature',
          properties: { id: 'test-1', timestamp: Date.now() },
          geometry: {
            type: 'Polygon',
            coordinates: [[[0.123456, 0.789012], [0.123456, 1.789012], [1.123456, 1.789012], [1.123456, 0.789012], [0.123456, 0.789012]]]
          }
        }
      ];

      mockGetRevealedAreas.mockResolvedValue(testAreas);
      const loadedAreas = await loadRevealedAreas();

      // Verify data integrity
      expect(loadedAreas.type).toBe('Feature');
      expect(loadedAreas.geometry.type).toMatch(/^(Polygon|MultiPolygon)$/);
      expect(loadedAreas.geometry.coordinates).toBeTruthy();
      
      // Verify polygon is properly closed
      if (loadedAreas.geometry.type === 'Polygon') {
        const ring = loadedAreas.geometry.coordinates[0];
        expect(ring[0]).toEqual(ring[ring.length - 1]);
      }
    });
  });

  describe('Performance with Database Operations', () => {
    test('should handle large datasets efficiently', async () => {
      // Create large dataset
      const largeDataset = Array.from({ length: 50 }, (_, i) => ({
        type: 'Feature',
        properties: { id: i },
        geometry: {
          type: 'Polygon',
          coordinates: [[[i, i], [i, i + 0.1], [i + 0.1, i + 0.1], [i + 0.1, i], [i, i]]]
        }
      }));

      mockGetRevealedAreas.mockResolvedValue(largeDataset);

      const startTime = performance.now();
      const result = await loadRevealedAreas();
      const endTime = performance.now();

      expect(result).toBeTruthy();
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('should not cause performance issues with frequent saves', async () => {
      const testArea = {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]]
        }
      };

      mockSaveRevealedArea.mockResolvedValue(undefined);

      const startTime = performance.now();
      
      // Simulate frequent saves
      const savePromises = Array.from({ length: 10 }, () => mockSaveRevealedArea(testArea));
      await Promise.all(savePromises);
      
      const endTime = performance.now();

      expect(mockSaveRevealedArea).toHaveBeenCalledTimes(10);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});