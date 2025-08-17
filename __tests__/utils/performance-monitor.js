/**
 * Performance monitoring utilities for comprehensive testing
 * Provides consistent performance measurement and reporting across test suites
 */

/**
 * Performance thresholds for different operation types
 */
export const PERFORMANCE_THRESHOLDS = {
  GEOMETRY_VALIDATION: {
    SIMPLE: 10, // ms
    COMPLEX: 50, // ms
    VERY_COMPLEX: 200 // ms
  },
  GEOMETRY_OPERATIONS: {
    BUFFER_CREATION: 100, // ms
    UNION_SIMPLE: 200, // ms
    UNION_COMPLEX: 1000, // ms
    DIFFERENCE_SIMPLE: 150, // ms
    DIFFERENCE_COMPLEX: 800 // ms
  },
  FOG_CALCULATION: {
    VIEWPORT_SIMPLE: 300, // ms
    VIEWPORT_COMPLEX: 1500, // ms
    WORLD_FOG: 50 // ms
  },
  HOOK_OPERATIONS: {
    INITIALIZATION: 1000, // ms
    UPDATE: 500, // ms
    CLEANUP: 200 // ms
  },
  MEMORY: {
    MAX_INCREASE_MB: 100, // MB
    MAX_LEAK_MB: 20 // MB
  }
};

/**
 * Performance measurement class
 */
export class PerformanceMonitor {
  constructor(name) {
    this.name = name;
    this.measurements = [];
    this.startTime = null;
    this.memoryStart = null;
  }

  /**
   * Start measuring performance
   */
  start() {
    this.startTime = performance.now();
    this.memoryStart = this.getMemoryUsage();
    return this;
  }

  /**
   * Stop measuring and record results
   */
  stop(metadata = {}) {
    if (!this.startTime) {
      throw new Error('Performance monitor not started');
    }

    const endTime = performance.now();
    const memoryEnd = this.getMemoryUsage();
    
    const measurement = {
      name: this.name,
      executionTime: endTime - this.startTime,
      memoryDelta: this.calculateMemoryDelta(this.memoryStart, memoryEnd),
      timestamp: Date.now(),
      metadata
    };

    this.measurements.push(measurement);
    this.startTime = null;
    this.memoryStart = null;

    return measurement;
  }

  /**
   * Get current memory usage
   */
  getMemoryUsage() {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage();
    }
    
    // Fallback for environments without process.memoryUsage
    return {
      heapUsed: 0,
      heapTotal: 0,
      external: 0,
      rss: 0
    };
  }

  /**
   * Calculate memory delta between two measurements
   */
  calculateMemoryDelta(before, after) {
    return {
      heapUsed: this.formatMemorySize(after.heapUsed - before.heapUsed),
      heapTotal: this.formatMemorySize(after.heapTotal - before.heapTotal),
      external: this.formatMemorySize(after.external - before.external),
      rss: this.formatMemorySize(after.rss - before.rss)
    };
  }

  /**
   * Format memory size in MB
   */
  formatMemorySize(bytes) {
    return Math.round(bytes / 1024 / 1024 * 100) / 100; // MB with 2 decimal places
  }

  /**
   * Get all measurements
   */
  getMeasurements() {
    return [...this.measurements];
  }

  /**
   * Get performance statistics
   */
  getStatistics() {
    if (this.measurements.length === 0) {
      return null;
    }

    const executionTimes = this.measurements.map(m => m.executionTime);
    const memoryDeltas = this.measurements.map(m => m.memoryDelta.heapUsed);

    return {
      count: this.measurements.length,
      executionTime: {
        min: Math.min(...executionTimes),
        max: Math.max(...executionTimes),
        avg: executionTimes.reduce((sum, t) => sum + t, 0) / executionTimes.length,
        total: executionTimes.reduce((sum, t) => sum + t, 0)
      },
      memory: {
        minDelta: Math.min(...memoryDeltas),
        maxDelta: Math.max(...memoryDeltas),
        avgDelta: memoryDeltas.reduce((sum, m) => sum + m, 0) / memoryDeltas.length,
        totalDelta: memoryDeltas.reduce((sum, m) => sum + m, 0)
      }
    };
  }

  /**
   * Clear all measurements
   */
  clear() {
    this.measurements = [];
  }
}

/**
 * Measure async operation performance
 */
export async function measureAsync(name, operation, metadata = {}) {
  const monitor = new PerformanceMonitor(name);
  monitor.start();
  
  try {
    const result = await operation();
    const measurement = monitor.stop(metadata);
    return { result, measurement };
  } catch (error) {
    const measurement = monitor.stop({ ...metadata, error: error.message });
    throw error;
  }
}

/**
 * Measure sync operation performance
 */
export function measureSync(name, operation, metadata = {}) {
  const monitor = new PerformanceMonitor(name);
  monitor.start();
  
  try {
    const result = operation();
    const measurement = monitor.stop(metadata);
    return { result, measurement };
  } catch (error) {
    const measurement = monitor.stop({ ...metadata, error: error.message });
    throw error;
  }
}

/**
 * Batch performance measurement for multiple operations
 */
export async function measureBatch(operations) {
  const results = [];
  
  for (const { name, operation, metadata = {} } of operations) {
    try {
      const { result, measurement } = await measureAsync(name, operation, metadata);
      results.push({ name, result, measurement, success: true });
    } catch (error) {
      results.push({ name, error, success: false });
    }
  }
  
  return results;
}

/**
 * Performance assertion helpers
 */
