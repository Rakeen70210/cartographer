import { getAllLocationGeocodings, LocationGeocoding } from './database';
import { logger } from './logger';

/**
 * Geographic hierarchy data structures for statistics dashboard
 */

export interface GeographicHierarchy {
  type: 'world' | 'country' | 'state' | 'city';
  name: string;
  code?: string; // ISO codes for countries/states
  explorationPercentage: number;
  totalArea?: number; // in square kilometers
  exploredArea?: number; // in square kilometers
  children?: GeographicHierarchy[];
  isExpanded?: boolean;
  locationCount?: number; // number of locations in this region
}

export interface LocationWithGeography {
  id: number;
  latitude: number;
  longitude: number;
  timestamp: number;
  country?: string;
  countryCode?: string;
  state?: string;
  stateCode?: string;
  city?: string;
  isGeocoded: boolean;
}

export interface HierarchyBuildOptions {
  includeEmptyRegions?: boolean;
  maxDepth?: number;
  sortBy?: 'name' | 'explorationPercentage' | 'locationCount';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Builds a hierarchical tree structure from flat location data
 */
export const buildGeographicHierarchy = async (
  locations: LocationWithGeography[],
  options: HierarchyBuildOptions = {}
): Promise<GeographicHierarchy[]> => {
  logger.debug('GeographicHierarchy: Building hierarchy from locations', { 
    locationCount: locations.length,
    options 
  });

  const {
    includeEmptyRegions = false,
    maxDepth = 4, // world -> country -> state -> city
    sortBy = 'name',
    sortOrder = 'asc'
  } = options;

  try {
    // Group locations by geographic hierarchy
    const countryMap = new Map<string, {
      country: string;
      countryCode?: string;
      states: Map<string, {
        state: string;
        stateCode?: string;
        cities: Map<string, LocationWithGeography[]>;
      }>;
    }>();

    // Process each location and build the hierarchy structure
    for (const location of locations) {
      if (!location.country) continue;

      const countryKey = location.country;
      
      // Initialize country if not exists
      if (!countryMap.has(countryKey)) {
        countryMap.set(countryKey, {
          country: location.country,
          countryCode: location.countryCode,
          states: new Map()
        });
      }

      const countryData = countryMap.get(countryKey)!;
      const stateKey = location.state || 'Unknown State';

      // Initialize state if not exists
      if (!countryData.states.has(stateKey)) {
        countryData.states.set(stateKey, {
          state: location.state || 'Unknown State',
          stateCode: location.stateCode,
          cities: new Map()
        });
      }

      const stateData = countryData.states.get(stateKey)!;
      const cityKey = location.city || 'Unknown City';

      // Initialize city if not exists
      if (!stateData.cities.has(cityKey)) {
        stateData.cities.set(cityKey, []);
      }

      // Add location to city
      stateData.cities.get(cityKey)!.push(location);
    }

    // Convert the nested maps to hierarchy structure
    const hierarchy: GeographicHierarchy[] = [];

    for (const [countryKey, countryData] of countryMap) {
      const countryChildren: GeographicHierarchy[] = [];

      for (const [stateKey, stateData] of countryData.states) {
        const stateChildren: GeographicHierarchy[] = [];

        for (const [cityKey, cityLocations] of stateData.cities) {
          if (maxDepth >= 4) {
            const cityNode: GeographicHierarchy = {
              type: 'city',
              name: stateData.state === 'Unknown State' ? cityKey : cityKey,
              explorationPercentage: 0, // Will be calculated later with area data
              locationCount: cityLocations.length,
              isExpanded: false
            };

            stateChildren.push(cityNode);
          }
        }

        if (maxDepth >= 3) {
          const stateNode: GeographicHierarchy = {
            type: 'state',
            name: stateData.state,
            code: stateData.stateCode,
            explorationPercentage: 0, // Will be calculated later with area data
            locationCount: Array.from(stateData.cities.values()).flat().length,
            children: stateChildren.length > 0 ? sortHierarchyNodes(stateChildren, sortBy, sortOrder) : undefined,
            isExpanded: false
          };

          countryChildren.push(stateNode);
        }
      }

      if (maxDepth >= 2) {
        const countryNode: GeographicHierarchy = {
          type: 'country',
          name: countryData.country,
          code: countryData.countryCode,
          explorationPercentage: 0, // Will be calculated later with area data
          locationCount: Array.from(countryData.states.values())
            .flatMap(state => Array.from(state.cities.values()))
            .flat().length,
          children: countryChildren.length > 0 ? sortHierarchyNodes(countryChildren, sortBy, sortOrder) : undefined,
          isExpanded: false
        };

        hierarchy.push(countryNode);
      }
    }

    const sortedHierarchy = sortHierarchyNodes(hierarchy, sortBy, sortOrder);

    logger.debug('GeographicHierarchy: Built hierarchy successfully', {
      countriesCount: sortedHierarchy.length,
      totalLocations: locations.length
    });

    return sortedHierarchy;
  } catch (error) {
    logger.error('GeographicHierarchy: Error building hierarchy:', error);
    throw error;
  }
};

/**
 * Sorts hierarchy nodes based on specified criteria
 */
const sortHierarchyNodes = (
  nodes: GeographicHierarchy[],
  sortBy: 'name' | 'explorationPercentage' | 'locationCount',
  sortOrder: 'asc' | 'desc'
): GeographicHierarchy[] => {
  return nodes.sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'explorationPercentage':
        comparison = (a.explorationPercentage || 0) - (b.explorationPercentage || 0);
        break;
      case 'locationCount':
        comparison = (a.locationCount || 0) - (b.locationCount || 0);
        break;
    }

