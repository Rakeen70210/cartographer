import { networkUtils, retryWithBackoff, withOfflineFallback } from '../utils/networkUtils';

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(),
  fetch: jest.fn(),
}));

// Mock fetch
global.fetch = jest.fn();

describe('NetworkUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch.mockClear();
    // Clear cached network state to ensure fresh state for each test
    networkUtils.clearCache();
  });

  describe('Connectivity Testing', () => {
    it('should test connectivity successfully', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200
      });

      const result = await networkUtils.testConnectivity();
      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://httpbin.org/status/200',
        expect.objectContaining({
          method: 'HEAD',
          cache: 'no-cache'
        })
      );
    });

    it('should handle connectivity test failure', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'));

      const result = await networkUtils.testConnectivity();
      expect(result).toBe(false);
    });

    it('should retry connectivity test with backoff', async () => {
      global.fetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue({ ok: true, status: 200 });

      const result = await networkUtils.testConnectivity({
        retryAttempts: 3,
        retryDelay: 100
      });

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should timeout connectivity test', async () => {
      global.fetch.mockImplementation((url, options) => 
        new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => resolve({ ok: true }), 1000); // Reduced delay
          
          // Handle abort signal
          if (options?.signal) {
            options.signal.addEventListener('abort', () => {
              clearTimeout(timeoutId);
              reject(new Error('The operation was aborted'));
            });
          }
        })
      );

      const result = await networkUtils.testConnectivity({
        timeout: 200, // Reduced timeout for faster test execution
        retryAttempts: 1
      });

      expect(result).toBe(false);
    });
  });

  describe('Network State Management', () => {
    it('should get current network state', async () => {
      const mockState = {
        isConnected: true,
        isInternetReachable: true,
        type: 'wifi',
        details: {}
      };

      const NetInfo = require('@react-native-community/netinfo');
      NetInfo.fetch.mockResolvedValue(mockState);

      const state = await networkUtils.getCurrentState();
      
      expect(state.isConnected).toBe(true);
      expect(state.isInternetReachable).toBe(true);
      expect(state.type).toBe('wifi');
    });

    it('should handle network state fetch error', async () => {
      const NetInfo = require('@react-native-community/netinfo');
      NetInfo.fetch.mockRejectedValue(new Error('NetInfo error'));

      const state = await networkUtils.getCurrentState();
      
      expect(state.isConnected).toBe(false);
      expect(state.type).toBe('unknown');
    });

    it('should determine online status correctly', async () => {
      const NetInfo = require('@react-native-community/netinfo');
      NetInfo.fetch.mockResolvedValue({
        isConnected: true,
        isInternetReachable: true,
        type: 'wifi'
      });

      const isOnline = await networkUtils.isOnline();
      expect(isOnline).toBe(true);
    });

    it('should determine offline status correctly', async () => {
      const NetInfo = require('@react-native-community/netinfo');
      NetInfo.fetch.mockResolvedValue({
        isConnected: false,
        isInternetReachable: false,
        type: 'none'
      });

      const isOffline = await networkUtils.isOffline();
      expect(isOffline).toBe(true);
    });
  });

  describe('Connection Quality Assessment', () => {
    it('should assess WiFi connection as good', async () => {
      const NetInfo = require('@react-native-community/netinfo');
      NetInfo.fetch.mockResolvedValue({
        isConnected: true,
        type: 'wifi',
        details: {}
      });

      const quality = await networkUtils.getConnectionQuality();
      expect(quality).toBe('good');
    });

    it('should assess cellular connection quality', async () => {
      const NetInfo = require('@react-native-community/netinfo');
      NetInfo.fetch.mockResolvedValue({
        isConnected: true,
        type: 'cellular',
        details: { cellularGeneration: '4g' }
      });

      const quality = await networkUtils.getConnectionQuality();
      expect(quality).toBe('good');
    });

    it('should assess poor connection when disconnected', async () => {
      const NetInfo = require('@react-native-community/netinfo');
      NetInfo.fetch.mockResolvedValue({
        isConnected: false,
        type: 'none'
      });

      const quality = await networkUtils.getConnectionQuality();
      expect(quality).toBe('poor');
    });
  });

  describe('Connection Waiting', () => {
    it('should wait for connection successfully', async () => {
      const NetInfo = require('@react-native-community/netinfo');
      
      // Mock initial offline state
      NetInfo.fetch.mockResolvedValue({
        isConnected: false,
        isInternetReachable: false
      });

      // Mock listener that will be called with online state
      let listenerCallback;
      networkUtils.addListener = jest.fn((callback) => {
        listenerCallback = callback;
        return jest.fn(); // unsubscribe function
      });

      const waitPromise = networkUtils.waitForConnection(5000);

      // Simulate coming online
      const timeoutId = setTimeout(() => {
        if (listenerCallback) {
          listenerCallback({
            isConnected: true,
            isInternetReachable: true,
            type: 'wifi'
          });
        }
      }, 100);

      const result = await waitPromise;
      clearTimeout(timeoutId); // Clean up timeout
      expect(result).toBe(true);
    });

    it('should timeout when waiting for connection', async () => {
      const NetInfo = require('@react-native-community/netinfo');
      NetInfo.fetch.mockResolvedValue({
        isConnected: false,
        isInternetReachable: false
      });

      networkUtils.addListener = jest.fn(() => jest.fn());

      const result = await networkUtils.waitForConnection(100);
      expect(result).toBe(false);
    });
  });
});

