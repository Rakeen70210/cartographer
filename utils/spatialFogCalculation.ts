
import { getRevealedAreas, getRevealedAreasInViewport } from '@/utils/database';
import {
    createFogWithFallback,
    createWorldFogCollection,
    FogCalculationOptions,
    FogCalculationResult,
    getDefaultFogOptions
} from '@/utils/fogCalculation';
import { unionPolygons } from '@/utils/geometryOperations';
import { RevealedArea } from '@/utils/geometryValidation';
import { logger } from '@/utils/logger';
import {
    getGlobalSpatialIndex,
    SpatialIndex,
    SpatialIndexOptions,
    SpatialQueryResult
} from '@/utils/spatialIndex';

/**
 * Configuration options for spatial fog calculation
 * Extends standard fog calculation options with spatial indexing parameters
 */
export interface SpatialFogCalculationOptions extends FogCalculationOptions {
  /** Whether to use spatial indexing for viewport queries (default: true) */
  useSpatialIndexing?: boolean;
  /** Maximum number of features to load from spatial index (default: 1000) */
  maxSpatialResults?: number;
  /** Whether to rebuild spatial index if it's empty (default: true) */
  rebuildIndexIfEmpty?: boolean;
  /** Whether to use level-of-detail optimization (default: true) */
  useLevelOfDetail?: boolean;
  /** Current zoom level for level-of-detail calculations */
  zoomLevel?: number;
  /** Whether to use caching for fog calculations (default: true) */
  useCache?: boolean;
}

/**
 * Result of spatial fog calculation including spatial indexing metrics
 * Extends standard fog calculation result with spatial query information
 */
export interface SpatialFogCalculationResult extends FogCalculationResult {
  /** Spatial query result if spatial indexing was used */
  spatialQueryResult?: SpatialQueryResult;
  /** Whether spatial indexing was used for this calculation */
  usedSpatialIndexing: boolean;
  /** Number of features loaded from database vs spatial index */
  dataSourceStats: {
    fromDatabase: number;
    fromSpatialIndex: number;
    totalProcessed: number;
  };
}

/**
 * Default options for spatial fog calculation
 */
const DEFAULT_SPATIAL_FOG_OPTIONS: Required<SpatialFogCalculationOptions> = {
  viewportBounds: undefined as any, // Will be set by caller
  bufferDistance: undefined,
  useViewportOptimization: true,
  performanceMode: 'accurate',
  fallbackStrategy: 'viewport',
  useSpatialIndexing: true,
  maxSpatialResults: 1000,
  rebuildIndexIfEmpty: true,
  useLevelOfDetail: true,
  zoomLevel: 10,
  useCache: true,
};

/**
 * Manages spatial indexing for revealed areas with automatic updates
 * Provides high-level interface for spatial fog calculations with caching and optimization
 * 
 * @example
 * ```typescript
 * const manager = new SpatialFogManager();
 * 
 * // Initialize with revealed areas from database
 * await manager.initialize();
 * 
 * // Calculate fog for viewport using spatial indexing
 * const result = await manager.calculateSpatialFog(viewportBounds, options);
 * ```
 */
export class SpatialFogManager {
  private spatialIndex: SpatialIndex;
  private isInitialized: boolean = false;
  private lastIndexUpdate: number = 0;
  private indexUpdateInterval: number = 30000; // 30 seconds
  
  /**
   * Creates a new spatial fog manager
   * 
   * @param customIndex - Optional custom spatial index instance
   */
  constructor(customIndex?: SpatialIndex) {
    this.spatialIndex = customIndex || getGlobalSpatialIndex();
    logger.debug('SpatialFogManager: Created new spatial fog manager');
  }
  
