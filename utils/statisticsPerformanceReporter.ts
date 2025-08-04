import { logger } from './logger';
import { statisticsCacheManager } from './statisticsCacheManager';
import { memoryManager, performanceMonitor } from './statisticsPerformanceOptimizer';

/**
 * Performance reporting and monitoring utilities for statistics system
 * Provides detailed performance insights and optimization recommendations
 */

export interface PerformanceReport {
  timestamp: number;
  calculationMetrics: {
    [key: string]: {
      averageTime: number;
      totalCalls: number;
      slowestCall: number;
      fastestCall: number;
    };
  };
  cacheMetrics: {
    hitRate: number;
    totalHits: number;
    totalMisses: number;
    totalSets: number;
    totalInvalidations: number;
  };
  memoryMetrics: {
    currentUsage: number;
    isPressure: boolean;
    optimizationCount: number;
  };
  recommendations: string[];
}

export interface PerformanceThresholds {
  maxCalculationTime: number; // milliseconds
  minCacheHitRate: number; // percentage
  maxMemoryUsage: number; // MB
  maxHierarchyDepth: number;
  maxNodesPerLevel: number;
}

const DEFAULT_THRESHOLDS: PerformanceThresholds = {
  maxCalculationTime: 5000, // 5 seconds
  minCacheHitRate: 70, // 70%
  maxMemoryUsage: 150, // 150MB
  maxHierarchyDepth: 4,
  maxNodesPerLevel: 100
};

export class StatisticsPerformanceReporter {
  private thresholds: PerformanceThresholds;
  private calculationHistory: Map<string, number[]> = new Map();
  private optimizationCount = 0;

