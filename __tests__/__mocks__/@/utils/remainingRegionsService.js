// Mock for remainingRegionsService
export const calculateTotalAvailableRegions = jest.fn(async () => ({
  countries: 195,
  states: 3142,
  cities: 10000
}));

export const calculateVisitedRegions = jest.fn(async () => ({
  countries: 1,
  states: 2,
  cities: 3
}));

export const calculateRemainingRegions = jest.fn(async (visited, total) => {
  const visitedData = visited || { countries: 1, states: 2, cities: 3 };
  const totalData = total || { countries: 195, states: 3142, cities: 10000 };
  
  return {
    countries: totalData.countries - visitedData.countries,
    states: totalData.states - visitedData.states,
    cities: totalData.cities - visitedData.cities
  };
});

export const calculateRemainingRegionsWithinVisited = jest.fn(async () => ({
  visitedCountries: ['United States'],
  totalStatesInVisitedCountries: 50,
  visitedStatesInVisitedCountries: 2,
  remainingStatesInVisitedCountries: 48,
  totalCitiesInVisitedStates: 1000,
  visitedCitiesInVisitedStates: 3,
  remainingCitiesInVisitedStates: 997
}));

export const getRemainingRegionsData = jest.fn(async () => ({
  visited: { countries: 1, states: 2, cities: 3 },
  total: { countries: 195, states: 3142, cities: 10000 },
  remaining: { countries: 194, states: 3140, cities: 9997 },
  percentageVisited: {
    countries: 0.51,
    states: 0.06,
    cities: 0.03
  },
  withinVisited: {
    visitedCountries: ['United States'],
    totalStatesInVisitedCountries: 50,
    visitedStatesInVisitedCountries: 2,
    remainingStatesInVisitedCountries: 48,
    totalCitiesInVisitedStates: 1000,
    visitedCitiesInVisitedStates: 3,
    remainingCitiesInVisitedStates: 997
  }
}));

export const formatRegionCount = jest.fn((count, regionType) => {
  if (count === 1) {
    return `1 ${regionType.replace(/ies$/, 'y').replace(/s$/, '')}`;
  }
  return `${count} ${regionType}`;
});

export const formatVisitedVsRemaining = jest.fn((visited, total, regionType) => {
  const remaining = total - visited;
  return `${visited} of ${total} ${regionType} visited, ${remaining} remaining`;
});

export const formatPercentage = jest.fn((percentage, precision = 1) => {
  if (percentage === 0) return '0%';
  if (percentage < 0.1 && precision >= 1) return '<0.1%';
  return `${percentage.toFixed(precision)}%`;
});

export const getRegionExplorationSummary = jest.fn(async () => ({
  summary: 'You have explored 1 country, 2 states, and 3 cities.',
  details: [
    '194 countries remaining to explore',
    '3140 states remaining to explore',
    '9997 cities remaining to explore'
  ]
}));

export const validateRegionCounts = jest.fn((counts) => {
  return (
    typeof counts.countries === 'number' && counts.countries >= 0 &&
    typeof counts.states === 'number' && counts.states >= 0 &&
    typeof counts.cities === 'number' && counts.cities >= 0
  );
});

export const getRegionCountsFromHierarchy = jest.fn(async () => ({
  countries: 1,
  states: 2,
  cities: 3
}));