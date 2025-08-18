import { jest } from '@jest/globals';

// Mock dependencies
jest.mock('@/utils/database', () => ({
  getRevealedAreas: jest.fn(() => Promise.resolve([])),
  getRevealedAreasInViewport: jest.fn(() => Promise.resolve([])),
}));

jest.mock('@/utils/fogCalculation', () => ({
  createFogWithFallback: jest.fn(() => ({
    fogGeoJSON: { type: 'FeatureCollection', features: [] },
    calculationTime: 10,
    performanceMetrics: {
      geometryComplexity: { vertexCount: 5, ringCount: 1, holeCount: 0 },
      operationType: 'viewport',
      hadErrors: false,
      fallbackUsed: false,
      executionTime: 10,
      performanceLevel: 'FAST',
    },
    errors: [],
    warnings: [],
  })),
  getDefaultFogOptions: jest.fn((bounds) => ({
    viewportBounds: bounds,
    useViewportOptimization: true,
    performanceMode: 'accurate',
    fallbackStrategy: 'viewport',
  })),
  createWorldFogCollection: jest.fn(() => ({
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [[[-180, -90], [-180, 90], [180, 90], [180, -90], [-180, -90]]],
      },
    }],
  })),
}));

jest.mock('@/utils/geometryOperations', () => ({
  unionPolygons: jest.fn((features) => ({
    result: features[0] || null,
    errors: [],
    warnings: [],
    metrics: { hadErrors: false, fallbackUsed: false },
  })),
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    debugThrottled: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    warnThrottled: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock spatial index
const mockSpatialIndex = {
  clear: jest.fn(() => Promise.resolve()),
  addFeatures: jest.fn(() => Promise.resolve()),
  queryViewport: jest.fn(() => ({
    features: [],
    totalFeatures: 0,
    returnedFeatures: 0,
    queryTime: 5,
    levelOfDetailApplied: false,
    queryBounds: [-1, -1, 1, 1],
  })),
  isEmpty: jest.fn(() => true),
  getFeatureCount: jest.fn(() => 0),
  getMemoryStats: jest.fn(() => ({
    estimatedMemoryUsage: 0,
    featureCount: 0,
    averageComplexity: 0,
    memoryPerFeature: 0,
    recommendation: 'optimal',
  })),
  optimizeMemory: jest.fn(() => Promise.resolve()),
};

jest.mock('@/utils/spatialIndex', () => ({
  SpatialIndex: jest.fn(() => mockSpatialIndex),
  getGlobalSpatialIndex: jest.fn(() => mockSpatialIndex),
  resetGlobalSpatialIndex: jest.fn(),
}));

import {
    SpatialFogManager,
    calculateSpatialFog,
    getGlobalSpatialFogManager,
    resetGlobalSpatialFogManager,
} from '@/utils/spatialFogCalculation';

import { getRevealedAreas, getRevealedAreasInViewport } from '@/utils/database';
import { createFogWithFallback } from '@/utils/fogCalculation';

describe('SpatialFogManager', () => {
  let spatialFogManager;

  beforeEach(() => {
    jest.clearAllMocks();
    spatialFogManager = new SpatialFogManager();
  });

  afterEach(() => {
    resetGlobalSpatialFogManager();
  });

  describe('constructor', () => {
    it('should create a new spatial fog manager instance', () => {
      expect(spatialFogManager).toBeInstanceOf(SpatialFogManager);
    });

    it('should accept custom spatial index', () => {
      const customIndex = mockSpatialIndex;
      const manager = new SpatialFogManager(customIndex);
      expect(manager).toBeInstanceOf(SpatialFogManager);
    });
  });

  describe('initialize', () => {
    it('should initialize with empty database', async () => {
      getRevealedAreas.mockResolvedValue([]);
      
      await spatialFogManager.initialize();
      
      expect(mockSpatialIndex.clear).toHaveBeenCalled();
      expect(getRevealedAreas).toHaveBeenCalled();
      expect(mockSpatialIndex.addFeatures).not.toHaveBeenCalled();
    });

    it('should initialize with revealed areas from database', async () => {
      const mockRevealedAreas = [
        {
          type: 'Feature',
          properties: { id: 'area-1' },
          geometry: {
            type: 'Polygon',
            coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
          },
        },
        {
          type: 'Feature',
          properties: { id: 'area-2' },
          geometry: {
            type: 'Polygon',
            coordinates: [[[2, 2], [3, 2], [3, 3], [2, 3], [2, 2]]],
          },
        },
      ];

      getRevealedAreas.mockResolvedValue(mockRevealedAreas);
      
      await spatialFogManager.initialize();
      
      expect(mockSpatialIndex.clear).toHaveBeenCalled();
      expect(mockSpatialIndex.addFeatures).toHaveBeenCalledWith(mockRevealedAreas);
    });

    it('should filter out invalid features during initialization', async () => {
      const mixedFeatures = [
        {
          type: 'Feature',
          properties: { id: 'valid-area' },
          geometry: {
            type: 'Polygon',
            coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
          },
        },
        { type: 'InvalidFeature' }, // Invalid
        null, // Invalid
        {
          type: 'Feature',
          properties: {},
          geometry: null, // Invalid geometry
        },
      ];

      getRevealedAreas.mockResolvedValue(mixedFeatures);
      
      await spatialFogManager.initialize();
      
      expect(mockSpatialIndex.addFeatures).toHaveBeenCalledWith([
        expect.objectContaining({ properties: { id: 'valid-area' } }),
      ]);
    });

    it('should not reinitialize if already initialized', async () => {
      getRevealedAreas.mockResolvedValue([]);
      
      await spatialFogManager.initialize();
      await spatialFogManager.initialize(); // Second call
      
      expect(getRevealedAreas).toHaveBeenCalledTimes(1);
    });

    it('should force reload when requested', async () => {
      getRevealedAreas.mockResolvedValue([]);
      
      await spatialFogManager.initialize();
      await spatialFogManager.initialize(true); // Force reload
      
      expect(getRevealedAreas).toHaveBeenCalledTimes(2);
    });
  });

  describe('calculateSpatialFog', () => {
    const viewportBounds = [-1, -1, 1, 1];
    const mockOptions = {
      viewportBounds,
      useSpatialIndexing: true,
      maxSpatialResults: 100,
      useViewportOptimization: true,
      performanceMode: 'accurate',
      fallbackStrategy: 'viewport',
    };

    beforeEach(async () => {
      // Initialize the manager
      getRevealedAreas.mockResolvedValue([]);
      await spatialFogManager.initialize();
    });

    it('should use spatial indexing when enabled and features available', async () => {
      const mockFeatures = [
        {
          type: 'Feature',
          properties: { id: 'spatial-feature' },
          geometry: {
            type: 'Polygon',
            coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
          },
        },
      ];

      mockSpatialIndex.isEmpty.mockReturnValue(false);
      mockSpatialIndex.queryViewport.mockReturnValue({
        features: mockFeatures,
        totalFeatures: 1,
        returnedFeatures: 1,
        queryTime: 5,
        levelOfDetailApplied: true,
        queryBounds: viewportBounds,
      });

      const result = await spatialFogManager.calculateSpatialFog(mockOptions);
      
      expect(mockSpatialIndex.queryViewport).toHaveBeenCalledWith(
        viewportBounds,
        expect.objectContaining({
          maxResults: 100,
          useLevelOfDetail: true,
        })
      );
      expect(result.usedSpatialIndexing).toBe(true);
      expect(result.spatialQueryResult).toBeDefined();
      expect(result.dataSourceStats.fromSpatialIndex).toBe(1);
    });

    it('should fall back to database query when spatial indexing disabled', async () => {
      const mockRevealedAreas = [
        {
          type: 'Feature',
          properties: { id: 'db-feature' },
          geometry: {
            type: 'Polygon',
            coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
          },
        },
      ];

      getRevealedAreasInViewport.mockResolvedValue(mockRevealedAreas);

      const optionsWithoutSpatial = {
        ...mockOptions,
        useSpatialIndexing: false,
      };

      const result = await spatialFogManager.calculateSpatialFog(optionsWithoutSpatial);
      
      expect(getRevealedAreasInViewport).toHaveBeenCalledWith(viewportBounds, 100); // Uses maxSpatialResults from options
      expect(result.usedSpatialIndexing).toBe(false);
      expect(result.dataSourceStats.fromDatabase).toBe(1);
    });

    it('should handle empty spatial index', async () => {
      mockSpatialIndex.isEmpty.mockReturnValue(true);
      getRevealedAreasInViewport.mockResolvedValue([]);

      const result = await spatialFogManager.calculateSpatialFog(mockOptions);
      
      expect(result.usedSpatialIndexing).toBe(false);
      expect(result.dataSourceStats.fromDatabase).toBe(0);
    });

    it('should union multiple features from spatial query', async () => {
      const mockFeatures = [
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

      mockSpatialIndex.isEmpty.mockReturnValue(false);
      mockSpatialIndex.queryViewport.mockReturnValue({
        features: mockFeatures,
        totalFeatures: 2,
        returnedFeatures: 2,
        queryTime: 5,
        levelOfDetailApplied: false,
        queryBounds: viewportBounds,
      });

      const { unionPolygons } = require('@/utils/geometryOperations');
      unionPolygons.mockReturnValue({
        result: mockFeatures[0], // Mock union result
        errors: [],
        warnings: [],
        metrics: { hadErrors: false, fallbackUsed: false },
      });

      const result = await spatialFogManager.calculateSpatialFog(mockOptions);
      
      expect(unionPolygons).toHaveBeenCalledWith(mockFeatures);
      expect(result.usedSpatialIndexing).toBe(true);
    });

    it('should handle spatial indexing errors gracefully', async () => {
      mockSpatialIndex.queryViewport.mockImplementation(() => {
        throw new Error('Spatial index error');
      });

      getRevealedAreas.mockResolvedValue([]);

      const result = await spatialFogManager.calculateSpatialFog(mockOptions);
      
      expect(result.usedSpatialIndexing).toBe(false);
      expect(result.errors).toContain('Spatial indexing failed: Spatial index error');
      expect(result.warnings).toContain('Used fallback calculation due to spatial indexing failure');
    });
  });

  describe('addRevealedAreas', () => {
    it('should add new revealed areas to spatial index', async () => {
      const newFeatures = [
        {
          type: 'Feature',
          properties: { id: 'new-feature' },
          geometry: {
            type: 'Polygon',
            coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
          },
        },
      ];

      await spatialFogManager.addRevealedAreas(newFeatures);
      
      expect(mockSpatialIndex.addFeatures).toHaveBeenCalledWith(newFeatures);
    });

    it('should initialize if not already initialized', async () => {
      getRevealedAreas.mockResolvedValue([]);
      
      const newFeatures = [
        {
          type: 'Feature',
          properties: { id: 'new-feature' },
          geometry: {
            type: 'Polygon',
            coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
          },
        },
      ];

      await spatialFogManager.addRevealedAreas(newFeatures);
      
      expect(getRevealedAreas).toHaveBeenCalled(); // Called during initialization
      expect(mockSpatialIndex.addFeatures).toHaveBeenCalledWith(newFeatures);
    });
  });

  describe('utility methods', () => {
    it('should get memory stats', () => {
      const stats = spatialFogManager.getMemoryStats();
      
      expect(mockSpatialIndex.getMemoryStats).toHaveBeenCalled();
      expect(stats).toEqual({
        estimatedMemoryUsage: 0,
        featureCount: 0,
        averageComplexity: 0,
        memoryPerFeature: 0,
        recommendation: 'optimal',
      });
    });

    it('should optimize memory', async () => {
      await spatialFogManager.optimizeMemory(true);
      
      expect(mockSpatialIndex.optimizeMemory).toHaveBeenCalledWith(true);
    });

    it('should refresh index', async () => {
      getRevealedAreas.mockResolvedValue([]);
      
      await spatialFogManager.refreshIndex();
      
      expect(mockSpatialIndex.clear).toHaveBeenCalled();
      expect(getRevealedAreas).toHaveBeenCalled();
    });

    it('should get feature count', () => {
      const count = spatialFogManager.getFeatureCount();
      
      expect(mockSpatialIndex.getFeatureCount).toHaveBeenCalled();
      expect(count).toBe(0);
    });

    it('should check if empty', () => {
      mockSpatialIndex.isEmpty.mockReturnValue(true);
      const isEmpty = spatialFogManager.isEmpty();
      
      expect(mockSpatialIndex.isEmpty).toHaveBeenCalled();
      expect(isEmpty).toBe(true);
    });
  });

  describe('global spatial fog manager', () => {
    it('should return singleton instance', () => {
      const manager1 = getGlobalSpatialFogManager();
      const manager2 = getGlobalSpatialFogManager();
      
      expect(manager1).toBe(manager2);
      expect(manager1).toBeInstanceOf(SpatialFogManager);
    });

    it('should reset global instance', () => {
      const manager1 = getGlobalSpatialFogManager();
      resetGlobalSpatialFogManager();
      const manager2 = getGlobalSpatialFogManager();
      
      expect(manager1).not.toBe(manager2);
    });
  });

  describe('calculateSpatialFog function', () => {
    it('should calculate spatial fog with viewport bounds', async () => {
      const viewportBounds = [-1, -1, 1, 1];
      const options = { useSpatialIndexing: true };

      getRevealedAreas.mockResolvedValue([]);
      
      const result = await calculateSpatialFog(viewportBounds, options);
      
      expect(result).toHaveProperty('fogGeoJSON');
      expect(result).toHaveProperty('usedSpatialIndexing');
      expect(result).toHaveProperty('dataSourceStats');
    });

    it('should calculate spatial fog without viewport bounds', async () => {
      getRevealedAreas.mockResolvedValue([]);
      
      const result = await calculateSpatialFog();
      
      expect(result).toHaveProperty('fogGeoJSON');
      expect(result).toHaveProperty('usedSpatialIndexing');
    });

    it('should initialize manager if needed', async () => {
      getRevealedAreas.mockResolvedValue([]);
      mockSpatialIndex.isEmpty.mockReturnValue(false);
      
      await calculateSpatialFog([-1, -1, 1, 1]);
      
      expect(getRevealedAreas).toHaveBeenCalled(); // Called during initialization
    });
  });

  describe('error handling', () => {
    it('should handle database errors during initialization', async () => {
      getRevealedAreas.mockRejectedValue(new Error('Database error'));
      
      await expect(spatialFogManager.initialize()).rejects.toThrow('Database error');
    });

    it('should handle spatial index errors during feature addition', async () => {
      // First clear the mock to avoid interference from previous tests
      getRevealedAreas.mockClear();
      getRevealedAreas.mockResolvedValue([]);
      
      mockSpatialIndex.addFeatures.mockRejectedValue(new Error('Index error'));
      
      const features = [
        {
          type: 'Feature',
          properties: { id: 'test' },
          geometry: {
            type: 'Polygon',
            coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
          },
        },
      ];

      await expect(spatialFogManager.addRevealedAreas(features)).rejects.toThrow('Index error');
    });

    it('should provide emergency fallback when all calculations fail', async () => {
      // Mock all operations to fail
      mockSpatialIndex.queryViewport.mockImplementation(() => {
        throw new Error('Spatial error');
      });
      getRevealedAreas.mockRejectedValue(new Error('Database error'));
      createFogWithFallback.mockImplementation(() => {
        throw new Error('Fog calculation error');
      });

      const result = await spatialFogManager.calculateSpatialFog({
        viewportBounds: [-1, -1, 1, 1],
        useSpatialIndexing: true,
      });
      
      expect(result.usedSpatialIndexing).toBe(false);
      expect(result.errors).toContain('Spatial indexing failed');
      expect(result.errors).toContain('Fallback calculation failed: Database error');
      expect(result.warnings).toContain('Using emergency world fog fallback');
    });
  });
});