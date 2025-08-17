// Mock for geographicHierarchy
export const buildGeographicHierarchy = jest.fn(async (locations, options = {}) => {
  if (!locations || locations.length === 0) {
    return [];
  }

  // Create a simple hierarchy based on the locations
  const countries = new Map();
  
  locations.forEach(location => {
    if (location.country) {
      if (!countries.has(location.country)) {
        countries.set(location.country, {
          type: 'country',
          name: location.country,
          code: location.countryCode,
          explorationPercentage: 0.1,
          children: [],
          isExpanded: false,
          locationCount: 0
        });
      }
      
      const country = countries.get(location.country);
      country.locationCount++;
      
      if (location.state) {
        let state = country.children.find(s => s.name === location.state);
        if (!state) {
          state = {
            type: 'state',
            name: location.state,
            code: location.stateCode,
            explorationPercentage: 0.1,
            children: [],
            isExpanded: false,
            locationCount: 0
          };
          country.children.push(state);
        }
        state.locationCount++;
        
        if (location.city) {
          let city = state.children.find(c => c.name === location.city);
          if (!city) {
            city = {
              type: 'city',
              name: location.city,
              explorationPercentage: 0.1,
              children: [],
              isExpanded: false,
              locationCount: 0
            };
            state.children.push(city);
          }
          city.locationCount++;
        }
      }
    }
  });
  
  return Array.from(countries.values());
});

export const calculateExplorationPercentages = jest.fn(async (hierarchy, revealedAreas = []) => {
  return hierarchy.map(node => ({
    ...node,
    explorationPercentage: node.locationCount * 0.1,
    children: node.children ? node.children.map(child => ({
      ...child,
      explorationPercentage: child.locationCount * 0.1,
      children: child.children ? child.children.map(grandchild => ({
        ...grandchild,
        explorationPercentage: grandchild.locationCount * 0.1
      })) : undefined
    })) : undefined
  }));
});

export const toggleHierarchyNodeExpansion = jest.fn((hierarchy, targetNode) => {
  const toggleNode = (nodes) => {
    return nodes.map(node => {
      if (node === targetNode) {
        return { ...node, isExpanded: !node.isExpanded };
      }
      if (node.children) {
        return { ...node, children: toggleNode(node.children) };
      }
      return node;
    });
  };
  
  return toggleNode(hierarchy);
});

export const expandHierarchyToDepth = jest.fn((hierarchy, maxDepth, currentDepth = 0) => {
  return hierarchy.map(node => ({
    ...node,
    isExpanded: currentDepth < maxDepth,
    children: node.children && currentDepth < maxDepth 
      ? expandHierarchyToDepth(node.children, maxDepth, currentDepth + 1)
      : node.children
  }));
});

export const collapseAllHierarchy = jest.fn((hierarchy) => {
  const collapseNode = (nodes) => {
    return nodes.map(node => ({
      ...node,
      isExpanded: false,
      children: node.children ? collapseNode(node.children) : undefined
    }));
  };
  
  return collapseNode(hierarchy);
});

export const findHierarchyNode = jest.fn((hierarchy, name, type) => {
  const findInNodes = (nodes) => {
    for (const node of nodes) {
      if (node.name === name && node.type === type) {
        return node;
      }
      if (node.children) {
        const found = findInNodes(node.children);
        if (found) return found;
      }
    }
    return null;
  };
  
  return findInNodes(hierarchy);
});

export const getHierarchyLevelCounts = jest.fn((hierarchy) => {
  const counts = { countries: 0, states: 0, cities: 0 };
  
  const countNodes = (nodes) => {
    nodes.forEach(node => {
      if (node.type === 'country') counts.countries++;
      else if (node.type === 'state') counts.states++;
      else if (node.type === 'city') counts.cities++;
      
      if (node.children) {
        countNodes(node.children);
      }
    });
  };
  
  countNodes(hierarchy);
  return counts;
});

export const convertToLocationWithGeography = jest.fn(async () => {
  return [
    {
      id: 1,
      latitude: 40.7128,
      longitude: -74.0060,
      timestamp: Date.now(),
      country: 'United States',
      countryCode: 'US',
      state: 'New York',
      stateCode: 'NY',
      city: 'New York City',
      isGeocoded: true
    },
    {
      id: 2,
      latitude: 34.0522,
      longitude: -118.2437,
      timestamp: Date.now(),
      country: 'United States',
      countryCode: 'US',
      state: 'California',
      stateCode: 'CA',
      city: 'Los Angeles',
      isGeocoded: true
    }
  ];
});