    return sortOrder === 'desc' ? -comparison : comparison;
  });
};

/**
 * Calculates exploration percentages for each hierarchy level using actual area calculations
 */
export const calculateExplorationPercentages = async (
  hierarchy: GeographicHierarchy[],
  revealedAreas: GeoJSON.Feature[] = []
): Promise<GeographicHierarchy[]> => {
  logger.debug('GeographicHierarchy: Calculating exploration percentages with area data');

  try {
    const { calculateRegionExploration, getRegionBoundaryData } = await import('./regionBoundaryService');

    const calculateNodePercentage = async (node: GeographicHierarchy): Promise<GeographicHierarchy> => {
      let explorationPercentage = 0;
      let totalArea = 0;
      let exploredArea = 0;

      try {
        // Get boundary data for this region
        const boundaryData = await getRegionBoundaryData(node.type as 'country' | 'state' | 'city', node.name);
        
        if (boundaryData && revealedAreas.length > 0) {
          // Calculate actual exploration using area intersection
          const explorationData = await calculateRegionExploration(boundaryData, revealedAreas);
          explorationPercentage = explorationData.explorationPercentage;
          totalArea = explorationData.totalArea;
          exploredArea = explorationData.exploredArea;
        } else if (node.locationCount && node.locationCount > 0) {
          // Fallback to basic calculation if no boundary data available
          explorationPercentage = Math.min((node.locationCount || 0) * 0.1, 100);
        }
      } catch (error) {
        logger.debug(`GeographicHierarchy: Could not calculate area for ${node.name}, using fallback`);
        // Fallback to basic calculation
        explorationPercentage = Math.min((node.locationCount || 0) * 0.1, 100);
      }

      const updatedNode: GeographicHierarchy = {
        ...node,
        explorationPercentage: Number(explorationPercentage.toFixed(3)),
        totalArea: totalArea > 0 ? totalArea : undefined,
        exploredArea: exploredArea > 0 ? exploredArea : undefined
      };

      // Recursively calculate for children
      if (node.children) {
        updatedNode.children = await Promise.all(
          node.children.map(child => calculateNodePercentage(child))
        );
      }

      return updatedNode;
    };

    const updatedHierarchy = await Promise.all(
      hierarchy.map(node => calculateNodePercentage(node))
    );

    logger.debug('GeographicHierarchy: Calculated exploration percentages with area data');
    return updatedHierarchy;
  } catch (error) {
    logger.error('GeographicHierarchy: Error calculating exploration percentages:', error);
    
    // Fallback to basic calculation on error
    const calculateBasicPercentage = (node: GeographicHierarchy): GeographicHierarchy => {
      const basePercentage = Math.min((node.locationCount || 0) * 0.1, 100);
      
      const updatedNode: GeographicHierarchy = {
        ...node,
        explorationPercentage: Number(basePercentage.toFixed(3))
      };

      if (node.children) {
        updatedNode.children = node.children.map(calculateBasicPercentage);
      }

      return updatedNode;
    };

    return hierarchy.map(calculateBasicPercentage);
  }
};

