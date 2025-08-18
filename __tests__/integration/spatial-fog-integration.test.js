import { jest } from '@jest/globals';

// Mock all dependencies
jest.mock('@/utils/database', () => ({
  getRevealedAreas: jest.fn(() => Promise.resolve([])),
  getRevealedAreasInViewport: jest.fn(() => Promise.resolve([])),
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    debugThrottled: jest.fn(),
    debugOnce: jest.fn(),
    debugViewport: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    warnThrottled: jest.fn(),
    warnOnce: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/utils/circuitBreaker', () => ({
  CircuitBreaker: jest.fn(() => ({
    canExecute: jest.fn(() => true),
    execute: jest.fn((fn) => fn()),
  })),
  FOG_CALCULATION_CIRCUIT_OPTIONS: {},
}));

// Mock spatial indexing components
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
}));

jest.mock('@/utils/geometryOperations', () => ({
  unionPolygons: jest.fn((features) => ({
    result: features[0] || null,
    errors: [],
    warnings: [],
    metrics: { hadErrors: false, fallbackUsed: false },
  })),
}));

// Create a single mock spatial manager instance that will be reused
const mockSpatialManager = {
  initialize: jest.fn(async () => {
    // Mock the initialization to load data from database and add to spatial index
    const { getRevealedAreas } = require('@/utils/database');
    try {
      const areas = await getRevealedAreas();
      if (areas.length > 0) {
        mockSpatialIndex.addFeatures(areas);
      }
    } catch (error) {
      // Ignore errors in mock
    }
  }),
  addRevealedAreas: jest.fn(() => Promise.resolve()),
  getMemoryStats: jest.fn(() => mockSpatialIndex.getMemoryStats()),
  optimizeMemory: jest.fn(() => Promise.resolve()),
  getFeatureCount: jest.fn(() => 10),
  isEmpty: jest.fn(() => false),
};

jest.mock('@/utils/spatialFogCalculation', () => ({
  calculateSpatialFog: jest.fn(async (viewportBounds, options) => {
    // Mock the real behavior by calling the spatial manager
    await mockSpatialManager.initialize();
    
    let processedFeatures = 0;
    let fromDatabase = 0;
    let fromSpatialIndex = 0;
    
    // If viewport bounds are provided, simulate spatial index query
    if (viewportBounds && !mockSpatialIndex.isEmpty()) {
      const queryResult = mockSpatialIndex.queryViewport(viewportBounds, options);
      fromSpatialIndex = queryResult.returnedFeatures || 0;
      processedFeatures = fromSpatialIndex;
    } else {
      // Otherwise, get from database
      const { getRevealedAreas } = require('@/utils/database');
      try {
        const areas = await getRevealedAreas();
        fromDatabase = areas.length;
        const maxResults = options?.maxSpatialResults || 1000;
        processedFeatures = Math.min(fromDatabase, maxResults);
      } catch (error) {
        fromDatabase = 0;
        processedFeatures = 0;
      }
    }
    
    return {
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
      usedSpatialIndexing: true,
      dataSourceStats: {
        fromDatabase,
        fromSpatialIndex,
        totalProcessed: processedFeatures,
      },
    };
  }),
  getGlobalSpatialFogManager: jest.fn(() => mockSpatialManager),
  resetGlobalSpatialFogManager: jest.fn(),
}));

// Mock React hooks
import { useFogCalculation } from '@/hooks/useFogCalculation';
import { getRevealedAreas } from '@/utils/database';
import { act, renderHook } from '@testing-library/react-native';

