import { getTotalRegionCounts } from './geographicApiService';
import { convertToLocationWithGeography } from './geographicHierarchy';
import { logger } from './logger';

/**
 * Service for calculating remaining unexplored regions
 * Implements requirements 3.4, 3.5, 3.6, 3.9, 3.10, 3.11, 3.13
 */

export interface RegionCounts {
  countries: number;
  states: number;
  cities: number;
}

export interface RemainingRegionsData {
  visited: RegionCounts;
  total: RegionCounts;
  remaining: RegionCounts;
  percentageVisited: {
    countries: number;
    states: number;
    cities: number;
  };
}

export interface RegionCountsWithinVisited {
  visitedCountries: string[];
  totalStatesInVisitedCountries: number;
  visitedStatesInVisitedCountries: number;
  remainingStatesInVisitedCountries: number;
  totalCitiesInVisitedStates: number;
  visitedCitiesInVisitedStates: number;
  remainingCitiesInVisitedStates: number;
}

/**
 * Calculate total available countries, states, and cities worldwide
 * Requirement 3.4: Display count of countries remaining to be explored
 * Requirement 3.9: Use authoritative geographic databases for total counts
 */
export const calculateTotalAvailableRegions = async (): Promise<RegionCounts> => {
  logger.debug('RemainingRegionsService: Calculating total available regions');

  try {
    const totalCounts = await getTotalRegionCounts();
    
    logger.debug('RemainingRegionsService: Total regions calculated', totalCounts);
    return totalCounts;
  } catch (error) {
    logger.error('RemainingRegionsService: Error calculating total regions:', error);
    
    // Return fallback values if API fails
    const fallbackCounts: RegionCounts = {
      countries: 195, // UN recognized countries
      states: 3142, // Approximate first-level subdivisions worldwide
      cities: 10000 // Approximate major cities worldwide
    };
    
    logger.warn('RemainingRegionsService: Using fallback total region counts', fallbackCounts);
    return fallbackCounts;
  }
};

/**
 * Calculate visited regions from location data
 * Requirement 3.1: Display count of unique countries visited
 * Requirement 3.2: Display count of unique states/provinces visited
 * Requirement 3.3: Display count of unique cities visited
 */
export const calculateVisitedRegions = async (): Promise<RegionCounts> => {
  logger.debug('RemainingRegionsService: Calculating visited regions');

  try {
    const locationsWithGeography = await convertToLocationWithGeography();
    
    // Use Set to ensure uniqueness
    const uniqueCountries = new Set<string>();
    const uniqueStates = new Set<string>();
    const uniqueCities = new Set<string>();

    for (const location of locationsWithGeography) {
      if (location.country) {
        uniqueCountries.add(location.country);
      }
      
      if (location.state) {
        // Create a unique key combining country and state to avoid duplicates
        // across different countries (e.g., "Georgia" state in US vs "Georgia" country)
        const stateKey = location.country ? `${location.country}:${location.state}` : location.state;
        uniqueStates.add(stateKey);
      }
      
      if (location.city) {
        // Create a unique key combining country, state, and city
        const cityKey = [location.country, location.state, location.city]
          .filter(Boolean)
          .join(':');
        uniqueCities.add(cityKey);
      }
    }

    const visitedCounts: RegionCounts = {
      countries: uniqueCountries.size,
      states: uniqueStates.size,
      cities: uniqueCities.size
    };

    logger.debug('RemainingRegionsService: Visited regions calculated', visitedCounts);
    return visitedCounts;
  } catch (error) {
    logger.error('RemainingRegionsService: Error calculating visited regions:', error);
    
    // Return zero counts on error
    return {
      countries: 0,
      states: 0,
      cities: 0
    };
  }
};

/**
 * Calculate remaining unexplored regions
 * Requirement 3.4: Display count of countries remaining to be explored
 * Requirement 3.5: Display count of states/provinces remaining to be explored in visited countries
 * Requirement 3.6: Display count of cities remaining to be explored in visited states/provinces
 */
export const calculateRemainingRegions = async (
  visitedRegions?: RegionCounts,
  totalRegions?: RegionCounts
): Promise<RegionCounts> => {
  logger.debug('RemainingRegionsService: Calculating remaining regions');

  try {
    const visited = visitedRegions || await calculateVisitedRegions();
    const total = totalRegions || await calculateTotalAvailableRegions();

    const remaining: RegionCounts = {
      countries: Math.max(0, total.countries - visited.countries),
      states: Math.max(0, total.states - visited.states),
      cities: Math.max(0, total.cities - visited.cities)
    };

    logger.debug('RemainingRegionsService: Remaining regions calculated', {
      visited,
      total,
      remaining
    });

    return remaining;
  } catch (error) {
    logger.error('RemainingRegionsService: Error calculating remaining regions:', error);
    
    // Return zero counts on error
    return {
      countries: 0,
      states: 0,
      cities: 0
    };
  }
};