  /**
   * Initializes the spatial fog manager by loading revealed areas from database
   * Should be called once before using spatial fog calculations
   * 
   * @param forceReload - Whether to force reload even if already initialized
   * @returns Promise that resolves when initialization is complete
   * 
   * @example
   * ```typescript
   * await spatialFogManager.initialize();
   * ```
   */
  async initialize(forceReload: boolean = false): Promise<void> {
    if (this.isInitialized && !forceReload) {
      logger.debugThrottled('SpatialFogManager: Already initialized', 10000);
      return;
    }
    
    const startTime = performance.now();
    
    try {
      logger.debug('SpatialFogManager: Initializing spatial index with revealed areas');
      
      // Clear existing index
      await this.spatialIndex.clear();
      
      // Load all revealed areas from database
      const revealedAreasData = await getRevealedAreas();
      
      if (revealedAreasData.length === 0) {
        logger.debug('SpatialFogManager: No revealed areas found in database');
        this.isInitialized = true;
        this.lastIndexUpdate = Date.now();
        return;
      }
      
      // Convert to proper RevealedArea features and add to spatial index
      const validFeatures: RevealedArea[] = revealedAreasData
        .filter(area => area && typeof area === 'object')
        .map(area => area as RevealedArea)
        .filter(area => area.type === 'Feature' && area.geometry);
      
      if (validFeatures.length > 0) {
        await this.spatialIndex.addFeatures(validFeatures);
      }
      
      this.isInitialized = true;
      this.lastIndexUpdate = Date.now();
      
      const executionTime = performance.now() - startTime;
      logger.info(
        `SpatialFogManager: Initialized spatial index with ${validFeatures.length} features ` +
        `in ${executionTime.toFixed(2)}ms`
      );
      
    } catch (error) {
      logger.error('SpatialFogManager: Error initializing spatial index:', error);
      this.isInitialized = false;
      throw error;
    }
  }
  
