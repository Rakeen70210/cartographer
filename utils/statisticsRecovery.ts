import { logger } from '@/utils/logger';
import { StatisticsError, StatisticsErrorType, statisticsErrorHandler } from './statisticsErrorHandler';

/**
 * Recovery result interface
 */
export interface RecoveryResult<T> {
  success: boolean;
  data?: T;
  partialData?: Partial<T>;
  failedOperations: string[];
  errors: StatisticsError[];
  recoveryStrategy: string;
}

/**
 * Statistics recovery utility class
 */
export class StatisticsRecovery {
  private static instance: StatisticsRecovery;

  private constructor() {}

  static getInstance(): StatisticsRecovery {
    if (!StatisticsRecovery.instance) {
      StatisticsRecovery.instance = new StatisticsRecovery();
    }
    return StatisticsRecovery.instance;
  }

  /**
   * Attempt to recover statistics calculation with fallbacks
   */
  async recoverStatisticsCalculation<T>(
    operations: Array<{
      name: string;
      operation: () => Promise<any>;
      fallback?: () => Promise<any>;
      required?: boolean;
    }>,
    combineResults: (results: Record<string, any>) => T
  ): Promise<RecoveryResult<T>> {
    const results: Record<string, any> = {};
    const failedOperations: string[] = [];
    const errors: StatisticsError[] = [];
    let recoveryStrategy = 'full_calculation';

    logger.debug('StatisticsRecovery: Starting recovery process', {
      operationCount: operations.length
    });

    // Execute each operation with error handling
    for (const { name, operation, fallback, required = false } of operations) {
      try {
        logger.debug(`StatisticsRecovery: Executing operation: ${name}`);
        results[name] = await operation();
        logger.success(`StatisticsRecovery: Operation ${name} succeeded`);
      } catch (error) {
        const statisticsError = statisticsErrorHandler.handleError(error, { operation: name });
        errors.push(statisticsError);

        logger.warn(`StatisticsRecovery: Operation ${name} failed, attempting recovery`, {
          error: statisticsError.message
        });

        // Try fallback if available
        if (fallback) {
          try {
            results[name] = await fallback();
            logger.success(`StatisticsRecovery: Fallback for ${name} succeeded`);
            recoveryStrategy = 'partial_fallback';
          } catch (fallbackError) {
            const fallbackStatisticsError = statisticsErrorHandler.handleError(
              fallbackError, 
              { operation: name, type: 'fallback' }
            );
            errors.push(fallbackStatisticsError);
            
            logger.error(`StatisticsRecovery: Fallback for ${name} also failed`, {
              error: fallbackStatisticsError.message
            });

            failedOperations.push(name);

            // If this is a required operation and both primary and fallback failed, 
            // we can't continue
            if (required) {
              logger.error(`StatisticsRecovery: Required operation ${name} failed completely`);
              return {
                success: false,
                failedOperations,
                errors,
                recoveryStrategy: 'failed'
              };
            }
          }
        } else {
          failedOperations.push(name);
          
          if (required) {
            logger.error(`StatisticsRecovery: Required operation ${name} failed with no fallback`);
            return {
              success: false,
              failedOperations,
              errors,
              recoveryStrategy: 'failed'
            };
          }
        }
      }
    }

    // Attempt to combine results
    try {
      const combinedData = combineResults(results);
      
      const success = failedOperations.length === 0;
      if (!success) {
        recoveryStrategy = 'partial_success';
      }

      logger.success('StatisticsRecovery: Recovery process completed', {
        success,
        failedOperations: failedOperations.length,
        recoveryStrategy
      });

      return {
        success,
        data: success ? combinedData : undefined,
        partialData: success ? undefined : combinedData,
        failedOperations,
        errors,
        recoveryStrategy
      };
    } catch (combineError) {
      const combineStatisticsError = statisticsErrorHandler.handleError(
        combineError, 
        { operation: 'combine_results' }
      );
      errors.push(combineStatisticsError);

      logger.error('StatisticsRecovery: Failed to combine results', {
        error: combineStatisticsError.message
      });

      return {
        success: false,
        failedOperations: [...failedOperations, 'combine_results'],
        errors,
        recoveryStrategy: 'failed'
      };
    }
  }

