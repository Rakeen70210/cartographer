
import { bbox, bboxPolygon } from '@turf/turf';

import { RevealedArea } from '@/utils/geometryValidation';
import { logger } from '@/utils/logger';

/**
 * Configuration options for spatial indexing operations
 * Controls how spatial queries are performed and optimized
 */
export interface SpatialIndexOptions {
  /** Maximum number of features to return from spatial queries */
  maxResults?: number;
  /** Buffer distance in degrees to expand query bounds for intersection tests */
  bufferDistance?: number;
  /** Whether to use level-of-detail optimization for distant features */
  useLevelOfDetail?: boolean;
  /** Zoom level for level-of-detail calculations (higher = more detail) */
  zoomLevel?: number;
}

/**
 * Level-of-detail configuration for spatial features
 * Controls how features are simplified based on distance and zoom level
 */
export interface LevelOfDetailConfig {
  /** Minimum zoom level where full detail is shown */
  fullDetailZoom: number;
  /** Maximum distance (in degrees) for full detail rendering */
  fullDetailDistance: number;
  /** Simplification tolerance for medium detail level */
  mediumDetailTolerance: number;
  /** Simplification tolerance for low detail level */
  lowDetailTolerance: number;
}

/**
 * Spatial query result containing features and metadata
 * Provides features matching spatial criteria along with performance metrics
 */
export interface SpatialQueryResult {
  /** Features that match the spatial query criteria */
  features: RevealedArea[];
  /** Total number of features in the index */
  totalFeatures: number;
  /** Number of features returned (may be limited by maxResults) */
  returnedFeatures: number;
  /** Query execution time in milliseconds */
  queryTime: number;
  /** Whether level-of-detail optimization was applied */
  levelOfDetailApplied: boolean;
  /** Bounding box used for the query */
  queryBounds: [number, number, number, number];
}

/**
 * Memory usage statistics for the spatial index
 * Tracks memory consumption and provides optimization insights
 */
export interface SpatialIndexMemoryStats {
  /** Estimated memory usage in bytes */
  estimatedMemoryUsage: number;
  /** Number of features currently indexed */
  featureCount: number;
  /** Average feature complexity (vertices per feature) */
  averageComplexity: number;
  /** Memory usage per feature in bytes */
  memoryPerFeature: number;
  /** Recommended action based on memory usage */
  recommendation: 'optimal' | 'consider_cleanup' | 'cleanup_required';
}

/**
 * Default level-of-detail configuration
 * Provides reasonable defaults for feature simplification based on zoom and distance
 */
const DEFAULT_LOD_CONFIG: LevelOfDetailConfig = {
  fullDetailZoom: 12,
  fullDetailDistance: 0.01, // ~1km at equator
  mediumDetailTolerance: 0.001, // ~100m simplification
  lowDetailTolerance: 0.005, // ~500m simplification
};

/**
 * Default spatial index options
 */
const DEFAULT_SPATIAL_OPTIONS: Required<SpatialIndexOptions> = {
  maxResults: 1000,
  bufferDistance: 0.001, // Small buffer for intersection tolerance
  useLevelOfDetail: true,
  zoomLevel: 10,
};

/**
 * Spatial index for efficient querying of revealed areas
 * Provides fast spatial queries using R-tree indexing for large datasets
 * Includes level-of-detail optimization and memory management
 * 
 * @example
 * ```typescript
 * const spatialIndex = new SpatialIndex();
 * 
 * // Add revealed areas to index
 * await spatialIndex.addFeatures(revealedAreas);
 * 
 * // Query features in viewport
 * const result = spatialIndex.queryViewport(viewportBounds);
 * console.log(`Found ${result.features.length} features in viewport`);
 * ```
 */
export class SpatialIndex {
  private index: any; // RBush index from @turf/geojson-rbush
  private features: Map<string, RevealedArea> = new Map();
  private lodConfig: LevelOfDetailConfig;
  private memoryThreshold: number = 50 * 1024 * 1024; // 50MB threshold
  