/**
 * Toggles the expanded state of a hierarchy node
 */
export const toggleHierarchyNodeExpansion = (
  hierarchy: GeographicHierarchy[],
  targetNode: GeographicHierarchy
): GeographicHierarchy[] => {
  const toggleNode = (nodes: GeographicHierarchy[]): GeographicHierarchy[] => {
    return nodes.map(node => {
      if (node === targetNode) {
        return {
          ...node,
          isExpanded: !node.isExpanded
        };
      }

      if (node.children) {
        return {
          ...node,
          children: toggleNode(node.children)
        };
      }

      return node;
    });
  };

  return toggleNode(hierarchy);
};

/**
 * Expands all nodes in the hierarchy up to a specified depth
 */
export const expandHierarchyToDepth = (
  hierarchy: GeographicHierarchy[],
  maxDepth: number,
  currentDepth: number = 0
): GeographicHierarchy[] => {
  return hierarchy.map(node => {
    const shouldExpand = currentDepth < maxDepth;
    
    const updatedNode: GeographicHierarchy = {
      ...node,
      isExpanded: shouldExpand
    };

    if (node.children && shouldExpand) {
      updatedNode.children = expandHierarchyToDepth(
        node.children,
        maxDepth,
        currentDepth + 1
      );
    }

    return updatedNode;
  });
};

/**
 * Collapses all nodes in the hierarchy
 */
export const collapseAllHierarchy = (
  hierarchy: GeographicHierarchy[]
): GeographicHierarchy[] => {
  return hierarchy.map(node => {
    const updatedNode: GeographicHierarchy = {
      ...node,
      isExpanded: false
    };

    if (node.children) {
      updatedNode.children = collapseAllHierarchy(node.children);
    }

    return updatedNode;
  });
};

/**
 * Finds a specific node in the hierarchy by name and type
 */
export const findHierarchyNode = (
  hierarchy: GeographicHierarchy[],
  name: string,
  type: GeographicHierarchy['type']
): GeographicHierarchy | null => {
  for (const node of hierarchy) {
    if (node.name === name && node.type === type) {
      return node;
    }

    if (node.children) {
      const found = findHierarchyNode(node.children, name, type);
      if (found) return found;
    }
  }

  return null;
};

/**
 * Gets the total count of nodes at each hierarchy level
 */
export const getHierarchyLevelCounts = (
  hierarchy: GeographicHierarchy[]
): { countries: number; states: number; cities: number } => {
  let countries = 0;
  let states = 0;
  let cities = 0;

  const countNodes = (nodes: GeographicHierarchy[]) => {
    for (const node of nodes) {
      switch (node.type) {
        case 'country':
          countries++;
          break;
        case 'state':
          states++;
          break;
        case 'city':
          cities++;
          break;
      }

      if (node.children) {
        countNodes(node.children);
      }
    }
  };

  countNodes(hierarchy);

  return { countries, states, cities };
};

/**
 * Converts location geocoding data to LocationWithGeography format
 */
export const convertToLocationWithGeography = async (): Promise<LocationWithGeography[]> => {
  try {
    const geocodingData = await getAllLocationGeocodings();
    
    return geocodingData.map((item: LocationGeocoding): LocationWithGeography => ({
      id: item.id,
      latitude: item.latitude,
      longitude: item.longitude,
      timestamp: item.timestamp,
      country: item.country,
      countryCode: undefined, // Will be populated when we have country code data
      state: item.state,
      stateCode: undefined, // Will be populated when we have state code data
      city: item.city,
      isGeocoded: !!(item.country || item.state || item.city)
    }));
  } catch (error) {
    logger.error('GeographicHierarchy: Error converting location data:', error);
    return [];
  }
};