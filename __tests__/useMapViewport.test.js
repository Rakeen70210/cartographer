import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useMapViewport } from '../hooks/useMapViewport';

// Mock dependencies
jest.mock('../utils/logger');

// Mock timers for debouncing tests
jest.useFakeTimers();

describe('useMapViewport', () => {
  const validBounds = [-122.5, 37.7, -122.3, 37.8]; // San Francisco area
  const validBounds2 = [-122.0, 37.0, -121.8, 37.2]; // Significantly different bounds

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.useFakeTimers();
  });

  describe('initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useMapViewport());

      expect(result.current.bounds).toBe(null);
      expect(result.current.zoom).toBe(10);
      expect(result.current.center).toBe(null);
      expect(result.current.isChanging).toBe(false);
      expect(result.current.lastUpdateTime).toBe(0);
      expect(result.current.isInitialized).toBe(false);
    });

    it('should initialize with custom options', () => {
      const options = {
        debounceDelay: 500,
        trackViewportChanges: false,
        minZoom: 5,
        maxZoom: 18,
        boundsChangeThreshold: 0.01
      };

      const { result } = renderHook(() => useMapViewport(options));

      expect(result.current).toBeDefined();
      // Options are used internally, not exposed in return value
    });
  });

  describe('updateViewportBounds', () => {
    it('should update viewport bounds with debouncing', async () => {
      const { result } = renderHook(() => useMapViewport({ debounceDelay: 100 }));

      act(() => {
        result.current.updateViewportBounds(validBounds, 12, [-122.4, 37.75]);
      });

      // Should set changing state immediately if tracking is enabled
      expect(result.current.isChanging).toBe(true);
      expect(result.current.bounds).toBe(null); // Not updated yet due to debouncing

      // Fast-forward timers to trigger debounced update
      act(() => {
        jest.advanceTimersByTime(100);
      });

      await waitFor(() => {
        expect(result.current.bounds).toEqual(validBounds);
        expect(result.current.zoom).toBe(12);
        expect(result.current.center).toEqual([-122.4, 37.75]);
        expect(result.current.isChanging).toBe(false);
        expect(result.current.isInitialized).toBe(true);
      });
    });

    it('should calculate center automatically if not provided', async () => {
      const { result } = renderHook(() => useMapViewport({ debounceDelay: 50 }));

      act(() => {
        result.current.updateViewportBounds(validBounds, 12);
      });

      act(() => {
        jest.advanceTimersByTime(50);
      });

      await waitFor(() => {
        expect(result.current.center).toEqual([-122.4, 37.75]); // Calculated center
      });
    });

    it('should validate bounds and reject invalid ones', async () => {
      const { result } = renderHook(() => useMapViewport({ debounceDelay: 50 }));

      // Test invalid bounds (longitude out of range)
      act(() => {
        result.current.updateViewportBounds([-200, 37.7, -122.3, 37.8]);
      });

      act(() => {
        jest.advanceTimersByTime(50);
      });

      await waitFor(() => {
        expect(result.current.bounds).toBe(null); // Should remain null
        expect(result.current.isInitialized).toBe(false);
      });
    });

    it('should validate and clamp zoom levels', async () => {
      const { result } = renderHook(() => useMapViewport({ 
        debounceDelay: 50,
        minZoom: 5,
        maxZoom: 15
      }));

      // Test zoom level above maximum
      act(() => {
        result.current.updateViewportBounds(validBounds, 20);
      });

      act(() => {
        jest.advanceTimersByTime(50);
      });

      await waitFor(() => {
        expect(result.current.zoom).toBe(15); // Clamped to maximum
      });

      // Test zoom level below minimum
      act(() => {
        result.current.updateViewportBounds(validBounds, 2);
      });

      act(() => {
        jest.advanceTimersByTime(50);
      });

      await waitFor(() => {
        expect(result.current.zoom).toBe(5); // Clamped to minimum
      });
    });

    it('should cancel previous debounced updates', async () => {
      const { result } = renderHook(() => useMapViewport({ debounceDelay: 100 }));

      act(() => {
        result.current.updateViewportBounds(validBounds, 12);
      });

      // Advance time partially
      act(() => {
        jest.advanceTimersByTime(50);
      });

      act(() => {
        result.current.updateViewportBounds(validBounds2, 14);
      });

      // Complete the debounce period
      act(() => {
        jest.advanceTimersByTime(100);
      });

      await waitFor(() => {
        expect(result.current.bounds).toEqual(validBounds2); // Should use the latest bounds
        expect(result.current.zoom).toBe(14);
      });
    });
  });

  describe('setViewportChanging', () => {
    it('should update viewport changing state', () => {
      const { result } = renderHook(() => useMapViewport());

      expect(result.current.isChanging).toBe(false);

      act(() => {
        result.current.setViewportChanging(true);
      });

      expect(result.current.isChanging).toBe(true);

      act(() => {
        result.current.setViewportChanging(false);
      });

      expect(result.current.isChanging).toBe(false);
    });

    it('should not interfere with pending debounced updates', async () => {
      const { result } = renderHook(() => useMapViewport({ debounceDelay: 100 }));

      act(() => {
        result.current.updateViewportBounds(validBounds, 12);
      });

      act(() => {
        result.current.setViewportChanging(false);
      });

      // The debounced update should still complete
      act(() => {
        jest.advanceTimersByTime(100);
      });

      await waitFor(() => {
        expect(result.current.bounds).toEqual(validBounds);
      });
    });
  });

  describe('getViewportBbox', () => {
    it('should return current bounds', async () => {
      const { result } = renderHook(() => useMapViewport({ debounceDelay: 50 }));

      expect(result.current.getViewportBbox()).toBe(null);

      act(() => {
        result.current.updateViewportBounds(validBounds);
      });

      act(() => {
        jest.advanceTimersByTime(50);
      });

      await waitFor(() => {
        expect(result.current.getViewportBbox()).toEqual(validBounds);
      });
    });
  });

  describe('hasBoundsChanged', () => {
    it('should return true for first bounds update', () => {
      const { result } = renderHook(() => useMapViewport());

      expect(result.current.hasBoundsChanged(validBounds)).toBe(true);
    });

    it('should detect significant bounds changes', async () => {
      const { result } = renderHook(() => useMapViewport({ 
        debounceDelay: 50,
        boundsChangeThreshold: 0.01 // Larger threshold for more reliable testing
      }));

      // Set initial bounds
      act(() => {
        result.current.updateViewportBounds(validBounds);
      });

      act(() => {
        jest.advanceTimersByTime(50);
      });

      await waitFor(() => {
        expect(result.current.bounds).toEqual(validBounds);
      });

      // Test with significantly different bounds
      expect(result.current.hasBoundsChanged(validBounds2)).toBe(true);

      // Test with very similar bounds (within threshold)
      const similarBounds = [-122.501, 37.701, -122.299, 37.799];
      expect(result.current.hasBoundsChanged(similarBounds)).toBe(false);
    });

    it('should respect custom bounds change threshold', async () => {
      const { result } = renderHook(() => useMapViewport({ 
        debounceDelay: 50,
        boundsChangeThreshold: 1.0 // Very large threshold
      }));

      // Set initial bounds
      act(() => {
        result.current.updateViewportBounds(validBounds);
      });

      act(() => {
        jest.advanceTimersByTime(50);
      });

      await waitFor(() => {
        expect(result.current.bounds).toEqual(validBounds);
      });

      // Even significantly different bounds should be considered unchanged with very large threshold
      expect(result.current.hasBoundsChanged(validBounds2)).toBe(false);
    });
  });

  describe('resetViewport', () => {
    it('should reset viewport to initial state', async () => {
      const { result } = renderHook(() => useMapViewport({ debounceDelay: 50 }));

      // Set some viewport data
      act(() => {
        result.current.updateViewportBounds(validBounds, 15, [-122.4, 37.75]);
      });

      act(() => {
        jest.advanceTimersByTime(50);
      });

      await waitFor(() => {
        expect(result.current.bounds).toEqual(validBounds);
        expect(result.current.isInitialized).toBe(true);
      });

      // Reset viewport
      act(() => {
        result.current.resetViewport();
      });

      expect(result.current.bounds).toBe(null);
      expect(result.current.zoom).toBe(10);
      expect(result.current.center).toBe(null);
      expect(result.current.isChanging).toBe(false);
      expect(result.current.lastUpdateTime).toBe(0);
      expect(result.current.isInitialized).toBe(false);
    });

    it('should cancel pending debounced updates', () => {
      const { result } = renderHook(() => useMapViewport({ debounceDelay: 100 }));

      act(() => {
        result.current.updateViewportBounds(validBounds);
      });

      act(() => {
        result.current.resetViewport();
      });

      // Advance timers - the update should not happen
      act(() => {
        jest.advanceTimersByTime(100);
      });

      expect(result.current.bounds).toBe(null);
    });
  });

  describe('viewport changing timeout', () => {
    it('should automatically clear changing state after timeout', async () => {
      const { result } = renderHook(() => useMapViewport({ 
        debounceDelay: 100,
        trackViewportChanges: true
      }));

      act(() => {
        result.current.setViewportChanging(true);
      });

      expect(result.current.isChanging).toBe(true);

      // Fast-forward to timeout (3x debounce delay)
      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(result.current.isChanging).toBe(false);
      });
    });

    it('should not set timeout when trackViewportChanges is disabled', () => {
      const { result } = renderHook(() => useMapViewport({ 
        debounceDelay: 100,
        trackViewportChanges: false
      }));

      act(() => {
        result.current.setViewportChanging(true);
      });

      // Fast-forward timers
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      // Should remain true since timeout is not set
      expect(result.current.isChanging).toBe(true);
    });
  });

  describe('bounds validation', () => {
    it('should reject bounds with invalid longitude', async () => {
      const { result } = renderHook(() => useMapViewport({ debounceDelay: 50 }));

      const invalidBounds = [-200, 37.7, -122.3, 37.8]; // Invalid longitude

      act(() => {
        result.current.updateViewportBounds(invalidBounds);
      });

      act(() => {
        jest.advanceTimersByTime(50);
      });

      await waitFor(() => {
        expect(result.current.bounds).toBe(null);
      });
    });

    it('should reject bounds with invalid latitude', async () => {
      const { result } = renderHook(() => useMapViewport({ debounceDelay: 50 }));

      const invalidBounds = [-122.5, -100, -122.3, 37.8]; // Invalid latitude

      act(() => {
        result.current.updateViewportBounds(invalidBounds);
      });

      act(() => {
        jest.advanceTimersByTime(50);
      });

      await waitFor(() => {
        expect(result.current.bounds).toBe(null);
      });
    });

    it('should reject bounds with incorrect order', async () => {
      const { result } = renderHook(() => useMapViewport({ debounceDelay: 50 }));

      const invalidBounds = [-122.3, 37.7, -122.5, 37.8]; // minLng > maxLng

      act(() => {
        result.current.updateViewportBounds(invalidBounds);
      });

      act(() => {
        jest.advanceTimersByTime(50);
      });

      await waitFor(() => {
        expect(result.current.bounds).toBe(null);
      });
    });

    it('should reject bounds with non-finite values', async () => {
      const { result } = renderHook(() => useMapViewport({ debounceDelay: 50 }));

      const invalidBounds = [-122.5, 37.7, NaN, 37.8]; // Contains NaN

      act(() => {
        result.current.updateViewportBounds(invalidBounds);
      });

      act(() => {
        jest.advanceTimersByTime(50);
      });

      await waitFor(() => {
        expect(result.current.bounds).toBe(null);
      });
    });
  });

  describe('cleanup', () => {
    it('should cleanup debounce timers on unmount', () => {
      const { result, unmount } = renderHook(() => useMapViewport());

      act(() => {
        result.current.updateViewportBounds(validBounds);
      });

      unmount();

      // Advance timers after unmount
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      // Should not cause any errors or state updates
      expect(result.current.bounds).toBe(null);
    });

    it('should ignore updates after unmount', () => {
      const { result, unmount } = renderHook(() => useMapViewport({ debounceDelay: 50 }));

      act(() => {
        result.current.updateViewportBounds(validBounds);
      });

      unmount();

      // Try to advance timers after unmount
      act(() => {
        jest.advanceTimersByTime(50);
      });

      // State should not be updated after unmount
      expect(result.current.bounds).toBe(null);
    });
  });

  describe('edge cases', () => {
    it('should handle rapid successive updates', async () => {
      const { result } = renderHook(() => useMapViewport({ debounceDelay: 100 }));

      // Fire multiple rapid updates
      act(() => {
        result.current.updateViewportBounds(validBounds, 10);
        result.current.updateViewportBounds(validBounds2, 12);
        result.current.updateViewportBounds(validBounds, 14);
      });

      // Only the last update should take effect
      act(() => {
        jest.advanceTimersByTime(100);
      });

      await waitFor(() => {
        expect(result.current.bounds).toEqual(validBounds);
        expect(result.current.zoom).toBe(14);
      });
    });

    it('should handle zero debounce delay', async () => {
      const { result } = renderHook(() => useMapViewport({ debounceDelay: 0 }));

      act(() => {
        result.current.updateViewportBounds(validBounds, 12);
      });

      act(() => {
        jest.advanceTimersByTime(0);
      });

      await waitFor(() => {
        expect(result.current.bounds).toEqual(validBounds);
        expect(result.current.zoom).toBe(12);
      });
    });
  });
});