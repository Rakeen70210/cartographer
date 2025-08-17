/**
 * Mock implementation for fog calculation utilities
 * Provides consistent mock behavior for all fog calculation operations
 */

const mockFogCalculation = {
  calculateFogGeometry: jest.fn().mockResolvedValue({
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [-122.5, 37.7],
        [-122.3, 37.7],
        [-122.3, 37.8],
        [-122.5, 37.8],
        [-122.5, 37.7]
      ]]
    }
  }),
  
  createFogWithFallback: jest.fn().mockResolvedValue({
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [-122.5, 37.7],
        [-122.3, 37.7],
        [-122.3, 37.8],
        [-122.5, 37.8],
        [-122.5, 37.7]
      ]]
    }
  }),
  
  validateFogGeometry: jest.fn(() => true),
  optimizeFogGeometry: jest.fn((geometry) => geometry),
  
  // Fallback strategies
  createSimpleFogFallback: jest.fn().mockResolvedValue({
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [-180, -90],
        [180, -90],
        [180, 90],
        [-180, 90],
        [-180, -90]
      ]]
    }
  }),
  
  createEmptyFogFallback: jest.fn().mockResolvedValue(null),
  
  // Performance monitoring
  measureFogCalculationPerformance: jest.fn().mockResolvedValue({
    calculationTime: 50,
    geometryComplexity: 'medium',
    memoryUsage: 1024 * 1024
  }),
  
  // Fog optimization
  simplifyFogGeometry: jest.fn((geometry) => geometry),
  reduceFogComplexity: jest.fn((geometry, tolerance) => geometry),
  
  // Fog validation
  isFogGeometryValid: jest.fn(() => true),
  hasFogCoverage: jest.fn(() => true),
  getFogCoveragePercentage: jest.fn(() => 75.5),
  
  // Default options
  getDefaultFogOptions: jest.fn((viewportBounds) => ({
    viewportBounds,
    bufferDistance: 0.001,
    simplificationTolerance: 0.0001,
    useViewportOptimization: true,
    performanceMode: 'balanced',
    fallbackStrategy: 'simple',
    enableCaching: true,
    maxCacheAge: 5 * 60 * 1000,
    debugMode: false
  })),
  
  // Viewport fog calculation
  calculateViewportFog: jest.fn((revealedAreas, options) => ({
    fogGeoJSON: {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [-1, -1],
            [1, -1],
            [1, 1],
            [-1, 1],
            [-1, -1]
          ]]
        }
      }]
    },
    warnings: [],
    performance: {
      calculationTime: 50,
      geometryComplexity: 'medium'
    }
  }))
};

module.exports = mockFogCalculation;