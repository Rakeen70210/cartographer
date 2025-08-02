/**
 * Configuration for Geographic API Services
 * 
 * This file contains configuration for various geographic data APIs
 * including endpoints, rate limits, and authentication settings.
 */

export interface ApiEndpointConfig {
  baseUrl: string;
  rateLimit: number; // requests per second
  timeout: number; // milliseconds
  retryAttempts: number;
  retryDelay: number; // milliseconds
  userAgent?: string;
  apiKey?: string;
  headers?: Record<string, string>;
}

export interface GeographicApiConfiguration {
  nominatim: ApiEndpointConfig;
  naturalEarth: ApiEndpointConfig;
  restCountries: ApiEndpointConfig;
  overpass: ApiEndpointConfig;
  geonames: ApiEndpointConfig;
  caching: {
    boundaryMaxAge: number; // milliseconds
    geocodingMaxAge: number; // milliseconds
    statisticsMaxAge: number; // milliseconds
  };
  fallback: {
    enableOfflineMode: boolean;
    useSimplifiedBoundaries: boolean;
    maxRetryAttempts: number;
  };
}

/**
 * Default configuration for all geographic APIs
 */
export const DEFAULT_GEOGRAPHIC_API_CONFIG: GeographicApiConfiguration = {
  // OpenStreetMap Nominatim - Primary source for geocoding and boundaries
  nominatim: {
    baseUrl: 'https://nominatim.openstreetmap.org',
    rateLimit: 1, // 1 request per second as per usage policy
    timeout: 15000, // 15 seconds
    retryAttempts: 2,
    retryDelay: 2000, // 2 seconds
    userAgent: 'Cartographer/1.0 (https://github.com/cartographer-app)',
    headers: {
      'Accept': 'application/json',
      'Accept-Language': 'en'
    }
  },

  // Natural Earth - Simplified world boundaries
  naturalEarth: {
    baseUrl: 'https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA',
    rateLimit: 5, // More lenient for static data
    timeout: 10000, // 10 seconds
    retryAttempts: 3,
    retryDelay: 1000, // 1 second
    headers: {
      'Accept': 'application/json'
    }
  },

  // REST Countries - Country metadata
  restCountries: {
    baseUrl: 'https://restcountries.com/v3.1',
    rateLimit: 10, // Higher rate limit allowed
    timeout: 10000, // 10 seconds
    retryAttempts: 2,
    retryDelay: 1000, // 1 second
    headers: {
      'Accept': 'application/json'
    }
  },

  // Overpass API - OpenStreetMap data queries (alternative source)
  overpass: {
    baseUrl: 'https://overpass-api.de/api',
    rateLimit: 2, // Conservative rate limit
    timeout: 30000, // 30 seconds for complex queries
    retryAttempts: 1,
    retryDelay: 5000, // 5 seconds
    headers: {
      'Accept': 'application/json'
    }
  },

  // GeoNames - Geographic database (alternative source)
  geonames: {
    baseUrl: 'http://api.geonames.org',
    rateLimit: 1, // 1 request per second for free accounts
    timeout: 10000, // 10 seconds
    retryAttempts: 2,
    retryDelay: 2000, // 2 seconds
    // Note: Requires username parameter for API calls
    headers: {
      'Accept': 'application/json'
    }
  },

  // Caching configuration
  caching: {
    boundaryMaxAge: 7 * 24 * 60 * 60 * 1000, // 7 days for boundary data
    geocodingMaxAge: 24 * 60 * 60 * 1000, // 24 hours for geocoding results
    statisticsMaxAge: 60 * 60 * 1000 // 1 hour for statistics cache
  },

  // Fallback configuration
  fallback: {
    enableOfflineMode: true,
    useSimplifiedBoundaries: true,
    maxRetryAttempts: 3
  }
};

/**
 * Environment-specific configurations
 */
export const DEVELOPMENT_CONFIG: Partial<GeographicApiConfiguration> = {
  nominatim: {
    ...DEFAULT_GEOGRAPHIC_API_CONFIG.nominatim,
    rateLimit: 0.5, // Even more conservative in development
    timeout: 20000 // Longer timeout for debugging
  },
  caching: {
    ...DEFAULT_GEOGRAPHIC_API_CONFIG.caching,
    boundaryMaxAge: 60 * 60 * 1000, // 1 hour in development for faster iteration
    geocodingMaxAge: 30 * 60 * 1000 // 30 minutes in development
  }
};

export const PRODUCTION_CONFIG: Partial<GeographicApiConfiguration> = {
  nominatim: {
    ...DEFAULT_GEOGRAPHIC_API_CONFIG.nominatim,
    retryAttempts: 3, // More retries in production
    timeout: 12000 // Slightly shorter timeout for better UX
  },
  fallback: {
    ...DEFAULT_GEOGRAPHIC_API_CONFIG.fallback,
    maxRetryAttempts: 5 // More aggressive retries in production
  }
};

/**
 * API endpoint templates for different query types
 */
export const API_ENDPOINTS = {
  nominatim: {
    search: '/search',
    reverse: '/reverse',
    lookup: '/lookup',
    details: '/details'
  },
  naturalEarth: {
    countries: '/world.geojson',
    states: '/world-states.geojson', // If available
    cities: '/world-cities.geojson' // If available
  },
  restCountries: {
    all: '/all',
    byName: '/name',
    byCode: '/alpha',
    byRegion: '/region'
  },
  overpass: {
    interpreter: '/interpreter'
  },
  geonames: {
    search: '/searchJSON',
    get: '/getJSON',
    countryInfo: '/countryInfoJSON',
    children: '/childrenJSON'
  }
};

/**
 * Query templates for different types of geographic data
 */