  /**
   * Creates a new spatial index instance
   * 
   * @param lodConfig - Level-of-detail configuration (optional)
   * @param memoryThreshold - Memory usage threshold in bytes for cleanup recommendations
   */
  constructor(lodConfig?: Partial<LevelOfDetailConfig>, memoryThreshold?: number) {
    try {
      const geojsonRbush = require('@turf/geojson-rbush').default;
      this.index = geojsonRbush();
    } catch (error) {
      logger.error('SpatialIndex: Failed to initialize geojson-rbush:', error);
      // Fallback to a simple object with the required interface
      this.index = {
        insert: () => {},
        load: () => {},
        search: () => ({ features: [] }),
        remove: () => {},
        clear: () => {},
      };
    }
    
    this.lodConfig = { ...DEFAULT_LOD_CONFIG, ...lodConfig };
    if (memoryThreshold) {
      this.memoryThreshold = memoryThreshold;
    }
    
    logger.debug('SpatialIndex: Created new spatial index');
  }
  
  /**
   * Adds a single feature to the spatial index
   * Validates feature geometry and assigns unique ID for tracking
   * 
   * @param feature - Revealed area feature to add to index
   * @returns Promise that resolves when feature is added
   * 
   * @example
   * ```typescript
   * await spatialIndex.addFeature(revealedArea);
   * ```
   */
  async addFeature(feature: RevealedArea): Promise<void> {
    try {
      if (!this.isValidFeature(feature)) {
        logger.warn('SpatialIndex: Skipping invalid feature');
        return;
      }
      
      // Generate unique ID if not present
      const featureId = feature.properties?.id || `feature_${Date.now()}_${Math.random()}`;
      const indexableFeature = {
        ...feature,
        properties: {
          ...feature.properties,
          id: featureId,
        },
      };
      
      // Add to index
      this.index.insert(indexableFeature);
      
      // Store in feature map for retrieval
      this.features.set(featureId, indexableFeature);
      
      logger.debugThrottled('SpatialIndex: Added feature to index', 5000);
      
    } catch (error) {
      logger.error('SpatialIndex: Error adding feature to index:', error);
      throw error;
    }
  }
  
  /**
   * Adds multiple features to the spatial index in batch
   * More efficient than adding features individually for large datasets
   * 
   * @param features - Array of revealed area features to add
   * @returns Promise that resolves when all features are added
   * 
   * @example
   * ```typescript
   * await spatialIndex.addFeatures(revealedAreasArray);
   * ```
   */
  async addFeatures(features: RevealedArea[]): Promise<void> {
    const startTime = performance.now();
    
    try {
      const validFeatures: RevealedArea[] = [];
      
      // Validate and prepare features
      for (const feature of features) {
        if (this.isValidFeature(feature)) {
          const featureId = feature.properties?.id || `feature_${Date.now()}_${Math.random()}`;
          const indexableFeature = {
            ...feature,
            properties: {
              ...feature.properties,
              id: featureId,
            },
          };
          
          validFeatures.push(indexableFeature);
          this.features.set(featureId, indexableFeature);
        }
      }
      
      if (validFeatures.length === 0) {
        logger.warn('SpatialIndex: No valid features to add to index');
        return;
      }
      
      // Batch insert into index
      this.index.load({
        type: 'FeatureCollection',
        features: validFeatures,
      });
      
      const executionTime = performance.now() - startTime;
      logger.debug(`SpatialIndex: Added ${validFeatures.length} features to index in ${executionTime.toFixed(2)}ms`);
      
    } catch (error) {
      logger.error('SpatialIndex: Error adding features to index:', error);
      throw error;
    }
  }
  
