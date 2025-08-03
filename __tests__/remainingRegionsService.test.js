import {
    calculateRemainingRegions,
    calculateRemainingRegionsWithinVisited,
    calculateTotalAvailableRegions,
    calculateVisitedRegions,
    formatPercentage,
    formatRegionCount,
    formatVisitedVsRemaining,
    getRegionCountsFromHierarchy,
    getRegionExplorationSummary,
    getRemainingRegionsData,
    validateRegionCounts
} from '../utils/remainingRegionsService';

// Mock dependencies
jest.mock('../utils/geographicApiService', () => ({
  getTotalRegionCounts: jest.fn()
}));

jest.mock('../utils/geographicHierarchy', () => ({
  convertToLocationWithGeography: jest.fn(),
  getHierarchyLevelCounts: jest.fn()
}));

jest.mock('../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

describe('RemainingRegionsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateTotalAvailableRegions', () => {
    test('should return total region counts from API', async () => {
      const { getTotalRegionCounts } = require('../utils/geographicApiService');
      const mockTotalCounts = {
        countries: 195,
        states: 3142,
        cities: 10000
      };

      getTotalRegionCounts.mockResolvedValueOnce(mockTotalCounts);

      const result = await calculateTotalAvailableRegions();

      expect(result).toEqual(mockTotalCounts);
      expect(getTotalRegionCounts).toHaveBeenCalledTimes(1);
    });

    test('should return fallback values when API fails', async () => {
      const { getTotalRegionCounts } = require('../utils/geographicApiService');
      getTotalRegionCounts.mockRejectedValueOnce(new Error('API error'));

      const result = await calculateTotalAvailableRegions();

      expect(result).toEqual({
        countries: 195,
        states: 3142,
        cities: 10000
      });
    });
  });

  describe('calculateVisitedRegions', () => {
    test('should calculate unique visited regions correctly', async () => {
      const { convertToLocationWithGeography } = require('../utils/geographicHierarchy');
      const mockLocations = [
        { country: 'United States', state: 'California', city: 'San Francisco' },
        { country: 'United States', state: 'California', city: 'Los Angeles' },
        { country: 'United States', state: 'New York', city: 'New York City' },
        { country: 'Canada', state: 'Ontario', city: 'Toronto' },
        { country: 'Canada', state: 'Ontario', city: 'Ottawa' }
      ];

      convertToLocationWithGeography.mockResolvedValueOnce(mockLocations);

      const result = await calculateVisitedRegions();

      expect(result).toEqual({
        countries: 2, // United States, Canada
        states: 3, // California, New York, Ontario (with country prefixes)
        cities: 5 // All unique cities with full paths
      });
    });

    test('should handle locations with missing geographic data', async () => {
      const { convertToLocationWithGeography } = require('../utils/geographicHierarchy');
      const mockLocations = [
        { country: 'United States', state: null, city: null },
        { country: null, state: 'Unknown State', city: 'Unknown City' },
        { country: 'Canada', state: 'Ontario', city: null }
      ];

      convertToLocationWithGeography.mockResolvedValueOnce(mockLocations);

      const result = await calculateVisitedRegions();

      expect(result).toEqual({
        countries: 2, // United States, Canada
        states: 2, // Unknown State, Canada:Ontario
        cities: 1 // Unknown City
      });
    });

    test('should return zero counts when no location data available', async () => {
      const { convertToLocationWithGeography } = require('../utils/geographicHierarchy');
      convertToLocationWithGeography.mockResolvedValueOnce([]);

      const result = await calculateVisitedRegions();

      expect(result).toEqual({
        countries: 0,
        states: 0,
        cities: 0
      });
    });

    test('should return zero counts on error', async () => {
      const { convertToLocationWithGeography } = require('../utils/geographicHierarchy');
      convertToLocationWithGeography.mockRejectedValueOnce(new Error('Database error'));

      const result = await calculateVisitedRegions();

      expect(result).toEqual({
        countries: 0,
        states: 0,
        cities: 0
      });
    });
  });

  describe('calculateRemainingRegions', () => {
    test('should calculate remaining regions correctly', async () => {
      const visited = { countries: 5, states: 20, cities: 100 };
      const total = { countries: 195, states: 3142, cities: 10000 };

      const result = await calculateRemainingRegions(visited, total);

      expect(result).toEqual({
        countries: 190, // 195 - 5
        states: 3122, // 3142 - 20
        cities: 9900 // 10000 - 100
      });
    });

    test('should not return negative values', async () => {
      const visited = { countries: 200, states: 5000, cities: 15000 };
      const total = { countries: 195, states: 3142, cities: 10000 };

      const result = await calculateRemainingRegions(visited, total);

      expect(result).toEqual({
        countries: 0, // Max(0, 195 - 200)
        states: 0, // Max(0, 3142 - 5000)
        cities: 0 // Max(0, 10000 - 15000)
      });
    });

    test('should fetch data when not provided', async () => {
      const { getTotalRegionCounts } = require('../utils/geographicApiService');
      const { convertToLocationWithGeography } = require('../utils/geographicHierarchy');

      getTotalRegionCounts.mockResolvedValueOnce({
        countries: 195,
        states: 3142,
        cities: 10000
      });

      convertToLocationWithGeography.mockResolvedValueOnce([
        { country: 'United States', state: 'California', city: 'San Francisco' }
      ]);

      const result = await calculateRemainingRegions();

      expect(result.countries).toBe(194); // 195 - 1
      expect(getTotalRegionCounts).toHaveBeenCalledTimes(1);
      expect(convertToLocationWithGeography).toHaveBeenCalledTimes(1);
    });
  });

  describe('calculateRemainingRegionsWithinVisited', () => {
    test('should calculate remaining regions within visited countries/states', async () => {
      const { convertToLocationWithGeography } = require('../utils/geographicHierarchy');
      const mockLocations = [
        { country: 'United States', state: 'California', city: 'San Francisco' },
        { country: 'United States', state: 'New York', city: 'New York City' },
        { country: 'Canada', state: 'Ontario', city: 'Toronto' }
      ];

      convertToLocationWithGeography.mockResolvedValueOnce(mockLocations);

      const result = await calculateRemainingRegionsWithinVisited();

      expect(result.visitedCountries).toEqual(['United States', 'Canada']);
      expect(result.totalStatesInVisitedCountries).toBe(40); // 2 countries * 20 avg states
      expect(result.visitedStatesInVisitedCountries).toBe(3); // California, New York, Ontario
      expect(result.remainingStatesInVisitedCountries).toBe(37); // 40 - 3
      expect(result.totalCitiesInVisitedStates).toBe(150); // 3 states * 50 avg cities
      expect(result.visitedCitiesInVisitedStates).toBe(3); // San Francisco, NYC, Toronto
      expect(result.remainingCitiesInVisitedStates).toBe(147); // 150 - 3
    });

    test('should handle empty location data', async () => {
      const { convertToLocationWithGeography } = require('../utils/geographicHierarchy');
      convertToLocationWithGeography.mockResolvedValueOnce([]);

      const result = await calculateRemainingRegionsWithinVisited();

      expect(result).toEqual({
        visitedCountries: [],
        totalStatesInVisitedCountries: 0,
        visitedStatesInVisitedCountries: 0,
        remainingStatesInVisitedCountries: 0,
        totalCitiesInVisitedStates: 0,
        visitedCitiesInVisitedStates: 0,
        remainingCitiesInVisitedStates: 0
      });
    });
  });

  describe('getRemainingRegionsData', () => {
    test('should return comprehensive remaining regions data', async () => {
      const { getTotalRegionCounts } = require('../utils/geographicApiService');
      const { convertToLocationWithGeography } = require('../utils/geographicHierarchy');

      getTotalRegionCounts.mockResolvedValueOnce({
        countries: 195,
        states: 3142,
        cities: 10000
      });

      convertToLocationWithGeography.mockResolvedValueOnce([
        { country: 'United States', state: 'California', city: 'San Francisco' },
        { country: 'Canada', state: 'Ontario', city: 'Toronto' }
      ]);

      const result = await getRemainingRegionsData();

      expect(result.visited.countries).toBe(2);
      expect(result.total.countries).toBe(195);
      expect(result.remaining.countries).toBe(193);
      expect(result.percentageVisited.countries).toBeCloseTo(1.03, 2); // 2/195 * 100
    });

    test('should return fallback data on error', async () => {
      const { getTotalRegionCounts } = require('../utils/geographicApiService');
      getTotalRegionCounts.mockRejectedValueOnce(new Error('API error'));

      const result = await getRemainingRegionsData();

      expect(result.visited).toEqual({ countries: 0, states: 0, cities: 0 });
      expect(result.total).toEqual({ countries: 195, states: 3142, cities: 10000 });
      expect(result.remaining).toEqual({ countries: 195, states: 3142, cities: 10000 });
      expect(result.percentageVisited).toEqual({ countries: 0, states: 0, cities: 0 });
    });
  });

  describe('formatRegionCount', () => {
    test('should format singular counts correctly', () => {
      expect(formatRegionCount(1, 'country')).toBe('1 country');
      expect(formatRegionCount(1, 'state')).toBe('1 state');
      expect(formatRegionCount(1, 'city')).toBe('1 city');
    });

    test('should format plural counts correctly', () => {
      expect(formatRegionCount(5, 'country')).toBe('5 countries');
      expect(formatRegionCount(10, 'state')).toBe('10 states');
      expect(formatRegionCount(100, 'city')).toBe('100 cities');
    });

    test('should format zero counts correctly', () => {
      expect(formatRegionCount(0, 'country')).toBe('0 countries');
      expect(formatRegionCount(0, 'state')).toBe('0 states');
      expect(formatRegionCount(0, 'city')).toBe('0 cities');
    });

    test('should format large numbers with locale formatting', () => {
      expect(formatRegionCount(1000, 'country')).toBe('1,000 countries');
      expect(formatRegionCount(1234567, 'city')).toBe('1,234,567 cities');
    });

    test('should handle already plural forms', () => {
      expect(formatRegionCount(5, 'countries')).toBe('5 countries');
      expect(formatRegionCount(1, 'countries')).toBe('1 country');
    });
  });

  describe('formatVisitedVsRemaining', () => {
    test('should format visited vs remaining correctly', () => {
      const result = formatVisitedVsRemaining(5, 195, 'country');
      expect(result).toBe('5 countries of 195 visited, 190 countries remaining');
    });

    test('should handle singular visited count', () => {
      const result = formatVisitedVsRemaining(1, 195, 'country');
      expect(result).toBe('1 country of 195 visited, 194 countries remaining');
    });

    test('should handle zero visited count', () => {
      const result = formatVisitedVsRemaining(0, 195, 'country');
      expect(result).toBe('0 countries of 195 visited, 195 countries remaining');
    });

    test('should handle all visited', () => {
      const result = formatVisitedVsRemaining(195, 195, 'country');
      expect(result).toBe('195 countries of 195 visited, 0 countries remaining');
    });
  });

  describe('formatPercentage', () => {
    test('should format percentages with default precision', () => {
      expect(formatPercentage(50.123)).toBe('50.1%');
      expect(formatPercentage(0.567)).toBe('0.6%');
      expect(formatPercentage(99.99)).toBe('100.0%');
    });

    test('should format zero percentage', () => {
      expect(formatPercentage(0)).toBe('0%');
    });

    test('should format very small percentages', () => {
      expect(formatPercentage(0.05)).toBe('<0.1%');
      expect(formatPercentage(0.09)).toBe('<0.1%');
    });

    test('should format 100% correctly', () => {
      expect(formatPercentage(100)).toBe('100%');
      expect(formatPercentage(100.5)).toBe('100%');
    });

    test('should respect custom precision', () => {
      expect(formatPercentage(50.123, 2)).toBe('50.12%');
      expect(formatPercentage(50.123, 0)).toBe('50%');
    });
  });

  describe('getRegionExplorationSummary', () => {
    test('should return summary for users with exploration data', async () => {
      const { getTotalRegionCounts } = require('../utils/geographicApiService');
      const { convertToLocationWithGeography } = require('../utils/geographicHierarchy');

      getTotalRegionCounts.mockResolvedValueOnce({
        countries: 195,
        states: 3142,
        cities: 10000
      });

      convertToLocationWithGeography.mockResolvedValueOnce([
        { country: 'United States', state: 'California', city: 'San Francisco' },
        { country: 'Canada', state: 'Ontario', city: 'Toronto' }
      ]);

      const result = await getRegionExplorationSummary();

      expect(result.hasData).toBe(true);
      expect(result.summary).toContain('1.0%'); // 2/195 countries
      expect(result.details).toHaveLength(3);
      expect(result.details[0]).toContain('Countries:');
      expect(result.details[1]).toContain('States/Provinces:');
      expect(result.details[2]).toContain('Cities:');
    });

    test('should return encouragement message for new users', async () => {
      const { getTotalRegionCounts } = require('../utils/geographicApiService');
      const { convertToLocationWithGeography } = require('../utils/geographicHierarchy');

      getTotalRegionCounts.mockResolvedValueOnce({
        countries: 195,
        states: 3142,
        cities: 10000
      });

      convertToLocationWithGeography.mockResolvedValueOnce([]);

      const result = await getRegionExplorationSummary();

      expect(result.hasData).toBe(false);
      expect(result.summary).toBe('Start exploring to discover new regions!');
      expect(result.details).toContain('Visit new locations to begin tracking your geographic exploration');
    });

    test('should handle errors gracefully', async () => {
      const { getTotalRegionCounts } = require('../utils/geographicApiService');
      const { convertToLocationWithGeography } = require('../utils/geographicHierarchy');
      
      getTotalRegionCounts.mockRejectedValueOnce(new Error('API error'));
      convertToLocationWithGeography.mockRejectedValueOnce(new Error('Database error'));

      const result = await getRegionExplorationSummary();

      // When both API and database fail, getRemainingRegionsData returns fallback data
      // with 0 visited regions, so it shows the "start exploring" message
      expect(result.hasData).toBe(false);
      expect(result.summary).toBe('Start exploring to discover new regions!');
      expect(result.details).toContain('Visit new locations to begin tracking your geographic exploration');
    });
  });

  describe('validateRegionCounts', () => {
    test('should validate correct region counts', () => {
      const validCounts = { countries: 5, states: 20, cities: 100 };
      expect(validateRegionCounts(validCounts)).toBe(true);
    });

    test('should reject negative counts', () => {
      const invalidCounts = { countries: -1, states: 20, cities: 100 };
      expect(validateRegionCounts(invalidCounts)).toBe(false);
    });

    test('should reject NaN values', () => {
      const invalidCounts = { countries: NaN, states: 20, cities: 100 };
      expect(validateRegionCounts(invalidCounts)).toBe(false);
    });

    test('should reject non-number values', () => {
      const invalidCounts = { countries: '5', states: 20, cities: 100 };
      expect(validateRegionCounts(invalidCounts)).toBe(false);
    });

    test('should accept zero counts', () => {
      const validCounts = { countries: 0, states: 0, cities: 0 };
      expect(validateRegionCounts(validCounts)).toBe(true);
    });
  });

  describe('getRegionCountsFromHierarchy', () => {
    test('should calculate region counts from location data', async () => {
      const { convertToLocationWithGeography } = require('../utils/geographicHierarchy');
      const mockLocations = [
        { country: 'United States', state: 'California', city: 'San Francisco' },
        { country: 'United States', state: 'New York', city: 'New York City' },
        { country: 'Canada', state: 'Ontario', city: 'Toronto' }
      ];

      convertToLocationWithGeography.mockResolvedValueOnce(mockLocations);

      const result = await getRegionCountsFromHierarchy();

      expect(result).toEqual({
        countries: 2, // United States, Canada
        states: 3, // California, New York, Ontario (with country prefixes)
        cities: 3 // All cities with full paths
      });
    });

    test('should return zero counts on error', async () => {
      const { convertToLocationWithGeography } = require('../utils/geographicHierarchy');
      convertToLocationWithGeography.mockRejectedValueOnce(new Error('Database error'));

      const result = await getRegionCountsFromHierarchy();

      expect(result).toEqual({
        countries: 0,
        states: 0,
        cities: 0
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle undefined location properties gracefully', async () => {
      const { convertToLocationWithGeography } = require('../utils/geographicHierarchy');
      const mockLocations = [
        { country: undefined, state: undefined, city: undefined },
        { country: '', state: '', city: '' },
        { country: null, state: null, city: null }
      ];

      convertToLocationWithGeography.mockResolvedValueOnce(mockLocations);

      const result = await calculateVisitedRegions();

      expect(result).toEqual({
        countries: 0,
        states: 0,
        cities: 0
      });
    });

    test('should handle duplicate region names in different contexts', async () => {
      const { convertToLocationWithGeography } = require('../utils/geographicHierarchy');
      const mockLocations = [
        { country: 'United States', state: 'Georgia', city: 'Atlanta' },
        { country: 'Georgia', state: 'Tbilisi', city: 'Tbilisi' } // Country Georgia
      ];

      convertToLocationWithGeography.mockResolvedValueOnce(mockLocations);

      const result = await calculateVisitedRegions();

      expect(result.countries).toBe(2); // Should distinguish US state Georgia from country Georgia
      expect(result.states).toBe(2); // Should have unique state keys
    });

    test('should handle very large numbers correctly', async () => {
      const visited = { countries: 1000000, states: 2000000, cities: 3000000 };
      const total = { countries: 1000001, states: 2000001, cities: 3000001 };

      const result = await calculateRemainingRegions(visited, total);

      expect(result).toEqual({
        countries: 1,
        states: 1,
        cities: 1
      });
    });
  });
});