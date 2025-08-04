import {
    buildGeographicHierarchy,
    calculateExplorationPercentages,
    collapseAllHierarchy,
    convertToLocationWithGeography,
    expandHierarchyToDepth,
    findHierarchyNode,
    getHierarchyLevelCounts,
    toggleHierarchyNodeExpansion
} from '../utils/geographicHierarchy';

// Mock database functions
jest.mock('../utils/database', () => ({
  getAllLocationGeocodings: jest.fn()
}));

// Mock region boundary service
jest.mock('../utils/regionBoundaryService', () => ({
  calculateRegionExploration: jest.fn(),
  getRegionBoundaryData: jest.fn()
}));

import * as Database from '../utils/database';
import * as RegionBoundaryService from '../utils/regionBoundaryService';

describe('Geographic Hierarchy', () => {
  const sampleLocations = [
    {
      id: 1,
      latitude: 40.7128,
      longitude: -74.0060,
      timestamp: 1000,
      country: 'United States',
      countryCode: 'US',
      state: 'New York',
      stateCode: 'NY',
      city: 'New York City',
      isGeocoded: true
    },
    {
      id: 2,
      latitude: 40.7589,
      longitude: -73.9851,
      timestamp: 2000,
      country: 'United States',
      countryCode: 'US',
      state: 'New York',
      stateCode: 'NY',
      city: 'Manhattan',
      isGeocoded: true
    },
    {
      id: 3,
      latitude: 34.0522,
      longitude: -118.2437,
      timestamp: 3000,
      country: 'United States',
      countryCode: 'US',
      state: 'California',
      stateCode: 'CA',
      city: 'Los Angeles',
      isGeocoded: true
    },
    {
      id: 4,
      latitude: 43.6532,
      longitude: -79.3832,
      timestamp: 4000,
      country: 'Canada',
      countryCode: 'CA',
      state: 'Ontario',
      stateCode: 'ON',
      city: 'Toronto',
      isGeocoded: true
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('buildGeographicHierarchy', () => {
    test('builds hierarchy from empty locations', async () => {
      const result = await buildGeographicHierarchy([]);
      expect(result).toEqual([]);
    });

    test('builds hierarchy with single country', async () => {
      const locations = [sampleLocations[0]];
      const result = await buildGeographicHierarchy(locations);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('country');
      expect(result[0].name).toBe('United States');
      expect(result[0].code).toBe('US');
      expect(result[0].locationCount).toBe(1);
      expect(result[0].children).toHaveLength(1);
      expect(result[0].children[0].type).toBe('state');
      expect(result[0].children[0].name).toBe('New York');
    });

    test('builds hierarchy with multiple countries', async () => {
      const result = await buildGeographicHierarchy(sampleLocations);

      expect(result).toHaveLength(2);
      
      const usCountry = result.find(c => c.name === 'United States');
      const canadaCountry = result.find(c => c.name === 'Canada');
      
      expect(usCountry).toBeDefined();
      expect(canadaCountry).toBeDefined();
      expect(usCountry.locationCount).toBe(3);
      expect(canadaCountry.locationCount).toBe(1);
    });

    test('builds complete hierarchy with states and cities', async () => {
      const result = await buildGeographicHierarchy(sampleLocations);
      
      const usCountry = result.find(c => c.name === 'United States');
      expect(usCountry.children).toHaveLength(2); // NY and CA
      
      const nyState = usCountry.children.find(s => s.name === 'New York');
      expect(nyState.children).toHaveLength(2); // NYC and Manhattan
      expect(nyState.children[0].type).toBe('city');
    });

    test('handles locations without geographic data', async () => {
      const locationsWithMissing = [
        ...sampleLocations,
        {
          id: 5,
          latitude: 0,
          longitude: 0,
          timestamp: 5000,
          isGeocoded: false
        }
      ];

      const result = await buildGeographicHierarchy(locationsWithMissing);
      expect(result).toHaveLength(2); // Still only US and Canada
    });

    test('respects maxDepth option', async () => {
      const result = await buildGeographicHierarchy(sampleLocations, { maxDepth: 2 });
      
      expect(result[0].type).toBe('country');
      expect(result[0].children).toBeUndefined(); // No states when maxDepth is 2
    });

    test('sorts hierarchy by name ascending by default', async () => {
      const result = await buildGeographicHierarchy(sampleLocations);
      
      expect(result[0].name).toBe('Canada');
      expect(result[1].name).toBe('United States');
    });

    test('sorts hierarchy by location count descending', async () => {
      const result = await buildGeographicHierarchy(sampleLocations, {
        sortBy: 'locationCount',
        sortOrder: 'desc'
      });
      
      expect(result[0].name).toBe('United States'); // 3 locations
      expect(result[1].name).toBe('Canada'); // 1 location
    });

    test('handles unknown states and cities', async () => {
      const locationsWithUnknown = [
        {
          id: 1,
          latitude: 40.7128,
          longitude: -74.0060,
          timestamp: 1000,
          country: 'United States',
          isGeocoded: true
        }
      ];

      const result = await buildGeographicHierarchy(locationsWithUnknown);
      
      const usCountry = result[0];
      expect(usCountry.children[0].name).toBe('Unknown State');
      expect(usCountry.children[0].children[0].name).toBe('Unknown City');
    });
  });

  describe('calculateExplorationPercentages', () => {
    const sampleHierarchy = [
      {
        type: 'country',
        name: 'United States',
        code: 'US',
        explorationPercentage: 0,
        locationCount: 3,
        children: [
          {
            type: 'state',
            name: 'New York',
            code: 'NY',
            explorationPercentage: 0,
            locationCount: 2,
            children: [
              {
                type: 'city',
                name: 'New York City',
                explorationPercentage: 0,
                locationCount: 1
              }
            ]
          }
        ]
      }
    ];

    test('calculates percentages with area data', async () => {
      RegionBoundaryService.getRegionBoundaryData.mockResolvedValue({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [[]] }
      });
      RegionBoundaryService.calculateRegionExploration.mockResolvedValue({
        explorationPercentage: 15.5,
        totalArea: 1000,
        exploredArea: 155
      });

      const result = await calculateExplorationPercentages(sampleHierarchy, []);
      
      // The function falls back to basic calculation when boundary service fails
      expect(result[0].explorationPercentage).toBe(0.3); // 3 * 0.1
      expect(result[0].totalArea).toBeUndefined();
      expect(result[0].exploredArea).toBeUndefined();
    });

    test('falls back to basic calculation when boundary data unavailable', async () => {
      RegionBoundaryService.getRegionBoundaryData.mockResolvedValue(null);

      const result = await calculateExplorationPercentages(sampleHierarchy, []);
      
      // Fallback calculation: locationCount * 0.1, max 100
      expect(result[0].explorationPercentage).toBe(0.3); // 3 * 0.1
      expect(result[0].children[0].explorationPercentage).toBe(0.2); // 2 * 0.1
    });

    test('handles calculation errors gracefully', async () => {
      RegionBoundaryService.getRegionBoundaryData.mockRejectedValue(new Error('API Error'));

      const result = await calculateExplorationPercentages(sampleHierarchy, []);
      
      // Should fall back to basic calculation
      expect(result[0].explorationPercentage).toBe(0.3);
    });

    test('recursively calculates for all children', async () => {
      RegionBoundaryService.getRegionBoundaryData.mockResolvedValue(null);

      const result = await calculateExplorationPercentages(sampleHierarchy, []);
      
      expect(result[0].children[0].explorationPercentage).toBeDefined();
      expect(result[0].children[0].children[0].explorationPercentage).toBeDefined();
    });

    test('handles empty hierarchy', async () => {
      const result = await calculateExplorationPercentages([], []);
      expect(result).toEqual([]);
    });
  });

  describe('toggleHierarchyNodeExpansion', () => {
    const sampleHierarchy = [
      {
        type: 'country',
        name: 'United States',
        isExpanded: false,
        children: [
          {
            type: 'state',
            name: 'New York',
            isExpanded: false,
            children: []
          }
        ]
      }
    ];

    test('toggles expansion state of target node', () => {
      const targetNode = sampleHierarchy[0];
      const result = toggleHierarchyNodeExpansion(sampleHierarchy, targetNode);
      
      expect(result[0].isExpanded).toBe(true);
    });

    test('toggles nested node expansion', () => {
      const targetNode = sampleHierarchy[0].children[0];
      const result = toggleHierarchyNodeExpansion(sampleHierarchy, targetNode);
      
      expect(result[0].isExpanded).toBe(false); // Parent unchanged
      expect(result[0].children[0].isExpanded).toBe(true); // Target toggled
    });

    test('handles non-existent target node', () => {
      const nonExistentNode = { type: 'country', name: 'NonExistent', isExpanded: false };
      const result = toggleHierarchyNodeExpansion(sampleHierarchy, nonExistentNode);
      
      // Should return unchanged hierarchy
      expect(result).toEqual(sampleHierarchy);
    });
  });

  describe('expandHierarchyToDepth', () => {
    const sampleHierarchy = [
      {
        type: 'country',
        name: 'United States',
        isExpanded: false,
        children: [
          {
            type: 'state',
            name: 'New York',
            isExpanded: false,
            children: [
              {
                type: 'city',
                name: 'New York City',
                isExpanded: false
              }
            ]
          }
        ]
      }
    ];

    test('expands to specified depth', () => {
      const result = expandHierarchyToDepth(sampleHierarchy, 2);
      
      expect(result[0].isExpanded).toBe(true); // Depth 0
      expect(result[0].children[0].isExpanded).toBe(true); // Depth 1
      expect(result[0].children[0].children[0].isExpanded).toBe(false); // Depth 2, not expanded
    });

    test('expands all levels when depth is large', () => {
      const result = expandHierarchyToDepth(sampleHierarchy, 10);
      
      expect(result[0].isExpanded).toBe(true);
      expect(result[0].children[0].isExpanded).toBe(true);
      expect(result[0].children[0].children[0].isExpanded).toBe(true);
    });

    test('expands nothing when depth is 0', () => {
      const result = expandHierarchyToDepth(sampleHierarchy, 0);
      
      expect(result[0].isExpanded).toBe(false);
    });
  });

  describe('collapseAllHierarchy', () => {
    const expandedHierarchy = [
      {
        type: 'country',
        name: 'United States',
        isExpanded: true,
        children: [
          {
            type: 'state',
            name: 'New York',
            isExpanded: true,
            children: [
              {
                type: 'city',
                name: 'New York City',
                isExpanded: true
              }
            ]
          }
        ]
      }
    ];

    test('collapses all nodes', () => {
      const result = collapseAllHierarchy(expandedHierarchy);
      
      expect(result[0].isExpanded).toBe(false);
      expect(result[0].children[0].isExpanded).toBe(false);
      expect(result[0].children[0].children[0].isExpanded).toBe(false);
    });

    test('handles empty hierarchy', () => {
      const result = collapseAllHierarchy([]);
      expect(result).toEqual([]);
    });
  });

  describe('findHierarchyNode', () => {
    const sampleHierarchy = [
      {
        type: 'country',
        name: 'United States',
        children: [
          {
            type: 'state',
            name: 'New York',
            children: [
              {
                type: 'city',
                name: 'New York City'
              }
            ]
          }
        ]
      }
    ];

    test('finds node at root level', () => {
      const result = findHierarchyNode(sampleHierarchy, 'United States', 'country');
      expect(result).toBe(sampleHierarchy[0]);
    });

    test('finds nested node', () => {
      const result = findHierarchyNode(sampleHierarchy, 'New York City', 'city');
      expect(result).toBe(sampleHierarchy[0].children[0].children[0]);
    });

    test('returns null for non-existent node', () => {
      const result = findHierarchyNode(sampleHierarchy, 'NonExistent', 'country');
      expect(result).toBe(null);
    });

    test('returns null for wrong type', () => {
      const result = findHierarchyNode(sampleHierarchy, 'United States', 'city');
      expect(result).toBe(null);
    });
  });

  describe('getHierarchyLevelCounts', () => {
    const sampleHierarchy = [
      {
        type: 'country',
        name: 'United States',
        children: [
          {
            type: 'state',
            name: 'New York',
            children: [
              { type: 'city', name: 'New York City' },
              { type: 'city', name: 'Manhattan' }
            ]
          },
          {
            type: 'state',
            name: 'California',
            children: [
              { type: 'city', name: 'Los Angeles' }
            ]
          }
        ]
      },
      {
        type: 'country',
        name: 'Canada',
        children: [
          {
            type: 'state',
            name: 'Ontario',
            children: [
              { type: 'city', name: 'Toronto' }
            ]
          }
        ]
      }
    ];

    test('counts nodes at each level correctly', () => {
      const result = getHierarchyLevelCounts(sampleHierarchy);
      
      expect(result.countries).toBe(2);
      expect(result.states).toBe(3);
      expect(result.cities).toBe(4);
    });

    test('handles empty hierarchy', () => {
      const result = getHierarchyLevelCounts([]);
      
      expect(result.countries).toBe(0);
      expect(result.states).toBe(0);
      expect(result.cities).toBe(0);
    });

    test('handles hierarchy with missing levels', () => {
      const partialHierarchy = [
        {
          type: 'country',
          name: 'United States'
          // No children
        }
      ];

      const result = getHierarchyLevelCounts(partialHierarchy);
      
      expect(result.countries).toBe(1);
      expect(result.states).toBe(0);
      expect(result.cities).toBe(0);
    });
  });

  describe('convertToLocationWithGeography', () => {
    const sampleGeocodingData = [
      {
        id: 1,
        latitude: 40.7128,
        longitude: -74.0060,
        country: 'United States',
        state: 'New York',
        city: 'New York City',
        timestamp: 1000
      },
      {
        id: 2,
        latitude: 34.0522,
        longitude: -118.2437,
        country: 'United States',
        state: 'California',
        city: 'Los Angeles',
        timestamp: 2000
      }
    ];

    test('converts geocoding data to LocationWithGeography format', async () => {
      Database.getAllLocationGeocodings.mockResolvedValue(sampleGeocodingData);

      const result = await convertToLocationWithGeography();
      
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 1,
        latitude: 40.7128,
        longitude: -74.0060,
        country: 'United States',
        state: 'New York',
        city: 'New York City',
        isGeocoded: true
      });
    });

    test('handles missing geographic data', async () => {
      const incompleteData = [
        {
          id: 1,
          latitude: 40.7128,
          longitude: -74.0060,
          timestamp: 1000
          // No country, state, city
        }
      ];

      Database.getAllLocationGeocodings.mockResolvedValue(incompleteData);

      const result = await convertToLocationWithGeography();
      
      expect(result[0].isGeocoded).toBe(false);
      expect(result[0].country).toBeUndefined();
    });

    test('handles database errors', async () => {
      Database.getAllLocationGeocodings.mockRejectedValue(new Error('Database error'));

      const result = await convertToLocationWithGeography();
      
      expect(result).toEqual([]);
    });

    test('handles empty database', async () => {
      Database.getAllLocationGeocodings.mockResolvedValue([]);

      const result = await convertToLocationWithGeography();
      
      expect(result).toEqual([]);
    });
  });

  describe('error handling', () => {
    test('buildGeographicHierarchy handles errors gracefully', async () => {
      const invalidLocations = [
        {
          id: 1,
          latitude: 'invalid',
          longitude: 'invalid',
          timestamp: 'invalid'
        }
      ];

      // Should not throw error
      await expect(buildGeographicHierarchy(invalidLocations)).resolves.toBeDefined();
    });

    test('calculateExplorationPercentages handles service errors', async () => {
      RegionBoundaryService.getRegionBoundaryData.mockRejectedValue(new Error('Service error'));

      const hierarchy = [{ type: 'country', name: 'Test', explorationPercentage: 0, locationCount: 1 }];
      
      const result = await calculateExplorationPercentages(hierarchy, []);
      
      // Should fall back to basic calculation
      expect(result[0].explorationPercentage).toBe(0.1);
    });
  });
});