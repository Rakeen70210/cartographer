/**
 * Mock implementation for world exploration calculator utilities
 * Provides consistent mock behavior for all world exploration calculations
 */

const mockWorldExplorationCalculator = {
  calculateWorldExplorationPercentage: jest.fn().mockResolvedValue({
    percentage: 0.001,
    totalAreaKm2: 510072000,
    exploredAreaKm2: 5.1
  }),
  
  calculateRevealedArea: jest.fn().mockResolvedValue(5.1),
  
  validateGeometryForArea: jest.fn().mockImplementation((geojson) => {
    try {
      if (!geojson || typeof geojson !== 'object') return false;
      
      const geometry = geojson.type === 'Feature' ? geojson.geometry : geojson;
      if (!geometry?.type) return false;
      
      if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') return false;
      
      if (!geometry.coordinates || !Array.isArray(geometry.coordinates)) return false;
      
      // Enhanced validation for coordinate structure
      if (geometry.type === 'Polygon') {
        return geometry.coordinates.length > 0 && 
               Array.isArray(geometry.coordinates[0]) &&
               geometry.coordinates[0].length >= 4;
      } else {
        return geometry.coordinates.every(polygon => 
          Array.isArray(polygon) && 
          polygon.length > 0 &&
          Array.isArray(polygon[0]) &&
          polygon[0].length >= 4
        );
      }
    } catch {
      return false;
    }
  }),
  
  formatExplorationPercentage: jest.fn().mockImplementation((percentage, level = 'world') => {
    if (percentage === 0) {
      switch (level) {
        case 'world': return '0.000%';
        default: return '0.0%';
      }
    }
    
    // Handle very large percentages correctly
    if (percentage > 1000) {
      return `${percentage.toFixed(0)}%`;
    }
    
    switch (level) {
      case 'world': return `${percentage.toFixed(3)}%`;
      case 'country': return `${Math.min(percentage, 100).toFixed(2)}%`;
      case 'state':
      case 'city': return `${percentage.toFixed(1)}%`;
      default: return `${percentage.toFixed(3)}%`;
    }
  }),
  
  // Area calculation functions
  calculateSingleFeatureArea: jest.fn().mockReturnValue(2.5),
  calculateTotalRevealedArea: jest.fn().mockResolvedValue(10.2),
  calculateAreaFromGeometry: jest.fn().mockReturnValue(1.5),
  
  // Earth surface area functions
  getEarthSurfaceArea: jest.fn().mockReturnValue(510072000),
  getEarthLandArea: jest.fn().mockReturnValue(148940000),
  getEarthOceanArea: jest.fn().mockReturnValue(361132000),
  
  // Exploration statistics
  calculateExplorationStats: jest.fn().mockResolvedValue({
    totalExplored: 5.1,
    landExplored: 3.2,
    oceanExplored: 1.9,
    percentageOfLand: 0.002,
    percentageOfOcean: 0.0005
  }),
  
  // Performance monitoring
  measureAreaCalculationPerformance: jest.fn().mockResolvedValue({
    calculationTime: 75,
    geometriesProcessed: 50,
    averageTimePerGeometry: 1.5
  }),
  
  // Validation and optimization
  optimizeGeometryForAreaCalculation: jest.fn((geometry) => geometry),
  validateAreaCalculationInput: jest.fn(() => true),
  
  // Comparison functions
  compareExplorationProgress: jest.fn().mockReturnValue({
    current: 5.1,
    previous: 4.8,
    change: 0.3,
    percentageChange: 6.25
  }),
  
  // Formatting helpers
  formatAreaWithUnit: jest.fn().mockImplementation((area, unit = 'km2') => {
    if (area < 1) return `${(area * 1000000).toFixed(0)} m²`;
    if (area < 1000) return `${area.toFixed(1)} km²`;
    return `${(area / 1000).toFixed(1)} thousand km²`;
  }),
  
  formatExplorationSummary: jest.fn().mockImplementation((stats) => ({
    worldPercentage: `${stats.percentage.toFixed(3)}%`,
    totalArea: `${stats.exploredAreaKm2.toFixed(1)} km²`,
    summary: `Explored ${stats.exploredAreaKm2.toFixed(1)} km² (${stats.percentage.toFixed(3)}% of Earth)`
  }))
};

module.exports = mockWorldExplorationCalculator;