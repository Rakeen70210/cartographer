/**
 * @jest-environment node
 */

// Mock expo-sqlite before importing database
jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn(() => ({
    runAsync: jest.fn().mockResolvedValue(undefined),
    getAllAsync: jest.fn().mockResolvedValue([]),
    execAsync: jest.fn().mockResolvedValue(undefined),
  })),
}));

// Mock logger
jest.mock('./logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

import { getLocations, getRevealedAreas, saveRevealedArea } from '../utils/database';

describe('database utils', () => {
  it('getLocations returns an array', async () => {
    const result = await getLocations();
    expect(Array.isArray(result)).toBe(true);
  });

  it('getRevealedAreas returns an array', async () => {
    const result = await getRevealedAreas();
    expect(Array.isArray(result)).toBe(true);
  });

  it('saveRevealedArea does not throw', async () => {
    await expect(saveRevealedArea({ type: 'FeatureCollection', features: [] })).resolves.not.toThrow();
  });
});