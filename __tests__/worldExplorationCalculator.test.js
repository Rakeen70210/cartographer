import {
    calculateRevealedArea,
    calculateSingleFeatureArea,
    calculateWorldExplorationPercentage,
    EARTH_SURFACE_AREA_KM2,
    formatExplorationPercentage,
    getEarthSurfaceArea,
    validateGeometryForArea
} from '../utils/worldExplorationCalculator';

describe('World Exploration Calculator', () => {
  // Sample GeoJSON data for testing
  const samplePolygon = {
    type: 'Polygon',
    coordinates: [[
      [-74.0, 40.7], [-74.0, 40.8], [-73.9, 40.8], [-73.9, 40.7], [-74.0, 40.7]
    ]]
  };

  const sampleFeature = {
    type: 'Feature',
    geometry: samplePolygon,
    properties: {}
  };

  const sampleMultiPolygon = {
    type: 'MultiPolygon',
    coordinates: [
      [[[-74.0, 40.7], [-74.0, 40.8], [-73.9, 40.8], [-73.9, 40.7], [-74.0, 40.7]]],
      [[[-73.8, 40.6], [-73.8, 40.7], [-73.7, 40.7], [-73.7, 40.6], [-73.8, 40.6]]]
    ]
  };

  const invalidGeometry = {
    type: 'Point',
    coordinates: [-74.0, 40.7]
  };

  describe('EARTH_SURFACE_AREA_KM2 constant', () => {
    test('has correct Earth surface area value', () => {
      expect(EARTH_SURFACE_AREA_KM2).toBe(510072000);
      expect(getEarthSurfaceArea()).toBe(510072000);
    });
  });

  describe('validateGeometryForArea', () => {
    test('validates correct Polygon geometry', () => {
      expect(validateGeometryForArea(samplePolygon)).toBe(true);
      expect(validateGeometryForArea(sampleFeature)).toBe(true);
    });

    test('validates correct MultiPolygon geometry', () => {
      expect(validateGeometryForArea(sampleMultiPolygon)).toBe(true);
    });

    test('rejects invalid geometry types', () => {
      expect(validateGeometryForArea(invalidGeometry)).toBe(false);
      expect(validateGeometryForArea({ type: 'LineString', coordinates: [[0, 0], [1, 1]] })).toBe(false);
    });

    test('rejects malformed geometries', () => {
      expect(validateGeometryForArea(null)).toBe(false);
      expect(validateGeometryForArea(undefined)).toBe(false);
      expect(validateGeometryForArea({})).toBe(false);
      expect(validateGeometryForArea({ type: 'Polygon' })).toBe(false);
      expect(validateGeometryForArea({ type: 'Polygon', coordinates: [] })).toBe(false);
    });

    test('rejects polygons with insufficient coordinates', () => {
      const invalidPolygon = {
        type: 'Polygon',
        coordinates: [[[0, 0], [1, 1]]] // Only 2 points, need at least 4
      };
      expect(validateGeometryForArea(invalidPolygon)).toBe(false);
    });
  });

  describe('calculateSingleFeatureArea', () => {
    test('calculates area for valid polygon', () => {
      const area = calculateSingleFeatureArea(samplePolygon);
      expect(area).toBeGreaterThan(0);
      expect(typeof area).toBe('number');
    });

    test('calculates area for valid feature', () => {
      const area = calculateSingleFeatureArea(sampleFeature);
      expect(area).toBeGreaterThan(0);
      expect(typeof area).toBe('number');
    });

    test('calculates area for MultiPolygon', () => {
      const area = calculateSingleFeatureArea(sampleMultiPolygon);
      expect(area).toBeGreaterThan(0);
      expect(typeof area).toBe('number');
    });

    test('returns 0 for invalid geometry', () => {
      expect(calculateSingleFeatureArea(invalidGeometry)).toBe(0);
      expect(calculateSingleFeatureArea(null)).toBe(0);
      expect(calculateSingleFeatureArea({})).toBe(0);
    });

    test('area calculation is consistent', () => {
      const area1 = calculateSingleFeatureArea(samplePolygon);
      const area2 = calculateSingleFeatureArea(sampleFeature);
      expect(area1).toBeCloseTo(area2, 10);
    });
  });

  describe('calculateRevealedArea', () => {
    test('returns 0 for empty array', async () => {
      const result = await calculateRevealedArea([]);
      expect(result).toBe(0);
    });

    test('returns 0 for null/undefined input', async () => {
      const result1 = await calculateRevealedArea(null);
      const result2 = await calculateRevealedArea(undefined);
      expect(result1).toBe(0);
      expect(result2).toBe(0);
    });

    test('calculates area for single revealed area', async () => {
      const revealedAreas = [
        { id: 1, geojson: JSON.stringify(samplePolygon) }
      ];
      
      const result = await calculateRevealedArea(revealedAreas);
      expect(result).toBeGreaterThan(0);
      expect(typeof result).toBe('number');
    });

    test('calculates cumulative area for multiple revealed areas', async () => {
      const revealedAreas = [
        { id: 1, geojson: JSON.stringify(samplePolygon) },
        { id: 2, geojson: JSON.stringify(sampleMultiPolygon) }
      ];
      
      const result = await calculateRevealedArea(revealedAreas);
      const singleArea = await calculateRevealedArea([{ id: 1, geojson: JSON.stringify(samplePolygon) }]);
      
      expect(result).toBeGreaterThan(singleArea);
    });

    test('handles mixed valid and invalid geometries', async () => {
      const revealedAreas = [
        { id: 1, geojson: JSON.stringify(samplePolygon) },
        { id: 2, geojson: JSON.stringify(invalidGeometry) },
        { id: 3, geojson: JSON.stringify(sampleFeature) }
      ];
      
      const result = await calculateRevealedArea(revealedAreas);
      expect(result).toBeGreaterThan(0);
    });

    test('handles malformed JSON gracefully', async () => {
      const revealedAreas = [
        { id: 1, geojson: JSON.stringify(samplePolygon) },
        { id: 2, geojson: 'invalid json' },
        { id: 3, geojson: JSON.stringify(sampleFeature) }
      ];
      
      const result = await calculateRevealedArea(revealedAreas);
      expect(result).toBeGreaterThan(0);
    });

    test('handles pre-parsed GeoJSON objects', async () => {
      const revealedAreas = [
        { id: 1, geojson: samplePolygon } // Already parsed object
      ];
      
      const result = await calculateRevealedArea(revealedAreas);
      expect(result).toBeGreaterThan(0);
    });
  });

  describe('calculateWorldExplorationPercentage', () => {
    test('returns correct structure for empty areas', async () => {
      const result = await calculateWorldExplorationPercentage([]);
      
      expect(result).toHaveProperty('percentage');
      expect(result).toHaveProperty('totalAreaKm2');
      expect(result).toHaveProperty('exploredAreaKm2');
      expect(result.percentage).toBe(0);
      expect(result.totalAreaKm2).toBe(EARTH_SURFACE_AREA_KM2);
      expect(result.exploredAreaKm2).toBe(0);
    });

    test('calculates percentage for revealed areas', async () => {
      const revealedAreas = [
        { id: 1, geojson: JSON.stringify(samplePolygon) }
      ];
      
      const result = await calculateWorldExplorationPercentage(revealedAreas);
      
      expect(result.percentage).toBeGreaterThan(0);
      expect(result.percentage).toBeLessThan(100);
      expect(result.exploredAreaKm2).toBeGreaterThan(0);
      expect(result.totalAreaKm2).toBe(EARTH_SURFACE_AREA_KM2);
    });

    test('percentage calculation is mathematically correct', async () => {
      const revealedAreas = [
        { id: 1, geojson: JSON.stringify(samplePolygon) }
      ];
      
      const result = await calculateWorldExplorationPercentage(revealedAreas);
      const expectedPercentage = (result.exploredAreaKm2 / EARTH_SURFACE_AREA_KM2) * 100;
      
      expect(result.percentage).toBeCloseTo(expectedPercentage, 10);
    });

    test('handles multiple areas correctly', async () => {
      const revealedAreas = [
        { id: 1, geojson: JSON.stringify(samplePolygon) },
        { id: 2, geojson: JSON.stringify(sampleMultiPolygon) }
      ];
      
      const result = await calculateWorldExplorationPercentage(revealedAreas);
      const singleResult = await calculateWorldExplorationPercentage([{ id: 1, geojson: JSON.stringify(samplePolygon) }]);
      
      expect(result.percentage).toBeGreaterThan(singleResult.percentage);
      expect(result.exploredAreaKm2).toBeGreaterThan(singleResult.exploredAreaKm2);
    });
  });

  describe('formatExplorationPercentage', () => {
    test('formats zero percentage correctly', () => {
      expect(formatExplorationPercentage(0, 'world')).toBe('0.000%');
      expect(formatExplorationPercentage(0, 'country')).toBe('0.0%');
      expect(formatExplorationPercentage(0, 'state')).toBe('0.0%');
      expect(formatExplorationPercentage(0, 'city')).toBe('0.0%');
    });

    test('formats world level with 3 decimal places', () => {
      expect(formatExplorationPercentage(0.001234, 'world')).toBe('0.001%');
      expect(formatExplorationPercentage(1.23456, 'world')).toBe('1.235%');
    });

    test('formats country level with 2 decimal places', () => {
      expect(formatExplorationPercentage(1.23456, 'country')).toBe('1.23%');
      expect(formatExplorationPercentage(15.6789, 'country')).toBe('15.68%');
    });

    test('formats state level with 1 decimal place', () => {
      expect(formatExplorationPercentage(15.6789, 'state')).toBe('15.7%');
      expect(formatExplorationPercentage(45.234, 'state')).toBe('45.2%');
    });

    test('formats city level with 1 decimal place', () => {
      expect(formatExplorationPercentage(45.678, 'city')).toBe('45.7%');
      expect(formatExplorationPercentage(89.123, 'city')).toBe('89.1%');
    });

    test('defaults to world level formatting', () => {
      expect(formatExplorationPercentage(1.23456)).toBe('1.235%');
    });

    test('handles edge cases', () => {
      expect(formatExplorationPercentage(100, 'world')).toBe('100.000%');
      expect(formatExplorationPercentage(99.999, 'country')).toBe('100.00%');
      expect(formatExplorationPercentage(0.0001, 'world')).toBe('0.000%');
    });
  });

  describe('error handling', () => {
    test('calculateRevealedArea handles errors gracefully', async () => {
      // This should not throw an error
      const result = await calculateRevealedArea([
        { id: 1, geojson: 'completely invalid' },
        { id: 2, geojson: null }
      ]);
      
      expect(result).toBe(0);
    });

    test('calculateWorldExplorationPercentage handles errors gracefully', async () => {
      // This should not throw an error
      const result = await calculateWorldExplorationPercentage([
        { id: 1, geojson: 'invalid' }
      ]);
      
      expect(result.percentage).toBe(0);
      expect(result.exploredAreaKm2).toBe(0);
    });
  });
});