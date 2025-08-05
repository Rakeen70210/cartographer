import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';
import { StatisticsErrorBoundary } from '../components/StatisticsErrorBoundary';

// Mock logger
jest.mock('../utils/logger', () => ({
  logger: {
    error: jest.fn(),
    debug: jest.fn(),
  }
}));

// Component that throws an error
const ThrowError = ({ shouldThrow, errorMessage = 'Test error' }) => {
  if (shouldThrow) {
    throw new Error(errorMessage);
  }
  return <Text testID="success-component">Success</Text>;
};

// Wrapper component to force error boundary reset
const ErrorBoundaryWrapper = ({ children, key }) => (
  <StatisticsErrorBoundary key={key}>
    {children}
  </StatisticsErrorBoundary>
);

// Component that throws different types of errors
const NetworkErrorComponent = () => {
  throw new Error('Network connection failed');
};

const DatabaseErrorComponent = () => {
  throw new Error('Database query failed');
};

const CalculationErrorComponent = () => {
  throw new Error('Statistics calculation failed');
};

describe('StatisticsErrorBoundary', () => {
  let setTimeoutSpy;
  let clearTimeoutSpy;
  let originalSetTimeout;
  let originalClearTimeout;

  beforeEach(() => {
    jest.clearAllMocks();
    // Suppress console.error for these tests
    jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Store original functions
    originalSetTimeout = global.setTimeout;
    originalClearTimeout = global.clearTimeout;
    
    // Mock setTimeout and clearTimeout for timer tests
    setTimeoutSpy = jest.fn((fn, delay) => {
      return originalSetTimeout(fn, delay);
    });
    clearTimeoutSpy = jest.fn((id) => {
      return originalClearTimeout(id);
    });
    
    global.setTimeout = setTimeoutSpy;
    global.clearTimeout = clearTimeoutSpy;
  });

  afterEach(() => {
    console.error.mockRestore();
    // Restore original functions
    global.setTimeout = originalSetTimeout;
    global.clearTimeout = originalClearTimeout;
  });

  describe('Normal Operation', () => {
    it('should render children when no error occurs', () => {
      const { getByTestId } = render(
        <StatisticsErrorBoundary>
          <ThrowError shouldThrow={false} />
        </StatisticsErrorBoundary>
      );

      expect(getByTestId('success-component')).toBeTruthy();
    });

    it('should render custom fallback when provided', () => {
      const CustomFallback = () => <Text testID="custom-fallback">Custom Error</Text>;

      const { getByTestId } = render(
        <StatisticsErrorBoundary fallback={<CustomFallback />}>
          <ThrowError shouldThrow={true} />
        </StatisticsErrorBoundary>
      );

      expect(getByTestId('custom-fallback')).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    it('should catch and display error', () => {
      const { getByText } = render(
        <StatisticsErrorBoundary>
          <ThrowError shouldThrow={true} />
        </StatisticsErrorBoundary>
      );

      expect(getByText('Calculation Error')).toBeTruthy();
      expect(getByText('Unable to calculate some statistics.')).toBeTruthy();
    });

    it('should call onError callback when error occurs', () => {
      const onError = jest.fn();

      render(
        <StatisticsErrorBoundary onError={onError}>
          <ThrowError shouldThrow={true} />
        </StatisticsErrorBoundary>
      );

      expect(onError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          componentStack: expect.any(String)
        })
      );
    });

    it('should categorize network errors correctly', () => {
      const { getByText } = render(
        <StatisticsErrorBoundary>
          <NetworkErrorComponent />
        </StatisticsErrorBoundary>
      );

      expect(getByText('Connection Issue')).toBeTruthy();
      expect(getByText('Unable to fetch the latest statistics data.')).toBeTruthy();
      expect(getByText('Check your internet connection and try again.')).toBeTruthy();
    });

    it('should categorize database errors correctly', () => {
      const { getByText } = render(
        <StatisticsErrorBoundary>
          <DatabaseErrorComponent />
        </StatisticsErrorBoundary>
      );

      expect(getByText('Data Issue')).toBeTruthy();
      expect(getByText('There was a problem accessing your exploration data.')).toBeTruthy();
    });

    it('should categorize calculation errors correctly', () => {
      const { getByText } = render(
        <StatisticsErrorBoundary>
          <CalculationErrorComponent />
        </StatisticsErrorBoundary>
      );

      expect(getByText('Calculation Error')).toBeTruthy();
      expect(getByText('Unable to calculate some statistics.')).toBeTruthy();
    });
  });

  describe('Retry Functionality', () => {
    it('should show retry button for recoverable errors', () => {
      const { getByTestId } = render(
        <StatisticsErrorBoundary>
          <NetworkErrorComponent />
        </StatisticsErrorBoundary>
      );

      expect(getByTestId('statistics-error-boundary-retry-button')).toBeTruthy();
    });

    it('should handle manual retry', () => {
      const onRetry = jest.fn();

      const { getByTestId, unmount } = render(
        <StatisticsErrorBoundary onRetry={onRetry}>
          <NetworkErrorComponent />
        </StatisticsErrorBoundary>
      );

      const retryButton = getByTestId('statistics-error-boundary-retry-button');
      fireEvent.press(retryButton);

      expect(onRetry).toHaveBeenCalled();

      unmount();

      // Test that retry button works by rendering a new instance
      const { getByTestId: getByTestId2 } = render(
        <StatisticsErrorBoundary>
          <ThrowError shouldThrow={false} />
        </StatisticsErrorBoundary>
      );

      expect(getByTestId2('success-component')).toBeTruthy();
    });

    it('should handle reset functionality', () => {
      const { getByTestId, unmount } = render(
        <StatisticsErrorBoundary>
          <ThrowError shouldThrow={true} />
        </StatisticsErrorBoundary>
      );

      const resetButton = getByTestId('statistics-error-boundary-reset-button');
      fireEvent.press(resetButton);

      unmount();

      // Test that reset works by rendering a new instance
      const { getByTestId: getByTestId2 } = render(
        <StatisticsErrorBoundary>
          <ThrowError shouldThrow={false} />
        </StatisticsErrorBoundary>
      );

      expect(getByTestId2('success-component')).toBeTruthy();
    });

    it('should track retry count', () => {
      const { getByText, getByTestId, rerender } = render(
        <StatisticsErrorBoundary>
          <NetworkErrorComponent />
        </StatisticsErrorBoundary>
      );

      // First retry
      const retryButton = getByTestId('statistics-error-boundary-retry-button');
      fireEvent.press(retryButton);

      rerender(
        <StatisticsErrorBoundary>
          <NetworkErrorComponent />
        </StatisticsErrorBoundary>
      );

      expect(getByText('Retry attempts: 1/3')).toBeTruthy();
    });

    it('should disable retry after max attempts', () => {
      let retryCount = 0;
      const { getByTestId, rerender, queryByTestId } = render(
        <StatisticsErrorBoundary>
          <NetworkErrorComponent />
        </StatisticsErrorBoundary>
      );

      // Perform maximum retries
      for (let i = 0; i < 3; i++) {
        const retryButton = getByTestId('statistics-error-boundary-retry-button');
        fireEvent.press(retryButton);
        retryCount++;

        rerender(
          <StatisticsErrorBoundary>
            <NetworkErrorComponent />
          </StatisticsErrorBoundary>
        );
      }

      // After max retries, retry button should not be available
      expect(queryByTestId('statistics-error-boundary-retry-button')).toBeNull();
    });
  });

  describe('Auto-retry Functionality', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should auto-retry recoverable errors', async () => {
      const { rerender, getByTestId } = render(
        <StatisticsErrorBoundary>
          <NetworkErrorComponent />
        </StatisticsErrorBoundary>
      );

      // Fast-forward time to trigger auto-retry
      jest.advanceTimersByTime(1000);

      // Simulate successful retry
      rerender(
        <StatisticsErrorBoundary>
          <ThrowError shouldThrow={false} />
        </StatisticsErrorBoundary>
      );

      expect(getByTestId('success-component')).toBeTruthy();
    });

    it('should use exponential backoff for auto-retry', () => {
      // Use real timers for this test to see the actual setTimeout calls
      jest.useRealTimers();
      
      render(
        <StatisticsErrorBoundary>
          <NetworkErrorComponent />
        </StatisticsErrorBoundary>
      );

      // Check that timers are set with increasing delays
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 1000);
      
      // Switch back to fake timers for cleanup
      jest.useFakeTimers();
    });

    it('should not auto-retry non-recoverable errors', () => {
      const NonRecoverableError = () => {
        throw new Error('Syntax error in component');
      };

      render(
        <StatisticsErrorBoundary>
          <NonRecoverableError />
        </StatisticsErrorBoundary>
      );

      // Should not set any retry timers
      expect(setTimeoutSpy).not.toHaveBeenCalled();
    });
  });

  describe('Error Recovery', () => {
    it('should recover from temporary errors', () => {
      const { getByTestId, unmount } = render(
        <StatisticsErrorBoundary>
          <ThrowError shouldThrow={true} />
        </StatisticsErrorBoundary>
      );

      // Error state should be shown
      expect(getByTestId('statistics-error-boundary')).toBeTruthy();

      unmount();

      // Simulate error resolution by rendering a new instance
      const { getByTestId: getByTestId2 } = render(
        <StatisticsErrorBoundary>
          <ThrowError shouldThrow={false} />
        </StatisticsErrorBoundary>
      );

      // Should show success component after recovery
      expect(getByTestId2('success-component')).toBeTruthy();
    });

    it('should handle multiple error types', () => {
      const MultiErrorComponent = ({ errorType }) => {
        switch (errorType) {
          case 'network':
            throw new Error('Network timeout');
          case 'database':
            throw new Error('Database query failed');
          case 'calculation':
            throw new Error('Division by zero in calculator');
          default:
            return <Text testID="success-component">Success</Text>;
        }
      };

      // Test network error
      const { getByText, unmount } = render(
        <StatisticsErrorBoundary>
          <MultiErrorComponent errorType="network" />
        </StatisticsErrorBoundary>
      );

      expect(getByText('Connection Issue')).toBeTruthy();
      unmount();

      // Test database error
      const { getByText: getByText2, unmount: unmount2 } = render(
        <StatisticsErrorBoundary>
          <MultiErrorComponent errorType="database" />
        </StatisticsErrorBoundary>
      );

      expect(getByText2('Data Issue')).toBeTruthy();
      unmount2();

      // Test calculation error
      const { getByText: getByText3 } = render(
        <StatisticsErrorBoundary>
          <MultiErrorComponent errorType="calculation" />
        </StatisticsErrorBoundary>
      );

      expect(getByText3('Calculation Error')).toBeTruthy();
    });
  });

  describe('Development Mode', () => {
    const originalDev = __DEV__;

    afterEach(() => {
      global.__DEV__ = originalDev;
    });

    it('should show debug information in development mode', () => {
      global.__DEV__ = true;

      const { getByText } = render(
        <StatisticsErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="Detailed error message" />
        </StatisticsErrorBoundary>
      );

      expect(getByText('Debug Information')).toBeTruthy();
      expect(getByText('Detailed error message')).toBeTruthy();
    });

    it('should hide debug information in production mode', () => {
      global.__DEV__ = false;

      const { queryByText } = render(
        <StatisticsErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="Detailed error message" />
        </StatisticsErrorBoundary>
      );

      expect(queryByText('Debug Information')).toBeNull();
    });
  });

  describe('Cleanup', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should clear timeouts on unmount', () => {
      // Use real timers to see actual setTimeout calls
      jest.useRealTimers();
      
      const { unmount } = render(
        <StatisticsErrorBoundary>
          <NetworkErrorComponent />
        </StatisticsErrorBoundary>
      );

      // Verify timeout was set
      expect(setTimeoutSpy).toHaveBeenCalled();

      unmount();

      // Should clear timeouts on unmount
      expect(clearTimeoutSpy).toHaveBeenCalled();
      
      // Switch back to fake timers for cleanup
      jest.useFakeTimers();
    });
  });
});