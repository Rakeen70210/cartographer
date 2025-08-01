import {
    calculateHaversineDistance,
    calculateTotalDistance,
    formatDistance,
    kilometersToMeters,
    metersToKilometers,
    metersToMiles,
    milesToMeters,
    validateCoordinates
} from '../utils/distanceCalculator';

describe('Distance Calculator', () => {
  describe('calculateHaversineDistance', () => {
    test('calculates distance between two points correctly', () => {
      // Distance between New York City and Los Angeles (approximately 3944 km)
      const nyc = { lat: 40.7128, lon: -74.0060 };
      const la = { lat: 34.0522, lon: -118.2437 };
      
      const distance = calculateHaversineDistance(nyc.lat, nyc.lon, la.lat, la.lon);
      const distanceKm = distance / 1000;
      
      // Should be approximately 3936 km (within 50km tolerance)
      expect(distanceKm).toBeCloseTo(3936, -1);
    });

    test('returns 0 for identical coordinates', () => {
      const distance = calculateHaversineDistance(40.7128, -74.0060, 40.7128, -74.0060);
      expect(distance).toBe(0);
    });

    test('calculates short distances accurately', () => {
      // Distance between two points 1km apart
      const point1 = { lat: 40.7128, lon: -74.0060 };
      const point2 = { lat: 40.7218, lon: -74.0060 }; // ~1km north
      
      const distance = calculateHaversineDistance(point1.lat, point1.lon, point2.lat, point2.lon);
      const distanceKm = distance / 1000;
      
      // Should be approximately 1 km
      expect(distanceKm).toBeCloseTo(1, 0);
    });

    test('handles antipodal points', () => {
      // Points on opposite sides of Earth
      const point1 = { lat: 0, lon: 0 };
      const point2 = { lat: 0, lon: 180 };
      
      const distance = calculateHaversineDistance(point1.lat, point1.lon, point2.lat, point2.lon);
      const distanceKm = distance / 1000;
      
      // Should be approximately half Earth's circumference (~20,015 km)
      expect(distanceKm).toBeCloseTo(20015, -2);
    });
  });

  describe('Unit conversion functions', () => {
    test('metersToMiles converts correctly', () => {
      expect(metersToMiles(1609.344)).toBeCloseTo(1, 6);
      expect(metersToMiles(0)).toBe(0);
      expect(metersToMiles(1000)).toBeCloseTo(0.621371, 5);
    });

    test('metersToKilometers converts correctly', () => {
      expect(metersToKilometers(1000)).toBe(1);
      expect(metersToKilometers(0)).toBe(0);
      expect(metersToKilometers(2500)).toBe(2.5);
    });

    test('milesToMeters converts correctly', () => {
      expect(milesToMeters(1)).toBeCloseTo(1609.344, 3);
      expect(milesToMeters(0)).toBe(0);
      expect(milesToMeters(0.621371)).toBeCloseTo(1000, 0);
    });

    test('kilometersToMeters converts correctly', () => {
      expect(kilometersToMeters(1)).toBe(1000);
      expect(kilometersToMeters(0)).toBe(0);
      expect(kilometersToMeters(2.5)).toBe(2500);
    });
  });

  describe('calculateTotalDistance', () => {
    test('returns zero for empty array', async () => {
      const result = await calculateTotalDistance([]);
      expect(result.miles).toBe(0);
      expect(result.kilometers).toBe(0);
    });

    test('returns zero for single location', async () => {
      const locations = [
        { id: 1, latitude: 40.7128, longitude: -74.0060, timestamp: 1000 }
      ];
      const result = await calculateTotalDistance(locations);
      expect(result.miles).toBe(0);
      expect(result.kilometers).toBe(0);
    });

    test('calculates distance for two locations', async () => {
      const locations = [
        { id: 1, latitude: 40.7128, longitude: -74.0060, timestamp: 1000 },
        { id: 2, latitude: 40.7218, longitude: -74.0060, timestamp: 2000 }
      ];
      
      const result = await calculateTotalDistance(locations);
      
      // Should be approximately 1 km = 0.621 miles
      expect(result.kilometers).toBeCloseTo(1, 0);
      expect(result.miles).toBeCloseTo(0.621, 1);
    });

    test('calculates cumulative distance for multiple locations', async () => {
      const locations = [
        { id: 1, latitude: 40.7128, longitude: -74.0060, timestamp: 1000 },
        { id: 2, latitude: 40.7228, longitude: -74.0060, timestamp: 2000 }, // ~1.1 km north
        { id: 3, latitude: 40.7228, longitude: -73.9960, timestamp: 3000 }  // ~0.7 km east
      ];
      
      const result = await calculateTotalDistance(locations);
      
      // Total should be approximately 1.8 km
      expect(result.kilometers).toBeCloseTo(1.8, 0);
      expect(result.miles).toBeCloseTo(1.1, 0);
    });

    test('sorts locations by timestamp before calculation', async () => {
      const locations = [
        { id: 3, latitude: 40.7228, longitude: -73.9960, timestamp: 3000 },
        { id: 1, latitude: 40.7128, longitude: -74.0060, timestamp: 1000 },
        { id: 2, latitude: 40.7228, longitude: -74.0060, timestamp: 2000 }
      ];
      
      const result = await calculateTotalDistance(locations);
      
      // Should give same result as properly ordered array
      expect(result.kilometers).toBeCloseTo(1.8, 0);
    });

    test('handles invalid coordinates gracefully', async () => {
      const locations = [
        { id: 1, latitude: 40.7128, longitude: -74.0060, timestamp: 1000 },
        { id: 2, latitude: NaN, longitude: -74.0060, timestamp: 2000 }
      ];
      
      // Should not throw error but may return NaN or handle gracefully
      await expect(calculateTotalDistance(locations)).resolves.toBeDefined();
    });
  });

  describe('formatDistance', () => {
    test('formats zero distance correctly', () => {
      expect(formatDistance(0, 'miles')).toBe('0 miles');
      expect(formatDistance(0, 'kilometers')).toBe('0 km');
    });

    test('formats small distances with appropriate precision', () => {
      expect(formatDistance(1.234, 'miles')).toBe('1.23 miles');
      expect(formatDistance(5.678, 'kilometers')).toBe('5.68 km');
    });

    test('formats medium distances with one decimal place', () => {
      expect(formatDistance(123.456, 'miles')).toBe('123.5 miles');
      expect(formatDistance(567.89, 'kilometers')).toBe('567.9 km');
    });

    test('formats large distances with no decimal places', () => {
      expect(formatDistance(1234.56, 'miles')).toBe('1,235 miles');
      expect(formatDistance(5678.9, 'kilometers')).toBe('5,679 km');
    });

    test('includes thousands separators for large numbers', () => {
      expect(formatDistance(12345.67, 'miles')).toBe('12,346 miles');
      expect(formatDistance(98765.43, 'kilometers')).toBe('98,765 km');
    });
  });

  describe('validateCoordinates', () => {
    test('validates correct coordinates', () => {
      expect(validateCoordinates(40.7128, -74.0060)).toBe(true);
      expect(validateCoordinates(0, 0)).toBe(true);
      expect(validateCoordinates(90, 180)).toBe(true);
      expect(validateCoordinates(-90, -180)).toBe(true);
    });

    test('rejects invalid latitude', () => {
      expect(validateCoordinates(91, 0)).toBe(false);
      expect(validateCoordinates(-91, 0)).toBe(false);
      expect(validateCoordinates(NaN, 0)).toBe(false);
    });

    test('rejects invalid longitude', () => {
      expect(validateCoordinates(0, 181)).toBe(false);
      expect(validateCoordinates(0, -181)).toBe(false);
      expect(validateCoordinates(0, NaN)).toBe(false);
    });

    test('rejects non-numeric values', () => {
      expect(validateCoordinates('40.7128', -74.0060)).toBe(false);
      expect(validateCoordinates(40.7128, '-74.0060')).toBe(false);
      expect(validateCoordinates(null, 0)).toBe(false);
      expect(validateCoordinates(undefined, 0)).toBe(false);
    });
  });
});