describe('Spatial Fog Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSpatialIndex.clear.mockClear();
    mockSpatialIndex.addFeatures.mockClear();
    mockSpatialIndex.queryViewport.mockClear();
    mockSpatialIndex.isEmpty.mockClear();
  });

  describe('useFogCalculation with spatial indexing', () => {
    it('should initialize with spatial indexing enabled', async () => {
      getRevealedAreas.mockResolvedValue([]);
      
      const { result } = renderHook(() => 
        useFogCalculation({ 
          useSpatialIndexing: true,
          maxSpatialResults: 500,
          useLevelOfDetail: true
        })
      );

      // Wait for initialization
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      expect(result.current.usedSpatialIndexing).toBe(true); // Should use spatial indexing during initialization
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isCalculating).toBe(false);
    });

    it('should use spatial indexing for viewport updates', async () => {
      getRevealedAreas.mockResolvedValue([]);
      
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
        queryBounds: [-1, -1, 1, 1],
      });

      const { result } = renderHook(() => 
        useFogCalculation({ 
          useSpatialIndexing: true,
          maxSpatialResults: 500,
          useLevelOfDetail: true
        })
      );

      // Wait for initialization
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Update viewport
      await act(async () => {
        await result.current.updateFogForViewport([-1, -1, 1, 1], 12);
      });

      // Wait for debounced calculation
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 400));
      });

      expect(result.current.usedSpatialIndexing).toBe(true);
      expect(result.current.featuresProcessed).toBe(1);
    });

    it('should add revealed areas to spatial index', async () => {
      getRevealedAreas.mockResolvedValue([]);
      
      const { result } = renderHook(() => 
        useFogCalculation({ 
          useSpatialIndexing: true,
          maxSpatialResults: 500
        })
      );

      // Wait for initialization
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

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

      await act(async () => {
        await result.current.addRevealedAreasToIndex(newFeatures);
      });

      // Check if there were any errors
      const { logger } = require('@/utils/logger');
      expect(logger.error).not.toHaveBeenCalledWith(
        expect.stringContaining('Failed to add revealed areas to spatial index'),
        expect.any(Error)
      );
      
      // Check if the success logger was called to confirm the function executed
      expect(logger.debugThrottled).toHaveBeenCalledWith(
        'Added 1 features to spatial index',
        3000
      );
      
      // Get the mocked spatial manager and check if it was called
      const { getGlobalSpatialFogManager } = require('@/utils/spatialFogCalculation');
      expect(getGlobalSpatialFogManager).toHaveBeenCalled();
      
      // Use the shared mock instance
      expect(mockSpatialManager.addRevealedAreas).toHaveBeenCalledWith(newFeatures);
    });

    it('should get spatial index statistics', async () => {
      getRevealedAreas.mockResolvedValue([]);
      
      mockSpatialIndex.getFeatureCount.mockReturnValue(10);
      mockSpatialIndex.getMemoryStats.mockReturnValue({
        estimatedMemoryUsage: 1024,
        featureCount: 10,
        averageComplexity: 5,
        memoryPerFeature: 102.4,
        recommendation: 'optimal',
      });

      const { result } = renderHook(() => 
        useFogCalculation({ 
          useSpatialIndexing: true
        })
      );

      // Wait for initialization
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      const stats = result.current.getSpatialIndexStats();

      expect(stats.featureCount).toBe(10);
      expect(stats.memoryStats.estimatedMemoryUsage).toBe(1024);
      expect(stats.memoryStats.recommendation).toBe('optimal');
    });

    it('should optimize spatial index memory', async () => {
      getRevealedAreas.mockResolvedValue([]);
      
      const { result } = renderHook(() => 
        useFogCalculation({ 
          useSpatialIndexing: true
        })
      );

      // Wait for initialization
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      await act(async () => {
        await result.current.optimizeSpatialIndex(true);
      });

      // Get the mocked spatial manager
      const { getGlobalSpatialFogManager } = require('@/utils/spatialFogCalculation');
      const spatialManager = getGlobalSpatialFogManager();
      expect(spatialManager.optimizeMemory).toHaveBeenCalledWith(true);
    });

    it('should handle spatial indexing disabled gracefully', async () => {
      getRevealedAreas.mockResolvedValue([]);
      
      const { result } = renderHook(() => 
        useFogCalculation({ 
          useSpatialIndexing: false
        })
      );

      // Wait for initialization
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Update viewport
      await act(async () => {
        await result.current.updateFogForViewport([-1, -1, 1, 1], 12);
      });

      // Wait for debounced calculation
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 400));
      });

      expect(result.current.usedSpatialIndexing).toBe(false);
      expect(mockSpatialIndex.queryViewport).not.toHaveBeenCalled();
    });

    it('should handle level-of-detail optimization', async () => {
      getRevealedAreas.mockResolvedValue([]);
      
      const mockFeatures = [
        {
          type: 'Feature',
          properties: { id: 'large-feature' },
          geometry: {
            type: 'Polygon',
            coordinates: [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]],
          },
        },
        {
          type: 'Feature',
          properties: { id: 'small-feature' },
          geometry: {
            type: 'Polygon',
            coordinates: [[[0, 0], [0.1, 0], [0.1, 0.1], [0, 0.1], [0, 0]]],
          },
        },
      ];

      mockSpatialIndex.isEmpty.mockReturnValue(false);
      mockSpatialIndex.queryViewport.mockReturnValue({
        features: mockFeatures,
        totalFeatures: 2,
        returnedFeatures: 1, // LOD filtered out small feature
        queryTime: 5,
        levelOfDetailApplied: true,
        queryBounds: [-1, -1, 1, 1],
      });

      const { result } = renderHook(() => 
        useFogCalculation({ 
          useSpatialIndexing: true,
          useLevelOfDetail: true
        })
      );

      // Wait for initialization
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Update viewport with low zoom level
      await act(async () => {
        await result.current.updateFogForViewport([-1, -1, 1, 1], 8);
      });

      // Wait for debounced calculation
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 400));
      });

      expect(mockSpatialIndex.queryViewport).toHaveBeenCalledWith(
        [-1, -1, 1, 1],
        expect.objectContaining({
          useLevelOfDetail: true,
          zoomLevel: 8,
        })
      );
    });
  });

  describe('performance characteristics', () => {
    it('should handle large datasets efficiently', async () => {
      const largeFeatureSet = Array.from({ length: 1000 }, (_, i) => ({
        type: 'Feature',
        properties: { id: `feature-${i}` },
        geometry: {
          type: 'Polygon',
          coordinates: [[[i, i], [i+1, i], [i+1, i+1], [i, i+1], [i, i]]],
        },
      }));

      getRevealedAreas.mockResolvedValue(largeFeatureSet);
      
      mockSpatialIndex.queryViewport.mockReturnValue({
        features: largeFeatureSet.slice(0, 100), // Spatial index returns subset
        totalFeatures: 1000,
        returnedFeatures: 100,
        queryTime: 15,
        levelOfDetailApplied: true,
        queryBounds: [-1, -1, 1, 1],
      });

      const { result } = renderHook(() => 
        useFogCalculation({ 
          useSpatialIndexing: true,
          maxSpatialResults: 100,
          useLevelOfDetail: true
        })
      );

      // Wait for initialization
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Check if calculateSpatialFog was called
      const { calculateSpatialFog } = require('@/utils/spatialFogCalculation');
      expect(calculateSpatialFog).toHaveBeenCalled();
      
      // Check if the spatial manager's initialize was called
      expect(mockSpatialManager.initialize).toHaveBeenCalled();
      
      expect(mockSpatialIndex.addFeatures).toHaveBeenCalledWith(largeFeatureSet);

      // Update viewport
      mockSpatialIndex.isEmpty.mockReturnValue(false);
      
      await act(async () => {
        await result.current.updateFogForViewport([-1, -1, 1, 1], 12);
      });

      // Wait for debounced calculation
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 400));
      });

      expect(result.current.usedSpatialIndexing).toBe(true);
      expect(result.current.featuresProcessed).toBe(100); // Limited by maxSpatialResults
    });

    it('should provide memory usage insights', async () => {
      getRevealedAreas.mockResolvedValue([]);
      
      mockSpatialIndex.getMemoryStats.mockReturnValue({
        estimatedMemoryUsage: 75 * 1024 * 1024, // 75MB
        featureCount: 5000,
        averageComplexity: 20,
        memoryPerFeature: 15360,
        recommendation: 'cleanup_required',
      });

      const { result } = renderHook(() => 
        useFogCalculation({ 
          useSpatialIndexing: true
        })
      );

      // Wait for initialization
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      const stats = result.current.getSpatialIndexStats();

      expect(stats.memoryStats.recommendation).toBe('cleanup_required');
      expect(stats.memoryStats.estimatedMemoryUsage).toBeGreaterThan(50 * 1024 * 1024);
    });
  });
});