  /**
   * Queries features within the specified viewport bounds
   * Returns features that intersect with the viewport using spatial indexing
   * Applies level-of-detail optimization based on zoom level and distance
   * 
   * @param bounds - Viewport bounds as [minLng, minLat, maxLng, maxLat]
   * @param options - Query options for filtering and optimization
   * @returns Spatial query result with matching features and metadata
   * 
   * @example
   * ```typescript
   * const viewportBounds: [number, number, number, number] = [-74.1, 40.7, -73.9, 40.8];
   * const result = spatialIndex.queryViewport(viewportBounds, { maxResults: 100 });
   * ```
   */
  queryViewport(
    bounds: [number, number, number, number],
    options: SpatialIndexOptions = {}
  ): SpatialQueryResult {
    const startTime = performance.now();
    const config = { ...DEFAULT_SPATIAL_OPTIONS, ...options };
    
    try {
      // Validate bounds
      const [minLng, minLat, maxLng, maxLat] = bounds;
      if (minLng >= maxLng || minLat >= maxLat) {
        throw new Error(`Invalid viewport bounds: [${minLng}, ${minLat}, ${maxLng}, ${maxLat}]`);
      }
      
      // Create query bounds with optional buffer
      const queryBounds: [number, number, number, number] = [
        minLng - config.bufferDistance,
        minLat - config.bufferDistance,
        maxLng + config.bufferDistance,
        maxLat + config.bufferDistance,
      ];
      
      // Create bounding box polygon for query
      const queryPolygon = bboxPolygon(queryBounds);
      
      // Perform spatial query
      const searchResults = this.index.search(queryPolygon);
      
      // Extract features from search results
      let features: RevealedArea[] = [];
      if (searchResults && searchResults.features) {
        features = searchResults.features.slice(0, config.maxResults);
      }
      
      // Apply level-of-detail optimization if enabled
      let levelOfDetailApplied = false;
      if (config.useLevelOfDetail && config.zoomLevel) {
        features = this.applyLevelOfDetail(features, bounds, config.zoomLevel);
        levelOfDetailApplied = true;
      }
      
      const queryTime = performance.now() - startTime;
      
      logger.debugThrottled(
        `SpatialIndex: Viewport query returned ${features.length} features in ${queryTime.toFixed(2)}ms`,
        3000
      );
      
      return {
        features,
        totalFeatures: this.features.size,
        returnedFeatures: features.length,
        queryTime,
        levelOfDetailApplied,
        queryBounds,
      };
      
    } catch (error) {
      logger.error('SpatialIndex: Error querying viewport:', error);
      
      // Return empty result on error
      return {
        features: [],
        totalFeatures: this.features.size,
        returnedFeatures: 0,
        queryTime: performance.now() - startTime,
        levelOfDetailApplied: false,
        queryBounds: bounds,
      };
    }
  }
  
  /**
   * Queries features within a specified distance of a point
   * Useful for finding revealed areas near the user's current location
   * 
   * @param center - Center point as [longitude, latitude]
   * @param radiusDegrees - Search radius in degrees
   * @param options - Query options for filtering and optimization
   * @returns Spatial query result with matching features and metadata
   * 
   * @example
   * ```typescript
   * const userLocation: [number, number] = [-74.0060, 40.7128];
   * const nearbyFeatures = spatialIndex.queryRadius(userLocation, 0.01); // ~1km radius
   * ```
   */
  queryRadius(
    center: [number, number],
    radiusDegrees: number,
    options: SpatialIndexOptions = {}
  ): SpatialQueryResult {
    const [lng, lat] = center;
    
    // Create bounding box around the center point
    const bounds: [number, number, number, number] = [
      lng - radiusDegrees,
      lat - radiusDegrees,
      lng + radiusDegrees,
      lat + radiusDegrees,
    ];
    
    return this.queryViewport(bounds, options);
  }
  
