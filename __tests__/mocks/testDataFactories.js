/**
 * Standardized test data factories for consistent mock data across all test files
 * This ensures all tests use the same data structures and values
 */

// Mock location data factory
export const createMockLocation = (overrides = {}) => ({
  id: 1,
  latitude: 37.7749,
  longitude: -122.4194,
  timestamp: Date.now(),
  ...overrides
});

export const createMockLocations = (count = 2, baseOverrides = {}) => {
  return Array.from({ length: count }, (_, index) => 
    createMockLocation({
      id: index + 1,
      latitude: 37.7749 + (index * 0.01),
      longitude: -122.4194 + (index * 0.01),
      timestamp: Date.now() - ((count - index) * 1000),
      ...baseOverrides
    })
  );
};

// Mock location with geography data factory
export const createMockLocationWithGeography = (overrides = {}) => ({
  ...createMockLocation(overrides),
  country: 'United States',
  state: 'California',
  city: 'San Francisco',
  isGeocoded: true,
  ...overrides
});

export const createMockLocationsWithGeography = (count = 2, baseOverrides = {}) => {
  const countries = ['United States', 'Canada', 'Mexico', 'United Kingdom', 'France'];
  const states = ['California', 'New York', 'Texas', 'Ontario', 'Quebec'];
  const cities = ['San Francisco', 'New York City', 'Los Angeles', 'Toronto', 'Montreal'];
  
  return Array.from({ length: count }, (_, index) => 
    createMockLocationWithGeography({
      id: index + 1,
      latitude: 37.7749 + (index * 0.01),
      longitude: -122.4194 + (index * 0.01),
      timestamp: Date.now() - ((count - index) * 1000),
      country: countries[index % countries.length],
      state: states[index % states.length],
      city: cities[index % cities.length],
      ...baseOverrides
    })
  );
};

// Mock revealed area data factory
export const createMockRevealedArea = (overrides = {}) => {
  const defaultPolygon = {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [-122.4194, 37.7749],
        [-122.4194, 37.7849],
        [-122.4094, 37.7849],
        [-122.4094, 37.7749],
        [-122.4194, 37.7749]
      ]]
    },
    properties: {}
  };

  return {
    id: 1,
    geojson: JSON.stringify(defaultPolygon),
    ...overrides
  };
};

export const createMockRevealedAreas = (count = 2, baseOverrides = {}) => {
  return Array.from({ length: count }, (_, index) => {
    const centerLat = 37.7749 + (index * 0.01);
    const centerLon = -122.4194 + (index * 0.01);
    const radius = 0.001;
    
    const polygon = {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [centerLon - radius, centerLat - radius],
          [centerLon + radius, centerLat - radius],
          [centerLon + radius, centerLat + radius],
          [centerLon - radius, centerLat + radius],
          [centerLon - radius, centerLat - radius]
        ]]
      },
      properties: {}
    };
    
    return createMockRevealedArea({
      id: index + 1,
      geojson: JSON.stringify(polygon),
      ...baseOverrides
    });
  });
};

// Mock statistics data factory
export const createMockStatisticsData = (overrides = {}) => ({
  totalDistance: { miles: 0, kilometers: 0 },
  worldExploration: { 
    percentage: 0, 
    totalAreaKm2: 510072000, 
    exploredAreaKm2: 0 
  },
  uniqueRegions: { countries: 0, states: 0, cities: 0 },
  remainingRegions: { countries: 195, states: 3142, cities: 10000 },
  hierarchicalBreakdown: [],
  lastUpdated: Date.now(),
  isOfflineData: false,
  dataSource: 'online',
  networkStatus: { 
    isConnected: true, 
    connectionType: 'wifi',
    lastOnlineTime: Date.now()
  },
  ...overrides
});

// Mock network state factory
export const createMockNetworkState = (overrides = {}) => ({
  isConnected: true,
  isInternetReachable: true,
  type: 'wifi',
  details: {},
  ...overrides
});

// Mock hierarchical data factory
export const createMockHierarchicalData = (overrides = []) => ([
  {
    id: 'us',
    type: 'country',
    name: 'United States',
    code: 'US',
    explorationPercentage: 2.5,
    isExpanded: false,
    children: [
      {
        id: 'us-ca',
        type: 'state',
        name: 'California',
        code: 'CA',
        explorationPercentage: 15.2,
        isExpanded: false,
        children: [
          {
            id: 'us-ca-sf',
            type: 'city',
            name: 'San Francisco',
            explorationPercentage: 45.8,
            isExpanded: false,
            children: []
          }
        ]
      }
    ]
  },
  ...overrides
]);

// Mock remaining regions data factory
export const createMockRemainingRegionsData = (overrides = {}) => ({
  visited: { countries: 0, states: 0, cities: 0 },
  total: { countries: 195, states: 3142, cities: 10000 },
  remaining: { countries: 195, states: 3142, cities: 10000 },
  percentageVisited: { countries: 0, states: 0, cities: 0 },
  ...overrides
});

// Mock cache entry factory
export const createMockCacheEntry = (key, value, overrides = {}) => ({
  id: Date.now(),
  cache_key: key,
  cache_value: typeof value === 'string' ? value : JSON.stringify(value),
  timestamp: Date.now(),
  ...overrides
});

// Mock offline capabilities factory
export const createMockOfflineCapabilities = (overrides = {}) => ({
  canCalculateDistance: true,
  canCalculateWorldExploration: true,
  canCalculateBasicRegions: true,
  canCalculateHierarchy: true,
  hasLocationData: true,
  hasRevealedAreaData: true,
  hasGeocodingData: true,
  ...overrides
});