  /**
   * Calculates fog using spatial indexing for optimal performance
   * Automatically uses spatial index for viewport queries when available
   * Falls back to standard fog calculation if spatial indexing fails
   * 
   * @param options - Spatial fog calculation options
   * @returns Promise resolving to spatial fog calculation result
   * 
   * @example
   * ```typescript
   * const result = await spatialFogManager.calculateSpatialFog({
   *   viewportBounds: [-74.1, 40.7, -73.9, 40.8],
   *   useSpatialIndexing: true,
   *   maxSpatialResults: 500
   * });
   * ```
   */
  async calculateSpatialFog(
    options: SpatialFogCalculationOptions
  ): Promise<SpatialFogCalculationResult> {
    const startTime = performance.now();
    const config = { ...DEFAULT_SPATIAL_FOG_OPTIONS, ...options };
    
    // Check cache first if enabled and viewport bounds are available
    if (config.useCache && config.viewportBounds) {
      try {
        const cacheManager = getGlobalFogCacheManager();
        const cachedResult = cacheManager.getCachedFog(config.viewportBounds, null, false);
        
        if (cachedResult) {
          const cacheHitTime = performance.now() - startTime;
          
          logger.debugThrottled(
            `Spatial fog calculation cache hit (saved ${cachedResult.calculationTime.toFixed(2)}ms)`,
            5000
          );
          
          return {
            fogGeoJSON: cachedResult.fogGeoJSON,
            calculationTime: cacheHitTime,
            performanceMetrics: {
              geometryComplexity: { vertexCount: 0, ringCount: 0, holeCount: 0 },
              operationType: 'viewport',
              hadErrors: false,
              fallbackUsed: false,
              executionTime: cacheHitTime,
              performanceLevel: 'FAST'
            },
            errors: [],
            warnings: ['Using cached spatial fog calculation result'],
            spatialQueryResult: undefined,
            usedSpatialIndexing: false,
            dataSourceStats: {
              fromDatabase: 0,
              fromSpatialIndex: 0,
              totalProcessed: 0,
            },
          };
        }
      } catch (cacheError) {
        logger.warn('Error checking spatial fog cache, proceeding with calculation:', cacheError);
      }
    }
    
    // Ensure spatial index is initialized
    if (!this.isInitialized || this.shouldUpdateIndex()) {
      try {
        await this.initialize(!this.isInitialized);
      } catch (error) {
        logger.warn('SpatialFogManager: Failed to initialize spatial index, falling back to standard calculation');
        return this.fallbackToStandardCalculation(config, startTime);
      }
    }
    
    let spatialQueryResult: SpatialQueryResult | undefined;
    let revealedAreas: RevealedArea | null = null;
    let usedSpatialIndexing = false;
    let dataSourceStats = {
      fromDatabase: 0,
      fromSpatialIndex: 0,
      totalProcessed: 0,
    };
    
    try {
      // Use spatial indexing if enabled and viewport bounds are available
      if (config.useSpatialIndexing && config.viewportBounds && !this.spatialIndex.isEmpty()) {
        logger.debugThrottled('SpatialFogManager: Using spatial indexing for fog calculation', 3000);
        
        // Query spatial index for features in viewport
        const spatialOptions: SpatialIndexOptions = {
          maxResults: config.maxSpatialResults,
          useLevelOfDetail: config.useLevelOfDetail,
          zoomLevel: config.zoomLevel,
        };
        
        spatialQueryResult = this.spatialIndex.queryViewport(config.viewportBounds, spatialOptions);
        usedSpatialIndexing = true;
        dataSourceStats.fromSpatialIndex = spatialQueryResult.features.length;
        
        // Union the spatial query results
        if (spatialQueryResult.features.length > 0) {
          if (spatialQueryResult.features.length === 1) {
            revealedAreas = spatialQueryResult.features[0];
          } else {
            const unionResult = unionPolygons(spatialQueryResult.features);
            revealedAreas = unionResult.result;
            
            if (unionResult.errors.length > 0) {
              logger.warnThrottled('SpatialFogManager: Union operation had errors during spatial calculation', 5000);
            }
          }
        }
        
        logger.debugThrottled(
          `SpatialFogManager: Spatial query returned ${spatialQueryResult.features.length} features ` +
          `in ${spatialQueryResult.queryTime.toFixed(2)}ms`,
          3000
        );
        
      } else {
        // Fall back to loading from database
        logger.debugThrottled('SpatialFogManager: Falling back to database query', 3000);
        
        let revealedAreasData: object[];
        
        if (config.viewportBounds && config.useViewportOptimization) {
          // Use viewport-optimized database query
          revealedAreasData = await getRevealedAreasInViewport(
            config.viewportBounds,
            config.maxSpatialResults
          );
        } else {
          // Load all revealed areas
          revealedAreasData = await getRevealedAreas();
        }
        
        dataSourceStats.fromDatabase = revealedAreasData.length;
        
        if (revealedAreasData.length > 0) {
          const validFeatures: RevealedArea[] = revealedAreasData
            .filter(area => area && typeof area === 'object')
            .map(area => area as RevealedArea)
            .filter(area => area.type === 'Feature' && area.geometry);
          
          if (validFeatures.length === 1) {
            revealedAreas = validFeatures[0];
          } else if (validFeatures.length > 1) {
            const unionResult = unionPolygons(validFeatures);
            revealedAreas = unionResult.result;
          }
        }
      }
      
      dataSourceStats.totalProcessed = dataSourceStats.fromDatabase + dataSourceStats.fromSpatialIndex;
      
      // Perform fog calculation with the loaded revealed areas
      const fogResult = createFogWithFallback(revealedAreas, config, config.useCache);
      
      const totalExecutionTime = performance.now() - startTime;
      
      logger.debugThrottled(
        `SpatialFogManager: Spatial fog calculation completed in ${totalExecutionTime.toFixed(2)}ms ` +
        `(${usedSpatialIndexing ? 'spatial index' : 'database'})`,
        3000
      );
      
      const result: SpatialFogCalculationResult = {
        ...fogResult,
        spatialQueryResult,
        usedSpatialIndexing,
        dataSourceStats,
        calculationTime: totalExecutionTime, // Override with total time including spatial query
      };
      
      // Cache the result if caching is enabled and calculation was successful
      if (config.useCache && config.viewportBounds && !result.performanceMetrics.hadErrors) {
        try {
          const cacheManager = getGlobalFogCacheManager();
          cacheManager.cacheFogResult(config.viewportBounds, revealedAreas, result);
          
          logger.debugThrottled(
            `Cached spatial fog calculation result (${totalExecutionTime.toFixed(2)}ms)`,
            5000
          );
        } catch (cacheError) {
          logger.warn('Error caching spatial fog calculation result:', cacheError);
          // Don't fail the calculation due to cache errors
        }
      }
      
      return result;
      
    } catch (error) {
      logger.error('SpatialFogManager: Error in spatial fog calculation:', error);
      return this.fallbackToStandardCalculation(config, startTime, error);
    }
  }
  
