import { logger } from './logger';

/**
 * Performance optimization utilities for statistics calculations
 * Implements debouncing, background processing, and memory management
 */

export interface PerformanceMetrics {
  calculationTime: number;
  memoryUsage: number;
  cacheHitRate: number;
  lastOptimization: number;
}

export interface OptimizationConfig {
  debounceDelay: number;
  maxConcurrentCalculations: number;
  memoryThreshold: number; // MB
  cacheCleanupInterval: number; // ms
  enableBackgroundProcessing: boolean;
}

const DEFAULT_CONFIG: OptimizationConfig = {
  debounceDelay: 300,
  maxConcurrentCalculations: 3,
  memoryThreshold: 100, // 100MB
  cacheCleanupInterval: 5 * 60 * 1000, // 5 minutes
  enableBackgroundProcessing: true
};

/**
 * Debounce utility for preventing excessive recalculations
 */
export class StatisticsDebouncer {
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private config: OptimizationConfig;

  constructor(config: Partial<OptimizationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Debounce a function call
   */
  debounce<T extends (...args: any[]) => any>(
    key: string,
    fn: T,
    delay?: number
  ): (...args: Parameters<T>) => void {
    const debounceDelay = delay ?? this.config.debounceDelay;

    return (...args: Parameters<T>) => {
      // Clear existing timer
      const existingTimer = this.timers.get(key);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // Set new timer
      const timer = setTimeout(() => {
        this.timers.delete(key);
        fn(...args);
      }, debounceDelay);

      this.timers.set(key, timer);
    };
  }

  /**
   * Cancel a debounced function
   */
  cancel(key: string): void {
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
  }

  /**
   * Cancel all debounced functions
   */
  cancelAll(): void {
    for (const [key, timer] of this.timers) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }

  /**
   * Get pending debounced functions
   */
  getPendingKeys(): string[] {
    return Array.from(this.timers.keys());
  }
}

/**
 * Background processing queue for expensive calculations
 */
export class BackgroundProcessor {
  private queue: Array<{
    id: string;
    task: () => Promise<any>;
    priority: number;
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }> = [];
  
  private processing = false;
  private activeCount = 0;
  private config: OptimizationConfig;

  constructor(config: Partial<OptimizationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Add a task to the background processing queue
   */
  async enqueue<T>(
    id: string,
    task: () => Promise<T>,
    priority: number = 0
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        id,
        task,
        priority,
        resolve,
        reject
      });

      // Sort by priority (higher priority first)
      this.queue.sort((a, b) => b.priority - a.priority);

      this.processQueue();
    });
  }

  /**
   * Process the background queue
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.activeCount >= this.config.maxConcurrentCalculations) {
      return;
    }

    if (this.queue.length === 0) {
      return;
    }

    this.processing = true;
    this.activeCount++;

    const item = this.queue.shift()!;

    try {
      logger.debug('BackgroundProcessor: Starting task', { id: item.id, priority: item.priority });
      const startTime = Date.now();
      
      const result = await item.task();
      
      const duration = Date.now() - startTime;
      logger.debug('BackgroundProcessor: Task completed', { 
        id: item.id, 
        duration: `${duration}ms` 
      });
      
      item.resolve(result);
    } catch (error) {
      logger.error('BackgroundProcessor: Task failed', { id: item.id, error });
      item.reject(error);
    } finally {
      this.activeCount--;
      this.processing = false;
      
      // Process next item if available
      if (this.queue.length > 0) {
        setTimeout(() => this.processQueue(), 0);
      }
    }
  }

  /**
   * Get queue status
   */
  getStatus(): {
    queueLength: number;
    activeCount: number;
    isProcessing: boolean;
  } {
    return {
      queueLength: this.queue.length,
      activeCount: this.activeCount,
      isProcessing: this.processing
    };
  }

  /**
   * Clear the queue
   */
  clear(): void {
    for (const item of this.queue) {
      item.reject(new Error('Queue cleared'));
    }
    this.queue = [];
  }
}

/**
 * Memory management utilities
 */
