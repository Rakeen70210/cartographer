/**
 * Mock implementation for geometry validation utilities
 * Provides consistent mock behavior for all geometry validation operations
 */

const mockGeometryValidation = {
  isValidGeometry: jest.fn(() => true),
  isValidPolygon: jest.fn(() => true),
  isValidMultiPolygon: jest.fn(() => true),
  isValidFeature: jest.fn(() => true),
  
  // Key function used by geometry operations
  isValidPolygonFeature: jest.fn((feature) => {
    // Handle null/undefined inputs
    if (!feature) return false;
    
    // Handle invalid types
    if (feature.type === 'NotFeature' || feature.type === 'invalid') return false;
    
    // Validate Feature structure
    if (feature.type !== 'Feature') return false;
    if (!feature.geometry) return false;
    
    // Validate geometry types
    const validTypes = ['Polygon', 'MultiPolygon'];
    return validTypes.includes(feature.geometry.type);
  }),
  
  // Validation function used by geometry operations
  validateGeometry: jest.fn((feature) => {
    // Handle null/undefined inputs
    if (!feature) return { isValid: false, errors: ['Geometry is null or undefined'], warnings: [] };
    
    // Handle invalid types
    if (feature.type === 'NotFeature' || feature.type === 'invalid') {
      return { isValid: false, errors: ['Invalid feature type'], warnings: [] };
    }
    
    // Validate Feature structure
    if (feature.type !== 'Feature') {
      return { isValid: false, errors: ['Not a valid Feature'], warnings: [] };
    }
    
    if (!feature.geometry) {
      return { isValid: false, errors: ['Missing geometry'], warnings: [] };
    }
    
    // Validate geometry types
    const validTypes = ['Polygon', 'MultiPolygon', 'Point'];
    if (!validTypes.includes(feature.geometry.type)) {
      return { isValid: false, errors: [`Invalid geometry type: ${feature.geometry.type}`], warnings: [] };
    }
    
    return { isValid: true, errors: [], warnings: [] };
  }),
  
  // Complexity function used by geometry operations
  getPolygonComplexity: jest.fn((feature) => ({
    totalVertices: 100,
    ringCount: 1,
    maxRingVertices: 100,
    averageRingVertices: 100,
    complexityLevel: 'MEDIUM'
  })),
  
  // Debug function used by geometry operations
  debugGeometry: jest.fn((geometry, label) => {
    // Silent in tests unless debugging
    if (process.env.DEBUG_TESTS) {
      console.log(`Debug ${label}:`, geometry);
    }
  }),
  
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