// Mock geometry validation test cases
export const createValidPolygon = () => ({
  type: 'Polygon',
  coordinates: [[
    [-74.0, 40.7], [-74.0, 40.8], [-73.9, 40.8], [-73.9, 40.7], [-74.0, 40.7]
  ]]
});

export const createValidMultiPolygon = () => ({
  type: 'MultiPolygon',
  coordinates: [
    [[[-74.0, 40.7], [-74.0, 40.8], [-73.9, 40.8], [-73.9, 40.7], [-74.0, 40.7]]],
    [[[-73.8, 40.6], [-73.8, 40.7], [-73.7, 40.7], [-73.7, 40.6], [-73.8, 40.6]]]
  ]
});

export const createValidFeature = () => ({
  type: 'Feature',
  geometry: createValidPolygon(),
  properties: {}
});

export const createInvalidGeometry = () => ({
  type: 'Point',
  coordinates: [-74.0, 40.7]
});

// Mock error scenarios
export const createNetworkError = (message = 'Network error') => new Error(message);
export const createDatabaseError = (message = 'Database error') => new Error(message);
export const createTimeoutError = (message = 'Timeout error') => new Error(message);

// Mock performance test data generators
export const generateLargeLocationSet = (count = 50000) => {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    latitude: 37.7749 + (Math.random() - 0.5) * 0.1,
    longitude: -122.4194 + (Math.random() - 0.5) * 0.1,
    timestamp: Date.now() - (count - i) * 1000 * 60
  }));
};

export const generateLargeRevealedAreaSet = (count = 10000) => {
  return Array.from({ length: count }, (_, i) => {
    const centerLat = 37.7749 + (Math.random() - 0.5) * 0.1;
    const centerLon = -122.4194 + (Math.random() - 0.5) * 0.1;
    const radius = 0.001;
    
    const polygon = {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [centerLon - radius, centerLat - radius],
          [centerLon + radius, centerLat - radius],
          [centerLon + radius, centerLat + radius],
          [centerLon - radius, centerLat + radius],
          [centerLon - radius, centerLat - radius]
        ]]
      },
      properties: {}
    };
    
    return {
      id: i + 1,
      geojson: JSON.stringify(polygon)
    };
  });
};

// Performance test data generators (consolidated from performance-monitor.js)
export const generatePerformanceTestData = {
  // Generate test data for different performance scenarios
  smallDataset: () => ({
    locations: generateLargeLocationSet(100),
    revealedAreas: generateLargeRevealedAreaSet(50),
    expectedTime: 100 // ms
  }),
  
  mediumDataset: () => ({
    locations: generateLargeLocationSet(1000),
    revealedAreas: generateLargeRevealedAreaSet(500),
    expectedTime: 1000 // ms
  }),
  
  largeDataset: () => ({
    locations: generateLargeLocationSet(10000),
    revealedAreas: generateLargeRevealedAreaSet(5000),
    expectedTime: 5000 // ms
  }),

  // Generate test data with specific characteristics for edge cases
  edgeCaseData: () => ({
    // Locations at extreme coordinates
    extremeLocations: [
      { id: 1, latitude: 89.9, longitude: 179.9, timestamp: Date.now() },
      { id: 2, latitude: -89.9, longitude: -179.9, timestamp: Date.now() },
      { id: 3, latitude: 0, longitude: 0, timestamp: Date.now() }
    ],
    
    // Very small revealed areas
    tinyAreas: Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      geojson: JSON.stringify({
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [0.0001 * i, 0.0001 * i],
            [0.0001 * i + 0.00001, 0.0001 * i],
            [0.0001 * i + 0.00001, 0.0001 * i + 0.00001],
            [0.0001 * i, 0.0001 * i + 0.00001],
            [0.0001 * i, 0.0001 * i]
          ]]
        },
        properties: {}
      })
    })),
    
    // Complex polygons with many vertices
    complexPolygons: Array.from({ length: 5 }, (_, i) => {
      const vertices = 100; // Many vertices
      const centerLat = 37.7749 + i * 0.01;
      const centerLon = -122.4194 + i * 0.01;
      const radius = 0.001;
      
      const coordinates = [];
      for (let j = 0; j <= vertices; j++) {
        const angle = (j / vertices) * 2 * Math.PI;
        coordinates.push([
          centerLon + radius * Math.cos(angle),
          centerLat + radius * Math.sin(angle)
        ]);
      }
      
      return {
        id: i + 1,
        geojson: JSON.stringify({
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [coordinates]
          },
          properties: {}
        })
      };
    })
  })
};

// Test data validation utilities (consolidated from various test files)
export const validateTestDataStructure = {
  location: (location) => {
    return location &&
           typeof location.id === 'number' &&
           typeof location.latitude === 'number' &&
           typeof location.longitude === 'number' &&
           typeof location.timestamp === 'number' &&
           location.latitude >= -90 && location.latitude <= 90 &&
           location.longitude >= -180 && location.longitude <= 180 &&
           !isNaN(location.latitude) && !isNaN(location.longitude);
  },

  revealedArea: (area) => {
    try {
      const geojson = typeof area.geojson === 'string' ? JSON.parse(area.geojson) : area.geojson;
      return area &&
             typeof area.id === 'number' &&
             geojson &&
             geojson.type === 'Feature' &&
             geojson.geometry &&
             (geojson.geometry.type === 'Polygon' || geojson.geometry.type === 'MultiPolygon');
    } catch {
      return false;
    }
  },

  statistics: (stats) => {
    return stats &&
           stats.totalDistance &&
           typeof stats.totalDistance.miles === 'number' &&
           typeof stats.totalDistance.kilometers === 'number' &&
           stats.worldExploration &&
           typeof stats.worldExploration.percentage === 'number' &&
           stats.uniqueRegions &&
           typeof stats.uniqueRegions.countries === 'number';
  }
};