  /**
   * Get default/fallback values for failed calculations
   */
  getDefaultValues(): {
    totalDistance: { miles: number; kilometers: number };
    worldExploration: { percentage: number; totalAreaKm2: number; exploredAreaKm2: number };
    uniqueRegions: { countries: number; states: number; cities: number };
    remainingRegions: { countries: number; states: number; cities: number };
    hierarchicalBreakdown: any[];
  } {
    return {
      totalDistance: { miles: 0, kilometers: 0 },
      worldExploration: { 
        percentage: 0, 
        totalAreaKm2: 510072000, 
        exploredAreaKm2: 0 
      },
      uniqueRegions: { countries: 0, states: 0, cities: 0 },
      remainingRegions: { countries: 195, states: 3142, cities: 10000 },
      hierarchicalBreakdown: []
    };
  }

  /**
   * Create partial statistics data when some calculations fail
   */
  createPartialStatistics(
    availableData: Record<string, any>,
    failedOperations: string[]
  ): any {
    const defaults = this.getDefaultValues();
    
    return {
      totalDistance: availableData.totalDistance || defaults.totalDistance,
      worldExploration: availableData.worldExploration || defaults.worldExploration,
      uniqueRegions: availableData.uniqueRegions || defaults.uniqueRegions,
      remainingRegions: availableData.remainingRegions || defaults.remainingRegions,
      hierarchicalBreakdown: availableData.hierarchicalBreakdown || defaults.hierarchicalBreakdown,
      lastUpdated: Date.now(),
      isPartialData: true,
      failedCalculations: failedOperations,
      dataSource: 'partial'
    };
  }

  /**
   * Determine if recovery should be attempted based on error patterns
   */
  shouldAttemptRecovery(errors: StatisticsError[]): boolean {
    // Don't attempt recovery if there are validation errors
    const hasValidationErrors = errors.some(
      error => error.type === StatisticsErrorType.VALIDATION_ERROR
    );
    
    if (hasValidationErrors) {
      return false;
    }

    // Don't attempt recovery if there are too many critical errors
    const criticalErrors = errors.filter(
      error => error.severity === 'critical'
    );
    
    if (criticalErrors.length > 2) {
      return false;
    }

    // Attempt recovery for network, calculation, and other recoverable errors
    const recoverableErrors = errors.filter(error => error.recoverable);
    return recoverableErrors.length > 0;
  }

  /**
   * Get user-friendly message for recovery result
   */
  getRecoveryMessage(result: RecoveryResult<any>): {
    title: string;
    message: string;
    actionable: boolean;
  } {
    if (result.success) {
      return {
        title: 'Statistics Loaded',
        message: 'All statistics calculated successfully.',
        actionable: false
      };
    }

    if (result.partialData && result.failedOperations.length > 0) {
      const failedCount = result.failedOperations.length;
      return {
        title: 'Partial Data Available',
        message: `${failedCount} calculation${failedCount > 1 ? 's' : ''} failed, but other statistics are available.`,
        actionable: true
      };
    }

    return {
      title: 'Statistics Unavailable',
      message: 'Unable to calculate statistics. Please try again.',
      actionable: true
    };
  }

  /**
   * Get suggested actions based on recovery result
   */
  getSuggestedActions(result: RecoveryResult<any>): string[] {
    const actions: string[] = [];

    if (!result.success) {
      // Check for network errors
      const hasNetworkErrors = result.errors.some(
        error => error.type === StatisticsErrorType.NETWORK_ERROR
      );
      
      if (hasNetworkErrors) {
        actions.push('Check your internet connection');
        actions.push('Try again when online');
      }

      // Check for database errors
      const hasDatabaseErrors = result.errors.some(
        error => error.type === StatisticsErrorType.DATABASE_ERROR
      );
      
      if (hasDatabaseErrors) {
        actions.push('Restart the app');
        actions.push('Clear app cache if problem persists');
      }

      // Check for calculation errors
      const hasCalculationErrors = result.errors.some(
        error => error.type === StatisticsErrorType.CALCULATION_ERROR
      );
      
      if (hasCalculationErrors) {
        actions.push('Refresh your data');
        actions.push('Try again in a few moments');
      }

      // Generic fallback
      if (actions.length === 0) {
        actions.push('Try refreshing the statistics');
        actions.push('Restart the app if problem persists');
      }
    }

    return actions;
  }
}

// Export singleton instance
export const statisticsRecovery = StatisticsRecovery.getInstance();