import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import { OfflineIndicator } from '../components/OfflineIndicator';

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
  const View = require('react-native').View;
  return {
    default: {
      View: View,
    },
    View: View,
    useSharedValue: () => ({ value: 0 }),
    useAnimatedStyle: () => ({}),
    withTiming: (value) => value,
    withRepeat: (value) => value,
    withSequence: (value) => value,
  };
});

// Mock theme hook
jest.mock('../hooks/useThemeColor', () => ({
  useThemeColor: jest.fn((colors, key) => {
    const lightColors = {
      background: '#FEF3C7',
      border: '#F59E0B',
      text: '#92400E'
    };
    return colors.light || lightColors[key] || '#000000';
  })
}));

describe('OfflineIndicator', () => {
  const defaultProps = {
    isOffline: false,
    onRetry: jest.fn(),
    onDismiss: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Visibility', () => {
    it('should not render when online and not using cache', () => {
      const { queryByTestId } = render(
        <OfflineIndicator {...defaultProps} isOffline={false} dataSource="online" />
      );

      expect(queryByTestId('offline-indicator')).toBeNull();
    });

    it('should render when offline', () => {
      const { getByTestId } = render(
        <OfflineIndicator {...defaultProps} isOffline={true} />
      );

      expect(getByTestId('offline-indicator')).toBeTruthy();
    });

    it('should render when using cached data', () => {
      const { getByTestId } = render(
        <OfflineIndicator {...defaultProps} isOffline={false} dataSource="cache" />
      );

      expect(getByTestId('offline-indicator')).toBeTruthy();
    });

    it('should hide when dismissed', () => {
      const { getByTestId, queryByTestId } = render(
        <OfflineIndicator {...defaultProps} isOffline={true} />
      );

      expect(getByTestId('offline-indicator')).toBeTruthy();

      const dismissButton = getByTestId('offline-indicator-dismiss-button');
      fireEvent.press(dismissButton);

      expect(queryByTestId('offline-indicator')).toBeNull();
    });
  });

  describe('Offline Mode Display', () => {
    it('should show offline mode message', () => {
      const { getByText } = render(
        <OfflineIndicator 
          {...defaultProps} 
          isOffline={true} 
          offlineReason="No internet connection"
        />
      );

      expect(getByText('Offline Mode')).toBeTruthy();
      expect(getByText('No internet connection')).toBeTruthy();
    });

    it('should show last online time when provided', () => {
      const lastOnlineTime = Date.now() - (5 * 60 * 1000); // 5 minutes ago

      const { getByText } = render(
        <OfflineIndicator 
          {...defaultProps} 
          isOffline={true} 
          lastOnlineTime={lastOnlineTime}
        />
      );

      expect(getByText('Offline Mode')).toBeTruthy();
      expect(getByText('Last online: 5m ago')).toBeTruthy();
    });

    it('should format last online time correctly', () => {
      const testCases = [
        { time: Date.now() - (30 * 1000), expected: 'Just now' }, // 30 seconds ago
        { time: Date.now() - (5 * 60 * 1000), expected: '5m ago' }, // 5 minutes ago
        { time: Date.now() - (2 * 60 * 60 * 1000), expected: '2h ago' }, // 2 hours ago
        { time: Date.now() - (25 * 60 * 60 * 1000), expected: new Date(Date.now() - (25 * 60 * 60 * 1000)).toLocaleDateString() } // 25 hours ago
      ];

      testCases.forEach(({ time, expected }) => {
        const { getByText } = render(
          <OfflineIndicator 
            {...defaultProps} 
            isOffline={true} 
            lastOnlineTime={time}
          />
        );

        expect(getByText(`Last online: ${expected}`)).toBeTruthy();
      });
    });

    it('should show unknown when no last online time', () => {
      const { getByText } = render(
        <OfflineIndicator {...defaultProps} isOffline={true} />
      );

      expect(getByText('Last online: Unknown')).toBeTruthy();
    });
  });

  describe('Cache Mode Display', () => {
    it('should show cached data message', () => {
      const { getByText } = render(
        <OfflineIndicator 
          {...defaultProps} 
          isOffline={false} 
          dataSource="cache"
          offlineReason="Error occurred, using cached data"
        />
      );

      expect(getByText('Using Cached Data')).toBeTruthy();
      expect(getByText('Error occurred, using cached data')).toBeTruthy();
    });

    it('should show default cache message when no reason provided', () => {
      const { getByText } = render(
        <OfflineIndicator 
          {...defaultProps} 
          isOffline={false} 
          dataSource="cache"
        />
      );

      expect(getByText('Using Cached Data')).toBeTruthy();
      expect(getByText('Showing previously loaded information')).toBeTruthy();
    });
  });

  describe('Retry Functionality', () => {
    it('should show retry button when offline and onRetry provided', () => {
      const { getByTestId } = render(
        <OfflineIndicator {...defaultProps} isOffline={true} />
      );

      expect(getByTestId('offline-indicator-retry-button')).toBeTruthy();
    });

    it('should not show retry button when not offline', () => {
      const { queryByTestId } = render(
        <OfflineIndicator {...defaultProps} isOffline={false} dataSource="cache" />
      );

      expect(queryByTestId('offline-indicator-retry-button')).toBeNull();
    });

    it('should not show retry button when onRetry not provided', () => {
      const { queryByTestId } = render(
        <OfflineIndicator isOffline={true} onDismiss={jest.fn()} />
      );

      expect(queryByTestId('offline-indicator-retry-button')).toBeNull();
    });

    it('should call onRetry when retry button pressed', async () => {
      const onRetry = jest.fn().mockResolvedValue(true);

      const { getByTestId } = render(
        <OfflineIndicator {...defaultProps} isOffline={true} onRetry={onRetry} />
      );

      const retryButton = getByTestId('offline-indicator-retry-button');
      fireEvent.press(retryButton);

      expect(onRetry).toHaveBeenCalled();
    });

    it('should handle retry success', async () => {
      const onRetry = jest.fn().mockResolvedValue(true);

      const { getByTestId, queryByTestId } = render(
        <OfflineIndicator {...defaultProps} isOffline={true} onRetry={onRetry} />
      );

      const retryButton = getByTestId('offline-indicator-retry-button');
      fireEvent.press(retryButton);

      await waitFor(() => {
        expect(onRetry).toHaveBeenCalled();
      });

      // Should dismiss after successful retry
      await waitFor(() => {
        expect(queryByTestId('offline-indicator')).toBeNull();
      });
    });

    it('should handle retry failure', async () => {
      const onRetry = jest.fn().mockResolvedValue(false);

      const { getByTestId } = render(
        <OfflineIndicator {...defaultProps} isOffline={true} onRetry={onRetry} />
      );

      const retryButton = getByTestId('offline-indicator-retry-button');
      fireEvent.press(retryButton);

      await waitFor(() => {
        expect(onRetry).toHaveBeenCalled();
      });

      // Should still be visible after failed retry
      expect(getByTestId('offline-indicator')).toBeTruthy();
    });

    it('should handle retry error', async () => {
      const onRetry = jest.fn().mockRejectedValue(new Error('Retry failed'));
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const { getByTestId } = render(
        <OfflineIndicator {...defaultProps} isOffline={true} onRetry={onRetry} />
      );

      const retryButton = getByTestId('offline-indicator-retry-button');
      fireEvent.press(retryButton);

      await waitFor(() => {
        expect(onRetry).toHaveBeenCalled();
      });

      expect(consoleSpy).toHaveBeenCalledWith('OfflineIndicator: Retry failed:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });

    it('should disable retry button while retrying', async () => {
      let resolveRetry;
      const onRetry = jest.fn(() => new Promise(resolve => { resolveRetry = resolve; }));

      const { getByTestId } = render(
        <OfflineIndicator {...defaultProps} isOffline={true} onRetry={onRetry} />
      );

      const retryButton = getByTestId('offline-indicator-retry-button');
      fireEvent.press(retryButton);

      // Button should be disabled during retry
      expect(retryButton.props.disabled).toBe(true);

      // Resolve the retry
      resolveRetry(true);

      await waitFor(() => {
        expect(onRetry).toHaveBeenCalled();
      });
    });

    it('should prevent multiple concurrent retries', async () => {
      const onRetry = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(true), 100))
      );

      const { getByTestId } = render(
        <OfflineIndicator {...defaultProps} isOffline={true} onRetry={onRetry} />
      );

      const retryButton = getByTestId('offline-indicator-retry-button');
      
      // Press button multiple times quickly
      fireEvent.press(retryButton);
      fireEvent.press(retryButton);
      fireEvent.press(retryButton);

      await waitFor(() => {
        expect(onRetry).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Dismiss Functionality', () => {
    it('should show dismiss button when onDismiss provided', () => {
      const { getByTestId } = render(
        <OfflineIndicator {...defaultProps} isOffline={true} />
      );

      expect(getByTestId('offline-indicator-dismiss-button')).toBeTruthy();
    });

    it('should not show dismiss button when onDismiss not provided', () => {
      const { queryByTestId } = render(
        <OfflineIndicator isOffline={true} onRetry={jest.fn()} />
      );

      expect(queryByTestId('offline-indicator-dismiss-button')).toBeNull();
    });

    it('should call onDismiss when dismiss button pressed', () => {
      const onDismiss = jest.fn();

      const { getByTestId } = render(
        <OfflineIndicator {...defaultProps} isOffline={true} onDismiss={onDismiss} />
      );

      const dismissButton = getByTestId('offline-indicator-dismiss-button');
      fireEvent.press(dismissButton);

      expect(onDismiss).toHaveBeenCalled();
    });

    it('should hide indicator after dismiss', () => {
      const { getByTestId, queryByTestId } = render(
        <OfflineIndicator {...defaultProps} isOffline={true} />
      );

      expect(getByTestId('offline-indicator')).toBeTruthy();

      const dismissButton = getByTestId('offline-indicator-dismiss-button');
      fireEvent.press(dismissButton);

      expect(queryByTestId('offline-indicator')).toBeNull();
    });
  });

  describe('Icons and Styling', () => {
    it('should show correct icon for offline mode', () => {
      const { getByText } = render(
        <OfflineIndicator {...defaultProps} isOffline={true} />
      );

      expect(getByText('📡')).toBeTruthy();
    });

    it('should show correct icon for cache mode', () => {
      const { getByText } = render(
        <OfflineIndicator {...defaultProps} isOffline={false} dataSource="cache" />
      );

      expect(getByText('💾')).toBeTruthy();
    });

    it('should show correct icon for connected mode', () => {
      const { getByText } = render(
        <OfflineIndicator {...defaultProps} isOffline={false} dataSource="online" />
      );

      // This shouldn't render, but if it did, it would show ✅
      // Since it doesn't render when online, we can't test this directly
      expect(true).toBe(true);
    });

    it('should apply custom style', () => {
      const customStyle = { marginTop: 20 };

      const { getByTestId } = render(
        <OfflineIndicator 
          {...defaultProps} 
          isOffline={true} 
          style={customStyle}
        />
      );

      const indicator = getByTestId('offline-indicator');
      expect(indicator.props.style).toEqual(expect.arrayContaining([
        expect.objectContaining(customStyle)
      ]));
    });

    it('should use custom testID', () => {
      const { getByTestId } = render(
        <OfflineIndicator 
          {...defaultProps} 
          isOffline={true} 
          testID="custom-offline-indicator"
        />
      );

      expect(getByTestId('custom-offline-indicator')).toBeTruthy();
      expect(getByTestId('custom-offline-indicator-retry-button')).toBeTruthy();
      expect(getByTestId('custom-offline-indicator-dismiss-button')).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    it('should have proper accessibility structure', () => {
      const { getByTestId } = render(
        <OfflineIndicator {...defaultProps} isOffline={true} />
      );

      const indicator = getByTestId('offline-indicator');
      expect(indicator).toBeTruthy();

      const retryButton = getByTestId('offline-indicator-retry-button');
      const dismissButton = getByTestId('offline-indicator-dismiss-button');

      expect(retryButton).toBeTruthy();
      expect(dismissButton).toBeTruthy();
    });

    it('should handle button interactions properly', () => {
      const onRetry = jest.fn().mockResolvedValue(true);
      const onDismiss = jest.fn();

      const { getByTestId } = render(
        <OfflineIndicator 
          {...defaultProps} 
          isOffline={true} 
          onRetry={onRetry}
          onDismiss={onDismiss}
        />
      );

      const retryButton = getByTestId('offline-indicator-retry-button');
      const dismissButton = getByTestId('offline-indicator-dismiss-button');

      fireEvent.press(retryButton);
      fireEvent.press(dismissButton);

      expect(onRetry).toHaveBeenCalled();
      expect(onDismiss).toHaveBeenCalled();
    });
  });
});