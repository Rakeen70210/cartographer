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

// Mock the database module
jest.mock('../utils/database', () => ({
  getAllLocationGeocodings: jest.fn()
}));

// Mock the logger
jest.mock('../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    success: jest.fn()
  }
}));

describe('GeographicHierarchy', () => {
  // Sample test data
  const sampleLocations = [
    {
      id: 1,
      latitude: 37.7749,
      longitude: -122.4194,
      timestamp: 1640995200000,
      country: 'United States',
      countryCode: 'US',
      state: 'California',
      stateCode: 'CA',
      city: 'San Francisco',
      isGeocoded: true
    },
    {
      id: 2,
      latitude: 37.7849,
      longitude: -122.4094,
      timestamp: 1640995300000,
      country: 'United States',
      countryCode: 'US',
      state: 'California',
      stateCode: 'CA',
      city: 'San Francisco',
      isGeocoded: true
    },
    {
      id: 3,
      latitude: 34.0522,
      longitude: -118.2437,
      timestamp: 1640995400000,
      country: 'United States',
      countryCode: 'US',
      state: 'California',
      stateCode: 'CA',
      city: 'Los Angeles',
      isGeocoded: true
    },
    {
      id: 4,
      latitude: 40.7128,
      longitude: -74.0060,
      timestamp: 1640995500000,
      country: 'United States',
      countryCode: 'US',
      state: 'New York',
      stateCode: 'NY',
      city: 'New York City',
      isGeocoded: true
    },
    {
      id: 5,
      latitude: 43.6532,
      longitude: -79.3832,
      timestamp: 1640995600000,
      country: 'Canada',
      countryCode: 'CA',
      state: 'Ontario',
      stateCode: 'ON',
      city: 'Toronto',
      isGeocoded: true
    }
  ];

  const sampleLocationsWithMissingData = [
    {
      id: 6,
      latitude: 51.5074,
      longitude: -0.1278,
      timestamp: 1640995700000,
      country: 'United Kingdom',
      isGeocoded: true
    },
    {
      id: 7,
      latitude: 48.8566,
      longitude: 2.3522,
      timestamp: 1640995800000,
      isGeocoded: false
    }
  ];

  describe('buildGeographicHierarchy', () => {
    test('should build hierarchy from complete location data', async () => {
      const hierarchy = await buildGeographicHierarchy(sampleLocations);

      expect(hierarchy).toHaveLength(2); // US and Canada
      
      // Check US structure
      const usNode = hierarchy.find(node => node.name === 'United States');
      expect(usNode).toBeDefined();
      expect(usNode.type).toBe('country');
      expect(usNode.code).toBe('US');
      expect(usNode.locationCount).toBe(4);
      expect(usNode.children).toHaveLength(2); // California and New York
      
      // Check California structure
      const caNode = usNode.children.find(node => node.name === 'California');
      expect(caNode).toBeDefined();
      expect(caNode.type).toBe('state');
      expect(caNode.code).toBe('CA');
      expect(caNode.locationCount).toBe(3);
      expect(caNode.children).toHaveLength(2); // San Francisco and Los Angeles
      
      // Check cities
      const sfNode = caNode.children.find(node => node.name === 'San Francisco');
      expect(sfNode).toBeDefined();
      expect(sfNode.type).toBe('city');
      expect(sfNode.locationCount).toBe(2);
      
      const laNode = caNode.children.find(node => node.name === 'Los Angeles');
      expect(laNode).toBeDefined();
      expect(laNode.type).toBe('city');
      expect(laNode.locationCount).toBe(1);
    });

    test('should handle locations with missing geographic data', async () => {
      const hierarchy = await buildGeographicHierarchy(sampleLocationsWithMissingData);

      expect(hierarchy).toHaveLength(1); // Only UK (the ungeocoded location is filtered out)
      
      const ukNode = hierarchy[0];
      expect(ukNode.name).toBe('United Kingdom');
      expect(ukNode.locationCount).toBe(1);
      expect(ukNode.children).toHaveLength(1); // Unknown State
      
      const unknownState = ukNode.children[0];
      expect(unknownState.name).toBe('Unknown State');
      expect(unknownState.children).toHaveLength(1); // Unknown City
    });

    test('should respect maxDepth option', async () => {
      const hierarchy = await buildGeographicHierarchy(sampleLocations, { maxDepth: 2 });

      expect(hierarchy).toHaveLength(2);
      
      const usNode = hierarchy.find(node => node.name === 'United States');
      expect(usNode.children).toBeUndefined(); // No children due to maxDepth = 2
    });

    test('should sort hierarchy by name ascending by default', async () => {
      const hierarchy = await buildGeographicHierarchy(sampleLocations);

      expect(hierarchy[0].name).toBe('Canada');
      expect(hierarchy[1].name).toBe('United States');
    });

    test('should sort hierarchy by location count descending', async () => {
      const hierarchy = await buildGeographicHierarchy(sampleLocations, {
        sortBy: 'locationCount',
        sortOrder: 'desc'
      });

      expect(hierarchy[0].name).toBe('United States'); // 4 locations
      expect(hierarchy[1].name).toBe('Canada'); // 1 location
    });

    test('should handle empty location array', async () => {
      const hierarchy = await buildGeographicHierarchy([]);
      expect(hierarchy).toHaveLength(0);
    });
  });

  describe('calculateExplorationPercentages', () => {
    test('should calculate basic exploration percentages', async () => {
      const hierarchy = await buildGeographicHierarchy(sampleLocations);
      const updatedHierarchy = await calculateExplorationPercentages(hierarchy);

      expect(updatedHierarchy).toHaveLength(2);
      
      const usNode = updatedHierarchy.find(node => node.name === 'United States');
      expect(usNode.explorationPercentage).toBeGreaterThan(0);
      expect(usNode.explorationPercentage).toBeLessThanOrEqual(100);
      
      // Check that children also have percentages
      const caNode = usNode.children.find(node => node.name === 'California');
      expect(caNode.explorationPercentage).toBeGreaterThan(0);
    });

    test('should handle hierarchy with no locations', async () => {
      const emptyHierarchy = [];
      const updatedHierarchy = await calculateExplorationPercentages(emptyHierarchy);
      expect(updatedHierarchy).toHaveLength(0);
    });
  });

  describe('toggleHierarchyNodeExpansion', () => {
    test('should toggle node expansion state', async () => {
      const hierarchy = await buildGeographicHierarchy(sampleLocations);
      const usNode = hierarchy.find(node => node.name === 'United States');
      
      expect(usNode.isExpanded).toBe(false);
      
      const updatedHierarchy = toggleHierarchyNodeExpansion(hierarchy, usNode);
      const updatedUsNode = updatedHierarchy.find(node => node.name === 'United States');
      
      expect(updatedUsNode.isExpanded).toBe(true);
    });

    test('should toggle nested node expansion', async () => {
      const hierarchy = await buildGeographicHierarchy(sampleLocations);
      const usNode = hierarchy.find(node => node.name === 'United States');
      const caNode = usNode.children.find(node => node.name === 'California');
      
      expect(caNode.isExpanded).toBe(false);
      
      const updatedHierarchy = toggleHierarchyNodeExpansion(hierarchy, caNode);
      const updatedUsNode = updatedHierarchy.find(node => node.name === 'United States');
      const updatedCaNode = updatedUsNode.children.find(node => node.name === 'California');
      
      expect(updatedCaNode.isExpanded).toBe(true);
    });
  });

  describe('expandHierarchyToDepth', () => {
    test('should expand hierarchy to specified depth', async () => {
      const hierarchy = await buildGeographicHierarchy(sampleLocations);
      const expandedHierarchy = expandHierarchyToDepth(hierarchy, 2);

      // Countries should be expanded (depth 0)
      expect(expandedHierarchy[0].isExpanded).toBe(true);
      
      // States should be expanded (depth 1)
      const usNode = expandedHierarchy.find(node => node.name === 'United States');
      const caNode = usNode.children.find(node => node.name === 'California');
      expect(caNode.isExpanded).toBe(true);
      
      // Cities should not be expanded (depth 2, beyond maxDepth)
      const sfNode = caNode.children.find(node => node.name === 'San Francisco');
      expect(sfNode.isExpanded).toBe(false);
    });

    test('should handle depth 0 (no expansion)', async () => {
      const hierarchy = await buildGeographicHierarchy(sampleLocations);
      const expandedHierarchy = expandHierarchyToDepth(hierarchy, 0);

      expect(expandedHierarchy[0].isExpanded).toBe(false);
    });
  });

  describe('collapseAllHierarchy', () => {
    test('should collapse all nodes in hierarchy', async () => {
      const hierarchy = await buildGeographicHierarchy(sampleLocations);
      const expandedHierarchy = expandHierarchyToDepth(hierarchy, 3);
      const collapsedHierarchy = collapseAllHierarchy(expandedHierarchy);

      const checkAllCollapsed = (nodes) => {
        for (const node of nodes) {
          expect(node.isExpanded).toBe(false);
          if (node.children) {
            checkAllCollapsed(node.children);
          }
        }
      };

      checkAllCollapsed(collapsedHierarchy);
    });
  });

  describe('findHierarchyNode', () => {
    test('should find node by name and type', async () => {
      const hierarchy = await buildGeographicHierarchy(sampleLocations);
      
      const usNode = findHierarchyNode(hierarchy, 'United States', 'country');
      expect(usNode).toBeDefined();
      expect(usNode.name).toBe('United States');
      expect(usNode.type).toBe('country');
      
      const caNode = findHierarchyNode(hierarchy, 'California', 'state');
      expect(caNode).toBeDefined();
      expect(caNode.name).toBe('California');
      expect(caNode.type).toBe('state');
      
      const sfNode = findHierarchyNode(hierarchy, 'San Francisco', 'city');
      expect(sfNode).toBeDefined();
      expect(sfNode.name).toBe('San Francisco');
      expect(sfNode.type).toBe('city');
    });

    test('should return null for non-existent node', async () => {
      const hierarchy = await buildGeographicHierarchy(sampleLocations);
      
      const nonExistentNode = findHierarchyNode(hierarchy, 'Non-existent', 'country');
      expect(nonExistentNode).toBeNull();
    });
  });

  describe('getHierarchyLevelCounts', () => {
    test('should count nodes at each hierarchy level', async () => {
      const hierarchy = await buildGeographicHierarchy(sampleLocations);
      const counts = getHierarchyLevelCounts(hierarchy);

      expect(counts.countries).toBe(2); // US and Canada
      expect(counts.states).toBe(3); // California, New York, Ontario
      expect(counts.cities).toBe(4); // San Francisco, Los Angeles, New York City, Toronto
    });

    test('should handle empty hierarchy', () => {
      const counts = getHierarchyLevelCounts([]);
      expect(counts.countries).toBe(0);
      expect(counts.states).toBe(0);
      expect(counts.cities).toBe(0);
    });
  });

  describe('convertToLocationWithGeography', () => {
    test('should convert database geocoding data to LocationWithGeography format', async () => {
      const { getAllLocationGeocodings } = require('../utils/database');
      
      const mockGeocodingData = [
        {
          id: 1,
          latitude: 37.7749,
          longitude: -122.4194,
          country: 'United States',
          state: 'California',
          city: 'San Francisco',
          timestamp: 1640995200000
        },
        {
          id: 2,
          latitude: 40.7128,
          longitude: -74.0060,
          country: 'United States',
          state: 'New York',
          city: null,
          timestamp: 1640995300000
        }
      ];

      getAllLocationGeocodings.mockResolvedValue(mockGeocodingData);

      const result = await convertToLocationWithGeography();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 1,
        latitude: 37.7749,
        longitude: -122.4194,
        timestamp: 1640995200000,
        country: 'United States',
        countryCode: undefined,
        state: 'California',
        stateCode: undefined,
        city: 'San Francisco',
        isGeocoded: true
      });
      expect(result[1].isGeocoded).toBe(true); // Has country and state
    });

    test('should handle database errors gracefully', async () => {
      const { getAllLocationGeocodings } = require('../utils/database');
      getAllLocationGeocodings.mockRejectedValue(new Error('Database error'));

      const result = await convertToLocationWithGeography();
      expect(result).toEqual([]);
    });
  });
});