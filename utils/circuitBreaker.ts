/**
 * Circuit breaker pattern implementation to prevent infinite retry loops
 * and provide graceful degradation when operations consistently fail
 */

import { logger } from '@/utils/logger';

export enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Circuit is open, failing fast
  HALF_OPEN = 'HALF_OPEN' // Testing if service has recovered
}

export interface CircuitBreakerOptions {
  /** Number of failures before opening the circuit */
  failureThreshold: number;
  /** Time in milliseconds to wait before attempting recovery */
  recoveryTimeout: number;
  /** Time window in milliseconds for counting failures */
  failureWindow: number;
  /** Name of the circuit for logging purposes */
  name: string;
}

export interface CircuitBreakerMetrics {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  totalCalls: number;
}

/**
 * Circuit breaker implementation for preventing cascading failures
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime: number | null = null;
  private lastSuccessTime: number | null = null;
  private totalCalls = 0;
  private failureTimestamps: number[] = [];

  constructor(private options: CircuitBreakerOptions) {}

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalCalls++;

    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptRecovery()) {
        this.state = CircuitState.HALF_OPEN;
        logger.debugOnce(`Circuit breaker ${this.options.name} attempting recovery`);
      } else {
        throw new Error(`Circuit breaker ${this.options.name} is OPEN - failing fast`);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Check if the circuit breaker should allow the operation
   */
  canExecute(): boolean {
    if (this.state === CircuitState.CLOSED) {
      return true;
    }

    if (this.state === CircuitState.HALF_OPEN) {
      return true;
    }

    if (this.state === CircuitState.OPEN) {
      return this.shouldAttemptRecovery();
    }

    return false;
  }

  /**
   * Get current circuit breaker metrics
   */
  getMetrics(): CircuitBreakerMetrics {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      totalCalls: this.totalCalls
    };
  }

  /**
   * Reset the circuit breaker to closed state
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.lastSuccessTime = null;
    this.failureTimestamps = [];
    logger.debugOnce(`Circuit breaker ${this.options.name} reset to CLOSED state`);
  }

  /**
   * Force the circuit breaker to open state
   */
  forceOpen(): void {
    this.state = CircuitState.OPEN;
    this.lastFailureTime = Date.now();
    logger.warn(`Circuit breaker ${this.options.name} forced to OPEN state`);
  }

  private onSuccess(): void {
    this.successCount++;
    this.lastSuccessTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.CLOSED;
      this.failureCount = 0;
      this.failureTimestamps = [];
      logger.successOnce(`Circuit breaker ${this.options.name} recovered - state: CLOSED`);
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.failureTimestamps.push(this.lastFailureTime);

    // Clean up old failure timestamps outside the window
    const cutoff = this.lastFailureTime - this.options.failureWindow;
    this.failureTimestamps = this.failureTimestamps.filter(timestamp => timestamp > cutoff);

    if (this.state === CircuitState.HALF_OPEN) {
      // If we fail in half-open state, go back to open
      this.state = CircuitState.OPEN;
      logger.warn(`Circuit breaker ${this.options.name} failed during recovery - state: OPEN`);
    } else if (this.failureTimestamps.length >= this.options.failureThreshold) {
      // Too many failures in the window, open the circuit
      this.state = CircuitState.OPEN;
      logger.warn(`Circuit breaker ${this.options.name} opened due to ${this.failureTimestamps.length} failures - state: OPEN`);
    }
  }

  private shouldAttemptRecovery(): boolean {
    if (!this.lastFailureTime) {
      return true;
    }

    const timeSinceLastFailure = Date.now() - this.lastFailureTime;
    return timeSinceLastFailure >= this.options.recoveryTimeout;
  }
}

/**
 * Default circuit breaker options for fog calculations
 */
export const FOG_CALCULATION_CIRCUIT_OPTIONS: CircuitBreakerOptions = {
  failureThreshold: 3,      // Open after 3 failures
  recoveryTimeout: 10000,   // Wait 10 seconds before attempting recovery
  failureWindow: 30000,     // Count failures within 30 second window
  name: 'FogCalculation'
};

/**
 * Default circuit breaker options for geometry operations
 */
export const GEOMETRY_OPERATION_CIRCUIT_OPTIONS: CircuitBreakerOptions = {
  failureThreshold: 5,      // Open after 5 failures
  recoveryTimeout: 5000,    // Wait 5 seconds before attempting recovery
  failureWindow: 15000,     // Count failures within 15 second window
  name: 'GeometryOperation'
};