  /**
   * Adds new revealed areas to the spatial index
   * Should be called when new areas are revealed to keep index up-to-date
   * 
   * @param features - New revealed area features to add
   * @returns Promise that resolves when features are added
   * 
   * @example
   * ```typescript
   * await spatialFogManager.addRevealedAreas([newRevealedArea]);
   * ```
   */
  async addRevealedAreas(features: RevealedArea[]): Promise<void> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      await this.spatialIndex.addFeatures(features);
      this.lastIndexUpdate = Date.now();
      
      logger.debugThrottled(
        `SpatialFogManager: Added ${features.length} features to spatial index`,
        3000
      );
      
    } catch (error) {
      logger.error('SpatialFogManager: Error adding revealed areas to spatial index:', error);
      throw error;
    }
  }
  
  /**
   * Gets memory usage statistics for the spatial index
   * 
   * @returns Memory usage statistics and recommendations
   */
  getMemoryStats() {
    return this.spatialIndex.getMemoryStats();
  }
  
  /**
   * Optimizes memory usage of the spatial index
   * 
   * @param aggressiveCleanup - Whether to perform aggressive cleanup
   * @returns Promise that resolves when optimization is complete
   */
  async optimizeMemory(aggressiveCleanup: boolean = false): Promise<void> {
    try {
      await this.spatialIndex.optimizeMemory(aggressiveCleanup);
      this.lastIndexUpdate = Date.now();
      
      logger.info('SpatialFogManager: Memory optimization completed');
      
    } catch (error) {
      logger.error('SpatialFogManager: Error optimizing memory:', error);
      throw error;
    }
  }
  
  /**
   * Forces a refresh of the spatial index from database
   * Useful when database has been updated externally
   * 
   * @returns Promise that resolves when refresh is complete
   */
  async refreshIndex(): Promise<void> {
    try {
      await this.initialize(true);
      logger.info('SpatialFogManager: Spatial index refreshed from database');
    } catch (error) {
      logger.error('SpatialFogManager: Error refreshing spatial index:', error);
      throw error;
    }
  }
  
  /**
   * Gets the current feature count in the spatial index
   * 
   * @returns Number of features in spatial index
   */
  getFeatureCount(): number {
    return this.spatialIndex.getFeatureCount();
  }
  
  /**
   * Checks if the spatial index is empty
   * 
   * @returns True if spatial index contains no features
   */
  isEmpty(): boolean {
    return this.spatialIndex.isEmpty();
  }
  
  /**
   * Determines if the spatial index should be updated based on time interval
   * 
   * @returns True if index should be updated
   * 
   * @private
   */
  private shouldUpdateIndex(): boolean {
    return Date.now() - this.lastIndexUpdate > this.indexUpdateInterval;
  }
  
  /**
   * Falls back to standard fog calculation when spatial indexing fails
   * 
   * @param config - Fog calculation options
   * @param startTime - Calculation start time
   * @param error - Optional error that caused fallback
   * @returns Spatial fog calculation result with fallback data
   * 
   * @private
   */
  private async fallbackToStandardCalculation(
    config: SpatialFogCalculationOptions,
    startTime: number,
    error?: any
  ): Promise<SpatialFogCalculationResult> {
    try {
      logger.warnThrottled('SpatialFogManager: Using standard fog calculation as fallback', 5000);
      
      // Load revealed areas from database
      const revealedAreasData = await getRevealedAreas();
      let revealedAreas: RevealedArea | null = null;
      
      if (revealedAreasData.length > 0) {
        const validFeatures: RevealedArea[] = revealedAreasData
          .filter(area => area && typeof area === 'object')
          .map(area => area as RevealedArea)
          .filter(area => area.type === 'Feature' && area.geometry);
        
        if (validFeatures.length === 1) {
          revealedAreas = validFeatures[0];
        } else if (validFeatures.length > 1) {
          const unionResult = unionPolygons(validFeatures);
          revealedAreas = unionResult.result;
        }
      }
      
      // Perform standard fog calculation
      const fogResult = createFogWithFallback(revealedAreas, config);
      
      const totalExecutionTime = performance.now() - startTime;
      
      return {
        ...fogResult,
        spatialQueryResult: undefined,
        usedSpatialIndexing: false,
        dataSourceStats: {
          fromDatabase: revealedAreasData.length,
          fromSpatialIndex: 0,
          totalProcessed: revealedAreasData.length,
        },
        calculationTime: totalExecutionTime,
        errors: [...fogResult.errors, ...(error ? [`Spatial indexing failed: ${error.message}`] : [])],
        warnings: [...fogResult.warnings, 'Used fallback calculation due to spatial indexing failure'],
      };
      
    } catch (fallbackError) {
      logger.error('SpatialFogManager: Fallback calculation also failed:', fallbackError);
      
      // Final emergency fallback
      const totalExecutionTime = performance.now() - startTime;
      
      return {
        fogGeoJSON: createWorldFogCollection(),
        calculationTime: totalExecutionTime,
        performanceMetrics: {
          geometryComplexity: { vertexCount: 5, ringCount: 1, holeCount: 0 },
          operationType: 'world',
          hadErrors: true,
          fallbackUsed: true,
          executionTime: totalExecutionTime,
          performanceLevel: 'FAST',
        },
        errors: [
          error ? `Spatial indexing failed: ${error.message}` : 'Spatial indexing failed',
          `Fallback calculation failed: ${fallbackError.message}`,
        ],
        warnings: ['Using emergency world fog fallback'],
        spatialQueryResult: undefined,
        usedSpatialIndexing: false,
        dataSourceStats: {
          fromDatabase: 0,
          fromSpatialIndex: 0,
          totalProcessed: 0,
        },
      };
    }
  }
}

