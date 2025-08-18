/**
 * Mock implementation for logger utility
 * Provides consistent mock behavior for all logging operations
 */

const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  success: jest.fn(),
  
  // Session-based logging methods
  infoOnce: jest.fn(),
  warnOnce: jest.fn(),
  debugOnce: jest.fn(),
  successOnce: jest.fn(),
  
  // Throttled logging methods
  infoThrottled: jest.fn(),
  warnThrottled: jest.fn(),
  debugThrottled: jest.fn(),
  
  // Viewport-specific logging (heavily throttled)
  debugViewport: jest.fn(),
  infoViewport: jest.fn()
};

module.exports = {
  logger: mockLogger
};