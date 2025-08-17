/**
 * Mock implementation for logger utility
 * Provides consistent mock behavior for all logging operations
 */

const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  success: jest.fn()
};

module.exports = {
  logger: mockLogger
};