/**
 * Calculate remaining regions within visited countries/states
 * This provides more contextual information about exploration opportunities
 * Requirement 3.5: Display count of states/provinces remaining in visited countries
 * Requirement 3.6: Display count of cities remaining in visited states
 */
export const calculateRemainingRegionsWithinVisited = async (): Promise<RegionCountsWithinVisited> => {
  logger.debug('RemainingRegionsService: Calculating remaining regions within visited areas');

  try {
    const locationsWithGeography = await convertToLocationWithGeography();
    
    // Get unique visited countries
    const visitedCountries = Array.from(
      new Set(
        locationsWithGeography
          .map(loc => loc.country)
          .filter(Boolean) as string[]
      )
    );

    // For simplicity, we'll use approximations for states and cities within visited countries
    // In a production app, this would query specific APIs for each country's subdivisions
    const avgStatesPerCountry = 20; // Approximate average states/provinces per country
    const avgCitiesPerState = 50; // Approximate average major cities per state

    const totalStatesInVisitedCountries = visitedCountries.length * avgStatesPerCountry;
    
    // Count unique visited states
    const visitedStatesSet = new Set<string>();
    for (const location of locationsWithGeography) {
      if (location.country && location.state) {
        visitedStatesSet.add(`${location.country}:${location.state}`);
      }
    }
    const visitedStatesInVisitedCountries = visitedStatesSet.size;
    
    const remainingStatesInVisitedCountries = Math.max(
      0, 
      totalStatesInVisitedCountries - visitedStatesInVisitedCountries
    );

    // Calculate cities within visited states
    const totalCitiesInVisitedStates = visitedStatesInVisitedCountries * avgCitiesPerState;
    
    // Count unique visited cities
    const visitedCitiesSet = new Set<string>();
    for (const location of locationsWithGeography) {
      if (location.country && location.state && location.city) {
        visitedCitiesSet.add(`${location.country}:${location.state}:${location.city}`);
      }
    }
    const visitedCitiesInVisitedStates = visitedCitiesSet.size;
    
    const remainingCitiesInVisitedStates = Math.max(
      0,
      totalCitiesInVisitedStates - visitedCitiesInVisitedStates
    );

    const result: RegionCountsWithinVisited = {
      visitedCountries,
      totalStatesInVisitedCountries,
      visitedStatesInVisitedCountries,
      remainingStatesInVisitedCountries,
      totalCitiesInVisitedStates,
      visitedCitiesInVisitedStates,
      remainingCitiesInVisitedStates
    };

    logger.debug('RemainingRegionsService: Remaining regions within visited calculated', result);
    return result;
  } catch (error) {
    logger.error('RemainingRegionsService: Error calculating remaining regions within visited:', error);
    
    // Return empty data on error
    return {
      visitedCountries: [],
      totalStatesInVisitedCountries: 0,
      visitedStatesInVisitedCountries: 0,
      remainingStatesInVisitedCountries: 0,
      totalCitiesInVisitedStates: 0,
      visitedCitiesInVisitedStates: 0,
      remainingCitiesInVisitedStates: 0
    };
  }
};

/**
 * Get comprehensive remaining regions data
 * Combines all calculations into a single response
 * Requirements 3.9, 3.10, 3.11: Display counts with proper formatting
 */
export const getRemainingRegionsData = async (): Promise<RemainingRegionsData> => {
  logger.debug('RemainingRegionsService: Getting comprehensive remaining regions data');

  try {
    const [visited, total] = await Promise.all([
      calculateVisitedRegions(),
      calculateTotalAvailableRegions()
    ]);

    const remaining = await calculateRemainingRegions(visited, total);

    // Calculate percentage visited
    const percentageVisited = {
      countries: total.countries > 0 ? (visited.countries / total.countries) * 100 : 0,
      states: total.states > 0 ? (visited.states / total.states) * 100 : 0,
      cities: total.cities > 0 ? (visited.cities / total.cities) * 100 : 0
    };

    const result: RemainingRegionsData = {
      visited,
      total,
      remaining,
      percentageVisited
    };

    logger.debug('RemainingRegionsService: Comprehensive remaining regions data calculated', result);
    return result;
  } catch (error) {
    logger.error('RemainingRegionsService: Error getting comprehensive remaining regions data:', error);
    
    // Return empty data on error
    return {
      visited: { countries: 0, states: 0, cities: 0 },
      total: { countries: 195, states: 3142, cities: 10000 },
      remaining: { countries: 195, states: 3142, cities: 10000 },
      percentageVisited: { countries: 0, states: 0, cities: 0 }
    };
  }
};

/**
 * Format region counts with proper pluralization
 * Requirement 3.10: Use proper pluralization (e.g., "1 country", "5 countries")
 * Requirement 3.11: Show both visited and remaining counts in clear format
 */