  /**
   * Removes a feature from the spatial index
   * 
   * @param featureId - Unique ID of the feature to remove
   * @returns Promise that resolves when feature is removed
   * 
   * @example
   * ```typescript
   * await spatialIndex.removeFeature('feature_123');
   * ```
   */
  async removeFeature(featureId: string): Promise<void> {
    try {
      const feature = this.features.get(featureId);
      if (!feature) {
        logger.warn(`SpatialIndex: Feature ${featureId} not found for removal`);
        return;
      }
      
      // Remove from index
      this.index.remove(feature);
      
      // Remove from feature map
      this.features.delete(featureId);
      
      logger.debugThrottled('SpatialIndex: Removed feature from index', 5000);
      
    } catch (error) {
      logger.error('SpatialIndex: Error removing feature from index:', error);
      throw error;
    }
  }
  
  /**
   * Clears all features from the spatial index
   * Useful for resetting the index or cleaning up memory
   * 
   * @returns Promise that resolves when index is cleared
   * 
   * @example
   * ```typescript
   * await spatialIndex.clear();
   * ```
   */
  async clear(): Promise<void> {
    try {
      this.index.clear();
      this.features.clear();
      
      logger.debug('SpatialIndex: Cleared all features from index');
      
    } catch (error) {
      logger.error('SpatialIndex: Error clearing index:', error);
      throw error;
    }
  }
  
  /**
   * Gets memory usage statistics for the spatial index
   * Provides insights into memory consumption and optimization opportunities
   * 
   * @returns Memory usage statistics and recommendations
   * 
   * @example
   * ```typescript
   * const stats = spatialIndex.getMemoryStats();
   * if (stats.recommendation === 'cleanup_required') {
   *   await spatialIndex.optimizeMemory();
   * }
   * ```
   */
  getMemoryStats(): SpatialIndexMemoryStats {
    const featureCount = this.features.size;
    
    if (featureCount === 0) {
      return {
        estimatedMemoryUsage: 0,
        featureCount: 0,
        averageComplexity: 0,
        memoryPerFeature: 0,
        recommendation: 'optimal',
      };
    }
    
    // Estimate memory usage based on feature count and complexity
    let totalComplexity = 0;
    for (const feature of this.features.values()) {
      totalComplexity += this.estimateFeatureComplexity(feature);
    }
    
    const averageComplexity = totalComplexity / featureCount;
    
    // Rough estimation: base overhead + complexity-based memory
    const baseMemoryPerFeature = 1024; // 1KB base overhead per feature
    const complexityMemoryPerVertex = 64; // 64 bytes per vertex
    const memoryPerFeature = baseMemoryPerFeature + (averageComplexity * complexityMemoryPerVertex);
    const estimatedMemoryUsage = featureCount * memoryPerFeature;
    
    // Determine recommendation based on memory usage
    let recommendation: 'optimal' | 'consider_cleanup' | 'cleanup_required';
    if (estimatedMemoryUsage > this.memoryThreshold) {
      recommendation = 'cleanup_required';
    } else if (estimatedMemoryUsage > this.memoryThreshold * 0.7) {
      recommendation = 'consider_cleanup';
    } else {
      recommendation = 'optimal';
    }
    
    return {
      estimatedMemoryUsage,
      featureCount,
      averageComplexity,
      memoryPerFeature,
      recommendation,
    };
  }
  
