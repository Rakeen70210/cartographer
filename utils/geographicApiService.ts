import {
  getRegionBoundary,
  getStatisticsCache,
  saveRegionBoundary,
  saveStatisticsCache
} from './database';
import { logger } from './logger';

/**
 * Geographic API Service for fetching real boundary data from multiple sources
 * 
 * Supported APIs:
 * - OpenStreetMap Nominatim (reverse geocoding, boundary data)
 * - Natural Earth (country boundaries)
 * - REST Countries (country metadata)
 * - Administrative boundaries from various sources
 */

export interface ApiConfig {
  nominatim: {
    baseUrl: string;
    userAgent: string;
    rateLimit: number; // requests per second
  };
  naturalEarth: {
    baseUrl: string;
    rateLimit: number;
  };
  restCountries: {
    baseUrl: string;
    rateLimit: number;
  };
}

export interface BoundaryApiResponse {
  type: 'country' | 'state' | 'city';
  name: string;
  displayName: string;
  code?: string;
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  area?: number;
  population?: number;
  bbox?: [number, number, number, number];
  source: 'nominatim' | 'naturalearth' | 'restcountries' | 'cache';
}

export interface RateLimiter {
  lastRequest: number;
  requestCount: number;
  windowStart: number;
}

// Default API configuration
const DEFAULT_CONFIG: ApiConfig = {
  nominatim: {
    baseUrl: 'https://nominatim.openstreetmap.org',
    userAgent: 'Cartographer/1.0 (https://github.com/cartographer-app)',
    rateLimit: 1 // 1 request per second as per Nominatim usage policy
  },
  naturalEarth: {
    baseUrl: 'https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA',
    rateLimit: 5 // More lenient for static data
  },
  restCountries: {
    baseUrl: 'https://restcountries.com/v3.1',
    rateLimit: 10 // REST Countries allows higher rates
  }
};

// Rate limiters for each API
const rateLimiters: Record<string, RateLimiter> = {
  nominatim: { lastRequest: 0, requestCount: 0, windowStart: 0 },
  naturalEarth: { lastRequest: 0, requestCount: 0, windowStart: 0 },
  restCountries: { lastRequest: 0, requestCount: 0, windowStart: 0 }
};

/**
 * Geographic API Service class
 */
export class GeographicApiService {
  private config: ApiConfig;
  private isOnline: boolean = true;

  constructor(config: Partial<ApiConfig> = {}) {
    this.config = {
      nominatim: { ...DEFAULT_CONFIG.nominatim, ...config.nominatim },
      naturalEarth: { ...DEFAULT_CONFIG.naturalEarth, ...config.naturalEarth },
      restCountries: { ...DEFAULT_CONFIG.restCountries, ...config.restCountries }
    };
  }

  /**
   * Get country boundary data from multiple sources with fallback
   */
  async getCountryBoundary(countryName: string, countryCode?: string): Promise<BoundaryApiResponse | null> {
    logger.debug(`GeographicApiService: Fetching country boundary for ${countryName}`);

    try {
      // Check cache first
      const cached = await this.getCachedBoundary('country', countryName);
      if (cached) {
        logger.debug(`GeographicApiService: Using cached boundary for ${countryName}`);
        return cached;
      }

      // Try multiple sources in order of preference
      const sources = [
        () => this.fetchFromNominatim('country', countryName, countryCode),
        () => this.fetchFromNaturalEarth(countryName, countryCode),
        () => this.fetchFromRestCountries(countryName, countryCode)
      ];

      for (const source of sources) {
        try {
          const result = await source();
          if (result) {
            // Cache successful result
            await this.cacheBoundaryData(result);
            return result;
          }
        } catch (error) {
          logger.debug(`GeographicApiService: Source failed for ${countryName}:`, error);
          continue;
        }
      }

      logger.warn(`GeographicApiService: No boundary data found for country: ${countryName}`);
      return null;

    } catch (error) {
      logger.error(`GeographicApiService: Error fetching country boundary for ${countryName}:`, error);
      return null;
    }
  }

  /**
   * Get state/province boundary data
   */
  async getStateBoundary(stateName: string, countryCode?: string): Promise<BoundaryApiResponse | null> {
    logger.debug(`GeographicApiService: Fetching state boundary for ${stateName}`);

    try {
      // Check cache first
      const cached = await this.getCachedBoundary('state', stateName);
      if (cached) {
        return cached;
      }

      // For states, primarily use Nominatim
      const result = await this.fetchFromNominatim('state', stateName, countryCode);
      if (result) {
        await this.cacheBoundaryData(result);
        return result;
      }

      logger.warn(`GeographicApiService: No boundary data found for state: ${stateName}`);
      return null;

    } catch (error) {
      logger.error(`GeographicApiService: Error fetching state boundary for ${stateName}:`, error);
      return null;
    }
  }