export const QUERY_TEMPLATES = {
  nominatim: {
    countrySearch: (name: string, countryCode?: string) => ({
      q: name,
      format: 'json',
      polygon_geojson: '1',
      addressdetails: '1',
      limit: '1',
      featureType: 'country',
      ...(countryCode && { countrycodes: countryCode.toLowerCase() })
    }),
    stateSearch: (name: string, countryCode?: string) => ({
      q: countryCode ? `${name}, ${countryCode}` : name,
      format: 'json',
      polygon_geojson: '1',
      addressdetails: '1',
      limit: '1',
      featureType: 'state',
      ...(countryCode && { countrycodes: countryCode.toLowerCase() })
    }),
    citySearch: (name: string, stateCode?: string, countryCode?: string) => {
      let query = name;
      if (stateCode && countryCode) {
        query = `${name}, ${stateCode}, ${countryCode}`;
      } else if (countryCode) {
        query = `${name}, ${countryCode}`;
      }
      
      return {
        q: query,
        format: 'json',
        polygon_geojson: '1',
        addressdetails: '1',
        limit: '1',
        featureType: 'city',
        ...(countryCode && { countrycodes: countryCode.toLowerCase() })
      };
    },
    reverseGeocode: (lat: number, lon: number) => ({
      lat: lat.toString(),
      lon: lon.toString(),
      format: 'json',
      addressdetails: '1'
    })
  },
  overpass: {
    countryBoundary: (name: string) => `
      [out:json][timeout:25];
      (
        relation["name"="${name}"]["admin_level"="2"]["type"="boundary"];
      );
      out geom;
    `,
    stateBoundary: (name: string, countryName?: string) => `
      [out:json][timeout:25];
      (
        relation["name"="${name}"]["admin_level"="4"]["type"="boundary"]${countryName ? `["is_in"~"${countryName}"]` : ''};
      );
      out geom;
    `
  },
  geonames: {
    search: (name: string, featureClass?: string) => ({
      q: name,
      maxRows: '1',
      type: 'json',
      ...(featureClass && { featureClass })
    })
  }
};

/**
 * Error codes and messages for API responses
 */
export const API_ERROR_CODES = {
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  TIMEOUT: 'TIMEOUT',
  NETWORK_ERROR: 'NETWORK_ERROR',
  INVALID_RESPONSE: 'INVALID_RESPONSE',
  NOT_FOUND: 'NOT_FOUND',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED'
};

export const API_ERROR_MESSAGES = {
  [API_ERROR_CODES.RATE_LIMIT_EXCEEDED]: 'API rate limit exceeded. Please try again later.',
  [API_ERROR_CODES.TIMEOUT]: 'Request timed out. Please check your connection.',
  [API_ERROR_CODES.NETWORK_ERROR]: 'Network error occurred. Please check your internet connection.',
  [API_ERROR_CODES.INVALID_RESPONSE]: 'Invalid response received from API.',
  [API_ERROR_CODES.NOT_FOUND]: 'Requested geographic data not found.',
  [API_ERROR_CODES.QUOTA_EXCEEDED]: 'API quota exceeded. Please try again later.',
  [API_ERROR_CODES.AUTHENTICATION_FAILED]: 'API authentication failed. Please check your credentials.'
};

/**
 * Get configuration based on environment
 */
export const getApiConfig = (environment: 'development' | 'production' = 'production'): GeographicApiConfiguration => {
  const baseConfig = DEFAULT_GEOGRAPHIC_API_CONFIG;
  
  if (environment === 'development') {
    return {
      ...baseConfig,
      ...DEVELOPMENT_CONFIG,
      nominatim: { ...baseConfig.nominatim, ...DEVELOPMENT_CONFIG.nominatim },
      caching: { ...baseConfig.caching, ...DEVELOPMENT_CONFIG.caching }
    };
  }
  
  if (environment === 'production') {
    return {
      ...baseConfig,
      ...PRODUCTION_CONFIG,
      nominatim: { ...baseConfig.nominatim, ...PRODUCTION_CONFIG.nominatim },
      fallback: { ...baseConfig.fallback, ...PRODUCTION_CONFIG.fallback }
    };
  }
  
  return baseConfig;
};

/**
 * Validate API configuration
 */
export const validateApiConfig = (config: GeographicApiConfiguration): boolean => {
  try {
    // Check required fields
    const requiredApis = ['nominatim', 'naturalEarth', 'restCountries'];
    
    for (const api of requiredApis) {
      const apiConfig = config[api as keyof GeographicApiConfiguration] as ApiEndpointConfig;
      
      if (!apiConfig || !apiConfig.baseUrl) {
        console.error(`Missing baseUrl for ${api} API configuration`);
        return false;
      }
      
      if (apiConfig.rateLimit <= 0) {
        console.error(`Invalid rate limit for ${api} API configuration`);
        return false;
      }
      
      if (apiConfig.timeout <= 0) {
        console.error(`Invalid timeout for ${api} API configuration`);
        return false;
      }
    }
    
    // Check caching configuration
    if (!config.caching || 
        config.caching.boundaryMaxAge <= 0 ||
        config.caching.geocodingMaxAge <= 0 ||
        config.caching.statisticsMaxAge <= 0) {
      console.error('Invalid caching configuration');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error validating API configuration:', error);
    return false;
  }
};

/**
 * Create URL with query parameters
 */
export const buildApiUrl = (baseUrl: string, endpoint: string, params: Record<string, string>): string => {
  const url = new URL(endpoint, baseUrl);
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, value);
    }
  });
  
  return url.toString();
};

/**
 * Get appropriate user agent string
 */
export const getUserAgent = (appName: string = 'Cartographer', version: string = '1.0'): string => {
  return `${appName}/${version} (https://github.com/cartographer-app)`;
};