import { logger } from '@/utils/logger';

/**
 * Error types for statistics operations
 */
export enum StatisticsErrorType {
  NETWORK_ERROR = 'network_error',
  DATABASE_ERROR = 'database_error',
  CALCULATION_ERROR = 'calculation_error',
  GEOCODING_ERROR = 'geocoding_error',
  CACHE_ERROR = 'cache_error',
  VALIDATION_ERROR = 'validation_error',
  TIMEOUT_ERROR = 'timeout_error',
  UNKNOWN_ERROR = 'unknown_error'
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Statistics error interface
 */
export interface StatisticsError {
  type: StatisticsErrorType;
  severity: ErrorSeverity;
  message: string;
  originalError?: Error;
  context?: Record<string, any>;
  timestamp: number;
  recoverable: boolean;
  userMessage: string;
  suggestedAction?: string;
}

/**
 * Statistics error handler class
 */
export class StatisticsErrorHandler {
  private static instance: StatisticsErrorHandler;
  private errorHistory: StatisticsError[] = [];
  private maxHistorySize = 100;

  private constructor() {}

  static getInstance(): StatisticsErrorHandler {
    if (!StatisticsErrorHandler.instance) {
      StatisticsErrorHandler.instance = new StatisticsErrorHandler();
    }
    return StatisticsErrorHandler.instance;
  }

  handleError(error: Error | unknown, context?: Record<string, any>): StatisticsError {
    const statisticsError = this.categorizeError(error, context);
    this.logError(statisticsError);
    this.addToHistory(statisticsError);
    return statisticsError;
  }

  private categorizeError(error: Error | unknown, context?: Record<string, any>): StatisticsError {
    const timestamp = Date.now();
    let originalError: Error;

    if (error instanceof Error) {
      originalError = error;
    } else {
      originalError = new Error(String(error));
    }

    const message = originalError.message.toLowerCase();
    const stack = originalError.stack?.toLowerCase() || '';

    // Check for critical errors first
    if (this.isCriticalError(message, stack)) {
      return {
        type: StatisticsErrorType.DATABASE_ERROR,
        severity: ErrorSeverity.CRITICAL,
        message: originalError.message,
        originalError,
        context,
        timestamp,
        recoverable: false,
        userMessage: 'A critical system error occurred.',
        suggestedAction: 'Please restart the app. If the problem persists, contact support.'
      };
    }

    if (this.isDatabaseError(message, stack)) {
      return {
        type: StatisticsErrorType.DATABASE_ERROR,
        severity: ErrorSeverity.HIGH,
        message: originalError.message,
        originalError,
        context,
        timestamp,
        recoverable: true,
        userMessage: 'There was a problem accessing your data.',
        suggestedAction: 'Try refreshing the app or restart if the problem persists.'
      };
    }

    if (this.isNetworkError(message, stack)) {
      return {
        type: StatisticsErrorType.NETWORK_ERROR,
        severity: ErrorSeverity.MEDIUM,
        message: originalError.message,
        originalError,
        context,
        timestamp,
        recoverable: true,
        userMessage: 'Unable to connect to the internet. Some features may be limited.',
        suggestedAction: 'Check your internet connection and try again.'
      };
    }

    if (this.isCalculationError(message, stack)) {
      return {
        type: StatisticsErrorType.CALCULATION_ERROR,
        severity: ErrorSeverity.MEDIUM,
        message: originalError.message,
        originalError,
        context,
        timestamp,
        recoverable: true,
        userMessage: 'Unable to calculate some statistics.',
        suggestedAction: 'This might be temporary. Try refreshing your data.'
      };
    }

    return {
      type: StatisticsErrorType.UNKNOWN_ERROR,
      severity: ErrorSeverity.MEDIUM,
      message: originalError.message,
      originalError,
      context,
      timestamp,
      recoverable: true,
      userMessage: 'An unexpected error occurred.',
      suggestedAction: 'Try refreshing or restart the app if the problem persists.'
    };
  }

  private isNetworkError(message: string, stack: string): boolean {
    const patterns = [
      /network/i, 
      /fetch/i, 
      /internet/i, 
      /offline/i, 
      /unreachable/i, 
      /connection refused/i,
      /connection timeout/i,
      /network timeout/i
    ];
    return patterns.some(pattern => pattern.test(message) || pattern.test(stack));
  }

  private isDatabaseError(message: string, stack: string): boolean {
    const patterns = [/database/i, /sqlite/i, /sql/i, /query/i, /storage/i, /transaction/i, /constraint/i];
    return patterns.some(pattern => pattern.test(message) || pattern.test(stack));
  }

  private isCalculationError(message: string, stack: string): boolean {
    const patterns = [/calculation/i, /calculator/i, /nan/i, /infinity/i, /division by zero/i, /invalid number/i];
    return patterns.some(pattern => pattern.test(message)) || 
           stack.includes('calculator') || 
           stack.includes('distanceCalculator') ||
           stack.includes('worldExplorationCalculator');
  }

  private isCriticalError(message: string, stack: string): boolean {
    const patterns = [/critical/i, /system failure/i, /fatal/i, /corruption/i];
    return patterns.some(pattern => pattern.test(message) || pattern.test(stack));
  }

  private logError(error: StatisticsError): void {
    const logData = {
      type: error.type,
      severity: error.severity,
      message: error.message,
      context: error.context,
      timestamp: error.timestamp,
      recoverable: error.recoverable
    };

    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        logger.error('StatisticsErrorHandler: Critical error', logData);
        break;
      case ErrorSeverity.HIGH:
        logger.error('StatisticsErrorHandler: High severity error', logData);
        break;
      case ErrorSeverity.MEDIUM:
        logger.warn('StatisticsErrorHandler: Medium severity error', logData);
        break;
      case ErrorSeverity.LOW:
        logger.debug('StatisticsErrorHandler: Low severity error', logData);
        break;
    }
  }

  private addToHistory(error: StatisticsError): void {
    this.errorHistory.unshift(error);
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory = this.errorHistory.slice(0, this.maxHistorySize);
    }
  }

  getErrorHistory(): StatisticsError[] {
    return [...this.errorHistory];
  }

  clearHistory(): void {
    this.errorHistory = [];
    logger.debug('StatisticsErrorHandler: Error history cleared');
  }
}

export const statisticsErrorHandler = StatisticsErrorHandler.getInstance();

export const withErrorHandling = async <T>(
  operation: () => Promise<T>,
  context?: Record<string, any>
): Promise<{ result: T | null; error: StatisticsError | null }> => {
  try {
    const result = await operation();
    return { result, error: null };
  } catch (error) {
    const statisticsError = statisticsErrorHandler.handleError(error, context);
    return { result: null, error: statisticsError };
  }
};