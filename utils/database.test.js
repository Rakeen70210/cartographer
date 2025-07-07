/**
 * @jest-environment node
 */
import { getLocations, getRevealedAreas, saveRevealedArea } from '../utils/database';

jest.mock('expo-sqlite', () => {
  const mockTx = {
    executeSqlAsync: jest.fn().mockResolvedValue({ rows: { _array: [] } }),
  };
  return {
    openDatabase: jest.fn(() => ({
      transactionAsync: jest.fn(cb => cb(mockTx)),
    })),
  };
});

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