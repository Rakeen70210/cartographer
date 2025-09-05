/**
 * @jest-environment node
 */

// Mock the database module before importing
jest.mock('@/utils/database', () => ({
  getLocations: jest.fn().mockResolvedValue([]),
  getRevealedAreas: jest.fn().mockResolvedValue([]),
  saveRevealedArea: jest.fn().mockResolvedValue({ id: 1 }),
}));

import { getLocations, getRevealedAreas, saveRevealedArea } from '@/utils/database';

describe('database utils', () => {
  it('getLocations returns an array', async () => {
    const result = await getLocations();
    console.log('getLocations result:', result, 'type:', typeof result, 'isArray:', Array.isArray(result));
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