export const performanceAssertions = {
  /**
   * Assert execution time is within threshold
   */
  expectExecutionTime(measurement, threshold, tolerance = 0.2) {
    const maxTime = threshold * (1 + tolerance);
    expect(measurement.executionTime).toBeLessThan(maxTime);
  },

  /**
   * Assert memory usage is within threshold
   */
  expectMemoryUsage(measurement, thresholdMB, tolerance = 0.5) {
    const maxMemory = thresholdMB * (1 + tolerance);
    expect(Math.abs(measurement.memoryDelta.heapUsed)).toBeLessThan(maxMemory);
  },

  /**
   * Assert performance is better than baseline
   */
  expectBetterThan(measurement, baseline, tolerance = 0.1) {
    const maxTime = baseline.executionTime * (1 + tolerance);
    expect(measurement.executionTime).toBeLessThan(maxTime);
  },

  /**
   * Assert performance is consistent across measurements
   */
  expectConsistentPerformance(measurements, maxVariance = 2.0) {
    if (measurements.length < 2) return;
    
    const times = measurements.map(m => m.executionTime);
    const avg = times.reduce((sum, t) => sum + t, 0) / times.length;
    const maxDeviation = Math.max(...times.map(t => Math.abs(t - avg)));
    
    expect(maxDeviation).toBeLessThan(avg * maxVariance);
  }
};

/**
 * Memory monitoring utilities
 */
export const memoryMonitor = {
  /**
   * Force garbage collection if available
   */
  forceGC() {
    if (typeof global !== 'undefined' && global.gc) {
      global.gc();
    }
  },

  /**
   * Monitor memory during operation
   */
  async monitorOperation(operation, options = {}) {
    const { samples = 10, interval = 100 } = options;
    const memorySnapshots = [];
    
    // Initial snapshot
    memorySnapshots.push({
      timestamp: Date.now(),
      memory: this.getCurrentMemory()
    });

    // Start monitoring
    const monitoringInterval = setInterval(() => {
      memorySnapshots.push({
        timestamp: Date.now(),
        memory: this.getCurrentMemory()
      });
    }, interval);

    try {
      const result = await operation();
      
      // Final snapshot
      clearInterval(monitoringInterval);
      memorySnapshots.push({
        timestamp: Date.now(),
        memory: this.getCurrentMemory()
      });

      return {
        result,
        memoryProfile: this.analyzeMemoryProfile(memorySnapshots)
      };
    } catch (error) {
      clearInterval(monitoringInterval);
      throw error;
    }
  },

  /**
   * Get current memory usage
   */
  getCurrentMemory() {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage();
    }
    return { heapUsed: 0, heapTotal: 0, external: 0, rss: 0 };
  },

  /**
   * Analyze memory profile from snapshots
   */
  analyzeMemoryProfile(snapshots) {
    if (snapshots.length < 2) return null;

    const heapUsages = snapshots.map(s => s.memory.heapUsed);
    const initial = heapUsages[0];
    const final = heapUsages[heapUsages.length - 1];
    const peak = Math.max(...heapUsages);
    const valley = Math.min(...heapUsages);

    return {
      initial: Math.round(initial / 1024 / 1024 * 100) / 100,
      final: Math.round(final / 1024 / 1024 * 100) / 100,
      peak: Math.round(peak / 1024 / 1024 * 100) / 100,
      valley: Math.round(valley / 1024 / 1024 * 100) / 100,
      delta: Math.round((final - initial) / 1024 / 1024 * 100) / 100,
      peakDelta: Math.round((peak - initial) / 1024 / 1024 * 100) / 100,
      snapshots: snapshots.length
    };
  }
};

/**
 * Test performance reporter
 */
export class PerformanceReporter {
  constructor() {
    this.reports = [];
  }

  /**
   * Add performance report
   */
  addReport(testName, measurements, metadata = {}) {
    this.reports.push({
      testName,
      measurements,
      metadata,
      timestamp: Date.now()
    });
  }

  /**
   * Generate performance summary
   */
  generateSummary() {
    if (this.reports.length === 0) {
      return { message: 'No performance data collected' };
    }

    const summary = {
      totalTests: this.reports.length,
      totalMeasurements: this.reports.reduce((sum, r) => sum + r.measurements.length, 0),
      averageExecutionTime: 0,
      slowestTest: null,
      fastestTest: null,
      memoryStats: {
        totalDelta: 0,
        maxIncrease: 0,
        maxDecrease: 0
      }
    };

    let totalTime = 0;
    let slowestTime = 0;
    let fastestTime = Infinity;

    this.reports.forEach(report => {
      report.measurements.forEach(measurement => {
        totalTime += measurement.executionTime;
        
        if (measurement.executionTime > slowestTime) {
          slowestTime = measurement.executionTime;
          summary.slowestTest = {
            name: report.testName,
            measurement: measurement.name,
            time: measurement.executionTime
          };
        }
        
        if (measurement.executionTime < fastestTime) {
          fastestTime = measurement.executionTime;
          summary.fastestTest = {
            name: report.testName,
            measurement: measurement.name,
            time: measurement.executionTime
          };
        }

        const memoryDelta = measurement.memoryDelta.heapUsed;
        summary.memoryStats.totalDelta += memoryDelta;
        summary.memoryStats.maxIncrease = Math.max(summary.memoryStats.maxIncrease, memoryDelta);
        summary.memoryStats.maxDecrease = Math.min(summary.memoryStats.maxDecrease, memoryDelta);
      });
    });

    summary.averageExecutionTime = totalTime / summary.totalMeasurements;

    return summary;
  }

  /**
   * Export reports to JSON
   */
  exportToJSON() {
    return JSON.stringify({
      summary: this.generateSummary(),
      reports: this.reports
    }, null, 2);
  }

  /**
   * Clear all reports
   */
  clear() {
    this.reports = [];
  }
}

// Global performance reporter instance
export const globalPerformanceReporter = new PerformanceReporter();