/**
 * Global spatial fog manager instance
 * Provides singleton pattern for consistent spatial fog calculations
 */
let globalSpatialFogManager: SpatialFogManager | null = null;

/**
 * Gets or creates the global spatial fog manager instance
 * 
 * @returns Global spatial fog manager instance
 * 
 * @example
 * ```typescript
 * const manager = getGlobalSpatialFogManager();
 * await manager.initialize();
 * ```
 */
export const getGlobalSpatialFogManager = (): SpatialFogManager => {
  if (!globalSpatialFogManager) {
    globalSpatialFogManager = new SpatialFogManager();
    logger.debug('SpatialFogManager: Created global spatial fog manager instance');
  }
  return globalSpatialFogManager;
};

/**
 * Resets the global spatial fog manager instance
 * Useful for testing or when a complete reset is needed
 */
export const resetGlobalSpatialFogManager = (): void => {
  globalSpatialFogManager = null;
  logger.debug('SpatialFogManager: Reset global spatial fog manager instance');
};

/**
 * High-level function for calculating fog with spatial indexing
 * Provides simple interface for spatial fog calculations with automatic optimization
 * 
 * @param viewportBounds - Viewport bounds for optimization
 * @param options - Additional spatial fog calculation options
 * @returns Promise resolving to spatial fog calculation result
 * 
 * @example
 * ```typescript
 * const fogResult = await calculateSpatialFog(
 *   [-74.1, 40.7, -73.9, 40.8],
 *   { useSpatialIndexing: true, maxSpatialResults: 500 }
 * );
 * ```
 */
export const calculateSpatialFog = async (
  viewportBounds?: [number, number, number, number],
  options: Partial<SpatialFogCalculationOptions> = {}
): Promise<SpatialFogCalculationResult> => {
  const manager = getGlobalSpatialFogManager();
  
  // Ensure manager is initialized
  if (!manager.isEmpty() || options.rebuildIndexIfEmpty !== false) {
    await manager.initialize();
  }
  
  const fogOptions: SpatialFogCalculationOptions = {
    ...getDefaultFogOptions(viewportBounds),
    ...options,
    viewportBounds,
  };
  
  return manager.calculateSpatialFog(fogOptions);
};

export default SpatialFogManager;