/**
 * Mock implementation for distance calculator utilities
 * Provides consistent mock behavior for all distance calculation operations
 */

const mockDistanceCalculator = {
  calculateTotalDistance: jest.fn().mockResolvedValue({
    miles: 123.45,
    kilometers: 198.65
  }),
  
  calculateHaversineDistance: jest.fn().mockReturnValue(1000), // meters
  
  formatDistance: jest.fn().mockImplementation((distance, unit) => {
    // Handle special cases
    if (distance === 0) return `0 ${unit === 'miles' ? 'miles' : 'km'}`;
    if (isNaN(distance)) return `NaN ${unit === 'miles' ? 'miles' : 'km'}`;
    if (distance === Infinity) return `∞ ${unit === 'miles' ? 'miles' : 'km'}`;
    if (distance === -Infinity) return `-∞ ${unit === 'miles' ? 'miles' : 'km'}`;

    // Determine precision based on magnitude
    let precision = 2;
    if (Math.abs(distance) >= 100) precision = 1;
    if (Math.abs(distance) >= 1000) precision = 0;

    const formatted = distance.toFixed(precision);
    return `${formatted} ${unit === 'miles' ? 'miles' : 'km'}`;
  }),
  
  validateCoordinates: jest.fn().mockImplementation((lat, lon) => {
    return typeof lat === 'number' && typeof lon === 'number' &&
           lat >= -90 && lat <= 90 &&
           lon >= -180 && lon <= 180 &&
           !isNaN(lat) && !isNaN(lon);
  }),
  
  // Unit conversion functions
  metersToMiles: jest.fn().mockImplementation((meters) => meters * 0.000621371),
  metersToKilometers: jest.fn().mockImplementation((meters) => meters / 1000),
  milesToMeters: jest.fn().mockImplementation((miles) => miles * 1609.344),
  kilometersToMeters: jest.fn().mockImplementation((km) => km * 1000),
  
  // Distance calculation variants
  calculateDistanceBetweenPoints: jest.fn().mockReturnValue(1000),
  calculateCumulativeDistance: jest.fn().mockResolvedValue(5000),
  calculateAverageDistance: jest.fn().mockResolvedValue(1250),
  
  // Performance monitoring
  measureDistanceCalculationPerformance: jest.fn().mockResolvedValue({
    calculationTime: 25,
    pointsProcessed: 100,
    averageTimePerPoint: 0.25
  }),
  
  // Validation helpers
  isValidLocationArray: jest.fn((locations) => Array.isArray(locations) && locations.length > 0),
  filterValidLocations: jest.fn((locations) => locations.filter(loc => 
    loc && typeof loc.latitude === 'number' && typeof loc.longitude === 'number'
  )),
  
  // Distance formatting variants
  formatDistanceWithUnit: jest.fn().mockImplementation((distance, unit, precision = 2) => {
    return `${distance.toFixed(precision)} ${unit}`;
  }),
  
  formatDistanceHumanReadable: jest.fn().mockImplementation((meters) => {
    if (meters < 1000) return `${meters.toFixed(0)} m`;
    if (meters < 1000000) return `${(meters / 1000).toFixed(1)} km`;
    return `${(meters / 1000000).toFixed(2)} Mm`;
  })
};

module.exports = mockDistanceCalculator;