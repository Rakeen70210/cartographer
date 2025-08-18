import { jest } from '@jest/globals';

// Mock @turf/geojson-rbush before importing
const mockRbushInstance = {
  insert: jest.fn(),
  load: jest.fn(),
  search: jest.fn(() => ({ features: [] })),
  remove: jest.fn(),
  clear: jest.fn(),
};

const mockGeojsonRbush = jest.fn(() => mockRbushInstance);

jest.mock('@turf/geojson-rbush', () => ({
  __esModule: true,
  default: mockGeojsonRbush,
}));

// Mock @turf/turf functions
jest.mock('@turf/turf', () => ({
  bbox: jest.fn((feature) => {
    // Simple mock implementation
    if (feature.geometry && feature.geometry.coordinates) {
      return [-1, -1, 1, 1]; // Mock bounding box
    }
    return [0, 0, 0, 0];
  }),
  bboxPolygon: jest.fn((bounds) => ({
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [bounds[0], bounds[1]],
        [bounds[0], bounds[3]],
        [bounds[2], bounds[3]],
        [bounds[2], bounds[1]],
        [bounds[0], bounds[1]],
      ]],
    },
  })),
}));

// Mock logger
jest.mock('@/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    debugThrottled: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { SpatialIndex, getGlobalSpatialIndex, resetGlobalSpatialIndex } from '@/utils/spatialIndex';

describe('SpatialIndex', () => {
  let spatialIndex;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    mockRbushInstance.insert.mockClear();
    mockRbushInstance.load.mockClear();
    mockRbushInstance.search.mockClear();
    mockRbushInstance.remove.mockClear();
    mockRbushInstance.clear.mockClear();
    
    // Create new spatial index instance
    spatialIndex = new SpatialIndex();
  });

  afterEach(() => {
    resetGlobalSpatialIndex();
  });

  describe('constructor', () => {
    it('should create a new spatial index instance', () => {
      expect(spatialIndex).toBeInstanceOf(SpatialIndex);
      expect(mockGeojsonRbush).toHaveBeenCalled();
    });

    it('should accept custom level-of-detail configuration', () => {
      const customLodConfig = {
        fullDetailZoom: 15,
        fullDetailDistance: 0.005,
      };
      
      const customIndex = new SpatialIndex(customLodConfig);
      expect(customIndex).toBeInstanceOf(SpatialIndex);
    });

    it('should accept custom memory threshold', () => {
      const customIndex = new SpatialIndex(undefined, 100 * 1024 * 1024); // 100MB
      expect(customIndex).toBeInstanceOf(SpatialIndex);
    });
  });

  describe('addFeature', () => {
    const validFeature = {
      type: 'Feature',
      properties: { id: 'test-feature' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
      },
    };

    it('should add a valid feature to the index', async () => {
      await spatialIndex.addFeature(validFeature);
      
      expect(mockRbushInstance.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'Feature',
          properties: expect.objectContaining({ id: 'test-feature' }),
          geometry: validFeature.geometry,
        })
      );
    });

    it('should generate ID for features without one', async () => {
      const featureWithoutId = {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
        },
      };

      await spatialIndex.addFeature(featureWithoutId);
      
      expect(mockRbushInstance.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: expect.objectContaining({
            id: expect.stringMatching(/^feature_\d+_/),
          }),
        })
      );
    });

    it('should skip invalid features', async () => {
      const invalidFeature = {
        type: 'Feature',
        properties: {},
        geometry: null,
      };

      await spatialIndex.addFeature(invalidFeature);
      
      expect(mockRbushInstance.insert).not.toHaveBeenCalled();
    });

    it('should handle MultiPolygon features', async () => {
      const multiPolygonFeature = {
        type: 'Feature',
        properties: { id: 'multi-polygon' },
        geometry: {
          type: 'MultiPolygon',
          coordinates: [[[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]],
        },
      };

      await spatialIndex.addFeature(multiPolygonFeature);
      
      expect(mockRbushInstance.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          geometry: multiPolygonFeature.geometry,
        })
      );
    });
  });

  describe('addFeatures', () => {
    const validFeatures = [
      {
        type: 'Feature',
        properties: { id: 'feature-1' },
        geometry: {
          type: 'Polygon',
          coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
        },
      },
      {
        type: 'Feature',
        properties: { id: 'feature-2' },
        geometry: {
          type: 'Polygon',
          coordinates: [[[2, 2], [3, 2], [3, 3], [2, 3], [2, 2]]],
        },
      },
    ];

    it('should add multiple features to the index', async () => {
      await spatialIndex.addFeatures(validFeatures);
      
      expect(mockRbushInstance.load).toHaveBeenCalledWith({
        type: 'FeatureCollection',
        features: expect.arrayContaining([
          expect.objectContaining({ properties: { id: 'feature-1' } }),
          expect.objectContaining({ properties: { id: 'feature-2' } }),
        ]),
      });
    });

    it('should filter out invalid features', async () => {
      const mixedFeatures = [
        ...validFeatures,
        { type: 'Feature', properties: {}, geometry: null }, // Invalid
        { type: 'InvalidType' }, // Invalid
      ];

      await spatialIndex.addFeatures(mixedFeatures);
      
      expect(mockRbushInstance.load).toHaveBeenCalledWith({
        type: 'FeatureCollection',
        features: expect.arrayContaining([
          expect.objectContaining({ properties: { id: 'feature-1' } }),
          expect.objectContaining({ properties: { id: 'feature-2' } }),
        ]),
      });
      
      // Should only load valid features
      const loadCall = mockRbushInstance.load.mock.calls[0][0];
      expect(loadCall.features).toHaveLength(2);
    });

    it('should handle empty feature array', async () => {
      await spatialIndex.addFeatures([]);
      
      expect(mockRbushInstance.load).not.toHaveBeenCalled();
    });
  });

  describe('queryViewport', () => {
    const viewportBounds = [-1, -1, 1, 1];

    beforeEach(() => {
      // Mock search results
      mockRbushInstance.search.mockReturnValue({
        features: [
          {
            type: 'Feature',
            properties: { id: 'result-1' },
            geometry: {
              type: 'Polygon',
              coordinates: [[[0, 0], [0.5, 0], [0.5, 0.5], [0, 0.5], [0, 0]]],
            },
          },
        ],
      });
    });

    it('should query features within viewport bounds', () => {
      const result = spatialIndex.queryViewport(viewportBounds);
      
      expect(mockRbushInstance.search).toHaveBeenCalled();
      expect(result.features).toHaveLength(1);
      expect(result.features[0].properties.id).toBe('result-1');
      expect(result.queryBounds).toEqual([-1.001, -1.001, 1.001, 1.001]); // With buffer
    });

    it('should apply buffer distance to query bounds', () => {
      const options = { bufferDistance: 0.1 };
      spatialIndex.queryViewport(viewportBounds, options);
      
      const searchCall = mockRbushInstance.search.mock.calls[0][0];
      // Should create bounding box polygon with buffered bounds
      expect(searchCall.geometry.coordinates[0]).toEqual([
        [-1.1, -1.1],
        [-1.1, 1.1],
        [1.1, 1.1],
        [1.1, -1.1],
        [-1.1, -1.1],
      ]);
    });

    it('should limit results based on maxResults option', () => {
      // Mock more results than maxResults
      mockRbushInstance.search.mockReturnValue({
        features: Array.from({ length: 10 }, (_, i) => ({
          type: 'Feature',
          properties: { id: `result-${i}` },
          geometry: {
            type: 'Polygon',
            coordinates: [[[0, 0], [0.5, 0], [0.5, 0.5], [0, 0.5], [0, 0]]],
          },
        })),
      });

      const options = { maxResults: 5 };
      const result = spatialIndex.queryViewport(viewportBounds, options);
      
      expect(result.features).toHaveLength(5);
      expect(result.returnedFeatures).toBe(5);
    });

    it('should handle invalid viewport bounds', () => {
      const invalidBounds = [1, 1, -1, -1]; // Invalid: min > max
      
      const result = spatialIndex.queryViewport(invalidBounds);
      
      expect(result.features).toHaveLength(0);
      expect(result.returnedFeatures).toBe(0);
    });

    it('should return empty result when search fails', () => {
      mockRbushInstance.search.mockReturnValue(null);
      
      const result = spatialIndex.queryViewport(viewportBounds);
      
      expect(result.features).toHaveLength(0);
      expect(result.returnedFeatures).toBe(0);
    });
  });

  describe('queryRadius', () => {
    it('should query features within radius of a point', () => {
      const center = [0, 0];
      const radius = 0.5;
      
      mockRbushInstance.search.mockReturnValue({
        features: [
          {
            type: 'Feature',
            properties: { id: 'nearby-feature' },
            geometry: {
              type: 'Polygon',
              coordinates: [[[0, 0], [0.2, 0], [0.2, 0.2], [0, 0.2], [0, 0]]],
            },
          },
        ],
      });

      const result = spatialIndex.queryRadius(center, radius);
      
      expect(result.features).toHaveLength(1);
      expect(result.features[0].properties.id).toBe('nearby-feature');
      expect(result.queryBounds).toEqual([-0.501, -0.501, 0.501, 0.501]); // Includes default buffer
    });
  });

  describe('removeFeature', () => {
    it('should remove a feature from the index', async () => {
      const feature = {
        type: 'Feature',
        properties: { id: 'test-feature' },
        geometry: {
          type: 'Polygon',
          coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
        },
      };

      // Add feature first
      await spatialIndex.addFeature(feature);
      
      // Remove feature
      await spatialIndex.removeFeature('test-feature');
      
      expect(mockRbushInstance.remove).toHaveBeenCalled();
    });

    it('should handle removal of non-existent feature', async () => {
      await spatialIndex.removeFeature('non-existent');
      
      expect(mockRbushInstance.remove).not.toHaveBeenCalled();
    });
  });

  describe('clear', () => {
    it('should clear all features from the index', async () => {
      await spatialIndex.clear();
      
      expect(mockRbushInstance.clear).toHaveBeenCalled();
    });
  });

  describe('getMemoryStats', () => {
    it('should return memory statistics', () => {
      const stats = spatialIndex.getMemoryStats();
      
      expect(stats).toHaveProperty('estimatedMemoryUsage');
      expect(stats).toHaveProperty('featureCount');
      expect(stats).toHaveProperty('averageComplexity');
      expect(stats).toHaveProperty('memoryPerFeature');
      expect(stats).toHaveProperty('recommendation');
    });

    it('should return zero stats for empty index', () => {
      const stats = spatialIndex.getMemoryStats();
      
      expect(stats.featureCount).toBe(0);
      expect(stats.estimatedMemoryUsage).toBe(0);
      expect(stats.recommendation).toBe('optimal');
    });
  });

  describe('optimizeMemory', () => {
    beforeEach(async () => {
      // Add some test features
      const features = Array.from({ length: 10 }, (_, i) => ({
        type: 'Feature',
        properties: { 
          id: `feature-${i}`,
          timestamp: Date.now() - (i * 1000), // Varying timestamps
        },
        geometry: {
          type: 'Polygon',
          coordinates: [[[i, i], [i+1, i], [i+1, i+1], [i, i+1], [i, i]]],
        },
      }));

      await spatialIndex.addFeatures(features);
    });

    it('should optimize memory usage with gentle cleanup', async () => {
      await spatialIndex.optimizeMemory(false);
      
      // Should clear and reload with fewer features
      expect(mockRbushInstance.clear).toHaveBeenCalled();
      expect(mockRbushInstance.load).toHaveBeenCalledTimes(2); // Once for initial load, once for optimization
    });

    it('should optimize memory usage with aggressive cleanup', async () => {
      await spatialIndex.optimizeMemory(true);
      
      expect(mockRbushInstance.clear).toHaveBeenCalled();
      expect(mockRbushInstance.load).toHaveBeenCalledTimes(2);
    });
  });

  describe('utility methods', () => {
    it('should return correct feature count', () => {
      expect(spatialIndex.getFeatureCount()).toBe(0);
    });

    it('should return correct empty status', () => {
      expect(spatialIndex.isEmpty()).toBe(true);
    });
  });

  describe('global spatial index', () => {
    it('should return singleton instance', () => {
      const index1 = getGlobalSpatialIndex();
      const index2 = getGlobalSpatialIndex();
      
      expect(index1).toBe(index2);
      expect(index1).toBeInstanceOf(SpatialIndex);
    });

    it('should reset global instance', () => {
      const index1 = getGlobalSpatialIndex();
      resetGlobalSpatialIndex();
      const index2 = getGlobalSpatialIndex();
      
      expect(index1).not.toBe(index2);
    });
  });

  describe('level-of-detail optimization', () => {
    beforeEach(() => {
      // Mock bbox function to return different sizes for different features
      const { bbox } = require('@turf/turf');
      bbox.mockImplementation((feature) => {
        const id = feature.properties?.id || '';
        if (id.includes('large')) {
          return [-2, -2, 2, 2]; // Large feature
        } else if (id.includes('small')) {
          return [-0.1, -0.1, 0.1, 0.1]; // Small feature
        }
        return [-1, -1, 1, 1]; // Default size
      });
    });

    it('should apply level-of-detail filtering based on zoom level', () => {
      const features = [
        {
          type: 'Feature',
          properties: { id: 'large-feature' },
          geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] },
        },
        {
          type: 'Feature',
          properties: { id: 'small-feature' },
          geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] },
        },
      ];

      mockRbushInstance.search.mockReturnValue({ features });

      // Low zoom level should filter out small features
      const lowZoomResult = spatialIndex.queryViewport([-1, -1, 1, 1], {
        useLevelOfDetail: true,
        zoomLevel: 8,
      });

      expect(lowZoomResult.levelOfDetailApplied).toBe(true);
    });

    it('should show all features at high zoom levels', () => {
      const features = [
        {
          type: 'Feature',
          properties: { id: 'large-feature' },
          geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] },
        },
        {
          type: 'Feature',
          properties: { id: 'small-feature' },
          geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] },
        },
      ];

      mockRbushInstance.search.mockReturnValue({ features });

      // High zoom level should show all features
      const highZoomResult = spatialIndex.queryViewport([-1, -1, 1, 1], {
        useLevelOfDetail: true,
        zoomLevel: 15,
      });

      expect(highZoomResult.levelOfDetailApplied).toBe(true);
    });
  });
});