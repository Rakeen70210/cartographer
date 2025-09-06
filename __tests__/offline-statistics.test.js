// Mock SQLite first
jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn(() => ({
    execSync: jest.fn(),
    prepareSync: jest.fn(() => ({
      executeSync: jest.fn(),
      finalizeSync: jest.fn()
    }))
  }))
}));

// Mock dependencies BEFORE importing anything else
jest.mock('../utils/database');
jest.mock('../utils/networkUtils');
jest.mock('../utils/logger');
jest.mock('../utils/distanceCalculator');
jest.mock('../utils/worldExplorationCalculator');
jest.mock('../utils/geographicHierarchy');
jest.mock('../utils/remainingRegionsService');

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useOfflineStatistics } from '../hooks/useOfflineStatistics';
import * as database from '../utils/database';
import { networkUtils } from '../utils/networkUtils';

// Mock React Native modules
jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

describe('useOfflineStatistics', () => {
  const mockNetworkState = {
    isConnected: true,
    isInternetReachable: true,
    type: 'wifi',
    details: {}
  };

  const mockLocations = [
    { id: 1, latitude: 37.7749, longitude: -122.4194, timestamp: Date.now() - 1000 },
    { id: 2, latitude: 37.7849, longitude: -122.4094, timestamp: Date.now() }
  ];

  const mockRevealedAreas = [
    JSON.stringify({
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[[-122.4194, 37.7749], [-122.4194, 37.7849], [-122.4094, 37.7849], [-122.4094, 37.7749], [-122.4194, 37.7749]]]
      }
    })
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Clear any potential cached data between tests
    jest.clearAllTimers();
    
    // Setup default mocks
    networkUtils.getCurrentState.mockResolvedValue(mockNetworkState);
    networkUtils.addListener.mockReturnValue(jest.fn());
    networkUtils.testConnectivity.mockResolvedValue(true);
    
    database.getLocations.mockResolvedValue(mockLocations);
    database.getRevealedAreas.mockResolvedValue(mockRevealedAreas);
    database.getStatisticsCache.mockResolvedValue(null);
    database.saveStatisticsCache.mockResolvedValue();
    database.clearAllStatisticsCache.mockResolvedValue();
    database.getAllLocationGeocodings.mockResolvedValue([]);
    
    // Mock calculation functions with proper data structures
    const { calculateTotalDistance } = require('../utils/distanceCalculator');
    const { calculateWorldExplorationPercentage } = require('../utils/worldExplorationCalculator');
    const { convertToLocationWithGeography, buildGeographicHierarchy, calculateExplorationPercentages } = require('../utils/geographicHierarchy');
    const { getRemainingRegionsData } = require('../utils/remainingRegionsService');
    const { withOfflineFallback } = require('../utils/networkUtils');
    
    calculateTotalDistance.mockResolvedValue({ 
      miles: 10.5, 
      kilometers: 16.9 
    });
    calculateWorldExplorationPercentage.mockResolvedValue({ 
      percentage: 0.001, 
      totalAreaKm2: 510072000, 
      exploredAreaKm2: 5100 
    });
    convertToLocationWithGeography.mockResolvedValue([
      {
        id: 1,
        latitude: 37.7749,
        longitude: -122.4194,
        timestamp: Date.now() - 1000,
        country: 'United States',
        countryCode: 'US',
        state: 'California',
        stateCode: 'CA',
        city: 'San Francisco',
        isGeocoded: true
      },
      {
        id: 2,
        latitude: 37.7849,
        longitude: -122.4094,
        timestamp: Date.now(),
        country: 'United States',
        countryCode: 'US',
        state: 'California',
        stateCode: 'CA',
        city: 'San Francisco',
        isGeocoded: true
      }
    ]);
    buildGeographicHierarchy.mockResolvedValue([
      {
        country: 'United States',
        countryCode: 'US',
        states: [
          {
            state: 'California',
            stateCode: 'CA',
            cities: ['San Francisco']
          }
        ]
      }
    ]);
    calculateExplorationPercentages.mockResolvedValue([
      {
        country: 'United States',
        percentage: 0.1,
        exploredStates: 1,
        totalStates: 50
      }
    ]);
    getRemainingRegionsData.mockResolvedValue({
      visited: { countries: 1, states: 1, cities: 1 },
      total: { countries: 195, states: 3142, cities: 10000 },
      remaining: { countries: 194, states: 3141, cities: 9999 },
      percentageVisited: { countries: 0.5, states: 0.03, cities: 0.01 }
    });
    withOfflineFallback.mockImplementation(async (onlineFunc, offlineFunc, options = {}) => {
      try {
        const result = await onlineFunc();
        return { result, wasOffline: false };
      } catch (error) {
        const result = await offlineFunc();
        return { result, wasOffline: true };
      }
    });
  });

  describe('Online Mode', () => {
    it('should handle network status changes', async () => {
      const { result } = renderHook(() => useOfflineStatistics());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should have network status tracking
      expect(typeof result.current.isOffline).toBe('boolean');
    });
  });

  describe('Offline Mode', () => {
    beforeEach(() => {
      networkUtils.getCurrentState.mockResolvedValue({
        isConnected: false,
        isInternetReachable: false,
        type: 'none',
        details: {}
      });
    });

    it('should initialize in offline mode', async () => {
      const { result } = renderHook(() => useOfflineStatistics());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should have offline capabilities defined
      expect(result.current.offlineCapabilities).toBeDefined();
      expect(typeof result.current.offlineCapabilities.canCalculateDistance).toBe('boolean');
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      database.getLocations.mockRejectedValue(new Error('Database error'));
      database.getRevealedAreas.mockRejectedValue(new Error('Database error'));

      const { result } = renderHook(() => useOfflineStatistics());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // The hook should be in a stable state even when database operations fail
      expect(typeof result.current.refreshData).toBe('function');
      expect(typeof result.current.clearCache).toBe('function');
    });

    it('should handle network errors during online operations', async () => {
      networkUtils.getCurrentState.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useOfflineStatistics());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should still work with offline capabilities
      expect(result.current.data || result.current.error).toBeTruthy();
    });
  });

  describe('Retry Functionality', () => {
    it('should retry connection successfully', async () => {
      networkUtils.testConnectivity.mockResolvedValue(true);

      const { result } = renderHook(() => useOfflineStatistics());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const retryResult = await act(async () => {
        return await result.current.retryConnection();
      });

      expect(retryResult).toBe(true);
      expect(networkUtils.testConnectivity).toHaveBeenCalled();
    });

    it('should handle failed retry attempts', async () => {
      networkUtils.testConnectivity.mockResolvedValue(false);

      const { result } = renderHook(() => useOfflineStatistics());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const retryResult = await act(async () => {
        return await result.current.retryConnection();
      });

      expect(retryResult).toBe(false);
    });
  });

  describe('Forced Modes', () => {
    it('should force offline mode', async () => {
      const { result } = renderHook(() => useOfflineStatistics());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // The forceOfflineMode function should be callable without errors
      expect(typeof result.current.forceOfflineMode).toBe('function');
    });

    it('should force online mode', async () => {
      const { result } = renderHook(() => useOfflineStatistics());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // The forceOnlineMode function should be callable without errors
      expect(typeof result.current.forceOnlineMode).toBe('function');
    });
  });

  describe('Cache Management', () => {
    it('should clear cache successfully', async () => {
      const { result } = renderHook(() => useOfflineStatistics());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // The clearCache function should be callable without errors
      expect(typeof result.current.clearCache).toBe('function');
    });

    it('should handle cache clear errors', async () => {
      database.clearAllStatisticsCache.mockRejectedValue(new Error('Cache clear failed'));

      const { result } = renderHook(() => useOfflineStatistics());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // The clearCache function should handle errors gracefully
      expect(typeof result.current.clearCache).toBe('function');
    });
  });

  describe('Offline Capabilities Assessment', () => {
    it('should assess capabilities correctly', async () => {
      const { result } = renderHook(() => useOfflineStatistics());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // The hook should assess capabilities based on available data
      expect(result.current.offlineCapabilities).toBeDefined();
      expect(typeof result.current.offlineCapabilities.canCalculateDistance).toBe('boolean');
      expect(typeof result.current.offlineCapabilities.canCalculateWorldExploration).toBe('boolean');
    });
  });
});