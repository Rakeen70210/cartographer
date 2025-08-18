/**
 * Centralized logging utility with rate limiting and throttling to prevent infinite loops
 */

// Ensure __DEV__ is defined in test environments
const isDevelopment = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';

// Logging configuration based on environment
export interface LoggingConfig {
  /** Enable debug logging */
  enableDebug: boolean;
  /** Enable info logging */
  enableInfo: boolean;
  /** Enable warning logging */
  enableWarning: boolean;
  /** Enable error logging (always enabled) */
  enableError: boolean;
  /** Rate limit window in milliseconds */
  rateLimitWindow: number;
  /** Maximum logs per window per message type */
  maxLogsPerWindow: number;
  /** Throttle viewport change logs */
  throttleViewportLogs: boolean;
}

// Default logging configuration
const DEFAULT_CONFIG: LoggingConfig = {
  enableDebug: isDevelopment,
  enableInfo: true,
  enableWarning: true,
  enableError: true,
  rateLimitWindow: 5000, // 5 seconds
  maxLogsPerWindow: 10, // Max logs per message type per window
  throttleViewportLogs: true
};

// Current logging configuration
let currentConfig: LoggingConfig = { ...DEFAULT_CONFIG };

// Rate limiting configuration
const SESSION_MESSAGES = new Set<string>(); // Track session-level messages
const THROTTLED_MESSAGES = new Map<string, number>(); // Track throttled messages with timestamps

// Rate limiting storage
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();

// Viewport-specific throttling
const VIEWPORT_THROTTLE_WINDOW = 1000; // 1 second for viewport changes
let lastViewportLogTime = 0;

/**
 * Set logging configuration
 */
export const setLoggingConfig = (config: Partial<LoggingConfig>): void => {
  currentConfig = { ...currentConfig, ...config };
};

/**
 * Get current logging configuration
 */
export const getLoggingConfig = (): LoggingConfig => {
  return { ...currentConfig };
};

/**
 * Check if a log level is enabled
 */
const isLogLevelEnabled = (level: string): boolean => {
  switch (level) {
    case 'debug':
      return currentConfig.enableDebug;
    case 'info':
      return currentConfig.enableInfo;
    case 'warn':
      return currentConfig.enableWarning;
    case 'error':
      return currentConfig.enableError;
    default:
      return true;
  }
};

/**
 * Check if a message should be throttled for viewport changes
 */
const shouldThrottleViewportMessage = (message: string): boolean => {
  if (!currentConfig.throttleViewportLogs) {
    return false;
  }
  
  // Check if message is viewport-related
  const viewportKeywords = ['viewport', 'camera', 'bounds', 'region', 'zoom', 'pan'];
  const isViewportMessage = viewportKeywords.some(keyword => 
    message.toLowerCase().includes(keyword)
  );
  
  if (!isViewportMessage) {
    return false;
  }
  
  const now = Date.now();
  if (now - lastViewportLogTime < VIEWPORT_THROTTLE_WINDOW) {
    return true; // Throttle viewport messages
  }
  
  lastViewportLogTime = now;
  return false;
};

/**
 * Checks if a log message should be rate limited
 */
const shouldRateLimit = (message: string, level: string): boolean => {
  // Don't rate limit errors - they're always important
  if (level === 'error') {
    return false;
  }
  
  // Check if log level is enabled
  if (!isLogLevelEnabled(level)) {
    return true; // Effectively rate limit by disabling
  }
  
  // Check viewport throttling
  if (shouldThrottleViewportMessage(message)) {
    return true;
  }
  
  const key = `${level}:${message}`;
  const now = Date.now();
  
  const existing = rateLimitMap.get(key);
  
  if (!existing || (now - existing.windowStart) > currentConfig.rateLimitWindow) {
    // New window or first occurrence
    rateLimitMap.set(key, { count: 1, windowStart: now });
    return false;
  }
  
  if (existing.count >= currentConfig.maxLogsPerWindow) {
    return true; // Rate limited
  }
  
  existing.count++;
  return false;
};

/**
 * Checks if a message should be logged only once per session
 */
const shouldLogOncePerSession = (message: string): boolean => {
  if (SESSION_MESSAGES.has(message)) {
    return false;
  }
  SESSION_MESSAGES.add(message);
  return true;
};

/**
 * Throttle a message with a specific key and time window
 */
const shouldThrottleMessage = (key: string, throttleWindow: number): boolean => {
  const now = Date.now();
  const lastTime = THROTTLED_MESSAGES.get(key);
  
  if (!lastTime || (now - lastTime) >= throttleWindow) {
    THROTTLED_MESSAGES.set(key, now);
    return false;
  }
  
  return true;
};

// Create a safe logger that always has methods defined
const createLogger = () => {
  const safeLog = (level: string, message: string, ...args: any[]) => {
    try {
      // Check for rate limiting
      if (shouldRateLimit(message, level)) {
        return; // Skip this log
      }
      
      if (level === 'error') {
        console.error(`❌ ${message}`, ...args);
      } else if (isDevelopment || level === 'warn' || level === 'info') {
        const prefix = level === 'debug' ? '🐛' : level === 'warn' ? '⚠️' : level === 'success' ? '✅' : 'ℹ️';
        console.log(`${prefix} ${message}`, ...args);
      }
    } catch (e) {
      // Fallback to basic console if anything fails
      console.log(`[${level.toUpperCase()}] ${message}`, ...args);
    }
  };

  const safeLogOnce = (level: string, message: string, ...args: any[]) => {
    if (shouldLogOncePerSession(message)) {
      safeLog(level, message, ...args);
    }
  };

  const safeLogThrottled = (level: string, message: string, throttleWindow: number, ...args: any[]) => {
    const key = `${level}:${message}`;
    if (!shouldThrottleMessage(key, throttleWindow)) {
      safeLog(level, message, ...args);
    }
  };

  return {
    info: (message: string, ...args: any[]) => safeLog('info', message, ...args),
    error: (message: string, ...args: any[]) => safeLog('error', message, ...args),
    warn: (message: string, ...args: any[]) => safeLog('warn', message, ...args),
    debug: (message: string, ...args: any[]) => safeLog('debug', message, ...args),
    success: (message: string, ...args: any[]) => safeLog('success', message, ...args),
    
    // Session-based logging methods
    infoOnce: (message: string, ...args: any[]) => safeLogOnce('info', message, ...args),
    warnOnce: (message: string, ...args: any[]) => safeLogOnce('warn', message, ...args),
    debugOnce: (message: string, ...args: any[]) => safeLogOnce('debug', message, ...args),
    successOnce: (message: string, ...args: any[]) => safeLogOnce('success', message, ...args),
    
    // Throttled logging methods
    infoThrottled: (message: string, throttleMs: number = 5000, ...args: any[]) => 
      safeLogThrottled('info', message, throttleMs, ...args),
    warnThrottled: (message: string, throttleMs: number = 5000, ...args: any[]) => 
      safeLogThrottled('warn', message, throttleMs, ...args),
    debugThrottled: (message: string, throttleMs: number = 5000, ...args: any[]) => 
      safeLogThrottled('debug', message, throttleMs, ...args),
    
    // Viewport-specific logging (heavily throttled)
    debugViewport: (message: string, ...args: any[]) => 
      safeLogThrottled('debug', `[VIEWPORT] ${message}`, VIEWPORT_THROTTLE_WINDOW, ...args),
    infoViewport: (message: string, ...args: any[]) => 
      safeLogThrottled('info', `[VIEWPORT] ${message}`, VIEWPORT_THROTTLE_WINDOW, ...args)
  };
};

export const logger = createLogger();