  /**
   * Optimizes memory usage by removing redundant or low-priority features
   * Implements cleanup strategies based on feature age, size, and importance
   * 
   * @param aggressiveCleanup - Whether to perform aggressive cleanup (removes more features)
   * @returns Promise that resolves when optimization is complete
   * 
   * @example
   * ```typescript
   * // Gentle cleanup
   * await spatialIndex.optimizeMemory(false);
   * 
   * // Aggressive cleanup when memory is critical
   * await spatialIndex.optimizeMemory(true);
   * ```
   */
  async optimizeMemory(aggressiveCleanup: boolean = false): Promise<void> {
    const startTime = performance.now();
    const initialFeatureCount = this.features.size;
    
    try {
      if (initialFeatureCount === 0) {
        logger.debug('SpatialIndex: No features to optimize');
        return;
      }
      
      const features = Array.from(this.features.values());
      const featuresToKeep: RevealedArea[] = [];
      
      // Sort features by priority (larger areas and more recent features have higher priority)
      const prioritizedFeatures = features
        .map(feature => ({
          feature,
          area: this.estimateFeatureArea(feature),
          timestamp: feature.properties?.timestamp || 0,
          complexity: this.estimateFeatureComplexity(feature),
        }))
        .sort((a, b) => {
          // Primary sort: area (larger areas first)
          const areaDiff = b.area - a.area;
          if (Math.abs(areaDiff) > 0.0001) return areaDiff;
          
          // Secondary sort: timestamp (newer first)
          return b.timestamp - a.timestamp;
        });
      
      // Determine how many features to keep
      const keepRatio = aggressiveCleanup ? 0.5 : 0.7; // Keep 50% or 70% of features
      const maxFeaturesToKeep = Math.max(1, Math.floor(initialFeatureCount * keepRatio));
      
      // Keep the highest priority features
      for (let i = 0; i < Math.min(maxFeaturesToKeep, prioritizedFeatures.length); i++) {
        featuresToKeep.push(prioritizedFeatures[i].feature);
      }
      
      // Rebuild the index with optimized features
      await this.clear();
      await this.addFeatures(featuresToKeep);
      
      const executionTime = performance.now() - startTime;
      const removedCount = initialFeatureCount - featuresToKeep.length;
      
      logger.info(
        `SpatialIndex: Memory optimization complete - removed ${removedCount} features, ` +
        `kept ${featuresToKeep.length} features in ${executionTime.toFixed(2)}ms`
      );
      
    } catch (error) {
      logger.error('SpatialIndex: Error optimizing memory:', error);
      throw error;
    }
  }
  
  /**
   * Gets the total number of features in the index
   * 
   * @returns Number of features currently indexed
   */
  getFeatureCount(): number {
    return this.features.size;
  }
  
  /**
   * Checks if the index is empty
   * 
   * @returns True if index contains no features
   */
  isEmpty(): boolean {
    return this.features.size === 0;
  }
  
