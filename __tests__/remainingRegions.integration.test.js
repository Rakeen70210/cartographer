import {
    calculateTotalAvailableRegions,
    calculateVisitedRegions,
    formatVisitedVsRemaining,
    getRemainingRegionsData
} from '../utils/remainingRegionsService';

// Mock dependencies for integration test
jest.mock('../utils/geographicApiService', () => ({
  getTotalRegionCounts: jest.fn()
}));

jest.mock('../utils/geographicHierarchy', () => ({
  convertToLocationWithGeography: jest.fn()
}));

jest.mock('../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

describe('RemainingRegions Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should provide complete remaining regions workflow', async () => {
    const { getTotalRegionCounts } = require('../utils/geographicApiService');
    const { convertToLocationWithGeography } = require('../utils/geographicHierarchy');

    const mockTotalData = {
      countries: 195,
      states: 3142,
      cities: 10000
    };

    const mockLocationData = [
      { country: 'United States', state: 'California', city: 'San Francisco' },
      { country: 'United States', state: 'California', city: 'Los Angeles' },
      { country: 'United States', state: 'New York', city: 'New York City' },
      { country: 'Canada', state: 'Ontario', city: 'Toronto' },
      { country: 'United Kingdom', state: 'England', city: 'London' }
    ];

    // Mock with consistent data for multiple calls
    getTotalRegionCounts.mockResolvedValue(mockTotalData);
    convertToLocationWithGeography.mockResolvedValue(mockLocationData);

    // Test the complete workflow
    const totalRegions = await calculateTotalAvailableRegions();
    const visitedRegions = await calculateVisitedRegions();
    const comprehensiveData = await getRemainingRegionsData();

    // Verify total regions
    expect(totalRegions).toEqual(mockTotalData);

    // Verify visited regions calculation
    expect(visitedRegions.countries).toBe(3); // US, Canada, UK
    expect(visitedRegions.states).toBe(4); // US:California, US:New York, Canada:Ontario, UK:England
    expect(visitedRegions.cities).toBe(5); // All cities

    // Verify comprehensive data structure
    expect(comprehensiveData.visited).toEqual(visitedRegions);
    expect(comprehensiveData.total).toEqual(totalRegions);
    expect(comprehensiveData.remaining.countries).toBe(192); // 195 - 3
    expect(comprehensiveData.percentageVisited.countries).toBeCloseTo(1.54, 2); // 3/195 * 100

    // Test formatting functions
    const countryFormat = formatVisitedVsRemaining(
      visitedRegions.countries,
      totalRegions.countries,
      'country'
    );
    expect(countryFormat).toBe('3 countries of 195 visited, 192 countries remaining');
  });

  test('should handle realistic exploration scenarios', async () => {
    const { getTotalRegionCounts } = require('../utils/geographicApiService');
    const { convertToLocationWithGeography } = require('../utils/geographicHierarchy');

    // Mock world traveler data
    getTotalRegionCounts.mockResolvedValueOnce({
      countries: 195,
      states: 3142,
      cities: 10000
    });

    // Simulate someone who has traveled extensively
    const worldTravelerLocations = [];
    const countries = ['United States', 'Canada', 'United Kingdom', 'France', 'Germany', 'Japan', 'Australia'];
    const statesPerCountry = { 'United States': ['California', 'New York', 'Texas'], 'Canada': ['Ontario', 'Quebec'] };
    const citiesPerState = { 'California': ['San Francisco', 'Los Angeles'], 'New York': ['New York City'], 'Ontario': ['Toronto', 'Ottawa'] };

    // Generate realistic location data
    countries.forEach(country => {
      const states = statesPerCountry[country] || ['Capital Region'];
      states.forEach(state => {
        const cities = citiesPerState[state] || ['Capital City'];
        cities.forEach(city => {
          worldTravelerLocations.push({ country, state, city });
        });
      });
    });

    convertToLocationWithGeography.mockResolvedValueOnce(worldTravelerLocations);

    const data = await getRemainingRegionsData();

    // Verify the calculations make sense for a world traveler
    expect(data.visited.countries).toBe(7); // 7 countries visited
    expect(data.remaining.countries).toBe(188); // 195 - 7
    expect(data.percentageVisited.countries).toBeCloseTo(3.59, 2); // 7/195 * 100

    // Verify that visited counts are reasonable
    expect(data.visited.states).toBeGreaterThan(0);
    expect(data.visited.cities).toBeGreaterThan(0);
    expect(data.remaining.states).toBeLessThan(data.total.states);
    expect(data.remaining.cities).toBeLessThan(data.total.cities);
  });

  test('should handle edge case of no exploration data', async () => {
    const { getTotalRegionCounts } = require('../utils/geographicApiService');
    const { convertToLocationWithGeography } = require('../utils/geographicHierarchy');

    getTotalRegionCounts.mockResolvedValueOnce({
      countries: 195,
      states: 3142,
      cities: 10000
    });

    convertToLocationWithGeography.mockResolvedValueOnce([]);

    const data = await getRemainingRegionsData();

    // Verify new user scenario
    expect(data.visited).toEqual({ countries: 0, states: 0, cities: 0 });
    expect(data.remaining).toEqual(data.total);
    expect(data.percentageVisited).toEqual({ countries: 0, states: 0, cities: 0 });
  });

  test('should handle duplicate region names correctly', async () => {
    const { getTotalRegionCounts } = require('../utils/geographicApiService');
    const { convertToLocationWithGeography } = require('../utils/geographicHierarchy');

    getTotalRegionCounts.mockResolvedValueOnce({
      countries: 195,
      states: 3142,
      cities: 10000
    });

    // Test locations with duplicate names in different contexts
    convertToLocationWithGeography.mockResolvedValueOnce([
      { country: 'United States', state: 'Georgia', city: 'Atlanta' },
      { country: 'Georgia', state: 'Tbilisi', city: 'Tbilisi' }, // Country Georgia
      { country: 'United States', state: 'Washington', city: 'Seattle' },
      { country: 'United Kingdom', state: 'England', city: 'Washington' } // City Washington in UK
    ]);

    const visitedRegions = await calculateVisitedRegions();

    // Should correctly distinguish between different contexts
    expect(visitedRegions.countries).toBe(3); // US, Georgia (country), UK
    expect(visitedRegions.states).toBe(4); // US:Georgia, Georgia:Tbilisi, US:Washington, UK:England
    expect(visitedRegions.cities).toBe(4); // All cities should be unique with their full paths
  });

  test('should maintain data consistency across multiple calls', async () => {
    const { getTotalRegionCounts } = require('../utils/geographicApiService');
    const { convertToLocationWithGeography } = require('../utils/geographicHierarchy');

    const mockTotalData = { countries: 195, states: 3142, cities: 10000 };
    const mockLocationData = [
      { country: 'United States', state: 'California', city: 'San Francisco' },
      { country: 'Canada', state: 'Ontario', city: 'Toronto' }
    ];

    getTotalRegionCounts.mockResolvedValue(mockTotalData);
    convertToLocationWithGeography.mockResolvedValue(mockLocationData);

    // Call multiple times to ensure consistency
    const [data1, data2, data3] = await Promise.all([
      getRemainingRegionsData(),
      getRemainingRegionsData(),
      getRemainingRegionsData()
    ]);

    // All calls should return identical data
    expect(data1).toEqual(data2);
    expect(data2).toEqual(data3);

    // Verify the math is consistent
    expect(data1.visited.countries + data1.remaining.countries).toBe(data1.total.countries);
    expect(data1.visited.states + data1.remaining.states).toBe(data1.total.states);
    expect(data1.visited.cities + data1.remaining.cities).toBe(data1.total.cities);
  });
});