describe('withOfflineFallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should use online function when connected', async () => {
    const onlineFunction = jest.fn().mockResolvedValue('online result');
    const offlineFallback = jest.fn().mockResolvedValue('offline result');

    networkUtils.isOnline = jest.fn().mockResolvedValue(true);

    const result = await withOfflineFallback(onlineFunction, offlineFallback);

    expect(result.result).toBe('online result');
    expect(result.source).toBe('online');
    expect(onlineFunction).toHaveBeenCalled();
    expect(offlineFallback).not.toHaveBeenCalled();
  });

  it('should use offline fallback when disconnected', async () => {
    const onlineFunction = jest.fn().mockResolvedValue('online result');
    const offlineFallback = jest.fn().mockResolvedValue('offline result');

    networkUtils.isOnline = jest.fn().mockResolvedValue(false);

    const result = await withOfflineFallback(onlineFunction, offlineFallback);

    expect(result.result).toBe('offline result');
    expect(result.source).toBe('offline');
    expect(onlineFunction).not.toHaveBeenCalled();
    expect(offlineFallback).toHaveBeenCalled();
  });

  it('should use offline fallback when online function fails', async () => {
    const onlineFunction = jest.fn().mockRejectedValue(new Error('Online failed'));
    const offlineFallback = jest.fn().mockResolvedValue('offline result');

    networkUtils.isOnline = jest.fn().mockResolvedValue(true);

    const result = await withOfflineFallback(onlineFunction, offlineFallback);

    expect(result.result).toBe('offline result');
    expect(result.source).toBe('offline');
    expect(onlineFunction).toHaveBeenCalled();
    expect(offlineFallback).toHaveBeenCalled();
  });

  it('should handle timeout correctly', async () => {
    const onlineFunction = jest.fn().mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve('online result'), 1000)) // Reduced delay
    );
    const offlineFallback = jest.fn().mockResolvedValue('offline result');

    networkUtils.isOnline = jest.fn().mockResolvedValue(true);

    const result = await withOfflineFallback(
      onlineFunction, 
      offlineFallback, 
      { timeout: 200 } // Reduced timeout
    );

    expect(result.result).toBe('offline result');
    expect(result.source).toBe('offline');
  });

  it('should skip connectivity test when disabled', async () => {
    const onlineFunction = jest.fn().mockResolvedValue('online result');
    const offlineFallback = jest.fn().mockResolvedValue('offline result');

    networkUtils.isOnline = jest.fn().mockResolvedValue(false);

    const result = await withOfflineFallback(
      onlineFunction, 
      offlineFallback, 
      { testConnectivity: false }
    );

    expect(result.result).toBe('online result');
    expect(result.source).toBe('online');
    expect(networkUtils.isOnline).not.toHaveBeenCalled();
  });
});

describe('retryWithBackoff', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should succeed on first attempt', async () => {
    const fn = jest.fn().mockResolvedValue('success');

    const result = await retryWithBackoff(fn);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry and eventually succeed', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('Attempt 1 failed'))
      .mockRejectedValueOnce(new Error('Attempt 2 failed'))
      .mockResolvedValue('success');

    const result = await retryWithBackoff(fn, {
      maxAttempts: 3,
      initialDelay: 10
    });

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should fail after max attempts', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('Always fails'));

    await expect(retryWithBackoff(fn, {
      maxAttempts: 2,
      initialDelay: 10
    })).rejects.toThrow('Always fails');

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should respect shouldRetry condition', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('Non-retryable error'));
    const shouldRetry = jest.fn().mockReturnValue(false);

    await expect(retryWithBackoff(fn, {
      maxAttempts: 3,
      shouldRetry
    })).rejects.toThrow('Non-retryable error');

    expect(fn).toHaveBeenCalledTimes(1);
    expect(shouldRetry).toHaveBeenCalledWith(expect.any(Error));
  });

  it('should use exponential backoff', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('Attempt 1'))
      .mockRejectedValueOnce(new Error('Attempt 2'))
      .mockResolvedValue('success');

    const startTime = Date.now();
    
    const result = await retryWithBackoff(fn, {
      maxAttempts: 3,
      initialDelay: 100,
      backoffFactor: 2
    });

    const endTime = Date.now();
    const totalTime = endTime - startTime;

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
    // Should have waited at least 100ms + 200ms = 300ms
    expect(totalTime).toBeGreaterThan(250);
  });

  it('should respect max delay', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('Attempt 1'))
      .mockRejectedValueOnce(new Error('Attempt 2'))
      .mockResolvedValue('success');

    const result = await retryWithBackoff(fn, {
      maxAttempts: 3,
      initialDelay: 1000,
      backoffFactor: 10,
      maxDelay: 500
    });

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });
});