export class MemoryManager {
  private config: OptimizationConfig;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<OptimizationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startCleanupInterval();
  }

  /**
   * Get current memory usage (approximation)
   */
  getMemoryUsage(): number {
    if (typeof global !== 'undefined' && global.gc) {
      global.gc();
    }
    
    // This is a rough approximation since React Native doesn't expose detailed memory info
    const used = process.memoryUsage?.() || { heapUsed: 0 };
    return Math.round(used.heapUsed / 1024 / 1024); // Convert to MB
  }

  /**
   * Check if memory usage is above threshold
   */
  isMemoryPressure(): boolean {
    const usage = this.getMemoryUsage();
    return usage > this.config.memoryThreshold;
  }

  /**
   * Optimize memory by clearing caches if needed
   */
  async optimizeMemory(): Promise<void> {
    if (!this.isMemoryPressure()) {
      return;
    }

    logger.warn('MemoryManager: Memory pressure detected, optimizing');

    try {
      // Clear expired caches
      const { deleteExpiredStatisticsCache } = await import('./database');
      await deleteExpiredStatisticsCache(30 * 60 * 1000); // 30 minutes

      // Force garbage collection if available
      if (typeof global !== 'undefined' && global.gc) {
        global.gc();
      }

      logger.debug('MemoryManager: Memory optimization completed');
    } catch (error) {
      logger.error('MemoryManager: Error during memory optimization:', error);
    }
  }

  /**
   * Start automatic cleanup interval
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.optimizeMemory();
    }, this.config.cacheCleanupInterval);
  }

  /**
   * Stop cleanup interval
   */
  stopCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

/**
 * Performance monitoring utilities
 */
export class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetrics> = new Map();
  private cacheHits = 0;
  private cacheMisses = 0;

  /**
   * Start timing a calculation
   */
  startTiming(key: string): () => void {
    const startTime = Date.now();
    const startMemory = this.getMemoryUsage();

    return () => {
      const endTime = Date.now();
      const endMemory = this.getMemoryUsage();

      const metrics: PerformanceMetrics = {
        calculationTime: endTime - startTime,
        memoryUsage: endMemory - startMemory,
        cacheHitRate: this.getCacheHitRate(),
        lastOptimization: Date.now()
      };

      this.metrics.set(key, metrics);

      logger.debug('PerformanceMonitor: Calculation metrics', {
        key,
        ...metrics
      });
    };
  }

  /**
   * Record cache hit
   */
  recordCacheHit(): void {
    this.cacheHits++;
  }

  /**
   * Record cache miss
   */
  recordCacheMiss(): void {
    this.cacheMisses++;
  }

  /**
   * Get cache hit rate
   */
  getCacheHitRate(): number {
    const total = this.cacheHits + this.cacheMisses;
    return total > 0 ? (this.cacheHits / total) * 100 : 0;
  }

  /**
   * Get performance metrics for a calculation
   */
  getMetrics(key: string): PerformanceMetrics | null {
    return this.metrics.get(key) || null;
  }

  /**
   * Get all performance metrics
   */
  getAllMetrics(): Map<string, PerformanceMetrics> {
    return new Map(this.metrics);
  }

  /**
   * Reset metrics
   */
  reset(): void {
    this.metrics.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  /**
   * Get memory usage approximation
   */
  private getMemoryUsage(): number {
    const used = process.memoryUsage?.() || { heapUsed: 0 };
    return Math.round(used.heapUsed / 1024 / 1024);
  }
}

/**
 * Data chunking utilities for large datasets
 */
export class DataChunker {
  /**
   * Process data in chunks to prevent memory issues
   */
  static async processInChunks<T, R>(
    data: T[],
    processor: (chunk: T[]) => Promise<R>,
    chunkSize: number = 1000
  ): Promise<R[]> {
    const results: R[] = [];
    
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      const result = await processor(chunk);
      results.push(result);
      
      // Allow other tasks to run
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    
    return results;
  }

  /**
   * Process hierarchical data with depth limits
   */
  static processHierarchyWithLimits<T extends { children?: T[] }>(
    data: T[],
    maxDepth: number,
    maxNodesPerLevel: number = 100
  ): T[] {
    const processLevel = (nodes: T[], currentDepth: number): T[] => {
      if (currentDepth >= maxDepth) {
        return nodes.map(node => ({ ...node, children: undefined }));
      }

      // Limit nodes per level
      const limitedNodes = nodes.slice(0, maxNodesPerLevel);

      return limitedNodes.map(node => {
        if (node.children && node.children.length > 0) {
          return {
            ...node,
            children: processLevel(node.children, currentDepth + 1)
          };
        }
        return node;
      });
    };

    return processLevel(data, 0);
  }
}

// Global instances
export const statisticsDebouncer = new StatisticsDebouncer();
export const backgroundProcessor = new BackgroundProcessor();
export const memoryManager = new MemoryManager();
export const performanceMonitor = new PerformanceMonitor();

/**
 * Cleanup function for performance optimization utilities
 */
export const cleanupPerformanceOptimizers = (): void => {
  statisticsDebouncer.cancelAll();
  backgroundProcessor.clear();
  memoryManager.stopCleanupInterval();
  performanceMonitor.reset();
};