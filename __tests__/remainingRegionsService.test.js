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
  convertToLocationWithGeography: jest.fn()
}));

import * as GeographicApiService from '../utils/geographicApiService';
import * as GeographicHierarchy from '../utils/geographicHierarchy';

describe('Remaining Regions Service', () => {
  const sampleLocationData = [
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

  const sampleTotalCounts = {
    countries: 195,
    states: 3142,
    cities: 10000
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateTotalAvailableRegions', () => {
    test('returns total region counts from API', async () => {
      GeographicApiService.getTotalRegionCounts.mockResolvedValue(sampleTotalCounts);

      const result = await calculateTotalAvailableRegions();

      expect(result).toEqual(sampleTotalCounts);
      expect(GeographicApiService.getTotalRegionCounts).toHaveBeenCalled();
    });

    test('returns fallback counts when API fails', async () => {
      GeographicApiService.getTotalRegionCounts.mockRejectedValue(new Error('API Error'));

      const result = await calculateTotalAvailableRegions();

      expect(result).toEqual({
        countries: 195,
        states: 3142,
        cities: 10000
      });
    });

    test('handles API timeout gracefully', async () => {
      GeographicApiService.getTotalRegionCounts.mockImplementation(
        () => new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 50)) // Reduced delay
      );

      const result = await calculateTotalAvailableRegions();

      expect(result.countries).toBe(195);
      expect(result.states).toBe(3142);
      expect(result.cities).toBe(10000);
    });
  });

  describe('calculateVisitedRegions', () => {
    test('calculates unique visited regions correctly', async () => {
      GeographicHierarchy.convertToLocationWithGeography.mockResolvedValue(sampleLocationData);

      const result = await calculateVisitedRegions();

      expect(result.countries).toBe(2); // US and Canada
      expect(result.states).toBe(3); // NY, CA, ON
      expect(result.cities).toBe(4); // NYC, Manhattan, LA, Toronto
    });

    test('handles duplicate countries correctly', async () => {
      const duplicateCountryData = [
        ...sampleLocationData,
        {
          id: 5,
          latitude: 41.8781,
          longitude: -87.6298,
          timestamp: 5000,
          country: 'United States', // Duplicate country
          state: 'Illinois',
          city: 'Chicago',
          isGeocoded: true
        }
      ];

      GeographicHierarchy.convertToLocationWithGeography.mockResolvedValue(duplicateCountryData);

      const result = await calculateVisitedRegions();

      expect(result.countries).toBe(2); // Still only US and Canada
      expect(result.states).toBe(4); // NY, CA, ON, IL
      expect(result.cities).toBe(5); // NYC, Manhattan, LA, Toronto, Chicago
    });

    test('handles locations without geographic data', async () => {
      const incompleteData = [
        {
          id: 1,
          latitude: 40.7128,
          longitude: -74.0060,
          timestamp: 1000,
          country: 'United States',
          state: 'New York',
          // No city
          isGeocoded: true
        },
        {
          id: 2,
          latitude: 34.0522,
          longitude: -118.2437,
          timestamp: 2000,
          // No geographic data
          isGeocoded: false
        }
      ];

      GeographicHierarchy.convertToLocationWithGeography.mockResolvedValue(incompleteData);

      const result = await calculateVisitedRegions();

      expect(result.countries).toBe(1);
      expect(result.states).toBe(1);
      expect(result.cities).toBe(0);
    });

    test('handles empty location data', async () => {
      GeographicHierarchy.convertToLocationWithGeography.mockResolvedValue([]);

      const result = await calculateVisitedRegions();

      expect(result.countries).toBe(0);
      expect(result.states).toBe(0);
      expect(result.cities).toBe(0);
    });

    test('handles database errors gracefully', async () => {
      GeographicHierarchy.convertToLocationWithGeography.mockRejectedValue(new Error('Database error'));

      const result = await calculateVisitedRegions();

      expect(result.countries).toBe(0);
      expect(result.states).toBe(0);
      expect(result.cities).toBe(0);
    });

    test('creates unique keys for states and cities', async () => {
      const ambiguousData = [
        {
          id: 1,
          latitude: 32.7767,
          longitude: -96.7970,
          timestamp: 1000,
          country: 'United States',
          state: 'Georgia', // State named Georgia
          city: 'Dallas',
          isGeocoded: true
        },
        {
          id: 2,
          latitude: 41.7151,
          longitude: 44.8271,
          timestamp: 2000,
          country: 'Georgia', // Country named Georgia
          state: 'Tbilisi',
          city: 'Tbilisi',
          isGeocoded: true
        }
      ];

      GeographicHierarchy.convertToLocationWithGeography.mockResolvedValue(ambiguousData);

      const result = await calculateVisitedRegions();

      expect(result.countries).toBe(2); // US and Georgia (country)
      expect(result.states).toBe(2); // Should distinguish between US:Georgia and Georgia:Tbilisi
      expect(result.cities).toBe(2); // Dallas and Tbilisi
    });
  });

  describe('calculateRemainingRegions', () => {
    test('calculates remaining regions correctly', async () => {
      const visited = { countries: 2, states: 3, cities: 4 };
      const total = { countries: 195, states: 3142, cities: 10000 };

      const result = await calculateRemainingRegions(visited, total);

      expect(result.countries).toBe(193); // 195 - 2
      expect(result.states).toBe(3139); // 3142 - 3
      expect(result.cities).toBe(9996); // 10000 - 4
    });

    test('handles negative results gracefully', async () => {
      const visited = { countries: 200, states: 5000, cities: 15000 };
      const total = { countries: 195, states: 3142, cities: 10000 };

      const result = await calculateRemainingRegions(visited, total);

      expect(result.countries).toBe(0);
      expect(result.states).toBe(0);
      expect(result.cities).toBe(0);
    });

    test('fetches data when not provided', async () => {
      GeographicHierarchy.convertToLocationWithGeography.mockResolvedValue(sampleLocationData);
      GeographicApiService.getTotalRegionCounts.mockResolvedValue(sampleTotalCounts);

      const result = await calculateRemainingRegions();

      expect(result.countries).toBe(193); // 195 - 2
      expect(GeographicHierarchy.convertToLocationWithGeography).toHaveBeenCalled();
      expect(GeographicApiService.getTotalRegionCounts).toHaveBeenCalled();
    });

    test('handles calculation errors', async () => {
      GeographicHierarchy.convertToLocationWithGeography.mockRejectedValue(new Error('Error'));
      GeographicApiService.getTotalRegionCounts.mockRejectedValue(new Error('API Error'));

      const result = await calculateRemainingRegions();

      expect(result.countries).toBe(195); // Falls back to total - 0 visited
      expect(result.states).toBe(3142);
      expect(result.cities).toBe(10000);
    });
  });

  describe('calculateRemainingRegionsWithinVisited', () => {
    test('calculates remaining regions within visited countries', async () => {
      GeographicHierarchy.convertToLocationWithGeography.mockResolvedValue(sampleLocationData);

      const result = await calculateRemainingRegionsWithinVisited();

      expect(result.visitedCountries).toEqual(['United States', 'Canada']);
      expect(result.totalStatesInVisitedCountries).toBe(40); // 2 countries * 20 avg states
      expect(result.visitedStatesInVisitedCountries).toBe(3); // NY, CA, ON
      expect(result.remainingStatesInVisitedCountries).toBe(37); // 40 - 3
    });

    test('calculates cities within visited states', async () => {
      GeographicHierarchy.convertToLocationWithGeography.mockResolvedValue(sampleLocationData);

      const result = await calculateRemainingRegionsWithinVisited();

      expect(result.totalCitiesInVisitedStates).toBe(150); // 3 states * 50 avg cities
      expect(result.visitedCitiesInVisitedStates).toBe(4); // NYC, Manhattan, LA, Toronto
      expect(result.remainingCitiesInVisitedStates).toBe(146); // 150 - 4
    });

    test('handles empty location data', async () => {
      GeographicHierarchy.convertToLocationWithGeography.mockResolvedValue([]);

      const result = await calculateRemainingRegionsWithinVisited();

      expect(result.visitedCountries).toEqual([]);
      expect(result.totalStatesInVisitedCountries).toBe(0);
      expect(result.visitedStatesInVisitedCountries).toBe(0);
      expect(result.remainingStatesInVisitedCountries).toBe(0);
    });

    test('handles database errors', async () => {
      GeographicHierarchy.convertToLocationWithGeography.mockRejectedValue(new Error('Database error'));

      const result = await calculateRemainingRegionsWithinVisited();

      expect(result.visitedCountries).toEqual([]);
      expect(result.totalStatesInVisitedCountries).toBe(0);
    });

    test('prevents negative remaining counts', async () => {
      const manyLocationsData = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        latitude: 40 + i * 0.01,
        longitude: -74 + i * 0.01,
        timestamp: 1000 + i,
        country: 'United States',
        state: `State${i}`,
        city: `City${i}`,
        isGeocoded: true
      }));

      GeographicHierarchy.convertToLocationWithGeography.mockResolvedValue(manyLocationsData);

      const result = await calculateRemainingRegionsWithinVisited();

      expect(result.remainingStatesInVisitedCountries).toBeGreaterThanOrEqual(0);
      expect(result.remainingCitiesInVisitedStates).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getRemainingRegionsData', () => {
    test('returns comprehensive remaining regions data', async () => {
      GeographicHierarchy.convertToLocationWithGeography.mockResolvedValue(sampleLocationData);
      GeographicApiService.getTotalRegionCounts.mockResolvedValue(sampleTotalCounts);

      const result = await getRemainingRegionsData();

      expect(result.visited.countries).toBe(2);
      expect(result.total.countries).toBe(195);
      expect(result.remaining.countries).toBe(193);
      expect(result.percentageVisited.countries).toBeCloseTo(1.026, 2); // 2/195 * 100
    });

    test('calculates percentages correctly', async () => {
      GeographicHierarchy.convertToLocationWithGeography.mockResolvedValue(sampleLocationData);
      GeographicApiService.getTotalRegionCounts.mockResolvedValue(sampleTotalCounts);

      const result = await getRemainingRegionsData();

      expect(result.percentageVisited.countries).toBeCloseTo(1.026, 2);
      expect(result.percentageVisited.states).toBeCloseTo(0.095, 2); // 3/3142 * 100
      expect(result.percentageVisited.cities).toBeCloseTo(0.04, 2); // 4/10000 * 100
    });

    test('handles zero total counts', async () => {
      GeographicHierarchy.convertToLocationWithGeography.mockResolvedValue(sampleLocationData);
      GeographicApiService.getTotalRegionCounts.mockResolvedValue({
        countries: 0,
        states: 0,
        cities: 0
      });

      const result = await getRemainingRegionsData();

      expect(result.percentageVisited.countries).toBe(0);
      expect(result.percentageVisited.states).toBe(0);
      expect(result.percentageVisited.cities).toBe(0);
    });

    test('handles errors gracefully', async () => {
      GeographicHierarchy.convertToLocationWithGeography.mockRejectedValue(new Error('Error'));
      GeographicApiService.getTotalRegionCounts.mockRejectedValue(new Error('API Error'));

      const result = await getRemainingRegionsData();

      expect(result.visited.countries).toBe(0);
      expect(result.total.countries).toBe(195); // Fallback values
      expect(result.remaining.countries).toBe(195);
    });
  });

  describe('formatRegionCount', () => {
    test('formats zero counts correctly', () => {
      expect(formatRegionCount(0, 'country')).toBe('0 countries');
      expect(formatRegionCount(0, 'state')).toBe('0 states');
      expect(formatRegionCount(0, 'city')).toBe('0 cities');
    });

    test('formats singular counts correctly', () => {
      expect(formatRegionCount(1, 'country')).toBe('1 country');
      expect(formatRegionCount(1, 'state')).toBe('1 state');
      expect(formatRegionCount(1, 'city')).toBe('1 city');
    });

    test('formats plural counts correctly', () => {
      expect(formatRegionCount(5, 'country')).toBe('5 countries');
      expect(formatRegionCount(10, 'state')).toBe('10 states');
      expect(formatRegionCount(25, 'city')).toBe('25 cities');
    });

    test('formats large numbers with locale separators', () => {
      expect(formatRegionCount(1234, 'country')).toBe('1,234 countries');
      expect(formatRegionCount(5678, 'state')).toBe('5,678 states');
      expect(formatRegionCount(9999, 'city')).toBe('9,999 cities');
    });

    test('handles already plural input types', () => {
      expect(formatRegionCount(1, 'countries')).toBe('1 country');
      expect(formatRegionCount(5, 'countries')).toBe('5 countries');
      expect(formatRegionCount(1, 'states')).toBe('1 state');
      expect(formatRegionCount(5, 'states')).toBe('5 states');
      expect(formatRegionCount(1, 'cities')).toBe('1 city');
      expect(formatRegionCount(5, 'cities')).toBe('5 cities');
    });
  });

  describe('formatVisitedVsRemaining', () => {
    test('formats visited vs remaining correctly', () => {
      const result = formatVisitedVsRemaining(5, 195, 'country');
      expect(result).toBe('5 countries of 195 visited, 190 countries remaining');
    });

    test('handles singular visited count', () => {
      const result = formatVisitedVsRemaining(1, 195, 'country');
      expect(result).toBe('1 country of 195 visited, 194 countries remaining');
    });

    test('handles zero visited count', () => {
      const result = formatVisitedVsRemaining(0, 195, 'country');
      expect(result).toBe('0 countries of 195 visited, 195 countries remaining');
    });

    test('handles all visited', () => {
      const result = formatVisitedVsRemaining(195, 195, 'country');
      expect(result).toBe('195 countries of 195 visited, 0 countries remaining');
    });

    test('handles large numbers with formatting', () => {
      const result = formatVisitedVsRemaining(1234, 5678, 'state');
      expect(result).toBe('1,234 states of 5,678 visited, 4,444 states remaining');
    });

    test('prevents negative remaining counts', () => {
      const result = formatVisitedVsRemaining(200, 195, 'country');
      expect(result).toBe('200 countries of 195 visited, 0 countries remaining');
    });
  });

  describe('formatPercentage', () => {
    test('formats zero percentage', () => {
      expect(formatPercentage(0)).toBe('0%');
      expect(formatPercentage(0, 2)).toBe('0%');
    });

    test('formats small percentages', () => {
      expect(formatPercentage(0.05, 1)).toBe('<0.1%');
      expect(formatPercentage(0.001, 2)).toBe('<0.1%');
    });

    test('formats normal percentages with specified precision', () => {
      expect(formatPercentage(1.234, 1)).toBe('1.2%');
      expect(formatPercentage(1.234, 2)).toBe('1.23%');
      expect(formatPercentage(1.234, 0)).toBe('1%');
    });

    test('formats 100% correctly', () => {
      expect(formatPercentage(100)).toBe('100%');
      expect(formatPercentage(100.5)).toBe('100%');
    });

    test('uses default precision of 1', () => {
      expect(formatPercentage(1.234)).toBe('1.2%');
    });
  });

  describe('getRegionExplorationSummary', () => {
    test('returns summary for users with exploration data', async () => {
      GeographicHierarchy.convertToLocationWithGeography.mockResolvedValue(sampleLocationData);
      GeographicApiService.getTotalRegionCounts.mockResolvedValue(sampleTotalCounts);

      const result = await getRegionExplorationSummary();

      expect(result.hasData).toBe(true);
      expect(result.summary).toContain('You\'ve explored');
      expect(result.summary).toContain('1.0%'); // 2/195 countries
      expect(result.details).toHaveLength(3);
      expect(result.details[0]).toContain('Countries:');
      expect(result.details[1]).toContain('States/Provinces:');
      expect(result.details[2]).toContain('Cities:');
    });

    test('returns encouragement for users with no data', async () => {
      GeographicHierarchy.convertToLocationWithGeography.mockResolvedValue([]);
      GeographicApiService.getTotalRegionCounts.mockResolvedValue(sampleTotalCounts);

      const result = await getRegionExplorationSummary();

      expect(result.hasData).toBe(false);
      expect(result.summary).toBe('Start exploring to discover new regions!');
      expect(result.details[0]).toContain('Visit new locations');
      expect(result.details[1]).toContain('195 countries');
    });

    test('handles errors gracefully', async () => {
      GeographicHierarchy.convertToLocationWithGeography.mockRejectedValue(new Error('Error'));
      GeographicApiService.getTotalRegionCounts.mockRejectedValue(new Error('API Error'));

      const result = await getRegionExplorationSummary();

      expect(result.hasData).toBe(false);
      expect(result.summary).toBe('Unable to calculate exploration progress');
      expect(result.details[0]).toBe('Please check your connection and try again');
    });
  });

  describe('validateRegionCounts', () => {
    test('validates correct region counts', () => {
      const validCounts = { countries: 5, states: 10, cities: 25 };
      expect(validateRegionCounts(validCounts)).toBe(true);
    });

    test('validates zero counts', () => {
      const zeroCounts = { countries: 0, states: 0, cities: 0 };
      expect(validateRegionCounts(zeroCounts)).toBe(true);
    });

    test('rejects negative counts', () => {
      const negativeCounts = { countries: -1, states: 5, cities: 10 };
      expect(validateRegionCounts(negativeCounts)).toBe(false);
    });

    test('rejects NaN values', () => {
      const nanCounts = { countries: NaN, states: 5, cities: 10 };
      expect(validateRegionCounts(nanCounts)).toBe(false);
    });

    test('rejects non-numeric values', () => {
      const invalidCounts = { countries: '5', states: 10, cities: 25 };
      expect(validateRegionCounts(invalidCounts)).toBe(false);
    });

    test('rejects missing properties', () => {
      const incompleteCounts = { countries: 5, states: 10 }; // Missing cities
      expect(validateRegionCounts(incompleteCounts)).toBe(false);
    });
  });

  describe('getRegionCountsFromHierarchy', () => {
    test('calculates counts from location data', async () => {
      GeographicHierarchy.convertToLocationWithGeography.mockResolvedValue(sampleLocationData);

      const result = await getRegionCountsFromHierarchy();

      expect(result.countries).toBe(2); // US and Canada
      expect(result.states).toBe(3); // NY, CA, ON
      expect(result.cities).toBe(4); // NYC, Manhattan, LA, Toronto
    });

    test('handles empty data', async () => {
      GeographicHierarchy.convertToLocationWithGeography.mockResolvedValue([]);

      const result = await getRegionCountsFromHierarchy();

      expect(result.countries).toBe(0);
      expect(result.states).toBe(0);
      expect(result.cities).toBe(0);
    });

    test('handles errors gracefully', async () => {
      GeographicHierarchy.convertToLocationWithGeography.mockRejectedValue(new Error('Error'));

      const result = await getRegionCountsFromHierarchy();

      expect(result.countries).toBe(0);
      expect(result.states).toBe(0);
      expect(result.cities).toBe(0);
    });

    test('creates unique keys for disambiguation', async () => {
      const ambiguousData = [
        {
          id: 1,
          country: 'United States',
          state: 'Georgia',
          city: 'Atlanta',
          isGeocoded: true
        },
        {
          id: 2,
          country: 'Georgia', // Country with same name as US state
          state: 'Tbilisi',
          city: 'Tbilisi',
          isGeocoded: true
        }
      ];

      GeographicHierarchy.convertToLocationWithGeography.mockResolvedValue(ambiguousData);

      const result = await getRegionCountsFromHierarchy();

      expect(result.countries).toBe(2); // US and Georgia (country)
      expect(result.states).toBe(2); // Should distinguish US:Georgia from Georgia:Tbilisi
      expect(result.cities).toBe(2); // Atlanta and Tbilisi
    });
  });

  describe('edge cases and error handling', () => {
    test('handles null/undefined inputs gracefully', async () => {
      GeographicHierarchy.convertToLocationWithGeography.mockResolvedValue(null);

      const result = await calculateVisitedRegions();
      expect(result.countries).toBe(0);
    });

    test('handles malformed location data', async () => {
      const malformedData = [
        { id: 1 }, // Missing required fields
        { id: 2, country: null, state: undefined, city: '' },
        { id: 3, country: 'Valid Country', state: 'Valid State', city: 'Valid City' }
      ];

      GeographicHierarchy.convertToLocationWithGeography.mockResolvedValue(malformedData);

      const result = await calculateVisitedRegions();
      expect(result.countries).toBe(1); // Only the valid entry
    });

    test('handles very large numbers', async () => {
      const largeCounts = { countries: 999999, states: 999999, cities: 999999 };
      expect(validateRegionCounts(largeCounts)).toBe(true);
      
      const formatted = formatRegionCount(999999, 'country');
      expect(formatted).toBe('999,999 countries');
    });
  });
});