  /**
   * Get city boundary data
   */
  async getCityBoundary(cityName: string, stateCode?: string, countryCode?: string): Promise<BoundaryApiResponse | null> {
    logger.debug(`GeographicApiService: Fetching city boundary for ${cityName}`);

    try {
      // Check cache first
      const cached = await this.getCachedBoundary('city', cityName);
      if (cached) {
        return cached;
      }

      // For cities, use Nominatim
      const result = await this.fetchFromNominatim('city', cityName, countryCode, stateCode);
      if (result) {
        await this.cacheBoundaryData(result);
        return result;
      }

      logger.warn(`GeographicApiService: No boundary data found for city: ${cityName}`);
      return null;

    } catch (error) {
      logger.error(`GeographicApiService: Error fetching city boundary for ${cityName}:`, error);
      return null;
    }
  }

  /**
   * Fetch boundary data from OpenStreetMap Nominatim
   */
  private async fetchFromNominatim(
    type: 'country' | 'state' | 'city',
    name: string,
    countryCode?: string,
    stateCode?: string
  ): Promise<BoundaryApiResponse | null> {
    await this.enforceRateLimit('nominatim');

    try {
      // Build search query based on type
      let query = name;
      const params = new URLSearchParams({
        q: query,
        format: 'json',
        polygon_geojson: '1',
        addressdetails: '1',
        limit: '1'
      });

      // Add country filter if provided
      if (countryCode) {
        params.append('countrycodes', countryCode.toLowerCase());
      }

      // Add type-specific filters
      switch (type) {
        case 'country':
          params.append('featureType', 'country');
          break;
        case 'state':
          params.append('featureType', 'state');
          if (countryCode) {
            query += `, ${countryCode}`;
            params.set('q', query);
          }
          break;
        case 'city':
          params.append('featureType', 'city');
          if (stateCode && countryCode) {
            query += `, ${stateCode}, ${countryCode}`;
            params.set('q', query);
          } else if (countryCode) {
            query += `, ${countryCode}`;
            params.set('q', query);
          }
          break;
      }

      const url = `${this.config.nominatim.baseUrl}/search?${params.toString()}`;

      logger.debug(`GeographicApiService: Nominatim request: ${url}`);

      const response = await fetch(url, {
        headers: {
          'User-Agent': this.config.nominatim.userAgent
        },
        signal: AbortSignal.timeout(15000) // 15 second timeout
      });

      if (!response.ok) {
        throw new Error(`Nominatim API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (!data || data.length === 0) {
        return null;
      }

      const result = data[0];

      // Validate that we have geometry data
      if (!result.geojson || !result.geojson.coordinates) {
        logger.debug(`GeographicApiService: No geometry data in Nominatim response for ${name}`);
        return null;
      }

      return {
        type,
        name: result.display_name.split(',')[0].trim(),
        displayName: result.display_name,
        code: this.extractCode(result, type),
        geometry: result.geojson,
        bbox: result.boundingbox ? [
          parseFloat(result.boundingbox[2]), // west
          parseFloat(result.boundingbox[0]), // south
          parseFloat(result.boundingbox[3]), // east
          parseFloat(result.boundingbox[1])  // north
        ] : undefined,
        source: 'nominatim'
      };

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        logger.warn(`GeographicApiService: Nominatim request timeout for ${name}`);
      } else {
        logger.error(`GeographicApiService: Nominatim API error for ${name}:`, error);
      }
      throw error;
    }
  }

  /**
   * Fetch country data from Natural Earth (simplified boundaries)
   */
  private async fetchFromNaturalEarth(countryName: string, countryCode?: string): Promise<BoundaryApiResponse | null> {
    await this.enforceRateLimit('naturalEarth');

    try {
      // Natural Earth provides simplified world boundaries
      const url = `${this.config.naturalEarth.baseUrl}/world.geojson`;

      logger.debug(`GeographicApiService: Natural Earth request: ${url}`);

      const response = await fetch(url, {
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        throw new Error(`Natural Earth API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.features) {
        return null;
      }

      // Find the country in the features
      const country = data.features.find((feature: any) => {
        const props = feature.properties;
        return (
          props.NAME?.toLowerCase() === countryName.toLowerCase() ||
          props.NAME_EN?.toLowerCase() === countryName.toLowerCase() ||
          props.ISO_A2 === countryCode?.toUpperCase() ||
          props.ISO_A3 === countryCode?.toUpperCase()
        );
      });

      if (!country) {
        return null;
      }

      return {
        type: 'country',
        name: country.properties.NAME || country.properties.NAME_EN || countryName,
        displayName: country.properties.NAME_LONG || country.properties.NAME || countryName,
        code: country.properties.ISO_A2 || countryCode,
        geometry: country.geometry,
        population: country.properties.POP_EST,
        source: 'naturalearth'
      };

    } catch (error) {
      logger.error(`GeographicApiService: Natural Earth API error for ${countryName}:`, error);
      throw error;
    }
  }

  /**
   * Fetch country metadata from REST Countries API
   */
  private async fetchFromRestCountries(countryName: string, countryCode?: string): Promise<BoundaryApiResponse | null> {
    await this.enforceRateLimit('restCountries');

    try {
      // REST Countries doesn't provide geometry, but can provide metadata
      // This is mainly used as a fallback for country validation
      const searchTerm = countryCode || countryName;
      const endpoint = countryCode ? 'alpha' : 'name';
      const url = `${this.config.restCountries.baseUrl}/${endpoint}/${searchTerm}`;

      logger.debug(`GeographicApiService: REST Countries request: ${url}`);

      const response = await fetch(url, {
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        throw new Error(`REST Countries API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const country = Array.isArray(data) ? data[0] : data;

      if (!country) {
        return null;
      }

      // REST Countries doesn't provide geometry, so we create a basic bounding box
      // This is mainly for validation and metadata
      const latlng = country.latlng;
      if (!latlng || latlng.length !== 2) {
        return null;
      }

      // Create a simple point geometry (not ideal, but better than nothing)
      const geometry: GeoJSON.Polygon = {
        type: 'Polygon',
        coordinates: [[
          [latlng[1] - 1, latlng[0] - 1],
          [latlng[1] + 1, latlng[0] - 1],
          [latlng[1] + 1, latlng[0] + 1],
          [latlng[1] - 1, latlng[0] + 1],
          [latlng[1] - 1, latlng[0] - 1]
        ]]
      };

      return {
        type: 'country',
        name: country.name.common,
        displayName: country.name.official,
        code: country.cca2,
        geometry,
        area: country.area,
        population: country.population,
        source: 'restcountries'
      };

    } catch (error) {
      logger.error(`GeographicApiService: REST Countries API error for ${countryName}:`, error);
      throw error;
    }
  }

  /**
   * Get cached boundary data
   */
  private async getCachedBoundary(type: 'country' | 'state' | 'city', name: string): Promise<BoundaryApiResponse | null> {
    try {
      const cached = await getRegionBoundary(type, name);
      if (!cached) {
        return null;
      }

      // Check if cache is still valid (7 days for boundaries)
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
      if (Date.now() - cached.timestamp > maxAge) {
        return null;
      }

      return {
        type,
        name: cached.region_name,
        displayName: cached.region_name,
        geometry: JSON.parse(cached.boundary_geojson),
        area: cached.area_km2,
        source: 'cache'
      };

    } catch (error) {
      logger.debug(`GeographicApiService: Error getting cached boundary for ${name}:`, error);
      return null;
    }
  }

  /**
   * Cache boundary data
   */
  private async cacheBoundaryData(boundary: BoundaryApiResponse): Promise<void> {
    try {
      await saveRegionBoundary(
        boundary.type,
        boundary.name,
        boundary.geometry,
        boundary.area
      );
      logger.debug(`GeographicApiService: Cached boundary data for ${boundary.name}`);
    } catch (error) {
      logger.warn(`GeographicApiService: Failed to cache boundary data for ${boundary.name}:`, error);
    }
  }

  /**
   * Enforce rate limiting for API calls
   */
  private async enforceRateLimit(apiName: keyof typeof rateLimiters): Promise<void> {
    const limiter = rateLimiters[apiName];
    const config = this.config[apiName];
    const now = Date.now();

    // Reset window if it's been more than 1 second
    if (now - limiter.windowStart > 1000) {
      limiter.windowStart = now;
      limiter.requestCount = 0;
    }

    // Check if we've exceeded the rate limit
    if (limiter.requestCount >= config.rateLimit) {
      const waitTime = 1000 - (now - limiter.windowStart);
      if (waitTime > 0) {
        logger.debug(`GeographicApiService: Rate limiting ${apiName}, waiting ${waitTime}ms`);
        await new Promise(resolve => setTimeout(resolve, waitTime));

        // Reset after waiting
        limiter.windowStart = Date.now();
        limiter.requestCount = 0;
      }
    }

    limiter.requestCount++;
    limiter.lastRequest = now;
  }

  /**
   * Extract appropriate code from API response
   */
  private extractCode(result: any, type: 'country' | 'state' | 'city'): string | undefined {
    if (type === 'country') {
      return result.address?.country_code?.toUpperCase();
    } else if (type === 'state') {
      return result.address?.state_code || result.address?.ISO3166_2_lvl4;
    }
    return undefined;
  }

  /**
   * Check if service is online
   */
  async checkConnectivity(): Promise<boolean> {
    try {
      // Simple connectivity check using a lightweight endpoint
      const response = await fetch('https://httpbin.org/status/200', {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000)
      });
      this.isOnline = response.ok;
      return this.isOnline;
    } catch (error) {
      this.isOnline = false;
      return false;
    }
  }

  /**
   * Get service status
   */
  getStatus(): {
    isOnline: boolean;
    config: ApiConfig;
    rateLimiters: Record<string, RateLimiter>;
  } {
    return {
      isOnline: this.isOnline,
      config: this.config,
      rateLimiters: { ...rateLimiters }
    };
  }
}

// Export singleton instance
export const geographicApiService = new GeographicApiService();

/**
 * Utility functions for data transformation
 */

/**
 * Transform API response to standardized GeoJSON format
 */
export const transformToStandardGeoJSON = (
  apiResponse: BoundaryApiResponse
): GeoJSON.Feature => {
  return {
    type: 'Feature',
    properties: {
      name: apiResponse.name,
      displayName: apiResponse.displayName,
      type: apiResponse.type,
      code: apiResponse.code,
      area: apiResponse.area,
      population: apiResponse.population,
      source: apiResponse.source
    },
    geometry: apiResponse.geometry
  };
};

/**
 * Validate GeoJSON geometry
 */
export const validateGeoJSONGeometry = (geometry: any): boolean => {
  try {
    if (!geometry || !geometry.type) {
      return false;
    }

    if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') {
      return false;
    }

    if (!geometry.coordinates || !Array.isArray(geometry.coordinates)) {
      return false;
    }

    // Basic coordinate validation
    if (geometry.type === 'Polygon') {
      return geometry.coordinates.every((ring: any) =>
        Array.isArray(ring) && ring.length >= 4
      );
    } else if (geometry.type === 'MultiPolygon') {
      return geometry.coordinates.every((polygon: any) =>
        Array.isArray(polygon) && polygon.every((ring: any) =>
          Array.isArray(ring) && ring.length >= 4
        )
      );
    }

    return false;
  } catch (error) {
    return false;
  }
};

/**
 * Simplify geometry to reduce complexity
 */
export const simplifyGeometry = (
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon,
  tolerance: number = 0.01
): GeoJSON.Polygon | GeoJSON.MultiPolygon => {
  // This is a basic implementation - in production you might use turf.simplify
  // For now, just return the original geometry
  return geometry;
};

/**
 * Get total region counts from various sources
 */
export const getTotalRegionCounts = async (): Promise<{
  countries: number;
  states: number;
  cities: number;
}> => {
  try {
    // Check cache first
    const cacheKey = 'total_region_counts';
    const cached = await getStatisticsCache(cacheKey);

    if (cached) {
      const age = Date.now() - cached.timestamp;
      // Cache for 24 hours
      if (age < 24 * 60 * 60 * 1000) {
        return JSON.parse(cached.cache_value);
      }
    }

    // Fetch from APIs or use known approximations
    const counts = {
      countries: 195, // UN recognized countries
      states: 3142, // Approximate number of first-level subdivisions worldwide
      cities: 10000 // Approximate number of major cities worldwide
    };

    // Cache the result
    await saveStatisticsCache(cacheKey, counts);

    return counts;
  } catch (error) {
    logger.error('GeographicApiService: Error getting total region counts:', error);

    // Return fallback values
    return {
      countries: 195,
      states: 3142,
      cities: 10000
    };
  }
};