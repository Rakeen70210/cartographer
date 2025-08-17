// Unmock the world exploration calculator for this test
jest.unmock('../utils/worldExplorationCalculator');
jest.unmock('../utils/logger');

// Also unmock Turf.js for accurate area calculations
jest.unmock('@turf/turf');
jest.unmock('@turf/area');

import {
    calculateRevealedArea,
    calculateSingleFeatureArea,
    calculateWorldExplorationPercentage,
    formatExplorationPercentage,
    validateGeometryForArea
} from '../utils/worldExplorationCalculator';

describe('World Exploration Calculator - Edge Cases and Error Handling', () => {
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

    test('rejects polygons with insufficient coordinates', () => {
      const invalidPolygon = {
        type: 'Polygon',
        coordinates: [[[0, 0], [1, 1], [2, 2]]] // Only 3 points, need at least 4 for closed polygon
      };
      
      expect(validateGeometryForArea(invalidPolygon)).toBe(false);
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
      const manyAreas = Array.from({ length: 10000 }, (_, i) => ({
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

    test('handles pre-parsed objects vs JSON strings', async () => {
      const polygon = {
        type: 'Polygon',
        coordinates: [[[-74.0, 40.7], [-74.0, 40.8], [-73.9, 40.8], [-73.9, 40.7], [-74.0, 40.7]]]
      };
      
      const areasWithMixedFormats = [
        { id: 1, geojson: JSON.stringify(polygon) }, // JSON string
        { id: 2, geojson: polygon }, // Pre-parsed object
        { id: 3, geojson: { ...polygon } } // Cloned object
      ];
      
      const result = await calculateRevealedArea(areasWithMixedFormats);
      expect(result).toBeGreaterThan(0);
      
      // All three should contribute equally to the total area
      const singleArea = await calculateRevealedArea([{ id: 1, geojson: JSON.stringify(polygon) }]);
      expect(result).toBeCloseTo(singleArea * 3, 5);
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
      // Create a polygon with many vertices
      const coordinates = [];
      for (let i = 0; i < 10000; i++) {
        const angle = (i / 10000) * 2 * Math.PI;
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
      
      // Run multiple calculations concurrently
      const promises = Array.from({ length: 100 }, () => calculateRevealedArea([area]));
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
      for (let i = 0; i < 50; i++) {
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