  /**
   * Validates that a feature is suitable for spatial indexing
   * 
   * @param feature - Feature to validate
   * @returns True if feature is valid for indexing
   * 
   * @private
   */
  private isValidFeature(feature: any): feature is RevealedArea {
    return (
      feature &&
      feature.type === 'Feature' &&
      feature.geometry &&
      (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') &&
      feature.geometry.coordinates &&
      Array.isArray(feature.geometry.coordinates) &&
      feature.geometry.coordinates.length > 0
    );
  }
  
  /**
   * Applies level-of-detail optimization to features based on zoom level and distance
   * Simplifies distant or small features to improve rendering performance
   * 
   * @param features - Features to optimize
   * @param viewportBounds - Current viewport bounds
   * @param zoomLevel - Current map zoom level
   * @returns Optimized features with level-of-detail applied
   * 
   * @private
   */
  private applyLevelOfDetail(
    features: RevealedArea[],
    viewportBounds: [number, number, number, number],
    zoomLevel: number
  ): RevealedArea[] {
    try {
      // Calculate viewport center for distance calculations
      const [minLng, minLat, maxLng, maxLat] = viewportBounds;
      const centerLng = (minLng + maxLng) / 2;
      const centerLat = (minLat + maxLat) / 2;
      
      return features.filter(feature => {
        try {
          // Calculate distance from viewport center to feature
          const featureBounds = bbox(feature);
          const featureCenterLng = (featureBounds[0] + featureBounds[2]) / 2;
          const featureCenterLat = (featureBounds[1] + featureBounds[3]) / 2;
          
          const distance = Math.sqrt(
            Math.pow(featureCenterLng - centerLng, 2) + Math.pow(featureCenterLat - centerLat, 2)
          );
          
          // Apply level-of-detail filtering
          if (zoomLevel >= this.lodConfig.fullDetailZoom) {
            // High zoom: show all features
            return true;
          } else if (distance <= this.lodConfig.fullDetailDistance) {
            // Close features: always show
            return true;
          } else {
            // Distant features: show only if they're large enough
            const featureArea = this.estimateFeatureArea(feature);
            const minAreaThreshold = Math.pow(10, -(zoomLevel - 5)); // Smaller threshold at higher zoom
            return featureArea > minAreaThreshold;
          }
        } catch (error) {
          logger.warn('SpatialIndex: Error applying level-of-detail to feature:', error);
          return true; // Include feature if LOD calculation fails
        }
      });
    } catch (error) {
      logger.error('SpatialIndex: Error in level-of-detail processing:', error);
      return features; // Return original features if LOD fails
    }
  }
  
  /**
   * Estimates the complexity of a feature (number of vertices)
   * 
   * @param feature - Feature to analyze
   * @returns Estimated number of vertices in the feature
   * 
   * @private
   */
  private estimateFeatureComplexity(feature: RevealedArea): number {
    try {
      let vertexCount = 0;
      
      if (feature.geometry.type === 'Polygon') {
        feature.geometry.coordinates.forEach(ring => {
          vertexCount += ring.length;
        });
      } else if (feature.geometry.type === 'MultiPolygon') {
        feature.geometry.coordinates.forEach(polygon => {
          polygon.forEach(ring => {
            vertexCount += ring.length;
          });
        });
      }
      
      return vertexCount;
    } catch (error) {
      logger.warn('SpatialIndex: Error estimating feature complexity:', error);
      return 10; // Default complexity estimate
    }
  }
  
  /**
   * Estimates the area of a feature in square degrees
   * 
   * @param feature - Feature to analyze
   * @returns Estimated area in square degrees
   * 
   * @private
   */
  private estimateFeatureArea(feature: RevealedArea): number {
    try {
      const featureBounds = bbox(feature);
      const width = featureBounds[2] - featureBounds[0];
      const height = featureBounds[3] - featureBounds[1];
      return width * height;
    } catch (error) {
      logger.warn('SpatialIndex: Error estimating feature area:', error);
      return 0.0001; // Default small area
    }
  }
}

/**
 * Global spatial index instance for revealed areas
 * Provides a singleton pattern for efficient memory usage and consistent indexing
 */
let globalSpatialIndex: SpatialIndex | null = null;

/**
 * Gets or creates the global spatial index instance
 * Implements singleton pattern to ensure consistent indexing across the application
 * 
 * @param lodConfig - Level-of-detail configuration (only used on first creation)
 * @param memoryThreshold - Memory threshold (only used on first creation)
 * @returns Global spatial index instance
 * 
 * @example
 * ```typescript
 * const spatialIndex = getGlobalSpatialIndex();
 * await spatialIndex.addFeatures(revealedAreas);
 * ```
 */
export const getGlobalSpatialIndex = (
  lodConfig?: Partial<LevelOfDetailConfig>,
  memoryThreshold?: number
): SpatialIndex => {
  if (!globalSpatialIndex) {
    globalSpatialIndex = new SpatialIndex(lodConfig, memoryThreshold);
    logger.debug('SpatialIndex: Created global spatial index instance');
  }
  return globalSpatialIndex;
};

/**
 * Resets the global spatial index instance
 * Useful for testing or when a complete reset is needed
 * 
 * @example
 * ```typescript
 * resetGlobalSpatialIndex(); // Creates fresh index on next access
 * ```
 */
export const resetGlobalSpatialIndex = (): void => {
  globalSpatialIndex = null;
  logger.debug('SpatialIndex: Reset global spatial index instance');
};

export default SpatialIndex;