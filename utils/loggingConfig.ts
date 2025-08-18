/**
 * Logging configuration utilities for different environments
 */

import { LoggingConfig, setLoggingConfig } from '@/utils/logger';

/**
 * Predefined logging configurations for different environments
 */
export const LOGGING_PRESETS = {
  /** Development environment - full logging enabled */
  development: {
    enableDebug: true,
    enableInfo: true,
    enableWarning: true,
    enableError: true,
    rateLimitWindow: 3000,
    maxLogsPerWindow: 15,
    throttleViewportLogs: true
  } as LoggingConfig,

  /** Production environment - minimal logging */
  production: {
    enableDebug: false,
    enableInfo: false,
    enableWarning: true,
    enableError: true,
    rateLimitWindow: 10000,
    maxLogsPerWindow: 5,
    throttleViewportLogs: true
  } as LoggingConfig,

  /** Testing environment - errors and warnings only */
  testing: {
    enableDebug: false,
    enableInfo: false,
    enableWarning: true,
    enableError: true,
    rateLimitWindow: 1000,
    maxLogsPerWindow: 3,
    throttleViewportLogs: true
  } as LoggingConfig,

  /** Debug environment - verbose logging for troubleshooting */
  debug: {
    enableDebug: true,
    enableInfo: true,
    enableWarning: true,
    enableError: true,
    rateLimitWindow: 1000,
    maxLogsPerWindow: 50,
    throttleViewportLogs: false
  } as LoggingConfig,

  /** Silent environment - errors only */
  silent: {
    enableDebug: false,
    enableInfo: false,
    enableWarning: false,
    enableError: true,
    rateLimitWindow: 30000,
    maxLogsPerWindow: 1,
    throttleViewportLogs: true
  } as LoggingConfig
};

/**
 * Apply a logging preset configuration
 */
export const applyLoggingPreset = (preset: keyof typeof LOGGING_PRESETS): void => {
  const config = LOGGING_PRESETS[preset];
  if (config) {
    setLoggingConfig(config);
  } else {
    console.warn(`Unknown logging preset: ${preset}`);
  }
};

/**
 * Configure logging based on environment variables or runtime detection
 */
export const configureLoggingForEnvironment = (): void => {
  // Check for explicit environment variable
  const logLevel = process.env.LOG_LEVEL?.toLowerCase();
  
  if (logLevel && logLevel in LOGGING_PRESETS) {
    applyLoggingPreset(logLevel as keyof typeof LOGGING_PRESETS);
    return;
  }

  // Auto-detect environment
  const isDevelopment = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';
  const isTest = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;
  
  if (isTest) {
    applyLoggingPreset('testing');
  } else if (isDevelopment) {
    applyLoggingPreset('development');
  } else {
    applyLoggingPreset('production');
  }
};

/**
 * Create a custom logging configuration
 */
export const createCustomLoggingConfig = (overrides: Partial<LoggingConfig>): LoggingConfig => {
  const baseConfig = LOGGING_PRESETS.development;
  return { ...baseConfig, ...overrides };
};

/**
 * Enable debug logging temporarily (useful for troubleshooting)
 */
export const enableDebugLogging = (): void => {
  setLoggingConfig({
    enableDebug: true,
    enableInfo: true,
    throttleViewportLogs: false,
    rateLimitWindow: 1000,
    maxLogsPerWindow: 100
  });
};

/**
 * Disable debug logging (useful for performance)
 */
export const disableDebugLogging = (): void => {
  setLoggingConfig({
    enableDebug: false,
    enableInfo: false,
    throttleViewportLogs: true
  });
};

/**
 * Configure logging for fog calculation debugging
 */
export const enableFogCalculationDebugging = (): void => {
  setLoggingConfig({
    enableDebug: true,
    enableInfo: true,
    throttleViewportLogs: false,
    rateLimitWindow: 500,
    maxLogsPerWindow: 200
  });
};