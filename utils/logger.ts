/**
 * Centralized logging utility that gates debug logs by environment
 */

// Ensure __DEV__ is defined in test environments
const isDevelopment = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';

// Create a safe logger that always has methods defined
const createLogger = () => {
  const safeLog = (level: string, message: string, ...args: any[]) => {
    try {
      if (level === 'error') {
        console.error(`❌ ${message}`, ...args);
      } else if (isDevelopment) {
        const prefix = level === 'debug' ? '🐛' : level === 'warn' ? '⚠️' : level === 'success' ? '✅' : 'ℹ️';
        console.log(`${prefix} ${message}`, ...args);
      }
    } catch (e) {
      // Fallback to basic console if anything fails
      console.log(`[${level.toUpperCase()}] ${message}`, ...args);
    }
  };

  return {
    info: (message: string, ...args: any[]) => safeLog('info', message, ...args),
    error: (message: string, ...args: any[]) => safeLog('error', message, ...args),
    warn: (message: string, ...args: any[]) => safeLog('warn', message, ...args),
    debug: (message: string, ...args: any[]) => safeLog('debug', message, ...args),
    success: (message: string, ...args: any[]) => safeLog('success', message, ...args)
  };
};

export const logger = createLogger();