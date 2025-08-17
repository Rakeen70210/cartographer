/**
 * Mock implementation for geometry validation utilities
 * Provides consistent mock behavior for all geometry validation operations
 */

const mockGeometryValidation = {
  isValidGeometry: jest.fn(() => true),
  isValidPolygon: jest.fn(() => true),
  isValidMultiPolygon: jest.fn(() => true),
  isValidFeature: jest.fn(() => true),
  
  validateCoordinates: jest.fn(() => true),
  sanitizeCoordinates: jest.fn((coords) => coords),
  fixGeometryIssues: jest.fn((geometry) => geometry),
  
  // Enhanced validation functions
  validatePolygonRings: jest.fn(() => true),
  validateCoordinateRange: jest.fn(() => true),
  validateGeometryStructure: jest.fn(() => true),
  
  // Geometry repair functions
  repairGeometry: jest.fn((geometry) => geometry),
  closePolygonRings: jest.fn((geometry) => geometry),
  removeInvalidCoordinates: jest.fn((geometry) => geometry),
  
  // Validation with detailed results
  validateGeometryDetailed: jest.fn(() => ({
    isValid: true,
    errors: [],
    warnings: [],
    repaired: false
  })),
  
  // Coordinate validation
  isValidLatitude: jest.fn((lat) => typeof lat === 'number' && lat >= -90 && lat <= 90),
  isValidLongitude: jest.fn((lon) => typeof lon === 'number' && lon >= -180 && lon <= 180),
  isValidCoordinatePair: jest.fn((coords) => Array.isArray(coords) && coords.length === 2),
  
  // Geometry type validation
  isPolygonGeometry: jest.fn((geometry) => geometry?.type === 'Polygon'),
  isMultiPolygonGeometry: jest.fn((geometry) => geometry?.type === 'MultiPolygon'),
  isFeatureGeometry: jest.fn((geometry) => geometry?.type === 'Feature'),
  
  // Geometry complexity validation
  isGeometryTooComplex: jest.fn(() => false),
  getGeometryComplexity: jest.fn(() => 'medium'),
  getPolygonComplexity: jest.fn(() => 'medium'),
  simplifyComplexGeometry: jest.fn((geometry) => geometry),
  
  // Debug functions
  debugGeometry: jest.fn((geometry, label) => {
    console.log(`Debug ${label}:`, geometry);
  }),
  
  // Additional validation functions that might be used
  validatePolygonStructure: jest.fn(() => true),
  validateMultiPolygonStructure: jest.fn(() => true),
  validateFeatureStructure: jest.fn(() => true)
};

module.exports = mockGeometryValidation;