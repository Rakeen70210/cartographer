import {
    calculateMultipleRegionExploration,
    calculatePolygonArea,
    calculateRegionExploration,
    getAllCachedBoundaries,
    getRegionBoundaryData,
    getRegionBoundingBox,
    isPointInRegion,
    simplifyPolygon,
    validateGeometry
} from '../utils/regionBoundaryService';

// Mock the database module
jest.mock('../utils/database', () => ({
  saveRegionBoundary: jest.fn(),
  getRegionBoundary: jest.fn(),
  getAllRegionBoundaries: jest.fn()
}));

// Mock the logger
jest.mock('../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    success: jest.fn()
  }
}));

// Mock turf functions
jest.mock('@turf/turf', () => ({
  feature: jest.fn((geometry) => ({ type: 'Feature', geometry })),
  area: jest.fn(() => 1000000000), // 1000 km² in square meters
  centroid: jest.fn(() => ({ geometry: { coordinates: [0, 0] } })),
  intersect: jest.fn(),
  bbox: jest.fn(() => [-1, -1, 1, 1]),
  simplify: jest.fn((feature) => feature),
  point: jest.fn((coords) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: coords } })),
  booleanPointInPolygon: jest.fn(() => true)
}));

describe('RegionBoundaryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset turf mocks to default values
    const turf = require('@turf/turf');
    turf.feature.mockImplementation((geometry) => ({ type: 'Feature', geometry }));
    turf.area.mockReturnValue(1000000000); // 1000 km² in square meters
    turf.centroid.mockReturnValue({ geometry: { coordinates: [0, 0] } });
    turf.intersect.mockReturnValue(null);
    turf.bbox.mockReturnValue([-1, -1, 1, 1]);
    turf.simplify.mockImplementation((feature) => feature);
    turf.point.mockImplementation((coords) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: coords } }));
    turf.booleanPointInPolygon.mockReturnValue(true);
  });

  // Sample test data
  const samplePolygon = {
    type: 'Polygon',
    coordinates: [[
      [-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]
    ]]
  };

  const sampleRevealedAreas = [
    {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5], [-0.5, -0.5]
        ]]
      }
    }
  ];

  describe('getRegionBoundaryData', () => {
    test('should return cached boundary data when available', async () => {
      const { getRegionBoundary } = require('../utils/database');
      
      const cachedBoundary = {
        id: 1,
        region_type: 'country',
        region_name: 'United States',
        boundary_geojson: JSON.stringify(samplePolygon),
        area_km2: 1000,
        timestamp: Date.now()
      };

      getRegionBoundary.mockResolvedValue(cachedBoundary);

      const result = await getRegionBoundaryData('country', 'United States');

      expect(result).toBeDefined();
      expect(result.name).toBe('United States');
      expect(result.type).toBe('country');
      expect(result.area).toBe(1000);
      expect(result.geometry).toEqual(samplePolygon);
    });

    test('should use simplified boundary data when not cached', async () => {
      const { getRegionBoundary, saveRegionBoundary } = require('../utils/database');
      
      getRegionBoundary.mockResolvedValue(null);
      saveRegionBoundary.mockResolvedValue();

      const result = await getRegionBoundaryData('country', 'United States');

      expect(result).toBeDefined();
      expect(result.name).toBe('United States');
      expect(result.type).toBe('country');
      expect(saveRegionBoundary).toHaveBeenCalled();
    });

    test('should create approximate boundary for unknown regions', async () => {
      const { getRegionBoundary, saveRegionBoundary } = require('../utils/database');
      
      getRegionBoundary.mockResolvedValue(null);
      saveRegionBoundary.mockResolvedValue();

      const result = await getRegionBoundaryData('country', 'Unknown Country');

      expect(result).toBeDefined();
      expect(result.name).toBe('Unknown Country');
      expect(result.type).toBe('country');
      expect(result.geometry.type).toBe('Polygon');
      expect(saveRegionBoundary).toHaveBeenCalled();
    });

    test('should handle database errors gracefully', async () => {
      const { getRegionBoundary } = require('../utils/database');
      
      getRegionBoundary.mockRejectedValue(new Error('Database error'));

      const result = await getRegionBoundaryData('country', 'Test Country');

      expect(result).toBeNull();
    });
  });

  describe('calculatePolygonArea', () => {
    test('should calculate area of polygon geometry', () => {
      const turf = require('@turf/turf');
      turf.area.mockReturnValue(1000000000); // 1000 km² in square meters

      const area = calculatePolygonArea(samplePolygon);

      expect(area).toBe(1000); // Should convert to km²
      expect(turf.feature).toHaveBeenCalledWith(samplePolygon);
      expect(turf.area).toHaveBeenCalled();
    });

    test('should handle invalid geometry gracefully', () => {
      const turf = require('@turf/turf');
      turf.feature.mockImplementation(() => {
        throw new Error('Invalid geometry');
      });

      const area = calculatePolygonArea(samplePolygon);

      expect(area).toBe(0);
    });
  });

  describe('calculateRegionExploration', () => {
    test('should calculate exploration percentage with intersecting areas', async () => {
      const turf = require('@turf/turf');
      
      const boundaryData = {
        type: 'country',
        name: 'Test Country',
        geometry: samplePolygon,
        area: 1000,
        centroid: [0, 0]
      };

      // Mock intersection to return a feature with area
      const intersectionFeature = {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5], [-0.5, -0.5]
          ]]
        }
      };

      turf.intersect.mockReturnValue(intersectionFeature);
      turf.area.mockReturnValue(250000000); // 250 km² for intersection

      const result = await calculateRegionExploration(boundaryData, sampleRevealedAreas);

      expect(result.regionName).toBe('Test Country');
      expect(result.regionType).toBe('country');
      expect(result.totalArea).toBe(1000);
      expect(result.exploredArea).toBe(250);
      expect(result.explorationPercentage).toBe(25); // 250/1000 * 100
    });

    test('should handle no intersections', async () => {
      const turf = require('@turf/turf');
      
      const boundaryData = {
        type: 'country',
        name: 'Test Country',
        geometry: samplePolygon,
        area: 1000,
        centroid: [0, 0]
      };

      turf.intersect.mockReturnValue(null); // No intersection

      const result = await calculateRegionExploration(boundaryData, sampleRevealedAreas);

      expect(result.exploredArea).toBe(0);
      expect(result.explorationPercentage).toBe(0);
    });

    test('should cap exploration percentage at 100%', async () => {
      const turf = require('@turf/turf');
      
      const boundaryData = {
        type: 'country',
        name: 'Test Country',
        geometry: samplePolygon,
        area: 100, // Small area
        centroid: [0, 0]
      };

      const intersectionFeature = {
        type: 'Feature',
        geometry: samplePolygon
      };

      turf.intersect.mockReturnValue(intersectionFeature);
      turf.area.mockReturnValue(200000000); // 200 km² (larger than region)

      const result = await calculateRegionExploration(boundaryData, sampleRevealedAreas);

      expect(result.explorationPercentage).toBe(100); // Should be capped at 100%
    });

    test('should handle calculation errors gracefully', async () => {
      const turf = require('@turf/turf');
      
      const boundaryData = {
        type: 'country',
        name: 'Test Country',
        geometry: samplePolygon,
        area: 1000,
        centroid: [0, 0]
      };

      turf.intersect.mockImplementation(() => {
        throw new Error('Intersection error');
      });

      const result = await calculateRegionExploration(boundaryData, sampleRevealedAreas);

      expect(result.exploredArea).toBe(0);
      expect(result.explorationPercentage).toBe(0);
    });
  });

  describe('calculateMultipleRegionExploration', () => {
    test('should calculate exploration for multiple regions', async () => {
      const { getRegionBoundary } = require('../utils/database');
      
      const regions = [
        { type: 'country', name: 'United States' },
        { type: 'country', name: 'Canada' }
      ];

      // Mock cached boundaries
      getRegionBoundary
        .mockResolvedValueOnce({
          region_type: 'country',
          region_name: 'United States',
          boundary_geojson: JSON.stringify(samplePolygon),
          area_km2: 1000
        })
        .mockResolvedValueOnce({
          region_type: 'country',
          region_name: 'Canada',
          boundary_geojson: JSON.stringify(samplePolygon),
          area_km2: 2000
        });

      const turf = require('@turf/turf');
      turf.intersect.mockReturnValue(null); // No intersections for simplicity

      const results = await calculateMultipleRegionExploration(regions, sampleRevealedAreas);

      expect(results).toHaveLength(2);
      expect(results[0].regionName).toBe('United States');
      expect(results[1].regionName).toBe('Canada');
    });

    test('should handle regions without boundary data', async () => {
      const { getRegionBoundary } = require('../utils/database');
      
      const regions = [
        { type: 'country', name: 'Unknown Country' }
      ];

      getRegionBoundary.mockResolvedValue(null);

      const results = await calculateMultipleRegionExploration(regions, sampleRevealedAreas);

      expect(results).toHaveLength(1);
      expect(results[0].regionName).toBe('Unknown Country');
      expect(results[0].totalArea).toBeGreaterThan(0); // Should have approximate boundary
      expect(results[0].explorationPercentage).toBe(0); // No intersections
    });
  });

  describe('getAllCachedBoundaries', () => {
    test('should return all cached boundaries', async () => {
      const { getAllRegionBoundaries } = require('../utils/database');
      
      const cachedBoundaries = [
        {
          id: 1,
          region_type: 'country',
          region_name: 'United States',
          boundary_geojson: JSON.stringify(samplePolygon),
          area_km2: 1000,
          timestamp: Date.now()
        }
      ];

      getAllRegionBoundaries.mockResolvedValue(cachedBoundaries);

      const result = await getAllCachedBoundaries();

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('United States');
      expect(result[0].type).toBe('country');
    });

    test('should handle database errors', async () => {
      const { getAllRegionBoundaries } = require('../utils/database');
      
      getAllRegionBoundaries.mockRejectedValue(new Error('Database error'));

      const result = await getAllCachedBoundaries();

      expect(result).toEqual([]);
    });
  });

  describe('validateGeometry', () => {
    test('should validate correct polygon geometry', () => {
      const turf = require('@turf/turf');
      turf.feature.mockReturnValue({ type: 'Feature', geometry: samplePolygon });

      const isValid = validateGeometry(samplePolygon);

      expect(isValid).toBe(true);
    });

    test('should reject invalid geometry types', () => {
      const invalidGeometry = { type: 'Point', coordinates: [0, 0] };

      const isValid = validateGeometry(invalidGeometry);

      expect(isValid).toBe(false);
    });

    test('should reject malformed geometry', () => {
      const turf = require('@turf/turf');
      turf.feature.mockImplementation(() => {
        throw new Error('Invalid geometry');
      });

      const isValid = validateGeometry(samplePolygon);

      expect(isValid).toBe(false);
    });
  });

  describe('simplifyPolygon', () => {
    test('should simplify polygon geometry', () => {
      const turf = require('@turf/turf');
      const simplifiedFeature = { type: 'Feature', geometry: samplePolygon };
      turf.simplify.mockReturnValue(simplifiedFeature);

      const result = simplifyPolygon(samplePolygon, 0.01);

      expect(result).toEqual(samplePolygon);
      expect(turf.simplify).toHaveBeenCalledWith(
        expect.any(Object),
        { tolerance: 0.01, highQuality: false }
      );
    });

    test('should handle simplification errors', () => {
      const turf = require('@turf/turf');
      turf.simplify.mockImplementation(() => {
        throw new Error('Simplification error');
      });

      const result = simplifyPolygon(samplePolygon);

      expect(result).toEqual(samplePolygon); // Should return original on error
    });
  });

  describe('isPointInRegion', () => {
    test('should check if point is within region', () => {
      const turf = require('@turf/turf');
      turf.booleanPointInPolygon.mockReturnValue(true);

      const boundaryData = {
        type: 'country',
        name: 'Test Country',
        geometry: samplePolygon,
        area: 1000,
        centroid: [0, 0]
      };

      const result = isPointInRegion([0, 0], boundaryData);

      expect(result).toBe(true);
      expect(turf.point).toHaveBeenCalledWith([0, 0]);
      expect(turf.booleanPointInPolygon).toHaveBeenCalled();
    });

    test('should handle point checking errors', () => {
      const turf = require('@turf/turf');
      turf.booleanPointInPolygon.mockImplementation(() => {
        throw new Error('Point check error');
      });

      const boundaryData = {
        type: 'country',
        name: 'Test Country',
        geometry: samplePolygon,
        area: 1000,
        centroid: [0, 0]
      };

      const result = isPointInRegion([0, 0], boundaryData);

      expect(result).toBe(false);
    });
  });

  describe('getRegionBoundingBox', () => {
    test('should return bounding box for region', () => {
      const turf = require('@turf/turf');
      turf.bbox.mockReturnValue([-1, -1, 1, 1]);

      const boundaryData = {
        type: 'country',
        name: 'Test Country',
        geometry: samplePolygon,
        area: 1000,
        centroid: [0, 0]
      };

      const result = getRegionBoundingBox(boundaryData);

      expect(result).toEqual([-1, -1, 1, 1]);
      expect(turf.bbox).toHaveBeenCalled();
    });

    test('should handle bounding box errors', () => {
      const turf = require('@turf/turf');
      turf.bbox.mockImplementation(() => {
        throw new Error('Bbox error');
      });

      const boundaryData = {
        type: 'country',
        name: 'Test Country',
        geometry: samplePolygon,
        area: 1000,
        centroid: [0, 0]
      };

      const result = getRegionBoundingBox(boundaryData);

      expect(result).toEqual([0, 0, 0, 0]);
    });
  });
});