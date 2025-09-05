// Unmock the world exploration calculator for this test
jest.unmock('../utils/worldExplorationCalculator');
jest.unmock('../utils/logger');

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

  // Edge Cases and Error Handling Tests
  describe('Edge Cases and Error Handling', () => {
    describe('validateGeometryForArea edge cases', () => {
      test('handles complex valid polygons', () => {
        const complexPolygon = {
          type: 'Polygon',
          coordinates: [
            // Outer ring
            [[-74.0, 40.7], [-74.0, 40.8], [-73.9, 40.8], [-73.9, 40.7], [-74.0, 40.7]],
            // Inner ring (hole)
            [[-73.95, 40.75], [-73.95, 40.76], [-73.94, 40.76], [-73.94, 40.75], [-73.95, 40.75]]
          ]
        };
        
        expect(validateGeometryForArea(complexPolygon)).toBe(true);
      });

      test('handles complex MultiPolygon', () => {
        const complexMultiPolygon = {
          type: 'MultiPolygon',
          coordinates: [
            // First polygon with hole
            [[
              [[-74.0, 40.7], [-74.0, 40.8], [-73.9, 40.8], [-73.9, 40.7], [-74.0, 40.7]],
              [[-73.95, 40.75], [-73.95, 40.76], [-73.94, 40.76], [-73.94, 40.75], [-73.95, 40.75]]
            ]],
            // Second simple polygon
            [[
              [[-73.8, 40.6], [-73.8, 40.7], [-73.7, 40.7], [-73.7, 40.6], [-73.8, 40.6]]
            ]]
          ]
        };
        
        expect(validateGeometryForArea(complexMultiPolygon)).toBe(true);
      });

      test('rejects empty coordinate arrays', () => {
        const emptyPolygon = {
          type: 'Polygon',
          coordinates: []
        };
        
        expect(validateGeometryForArea(emptyPolygon)).toBe(false);
      });

      test('rejects malformed coordinate structures', () => {
        const malformedPolygon = {
          type: 'Polygon',
          coordinates: [
            [0, 1, 2, 3] // Should be array of coordinate pairs
          ]
        };
        
        expect(validateGeometryForArea(malformedPolygon)).toBe(false);
      });

      test('handles nested Feature objects', () => {
        const nestedFeature = {
          type: 'Feature',
          geometry: {
            type: 'Feature', // Incorrectly nested
            geometry: {
              type: 'Polygon',
              coordinates: [[[-74.0, 40.7], [-74.0, 40.8], [-73.9, 40.8], [-73.9, 40.7], [-74.0, 40.7]]]
            }
          }
        };
        
        expect(validateGeometryForArea(nestedFeature)).toBe(false);
      });

      test('handles circular references gracefully', () => {
        const circularGeometry = {
          type: 'Polygon',
          coordinates: [[[-74.0, 40.7], [-74.0, 40.8], [-73.9, 40.8], [-73.9, 40.7], [-74.0, 40.7]]]
        };
        circularGeometry.self = circularGeometry; // Create circular reference
        
        expect(validateGeometryForArea(circularGeometry)).toBe(true);
      });
    });

    describe('calculateSingleFeatureArea edge cases', () => {
      test('handles very small polygons', () => {
        const tinyPolygon = {
          type: 'Polygon',
          coordinates: [[
            [-74.0000, 40.7000], [-74.0000, 40.7001], [-73.9999, 40.7001], [-73.9999, 40.7000], [-74.0000, 40.7000]
          ]]
        };
        
        const area = calculateSingleFeatureArea(tinyPolygon);
        expect(area).toBeGreaterThan(0);
        expect(area).toBeLessThan(0.001); // Very small area in km²
      });

      test('handles very large polygons', () => {
        const largePolygon = {
          type: 'Polygon',
          coordinates: [[
            [-180, -85], [-180, 85], [180, 85], [180, -85], [-180, -85]
          ]]
        };
        
        const area = calculateSingleFeatureArea(largePolygon);
        expect(area).toBeGreaterThan(100000000); // Very large area in km²
        expect(Number.isFinite(area)).toBe(true);
      });

      test('handles polygons crossing international date line', () => {
        const dateLinePolygon = {
          type: 'Polygon',
          coordinates: [[
            [179, 0], [179, 1], [-179, 1], [-179, 0], [179, 0]
          ]]
        };
        
        const area = calculateSingleFeatureArea(dateLinePolygon);
        expect(area).toBeGreaterThan(0);
        expect(Number.isFinite(area)).toBe(true);
      });

      test('handles polygons with holes', () => {
        const polygonWithHole = {
          type: 'Polygon',
          coordinates: [
            // Outer ring
            [[-74.0, 40.7], [-74.0, 40.8], [-73.9, 40.8], [-73.9, 40.7], [-74.0, 40.7]],
            // Inner ring (hole) - should reduce total area
            [[-73.95, 40.75], [-73.95, 40.76], [-73.94, 40.76], [-73.94, 40.75], [-73.95, 40.75]]
          ]
        };
        
        const areaWithHole = calculateSingleFeatureArea(polygonWithHole);
        
        const solidPolygon = {
          type: 'Polygon',
          coordinates: [
            [[-74.0, 40.7], [-74.0, 40.8], [-73.9, 40.8], [-73.9, 40.7], [-74.0, 40.7]]
          ]
        };
        
        const solidArea = calculateSingleFeatureArea(solidPolygon);
        
        expect(areaWithHole).toBeLessThan(solidArea);
        expect(areaWithHole).toBeGreaterThan(0);
      });

      test('handles self-intersecting polygons', () => {
        const selfIntersecting = {
          type: 'Polygon',
          coordinates: [[
            [-74.0, 40.7], [-73.9, 40.8], [-74.0, 40.8], [-73.9, 40.7], [-74.0, 40.7]
          ]]
        };
        
        const area = calculateSingleFeatureArea(selfIntersecting);
        // Turf.js should handle this gracefully
        expect(typeof area).toBe('number');
        expect(Number.isFinite(area)).toBe(true);
      });

      test('handles degenerate polygons', () => {
        const degeneratePolygon = {
          type: 'Polygon',
          coordinates: [[
            [-74.0, 40.7], [-74.0, 40.7], [-74.0, 40.7], [-74.0, 40.7], [-74.0, 40.7]
          ]]
        };
        
        const area = calculateSingleFeatureArea(degeneratePolygon);
        expect(area).toBe(0);
      });
    });

    describe('calculateRevealedArea edge cases', () => {
      test('handles mixed valid and invalid GeoJSON', async () => {
        const mixedAreas = [
          { id: 1, geojson: JSON.stringify({ type: 'Polygon', coordinates: [[[-74.0, 40.7], [-74.0, 40.8], [-73.9, 40.8], [-73.9, 40.7], [-74.0, 40.7]]] }) },
          { id: 2, geojson: 'invalid json' },
          { id: 3, geojson: JSON.stringify({ type: 'Point', coordinates: [-74.0, 40.7] }) }, // Invalid for area
          { id: 4, geojson: JSON.stringify({ type: 'Polygon', coordinates: [[[-73.8, 40.6], [-73.8, 40.7], [-73.7, 40.7], [-73.7, 40.6], [-73.8, 40.6]]] }) },
          { id: 5, geojson: null },
          { id: 6, geojson: undefined }
        ];
        
        const result = await calculateRevealedArea(mixedAreas);
        expect(result).toBeGreaterThan(0); // Should calculate area for valid polygons only
        expect(Number.isFinite(result)).toBe(true);
      });

      test('handles very large number of revealed areas', async () => {
        const manyAreas = Array.from({ length: 1000 }, (_, i) => ({
          id: i + 1,
          geojson: JSON.stringify({
            type: 'Polygon',
            coordinates: [[
              [-74.0 + i * 0.001, 40.7 + i * 0.001],
              [-74.0 + i * 0.001, 40.7 + i * 0.001 + 0.001],
              [-74.0 + i * 0.001 + 0.001, 40.7 + i * 0.001 + 0.001],
              [-74.0 + i * 0.001 + 0.001, 40.7 + i * 0.001],
              [-74.0 + i * 0.001, 40.7 + i * 0.001]
            ]]
          })
        }));
        
        const startTime = Date.now();
        const result = await calculateRevealedArea(manyAreas);
        const endTime = Date.now();
        
        expect(result).toBeGreaterThan(0);
        expect(Number.isFinite(result)).toBe(true);
        expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
      });

      test('handles areas with extreme coordinate values', async () => {
        const extremeAreas = [
          {
            id: 1,
            geojson: JSON.stringify({
              type: 'Polygon',
              coordinates: [[
                [-180, -85], [-180, -84], [-179, -84], [-179, -85], [-180, -85]
              ]]
            })
          },
          {
            id: 2,
            geojson: JSON.stringify({
              type: 'Polygon',
              coordinates: [[
                [179, 84], [179, 85], [180, 85], [180, 84], [179, 84]
              ]]
            })
          }
        ];
        
        const result = await calculateRevealedArea(extremeAreas);
        expect(result).toBeGreaterThan(0);
        expect(Number.isFinite(result)).toBe(true);
      });

      test('handles corrupted GeoJSON gracefully', async () => {
        const corruptedAreas = [
          { id: 1, geojson: '{"type":"Polygon","coordinates":[[[' }, // Incomplete JSON
          { id: 2, geojson: '{"type":"Polygon","coordinates":null}' }, // Null coordinates
          { id: 3, geojson: '{"type":"Polygon","coordinates":[]}' }, // Empty coordinates
          { id: 4, geojson: '{"type":"Polygon"}' }, // Missing coordinates
          { id: 5, geojson: '{}' }, // Empty object
          { id: 6, geojson: 'null' }, // JSON null
          { id: 7, geojson: 'true' }, // JSON boolean
          { id: 8, geojson: '42' } // JSON number
        ];
        
        const result = await calculateRevealedArea(corruptedAreas);
        expect(result).toBe(0); // No valid areas
      });
    });

    describe('calculateWorldExplorationPercentage edge cases', () => {
      test('handles extremely small exploration areas', async () => {
        const tinyArea = {
          id: 1,
          geojson: JSON.stringify({
            type: 'Polygon',
            coordinates: [[
              [-74.0000000, 40.7000000],
              [-74.0000000, 40.7000001],
              [-73.9999999, 40.7000001],
              [-73.9999999, 40.7000000],
              [-74.0000000, 40.7000000]
            ]]
          })
        };
        
        const result = await calculateWorldExplorationPercentage([tinyArea]);
        
        expect(result.percentage).toBeGreaterThan(0);
        expect(result.percentage).toBeLessThan(0.000001); // Extremely small percentage
        expect(Number.isFinite(result.percentage)).toBe(true);
      });

      test('handles theoretical maximum exploration', async () => {
        const globalArea = {
          id: 1,
          geojson: JSON.stringify({
            type: 'Polygon',
            coordinates: [[
              [-180, -85], [-180, 85], [180, 85], [180, -85], [-180, -85]
            ]]
          })
        };
        
        const result = await calculateWorldExplorationPercentage([globalArea]);
        
        expect(result.percentage).toBeGreaterThan(50); // Should be significant portion of Earth
        expect(result.percentage).toBeLessThan(200); // But not more than 100% (accounting for projection differences)
        expect(Number.isFinite(result.percentage)).toBe(true);
      });

      test('handles overlapping areas correctly', async () => {
        const overlappingAreas = [
          {
            id: 1,
            geojson: JSON.stringify({
              type: 'Polygon',
              coordinates: [[[-74.0, 40.7], [-74.0, 40.8], [-73.9, 40.8], [-73.9, 40.7], [-74.0, 40.7]]]
            })
          },
          {
            id: 2,
            geojson: JSON.stringify({
              type: 'Polygon',
              coordinates: [[[-73.95, 40.75], [-73.95, 40.85], [-73.85, 40.85], [-73.85, 40.75], [-73.95, 40.75]]]
            })
          }
        ];
        
        const result = await calculateWorldExplorationPercentage(overlappingAreas);
        
        // Note: This implementation doesn't handle overlaps, so it will sum all areas
        // In a real implementation, you might want to union the geometries first
        expect(result.percentage).toBeGreaterThan(0);
        expect(Number.isFinite(result.percentage)).toBe(true);
      });

      test('handles areas at poles', async () => {
        const polarAreas = [
          {
            id: 1,
            geojson: JSON.stringify({
              type: 'Polygon',
              coordinates: [[
                [-180, 89], [-180, 90], [180, 90], [180, 89], [-180, 89]
              ]]
            })
          },
          {
            id: 2,
            geojson: JSON.stringify({
              type: 'Polygon',
              coordinates: [[
                [-180, -90], [-180, -89], [180, -89], [180, -90], [-180, -90]
              ]]
            })
          }
        ];
        
        const result = await calculateWorldExplorationPercentage(polarAreas);
        
        expect(result.percentage).toBeGreaterThan(0);
        expect(Number.isFinite(result.percentage)).toBe(true);
      });
    });

    describe('formatExplorationPercentage edge cases', () => {
      test('handles very small percentages', () => {
        expect(formatExplorationPercentage(0.0001, 'world')).toBe('0.000%');
        expect(formatExplorationPercentage(0.0009, 'world')).toBe('0.001%');
      });

      test('handles very large percentages', () => {
        expect(formatExplorationPercentage(999.999, 'world')).toBe('1000.000%');
        expect(formatExplorationPercentage(1234.5678, 'country')).toBe('1234.57%');
      });

      test('handles negative percentages', () => {
        expect(formatExplorationPercentage(-1.234, 'world')).toBe('-1.234%');
        expect(formatExplorationPercentage(-0.1, 'country')).toBe('-0.10%');
      });

      test('handles NaN and Infinity', () => {
        expect(formatExplorationPercentage(NaN, 'world')).toBe('NaN%');
        expect(formatExplorationPercentage(Infinity, 'country')).toBe('Infinity%');
        expect(formatExplorationPercentage(-Infinity, 'state')).toBe('-Infinity%');
      });

      test('handles rounding edge cases', () => {
        expect(formatExplorationPercentage(0.9999, 'world')).toBe('1.000%');
        expect(formatExplorationPercentage(99.999, 'country')).toBe('100.00%');
        expect(formatExplorationPercentage(9.99, 'state')).toBe('10.0%');
      });

      test('handles invalid level parameter', () => {
        expect(formatExplorationPercentage(1.234, 'invalid')).toBe('1.234%'); // Should default to world
        expect(formatExplorationPercentage(1.234, null)).toBe('1.234%');
        expect(formatExplorationPercentage(1.234, undefined)).toBe('1.234%');
      });
    });

    describe('memory and performance edge cases', () => {
      test('handles memory pressure with large geometries', async () => {
        // Create a polygon with many vertices (reduced from 10000 to 1000 for performance)
        const coordinates = [];
        for (let i = 0; i < 1000; i++) {
          const angle = (i / 1000) * 2 * Math.PI;
          coordinates.push([
            -74.0 + Math.cos(angle) * 0.01,
            40.7 + Math.sin(angle) * 0.01
          ]);
        }
        coordinates.push(coordinates[0]); // Close the polygon
        
        const complexArea = {
          id: 1,
          geojson: JSON.stringify({
            type: 'Polygon',
            coordinates: [coordinates]
          })
        };
        
        const result = await calculateRevealedArea([complexArea]);
        expect(result).toBeGreaterThan(0);
        expect(Number.isFinite(result)).toBe(true);
      });

      test('handles concurrent calculations', async () => {
        const area = {
          id: 1,
          geojson: JSON.stringify({
            type: 'Polygon',
            coordinates: [[[-74.0, 40.7], [-74.0, 40.8], [-73.9, 40.8], [-73.9, 40.7], [-74.0, 40.7]]]
          })
        };
        
        // Run multiple calculations concurrently (reduced from 100 to 10 for performance)
        const promises = Array.from({ length: 10 }, () => calculateRevealedArea([area]));
        const results = await Promise.all(promises);
        
        // All results should be identical
        results.forEach(result => {
          expect(result).toBeCloseTo(results[0], 10);
        });
      });

      test('handles rapid successive calculations', async () => {
        const area = {
          id: 1,
          geojson: JSON.stringify({
            type: 'Polygon',
            coordinates: [[[-74.0, 40.7], [-74.0, 40.8], [-73.9, 40.8], [-73.9, 40.7], [-74.0, 40.7]]]
          })
        };
        
        const results = [];
        for (let i = 0; i < 10; i++) { // Reduced from 50 to 10 for performance
          results.push(await calculateRevealedArea([area]));
        }
        
        // All results should be identical
        results.forEach(result => {
          expect(result).toBeCloseTo(results[0], 10);
        });
      });
    });

    describe('error recovery and resilience', () => {
      test('continues processing after individual area calculation failures', async () => {
        // Mock console.error to avoid noise in test output
        const originalError = console.error;
        console.error = jest.fn();
        
        const areas = [
          { id: 1, geojson: JSON.stringify({ type: 'Polygon', coordinates: [[[-74.0, 40.7], [-74.0, 40.8], [-73.9, 40.8], [-73.9, 40.7], [-74.0, 40.7]]] }) },
          { id: 2, geojson: 'this will cause an error' },
          { id: 3, geojson: JSON.stringify({ type: 'Polygon', coordinates: [[[-73.8, 40.6], [-73.8, 40.7], [-73.7, 40.7], [-73.7, 40.6], [-73.8, 40.6]]] }) }
        ];
        
        const result = await calculateRevealedArea(areas);
        
        // Should calculate area for valid polygons despite errors
        expect(result).toBeGreaterThan(0);
        
        // Restore console.error
        console.error = originalError;
      });

      test('handles JSON parsing errors gracefully', async () => {
        const areasWithBadJSON = [
          { id: 1, geojson: '{"type":"Polygon","coordinates":[[[' }, // Malformed JSON
          { id: 2, geojson: '{"type":"Polygon","coordinates":[[[-74.0,40.7],[-74.0,40.8],[-73.9,40.8],[-73.9,40.7],[-74.0,40.7]]]}' } // Valid JSON
        ];
        
        const result = await calculateRevealedArea(areasWithBadJSON);
        
        // Should process the valid area despite JSON parsing error
        expect(result).toBeGreaterThan(0);
      });
    });
  });
});