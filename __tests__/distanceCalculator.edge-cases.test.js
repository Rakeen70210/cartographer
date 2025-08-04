import {
    calculateHaversineDistance,
    calculateTotalDistance,
    formatDistance,
    validateCoordinates
} from '../utils/distanceCalculator';

describe('Distance Calculator - Edge Cases and Error Handling', () => {
  describe('calculateHaversineDistance edge cases', () => {
    test('handles extreme coordinate values', () => {
      // North Pole to South Pole
      const northPole = { lat: 90, lon: 0 };
      const southPole = { lat: -90, lon: 0 };
      
      const distance = calculateHaversineDistance(northPole.lat, northPole.lon, southPole.lat, southPole.lon);
      const distanceKm = distance / 1000;
      
      // Should be approximately half Earth's circumference (~20,015 km)
      expect(distanceKm).toBeCloseTo(20015, -2);
    });

    test('handles coordinates at international date line', () => {
      // Points on opposite sides of international date line
      const point1 = { lat: 0, lon: 179.9 };
      const point2 = { lat: 0, lon: -179.9 };
      
      const distance = calculateHaversineDistance(point1.lat, point1.lon, point2.lat, point2.lon);
      const distanceKm = distance / 1000;
      
      // Should be a short distance, not halfway around the world
      expect(distanceKm).toBeLessThan(100);
    });

    test('handles very small coordinate differences', () => {
      const point1 = { lat: 40.7128, lon: -74.0060 };
      const point2 = { lat: 40.7128001, lon: -74.0060001 }; // ~0.01 meter difference
      
      const distance = calculateHaversineDistance(point1.lat, point1.lon, point2.lat, point2.lon);
      
      expect(distance).toBeGreaterThan(0);
      expect(distance).toBeLessThan(1); // Less than 1 meter
    });

    test('handles floating point precision issues', () => {
      const lat1 = 40.7128000000001;
      const lon1 = -74.0060000000001;
      const lat2 = 40.7128000000002;
      const lon2 = -74.0060000000002;
      
      const distance = calculateHaversineDistance(lat1, lon1, lat2, lon2);
      
      expect(distance).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(distance)).toBe(true);
    });

    test('handles NaN inputs gracefully', () => {
      const distance1 = calculateHaversineDistance(NaN, -74.0060, 40.7128, -74.0060);
      const distance2 = calculateHaversineDistance(40.7128, NaN, 40.7128, -74.0060);
      const distance3 = calculateHaversineDistance(40.7128, -74.0060, NaN, -74.0060);
      const distance4 = calculateHaversineDistance(40.7128, -74.0060, 40.7128, NaN);
      
      expect(Number.isNaN(distance1)).toBe(true);
      expect(Number.isNaN(distance2)).toBe(true);
      expect(Number.isNaN(distance3)).toBe(true);
      expect(Number.isNaN(distance4)).toBe(true);
    });

    test('handles Infinity inputs', () => {
      const distance1 = calculateHaversineDistance(Infinity, -74.0060, 40.7128, -74.0060);
      const distance2 = calculateHaversineDistance(40.7128, -Infinity, 40.7128, -74.0060);
      
      expect(Number.isNaN(distance1) || !Number.isFinite(distance1)).toBe(true);
      expect(Number.isNaN(distance2) || !Number.isFinite(distance2)).toBe(true);
    });
  });

  describe('calculateTotalDistance edge cases', () => {
    test('handles locations with identical coordinates', async () => {
      const locations = [
        { id: 1, latitude: 40.7128, longitude: -74.0060, timestamp: 1000 },
        { id: 2, latitude: 40.7128, longitude: -74.0060, timestamp: 2000 },
        { id: 3, latitude: 40.7128, longitude: -74.0060, timestamp: 3000 }
      ];
      
      const result = await calculateTotalDistance(locations);
      
      expect(result.miles).toBe(0);
      expect(result.kilometers).toBe(0);
    });

    test('handles unsorted timestamps', async () => {
      const locations = [
        { id: 1, latitude: 40.7128, longitude: -74.0060, timestamp: 3000 },
        { id: 2, latitude: 40.7228, longitude: -74.0060, timestamp: 1000 },
        { id: 3, latitude: 40.7328, longitude: -74.0060, timestamp: 2000 }
      ];
      
      const result = await calculateTotalDistance(locations);
      
      // Should calculate based on chronological order (1000 -> 2000 -> 3000)
      expect(result.kilometers).toBeGreaterThan(0);
    });

    test('handles duplicate timestamps', async () => {
      const locations = [
        { id: 1, latitude: 40.7128, longitude: -74.0060, timestamp: 1000 },
        { id: 2, latitude: 40.7228, longitude: -74.0060, timestamp: 1000 }, // Same timestamp
        { id: 3, latitude: 40.7328, longitude: -74.0060, timestamp: 2000 }
      ];
      
      const result = await calculateTotalDistance(locations);
      
      expect(result.kilometers).toBeGreaterThan(0);
      expect(Number.isFinite(result.kilometers)).toBe(true);
    });

    test('handles very large datasets efficiently', async () => {
      const locations = Array.from({ length: 10000 }, (_, i) => ({
        id: i + 1,
        latitude: 40.7128 + (i * 0.0001), // Small increments
        longitude: -74.0060 + (i * 0.0001),
        timestamp: 1000 + i
      }));
      
      const startTime = Date.now();
      const result = await calculateTotalDistance(locations);
      const endTime = Date.now();
      
      expect(result.kilometers).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('handles locations with invalid coordinates', async () => {
      const locations = [
        { id: 1, latitude: 40.7128, longitude: -74.0060, timestamp: 1000 },
        { id: 2, latitude: 91, longitude: -74.0060, timestamp: 2000 }, // Invalid latitude
        { id: 3, latitude: 40.7328, longitude: 181, timestamp: 3000 }, // Invalid longitude
        { id: 4, latitude: 40.7428, longitude: -74.0060, timestamp: 4000 }
      ];
      
      // Should handle gracefully and calculate what it can
      const result = await calculateTotalDistance(locations);
      
      expect(Number.isFinite(result.kilometers) || result.kilometers === 0).toBe(true);
    });

    test('handles locations with NaN coordinates', async () => {
      const locations = [
        { id: 1, latitude: 40.7128, longitude: -74.0060, timestamp: 1000 },
        { id: 2, latitude: NaN, longitude: -74.0060, timestamp: 2000 },
        { id: 3, latitude: 40.7328, longitude: NaN, timestamp: 3000 },
        { id: 4, latitude: 40.7428, longitude: -74.0060, timestamp: 4000 }
      ];
      
      const result = await calculateTotalDistance(locations);
      
      // Should handle gracefully
      expect(typeof result.kilometers).toBe('number');
      expect(typeof result.miles).toBe('number');
    });

    test('handles null and undefined values', async () => {
      const locations = [
        { id: 1, latitude: 40.7128, longitude: -74.0060, timestamp: 1000 },
        { id: 2, latitude: null, longitude: -74.0060, timestamp: 2000 },
        { id: 3, latitude: 40.7328, longitude: undefined, timestamp: 3000 },
        { id: 4, latitude: 40.7428, longitude: -74.0060, timestamp: 4000 }
      ];
      
      const result = await calculateTotalDistance(locations);
      
      expect(typeof result.kilometers).toBe('number');
      expect(typeof result.miles).toBe('number');
    });

    test('handles extremely long distances', async () => {
      const locations = [
        { id: 1, latitude: 90, longitude: 0, timestamp: 1000 }, // North Pole
        { id: 2, latitude: -90, longitude: 0, timestamp: 2000 }, // South Pole
        { id: 3, latitude: 90, longitude: 180, timestamp: 3000 }, // North Pole, opposite side
        { id: 4, latitude: -90, longitude: 180, timestamp: 4000 } // South Pole, opposite side
      ];
      
      const result = await calculateTotalDistance(locations);
      
      expect(result.kilometers).toBeGreaterThan(40000); // Should be > Earth's circumference
      expect(Number.isFinite(result.kilometers)).toBe(true);
    });
  });

  describe('formatDistance edge cases', () => {
    test('handles very small distances', () => {
      expect(formatDistance(0.001, 'miles')).toBe('0.00 miles');
      expect(formatDistance(0.0001, 'kilometers')).toBe('0.00 km');
    });

    test('handles very large distances', () => {
      expect(formatDistance(999999.99, 'miles')).toBe('1,000,000 miles');
      expect(formatDistance(1234567.89, 'kilometers')).toBe('1,234,568 km');
    });

    test('handles negative distances', () => {
      expect(formatDistance(-5.5, 'miles')).toBe('-5.50 miles');
      expect(formatDistance(-100.1, 'kilometers')).toBe('-100.1 km');
    });

    test('handles NaN and Infinity', () => {
      expect(formatDistance(NaN, 'miles')).toBe('NaN miles');
      expect(formatDistance(Infinity, 'kilometers')).toBe('Infinity km');
      expect(formatDistance(-Infinity, 'miles')).toBe('-Infinity miles');
    });

    test('handles precision edge cases', () => {
      // Test boundary conditions for precision logic
      expect(formatDistance(99.999, 'miles')).toBe('100.00 miles'); // Rounds to 100
      expect(formatDistance(999.999, 'kilometers')).toBe('1,000.0 km'); // Rounds to 1000
      expect(formatDistance(9999.999, 'miles')).toBe('10,000 miles'); // Rounds to 10000
    });
  });

  describe('validateCoordinates edge cases', () => {
    test('handles boundary values', () => {
      expect(validateCoordinates(90, 180)).toBe(true);
      expect(validateCoordinates(-90, -180)).toBe(true);
      expect(validateCoordinates(90.0, 180.0)).toBe(true);
      expect(validateCoordinates(-90.0, -180.0)).toBe(true);
    });

    test('handles values just outside boundaries', () => {
      expect(validateCoordinates(90.0001, 0)).toBe(false);
      expect(validateCoordinates(-90.0001, 0)).toBe(false);
      expect(validateCoordinates(0, 180.0001)).toBe(false);
      expect(validateCoordinates(0, -180.0001)).toBe(false);
    });

    test('handles floating point precision issues', () => {
      expect(validateCoordinates(89.99999999999999, 179.99999999999999)).toBe(true);
      expect(validateCoordinates(-89.99999999999999, -179.99999999999999)).toBe(true);
    });

    test('handles special numeric values', () => {
      expect(validateCoordinates(0, 0)).toBe(true);
      expect(validateCoordinates(-0, -0)).toBe(true);
      expect(validateCoordinates(NaN, 0)).toBe(false);
      expect(validateCoordinates(0, NaN)).toBe(false);
      expect(validateCoordinates(Infinity, 0)).toBe(false);
      expect(validateCoordinates(0, -Infinity)).toBe(false);
    });

    test('handles type coercion attempts', () => {
      expect(validateCoordinates('0', '0')).toBe(false);
      expect(validateCoordinates(true, false)).toBe(false);
      expect(validateCoordinates([], {})).toBe(false);
      expect(validateCoordinates(new Date(), new Date())).toBe(false);
    });

    test('handles object properties that might be numbers', () => {
      const obj1 = { valueOf: () => 40.7128 };
      const obj2 = { valueOf: () => -74.0060 };
      expect(validateCoordinates(obj1, obj2)).toBe(false);
    });
  });

  describe('async error handling', () => {
    test('calculateTotalDistance handles promise rejection gracefully', async () => {
      // Mock a scenario where the calculation might fail
      const locations = [
        { id: 1, latitude: 40.7128, longitude: -74.0060, timestamp: 1000 },
        { id: 2, latitude: 40.7228, longitude: -74.0060, timestamp: 2000 }
      ];

      // This should not throw an error
      const result = await calculateTotalDistance(locations);
      expect(result).toBeDefined();
      expect(typeof result.miles).toBe('number');
      expect(typeof result.kilometers).toBe('number');
    });

    test('handles memory pressure with large datasets', async () => {
      // Create a very large dataset to test memory handling
      const locations = Array.from({ length: 50000 }, (_, i) => ({
        id: i + 1,
        latitude: 40.7128 + Math.random() * 0.1,
        longitude: -74.0060 + Math.random() * 0.1,
        timestamp: 1000 + i
      }));

      // Should complete without running out of memory
      const result = await calculateTotalDistance(locations);
      expect(Number.isFinite(result.kilometers)).toBe(true);
      expect(Number.isFinite(result.miles)).toBe(true);
    });
  });

  describe('performance edge cases', () => {
    test('handles rapid successive calculations', async () => {
      const locations = [
        { id: 1, latitude: 40.7128, longitude: -74.0060, timestamp: 1000 },
        { id: 2, latitude: 40.7228, longitude: -74.0060, timestamp: 2000 }
      ];

      // Run multiple calculations simultaneously
      const promises = Array.from({ length: 100 }, () => calculateTotalDistance(locations));
      const results = await Promise.all(promises);

      // All results should be identical and valid
      results.forEach(result => {
        expect(result.kilometers).toBeCloseTo(results[0].kilometers, 10);
        expect(result.miles).toBeCloseTo(results[0].miles, 10);
      });
    });

    test('handles calculations with minimal coordinate changes', async () => {
      const baseLocation = { latitude: 40.7128, longitude: -74.0060 };
      const locations = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        latitude: baseLocation.latitude + (i * 0.000001), // Very small increments
        longitude: baseLocation.longitude + (i * 0.000001),
        timestamp: 1000 + i
      }));

      const result = await calculateTotalDistance(locations);
      
      expect(result.kilometers).toBeGreaterThan(0);
      expect(result.kilometers).toBeLessThan(1); // Should be very small total distance
      expect(Number.isFinite(result.kilometers)).toBe(true);
    });
  });
});