  constructor(thresholds: Partial<PerformanceThresholds> = {}) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
  }

  /**
   * Record a calculation time for performance tracking
   */
  recordCalculation(key: string, duration: number): void {
    if (!this.calculationHistory.has(key)) {
      this.calculationHistory.set(key, []);
    }
    
    const history = this.calculationHistory.get(key)!;
    history.push(duration);
    
    // Keep only last 100 measurements to prevent memory growth
    if (history.length > 100) {
      history.shift();
    }
  }

  /**
   * Record an optimization event
   */
  recordOptimization(): void {
    this.optimizationCount++;
  }

  /**
   * Generate comprehensive performance report
   */
  generateReport(): PerformanceReport {
    const timestamp = Date.now();
    
    // Calculate calculation metrics
    const calculationMetrics: PerformanceReport['calculationMetrics'] = {};
    for (const [key, times] of this.calculationHistory) {
      if (times.length > 0) {
        calculationMetrics[key] = {
          averageTime: times.reduce((sum, time) => sum + time, 0) / times.length,
          totalCalls: times.length,
          slowestCall: Math.max(...times),
          fastestCall: Math.min(...times)
        };
      }
    }

    // Get cache metrics
    const cacheStats = statisticsCacheManager.getCacheStats();
    const cacheMetrics: PerformanceReport['cacheMetrics'] = {
      hitRate: cacheStats.hitRate,
      totalHits: cacheStats.hits,
      totalMisses: cacheStats.misses,
      totalSets: cacheStats.sets,
      totalInvalidations: cacheStats.invalidations
    };

    // Get memory metrics
    const memoryMetrics: PerformanceReport['memoryMetrics'] = {
      currentUsage: memoryManager.getMemoryUsage(),
      isPressure: memoryManager.isMemoryPressure(),
      optimizationCount: this.optimizationCount
    };

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      calculationMetrics,
      cacheMetrics,
      memoryMetrics
    );

    const report: PerformanceReport = {
      timestamp,
      calculationMetrics,
      cacheMetrics,
      memoryMetrics,
      recommendations
    };

    logger.debug('StatisticsPerformanceReporter: Generated performance report', {
      calculationCount: Object.keys(calculationMetrics).length,
      cacheHitRate: `${cacheMetrics.hitRate.toFixed(1)}%`,
      memoryUsage: `${memoryMetrics.currentUsage}MB`,
      recommendationCount: recommendations.length
    });

    return report;
  }

  /**
   * Generate performance optimization recommendations
   */
  private generateRecommendations(
    calculationMetrics: PerformanceReport['calculationMetrics'],
    cacheMetrics: PerformanceReport['cacheMetrics'],
    memoryMetrics: PerformanceReport['memoryMetrics']
  ): string[] {
    const recommendations: string[] = [];

    // Check calculation performance
    for (const [key, metrics] of Object.entries(calculationMetrics)) {
      if (metrics.averageTime > this.thresholds.maxCalculationTime) {
        recommendations.push(
          `${key} calculation is slow (${metrics.averageTime.toFixed(0)}ms average). ` +
          'Consider optimizing the calculation logic or increasing cache TTL.'
        );
      }

      if (metrics.slowestCall > this.thresholds.maxCalculationTime * 2) {
        recommendations.push(
          `${key} has very slow outliers (${metrics.slowestCall.toFixed(0)}ms max). ` +
          'Consider implementing data chunking or background processing.'
        );
      }
    }

    // Check cache performance
    if (cacheMetrics.hitRate < this.thresholds.minCacheHitRate) {
      recommendations.push(
        `Cache hit rate is low (${cacheMetrics.hitRate.toFixed(1)}%). ` +
        'Consider increasing cache TTL or improving cache warming strategy.'
      );
    }

    if (cacheMetrics.totalInvalidations > cacheMetrics.totalSets * 0.5) {
      recommendations.push(
        'High cache invalidation rate detected. ' +
        'Consider optimizing cache dependency graph or reducing data change frequency.'
      );
    }

    // Check memory performance
    if (memoryMetrics.currentUsage > this.thresholds.maxMemoryUsage) {
      recommendations.push(
        `Memory usage is high (${memoryMetrics.currentUsage}MB). ` +
        'Consider implementing more aggressive cache cleanup or data chunking.'
      );
    }

    if (memoryMetrics.isPressure) {
      recommendations.push(
        'Memory pressure detected. Consider reducing cache size or implementing ' +
        'more frequent garbage collection.'
      );
    }

    if (memoryMetrics.optimizationCount > 10) {
      recommendations.push(
        'Frequent memory optimizations detected. Consider reviewing data structures ' +
        'and implementing more efficient algorithms.'
      );
    }

    // General recommendations
    if (recommendations.length === 0) {
      recommendations.push('Performance is within acceptable thresholds. No optimizations needed.');
    }

    return recommendations;
  }

  /**
   * Log performance summary
   */
  logPerformanceSummary(): void {
    const report = this.generateReport();
    
    logger.info('Statistics Performance Summary', {
      cacheHitRate: `${report.cacheMetrics.hitRate.toFixed(1)}%`,
      memoryUsage: `${report.memoryMetrics.currentUsage}MB`,
      calculationCount: Object.keys(report.calculationMetrics).length,
      recommendationCount: report.recommendations.length
    });

    // Log slow calculations
    for (const [key, metrics] of Object.entries(report.calculationMetrics)) {
      if (metrics.averageTime > this.thresholds.maxCalculationTime) {
        logger.warn(`Slow calculation detected: ${key}`, {
          averageTime: `${metrics.averageTime.toFixed(0)}ms`,
          slowestCall: `${metrics.slowestCall.toFixed(0)}ms`,
          totalCalls: metrics.totalCalls
        });
      }
    }

    // Log recommendations
    if (report.recommendations.length > 1) { // More than just "no optimizations needed"
      logger.info('Performance Recommendations:', {
        recommendations: report.recommendations
      });
    }
  }

  /**
   * Check if performance is within acceptable thresholds
   */
  isPerformanceAcceptable(): boolean {
    const report = this.generateReport();
    
    // Check calculation times
    for (const metrics of Object.values(report.calculationMetrics)) {
      if (metrics.averageTime > this.thresholds.maxCalculationTime) {
        return false;
      }
    }

    // Check cache hit rate
    if (report.cacheMetrics.hitRate < this.thresholds.minCacheHitRate) {
      return false;
    }

    // Check memory usage
    if (report.memoryMetrics.currentUsage > this.thresholds.maxMemoryUsage) {
      return false;
    }

    return true;
  }

  /**
   * Get performance score (0-100)
   */
  getPerformanceScore(): number {
    const report = this.generateReport();
    let score = 100;

    // Deduct points for slow calculations
    for (const metrics of Object.values(report.calculationMetrics)) {
      if (metrics.averageTime > this.thresholds.maxCalculationTime) {
        const slownessFactor = metrics.averageTime / this.thresholds.maxCalculationTime;
        score -= Math.min(20, slownessFactor * 10);
      }
    }

    // Deduct points for low cache hit rate
    if (report.cacheMetrics.hitRate < this.thresholds.minCacheHitRate) {
      const hitRateDeficit = this.thresholds.minCacheHitRate - report.cacheMetrics.hitRate;
      score -= hitRateDeficit * 0.5;
    }

    // Deduct points for high memory usage
    if (report.memoryMetrics.currentUsage > this.thresholds.maxMemoryUsage) {
      const memoryOverage = report.memoryMetrics.currentUsage - this.thresholds.maxMemoryUsage;
      score -= Math.min(20, memoryOverage * 0.2);
    }

    return Math.max(0, Math.round(score));
  }

  /**
   * Reset performance tracking data
   */
  reset(): void {
    this.calculationHistory.clear();
    this.optimizationCount = 0;
    performanceMonitor.reset();
  }

  /**
   * Export performance data for analysis
   */
  exportPerformanceData(): {
    report: PerformanceReport;
    rawCalculationHistory: Map<string, number[]>;
    thresholds: PerformanceThresholds;
  } {
    return {
      report: this.generateReport(),
      rawCalculationHistory: new Map(this.calculationHistory),
      thresholds: { ...this.thresholds }
    };
  }

  /**
   * Set custom performance thresholds
   */
  setThresholds(thresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
    logger.debug('StatisticsPerformanceReporter: Updated performance thresholds', thresholds);
  }
}

// Global performance reporter instance
export const statisticsPerformanceReporter = new StatisticsPerformanceReporter();

/**
 * Utility function to start performance monitoring for a calculation
 */
export const startPerformanceMonitoring = (key: string) => {
  const startTime = Date.now();
  const endTiming = performanceMonitor.startTiming(key);
  
  return () => {
    const duration = Date.now() - startTime;
    endTiming();
    statisticsPerformanceReporter.recordCalculation(key, duration);
  };
};

/**
 * Decorator for automatic performance monitoring
 */
export const withPerformanceMonitoring = <T extends (...args: any[]) => Promise<any>>(
  fn: T,
  key: string
): T => {
  return (async (...args: any[]) => {
    const endMonitoring = startPerformanceMonitoring(key);
    try {
      const result = await fn(...args);
      endMonitoring();
      return result;
    } catch (error) {
      endMonitoring();
      throw error;
    }
  }) as T;
};

/**
 * Cleanup function for performance reporter
 */
export const cleanupPerformanceReporter = (): void => {
  statisticsPerformanceReporter.reset();
};