export const formatRegionCount = (
  count: number,
  regionType: 'country' | 'countries' | 'state' | 'states' | 'city' | 'cities'
): string => {
  if (count === 0) {
    // Handle zero case
    const pluralType = regionType.endsWith('y') ? 
      regionType.slice(0, -1) + 'ies' : 
      regionType + 's';
    return `0 ${pluralType}`;
  }

  if (count === 1) {
    // Handle singular case
    const singularType = regionType.endsWith('ies') ? 
      regionType.slice(0, -3) + 'y' :
      regionType.endsWith('s') ? regionType.slice(0, -1) : regionType;
    return `1 ${singularType}`;
  }

  // Handle plural case
  const pluralType = regionType.endsWith('y') ? 
    regionType.slice(0, -1) + 'ies' : 
    regionType.endsWith('s') ? regionType : regionType + 's';
  
  return `${count.toLocaleString()} ${pluralType}`;
};

/**
 * Format visited vs remaining counts
 * Requirement 3.11: Show format like "5 of 195 countries visited, 190 remaining"
 */
export const formatVisitedVsRemaining = (
  visited: number,
  total: number,
  regionType: 'country' | 'state' | 'city'
): string => {
  const remaining = Math.max(0, total - visited);
  
  const visitedText = formatRegionCount(visited, regionType);
  const totalText = total.toLocaleString();
  const remainingText = formatRegionCount(remaining, regionType);
  
  return `${visitedText} of ${totalText} visited, ${remainingText} remaining`;
};

/**
 * Format percentage with appropriate precision
 * Helper function for displaying exploration percentages
 */
export const formatPercentage = (percentage: number, precision: number = 1): string => {
  if (percentage === 0) return '0%';
  if (percentage < 0.1 && precision >= 1) return '<0.1%';
  if (percentage >= 100) return '100%';
  
  return `${percentage.toFixed(precision)}%`;
};

/**
 * Get region exploration summary text
 * Provides human-readable summary of exploration progress
 * Requirement 3.13: Display available data with appropriate messaging
 */
export const getRegionExplorationSummary = async (): Promise<{
  summary: string;
  details: string[];
  hasData: boolean;
}> => {
  logger.debug('RemainingRegionsService: Getting region exploration summary');

  try {
    const data = await getRemainingRegionsData();
    
    const hasData = data.visited.countries > 0 || data.visited.states > 0 || data.visited.cities > 0;
    
    if (!hasData) {
      return {
        summary: 'Start exploring to discover new regions!',
        details: [
          'Visit new locations to begin tracking your geographic exploration',
          `There are ${data.total.countries.toLocaleString()} countries waiting to be discovered`,
          'Your journey of discovery starts with your first step'
        ],
        hasData: false
      };
    }

    const countryProgress = formatVisitedVsRemaining(
      data.visited.countries, 
      data.total.countries, 
      'country'
    );
    
    const stateProgress = formatVisitedVsRemaining(
      data.visited.states, 
      data.total.states, 
      'state'
    );
    
    const cityProgress = formatVisitedVsRemaining(
      data.visited.cities, 
      data.total.cities, 
      'city'
    );

    const summary = `You've explored ${formatPercentage(data.percentageVisited.countries)} of the world's countries`;
    
    const details = [
      `Countries: ${countryProgress}`,
      `States/Provinces: ${stateProgress}`,
      `Cities: ${cityProgress}`
    ];

    return {
      summary,
      details,
      hasData: true
    };
  } catch (error) {
    logger.error('RemainingRegionsService: Error getting exploration summary:', error);
    
    return {
      summary: 'Unable to calculate exploration progress',
      details: ['Please check your connection and try again'],
      hasData: false
    };
  }
};

/**
 * Validate region counts for consistency
 * Helper function to ensure data integrity
 */
export const validateRegionCounts = (counts: RegionCounts): boolean => {
  return (
    typeof counts.countries === 'number' && counts.countries >= 0 &&
    typeof counts.states === 'number' && counts.states >= 0 &&
    typeof counts.cities === 'number' && counts.cities >= 0 &&
    !isNaN(counts.countries) && !isNaN(counts.states) && !isNaN(counts.cities)
  );
};

/**
 * Get region counts from hierarchy data (alternative calculation method)
 * Can be used as a cross-check against the main calculation
 */
export const getRegionCountsFromHierarchy = async (): Promise<RegionCounts> => {
  try {
    const locationsWithGeography = await convertToLocationWithGeography();
    
    // This would use the hierarchy building function, but for now we'll use a simpler approach
    // to avoid circular dependencies
    const uniqueCountries = new Set<string>();
    const uniqueStates = new Set<string>();
    const uniqueCities = new Set<string>();

    for (const location of locationsWithGeography) {
      if (location.country) uniqueCountries.add(location.country);
      if (location.state) uniqueStates.add(`${location.country}:${location.state}`);
      if (location.city) uniqueCities.add(`${location.country}:${location.state}:${location.city}`);
    }

    return {
      countries: uniqueCountries.size,
      states: uniqueStates.size,
      cities: uniqueCities.size
    };
  } catch (error) {
    logger.error('RemainingRegionsService: Error getting counts from hierarchy:', error);
    return { countries: 0, states: 0, cities: 0 };
  }
};